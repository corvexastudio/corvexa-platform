/**
 * CaptoDesk Telemetry Store & Real-Time Aggregator
 * Gathers and summarizes metrics across API, Webhooks, Background Jobs, Messaging, and Automations.
 * Evaluates operational thresholds to surface active error states to platform administrators.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type ApiMetricEntry,
  type ApiTelemetrySummary,
  type WebhookMetricEntry,
  type WebhookTelemetrySummary,
  type JobTelemetrySummary,
  type MessagingTelemetrySummary,
  type AutomationTelemetrySummary,
  type PlatformErrorState,
  type ObservabilityDashboardData
} from './types.ts'
import { getRecentStructuredLogs } from './logger.ts'

class TelemetryStore {
  // In-memory sliding windows
  private apiMetrics: ApiMetricEntry[] = []
  private webhookMetrics: WebhookMetricEntry[] = []

  // Dynamic in-memory counters
  private webhookCounts = {
    received: 0,
    verified: 0,
    rejected: 0,
    processed: 0,
    duplicated: 0,
    failed: 0
  }

  private automationCounts = {
    triggered: 0,
    completed: 0,
    failed: 0
  }

  private messagingCounts = {
    sent: 0,
    delivered: 0,
    failed: 0
  }

  private jobCounts = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    retried: 0,
    deadLetter: 0
  }

  /**
   * Records an API request completion
   */
  recordApiRequest(entry: Omit<ApiMetricEntry, 'timestamp'>): void {
    const fullEntry: ApiMetricEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    }
    this.apiMetrics.unshift(fullEntry)
    // Keep last 1,000 requests in sliding window
    if (this.apiMetrics.length > 1000) {
      this.apiMetrics.pop()
    }
  }

  /**
   * Records a webhook lifecycle transition
   */
  recordWebhook(entry: Omit<WebhookMetricEntry, 'timestamp'>): void {
    const fullEntry: WebhookMetricEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    }
    this.webhookMetrics.unshift(fullEntry)
    if (this.webhookMetrics.length > 500) {
      this.webhookMetrics.pop()
    }

    if (entry.stage in this.webhookCounts) {
      this.webhookCounts[entry.stage]++
    }
  }

  /**
   * Helper alias to record webhook stage
   */
  recordWebhookStage(
    stage: keyof typeof this.webhookCounts,
    meta?: Partial<Omit<WebhookMetricEntry, 'stage' | 'timestamp'>>
  ): void {
    this.recordWebhook({
      provider: meta?.provider || 'generic',
      eventType: meta?.eventType || 'event',
      stage,
      ...meta
    })
  }

  /**
   * Records a background job transition
   */
  recordJobTransition(stage: keyof typeof this.jobCounts): void {
    if (stage in this.jobCounts) {
      this.jobCounts[stage]++
    }
  }

  /**
   * Helper alias to record background job state
   */
  recordJob(stage: keyof typeof this.jobCounts): void {
    this.recordJobTransition(stage)
  }

  /**
   * Records messaging event
   */
  recordMessaging(status: 'sent' | 'delivered' | 'failed'): void {
    if (status in this.messagingCounts) {
      this.messagingCounts[status]++
    }
  }

  /**
   * Records automation outcome
   */
  recordAutomation(stage: 'triggered' | 'completed' | 'failed'): void {
    if (stage in this.automationCounts) {
      this.automationCounts[stage]++
    }
  }

  /**
   * Returns current webhook telemetry summary
   */
  getWebhookSummary(): WebhookTelemetrySummary {
    return { ...this.webhookCounts }
  }

  /**
   * Returns current job telemetry summary
   */
  getJobSummary(): JobTelemetrySummary {
    return { ...this.jobCounts }
  }

  /**
   * Returns current messaging telemetry summary
   */
  getMessagingSummary(): MessagingTelemetrySummary {
    const totalOutcomes = this.messagingCounts.delivered + this.messagingCounts.failed
    const deliveryRate = totalOutcomes > 0
      ? Math.round((this.messagingCounts.delivered / totalOutcomes) * 100)
      : 100

    return {
      ...this.messagingCounts,
      deliveryRate
    }
  }

  /**
   * Returns current automation telemetry summary
   */
  getAutomationSummary(): AutomationTelemetrySummary {
    const total = this.automationCounts.triggered + this.automationCounts.completed + this.automationCounts.failed
    const successRate = total > 0
      ? Math.round((this.automationCounts.completed / (this.automationCounts.completed + this.automationCounts.failed || 1)) * 100)
      : 100

    return {
      ...this.automationCounts,
      successRate
    }
  }

  /**
   * Computes API metrics summary
   */
  getApiSummary(): ApiTelemetrySummary {
    const total = this.apiMetrics.length
    if (total === 0) {
      return {
        totalRequests: 0,
        requestCount: 0,
        avgLatencyMs: 0,
        latencyAvgMs: 0,
        p95LatencyMs: 0,
        latencyP95Ms: 0,
        errorCount: 0,
        errorRate: 0,
        clientErrors: 0,
        serverErrors: 0,
        topFailingEndpoints: []
      }
    }

    let sumLatency = 0
    let errorCount = 0
    let clientErrors = 0
    let serverErrors = 0
    const latencies: number[] = []
    const endpointFailures: Record<string, { count: number; method: string; lastError: string; lastSeen: string }> = {}

    for (const m of this.apiMetrics) {
      sumLatency += m.durationMs
      latencies.push(m.durationMs)
      if (m.statusCode >= 400) {
        errorCount++
        if (m.statusCode >= 500) {
          serverErrors++
        } else {
          clientErrors++
        }
        const key = `${m.method} ${m.path}`
        if (!endpointFailures[key]) {
          endpointFailures[key] = {
            count: 0,
            method: m.method,
            lastError: m.error || `HTTP ${m.statusCode}`,
            lastSeen: m.timestamp
          }
        }
        endpointFailures[key].count++
      }
    }

    latencies.sort((a, b) => a - b)
    const p95Idx = Math.floor(latencies.length * 0.95)
    const p95LatencyMs = latencies[p95Idx] || latencies[latencies.length - 1] || 0
    const avgLatencyMs = Math.round(sumLatency / total)
    const errorRate = Math.round((errorCount / total) * 100)

    const topFailingEndpoints = Object.entries(endpointFailures)
      .map(([endpoint, data]) => ({
        endpoint,
        method: data.method,
        count: data.count,
        lastError: data.lastError,
        lastSeen: data.lastSeen
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalRequests: total,
      requestCount: total,
      avgLatencyMs,
      latencyAvgMs: avgLatencyMs,
      p95LatencyMs: Math.round(p95LatencyMs),
      latencyP95Ms: Math.round(p95LatencyMs),
      errorCount,
      errorRate,
      clientErrors,
      serverErrors,
      topFailingEndpoints
    }
  }

  /**
   * Aggregates authoritative metrics from both memory and Supabase
   */
  async getDashboardData(supabase: SupabaseClient): Promise<ObservabilityDashboardData> {
    const apiSummary = this.getApiSummary()

    // 1. Authoritative Webhook Counts (combines memory with processed_events)
    let webhookSummary: WebhookTelemetrySummary = { ...this.webhookCounts }
    try {
      const { count: processedCount } = await supabase
        .from('processed_events')
        .select('*', { count: 'exact', head: true })
      if (processedCount !== null && processedCount !== undefined) {
        webhookSummary.processed = Math.max(webhookSummary.processed, processedCount)
        webhookSummary.received = Math.max(webhookSummary.received, webhookSummary.processed + webhookSummary.rejected)
      }
    } catch {
      // Fall back to in-memory counts
    }

    // 2. Authoritative Job & Queue Counts from automation_runs
    let jobSummary: JobTelemetrySummary = { ...this.jobCounts }
    try {
      const { data: runs } = await supabase
        .from('automation_runs')
        .select('id, status, retry_count')
      if (runs) {
        const queued = runs.filter((r) => r.status === 'pending' || r.status === 'scheduled').length
        const running = runs.filter((r) => r.status === 'running').length
        const completed = runs.filter((r) => r.status === 'success' || r.status === 'completed').length
        const failed = runs.filter((r) => r.status === 'failed').length
        const retried = runs.filter((r) => (r.retry_count ?? 0) > 0).length
        const deadLetter = runs.filter((r) => r.status === 'dead_letter').length

        jobSummary = {
          queued: Math.max(jobSummary.queued, queued),
          running: Math.max(jobSummary.running, running),
          completed: Math.max(jobSummary.completed, completed),
          failed: Math.max(jobSummary.failed, failed),
          retried: Math.max(jobSummary.retried, retried),
          deadLetter: Math.max(jobSummary.deadLetter, deadLetter)
        }
      }
    } catch {
      // Use in-memory
    }

    // 3. Authoritative Messaging Pipeline from messages table
    let messagingSummary: MessagingTelemetrySummary = {
      sent: this.messagingCounts.sent,
      delivered: this.messagingCounts.delivered,
      failed: this.messagingCounts.failed,
      deliveryRate: 100
    }
    try {
      let msgsData: any[] = []
      const { data: delivData, error: delivErr } = await supabase
        .from('messages')
        .select('delivery_status')
      if (!delivErr && delivData) {
        msgsData = delivData
      } else {
        const { data: statusData } = await supabase.from('messages').select('status')
        msgsData = statusData || []
      }

      if (msgsData.length > 0) {
        const sent = msgsData.filter((m) => (m.delivery_status || m.status) === 'sent').length
        const delivered = msgsData.filter((m) => (m.delivery_status || m.status) === 'delivered').length
        const failed = msgsData.filter((m) => ['failed', 'undelivered'].includes(m.delivery_status || m.status)).length

        messagingSummary.sent = Math.max(messagingSummary.sent, sent)
        messagingSummary.delivered = Math.max(messagingSummary.delivered, delivered)
        messagingSummary.failed = Math.max(messagingSummary.failed, failed)
      }
    } catch {
      // Fallback
    }

    const totalOutcomes = messagingSummary.delivered + messagingSummary.failed
    messagingSummary.deliveryRate = totalOutcomes > 0
      ? Math.round((messagingSummary.delivered / totalOutcomes) * 100)
      : 100

    // 4. Automation Summary
    const totalAutomation = this.automationCounts.triggered + this.automationCounts.completed + this.automationCounts.failed
    const automationSummary: AutomationTelemetrySummary = {
      triggered: this.automationCounts.triggered,
      completed: this.automationCounts.completed,
      failed: this.automationCounts.failed,
      successRate: totalAutomation > 0
        ? Math.round((this.automationCounts.completed / (this.automationCounts.completed + this.automationCounts.failed || 1)) * 100)
        : 100
    }

    // 5. Derive Active Platform Error States
    const errorStates: PlatformErrorState[] = []
    const nowIso = new Date().toISOString()

    // Error State 1: High API Failure Rate
    if (apiSummary.totalRequests >= 2 && apiSummary.errorRate >= 10) {
      errorStates.push({
        id: 'err_api_elevated_error_rate',
        severity: apiSummary.errorRate >= 25 ? 'critical' : 'warning',
        category: 'api',
        title: 'Elevated API Error Rate',
        description: `API error rate is ${apiSummary.errorRate}% across ${apiSummary.totalRequests} recent requests.`,
        count: apiSummary.errorCount,
        firstSeen: nowIso,
        lastSeen: nowIso,
        metadata: { topFailingEndpoints: apiSummary.topFailingEndpoints }
      })
    }

    // Error State 2: Rejected Webhooks (Signature verification failures / attacks)
    if (webhookSummary.rejected > 0) {
      errorStates.push({
        id: 'err_webhook_rejected_signatures',
        severity: 'warning',
        category: 'webhook',
        title: 'Rejected Inbound Webhooks',
        description: `${webhookSummary.rejected} webhook request(s) were rejected due to invalid cryptographic signatures.`,
        count: webhookSummary.rejected,
        firstSeen: nowIso,
        lastSeen: nowIso
      })
    }

    // Error State 3: Permanently Failed Background Jobs (Dead Letters)
    if (jobSummary.deadLetter > 0) {
      errorStates.push({
        id: 'err_jobs_dead_letter',
        severity: 'critical',
        category: 'jobs',
        title: 'Permanently Failed Background Jobs',
        description: `${jobSummary.deadLetter} background job(s) exhausted all retries and are currently in the Dead Letter Queue.`,
        count: jobSummary.deadLetter,
        firstSeen: nowIso,
        lastSeen: nowIso
      })
    }

    // Error State 4: Carrier Messaging Delivery Failures
    if (messagingSummary.failed > 3 || (totalOutcomes >= 5 && messagingSummary.deliveryRate < 85)) {
      errorStates.push({
        id: 'err_messaging_delivery_drop',
        severity: messagingSummary.deliveryRate < 70 ? 'critical' : 'warning',
        category: 'messaging',
        title: 'Carrier SMS Delivery Failures',
        description: `${messagingSummary.failed} outbound SMS failed carrier delivery. Delivery rate is ${messagingSummary.deliveryRate}%.`,
        count: messagingSummary.failed,
        firstSeen: nowIso,
        lastSeen: nowIso
      })
    }

    // Error State 5: Automation Failures
    if (automationSummary.failed > 0) {
      errorStates.push({
        id: 'err_automation_execution_failures',
        severity: 'warning',
        category: 'automation',
        title: 'Automation Execution Failures',
        description: `${automationSummary.failed} automation rule action(s) failed execution.`,
        count: automationSummary.failed,
        firstSeen: nowIso,
        lastSeen: nowIso
      })
    }

    return {
      api: apiSummary,
      webhooks: webhookSummary,
      jobs: jobSummary,
      messaging: messagingSummary,
      automation: automationSummary,
      errorStates,
      recentLogs: getRecentStructuredLogs({ limit: 50 }),
      timestamp: nowIso
    }
  }

  /**
   * Resets in-memory counters (useful for unit testing)
   */
  reset(): void {
    this.apiMetrics = []
    this.webhookMetrics = []
    this.webhookCounts = { received: 0, verified: 0, rejected: 0, processed: 0, duplicated: 0, failed: 0 }
    this.automationCounts = { triggered: 0, completed: 0, failed: 0 }
    this.messagingCounts = { sent: 0, delivered: 0, failed: 0 }
    this.jobCounts = { queued: 0, running: 0, completed: 0, failed: 0, retried: 0, deadLetter: 0 }
  }
}

export const telemetryStore = new TelemetryStore()
