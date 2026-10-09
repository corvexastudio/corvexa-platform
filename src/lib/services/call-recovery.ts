import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTelnyxSms } from '../telnyx.ts'
import { normalizePhoneToE164 } from '../telephony/phone-normalizer.ts'
import { resolveOrganizationByPhoneNumber } from '../telephony/telnyx-numbers.ts'
import { evaluateSuppression } from '../telephony/suppression-rules.ts'
import { resolveMissedCallTemplate } from '../telephony/template-engine.ts'
import type { CallEvaluationResult } from '../telephony/call-state-machine.ts'
import { formatCompliantOutboundText, logComplianceAudit } from '../compliance/compliance-engine.ts'

export interface InboundCallContext {
  callerNumber: string
  calledNumber: string
  callOutcome: CallEvaluationResult
  callControlId?: string
  callLegId?: string
  callSessionId?: string
}

export interface ProcessCallResult {
  success: boolean
  action: string
  error?: string
  suppressionReason?: string
  messageId?: string
  orgId?: string
  callId?: string
}

/**
 * Production-grade missed call processor.
 * Orchestrates tenant number resolution, contact management, suppression checks,
 * dynamic SMS templating, and full event logging.
 */
export async function processMissedCall(
  supabase: SupabaseClient,
  call: InboundCallContext
): Promise<ProcessCallResult> {
  const normCalled = normalizePhoneToE164(call.calledNumber)
  const normCaller = normalizePhoneToE164(call.callerNumber)

  if (!normCalled.isValid || !normCalled.e164) {
    return { success: false, action: 'invalid_called_number', error: `Called number invalid: ${normCalled.error}` }
  }

  if (!normCaller.isValid || !normCaller.e164) {
    return { success: false, action: 'invalid_caller_number', error: `Caller number invalid: ${normCaller.error}` }
  }

  const formattedCalled = normCalled.e164
  const formattedCaller = normCaller.e164

  // 1. Resolve tenant organization by the dialed Telnyx number
  const tenantResolution = await resolveOrganizationByPhoneNumber(supabase, formattedCalled)
  if (!tenantResolution || !tenantResolution.org) {
    return {
      success: false,
      action: 'org_not_found',
      error: `No registered tenant found for Telnyx number ${formattedCalled}`
    }
  }

  const org = tenantResolution.org

  // 1.5 Semantic Deduplication: Check if this callControlId was already processed for this tenant
  if (call.callControlId) {
    const { data: existingCall } = await supabase
      .from('calls')
      .select('id, status, auto_reply_sent')
      .eq('org_id', org.id)
      .eq('telnyx_call_control_id', call.callControlId)
      .maybeSingle()

    if (existingCall) {
      return {
        success: true,
        action: 'call_already_processed',
        orgId: org.id,
        callId: existingCall.id
      }
    }
  }

  // 2. Answered Call Protection: Answered calls must NEVER trigger recovery SMS
  if (call.callOutcome.wasAnswered || !call.callOutcome.isEligibleForRecovery) {
    // Record telemetry for analytics without sending SMS
    const { error: callInsertError } = await supabase.from('calls').insert({
      org_id: org.id,
      caller_number: formattedCaller,
      called_number: formattedCalled,
      status: call.callOutcome.state,
      duration_seconds: call.callOutcome.durationSeconds,
      telnyx_call_control_id: call.callControlId,
      call_session_id: call.callSessionId,
      call_leg_id: call.callLegId,
      hangup_cause: call.callOutcome.hangupCause,
      auto_reply_sent: false
    })

    if (callInsertError && callInsertError.code !== '23505') {
      console.error('[CALL RECORD INSERT ERROR]', callInsertError)
    }

    return {
      success: true,
      action: 'call_answered_logged',
      orgId: org.id
    }
  }

  // 3. Locate or create Contact
  let { data: contact } = await supabase
    .from('contacts')
    .select('id, opt_out, name')
    .eq('org_id', org.id)
    .eq('phone', formattedCaller)
    .maybeSingle()

  if (!contact) {
    const { data: newContact, error: contactInsertError } = await supabase
      .from('contacts')
      .insert({
        org_id: org.id,
        phone: formattedCaller,
        name: 'New Caller'
      })
      .select('id, opt_out, name')
      .single()

    if (contactInsertError) {
      console.error('[CONTACT INSERT ERROR]', contactInsertError)
    }
    contact = newContact
  }

  // 4. Evaluate Suppression Rules
  const suppression = await evaluateSuppression({
    supabase,
    orgId: org.id,
    callerNumber: formattedCaller,
    calledNumber: formattedCalled,
    contactOptOut: Boolean(contact?.opt_out),
    durationSeconds: call.callOutcome.durationSeconds,
    isMissedCallActive: Boolean(org.is_missed_call_active),
    cooldownHours: org.cooldown_hours || 24,
    timezone: org.timezone || 'America/Chicago'
  })

  if (!suppression.shouldSend) {
    // Log suppressed call to database
    await supabase.from('calls').insert({
      org_id: org.id,
      contact_id: contact?.id,
      caller_number: formattedCaller,
      called_number: formattedCalled,
      status: call.callOutcome.state,
      duration_seconds: call.callOutcome.durationSeconds,
      telnyx_call_control_id: call.callControlId,
      call_session_id: call.callSessionId,
      call_leg_id: call.callLegId,
      hangup_cause: call.callOutcome.hangupCause,
      auto_reply_sent: false,
      suppression_reason: suppression.suppressionReason
    })

    // If suppressed due to cooldown window, caller has repeated their attempt:
    // Update CRM lead missed_call_count and notes so business owner sees the repeat call
    if (suppression.suppressionReason === 'cooldown_active' && contact?.id) {
      await recordOrUpdateLeadForMissedCall(supabase, org.id, contact.id)
    }

    return {
      success: true,
      action: `suppressed_${suppression.suppressionReason}`,
      suppressionReason: suppression.suppressionReason,
      orgId: org.id
    }
  }

  // 5. Select & Render Missed-Call SMS Template
  const { templateType, renderedText } = resolveMissedCallTemplate(
    org,
    call.callOutcome,
    contact?.name,
    formattedCalled
  )

  const compliantText = formatCompliantOutboundText({
    businessName: org.name || 'CaptoDesk',
    text: renderedText,
    messageType: 'transactional'
  })

  // 6. Dispatch SMS via Telnyx (using tenant's dedicated phone number)
  const smsResult = await sendTelnyxSms({
    to: formattedCaller,
    from: formattedCalled,
    text: compliantText
  })

  if (smsResult.success) {
    await logComplianceAudit(supabase, {
      orgId: org.id,
      phone: formattedCaller,
      contactId: contact?.id,
      action: 'message_sent',
      messageType: 'transactional',
      reason: 'missed_call_recovery'
    })
  }

  // 7. Record Call
  const { error: callInsertError } = await supabase.from('calls').insert({
    org_id: org.id,
    contact_id: contact?.id,
    caller_number: formattedCaller,
    called_number: formattedCalled,
    status: call.callOutcome.state,
    duration_seconds: call.callOutcome.durationSeconds,
    telnyx_call_control_id: call.callControlId,
    call_session_id: call.callSessionId,
    call_leg_id: call.callLegId,
    hangup_cause: call.callOutcome.hangupCause,
    auto_reply_sent: smsResult.success
  })

  if (callInsertError && callInsertError.code !== '23505') {
    console.error('[MISSED CALL RECORD INSERT ERROR]', callInsertError)
  }

  // 8. Lead Deduplication: Check for existing open lead for this contact in this organization
  if (contact?.id) {
    await recordOrUpdateLeadForMissedCall(supabase, org.id, contact.id)
  }

  // 9. Ensure Conversation exists and log outbound recovery message
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
        last_message_preview: renderedText
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
      body: renderedText,
      delivery_status: smsResult.success ? 'sent' : 'failed',
      telnyx_message_id: smsResult.messageId,
      automation_source: 'missed_call_recovery',
      failure_reason: smsResult.error || null
    })
  }

  return {
    success: true,
    action: 'auto_reply_sent',
    messageId: smsResult.messageId,
    orgId: org.id
  }
}

