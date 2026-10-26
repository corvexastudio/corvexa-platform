import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTelnyxSms } from '../telnyx.ts'
import { normalizePhoneToE164 } from '../telephony/phone-normalizer.ts'
import { resolveOrganizationByPhoneNumber } from '../telephony/telnyx-numbers.ts'
import { evaluateSuppression } from '../telephony/suppression-rules.ts'
import { resolveMissedCallTemplate } from '../telephony/template-engine.ts'
import type { CallEvaluationResult } from '../telephony/call-state-machine.ts'
import { formatCompliantOutboundText, logComplianceAudit } from '../compliance/compliance-engine.ts'
import type { OwnerNotificationResult } from '../telephony/owner-notifier.ts'
import { notifyOwner } from '../notifications/notification-service.ts'
import { SubscriptionService, isProAutomationEntitled, isTollFreeNumberRestricted } from '../billing/subscription-service.ts'

export interface InboundCallContext {
  callerNumber: string
  calledNumber: string
  callOutcome: CallEvaluationResult
  callControlId?: string
  callLegId?: string
  callSessionId?: string
  sendSmsFn?: typeof sendTelnyxSms
  sendOwnerSmsFn?: typeof sendTelnyxSms
  webPushSendFn?: any
  overrideDate?: Date
}

export interface ProcessCallResult {
  success: boolean
  action: string
  error?: string
  suppressionReason?: string
  messageId?: string
  orgId?: string
  callId?: string
  ownerAlert?: OwnerNotificationResult
}

/**
 * Calculates the next 8:05 AM timestamp in the tenant's local timezone.
 * TCPA quiet hours run 8:00 PM to 8:00 AM local time.
 * If called between 8:00 PM (20:00) and midnight, the next 8:05 AM is the following day.
 * If called between midnight and 8:00 AM, the next 8:05 AM is later that same morning.
 */
