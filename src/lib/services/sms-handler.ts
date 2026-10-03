import { SupabaseClient } from '@supabase/supabase-js'
import { sendTelnyxSms, toE164 } from '@/lib/telnyx'
import { isStopKeyword, isResumeKeyword } from './safety-rules'

interface InboundSmsPayload {
  fromPhone: string
  toPhone: string
  text: string
  telnyxMessageId?: string
}

export async function processInboundSms(
  supabase: SupabaseClient,
  sms: InboundSmsPayload
): Promise<{ success: boolean; action: string }> {
  const fromNumber = toE164(sms.fromPhone)
  const toNumber = toE164(sms.toPhone)

  // 1. Locate organization
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('telnyx_phone_number', toNumber)
    .single()

  if (!org) return { success: false, action: 'org_not_found' }

  // 2. Locate or create contact
  let { data: contact } = await supabase
    .from('contacts')
    .select('id, opt_out')
    .eq('org_id', org.id)
    .eq('phone', fromNumber)
    .maybeSingle()

  if (!contact) {
    const { data: newContact } = await supabase
      .from('contacts')
      .insert({ org_id: org.id, phone: fromNumber, name: 'Caller' })
      .select('id, opt_out')
      .single()
    contact = newContact
  }

  // 3. Handle TCPA STOP / OPT-OUT keywords
  if (isStopKeyword(sms.text)) {
    await supabase
      .from('contacts')
      .update({ opt_out: true })
      .eq('id', contact?.id)

    // Send mandatory carrier opt-out confirmation
    await sendTelnyxSms({
      to: fromNumber,
      from: toNumber,
      text: `You have unsubscribed from messages from ${org.name}. No more texts will be sent. Reply UNSTOP to resubscribe.`
    })

    return { success: true, action: 'opt_out_processed' }
  }

  // 4. Handle RESUME / UNSTOP
  if (isResumeKeyword(sms.text)) {
    await supabase
      .from('contacts')
      .update({ opt_out: false })
      .eq('id', contact?.id)

    await sendTelnyxSms({
      to: fromNumber,
      from: toNumber,
      text: `You have successfully resubscribed to messages from ${org.name}.`
    })

    return { success: true, action: 'opt_in_processed' }
  }

  // 5. Append to conversation and messages
  let { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('org_id', org.id)
    .eq('contact_id', contact?.id)
    .maybeSingle()

  if (!conversation) {
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({
        org_id: org.id,
        contact_id: contact?.id,
        last_message_preview: sms.text,
        unread_count: 1
      })
      .select('id')
      .single()
    conversation = newConv
  }

  if (conversation) {
    await supabase.from('messages').insert({
      org_id: org.id,
      conversation_id: conversation.id,
      direction: 'inbound',
      sender_type: 'customer',
      body: sms.text,
      delivery_status: 'received',
      telnyx_message_id: sms.telnyxMessageId
    })
  }

  return { success: true, action: 'message_stored' }
}
