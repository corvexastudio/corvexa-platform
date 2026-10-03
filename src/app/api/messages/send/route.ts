import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelnyxSms, toE164 } from '@/lib/telnyx'

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  try {
    const { conversation_id, to, message } = await request.json()

    if (!to || !message || !conversation_id) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // 1. Get conversation to identify organization
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, org_id, organizations(telnyx_phone_number)')
      .eq('id', conversation_id)
      .single()

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const org: any = conv.organizations
    const senderNumber = org?.telnyx_phone_number

    // 2. Dispatch SMS via Telnyx
    const result = await sendTelnyxSms({
      to: toE164(to),
      from: senderNumber,
      text: message.trim()
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to dispatch SMS' }, { status: 500 })
    }

    // 3. Store message in database
    const { data: newMsg, error } = await supabase
      .from('messages')
      .insert({
        org_id: conv.org_id,
        conversation_id: conv.id,
        direction: 'outbound',
        sender_type: 'owner',
        body: message.trim(),
        delivery_status: 'sent',
        telnyx_message_id: result.messageId
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 4. Update conversation timestamp and preview
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: message.trim()
      })
      .eq('id', conv.id)

    return NextResponse.json({ success: true, message: newMsg })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
