import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../../lib/security/tenant-context.ts'
import { sendInvoice } from '../../../../../../lib/payments/invoice-manager.ts'

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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

  const result = await sendInvoice(supabase, {
    invoiceId: id,
    orgId,
    baseUrl
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json(result)
}
