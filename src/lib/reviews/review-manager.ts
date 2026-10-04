import type { SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { sendTelnyxSms } from '../telnyx.ts'
import { normalizePhoneToE164 } from '../telephony/phone-normalizer.ts'
import { logAuditEvent } from '../security/audit-logger.ts'
import { isPhoneSuppressed, logComplianceAudit } from '../compliance/compliance-engine.ts'

export interface ReviewEligibilityResult {
  eligible: boolean
  reason?: 'opted_out' | 'invalid_phone' | 'job_cancelled' | 'cooldown_active' | 'disabled' | 'missing_google_url' | 'not_found'
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

  // 1. Fetch organization review settings
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, google_review_url, is_review_engine_active, review_requests_enabled, review_cooldown_days, telnyx_phone_number')
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
      .select('id, status, job_number')
      .eq('id', jobId)
      .eq('org_id', orgId)
      .maybeSingle()

    jobData = job
    if (job && (job.status === 'cancelled' || job.status === 'no_show')) {
      return { eligible: false, reason: 'job_cancelled', details: `Job is ${job.status}` }
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
    .in('status', ['sent', 'delivered', 'clicked'])
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
export function formatCompliantReviewMessage(businessName: string, reviewUrl: string): string {
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
  }
): Promise<{ success: boolean; reviewRequest?: any; suppressed?: boolean; reason?: string; error?: string }> {
  const { orgId, contactId, jobId, baseUrl, customMessage, actorId, actorRole } = input

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

  const { contact, org } = eligibility
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
    return { success: false, error: insertError.message }
  }

  // 3. Format message (strictly compliant: neutral feedback, no 5-star gating)
  const messageBody = customMessage || formatCompliantReviewMessage(businessName, trackableReviewUrl)

  // 4. Resolve sender number
  let senderNumber = org.telnyx_phone_number
  if (!senderNumber) {
    const { data: numRow } = await supabase
      .from('telnyx_phone_numbers')
      .select('phone_number')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    senderNumber = numRow?.phone_number
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
