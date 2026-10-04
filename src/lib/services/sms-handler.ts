import { SupabaseClient } from '@supabase/supabase-js'
import { sendTelnyxSms } from '../telnyx.ts'
import { isStopKeyword, isResumeKeyword } from './safety-rules.ts'
import { normalizePhoneToE164 } from '../telephony/phone-normalizer.ts'
import { resolveOrganizationByPhoneNumber } from '../telephony/telnyx-numbers.ts'

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
  const normFrom = normalizePhoneToE164(sms.fromPhone)
  const normTo = normalizePhoneToE164(sms.toPhone)

  if (!normFrom.isValid || !normFrom.e164 || !normTo.isValid || !normTo.e164) {
    return { success: false, action: 'invalid_phone_format' }
  }

  const fromNumber = normFrom.e164
  const toNumber = normTo.e164

  // 1. Locate organization via multi-tenant number repository
  const resolution = await resolveOrganizationByPhoneNumber(supabase, toNumber)
  if (!resolution || !resolution.org) {
    return { success: false, action: 'org_not_found' }
  }

  const org = resolution.org

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
