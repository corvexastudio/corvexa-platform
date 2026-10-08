/**
 * CaptoDesk Messaging Lifecycle & State Machine Engine
 * 
 * Enforces monotonic forward state transitions and out-of-order webhook protection.
 * Prevents impossible regressions (e.g. delivered -> sent).
 */

export type MessageDeliveryStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'undelivered'
  | 'received'

/**
 * Explicit map of permitted state transitions.
 * Terminal states (delivered, received) reject regressions.
 */
export const ALLOWED_MESSAGE_TRANSITIONS: Record<MessageDeliveryStatus, readonly MessageDeliveryStatus[]> = {
  // Outbound initial state
  queued: ['sending', 'sent', 'failed', 'undelivered'],
  
  // Provider request in flight
  sending: ['sent', 'delivered', 'failed', 'undelivered'],
  
  // Dispatched to carrier
  sent: ['delivered', 'failed', 'undelivered'],
  
  // Delivered to customer handset (Terminal positive outbound)
  delivered: [],
  
  // Carrier dispatch or handset delivery failure (Permits retry)
  failed: ['queued', 'sending'],
  
  // Carrier undelivered (Permits retry)
  undelivered: ['queued', 'sending'],
  
  // Inbound customer reply (Terminal inbound)
  received: []
}

/**
 * Ordinal rank for monotonicity checks.
 * Higher rank represents further lifecycle advancement.
 */
export const MESSAGE_STATUS_RANKS: Record<MessageDeliveryStatus, number> = {
  queued: 10,
  sending: 20,
  sent: 30,
  failed: 35,
  undelivered: 35,
  delivered: 40,
  received: 40
}

/**
 * Checks if a message delivery status transition is valid.
 * 
 * @param currentStatus The existing status in the database (or null/undefined for new message)
 * @param targetStatus The requested incoming status (e.g. from a webhook)
 */
export function canTransitionMessageStatus(
  currentStatus: string | null | undefined,
  targetStatus: string | null | undefined
): boolean {
  if (!targetStatus) return false

  // If no existing status is recorded, any recognized status is allowed initially
  if (!currentStatus) {
    return Object.prototype.hasOwnProperty.call(ALLOWED_MESSAGE_TRANSITIONS, targetStatus)
  }

  // Idempotent self-transition is always safe
  if (currentStatus === targetStatus) {
    return true
  }

  const validCurrent = currentStatus as MessageDeliveryStatus
  const validTarget = targetStatus as MessageDeliveryStatus

  const allowedTargets = ALLOWED_MESSAGE_TRANSITIONS[validCurrent]
  if (!allowedTargets) {
    return false
  }

  return allowedTargets.includes(validTarget)
}

/**
 * Validates whether an incoming webhook delivery event should update the database record.
 * Protects against delayed or out-of-order webhook callbacks (e.g. Telnyx `message.sent`
 * arriving after `message.delivered`).
 */
export function shouldUpdateMessageStatus(
  currentStatus: string | null | undefined,
  targetStatus: string | null | undefined
): { allowed: boolean; reason?: string } {
  if (!targetStatus) {
    return { allowed: false, reason: 'Target status is empty' }
  }

  if (!currentStatus) {
    return { allowed: true }
  }

  if (currentStatus === targetStatus) {
    return { allowed: false, reason: `Message already in status '${currentStatus}' (idempotent)` }
  }

  // Out-of-order protection: Delivered must NEVER regress to sent or sending
  if (currentStatus === 'delivered') {
    return {
      allowed: false,
      reason: `Out-of-order webhook discarded: message is already 'delivered', ignoring regression to '${targetStatus}'`
    }
  }

  if (!canTransitionMessageStatus(currentStatus, targetStatus)) {
    return {
      allowed: false,
      reason: `Illegal state transition from '${currentStatus}' to '${targetStatus}'`
    }
  }

  return { allowed: true }
}

/**
 * Checks if a given status represents a terminal state in outbound communication.
 */
export function isTerminalMessageStatus(status: string): boolean {
  return status === 'delivered' || status === 'received'
}
