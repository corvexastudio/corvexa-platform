import type { SupabaseClient } from '@supabase/supabase-js'
import { getSaasPlan, getPayPalPlanId, getEffectiveSetupFee } from '../billing/plans.ts'
import { logAuditEvent } from '../security/audit-logger.ts'

export const ALLOWED_PAID_PLAN_TIERS = ['solo', 'multi_crew', 'fleet'] as const
export type AllowedPaidPlanTier = typeof ALLOWED_PAID_PLAN_TIERS[number]

export interface CreateOrRevisePayPalSubscriptionInput {
  orgId: string
  planTier: 'solo' | 'fleet' | 'multi_crew'
  returnUrl: string
  cancelUrl: string
  existingSubscriptionId?: string | null
  waiveSetupFee?: boolean
  effectiveSetupFeeOverride?: number
}

export interface PayPalSubscriptionResult {
  success: boolean
  subscriptionId: string
  approvalUrl?: string
  revised?: boolean
  revisedImmediately?: boolean
  simulated?: boolean
  error?: string
}

export interface PayPalSubscriptionDetails {
  id: string
  status: 'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED'
  plan_id: string
  start_time?: string
  custom_id?: string
  subscriber?: {
    email_address?: string
    payer_id?: string
    name?: {
      given_name?: string
      surname?: string
    }
  }
  billing_info?: {
    next_billing_time?: string
    last_payment?: {
      amount: { currency_code: string; value: string }
      time: string
    }
  }
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null

export class PayPalService {
  /**
   * Determines whether the runtime is an active production environment
   */
  static isProductionEnvironment(): boolean {
    return (
      process.env.NODE_ENV === 'production' ||
      process.env.APP_ENV === 'production' ||
      process.env.VERCEL_ENV === 'production'
    )
  }

  /**
   * Determines whether mock/simulated billing responses are explicitly permitted.
   * STRICT SAFEGUARD: Simulation is NEVER permitted in production environments under any circumstances.
   */
  static isSimulationPermitted(): boolean {
    if (this.isProductionEnvironment()) {
      return false
    }
    return process.env.NODE_ENV === 'test' || process.env.PAYPAL_MOCK_DISPATCH === 'true'
  }

  /**
   * Determines whether live PayPal environment is active
   */
  static isLiveEnvironment(): boolean {
    return process.env.PAYPAL_ENVIRONMENT === 'live' || (process.env.NODE_ENV === 'production' && process.env.PAYPAL_ENVIRONMENT !== 'sandbox')
  }

  /**
   * Returns base PayPal REST API endpoint
   */
  static getApiBaseUrl(): string {
    return this.isLiveEnvironment()
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com'
  }

  /**
   * Checks whether PayPal credentials are fully configured
   */
  static isConfigured(): boolean {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID
    const secret = process.env.PAYPAL_CLIENT_SECRET
    return Boolean(clientId && secret)
  }

  /**
   * Retrieves OAuth2 client credentials token with caching
   */
  static async getAccessToken(): Promise<string> {
    const now = Date.now()
    if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60000) {
      return cachedAccessToken.token
    }

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID
    const secret = process.env.PAYPAL_CLIENT_SECRET

    if (!clientId || !secret) {
      throw new Error('PayPal client credentials are not configured.')
    }

    const auth = Buffer.from(`${clientId}:${secret}`).toString('base64')
    const res = await fetch(`${this.getApiBaseUrl()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Failed to obtain PayPal access token: ${res.status} ${errText}`)
    }

    const data = await res.json()
    cachedAccessToken = {
      token: data.access_token,
      expiresAt: now + (Number(data.expires_in) || 3600) * 1000
    }

