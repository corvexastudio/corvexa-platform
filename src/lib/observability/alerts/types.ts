/**
 * CaptoDesk Lightweight Observability & Alerting Types (P1-OBS-01)
 * Provider-independent contracts for external production health monitoring and alerting.
 */

export type AlertCategory =
  | 'application_health_failure'
  | 'database_connectivity_failure'
  | 'worker_cron_stale'
  | 'stale_job_backlog'
  | 'repeated_webhook_failures'
  | 'telnyx_provisioning_failure'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface AlertPayload {
  category: AlertCategory
  severity: AlertSeverity
  title: string
  description: string
  dedupKey: string
  metadata?: Record<string, any>
  timestamp?: string
  environment?: string
}

export interface AlertResult {
  sent: boolean
  deduplicated?: boolean
  error?: string
  providerName?: string
}

/**
 * Provider-independent alerting boundary.
 * Allows pluggable dispatchers (Webhook, Slack, Discord, PagerDuty, etc.)
 * without hardcoding CaptoDesk to any single paid vendor.
 */
export interface AlertProvider {
  name: string
  sendAlert(alert: AlertPayload): Promise<boolean>
  sendRecovery?(alert: AlertPayload): Promise<boolean>
}

export interface MonitorThresholds {
  workerStaleSeconds?: number
  jobBacklogDelaySeconds?: number
  webhookFailureThreshold?: number
  staleWebhookProcessingSeconds?: number
  telnyxStuckMinutes?: number
  cooldownSeconds?: number
}
