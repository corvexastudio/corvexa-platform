import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    const question = body.question?.trim()

    if (!question) {
      return NextResponse.json({ error: 'Question cannot be empty' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, org_id, quote_number, contact_id, contacts(name, phone)')
      .eq('manage_token', token)
      .single()

    if (quoteError || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const contactName = (quote as any).contacts?.name || 'Customer'

    // Create In-App Notification for Owner
    await supabase.from('notifications').insert({
      org_id: quote.org_id,
      title: `Quote #${quote.quote_number} Question`,
      message: `${contactName} asked: "${question}"`,
      link: '/client/inbox'
    })

    // Log to activity logs
    await supabase.from('activity_logs').insert({
      org_id: quote.org_id,
      event_type: 'quote.clarification_requested',
      description: `Customer asked regarding quote #${quote.quote_number}: ${question}`,
      metadata: { quote_id: quote.id, question }
    })

    return NextResponse.json({
      success: true,
      message: 'Your question has been sent to the business. We will get back to you shortly!'
    })
  } catch (err: any) {
    console.error('[QUOTE_CLARIFY_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
