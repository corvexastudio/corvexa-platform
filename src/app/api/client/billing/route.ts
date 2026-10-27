import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../lib/security/tenant-context.ts'
import { SubscriptionService } from '../../../../lib/billing/subscription-service.ts'
import {
  getSaasPlan,
  SAAS_PLAN_LIST,
  DEFAULT_SAAS_PLAN_ID,
  getStandardSetupFee,
  getEffectiveSetupFee,
  getActiveBillingProvider
} from '../../../../lib/billing/plans.ts'
import { StripeService } from '../../../../lib/services/stripe-service.ts'
import { PayPalService } from '../../../../lib/services/paypal-service.ts'
import { logAuditEvent } from '../../../../lib/security/audit-logger.ts'

export const dynamic = 'force-dynamic'

export interface BillingRouteContext {
  params?: Promise<Record<string, string | string[] | undefined>>
  customSupabase?: any
}

export async function GET(request?: Request, context?: BillingRouteContext) {
  const tenantResult = await getTenantContext('org:view', context?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, user, supabase, role } = tenantResult

  // 1. Fetch organization
  let org: any = null
  const { data: orgData, error: orgErr } = await supabase
    .from('organizations')
    .select(`
      id,
      name,
      slug,
      subscription_status,
      plan_id,
      monthly_rate,
      telnyx_phone_number,
      carrier_registration_status,
      legal_business_name,
      ein,
      is_sole_proprietor,
      address_street,
      address_city,
      address_state,
      address_postal_code,
      billing_provider,
      paypal_subscription_id,
      paypal_plan_id,
      waive_setup_fee,
      external_payment_url,
      payment_instructions
    `)
    .eq('id', orgId)
    .maybeSingle()

  if (orgErr && (orgErr.code === '42703' || orgErr.message?.includes('does not exist'))) {
    // Schema fallback if newer migration columns are pending
    const retryOrg = await supabase
      .from('organizations')
      .select('id, name, slug, subscription_status, monthly_rate, telnyx_phone_number, carrier_registration_status, legal_business_name, ein, is_sole_proprietor, address_street, address_city, address_state, address_postal_code')
      .eq('id', orgId)
      .maybeSingle()
    org = retryOrg.data
  } else {
    org = orgData
  }

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  // 2. Fetch subscription and entitlement
  const subscription = await SubscriptionService.getSubscription(supabase, orgId)
  const entitlement = await SubscriptionService.getEntitlement(supabase, orgId)
  const effectivePlanId = subscription?.plan_id || org?.plan_id || 'free'
  const currentPlan = getSaasPlan(effectivePlanId)
  const payments = await SubscriptionService.getPaymentHistory(supabase, orgId)

  const activeProvider = org?.billing_provider || getActiveBillingProvider()

  const availablePlansWithFees = SAAS_PLAN_LIST.map((p) => ({
    ...p,
    standardSetupFee: getStandardSetupFee(p.id),
    effectiveSetupFee: getEffectiveSetupFee(p.id, org)
  }))

  return NextResponse.json({
    organization: org,
    subscription,
    entitlement,
    currentPlan: {
      ...currentPlan,
      standardSetupFee: getStandardSetupFee(currentPlan.id),
      effectiveSetupFee: getEffectiveSetupFee(currentPlan.id, org)
    },
    availablePlans: availablePlansWithFees,
    payments: payments.slice(0, 20),
    billingProvider: activeProvider,
    canManageBilling: role === 'owner' || role === 'super_admin'
  })
}

