import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../../lib/security/tenant-context.ts'
import { recordPayment } from '../../../../../../lib/payments/invoice-manager.ts'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }>; customSupabase?: any }
) {
  const tenantResult = await getTenantContext('payments:manage', context?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { id } = await context.params
  const { orgId, supabase } = tenantResult

  try {
    const body = await request.json()
    const { amount, paymentMethod = 'cash', referenceNote } = body

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 })
    }

    const result = await recordPayment(supabase, {
      invoiceId: id,
      orgId,
      amount: Number(amount),
      paymentMethod,
      paymentStatus: 'succeeded',
      referenceNote: referenceNote || 'Recorded offline by owner'
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Payment recording failed' }, { status: 500 })
  }
}