export function calculateNextMorning805(
  timezone: string = 'America/Chicago',
  referenceDate: Date = new Date()
): { scheduledAt: string; targetDateKey: string } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  const parts = formatter.formatToParts(referenceDate)
  const partMap: Record<string, string> = {}
  for (const p of parts) partMap[p.type] = p.value

  const year = parseInt(partMap.year, 10)
  const month = parseInt(partMap.month, 10) // 1-12
  const day = parseInt(partMap.day, 10)
  const hour = parseInt(partMap.hour, 10) % 24
  const minute = parseInt(partMap.minute, 10)

  let targetYear = year
  let targetMonth = month
  let targetDay = day

  // If local time is already at or past 08:05, target morning is the next calendar day
  if (hour > 8 || (hour === 8 && minute >= 5)) {
    const tempDate = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0))
    targetYear = tempDate.getUTCFullYear()
    targetMonth = tempDate.getUTCMonth() + 1
    targetDay = tempDate.getUTCDate()
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  const targetDateKey = `${targetYear}-${pad(targetMonth)}-${pad(targetDay)}`

  // Compute exact UTC timestamp corresponding to targetDateKey at 08:05:00 in target timezone
  const probe = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, 8, 5, 0))
  const probeParts = formatter.formatToParts(probe)
  const pMap: Record<string, string> = {}
  for (const p of probeParts) pMap[p.type] = p.value
  const probeLocalAsUtc = Date.UTC(
    parseInt(pMap.year, 10),
    parseInt(pMap.month, 10) - 1,
    parseInt(pMap.day, 10),
    parseInt(pMap.hour, 10) % 24,
    parseInt(pMap.minute, 10),
    parseInt(pMap.second, 10)
  )
  const offsetMs = probeLocalAsUtc - probe.getTime()
  const desiredLocalAsUtc = Date.UTC(targetYear, targetMonth - 1, targetDay, 8, 5, 0)
  const targetUtcMs = desiredLocalAsUtc - offsetMs
  const scheduledAt = new Date(targetUtcMs).toISOString()

  return { scheduledAt, targetDateKey }
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

  // 3.4. Strict $0 Free Tier Telecom Guard & TFN Isolation Guard
  const isDemoCall = org.id === '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7' || org.slug?.includes('demo') || formattedCalled === '+18777713802'
  if (!isDemoCall && !isProAutomationEntitled(org)) {
    const { data: freeCall } = await supabase.from('calls').insert({
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
      suppression_reason: 'free_tier_no_telecom'
    }).select('id').maybeSingle()

    if (contact?.id) {
      await recordOrUpdateLeadForMissedCall(supabase, org.id, contact.id, {
        notes: `Missed call received on Free tier. Phone: ${formattedCaller}. Automated SMS text-back is available on Solo Pro ($99/mo).`
      })
    }

    try {
      await supabase.from('notifications').insert({
        org_id: org.id,
        title: 'Missed Call Received (Free Tier)',
        message: `You missed a call from ${formattedCaller}. Customer details saved in Leads. Upgrade to Solo Pro ($99/mo) to enable instant 8-second AI missed-call recovery text-back.`,
        link: '/client/leads'
      })
    } catch {
      // Non-fatal
    }

    await notifyOwner(supabase, {
      event: 'missed_call_recovered',
      organizationId: org.id,
      data: {
        title: 'Missed Call Received',
        body: `You missed a call from ${formattedCaller}. Customer contact saved to Leads.`,
        targetUrl: '/client/leads',
        callerPhone: formattedCaller,
        calledPhone: formattedCalled
      }
    }).catch(() => {})

    return {
      success: true,
      action: 'suppressed_free_tier',
      suppressionReason: 'free_tier_no_telecom',
      orgId: org.id,
      callId: freeCall?.id
    }
  }

  if (!call.sendSmsFn && isTollFreeNumberRestricted(formattedCalled, org)) {
    return {
      success: true,
      action: 'suppressed_tfn_demo_isolation',
      suppressionReason: 'tfn_demo_isolation',
      orgId: org.id
    }
  }

  // 3.5. Evaluate Trial Quota & Outbound Safety Limits (BILL-001)
  const trialQuota = await SubscriptionService.evaluateTrialQuota(supabase, org.id)
  if (trialQuota.isTrial && trialQuota.isExceeded) {
    // Log suppressed call to database
    const { data: suppressedCall } = await supabase.from('calls').insert({
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
      suppression_reason: 'trial_limit_reached'
    }).select('id').maybeSingle()

    // Preserve the caller contact and ensure lead is logged so contractor does not lose customer
    if (contact?.id) {
      await recordOrUpdateLeadForMissedCall(supabase, org.id, contact.id, {
        notes: `Missed call received during trial quota limit (${trialQuota.bookedCount}/${trialQuota.maxBookings} bookings used). Automated SMS text-back paused.`
      })
    }

    // In-app alert notification
    try {
      await supabase.from('notifications').insert({
        org_id: org.id,
        title: 'Trial Quota Reached — Auto-Replies Paused',
        message: `Your organization has reached the trial limit (${trialQuota.bookedCount}/${trialQuota.maxBookings} bookings). Automated outbound SMS recovery is paused. Upgrade now to keep customer recovery active.`,
        link: '/client/billing'
      })
    } catch {
      // Non-fatal
    }

    await notifyOwner(supabase, {
      event: 'system_action_required',
      organizationId: org.id,
      data: {
        title: 'Trial Quota Reached — Auto-Replies Paused',
        body: `Your organization has reached the trial limit (${trialQuota.bookedCount}/${trialQuota.maxBookings} bookings). Automated outbound SMS recovery is paused. Upgrade now to keep customer recovery active.`,
        targetUrl: '/client/billing',
        callerPhone: formattedCaller,
        calledPhone: formattedCalled
      }
    }).catch(() => {})

    return {
      success: true,
      action: 'suppressed_trial_limit_reached',
      suppressionReason: 'trial_limit_reached',
      orgId: org.id,
      callId: suppressedCall?.id
    }
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
    timezone: org.timezone || 'America/Chicago',
    overrideDate: call.overrideDate
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

    // TCPA Quiet Hours: Do not drop caller!
    // 1. Ensure lead record is preserved/updated in leads so contractor sees prospect
    // 2. Schedule a morning recovery message in automation_runs at 8:05 AM with idempotency
    if (suppression.suppressionReason === 'tcpa_quiet_hours' && contact?.id) {
      await recordOrUpdateLeadForMissedCall(supabase, org.id, contact.id, { isQuietHours: true })

      const { scheduledAt, targetDateKey } = calculateNextMorning805(
        org.timezone || 'America/Chicago',
        call.overrideDate
      )
      const idempotencyKey = `tcpa_morning_recovery:${org.id}:${formattedCaller}:${targetDateKey}`

      // Check if a recovery SMS is already pending or scheduled for this morning
      const { data: existingRun } = await supabase
        .from('automation_runs')
        .select('id, status')
        .eq('org_id', org.id)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()

      if (!existingRun) {
        const { renderedText } = resolveMissedCallTemplate(
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

        await supabase.from('automation_runs').insert({
          org_id: org.id,
          job_id: `job_${idempotencyKey}`,
          idempotency_key: idempotencyKey,
          event_type: 'call.quiet_hours_recovery',
          action_type: 'send_sms',
          action_params: {
            to: formattedCaller,
            from: formattedCalled,
            text: compliantText,
            message: compliantText,
            flowType: 'missed_call_recovery',
            messageType: 'transactional'
          },
          status: 'scheduled',
          scheduled_at: scheduledAt,
          event_payload: {
            contact_id: contact?.id,
            caller_number: formattedCaller,
            called_number: formattedCalled,
            recovery_type: 'tcpa_morning_recovery',
            target_date: targetDateKey
          }
        })
      }
    } else if (suppression.suppressionReason === 'cooldown_active' && contact?.id) {
      // If suppressed due to cooldown window, caller has repeated their attempt:
      // Update CRM lead missed_call_count and notes so business owner sees the repeat call
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
  const sendCustomerSms = call.sendSmsFn || sendTelnyxSms
  const smsResult = await sendCustomerSms({
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
  let insertedCallId: string | undefined
  try {
    const { data: callRow, error: callInsertError } = await supabase
      .from('calls')
      .insert({
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
      .select('id')
      .maybeSingle()

    if (callInsertError && callInsertError.code !== '23505') {
      console.error('[MISSED CALL RECORD INSERT ERROR]', callInsertError)
    }
    insertedCallId = callRow?.id
  } catch (callErr) {
    console.error('[CALL RECORD EXCEPTION]', callErr)
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

  // 10. Dispatch Owner Missed-Call Alert (Push + SMS via Notification Platform)
  let ownerAlert: OwnerNotificationResult | undefined
  try {
    const notifOutcome = await notifyOwner(supabase, {
      event: 'missed_call_recovered',
      organizationId: org.id,
      idempotencyKey: insertedCallId ? `missed_call_recovered:${insertedCallId}` : undefined,
      data: {
        callerPhone: formattedCaller,
        calledPhone: formattedCalled,
        callId: insertedCallId,
        customerSmsSuccess: smsResult.success
      },
      sendSmsFn: call.sendOwnerSmsFn || call.sendSmsFn,
      webPushSendFn: call.webPushSendFn
    })

    const smsDelivery = notifOutcome.deliveries.find(d => d.channel === 'sms')
    ownerAlert = {
      attempted: notifOutcome.attempted,
      sent: smsDelivery?.success ?? false,
      ownerPhone: smsDelivery?.destination,
      messageId: smsDelivery?.providerMessageId,
      error: smsDelivery?.error || notifOutcome.error,
      skippedReason: smsDelivery?.skippedReason as any,
      text: smsDelivery?.text
    }

    if (insertedCallId && ownerAlert?.sent) {
      try {
        await supabase
          .from('calls')
          .update({ owner_alert_sent: true })
          .eq('id', insertedCallId)
      } catch {
        // Non-blocking in case owner_alert_sent column is not yet migrated
      }
    }
  } catch (ownerErr: any) {
    console.error('[OWNER NOTIFICATION ERROR]', ownerErr)
    ownerAlert = {
      attempted: true,
      sent: false,
      error: ownerErr?.message || 'Failed to dispatch owner alert'
    }
  }

  return {
    success: true,
    action: 'auto_reply_sent',
    messageId: smsResult.messageId,
    orgId: org.id,
    callId: insertedCallId,
    ownerAlert
  }
}

/**
 * Lead Deduplication Helper:
 * Ensures repeat missed calls update existing open leads (status IN ('new', 'contacted'))
 * rather than creating duplicate open leads. Closed/won/lost leads result in a new lead.
 */
export async function recordOrUpdateLeadForMissedCall(
  supabase: SupabaseClient,
  orgId: string,
  contactId: string,
  options?: { isQuietHours?: boolean; notes?: string }
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
    const noteDetail = options?.isQuietHours ? 'during TCPA quiet hours ' : ''
    const appendNote = options?.notes || `Repeat missed call ${noteDetail}at ${new Date().toLocaleTimeString()} (Attempt #${updatedCount})`
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
      missed_call_count: 1,
      notes: options?.notes || (options?.isQuietHours
        ? 'Missed call during TCPA quiet hours (morning recovery scheduled)'
        : undefined)
    })
  }
}
