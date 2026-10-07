import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { customerAcceptQuote } from '@/lib/quotes/quote-manager'

export async function POST(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params

    if (!token) {
      return NextResponse.json({ error: 'Missing quote token' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const customerName = body.customerName?.trim()

    const supabase = createAdminClient()

    const result = await customerAcceptQuote(supabase, token, customerName)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to accept quote' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Quote successfully accepted',
      quote: result.quote
    })
  } catch (err: any) {
    console.error('[QUOTE_ACCEPT_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
