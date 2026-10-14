/**
 * CaptoDesk Lightweight Webhook Alert Provider (P1-OBS-01)
 * Safely dispatches alerts and recovery notifications to a server-configured webhook destination.
 */

import type { AlertProvider, AlertPayload } from '../types.ts'
import { redactSensitiveData } from '../../redactor.ts'

export interface WebhookAlertProviderOptions {
  webhookUrl?: string
  timeoutMs?: number
  fetchFn?: typeof fetch
}

/**
 * Validates the safety and schema of a webhook URL to prevent SSRF vulnerabilities.
 */
export function isValidAlertWebhookUrl(urlStr: string, isProduction = false): boolean {
  try {
    const parsed = new URL(urlStr)

    // In production, strictly enforce HTTPS
    if (isProduction && parsed.protocol !== 'https:') {
      return false
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }

    // Guard against local / internal network SSRF in production
    if (isProduction) {
      const hostname = parsed.hostname.toLowerCase()
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.local') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
      ) {
        return false
      }
    }

    return true
  } catch {
    return false
  }
}

export class WebhookAlertProvider implements AlertProvider {
  public readonly name = 'webhook'
  private webhookUrl?: string
  private timeoutMs: number
  private fetchFn: typeof fetch

  constructor(options: WebhookAlertProviderOptions = {}) {
    this.webhookUrl = options.webhookUrl || process.env.ALERT_WEBHOOK_URL
    this.timeoutMs = options.timeoutMs || 5000
    this.fetchFn = options.fetchFn || globalThis.fetch
  }

  private isProductionEnvironment(): boolean {
    const tier = (process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase()
    return tier === 'production' || tier === 'prod'
  }

  /**
   * Sanitizes alert payload to guarantee zero PII or secret leakage
   */
  private formatPayload(alert: AlertPayload, isRecovery = false): Record<string, any> {
    const sanitizedMetadata = alert.metadata ? redactSensitiveData(alert.metadata) : undefined

    return {
      type: isRecovery ? 'ALERT_RECOVERY' : 'ALERT_TRIGGERED',
      category: alert.category,
      severity: isRecovery ? 'info' : alert.severity,
      title: isRecovery ? `[RECOVERED] ${alert.title}` : alert.title,
      description: isRecovery
        ? `Condition resolved: ${alert.description}`
        : alert.description,
      dedupKey: alert.dedupKey,
      timestamp: alert.timestamp || new Date().toISOString(),
      environment: alert.environment || process.env.APP_ENV || process.env.NODE_ENV || 'production',
      metadata: sanitizedMetadata
    }
  }

  /**
   * Dispatches an alert to the configured webhook endpoint.
   * Completely isolated: never throws to caller.
   */
  async sendAlert(alert: AlertPayload): Promise<boolean> {
    return this.dispatch(this.formatPayload(alert, false))
  }

  /**
   * Dispatches a recovery notification when an alert condition clears.
   */
  async sendRecovery(alert: AlertPayload): Promise<boolean> {
    return this.dispatch(this.formatPayload(alert, true))
  }

  private async dispatch(payload: Record<string, any>): Promise<boolean> {
    if (!this.webhookUrl || !this.webhookUrl.trim()) {
      // No destination configured; safe no-op
      return false
    }

    const isProd = this.isProductionEnvironment()
    if (!isValidAlertWebhookUrl(this.webhookUrl, isProd)) {
      console.warn('[ALERT_PROVIDER_WARNING] Invalid or forbidden ALERT_WEBHOOK_URL rejected by security guard')
      return false
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await this.fetchFn(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CaptoDesk-Alerting/1.0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      clearTimeout(timer)
      return response.ok
    } catch (err: any) {
      clearTimeout(timer)
      // Failure isolation: never throw to callers or disrupt application flow
      console.error('[ALERT_DISPATCH_ERROR] Failed to dispatch webhook alert:', err?.message || err)
      return false
    }
  }
}
