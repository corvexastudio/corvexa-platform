import type { SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { sendTelnyxSms } from '../telnyx.ts'
import { normalizePhoneToE164 } from '../telephony/phone-normalizer.ts'
import { logAuditEvent } from '../security/audit-logger.ts'
import { isPhoneSuppressed, isTcpaQuietHours, verifyOutboundCompliance, logComplianceAudit } from '../compliance/compliance-engine.ts'
import { calculateNextMorning805 } from '../services/call-recovery.ts'
import { renderSituationAwareText, resolveOperationMode } from '../notifications/situation-templates.ts'
import { resolveSenderPhone } from '../billing/plans.ts'

export interface ReviewEligibilityResult {
  eligible: boolean
  reason?: 'opted_out' | 'invalid_phone' | 'job_cancelled' | 'cooldown_active' | 'disabled' | 'missing_google_url' | 'not_found' | 'starter_limit_reached'
  details?: string
  contact?: any
  org?: any
  job?: any
}

/**
 * Validates whether a customer is currently eligible to receive a review invite
 */
export async function checkReviewEligibility(
  supabase: SupabaseClient,
  input: { orgId: string; contactId: string; jobId?: string }
): Promise<ReviewEligibilityResult> {
  const { orgId, contactId, jobId } = input

  // Check Starter Pass / Subscription Entitlement (Job #4+ paywall guard)
  try {
    const { SubscriptionService } = await import('../billing/subscription-service.ts')
    const entitlement = await SubscriptionService.getEntitlement(supabase, orgId).catch(() => null)
    const isPaidPro = entitlement?.isEntitled && ['solo', 'multi_crew', 'fleet', 'captodesk_standard'].includes(entitlement?.planId || '')

    if (!isPaidPro) {
      const starterUsage = await SubscriptionService.getFreeTierJobUsage(supabase, orgId).catch(() => null)
      if (starterUsage?.isLimitReached) {
        let isPractice = false
        if (jobId) {
          const { data: linkedJob } = await supabase
            .from('jobs')
            .select('id, title, notes, job_number, status')
            .eq('id', jobId)
            .eq('org_id', orgId)
            .maybeSingle()
          if (linkedJob) {
            const { isPracticeJob } = await import('../jobs/practice-job.ts')
            if (isPracticeJob(linkedJob)) {
              isPractice = true
            }
          }
        }

        if (!isPractice) {
          return {
            eligible: false,
            reason: 'starter_limit_reached',
            details: "You've completed your 3 free starter jobs. Upgrade to Pro ($99/mo) to send Google review requests."
          }
        }
      }
    }
  } catch (err) {
    console.warn('[REVIEW_ELIGIBILITY_ENTITLEMENT_CHECK]', err)
  }

  // 1. Fetch organization review settings
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, google_review_url, is_review_engine_active, review_requests_enabled, review_cooldown_days, telnyx_phone_number, phone_provisioning_status, plan_id, subscription_status, timezone, enforce_quiet_hours')
    .eq('id', orgId)
    .single()

  if (orgError || !org) {
    return { eligible: false, reason: 'not_found', details: 'Organization not found' }
  }

  // Check if review engine is disabled
  const isEnabled = org.review_requests_enabled !== false && org.is_review_engine_active !== false
  if (!isEnabled) {
    return { eligible: false, reason: 'disabled', details: 'Review requests are disabled in settings' }
  }

  if (!org.google_review_url) {
    return { eligible: false, reason: 'missing_google_url', details: 'No Google review URL configured' }
  }

  // 2. Fetch contact and verify opt-out and phone validity
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('id, name, phone, opt_out, org_id')
    .eq('id', contactId)
    .eq('org_id', orgId)
    .single()

  if (contactError || !contact) {
    return { eligible: false, reason: 'not_found', details: 'Contact not found' }
  }

  if (contact.opt_out) {
    return { eligible: false, reason: 'opted_out', details: 'Customer opted out of SMS messages' }
  }

  // Real-time carrier suppression list check
  const suppression = await isPhoneSuppressed(supabase, orgId, contact.phone)
  if (suppression.suppressed) {
    return { eligible: false, reason: 'opted_out', details: 'Customer phone is on suppression list' }
  }

  const norm = normalizePhoneToE164(contact.phone)
  if (!norm.isValid || !norm.e164) {
    return { eligible: false, reason: 'invalid_phone', details: `Invalid contact phone: ${contact.phone}` }
  }

  // 3. If job specified, ensure job was not cancelled
  let jobData = null
  if (jobId) {
    const { data: job } = await supabase
      .from('jobs')
      .select('id, status, job_number, deleted_at')
      .eq('id', jobId)
      .eq('org_id', orgId)
      .maybeSingle()

    jobData = job
    if (job && (job.status === 'cancelled' || job.status === 'no_show' || job.status === 'disputed' || job.deleted_at)) {
      return { eligible: false, reason: 'job_cancelled', details: `Job is ${job.status || 'deleted'}` }
    }
  }

  // 4. Cooldown window check (default 60 days)
  const cooldownDays = Number(org.review_cooldown_days) || 60
  const cooldownCutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: recentRequests } = await supabase
    .from('review_requests')
    .select('id, created_at, status')
    .eq('org_id', orgId)
    .eq('contact_id', contactId)
    .in('status', ['pending', 'scheduled', 'sent', 'delivered', 'clicked'])
    .gte('created_at', cooldownCutoff)

  if (recentRequests && recentRequests.length > 0) {
    return {
      eligible: false,
      reason: 'cooldown_active',
      details: `Review request already sent within ${cooldownDays}-day cooldown period`
    }
  }

  return {
    eligible: true,
    contact,
    org,
    job: jobData
  }
}