export async function POST(request: Request, context?: BillingRouteContext) {
  const tenantResult = await getTenantContext('org:billing', context?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, user, supabase } = tenantResult
  const body = await request.json().catch(() => ({}))
  const action = body.action

  if (action === 'cancel') {
    const reason = typeof body.reason === 'string' ? body.reason.trim() : 'Customer requested cancellation via portal'
    
    // Check if organization is billed through PayPal
    const { data: org } = await supabase
      .from('organizations')
      .select('id, paypal_subscription_id, billing_provider')
      .eq('id', orgId)
      .maybeSingle()

    if (org?.paypal_subscription_id) {
      await PayPalService.cancelPayPalSubscription(org.paypal_subscription_id, reason)

      // Gracefully transition organization back to Free Booking Link tier
      const now = new Date().toISOString()
      await supabase
        .from('organizations')
        .update({
          subscription_status: 'free',
          plan_id: 'free',
          monthly_rate: 0,
          updated_at: now
        })
        .eq('id', orgId)

      await supabase
        .from('saas_subscriptions')
        .update({
          status: 'canceled',
          canceled_at: now,
          updated_at: now
        })
        .eq('org_id', orgId)

      await logAuditEvent(supabase, {
        org_id: orgId,
        event_type: 'billing.subscription_canceled',
        description: `PayPal subscription ${org.paypal_subscription_id} canceled by customer. Returned to Free tier.`,
        metadata: { actor_id: user.id, reason }
      })

      return NextResponse.json({
        success: true,
        message: 'Your subscription has been canceled. Your account and public booking link remain active on the Free tier.'
      })
    }

    // Default Stripe cancellation
    const subscription = await SubscriptionService.cancelSubscription(
      supabase,
      { id: user.id, email: user.email, role: 'owner' },
      orgId,
      { immediate: false, reason }
    )

    return NextResponse.json({
      success: true,
      message: 'Subscription scheduled for cancellation at the end of your billing cycle. Access will remain active until then.',
      subscription
    })
  }

  if (action === 'reactivate') {
    const subscription = await SubscriptionService.reactivateSubscription(
      supabase,
      { id: user.id, email: user.email, role: 'owner' },
      orgId
    )

    return NextResponse.json({
      success: true,
      message: 'Subscription successfully reactivated. Your recurring plan remains active.',
      subscription
    })
  }

  if (action === 'upgrade_plan' || action === 'switch_tier') {
    const rawTarget = body.targetPlanId || body.tier || 'solo'
    const targetPlan = getSaasPlan(rawTarget)
    const targetPlanId = (targetPlan.tier === 'multi_crew' || targetPlan.tier === 'fleet') ? 'multi_crew' : 'solo'

    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, slug, billing_provider, paypal_subscription_id, waive_setup_fee')
      .eq('id', orgId)
      .maybeSingle()

    const subscription = await SubscriptionService.getSubscription(supabase, orgId)
    const stripeSubId = (subscription as any)?.stripe_subscription_id
    const paypalSubId = org?.paypal_subscription_id || (subscription as any)?.paypal_subscription_id
    const activeProvider = org?.billing_provider || getActiveBillingProvider()

    const reqUrl = new URL(request.url)
    const baseUrl = reqUrl.origin

    // ── PRIMARY FLOW: PayPal Subscriptions (when active provider is PayPal, or PayPal sub exists, or Stripe keys are dormant) ──
    if (activeProvider === 'paypal' || paypalSubId || (!stripeSubId && !StripeService.isConfigured())) {
      const returnUrl = `${baseUrl}/client/billing?checkout=paypal_return&plan=${targetPlanId}`
      const cancelUrl = `${baseUrl}/client/billing?checkout=cancel`

      const payPalResult = await PayPalService.createOrRevisePayPalSubscription({
        orgId,
        planTier: targetPlanId,
        returnUrl,
        cancelUrl,
        existingSubscriptionId: paypalSubId,
        waiveSetupFee: org?.waive_setup_fee !== false
      })

      if (!payPalResult.success) {
        return NextResponse.json({ error: payPalResult.error || 'Failed to initialize PayPal subscription checkout.' }, { status: 500 })
      }

      if (payPalResult.revisedImmediately || payPalResult.simulated) {
        // Automatically activate locally if revised immediately or simulated
        await PayPalService.verifyAndActivateSubscription(supabase, {
          subscriptionId: payPalResult.subscriptionId,
          orgId,
          planTier: targetPlanId
        })

        return NextResponse.json({
          success: true,
          upgraded: true,
          revised: true,
          simulated: payPalResult.simulated,
          planId: targetPlan.id,
          message: `✨ Successfully updated to ${targetPlan.name}!`
        })
      }

      return NextResponse.json({
        success: true,
        upgraded: false,
        approvalUrl: payPalResult.approvalUrl,
        checkoutUrl: payPalResult.approvalUrl,
        subscriptionId: payPalResult.subscriptionId,
        revised: payPalResult.revised,
        simulated: payPalResult.simulated,
        planId: targetPlan.id
      })
    }

    // ── DORMANT STRIPE FLOW (preserved for later activation without refactoring) ──
    if (stripeSubId) {
      const updateResult = await StripeService.updateSubscriptionPlan({
        stripeSubscriptionId: stripeSubId,
        targetPlanId,
        customStripeClient: (context?.customSupabase as any)?.stripeClient
      })

      if (!updateResult.success && !updateResult.simulated) {
        return NextResponse.json({ error: updateResult.error || 'Failed to update subscription in Stripe' }, { status: 500 })
      }

      await supabase.from('saas_subscriptions').upsert({
        org_id: orgId,
        plan_id: targetPlan.id,
        amount: targetPlan.amount,
        status: 'active',
        updated_at: new Date().toISOString()
      }, { onConflict: 'org_id' })

      await supabase.from('organizations').update({
        plan_id: targetPlan.id,
        subscription_status: 'active',
        monthly_rate: targetPlan.amount,
        updated_at: new Date().toISOString()
      }).eq('id', orgId)

      await logAuditEvent(supabase, {
        org_id: orgId,
        event_type: 'billing.plan_upgraded',
        description: `Plan upgraded to ${targetPlan.name} with proration`,
        metadata: {
          actor_id: user.id,
          stripe_subscription_id: stripeSubId,
          target_plan_id: targetPlan.id,
          amount: targetPlan.amount
        }
      })

      return NextResponse.json({
        success: true,
        upgraded: true,
        proration: true,
        planId: targetPlan.id,
        message: `Your subscription has been prorated and upgraded to ${targetPlan.name}!`
      })
    }

    // Stripe Checkout Session fallback
    const checkoutResult = await StripeService.createSaaSCheckoutSession({
      orgId,
      orgSlug: org?.slug || 'contractor',
      customerEmail: user.email || undefined,
      planId: targetPlanId,
      baseUrl,
      customStripeClient: (context?.customSupabase as any)?.stripeClient
    })

    if (checkoutResult.simulated) {
      await supabase.from('saas_subscriptions').upsert({
        org_id: orgId,
        plan_id: targetPlan.id,
        amount: targetPlan.amount,
        status: 'active',
        updated_at: new Date().toISOString()
      }, { onConflict: 'org_id' })

      await supabase.from('organizations').update({
        plan_id: targetPlan.id,
        subscription_status: 'active',
        monthly_rate: targetPlan.amount,
        updated_at: new Date().toISOString()
      }).eq('id', orgId)
    }

    return NextResponse.json({
      success: true,
      upgraded: Boolean(checkoutResult.simulated),
      checkoutUrl: checkoutResult.checkoutUrl,
      simulated: checkoutResult.simulated,
      planId: targetPlan.id
    })
  }

  if (action === 'request_change') {
    const targetPlanId = body.targetPlanId
    if (!targetPlanId) {
      return NextResponse.json({ error: 'Missing target plan identifier' }, { status: 400 })
    }

    const targetPlan = getSaasPlan(targetPlanId)
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, slug, billing_provider, paypal_subscription_id')
      .eq('id', orgId)
      .maybeSingle()

    // Downgrade to Free Tier ($0/mo)
    if (targetPlan.tier === 'free' || targetPlan.id === 'free') {
      const now = new Date().toISOString()
      if (org?.paypal_subscription_id) {
        await PayPalService.cancelPayPalSubscription(org.paypal_subscription_id, body.notes || 'Downgraded to Free tier via portal')
      }

      await supabase
        .from('organizations')
        .update({
          subscription_status: 'free',
          plan_id: 'free',
          monthly_rate: 0,
          updated_at: now
        })
        .eq('id', orgId)

      await supabase
        .from('saas_subscriptions')
        .update({
          status: 'canceled',
          plan_id: 'free',
          amount: 0,
          canceled_at: now,
          updated_at: now
        })
        .eq('org_id', orgId)

      await logAuditEvent(supabase, {
        org_id: orgId,
        event_type: 'billing.subscription_canceled',
        description: `Organization downgraded to Free Booking tier by user`,
        metadata: {
          actor_id: user.id,
          actor_email: user.email,
          previous_paypal_id: org?.paypal_subscription_id,
          notes: body.notes || null
        }
      })

      return NextResponse.json({
        success: true,
        downgraded: true,
        message: 'Your plan has been downgraded to the Free Booking tier. Your public booking link, schedule, and customer directory remain 100% active.'
      })
    }

    // Downgrade from Fleet to Solo ($99/mo)
    if (targetPlan.tier === 'solo' && org?.paypal_subscription_id) {
      const reqUrl = new URL(request.url)
      const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`
      const returnUrl = `${baseUrl}/client/billing?checkout=paypal_return&plan=solo`
      const cancelUrl = `${baseUrl}/client/billing?checkout=cancel`

      const reviseResult = await PayPalService.createOrRevisePayPalSubscription({
        orgId,
        planTier: 'solo',
        returnUrl,
        cancelUrl,
        existingSubscriptionId: org.paypal_subscription_id,
        waiveSetupFee: true
      })

      if (reviseResult.success) {
        const now = new Date().toISOString()
        await supabase.from('organizations').update({
          plan_id: 'solo',
          monthly_rate: targetPlan.amount,
          updated_at: now
        }).eq('id', orgId)

        await supabase.from('saas_subscriptions').update({
          plan_id: 'solo',
          amount: targetPlan.amount,
          updated_at: now
        }).eq('org_id', orgId)

        return NextResponse.json({
          success: true,
          message: 'Your subscription has been updated to CaptoDesk Solo Pro ($99/mo).',
          checkoutUrl: reviseResult.approvalUrl
        })
      }
    }

    await logAuditEvent(supabase, {
      org_id: orgId,
      event_type: 'billing.plan_change_requested',
      description: `Client requested plan change to ${targetPlan.name} (${targetPlan.amount} USD/${targetPlan.billingInterval})`,
      metadata: {
        actor_id: user.id,
        actor_email: user.email,
        target_plan_id: targetPlan.id,
        notes: body.notes || null
      }
    })

    return NextResponse.json({
      success: true,
      message: `Plan change request to ${targetPlan.name} received! Our billing team has been notified.`,
      targetPlan
    })
  }

  return NextResponse.json({ error: 'Invalid billing action' }, { status: 400 })
}
