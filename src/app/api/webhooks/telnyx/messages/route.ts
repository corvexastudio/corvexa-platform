import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processInboundSms } from '@/lib/services/sms-handler'

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  try {
    const body = await request.json()
    const eventType = body?.data?.event_type
    const payload = body?.data?.payload
    const eventId = body?.data?.id

    if (eventType !== 'message.received') {
      return NextResponse.json({ success: true, message: 'Ignored event' })
    }

    // Idempotency guard
    if (eventId) {
      const { data: existing } = await supabase
        .from('processed_events')
        .select('id')
        .eq('id', eventId)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ success: true, message: 'Already processed' })
      }

      await supabase.from('processed_events').insert({
        id: eventId,
        provider: 'telnyx',
        event_type: eventType
      })
    }

    const fromPhone = payload?.from?.phone_number
    const toPhone = payload?.to?.[0]?.phone_number || payload?.to
    const text = payload?.text || ''

    if (!fromPhone || !toPhone) {
      return NextResponse.json({ success: false, error: 'Missing phone parameters' }, { status: 400 })
    }

    const result = await processInboundSms(supabase, {
      fromPhone,
      toPhone,
      text,
      telnyxMessageId: payload?.id
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[TELNYX MESSAGE WEBHOOK ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
