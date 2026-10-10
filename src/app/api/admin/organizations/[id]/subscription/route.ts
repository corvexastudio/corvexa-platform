import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../../lib/security/tenant-context.ts'
import { SubscriptionService } from '../../../../../../lib/billing/subscription-service.ts'
import { getSaasPlan, DEFAULT_SAAS_PLAN_ID } from '../../../../../../lib/billing/plans.ts'

export const dynamic = 'force-dynamic'

export interface SubscriptionRouteDependencies {
  customSupabase?: any
}

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
  deps?: SubscriptionRouteDependencies
) {
  const tenantResult = await getTenantContext('admin:all', deps?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { supabase } = tenantResult
  const { id: orgId } = await props.params

  if (!orgId) {
    return NextResponse.json({ error: 'Missing organization ID' }, { status: 400 })
  }

  // 1. Verify organization exists
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, slug, subscription_status, monthly_rate')
    .eq('id', orgId)
    .maybeSingle()

  if (orgErr || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  // 2. Fetch subscription and entitlement
  const subscription = await SubscriptionService.getSubscription(supabase, orgId)
  const entitlement = await SubscriptionService.getEntitlement(supabase, orgId)
  const plan = getSaasPlan(subscription?.plan_id || DEFAULT_SAAS_PLAN_ID)
  const payments = await SubscriptionService.getPaymentHistory(supabase, orgId)

  return NextResponse.json({
    organization: org,
    subscription,
    entitlement,
    plan,
    payments
  })
}
