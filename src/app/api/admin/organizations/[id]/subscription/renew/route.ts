import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../../../lib/security/tenant-context.ts'
import { SubscriptionService } from '../../../../../../../lib/billing/subscription-service.ts'

export const dynamic = 'force-dynamic'

export interface RenewRouteDependencies {
  customSupabase?: any
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
  deps?: RenewRouteDependencies
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

    // SEC: Client tampering rejection
    if (body.amount !== undefined || body.price !== undefined) {
      return NextResponse.json(
        { error: 'Prohibited parameter: Plan pricing is server-authoritative' },
        { status: 400 }
      )
    }
    if (body.currency !== undefined && body.currency.toUpperCase() !== 'USD') {
      return NextResponse.json(
        { error: 'Invalid currency: Only USD is currently supported' },
        { status: 400 }
      )
    }
    if (body.org_id && body.org_id !== orgId) {
      return NextResponse.json(
        { error: 'Prohibited parameter: Cross-tenant organization ID manipulation' },
        { status: 400 }
      )
    }

    let periodMonths = 1
    if (body.periodMonths !== undefined) {
      const parsed = Number(body.periodMonths)
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
        return NextResponse.json(
          { error: 'Invalid billing period: Must be an integer between 1 and 12 months' },
          { status: 400 }
        )
      }
      periodMonths = parsed
    }

    const result = await SubscriptionService.renewSubscription(
      supabase,
      { id: user.id, email: user.email, role: 'super_admin' },
      orgId,
      {
        paymentReference: body.paymentReference,
        notes: body.notes,
        periodMonths,
        provider: body.provider || 'paypal_manual'
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Subscription successfully renewed',
      subscription: result.subscription,
      payment: result.payment
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 400 })
  }
}
