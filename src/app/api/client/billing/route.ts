import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../lib/security/tenant-context.ts'
import { SubscriptionService } from '../../../../lib/billing/subscription-service.ts'
import { getSaasPlan, SAAS_PLAN_LIST, DEFAULT_SAAS_PLAN_ID } from '../../../../lib/billing/plans.ts'
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
    .select('id, name, slug, subscription_status, monthly_rate, telnyx_phone_number')
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
