import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { voidInvoice } from '@/lib/payments/invoice-manager'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await getTenantContext('appointments:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { id } = await params
  const { orgId, supabase } = tenantResult

  try {
    const body = await request.json().catch(() => ({}))
    const result = await voidInvoice(supabase, {
      invoiceId: id,
      orgId,
      reason: body.reason
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to void invoice' }, { status: 500 })
  }
}
