import type { SupabaseClient } from '@supabase/supabase-js'
import { isValidE164 } from './phone-normalizer.ts'
import { isShortCall, isTcpaQuietHours } from '../services/safety-rules.ts'

export interface SuppressionCheckParams {
  supabase: SupabaseClient
  orgId: string
  callerNumber: string
  calledNumber: string
  contactOptOut: boolean
  durationSeconds: number
  isMissedCallActive: boolean
  cooldownHours?: number
  timezone?: string
}

export interface SuppressionResult {
  shouldSend: boolean
  suppressionReason?: string
}

const KNOWN_SPAM_OR_DUMMY_PATTERNS = [
  /^\+10000000000$/,
  /^\+11111111111$/,
  /^\+11234567890$/,
  /^\+15551212$/,
  /^\+18005550199$/
]

/**
 * Checks whether a phone number matches known spam patterns or is a loopback call
 */
export function isSpamOrBlockedNumber(caller: string, called?: string): boolean {
  if (!caller) return true

  // Loopback check (calling own number)
  if (called && caller.trim() === called.trim()) {
    return true
  }

  // Regex pattern matching
  for (const pattern of KNOWN_SPAM_OR_DUMMY_PATTERNS) {
    if (pattern.test(caller.trim())) {
      return true
    }
  }

  return false
}

/**
 * Evaluates all suppression checks prior to dispatching an automated missed-call SMS.
 * Enforces TCPA compliance, spam prevention, and cooldown guards.
 */
export async function evaluateSuppression(
  params: SuppressionCheckParams
): Promise<SuppressionResult> {
  const {
    supabase,
    orgId,
    callerNumber,
    calledNumber,
    contactOptOut,
    durationSeconds,
    isMissedCallActive,
    cooldownHours = 24,
    timezone = 'America/Chicago'
  } = params

  // 1. Phone number format validity
  if (!isValidE164(callerNumber)) {
    return { shouldSend: false, suppressionReason: 'invalid_number' }
  }

  // 2. Organization service toggle
  if (!isMissedCallActive) {
    return { shouldSend: false, suppressionReason: 'service_disabled' }
  }

  // 3. TCPA opt-out status
  if (contactOptOut) {
    return { shouldSend: false, suppressionReason: 'opted_out' }
  }

  // 4. Spam / Blocked / Loopback check
  if (isSpamOrBlockedNumber(callerNumber, calledNumber)) {
    return { shouldSend: false, suppressionReason: 'blocked_or_spam' }
  }

  // 5. Short call misdial (< 3s)
  if (isShortCall(durationSeconds)) {
    return { shouldSend: false, suppressionReason: 'short_call_misdial' }
  }

  // 6. TCPA quiet hours curfew (8:00 PM to 8:00 AM)
  if (isTcpaQuietHours(timezone)) {
    return { shouldSend: false, suppressionReason: 'tcpa_quiet_hours' }
  }

  // 7. Cooldown window check: Has an automated reply already been sent to this caller recently?
  const cooldownCutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString()
  
  const { data: recentCalls, error: queryError } = await supabase
    .from('calls')
    .select('id')
    .eq('org_id', orgId)
    .eq('caller_number', callerNumber)
    .eq('auto_reply_sent', true)
    .gte('created_at', cooldownCutoff)
    .limit(1)

  if (!queryError && recentCalls && recentCalls.length > 0) {
    return { shouldSend: false, suppressionReason: 'cooldown_active' }
  }

  // All safety checks passed
  return { shouldSend: true }
}
