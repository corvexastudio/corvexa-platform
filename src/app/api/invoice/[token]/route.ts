import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { customerViewInvoice } from '@/lib/payments/invoice-manager'

export const dynamic = 'force-dynamic'

function getAnonSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vlztovqaummczupslymr.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) {
    return NextResponse.json({ error: 'Invoice token is required' }, { status: 400 })
  }

  const supabase = getAnonSupabase()
  const result = await customerViewInvoice(supabase, token)

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Invoice not found' }, { status: 404 })
  }

  return NextResponse.json(result)
}
