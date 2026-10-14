/**
 * CaptoDesk Alert Manager (P1-OBS-01)
 * Provider-independent coordinator for deduplication, cooldowns, and safe dispatch.
 */

import type { AlertPayload, AlertProvider, AlertResult } from './types.ts'
import { AlertDeduplicator } from './dedup.ts'
import { WebhookAlertProvider } from './providers/webhook-provider.ts'
import { redactSensitiveData } from '../redactor.ts'

export interface AlertManagerOptions {
  providers?: AlertProvider[]
  deduplicator?: AlertDeduplicator
  defaultCooldownSeconds?: number
  enabled?: boolean
}

export class AlertManager {
  private providers: AlertProvider[] = []
  private deduplicator: AlertDeduplicator
  private isEnabled: boolean

  constructor(options: AlertManagerOptions = {}) {
    this.deduplicator = options.deduplicator || new AlertDeduplicator(options.defaultCooldownSeconds ?? 1800)
    this.isEnabled = options.enabled ?? (process.env.ALERT_ENABLED !== 'false')

    if (options.providers && options.providers.length > 0) {
      this.providers = [...options.providers]
    } else if (process.env.ALERT_WEBHOOK_URL) {
      this.providers.push(new WebhookAlertProvider())
    }
  }

  /**
   * Registers an additional alert provider.
   */
  registerProvider(provider: AlertProvider): void {
    this.providers.push(provider)
  }

  /**
   * Replaces all registered providers (useful in test mocking).
   */
  setProviders(providers: AlertProvider[]): void {
    this.providers = [...providers]
  }

  /**
   * Sanitizes payload before passing to providers
   */
  private sanitizePayload(alert: AlertPayload): AlertPayload {
    return {
      ...alert,
      metadata: alert.metadata ? redactSensitiveData(alert.metadata) : undefined
    }
  }

  /**
   * Dispatches an alert with deduplication and storm protection.
   * Completely isolated: NEVER throws, even if providers fail.
   */
  async sendAlert(
    alert: AlertPayload,
    options: { customCooldownSeconds?: number; force?: boolean } = {}
  ): Promise<AlertResult> {
    if (!this.isEnabled) {
      return { sent: false, deduplicated: false }
    }

    if (!options.force) {
      const evalResult = this.deduplicator.evaluate(alert, options.customCooldownSeconds)
      if (!evalResult.shouldSend) {
        return {
          sent: false,
          deduplicated: true
        }
      }
    }

    const sanitized = this.sanitizePayload(alert)

    if (this.providers.length === 0) {
      // Missing alert configuration must NOT cause operations to fail
      this.deduplicator.recordSent(sanitized)
      return { sent: false, deduplicated: false }
    }

    let anySent = false
    let lastError: string | undefined

    for (const provider of this.providers) {
      try {
        const ok = await provider.sendAlert(sanitized)
        if (ok) {
          anySent = true
        }
      } catch (err: any) {
        lastError = err?.message || String(err)
        console.error(`[ALERT_DISPATCH_PROVIDER_ERROR] Provider ${provider.name} failed:`, lastError)
      }
    }

    this.deduplicator.recordSent(sanitized)

    return {
      sent: anySent,
      deduplicated: false,
      error: lastError
    }
  }

  /**
   * Emits a recovery notification if the alert was previously active,
   * then clears the active alert state.
   */
  async sendRecovery(
    dedupKey: string,
    overridePayload?: Partial<AlertPayload>
  ): Promise<AlertResult> {
    if (!this.isEnabled) {
      return { sent: false }
    }

    const priorAlert = this.deduplicator.resolve(dedupKey)
    if (!priorAlert) {
      // Alert was not active; no recovery needed
      return { sent: false }
    }

    const title = overridePayload?.title
      ? (overridePayload.title.startsWith('[RECOVERED]') ? overridePayload.title : `[RECOVERED] ${overridePayload.title}`)
      : `[RECOVERED] ${priorAlert.title}`

    const recoveryAlert: AlertPayload = {
      ...priorAlert,
      ...overridePayload,
      dedupKey,
      severity: 'info',
      title,
      timestamp: new Date().toISOString()
    }

    const sanitized = this.sanitizePayload(recoveryAlert)

    if (this.providers.length === 0) {
      return { sent: false }
    }

    let anySent = false
    for (const provider of this.providers) {
      try {
        if (typeof provider.sendRecovery === 'function') {
          const ok = await provider.sendRecovery(sanitized)
          if (ok) anySent = true
        } else {
          // Fall back to sendAlert marked as recovery
          const ok = await provider.sendAlert({
            ...sanitized,
            title: `[RECOVERED] ${sanitized.title}`
          })
          if (ok) anySent = true
        }
      } catch (err) {
        console.error(`[ALERT_RECOVERY_PROVIDER_ERROR] Provider ${provider.name} failed:`, err)
      }
    }

    return { sent: anySent }
  }

  /**
   * Inspects deduplication status of a key.
   */
  isAlertActive(key: string): boolean {
    return this.deduplicator.isActive(key)
  }

  /**
   * Resets all providers and deduplication state (useful for tests).
   */
  reset(): void {
    this.deduplicator.reset()
    this.providers = []
    if (process.env.ALERT_WEBHOOK_URL) {
      this.providers.push(new WebhookAlertProvider())
    }
  }
}

// Global shared singleton for the application
export const alertManager = new AlertManager()
