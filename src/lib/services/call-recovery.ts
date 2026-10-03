import { SupabaseClient } from '@supabase/supabase-js'
import { sendTelnyxSms, toE164 } from '@/lib/telnyx'
import { isWithinBusinessHours, isShortCall } from './safety-rules'

interface InboundCallPayload {
  callerNumber: string
  calledNumber: string
  callStatus: string
  durationSeconds?: number
  telnyxCallId?: string
}

export async function processMissedCall(
  supabase: SupabaseClient,
  call: InboundCallPayload
): Promise<{ success: boolean; action: string; error?: string }> {
  const formattedCalled = toE164(call.calledNumber)
  const formattedCaller = toE164(call.callerNumber)

  // 1. Locate organization by Telnyx phone number
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('telnyx_phone_number', formattedCalled)
    .single()

  if (!org) {
    return { success: false, action: 'org_not_found', error: `No organization registered with number ${formattedCalled}` }
  }

  if (!org.is_missed_call_active) {
    return { success: true, action: 'service_disabled' }
  }

  // 2. Short call filter (< 3s misdial)
  if (isShortCall(call.durationSeconds || 0)) {
    return { success: true, action: 'suppressed_short_call' }
  }

  // 3. Find or create Contact
  let { data: contact } = await supabase
    .from('contacts')
    .select('id, opt_out, name')
    .eq('org_id', org.id)
    .eq('phone', formattedCaller)
    .maybeSingle()

  if (!contact) {
    const { data: newContact } = await supabase
      .from('contacts')
      .insert({
        org_id: org.id,
        phone: formattedCaller,
        name: 'New Caller'
      })
      .select('id, opt_out, name')
      .single()
    contact = newContact
  }

  // 4. TCPA opt-out check
  if (contact?.opt_out) {
    return { success: true, action: 'suppressed_opted_out' }
  }

  // 5. 24-hour Cooldown Check
  const cooldownCutoff = new Date(Date.now() - (org.cooldown_hours || 24) * 60 * 60 * 1000)
  const { data: recentSent } = await supabase
    .from('calls')
    .select('id')
    .eq('org_id', org.id)
    .eq('caller_number', formattedCaller)
    .eq('auto_reply_sent', true)
    .gte('created_at', cooldownCutoff.toISOString())
    .limit(1)

  if (recentSent && recentSent.length > 0) {
    await supabase.from('calls').insert({
      org_id: org.id,
      contact_id: contact?.id,
      caller_number: formattedCaller,
      called_number: formattedCalled,
      status: 'missed',
      auto_reply_sent: false,
      suppression_reason: 'cooldown_active'
    })
    return { success: true, action: 'suppressed_cooldown' }
  }

  // 6. Determine template (Open vs After-Hours)
  const isOpen = isWithinBusinessHours(org.business_hours, org.timezone)
  const template = isOpen ? org.auto_reply_template : org.after_hours_template
  const smsBody = template.replace('{business_name}', org.name)

  // 7. Dispatch SMS via Telnyx
  const smsResult = await sendTelnyxSms({
    to: formattedCaller,
    from: formattedCalled,
    text: smsBody
  })

  // 8. Record Call, Lead, and Conversation in database
  await supabase.from('calls').insert({
    org_id: org.id,
    contact_id: contact?.id,
    caller_number: formattedCaller,
    called_number: formattedCalled,
    status: 'missed',
    duration_seconds: call.durationSeconds || 0,
    telnyx_call_control_id: call.telnyxCallId,
    auto_reply_sent: smsResult.success
  })

  await supabase.from('leads').insert({
    org_id: org.id,
    contact_id: contact?.id,
    source: 'missed_call',
    status: 'new'
  })

  // Ensure conversation exists and log message
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
        last_message_preview: smsBody
      })
      .select('id')
      .single()
    conversation = newConv
  }

  if (conversation) {
    await supabase.from('messages').insert({
      org_id: org.id,
      conversation_id: conversation.id,
      direction: 'outbound',
      sender_type: 'system',
      body: smsBody,
      delivery_status: smsResult.success ? 'sent' : 'failed',
      telnyx_message_id: smsResult.messageId
    })
  }

  return { success: true, action: 'auto_reply_sent' }
}
