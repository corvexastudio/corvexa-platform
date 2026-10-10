import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../../../lib/security/tenant-context.ts'
import { SubscriptionService } from '../../../../../../../lib/billing/subscription-service.ts'

export const dynamic = 'force-dynamic'

export interface CancelRouteDependencies {
  customSupabase?: any
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
  deps?: CancelRouteDependencies
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
    const body = await request.json().catch(() => ({}))
    const immediate = body.immediate === true
    const reason = typeof body.reason === 'string' ? body.reason.trim() : null

    const subscription = await SubscriptionService.cancelSubscription(
      supabase,
      { id: user.id, email: user.email, role: 'super_admin' },
      orgId,
      { immediate, reason }
    )

    return NextResponse.json({
      success: true,
      message: immediate
        ? 'Subscription canceled immediately'
        : 'Subscription scheduled for cancellation at current period end',
      subscription
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 400 })
  }
}