/**
 * Lead Deduplication Helper:
 * Ensures repeat missed calls update existing open leads (status IN ('new', 'contacted'))
 * rather than creating duplicate open leads. Closed/won/lost leads result in a new lead.
 */
async function recordOrUpdateLeadForMissedCall(
  supabase: SupabaseClient,
  orgId: string,
  contactId: string
): Promise<void> {
  let existingOpenLead: any = null
  const baseQuery: any = supabase
    .from('leads')
    .select('id, status, notes, missed_call_count')
    .eq('org_id', orgId)
    .eq('contact_id', contactId)

  if (typeof baseQuery?.in === 'function') {
    const { data } = await baseQuery.in('status', ['new', 'contacted']).maybeSingle()
    existingOpenLead = data
  } else {
    const { data: newLead } = await supabase
      .from('leads')
      .select('id, status, notes, missed_call_count')
      .eq('org_id', orgId)
      .eq('contact_id', contactId)
      .eq('status', 'new')
      .maybeSingle()

    if (newLead) {
      existingOpenLead = newLead
    } else {
      const { data: contactedLead } = await supabase
        .from('leads')
        .select('id, status, notes, missed_call_count')
        .eq('org_id', orgId)
        .eq('contact_id', contactId)
        .eq('status', 'contacted')
        .maybeSingle()
      existingOpenLead = contactedLead
    }
  }

  if (existingOpenLead) {
    const updatedCount = (existingOpenLead.missed_call_count || 1) + 1
    const appendNote = `Repeat missed call at ${new Date().toLocaleTimeString()} (Attempt #${updatedCount})`
    const newNotes = existingOpenLead.notes
      ? `${existingOpenLead.notes}\n${appendNote}`
      : appendNote

    await supabase
      .from('leads')
      .update({
        missed_call_count: updatedCount,
        notes: newNotes,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingOpenLead.id)
  } else {
    await supabase.from('leads').insert({
      org_id: orgId,
      contact_id: contactId,
      source: 'missed_call',
      status: 'new',
      missed_call_count: 1
    })
  }
}
