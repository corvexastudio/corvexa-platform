import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { customerViewQuote } from '@/lib/quotes/quote-manager'

export async function GET(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params

    if (!token) {
      return NextResponse.json({ error: 'Missing quote token' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const result = await customerViewQuote(supabase, token)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Quote not found' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[QUOTE_GET_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