/**
 * Formats compliant review invitation text
 * IMPORTANT: In accordance with Google policies, never ask specifically for a 5-star review.
 */
export function formatCompliantReviewMessage(
  businessName: string,
  reviewUrl: string,
  options?: {
    operationMode?: 'solo' | 'multi_crew'
    technicianName?: string
    customerName?: string
  }
): string {
  if (options?.operationMode) {
    return renderSituationAwareText('customer_review_request', {
      operationMode: options.operationMode,
      businessName,
      reviewUrl,
      technicianName: options.technicianName,
      customerName: options.customerName
    })
  }
  return `Thanks for choosing ${businessName}. We'd really appreciate your feedback. You can leave us a Google review here: ${reviewUrl}`
}

/**
 * Dispatches an automated or manual review invitation
 */
export async function dispatchReviewRequest(
  supabase: SupabaseClient,
  input: {
    orgId: string
    contactId: string
    jobId?: string
    baseUrl: string
    customMessage?: string
    actorId?: string
    actorRole?: string
    overrideDate?: Date
  }
): Promise<{
  success: boolean
  reviewRequest?: any
  suppressed?: boolean
  reason?: string
  error?: string
  scheduled?: boolean
  scheduledAt?: string
}> {
  const { orgId, contactId, jobId, baseUrl, customMessage, actorId, actorRole, overrideDate } = input

  // 1. Check eligibility
  const eligibility = await checkReviewEligibility(supabase, { orgId, contactId, jobId })

  if (!eligibility.eligible) {
    // Record suppression in review_requests for full observability
    const token = crypto.randomBytes(16).toString('hex')
    await supabase.from('review_requests').insert({
      org_id: orgId,
      contact_id: contactId,
      job_id: jobId || null,
      token,
      google_review_url: eligibility.org?.google_review_url || 'https://google.com',
      status: 'suppressed',
      delivery_status: 'suppressed',
      suppression_reason: eligibility.details || eligibility.reason,
      created_at: new Date().toISOString()
    })

    return {
      success: false,
      suppressed: true,
      reason: eligibility.details || eligibility.reason
    }
  }

  const { contact, org, job: jobData } = eligibility

  // 1.5 Idempotency guard: If an active review request already exists for this job, return it without duplicate SMS
  if (jobId) {
    const { data: existingJobReview } = await supabase
      .from('review_requests')
      .select('*')
      .eq('org_id', orgId)
      .eq('job_id', jobId)
      .neq('status', 'suppressed')
      .maybeSingle()

    if (existingJobReview) {
      return { success: true, reviewRequest: existingJobReview }
    }
  }

  const token = crypto.randomBytes(16).toString('hex')
  const safeBaseUrl = baseUrl.replace(/\/$/, '')
  const trackableReviewUrl = `${safeBaseUrl}/r/${token}`
  const businessName = org.name || 'our team'

  // 2. Insert pending review_request record
  const { data: requestRow, error: insertError } = await supabase
    .from('review_requests')
    .insert({
      org_id: orgId,
      contact_id: contactId,
      job_id: jobId || null,
      token,
      google_review_url: org.google_review_url,
      status: 'pending',
      delivery_status: 'pending',
      created_at: new Date().toISOString()
    })
    .select('*')
    .single()

  if (insertError) {
    if (
      jobId && (
        insertError.code === '23505' ||
        insertError.message?.toLowerCase().includes('unique') ||
        insertError.message?.toLowerCase().includes('duplicate')
      )
    ) {
      const { data: existingJobReview } = await supabase
        .from('review_requests')
        .select('*')
        .eq('org_id', orgId)
        .eq('job_id', jobId)
        .maybeSingle()

      if (existingJobReview) {
        return { success: true, reviewRequest: existingJobReview }
      }
    }
    return { success: false, error: insertError.message }
  }

  // 3. Format message (strictly compliant: neutral feedback, no 5-star gating)
  let messageBody: string
  if (customMessage) {
    messageBody = customMessage
      .replace(/\{review_url\}|\{review_link\}|\{\{review_url\}\}|\{\{review_link\}\}/g, trackableReviewUrl)
      .replace(/\{business_name\}|\{\{business_name\}\}/g, businessName)
    if (!messageBody.includes(trackableReviewUrl) && !messageBody.includes('/r/')) {
      messageBody = `${messageBody.trim()} ${trackableReviewUrl}`
    }
  } else {
    messageBody = formatCompliantReviewMessage(businessName, trackableReviewUrl, {
      operationMode: resolveOperationMode(org),
      customerName: contact?.name,
      technicianName: (jobData as any)?.technician_name
    })
  }

  // 4. Resolve sender number (dedicated 10DLC for paid tiers, verified toll-free for free starter pass)
  let senderNumber = resolveSenderPhone(org)

  // 4.5. TCPA Quiet Hours & Pre-Flight Compliance Interception (P2-003)
  const timezone = org.timezone || 'America/New_York'
  const isQuiet = isTcpaQuietHours(timezone, overrideDate)

  if (isQuiet && org.enforce_quiet_hours !== false) {
    const { scheduledAt } = calculateNextMorning805(timezone, overrideDate)
    const nowIso = new Date().toISOString()

    await supabase
      .from('review_requests')
      .update({
        status: 'scheduled',
        delivery_status: 'scheduled',
        scheduled_at: scheduledAt,
        updated_at: nowIso
      })
      .eq('id', requestRow.id)

    const idempotencyKey = `review_quiet_hours:${orgId}:${requestRow.id}`
    const { data: existingRun } = await supabase
      .from('automation_runs')
      .select('id')
      .eq('org_id', orgId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (!existingRun) {
      await supabase.from('automation_runs').insert({
        org_id: orgId,
        job_id: `job_${idempotencyKey}`,
        idempotency_key: idempotencyKey,
        event_type: 'review.quiet_hours_scheduled',
        action_type: 'send_sms',
        action_params: {
          to: contact.phone,
          from: senderNumber,
          text: messageBody,
          message: messageBody,
          flowType: 'review_request',
          messageType: 'marketing'
        },
        status: 'scheduled',
        scheduled_at: scheduledAt,
        event_payload: {
          contact_id: contactId,
          review_request_id: requestRow.id,
          job_id: jobId
        }
      })
    }

    return {
      success: true,
      scheduled: true,
      scheduledAt,
      reviewRequest: {
        ...requestRow,
        status: 'scheduled',
        delivery_status: 'scheduled',
        scheduled_at: scheduledAt
      }
    }
  }

  // Pre-flight Outbound Compliance Verification
  const compliance = await verifyOutboundCompliance(supabase, {
    orgId,
    toPhone: contact.phone,
    contactId,
    flowType: 'review_request',
    messageType: 'marketing',
    body: messageBody,
    timezone,
    checkQuietHours: false
  })

  if (!compliance.allowed) {
    const nowIso = new Date().toISOString()
    await supabase
      .from('review_requests')
      .update({
        status: 'suppressed',
        delivery_status: 'suppressed',
        suppression_reason: compliance.suppressionReason || 'compliance_check_failed',
        updated_at: nowIso
      })
      .eq('id', requestRow.id)

    return {
      success: false,
      suppressed: true,
      reason: compliance.suppressionReason || 'Compliance check failed'
    }
  }

  // 5. Send SMS via Telnyx
  const smsResult = await sendTelnyxSms({
    to: contact.phone,
    from: senderNumber,
    text: messageBody
  })

  const nowIso = new Date().toISOString()

  if (!smsResult.success) {
    await supabase
      .from('review_requests')
      .update({
        status: 'failed',
        delivery_status: 'failed',
        error_message: smsResult.error,
        updated_at: nowIso
      })
      .eq('id', requestRow.id)

    return { success: false, error: smsResult.error }
  }

  // 6. Update review_request to sent
  const { data: updatedRequest } = await supabase
    .from('review_requests')
    .update({
      status: 'sent',
      delivery_status: 'sent',
      sent_at: nowIso,
      updated_at: nowIso
    })
    .eq('id', requestRow.id)
    .select('*')
    .single()

  // 6.5. Compliance Audit Log
  await logComplianceAudit(supabase, {
    orgId,
    phone: contact.phone,
    contactId,
    action: 'message_sent',
    messageType: 'marketing',
    metadata: { flowType: 'review_request', body: messageBody }
  })

  // 7. Audit log event
  await logAuditEvent(supabase, {
    org_id: orgId,
    event_type: 'sms.outbound_dispatched',
    description: `Sent review request to ${contact.name || contact.phone}`,
    metadata: {
      actor_id: actorId || 'system',
      actor_role: actorRole || 'system',
      action: 'review_invite',
      contact_id: contactId,
      job_id: jobId,
      review_request_id: requestRow.id
    }
  })

  return {
    success: true,
    reviewRequest: updatedRequest
  }
}

/**
 * Records a legitimate click on the tracked review URL and returns the Google review destination
 */
export async function recordReviewClick(
  supabase: SupabaseClient,
  token: string
): Promise<{ success: boolean; googleReviewUrl?: string; error?: string }> {
  const { data: req, error } = await supabase
    .from('review_requests')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !req) {
    return { success: false, error: 'Review link not found or expired' }
  }

  const nowIso = new Date().toISOString()
  const newClickCount = (req.click_count || 0) + 1

  await supabase
    .from('review_requests')
    .update({
      status: 'clicked',
      clicked_at: nowIso,
      click_count: newClickCount,
      updated_at: nowIso
    })
    .eq('id', req.id)

  return {
    success: true,
    googleReviewUrl: req.google_review_url
  }
}

