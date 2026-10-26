import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../lib/security/tenant-context.ts'
import { SubscriptionService } from '../../../../lib/billing/subscription-service.ts'
import { getSaasPlan, SAAS_PLAN_LIST, DEFAULT_SAAS_PLAN_ID } from '../../../../lib/billing/plans.ts'
import { StripeService } from '../../../../lib/services/stripe-service.ts'
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
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, slug, subscription_status, monthly_rate, telnyx_phone_number, carrier_registration_status, legal_business_name, ein, is_sole_proprietor, address_street, address_city, address_state, address_postal_code')
    .eq('id', orgId)
    .maybeSingle()

  if (orgErr || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  // 2. Fetch subscription and entitlement
  const subscription = await SubscriptionService.getSubscription(supabase, orgId)
  const entitlement = await SubscriptionService.getEntitlement(supabase, orgId)
  const currentPlan = getSaasPlan(subscription?.plan_id || DEFAULT_SAAS_PLAN_ID)
  const payments = await SubscriptionService.getPaymentHistory(supabase, orgId)

  return NextResponse.json({
    organization: org,
    subscription,
    entitlement,
    currentPlan,
    availablePlans: SAAS_PLAN_LIST,
    payments: payments.slice(0, 20),
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
    // Schedule cancellation at end of current period
    const reason = typeof body.reason === 'string' ? body.reason.trim() : 'Customer requested cancellation via portal'
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
    const targetPlanId = targetPlan.id as 'solo' | 'fleet' | 'multi_crew'

    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('id', orgId)
      .maybeSingle()

    const subscription = await SubscriptionService.getSubscription(supabase, orgId)
    const stripeSubId = (subscription as any)?.stripe_subscription_id

    const reqUrl = new URL(request.url)
    const baseUrl = reqUrl.origin

    if (stripeSubId) {
      // Safe in-place Stripe subscription update with proration (no double-billing)
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

    // Free tier / No Stripe subscription yet -> create Stripe Checkout Session
    const checkoutResult = await StripeService.createSaaSCheckoutSession({
      orgId,
      orgSlug: org?.slug || 'contractor',
      customerEmail: user.email || undefined,
      planId: targetPlanId,
      baseUrl,
      customStripeClient: (context?.customSupabase as any)?.stripeClient
    })

    if (checkoutResult.simulated) {
      // If Stripe keys are not configured or in test simulation mode, auto-activate plan locally
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
