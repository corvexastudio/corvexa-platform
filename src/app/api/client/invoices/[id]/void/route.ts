import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../../lib/security/tenant-context.ts'
import { voidInvoice } from '../../../../../../lib/payments/invoice-manager.ts'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }>; customSupabase?: any }
) {
  const tenantResult = await getTenantContext('invoices:manage', context?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { id } = await context.params
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