    return data.access_token
  }

  /**
   * Creates a new subscription or in-place upgrades an existing subscription without double-billing
   */
  static async createOrRevisePayPalSubscription(
    input: CreateOrRevisePayPalSubscriptionInput
  ): Promise<PayPalSubscriptionResult> {
    const { orgId, planTier, returnUrl, cancelUrl, existingSubscriptionId, waiveSetupFee, effectiveSetupFeeOverride } = input
    const targetPlan = getSaasPlan(planTier)
    const payPalPlanId = getPayPalPlanId(planTier)

    // Offline / Test Simulation Mode when credentials are not present
    if (!this.isConfigured()) {
      if (this.isProductionEnvironment()) {
        return {
          success: false,
          subscriptionId: '',
          error: 'PayPal billing is not configured in this production environment.'
        }
      }
      if (!this.isSimulationPermitted()) {
        return {
          success: false,
          subscriptionId: '',
          error: 'PayPal client credentials are not configured.'
        }
      }
      const simSubId = existingSubscriptionId || `sub_sim_${Date.now()}`
      const simulatedApprovalUrl = `${returnUrl}?subscription_id=${simSubId}&simulated=true`
      return {
        success: true,
        subscriptionId: simSubId,
        approvalUrl: simulatedApprovalUrl,
        revised: Boolean(existingSubscriptionId),
        simulated: true
      }
    }

    const accessToken = await this.getAccessToken()

    // ── In-Place Upgrade Flow (/revise) ──
    // Upgrades an existing Solo ($99) subscription to Fleet ($199) cleanly without double-billing
    if (existingSubscriptionId) {
      try {
        const reviseRes = await fetch(`${this.getApiBaseUrl()}/v1/billing/subscriptions/${existingSubscriptionId}/revise`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            plan_id: payPalPlanId,
            plan: {
              payment_preferences: {
                setup_fee: {
                  value: '0.00', // Setup fee is ALWAYS waived on upgrades!
                  currency_code: 'USD'
                }
              }
            },
            application_context: {
              return_url: returnUrl,
              cancel_url: cancelUrl
            }
          })
        })

        if (!reviseRes.ok) {
          const errData = await reviseRes.json().catch(() => ({}))
          console.error('[PAYPAL_SUBSCRIPTION_REVISE_ERROR]', errData)
          // If revise fails because subscription is not revisable, fall through to create new subscription
        } else {
          const reviseData = await reviseRes.json()
          const approveLink = reviseData.links?.find((l: any) => l.rel === 'approve')?.href

          return {
            success: true,
            subscriptionId: existingSubscriptionId,
            approvalUrl: approveLink || returnUrl,
            revised: true,
            revisedImmediately: !approveLink,
            simulated: false
          }
        }
      } catch (reviseErr: any) {
        console.warn('[PAYPAL_REVISE_ATTEMPT_FAILED_FALLING_BACK]', reviseErr?.message)
      }
    }

    // ── New Subscription Flow (/v1/billing/subscriptions) ──
    // Calculate setup fee override: waived to $0.00 by default, or exact amount if enabled
    const effectiveFee = typeof effectiveSetupFeeOverride === 'number'
      ? effectiveSetupFeeOverride
      : (waiveSetupFee === false ? targetPlan.standardSetupFee : 0)

    const payload = {
      plan_id: payPalPlanId,
      custom_id: orgId, // Authoritative link tying subscription to organization
      plan: {
        payment_preferences: {
          setup_fee: {
            value: effectiveFee.toFixed(2),
            currency_code: 'USD'
          },
          setup_fee_failure_action: 'CANCEL'
        }
      },
      application_context: {
        brand_name: 'CaptoDesk',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl
      }
    }

    const res = await fetch(`${this.getApiBaseUrl()}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[PAYPAL_CREATE_SUBSCRIPTION_ERROR]', data)
      return {
        success: false,
        subscriptionId: '',
        error: data.message || data.details?.[0]?.description || 'Failed to initialize PayPal subscription checkout.'
      }
    }

    const approvalUrl = data.links?.find((l: any) => l.rel === 'approve')?.href

    return {
      success: true,
      subscriptionId: data.id,
      approvalUrl,
      simulated: false
    }
  }

  /**
   * Retrieves subscription details from PayPal
   */
  static async getPayPalSubscription(
    subscriptionId: string,
    simContext?: {
      expectedOrgId?: string
      expectedPlanId?: string
      expectedStatus?: string
    }
  ): Promise<PayPalSubscriptionDetails> {
    if (!subscriptionId || typeof subscriptionId !== 'string' || !subscriptionId.trim()) {
      throw new Error('Subscription ID is required.')
    }

    const cleanSubId = subscriptionId.trim()

    // ── 1. Production Security Safeguards ──
    // In production, mock prefixes or unconfigured states must fail immediately and closed.
    if (this.isProductionEnvironment()) {
      if (cleanSubId.startsWith('sub_sim_')) {
        throw new Error('Simulated subscription IDs (sub_sim_) are strictly rejected in production.')
      }
      if (!this.isConfigured()) {
        throw new Error('PayPal client credentials are not configured in production environment.')
      }
    }

    // ── 2. Explicit Test Mode Simulation ──
    // ONLY permitted in non-production test/sandbox environments
    if (!this.isProductionEnvironment() && this.isSimulationPermitted()) {
      if (cleanSubId.startsWith('sub_sim_')) {
        if (cleanSubId.includes('mismatched_org')) {
          return {
            id: cleanSubId,
            status: 'ACTIVE',
            plan_id: simContext?.expectedPlanId || getPayPalPlanId('solo'),
            start_time: new Date().toISOString(),
            custom_id: 'org_different_tenant_999',
            subscriber: {
              email_address: 'other@example.com',
              payer_id: 'PAYER_OTHER_999',
              name: { given_name: 'Other', surname: 'Contractor' }
            }
          }
        }

        if (cleanSubId.includes('missing_custom_id')) {
          return {
            id: cleanSubId,
            status: 'ACTIVE',
            plan_id: simContext?.expectedPlanId || getPayPalPlanId('solo'),
            start_time: new Date().toISOString(),
            subscriber: {
              email_address: 'test@example.com',
              payer_id: 'PAYER_TEST_123',
              name: { given_name: 'Test', surname: 'Contractor' }
            }
          }
        }

        if (cleanSubId.includes('mismatched_plan')) {
          return {
            id: cleanSubId,
            status: 'ACTIVE',
            plan_id: 'P-INVALID-MISMATCHED-PLAN-999',
            start_time: new Date().toISOString(),
            custom_id: simContext?.expectedOrgId || 'org-test',
            subscriber: {
              email_address: 'test@example.com',
              payer_id: 'PAYER_TEST_123',
              name: { given_name: 'Test', surname: 'Contractor' }
            }
          }
        }

        if (cleanSubId.includes('missing_plan_id')) {
          return {
            id: cleanSubId,
            status: 'ACTIVE',
            plan_id: '',
            start_time: new Date().toISOString(),
            custom_id: simContext?.expectedOrgId || 'org-test',
            subscriber: {
              email_address: 'test@example.com',
              payer_id: 'PAYER_TEST_123',
              name: { given_name: 'Test', surname: 'Contractor' }
            }
          }
        }

        if (cleanSubId.includes('status_cancelled')) {
          return {
            id: cleanSubId,
            status: 'CANCELLED',
            plan_id: simContext?.expectedPlanId || getPayPalPlanId('solo'),
            start_time: new Date().toISOString(),
            custom_id: simContext?.expectedOrgId || 'org-test',
            subscriber: {
              email_address: 'test@example.com',
              payer_id: 'PAYER_TEST_123',
              name: { given_name: 'Test', surname: 'Contractor' }
            }
          }
        }

        if (cleanSubId.includes('status_pending')) {
          return {
            id: cleanSubId,
            status: 'APPROVAL_PENDING',
            plan_id: simContext?.expectedPlanId || getPayPalPlanId('solo'),
            start_time: new Date().toISOString(),
            custom_id: simContext?.expectedOrgId || 'org-test',
            subscriber: {
              email_address: 'test@example.com',
              payer_id: 'PAYER_TEST_123',
              name: { given_name: 'Test', surname: 'Contractor' }
            }
          }
        }

        // Standard test simulation fixture
        return {
          id: cleanSubId,
          status: (simContext?.expectedStatus as any) || 'ACTIVE',
          plan_id: simContext?.expectedPlanId || getPayPalPlanId('solo'),
          start_time: new Date().toISOString(),
          custom_id: simContext?.expectedOrgId || 'mock_org',
          subscriber: {
            email_address: 'contractor@example.com',
            payer_id: 'MOCK_PAYER_123',
            name: { given_name: 'Alex', surname: 'Contractor' }
          }
        }
      }

      if (!this.isConfigured()) {
        throw new Error('PayPal client credentials are not configured.')
      }
    }

    if (!this.isConfigured()) {
      throw new Error('PayPal client credentials are not configured.')
    }

    const accessToken = await this.getAccessToken()
    const res = await fetch(`${this.getApiBaseUrl()}/v1/billing/subscriptions/${cleanSubId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Failed to fetch PayPal subscription ${cleanSubId}: ${res.status} ${err}`)
    }

    return res.json()
  }

  /**
   * Verifies payment completion and activates the organization subscription
   */
  static async verifyAndActivateSubscription(
    supabase: SupabaseClient,
    input: {
      subscriptionId: string
      orgId: string
      planTier: AllowedPaidPlanTier | string
      actorId?: string
      actorEmail?: string
    }
  ): Promise<{ success: boolean; organization?: any; planTier?: string; error?: string }> {
    const { subscriptionId, orgId, planTier, actorId, actorEmail } = input

    // ── Step 1: Input Validation ──
    if (!subscriptionId || typeof subscriptionId !== 'string' || !subscriptionId.trim()) {
      return { success: false, error: 'Subscription ID is required.' }
    }
    const cleanSubId = subscriptionId.trim()

    if (!orgId || typeof orgId !== 'string' || !orgId.trim()) {
      return { success: false, error: 'Organization ID is required.' }
    }
    const cleanOrgId = orgId.trim()

    // ── Step 2: Tier Allowlist Validation ──
    const normalizedTier = (planTier || '').toLowerCase().trim()
    if (!ALLOWED_PAID_PLAN_TIERS.includes(normalizedTier as any)) {
      return {
        success: false,
        error: `Invalid or unauthorized requested plan tier: '${planTier}'. Allowed tiers are: ${ALLOWED_PAID_PLAN_TIERS.join(', ')}.`
      }
    }

    const targetPlan = getSaasPlan(normalizedTier)
    const targetPlanId = (targetPlan.tier === 'multi_crew' || targetPlan.tier === 'fleet') ? 'multi_crew' : 'solo'

    // ── Step 3: Server-Authoritative Plan ID Resolution ──
    const expectedPlanId = getPayPalPlanId(normalizedTier)
    if (!expectedPlanId || expectedPlanId.trim().length === 0) {
      return {
        success: false,
        error: `PayPal plan configuration is missing for tier '${normalizedTier}'.`
      }
    }

    try {
      // ── Step 3.5: Multi-Tenant Collision Pre-Check ──
      // Ensure the same subscription is never claimed by another organization
      let conflictQuery = supabase
        .from('organizations')
        .select('id, name')
        .eq('paypal_subscription_id', cleanSubId)

      if (typeof (conflictQuery as any)?.neq === 'function') {
        conflictQuery = (conflictQuery as any).neq('id', cleanOrgId)
      }

      const { data: conflictingOrg } = await (conflictQuery as any).maybeSingle()

      if (conflictingOrg && conflictingOrg.id !== cleanOrgId) {
        return {
          success: false,
          error: 'This PayPal subscription is already linked to another organization.'
        }
      }

      // ── Step 3.6: Idempotency & Safe Retry Check ──
      const { data: currentOrg } = await supabase
        .from('organizations')
        .select('id, subscription_status, plan_id, paypal_subscription_id, monthly_rate')
        .eq('id', cleanOrgId)
        .maybeSingle()

      if (
        currentOrg &&
        currentOrg.paypal_subscription_id === cleanSubId &&
        currentOrg.subscription_status === 'active' &&
        currentOrg.plan_id === targetPlanId
      ) {
        return {
          success: true,
          planTier: targetPlanId,
          organization: currentOrg
        }
      }

      // ── Step 4: Fetch Authoritative Subscription From Provider ──
      const details = await this.getPayPalSubscription(cleanSubId, {
        expectedOrgId: cleanOrgId,
        expectedPlanId
      })

      // ── Step 5: Provider Status Verification ──
      const validStatuses = ['ACTIVE', 'APPROVED']
      if (!details.status || !validStatuses.includes(details.status)) {
        return {
          success: false,
          error: `Subscription is currently in '${details.status || 'UNKNOWN'}' status and cannot be activated. Expected ACTIVE or APPROVED.`
        }
      }

      // ── Step 6: Exact Organization Binding Verification (custom_id) ──
      if (!details.custom_id || typeof details.custom_id !== 'string' || details.custom_id.trim().length === 0) {
        return {
          success: false,
          error: 'Subscription does not contain a verified organization binding (custom_id is missing).'
        }
      }

      if (details.custom_id.trim() !== cleanOrgId) {
        return {
          success: false,
          error: 'Subscription organization binding does not match the authenticated organization.'
        }
      }

      // ── Step 7: Exact Plan ID Verification (plan_id) ──
      if (!details.plan_id || typeof details.plan_id !== 'string' || details.plan_id.trim().length === 0) {
        return {
          success: false,
          error: 'Subscription does not contain a verified PayPal plan ID.'
        }
      }

      if (details.plan_id.trim() !== expectedPlanId.trim()) {
        return {
          success: false,
          error: `Subscription plan ID '${details.plan_id}' does not match expected plan ID '${expectedPlanId}' for tier '${normalizedTier}'.`
        }
      }

      const now = new Date().toISOString()
      const payerId = details.subscriber?.payer_id || null
      const payerEmail = details.subscriber?.email_address || null

      // ── Step 10: Server-Authoritative Database Activation ──
      const { data: updatedOrg, error: orgUpdateErr } = await supabase
        .from('organizations')
        .update({
          subscription_status: 'active',
          plan_id: targetPlanId,
          billing_provider: 'paypal',
          paypal_subscription_id: cleanSubId,
          paypal_plan_id: details.plan_id,
          paypal_payer_id: payerId,
          monthly_rate: targetPlan.amount,
          updated_at: now
        })
        .eq('id', cleanOrgId)
        .select('*')
        .single()

      if (orgUpdateErr || !updatedOrg) {
        console.error('[PAYPAL_ACTIVATE_ORG_ERROR]', orgUpdateErr)
        return {
          success: false,
          error: 'Database error updating organization subscription state.'
        }
      }

      // ── Step 11: Synchronize saas_subscriptions ──
      await supabase
        .from('saas_subscriptions')
        .upsert({
          org_id: cleanOrgId,
          plan_id: targetPlanId,
          amount: targetPlan.amount,
          currency: 'USD',
          status: 'active',
          billing_interval: 'month',
          provider: 'paypal',
          paypal_subscription_id: cleanSubId,
          paypal_plan_id: details.plan_id,
          current_period_start: details.start_time || now,
          updated_at: now
        }, { onConflict: 'org_id' })

      // ── Step 12: Security Audit Logging ──
      await logAuditEvent(supabase, {
        org_id: cleanOrgId,
        event_type: 'billing.subscription_activated',
        description: `PayPal SaaS subscription activated for ${targetPlan.name} ($${targetPlan.amount}/mo)`,
        metadata: {
          actor_id: actorId || 'system',
          actor_email: actorEmail || null,
          subscription_id: cleanSubId,
          plan_tier: targetPlanId,
          amount: targetPlan.amount,
          paypal_plan_id: details.plan_id,
          payer_id: payerId,
          payer_email: payerEmail
        }
      })

      return {
        success: true,
        planTier: targetPlanId,
        organization: updatedOrg
      }
    } catch (err: any) {
      console.error('[PAYPAL_VERIFY_AND_ACTIVATE_EXCEPTION]', err)
      return {
        success: false,
        error: err?.message || 'Error verifying PayPal subscription'
      }
    }
  }

  /**
   * Cancels a PayPal recurring subscription
   */
  static async cancelPayPalSubscription(
    subscriptionId: string,
    reason: string = 'Contractor requested cancellation via portal'
  ): Promise<{ success: boolean; error?: string }> {
    if (this.isProductionEnvironment()) {
      if (!this.isConfigured()) {
        return { success: false, error: 'PayPal credentials are not configured in production.' }
      }
      if (subscriptionId.startsWith('sub_sim_')) {
        return { success: false, error: 'Simulated subscription IDs are not permitted in production.' }
      }
    } else if (this.isSimulationPermitted()) {
      if (!this.isConfigured() || subscriptionId.startsWith('sub_sim_')) {
        return { success: true }
      }
    }

    try {
      const accessToken = await this.getAccessToken()
      const res = await fetch(`${this.getApiBaseUrl()}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: reason.slice(0, 120) })
      })

      if (!res.ok && res.status !== 204) {
        const text = await res.text()
        return { success: false, error: `PayPal cancellation returned ${res.status}: ${text}` }
      }

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to cancel subscription in PayPal' }
    }
  }

  /**
   * Verifies an incoming PayPal webhook cryptographic signature
   */
  static async verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<{ isValid: boolean; error?: string }> {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID

    // If webhook ID is not configured in local/test environment, gracefully pass simulation
    if (!webhookId || !this.isConfigured()) {
      if (!this.isLiveEnvironment()) {
        return { isValid: true }
      }
      return { isValid: false, error: 'PAYPAL_WEBHOOK_ID is not configured in production.' }
    }

    try {
      const authAlgo = String(headers['paypal-auth-algo'] || headers['Paypal-Auth-Algo'] || '')
      const certUrl = String(headers['paypal-cert-url'] || headers['Paypal-Cert-Url'] || '')
      const transmissionId = String(headers['paypal-transmission-id'] || headers['Paypal-Transmission-Id'] || '')
      const transmissionSig = String(headers['paypal-transmission-sig'] || headers['Paypal-Transmission-Sig'] || '')
      const transmissionTime = String(headers['paypal-transmission-time'] || headers['Paypal-Transmission-Time'] || '')

      if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
        return { isValid: false, error: 'Missing required PayPal cryptographic verification headers.' }
      }

      const accessToken = await this.getAccessToken()
      const res = await fetch(`${this.getApiBaseUrl()}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: webhookId,
          webhook_event: JSON.parse(rawBody)
        })
      })

      if (!res.ok) {
        return { isValid: false, error: `Signature verification endpoint returned ${res.status}` }
      }

      const data = await res.json()
      const isValid = data.verification_status === 'SUCCESS'
      return {
        isValid,
        error: isValid ? undefined : `Verification status: ${data.verification_status}`
      }
    } catch (err: any) {
      return { isValid: false, error: err?.message || 'Webhook signature verification failed' }
    }
  }
}

// Standalone export aliases for functional API
export const createOrRevisePayPalSubscription = (input: CreateOrRevisePayPalSubscriptionInput) =>
  PayPalService.createOrRevisePayPalSubscription(input)

export const verifyAndActivateSubscription = (
  supabaseOrInput: any,
  maybeInput?: any
) => {
  if (maybeInput) {
    return PayPalService.verifyAndActivateSubscription(supabaseOrInput, maybeInput)
  }
  return PayPalService.verifyAndActivateSubscription(supabaseOrInput.supabase, {
    subscriptionId: supabaseOrInput.subscriptionId,
    orgId: supabaseOrInput.orgId || supabaseOrInput.expectedOrgId,
    planTier: typeof supabaseOrInput.planTier !== 'undefined' ? supabaseOrInput.planTier : (supabaseOrInput.expectedPlanTier || 'solo')
  })
}

export const cancelPayPalSubscription = (subscriptionId: string, reason?: string) =>
  PayPalService.cancelPayPalSubscription(subscriptionId, reason)

export const verifyWebhookSignature = (
  headersOrInput: any,
  maybeRawBody?: string
) => {
  if (typeof maybeRawBody === 'string') {
    return PayPalService.verifyWebhookSignature(headersOrInput, maybeRawBody)
  }
  return PayPalService.verifyWebhookSignature(headersOrInput?.headers || {}, headersOrInput?.rawBody || '')
}
