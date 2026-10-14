/**
 * CaptoDesk Alert Deduplication & Storm Protection (P1-OBS-01)
 * Enforces deterministic alert keys, cooldown windows, and recovery tracking.
 */

import type { AlertPayload } from './types.ts'

interface ActiveAlertRecord {
  dedupKey: string
  firstSeenAt: number
  lastSentAt: number
  sendCount: number
  payload: AlertPayload
}

export class AlertDeduplicator {
  private activeAlerts = new Map<string, ActiveAlertRecord>()
  private defaultCooldownMs: number

  constructor(defaultCooldownSeconds = 1800) {
    this.defaultCooldownMs = defaultCooldownSeconds * 1000
  }

  /**
   * Evaluates whether an alert should be sent or suppressed by cooldown.
   * Returns:
   * - { shouldSend: true, isNew: boolean } if alert should be dispatched
   * - { shouldSend: false, reason: 'cooldown' } if duplicate in cooldown
   */
  evaluate(
    alert: AlertPayload,
    customCooldownSeconds?: number
  ): { shouldSend: boolean; isNew: boolean; reason?: string } {
    const key = alert.dedupKey
    const now = Date.now()
    const cooldownMs = customCooldownSeconds ? customCooldownSeconds * 1000 : this.defaultCooldownMs

    const existing = this.activeAlerts.get(key)

    if (!existing) {
      // First time seeing this active alert
      return { shouldSend: true, isNew: true }
    }

    const elapsed = now - existing.lastSentAt

    if (elapsed < cooldownMs) {
      // Still in cooldown period -> suppress to prevent alert storms
      return {
        shouldSend: false,
        isNew: false,
        reason: `Suppressed by cooldown. Last sent ${Math.round(elapsed / 1000)}s ago (cooldown: ${Math.round(cooldownMs / 1000)}s)`
      }
    }

    // Cooldown elapsed -> allow repeat notification
    return { shouldSend: true, isNew: false }
  }

  /**
   * Records that an alert was dispatched.
   */
  recordSent(alert: AlertPayload): void {
    const key = alert.dedupKey
    const now = Date.now()
    const existing = this.activeAlerts.get(key)

    if (existing) {
      existing.lastSentAt = now
      existing.sendCount += 1
      existing.payload = alert
    } else {
      this.activeAlerts.set(key, {
        dedupKey: key,
        firstSeenAt: now,
        lastSentAt: now,
        sendCount: 1,
        payload: alert
      })
    }
  }

  /**
   * Checks if an alert key is currently considered active.
   */
  isActive(key: string): boolean {
    return this.activeAlerts.has(key)
  }

  /**
   * Clears an active alert upon recovery and returns the previous record (if any)
   * so a recovery notification can be dispatched.
   */
  resolve(key: string): AlertPayload | null {
    const existing = this.activeAlerts.get(key)
    if (existing) {
      this.activeAlerts.delete(key)
      return existing.payload
    }
    return null
  }

  /**
   * Returns list of currently active alert keys.
   */
  getActiveKeys(): string[] {
    return Array.from(this.activeAlerts.keys())
  }

  /**
   * Resets all internal deduplication state (useful for unit tests).
   */
  reset(): void {
    this.activeAlerts.clear()
  }
}