/**
 * Schedules automated review follow-up after job completion
 */
export async function scheduleJobReviewAutomation(
  supabase: SupabaseClient,
  context: { orgId: string; jobId: string; contactId: string }
): Promise<void> {
  const { orgId, jobId, contactId } = context

  // Fetch org delay
  const { data: org } = await supabase
    .from('organizations')
    .select('review_delay_hours, review_requests_enabled, is_review_engine_active')
    .eq('id', orgId)
    .single()

  const isEnabled = org?.review_requests_enabled !== false && org?.is_review_engine_active !== false
  if (!isEnabled) return

  const delayHours = Number(org?.review_delay_hours) || 24
  const scheduledTimeMs = Date.now() + delayHours * 60 * 60 * 1000

  await supabase.from('automation_runs').insert({
    org_id: orgId,
    rule_id: '00000000-0000-0000-0000-000000000008', // System Job Review Automation Rule
    job_id: `job_review_${jobId}`,
    idempotency_key: `review_request_${jobId}`,
    event_type: 'job.completed',
    event_payload: {
      job_id: jobId,
      contact_id: contactId
    },
    action_type: 'send_review_request',
    action_params: {
      job_id: jobId,
      contact_id: contactId
    },
    status: 'scheduled',
    scheduled_at: new Date(scheduledTimeMs).toISOString()
  })
}

