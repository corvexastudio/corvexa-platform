import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processMissedCall } from '@/lib/services/call-recovery'

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

    // Only process inbound call ended or missed states
    // Telnyx fires 'call.hangup' when the call terminates
    if (eventType !== 'call.hangup' && eventType !== 'call.initiated') {
      return NextResponse.json({ success: true, message: 'Ignored event type' })
    }

    // 1. Idempotency Check (Blueprint §53)
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

    const callerNumber = payload?.from
    const calledNumber = payload?.to
    const duration = payload?.duration_secs || 0
    const callStatus = payload?.hangup_cause || payload?.state || 'missed'

    if (!callerNumber || !calledNumber) {
      return NextResponse.json({ success: false, error: 'Missing phone parameters' }, { status: 400 })
    }

    const result = await processMissedCall(supabase, {
      callerNumber,
      calledNumber,
      callStatus,
      durationSeconds: duration,
      telnyxCallId: payload?.call_control_id
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[TELNYX VOICE WEBHOOK ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
