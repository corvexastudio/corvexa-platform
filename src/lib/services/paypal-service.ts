import type { SupabaseClient } from '@supabase/supabase-js'
import { getSaasPlan, getPayPalPlanId, getEffectiveSetupFee } from '../billing/plans.ts'
import { logAuditEvent } from '../security/audit-logger.ts'

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
  static async getPayPalSubscription(subscriptionId: string): Promise<PayPalSubscriptionDetails> {
    if (!this.isConfigured() || subscriptionId.startsWith('sub_sim_')) {
      return {
        id: subscriptionId,
        status: 'ACTIVE',
        plan_id: process.env.NEXT_PUBLIC_PAYPAL_SOLO_PLAN_ID || 'P-SOLO-99',
        start_time: new Date().toISOString(),
        custom_id: 'mock_org',
        subscriber: {
          email_address: 'contractor@example.com',
          payer_id: 'MOCK_PAYER_123',
          name: { given_name: 'Alex', surname: 'Contractor' }
        }
      }
    }

    const accessToken = await this.getAccessToken()
    const res = await fetch(`${this.getApiBaseUrl()}/v1/billing/subscriptions/${subscriptionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Failed to fetch PayPal subscription ${subscriptionId}: ${res.status} ${err}`)
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
      planTier: 'solo' | 'fleet' | 'multi_crew'
    }
  ): Promise<{ success: boolean; organization?: any; planTier?: string; error?: string }> {
    const { subscriptionId, orgId, planTier } = input
    const targetPlan = getSaasPlan(planTier)
    const targetPlanId = (targetPlan.tier === 'multi_crew' || targetPlan.tier === 'fleet') ? 'multi_crew' : 'solo'

    try {
      const details = await this.getPayPalSubscription(subscriptionId)

      // Ensure subscription is in valid paying state
      const validStatuses = ['ACTIVE', 'APPROVED']
      if (!validStatuses.includes(details.status) && !subscriptionId.startsWith('sub_sim_')) {
        return {
          success: false,
          error: `Subscription is currently in '${details.status}' status and cannot be activated.`
        }
      }

      const now = new Date().toISOString()
      const payerId = details.subscriber?.payer_id || null
      const payerEmail = details.subscriber?.email_address || null

      // 1. Update organization to active commercial subscription
      const { data: updatedOrg, error: orgUpdateErr } = await supabase
        .from('organizations')
        .update({
          subscription_status: 'active',
          plan_id: targetPlanId,
          billing_provider: 'paypal',
          paypal_subscription_id: subscriptionId,
          paypal_plan_id: details.plan_id || getPayPalPlanId(planTier),
          paypal_payer_id: payerId,
          monthly_rate: targetPlan.amount,
          updated_at: now
        })
        .eq('id', orgId)
        .select('*')
        .single()

      if (orgUpdateErr) {
        console.error('[PAYPAL_ACTIVATE_ORG_ERROR]', orgUpdateErr)
        return { success: false, error: 'Database error updating organization subscription state.' }
      }

      // 2. Synchronize saas_subscriptions record
      await supabase
        .from('saas_subscriptions')
        .upsert({
          org_id: orgId,
          plan_id: targetPlanId,
          amount: targetPlan.amount,
          currency: 'USD',
          status: 'active',
          billing_interval: 'month',
          provider: 'paypal',
          paypal_subscription_id: subscriptionId,
          paypal_plan_id: details.plan_id || getPayPalPlanId(planTier),
          current_period_start: details.start_time || now,
          updated_at: now
        }, { onConflict: 'org_id' })

      // 3. Log security audit event
      await logAuditEvent(supabase, {
        org_id: orgId,
        event_type: 'billing.subscription_activated',
        description: `PayPal SaaS subscription activated for ${targetPlan.name} ($${targetPlan.amount}/mo)`,
        metadata: {
          subscription_id: subscriptionId,
          plan_tier: targetPlanId,
          amount: targetPlan.amount,
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
      return { success: false, error: err?.message || 'Error verifying PayPal subscription' }
    }
  }

  /**
   * Cancels a PayPal recurring subscription
   */
  static async cancelPayPalSubscription(
    subscriptionId: string,
    reason: string = 'Contractor requested cancellation via portal'
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured() || subscriptionId.startsWith('sub_sim_')) {
      return { success: true }
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
    planTier: supabaseOrInput.planTier || supabaseOrInput.expectedPlanTier || 'solo'
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
