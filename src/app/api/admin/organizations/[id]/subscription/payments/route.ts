import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../../../lib/security/tenant-context.ts'
import { SubscriptionService } from '../../../../../../../lib/billing/subscription-service.ts'

export const dynamic = 'force-dynamic'

export interface PaymentsRouteDependencies {
  customSupabase?: any
}

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
  deps?: PaymentsRouteDependencies
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
    .select('id, name')
    .eq('id', orgId)
    .maybeSingle()

  if (orgErr || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const payments = await SubscriptionService.getPaymentHistory(supabase, orgId)
  return NextResponse.json({ payments })
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
  deps?: PaymentsRouteDependencies
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

  // 1. Verify organization exists
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .maybeSingle()

  if (orgErr || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  try {
    const body = await request.json()

    if (body.org_id && body.org_id !== orgId) {
      return NextResponse.json(
        { error: 'Prohibited parameter: Cross-tenant organization ID manipulation' },
        { status: 400 }
      )
    }

    const amount = Number(body.amount)
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount: Payment amount must be a positive number' },
        { status: 400 }
      )
    }

    if (body.currency && body.currency.toUpperCase() !== 'USD') {
      return NextResponse.json(
        { error: 'Invalid currency: Only USD is currently supported' },
        { status: 400 }
      )
    }

    if (!body.billingPeriodStart || !body.billingPeriodEnd) {
      return NextResponse.json(
        { error: 'Billing period start and end dates are required' },
        { status: 400 }
      )
    }

    const start = new Date(body.billingPeriodStart)
    const end = new Date(body.billingPeriodEnd)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json(
        { error: 'Invalid billing period: End date must be strictly after start date' },
        { status: 400 }
      )
    }

    const payment = await SubscriptionService.recordPayment(
      supabase,
      { id: user.id, email: user.email, role: 'super_admin' },
      orgId,
      {
        amount,
        currency: 'USD',
        billingPeriodStart: body.billingPeriodStart,
        billingPeriodEnd: body.billingPeriodEnd,
        paymentReference: body.paymentReference,
        provider: body.provider || 'paypal_manual',
        notes: body.notes
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Payment recorded successfully',
      payment
    }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 400 })
  }
}
