import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { customerDeclineQuote } from '@/lib/quotes/quote-manager'

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
    const reason = body.reason?.trim()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const result = await customerDeclineQuote(supabase, token, reason)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to decline quote' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Quote has been declined',
      quote: result.quote
    })
  } catch (err: any) {
    console.error('[QUOTE_DECLINE_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
