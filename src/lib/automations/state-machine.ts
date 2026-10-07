/**
 * CaptoDesk Automation Lifecycle State Machine
 * Formally defines lifecycle states, transition validation, retry backoff, and stale-lock recovery.
 */

export type AutomationState =
  | 'scheduled'
  | 'pending'
  | 'processing'
  | 'running'
  | 'retrying'
  | 'completed'
  | 'success'
  | 'failed'
  | 'dead_letter'
  | 'cancelled'

/**
 * Transition rules: Every state transition in the system must be explicitly registered here.
 */
export const ALLOWED_TRANSITIONS: Record<AutomationState, readonly AutomationState[]> = {
  scheduled: ['pending', 'processing', 'running', 'cancelled'],
  pending: ['processing', 'running', 'cancelled'],
  processing: ['running', 'completed', 'success', 'retrying', 'pending', 'failed', 'dead_letter', 'cancelled'],
  running: ['completed', 'success', 'retrying', 'pending', 'failed', 'dead_letter', 'cancelled'],
  retrying: ['pending', 'processing', 'cancelled'],
  completed: [], // Terminal
  success: [], // Terminal (DB synonym for completed)
  failed: ['pending'], // Re-queue allowed ONLY via explicit operator retry
  dead_letter: ['pending'], // Re-queue allowed ONLY via explicit operator retry
  cancelled: [] // Terminal
}

/**
 * Checks whether transitioning from `fromState` to `toState` is permitted.
 */
export function canTransition(fromState: string, toState: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[fromState as AutomationState]
  if (!allowed) return false
  return allowed.includes(toState as AutomationState)
}

/**
 * Enforces transition validity, throwing an error if the transition is illegal.
 */
export function assertValidTransition(fromState: string, toState: string): void {
  if (!canTransition(fromState, toState)) {
    throw new Error(
      `[ILLEGAL_STATE_TRANSITION] Cannot transition automation run from '${fromState}' to '${toState}'. Allowed targets: [${(ALLOWED_TRANSITIONS[fromState as AutomationState] || []).join(', ')}]`
    )
  }
}

/**
 * Determines whether a state is terminal (cannot transition further during standard worker execution).
 */
export function isTerminalState(state: string): boolean {
  return state === 'completed' || state === 'success' || state === 'cancelled' || state === 'dead_letter' || state === 'failed'
}

/**
 * Evaluates whether a run can be manually retried by an operator.
 */
export function isRetryEligible(state: string): boolean {
  return state === 'failed' || state === 'dead_letter'
}

/**
 * Stale Lock Recovery Engine
 * If a worker crashed or experienced an unhandled network timeout while holding a lock on a job,
 * this function deterministically recovers the job or escalates it to dead_letter.
 */
export function evaluateStaleLockRecovery(job: {
  id: string
  status: string
  retry_count: number
  max_retries: number
  locked_at?: string | null
}, staleThresholdSeconds = 600, nowMs = Date.now()): {
  isStale: boolean
  action: 'none' | 'retry' | 'dead_letter'
  updates?: Record<string, any>
  reason?: string
} {
  if (job.status !== 'processing' && job.status !== 'running') {
    return { isStale: false, action: 'none' }
  }

  if (!job.locked_at) {
    return { isStale: false, action: 'none' }
  }

  const lockedMs = new Date(job.locked_at).getTime()
  const elapsedSeconds = (nowMs - lockedMs) / 1000

  if (elapsedSeconds < staleThresholdSeconds) {
    return { isStale: false, action: 'none' }
  }

  const nextRetryCount = (job.retry_count || 0) + 1
  const maxRetries = job.max_retries || 3

  if (nextRetryCount >= maxRetries) {
    // Max retries exhausted during crashed/stalled execution: escalate to dead_letter
    const reason = `Worker lock stalled for ${Math.round(elapsedSeconds)}s. Max retries (${maxRetries}) exhausted.`
    return {
      isStale: true,
      action: 'dead_letter',
      reason,
      updates: {
        status: 'dead_letter',
        locked_at: null,
        locked_by: null,
        retry_count: nextRetryCount,
        completed_at: new Date(nowMs).toISOString(),
        failure_reason: reason
      }
    }
  }

  // Recoverable: re-queue as pending with incremented attempt
  const reason = `Recovered from stalled worker lock (${Math.round(elapsedSeconds)}s old). Re-queued attempt ${nextRetryCount}/${maxRetries}.`
  return {
    isStale: true,
    action: 'retry',
    reason,
    updates: {
      status: 'pending',
      locked_at: null,
      locked_by: null,
      retry_count: nextRetryCount,
      scheduled_at: new Date(nowMs).toISOString(),
      failure_reason: reason
    }
  }
}