/**
 * Schedules automated Google review follow-up 15 minutes after invoice payment in full
 */
export async function scheduleInvoiceReviewAutomation(
  supabase: SupabaseClient,
  context: { orgId: string; invoiceId: string; contactId?: string | null; delayMinutes?: number }
): Promise<{ scheduled: boolean; scheduledAt?: string; reason?: string }> {
  const { orgId, invoiceId, contactId, delayMinutes = 15 } = context

  if (!contactId) {
    return { scheduled: false, reason: 'missing_contact' }
  }

  // Fetch org review settings
  const { data: org } = await supabase
    .from('organizations')
    .select('review_delay_hours, review_requests_enabled, is_review_engine_active, google_review_url, timezone')
    .eq('id', orgId)
    .single()

  const isEnabled = org?.review_requests_enabled !== false && org?.is_review_engine_active !== false && !!org?.google_review_url
  if (!isEnabled) {
    return { scheduled: false, reason: 'reviews_disabled_or_no_url' }
  }

  // Resolve linked job if invoice is tied to a field service job
  let linkedJobId: string | undefined
  const { data: invRow } = await supabase
    .from('invoices')
    .select('job_id')
    .eq('id', invoiceId)
    .maybeSingle()
  if (invRow?.job_id) {
    linkedJobId = invRow.job_id
  }

  // 15 minutes after payment in full (or custom delay)
  const scheduledTimeMs = Date.now() + delayMinutes * 60 * 1000
  let effectiveScheduledAt = new Date(scheduledTimeMs).toISOString()

  // P1 TCPA Quiet Hours Guard: Never dispatch review SMS during 9:00 PM - 8:00 AM
  const tz = org?.timezone || 'America/New_York'
  if (isTcpaQuietHours(tz, new Date(scheduledTimeMs))) {
    const { scheduledAt: nextMorning } = calculateNextMorning805(tz, new Date(scheduledTimeMs))
    effectiveScheduledAt = nextMorning
  }

  await supabase.from('automation_runs').insert({
    org_id: orgId,
    rule_id: '00000000-0000-0000-0000-000000000009', // System Invoice Review Automation Rule
    job_id: `invoice_review_${invoiceId}`,
    idempotency_key: `review_invoice_${invoiceId}`,
    event_type: 'invoice.paid',
    event_payload: {
      invoice_id: invoiceId,
      contact_id: contactId,
      job_id: linkedJobId
    },
    action_type: 'send_review_request',
    action_params: {
      invoice_id: invoiceId,
      contact_id: contactId,
      job_id: linkedJobId
    },
    status: 'scheduled',
    scheduled_at: effectiveScheduledAt
  })

  return { scheduled: true, scheduledAt: effectiveScheduledAt }
}
