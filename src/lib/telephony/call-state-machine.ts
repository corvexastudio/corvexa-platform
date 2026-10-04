/**
 * CaptoDesk Telephony Call State Machine
 * Evaluates Telnyx call events and enforces that answered calls NEVER trigger recovery SMS.
 */

export type CallState =
  | 'initiated'
  | 'ringing'
  | 'answered'
  | 'bridged'
  | 'completed'
  | 'busy'
  | 'no_answer'
  | 'missed'
  | 'failed'

export type RecoveryReason = 'no_answer' | 'busy' | 'unanswered'

export interface TelnyxCallPayload {
  event_type?: string
  call_control_id?: string
  call_leg_id?: string
  call_session_id?: string
  from?: string
  to?: string
  state?: string
  hangup_cause?: string
  hangup_source?: string
  duration_secs?: number
}

export interface CallEvaluationResult {
  state: CallState
  wasAnswered: boolean
  isEligibleForRecovery: boolean
  recoveryReason?: RecoveryReason
  durationSeconds: number
  hangupCause?: string
  description: string
}

/**
 * Normalizes Telnyx hangup causes and state payloads into a strict call evaluation
 */
export function evaluateCallOutcome(
  eventType: string,
  payload: TelnyxCallPayload
): CallEvaluationResult {
  const rawState = (payload.state || '').toLowerCase().trim()
  const rawHangup = (payload.hangup_cause || '').toLowerCase().trim()
  const duration = payload.duration_secs || 0

  // 1. Non-hangup intermediate events
  if (eventType === 'call.initiated') {
    return {
      state: 'initiated',
      wasAnswered: false,
      isEligibleForRecovery: false,
      durationSeconds: 0,
      description: 'Call is initiating and routing'
    }
  }

  if (eventType === 'call.ringing') {
    return {
      state: 'ringing',
      wasAnswered: false,
      isEligibleForRecovery: false,
      durationSeconds: 0,
      description: 'Call is ringing destination'
    }
  }

  if (eventType === 'call.answered') {
    return {
      state: 'answered',
      wasAnswered: true,
      isEligibleForRecovery: false,
      durationSeconds: duration,
      description: 'Call was answered by party'
    }
  }

  if (eventType === 'call.bridged') {
    return {
      state: 'bridged',
      wasAnswered: true,
      isEligibleForRecovery: false,
      durationSeconds: duration,
      description: 'Call was successfully bridged'
    }
  }

  // 2. Hangup evaluation ('call.hangup')
  // Check if the call was previously or currently answered
  const answeredCauses = new Set(['normal_clearing', 'user_hangup'])
  const wasAnswered =
    rawState === 'answered' ||
    (answeredCauses.has(rawHangup) && duration > 5)

  if (wasAnswered) {
    return {
      state: 'completed',
      wasAnswered: true,
      isEligibleForRecovery: false,
      durationSeconds: duration,
      hangupCause: rawHangup,
      description: 'Call was completed and answered normally. Recovery SMS must NOT be sent.'
    }
  }

  // 3. Busy detection
  const busyCauses = new Set(['user_busy', 'busy', 'subscriber_busy'])
  if (busyCauses.has(rawHangup) || rawState === 'busy') {
    return {
      state: 'busy',
      wasAnswered: false,
      isEligibleForRecovery: true,
      recoveryReason: 'busy',
      durationSeconds: duration,
      hangupCause: rawHangup,
      description: 'Recipient line was busy. Eligible for busy-recovery SMS.'
    }
  }

  // 4. No Answer / Unanswered / Abandoned Ringing
  const noAnswerCauses = new Set([
    'no_answer',
    'timeout',
    'originator_cancel', // Caller gave up while ringing
    'call_rejected'
  ])

  if (noAnswerCauses.has(rawHangup) || rawState === 'no_answer' || rawState === 'ringing') {
    return {
      state: 'no_answer',
      wasAnswered: false,
      isEligibleForRecovery: true,
      recoveryReason: 'no_answer',
      durationSeconds: duration,
      hangupCause: rawHangup,
      description: 'Call was unanswered or abandoned while ringing. Eligible for missed-call recovery SMS.'
    }
  }

  // 5. Unrecoverable failures (network congestion, unallocated number, etc.)
  const fatalCauses = new Set([
    'unallocated_number',
    'network_congestion',
    'invalid_number_format',
    'incompatible_destination'
  ])

  if (fatalCauses.has(rawHangup)) {
    return {
      state: 'failed',
      wasAnswered: false,
      isEligibleForRecovery: false,
      durationSeconds: duration,
      hangupCause: rawHangup,
      description: `Call failed with fatal telephony error: ${rawHangup}. Not eligible for recovery.`
    }
  }

  // Default fallback for unrecognized missed calls: treat as missed
  return {
    state: 'missed',
    wasAnswered: false,
    isEligibleForRecovery: true,
    recoveryReason: 'unanswered',
    durationSeconds: duration,
    hangupCause: rawHangup || 'unspecified_missed',
    description: 'Call ended without being answered. Eligible for missed-call recovery.'
  }
}
