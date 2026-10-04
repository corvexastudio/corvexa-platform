import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { sendInvoice } from '@/lib/payments/invoice-manager'

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
