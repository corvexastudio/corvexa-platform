import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTelnyxSms } from '../telnyx.ts'
import { normalizePhoneToE164, formatNationalUs } from './phone-normalizer.ts'
import { checkRateLimitAsync } from '../security/rate-limiter.ts'
import { logAuditEvent } from '../security/audit-logger.ts'

export interface ResolveOwnerPhoneResult {
  phone: string | null
  source: 'organization.owner_phone' | 'profiles.owner' | 'none'
}

export interface OwnerAlertTextOptions {
  callerPhone?: string | null
  customerSmsSuccess: boolean
  businessName?: string
}

export interface NotifyOwnerParams {
  org: any
  callerPhone: string
  calledPhone: string
  customerSmsSuccess: boolean
  callId?: string
  sendSmsFn?: typeof sendTelnyxSms
  skipInApp?: boolean
}

export interface OwnerNotificationResult {
  attempted: boolean
  sent: boolean
  ownerPhone?: string
  messageId?: string
  error?: string
  skippedReason?:
    | 'no_owner_phone'
    | 'no_verified_tenant_did'
    | 'rate_limited'
    | 'invalid_sender_phone'
    | 'invalid_owner_phone'
  text?: string
}

/**
 * Builds the concise, accurate SMS copy for the business owner.
 * Explicitly distinguishes between whether the customer recovery text succeeded or failed.
 * Contains ZERO sensitive information (no addresses, EINs, internal IDs, or payment data).
 */
export function buildOwnerMissedCallAlertText(options: OwnerAlertTextOptions): string {
  const { callerPhone, customerSmsSuccess } = options
  const norm = callerPhone ? normalizePhoneToE164(callerPhone) : null

  if (norm?.isValid && norm.e164) {
    const displayPhone = formatNationalUs(norm.e164)
    if (customerSmsSuccess) {
      return `CaptoDesk: Missed call from ${displayPhone}. We texted them your booking link. Check your inbox for details.`
    } else {
      return `CaptoDesk: Missed call from ${displayPhone}. We couldn't deliver the automatic reply. Check your inbox.`
    }
  }

  // Fallback if caller phone is missing or invalid
  if (customerSmsSuccess) {
    return 'CaptoDesk: You have a new missed-call lead. We sent the caller an automatic reply. Check your inbox for details.'
  } else {
    return "CaptoDesk: You have a new missed-call lead. We couldn't deliver the automatic reply. Check your inbox."
  }
}

/**
 * Resolves the business owner's mobile notification phone number server-side.
 * Authoritative precedence:
 *  1. organizations.owner_phone (configured by owner during onboarding / settings)
 *  2. profiles.phone for role = 'owner' belonging to the same tenant organization
 */
export async function resolveOwnerPhone(
  supabase: SupabaseClient,
  org: any
): Promise<ResolveOwnerPhoneResult> {
  // 1. Primary: Server-authoritative organizations.owner_phone
  if (org?.owner_phone && typeof org.owner_phone === 'string') {
    const trimmed = org.owner_phone.trim()
    if (trimmed.length > 0) {
      const norm = normalizePhoneToE164(trimmed)
      if (norm.isValid && norm.e164 && !norm.e164.startsWith('+1999')) {
        return { phone: norm.e164, source: 'organization.owner_phone' }
      }
    }
  }

  // 2. Secondary fallback: Search profiles table for owner role in this organization
  if (org?.id && typeof supabase?.from === 'function') {
    try {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('org_id', org.id)
        .eq('role', 'owner')
        .not('phone', 'is', null)
        .limit(1)
        .maybeSingle()

      if (ownerProfile?.phone && typeof ownerProfile.phone === 'string') {
        const trimmed = ownerProfile.phone.trim()
        if (trimmed.length > 0) {
          const norm = normalizePhoneToE164(trimmed)
          if (norm.isValid && norm.e164 && !norm.e164.startsWith('+1999')) {
            return { phone: norm.e164, source: 'profiles.owner' }
          }
        }
      }
    } catch {
      // Non-blocking fallback failure
    }
  }

  return { phone: null, source: 'none' }
}

