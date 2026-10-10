import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../../../lib/security/tenant-context.ts'
import { SubscriptionService } from '../../../../../../../lib/billing/subscription-service.ts'

export const dynamic = 'force-dynamic'

export interface ReactivateRouteDependencies {
  customSupabase?: any
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
  deps?: ReactivateRouteDependencies
) {
  const tenantResult = await getTenantContext('admin:all', deps?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { user, supabase } = tenantResult
  const { id: orgId } = await props.params

  if (!orgId) {
    return NextResponse.json({ error: 'Missing organization ID' }, { status: 400 })
  }

  // 1. Verify target organization exists
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('id', orgId)
    .maybeSingle()

  if (orgErr || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  try {
    const subscription = await SubscriptionService.reactivateSubscription(
      supabase,
      { id: user.id, email: user.email, role: 'super_admin' },
      orgId
    )

    return NextResponse.json({
      success: true,
      message: 'Subscription successfully reactivated',
      subscription
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 400 })
  }
}
