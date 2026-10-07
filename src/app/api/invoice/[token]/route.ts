import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { customerViewInvoice } from '@/lib/payments/invoice-manager'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) {
    return NextResponse.json({ error: 'Invoice token is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const result = await customerViewInvoice(supabase, token)

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Invoice not found' }, { status: 404 })
  }

  return NextResponse.json(result)
}