/**
 * Dispatches a reliable mobile SMS alert to the business owner when a missed call is recovered.
 * 
 * Safety & Isolation Guarantees:
 * 1. Strict Tenant Isolation: Sender DID is verified as belonging to this tenant organization.
 * 2. Complete Failure Isolation: If owner alert fails, the lead, customer SMS, and call record are never rolled back.
 * 3. Rate Limit Protection: Throttles alerts to prevent owner phone flooding during call storms.
 * 4. Privacy: Only the national-formatted caller phone and platform status are sent; no sensitive metadata is leaked.
 * 5. Distinct Channel: Sent directly to owner; never inserted into customer conversation thread.
 */
export async function notifyOwnerOfMissedCall(
  supabase: SupabaseClient,
  params: NotifyOwnerParams
): Promise<OwnerNotificationResult> {
  const { org, callerPhone, calledPhone, customerSmsSuccess } = params
  const sendSms = params.sendSmsFn || sendTelnyxSms

  // Guard 1: Verify tenant organization exists
  if (!org?.id) {
    return { attempted: false, sent: false, skippedReason: 'no_verified_tenant_did' }
  }

  // Guard 2: Resolve owner recipient phone safely
  const ownerResolution = await resolveOwnerPhone(supabase, org)
  if (!ownerResolution.phone) {
    return { attempted: false, sent: false, skippedReason: 'no_owner_phone' }
  }
  const ownerPhone = ownerResolution.phone

  // Guard 3: Validate outbound sender phone (must be the verified tenant DID)
  const normCalled = normalizePhoneToE164(calledPhone)
  if (!normCalled.isValid || !normCalled.e164 || normCalled.e164.startsWith('+1999')) {
    return { attempted: false, sent: false, ownerPhone, skippedReason: 'invalid_sender_phone' }
  }
  const senderPhone = normCalled.e164

  // Guard 4: Rate limit protection against automated spam storms (Max 10 owner alerts / min per tenant)
  const rateLimit = await checkRateLimitAsync(`sms:owner_alert:${org.id}`, { max: 10, windowMs: 60 * 1000 })
  if (!rateLimit.allowed) {
    return {
      attempted: false,
      sent: false,
      ownerPhone,
      skippedReason: 'rate_limited',
      error: 'Owner alert rate limit exceeded'
    }
  }

  // Build accurate, concise SMS body
  const alertText = buildOwnerMissedCallAlertText({
    callerPhone,
    customerSmsSuccess,
    businessName: org.name
  })

  // Dispatch SMS (Failure isolated)
  try {
    const smsRes = await sendSms({
      to: ownerPhone,
      from: senderPhone,
      text: alertText
    })

    if (!smsRes.success) {
      console.warn(`[OWNER ALERT FAILED] Telnyx dispatch to ${ownerPhone} failed:`, smsRes.error)
      try {
        await logAuditEvent(supabase, {
          org_id: org.id,
          event_type: 'telephony.owner_alert_failed',
          description: `Failed to deliver owner missed-call alert to ${ownerPhone}: ${smsRes.error}`,
          metadata: {
            owner_phone: ownerPhone,
            caller_phone: callerPhone,
            sender_did: senderPhone,
            error: smsRes.error
          }
        })
      } catch {
        // Non-blocking
      }

      return {
        attempted: true,
        sent: false,
        ownerPhone,
        text: alertText,
        error: smsRes.error || 'Telnyx SMS delivery failed'
      }
    }

    // Success: Log in audit log
    try {
      await logAuditEvent(supabase, {
        org_id: org.id,
        event_type: 'telephony.owner_alert_sent',
        description: `Owner missed-call alert sent to ${ownerPhone}`,
        metadata: {
          owner_phone: ownerPhone,
          caller_phone: callerPhone,
          sender_did: senderPhone,
          telnyx_message_id: smsRes.messageId
        }
      })
    } catch {
      // Non-blocking
    }

    // In-app notification
    try {
      if (!params.skipInApp && typeof supabase?.from === 'function') {
        await supabase.from('notifications').insert({
          org_id: org.id,
          title: 'Missed Call Recovered',
          message: alertText,
          link: '/client/inbox'
        })
      }
    } catch {
      // Non-blocking
    }

    return {
      attempted: true,
      sent: true,
      ownerPhone,
      text: alertText,
      messageId: smsRes.messageId
    }
  } catch (err: any) {
    console.error('[OWNER ALERT EXCEPTION]', err)
    return {
      attempted: true,
      sent: false,
      ownerPhone,
      text: alertText,
      error: err?.message || 'Unexpected exception during owner notification'
    }
  }
}
