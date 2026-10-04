/**
 * CaptoDesk SRE Production Observability & Reliability Types
 * Defines data structures for telemetry, structured logs, and platform error states.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface StructuredLogEntry {
  timestamp: string
  level: LogLevel
  message: string
  organization_id?: string | null
  request_id?: string | null
  event_id?: string | null
  automation_run_id?: string | null
  provider_event_id?: string | null
  duration_ms?: number
  status_code?: number
  error?: {
    name?: string
    message: string
    stack?: string
  }
  metadata?: Record<string, any>
}

export interface ApiMetricEntry {
  path: string
  method: string
  statusCode: number
  durationMs: number
  requestId: string
  orgId?: string | null
  error?: string
  timestamp: string
}

export interface ApiTelemetrySummary {
  totalRequests: number
  requestCount: number
  avgLatencyMs: number
  latencyAvgMs: number
  p95LatencyMs: number
  latencyP95Ms: number
  errorCount: number
  errorRate: number
  clientErrors: number
  serverErrors: number
  topFailingEndpoints: Array<{
    endpoint: string
    method: string
    count: number
    lastError: string
    lastSeen: string
  }>
}

export interface WebhookMetricEntry {
  provider: 'telnyx' | 'stripe' | string
  eventType: string
  stage: 'received' | 'verified' | 'rejected' | 'processed' | 'duplicated' | 'failed'
  providerEventId?: string
  requestId?: string
  error?: string
  timestamp: string
}

export interface WebhookTelemetrySummary {
  received: number
  verified: number
  rejected: number
  processed: number
  duplicated: number
  failed: number
}

export interface JobTelemetrySummary {
  queued: number
  running: number
  completed: number
  failed: number
  retried: number
  deadLetter: number
}

export interface MessagingTelemetrySummary {
  sent: number
  delivered: number
  failed: number
  deliveryRate: number
}

export interface AutomationTelemetrySummary {
  triggered: number
  completed: number
  failed: number
  successRate: number
}

export type ErrorSeverity = 'critical' | 'warning' | 'info'

export interface PlatformErrorState {
  id: string
  severity: ErrorSeverity
  category: 'api' | 'webhook' | 'jobs' | 'messaging' | 'automation'
  title: string
  description: string
  count: number
  firstSeen: string
  lastSeen: string
  metadata?: Record<string, any>
}

export interface ObservabilityDashboardData {
  api: ApiTelemetrySummary
  webhooks: WebhookTelemetrySummary
  jobs: JobTelemetrySummary
  messaging: MessagingTelemetrySummary
  automation: AutomationTelemetrySummary
  errorStates: PlatformErrorState[]
  recentLogs: StructuredLogEntry[]
  timestamp: string
}
