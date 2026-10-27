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
    const signatureData = body.signatureData?.trim()

    // Extract client IP for legal electronic signature audit trail
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const clientIp = (forwarded ? forwarded.split(',')[0].trim() : realIp) || '127.0.0.1'

    const supabase = createAdminClient()

    const result = await customerAcceptQuote(supabase, token, customerName, signatureData, clientIp)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to accept quote' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Quote successfully accepted',
      quote: result.quote,
      job: (result as any).job,
      requiresDeposit: result.requiresDeposit,
      depositAmount: result.depositAmount,
      depositInvoiceUrl: result.depositInvoiceUrl
    })
  } catch (err: any) {
    console.error('[QUOTE_ACCEPT_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
