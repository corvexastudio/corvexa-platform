/**
 * CaptoDesk Production System Health & Anomaly Monitor (P1-OBS-01)
 * Evaluates core reliability indicators and dispatches alerts / recoveries
 * across Database, Worker, Job Queue, Webhooks, Telnyx Provisioning, and App Health.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { alertManager, AlertManager } from '../alerts/alert-manager.ts'
import type { MonitorThresholds } from '../alerts/types.ts'

export interface SystemHealthReport {
  timestamp: string
  overallHealthy: boolean
  checks: {
    database: { healthy: boolean; error?: string }
    worker: { healthy: boolean; lastCompletedAt: string | null; stale: boolean }
    jobQueue: { healthy: boolean; overdueCount: number; maxDelaySeconds: number; stuckLocks: number }
    webhooks: { healthy: boolean; recentFailedCount: number; stuckProcessingCount: number }
    telnyxProvisioning: { healthy: boolean; failedOrgsCount: number; stuckProvisioningCount: number }
  }
  alertsTriggered: string[]
  recoveriesTriggered: string[]
}

/**
 * Resolves monitoring thresholds from options or server environment variables.
 */
export function getMonitorThresholds(options: MonitorThresholds = {}): Required<MonitorThresholds> {
  const env = process.env
  return {
    workerStaleSeconds: options.workerStaleSeconds
      ?? (env.ALERT_WORKER_STALE_SECONDS ? parseInt(env.ALERT_WORKER_STALE_SECONDS, 10) : 900), // 15 mins
    jobBacklogDelaySeconds: options.jobBacklogDelaySeconds
      ?? (env.ALERT_JOB_BACKLOG_DELAY_SECONDS ? parseInt(env.ALERT_JOB_BACKLOG_DELAY_SECONDS, 10) : 600), // 10 mins
    webhookFailureThreshold: options.webhookFailureThreshold
      ?? (env.ALERT_WEBHOOK_FAILURE_THRESHOLD ? parseInt(env.ALERT_WEBHOOK_FAILURE_THRESHOLD, 10) : 5), // 5 failures
    staleWebhookProcessingSeconds: options.staleWebhookProcessingSeconds
      ?? (env.ALERT_STALE_WEBHOOK_SECONDS ? parseInt(env.ALERT_STALE_WEBHOOK_SECONDS, 10) : 600), // 10 mins
    telnyxStuckMinutes: options.telnyxStuckMinutes
      ?? (env.ALERT_TELNYX_STUCK_MINUTES ? parseInt(env.ALERT_TELNYX_STUCK_MINUTES, 10) : 30), // 30 mins
    cooldownSeconds: options.cooldownSeconds
      ?? (env.ALERT_COOLDOWN_SECONDS ? parseInt(env.ALERT_COOLDOWN_SECONDS, 10) : 1800) // 30 mins
  }
}

/**
 * Evaluates production system health and coordinates alerting and recoveries.
 * Completely safe: never throws an exception that could interrupt business logic.
 */
export async function evaluateSystemHealthAndAlert(
  supabase: SupabaseClient,
  options: {
    thresholds?: MonitorThresholds
    manager?: AlertManager
    dryRun?: boolean
  } = {}
): Promise<SystemHealthReport> {
  const manager = options.manager || alertManager
  const thresholds = getMonitorThresholds(options.thresholds)
  const now = new Date()
  const nowIso = now.toISOString()

  const report: SystemHealthReport = {
    timestamp: nowIso,
    overallHealthy: true,
    checks: {
      database: { healthy: true },
      worker: { healthy: true, lastCompletedAt: null, stale: false },
      jobQueue: { healthy: true, overdueCount: 0, maxDelaySeconds: 0, stuckLocks: 0 },
      webhooks: { healthy: true, recentFailedCount: 0, stuckProcessingCount: 0 },
      telnyxProvisioning: { healthy: true, failedOrgsCount: 0, stuckProvisioningCount: 0 }
    },
    alertsTriggered: [],
    recoveriesTriggered: []
  }

  // ---------------------------------------------------------------------------
  // 1. Database Connectivity Check
  // ---------------------------------------------------------------------------
  try {
    const { error: dbErr } = await supabase.from('organizations').select('id').limit(1)
    if (dbErr) {
      report.checks.database.healthy = false
      report.checks.database.error = dbErr.message
      report.overallHealthy = false

      if (!options.dryRun) {
        await manager.sendAlert({
          category: 'database_connectivity_failure',
          severity: 'critical',
          dedupKey: 'database_connectivity_failure',
          title: 'Database Connectivity Degraded',
          description: `Database query returned error: ${dbErr.message}`,
          metadata: { errorCode: dbErr.code }
        })
        report.alertsTriggered.push('database_connectivity_failure')
      }
    } else {
      if (!options.dryRun && manager.isAlertActive('database_connectivity_failure')) {
        await manager.sendRecovery('database_connectivity_failure', {
          title: 'Database Connectivity Restored',
          description: 'Database query executed successfully.'
        })
        report.recoveriesTriggered.push('database_connectivity_failure')
      }
    }
  } catch (err: any) {
    report.checks.database.healthy = false
    report.checks.database.error = err?.message || 'Database connection threw exception'
    report.overallHealthy = false

    if (!options.dryRun) {
      await manager.sendAlert({
        category: 'database_connectivity_failure',
        severity: 'critical',
        dedupKey: 'database_connectivity_failure',
        title: 'Database Connection Exception',
        description: `Database connection threw: ${err?.message || 'unknown error'}`
      })
      report.alertsTriggered.push('database_connectivity_failure')
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Worker & Job Queue Health Checks
  // ---------------------------------------------------------------------------
  try {
    const staleLockCutoff = new Date(now.getTime() - thresholds.jobBacklogDelaySeconds * 1000).toISOString()

    // 2a. Query overdue scheduled runs
    const { data: overdueRuns } = await supabase
      .from('automation_runs')
      .select('id, org_id, action_type, scheduled_at, status')
      .in('status', ['pending', 'scheduled'])
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(10)

    // 2b. Query stuck locks
    const { data: stuckRuns } = await supabase
      .from('automation_runs')
      .select('id, org_id, locked_at, status')
      .in('status', ['processing', 'running'])
      .lte('locked_at', staleLockCutoff)
      .limit(10)

    // 2c. Query last completed run
    const { data: lastCompleted } = await supabase
      .from('automation_runs')
      .select('completed_at')
      .in('status', ['success', 'completed'])
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const overdueCount = overdueRuns?.length || 0
    const stuckLocks = stuckRuns?.length || 0
    const lastCompletedAt = lastCompleted?.completed_at || null

    report.checks.worker.lastCompletedAt = lastCompletedAt
    report.checks.jobQueue.overdueCount = overdueCount
    report.checks.jobQueue.stuckLocks = stuckLocks

    let maxDelay = 0
    if (overdueRuns && overdueRuns.length > 0 && overdueRuns[0].scheduled_at) {
      const scheduledMs = new Date(overdueRuns[0].scheduled_at).getTime()
      maxDelay = Math.max(0, Math.floor((now.getTime() - scheduledMs) / 1000))
      report.checks.jobQueue.maxDelaySeconds = maxDelay
    }

    // Check worker staleness:
    // If there are overdue runs waiting to be processed AND no run has completed within workerStaleSeconds
    let isWorkerStale = false
    if (overdueCount > 0) {
      if (!lastCompletedAt) {
        // Overdue jobs exist, but worker has never completed any run
        if (maxDelay >= thresholds.workerStaleSeconds) {
          isWorkerStale = true
        }
      } else {
        const completedMs = new Date(lastCompletedAt).getTime()
        const elapsedSinceComplete = Math.floor((now.getTime() - completedMs) / 1000)
        if (elapsedSinceComplete >= thresholds.workerStaleSeconds) {
          isWorkerStale = true
        }
      }
    }

    report.checks.worker.stale = isWorkerStale

    // Worker Stale Alert / Recovery
    if (isWorkerStale) {
      report.checks.worker.healthy = false
      report.overallHealthy = false
      if (!options.dryRun) {
        await manager.sendAlert({
          category: 'worker_cron_stale',
          severity: 'critical',
          dedupKey: 'worker_cron_stale',
          title: 'Automation Worker Stalled',
          description: `Worker has not completed any runs for over ${thresholds.workerStaleSeconds}s while ${overdueCount} job(s) are overdue.`,
          metadata: {
            overdueCount,
            maxDelaySeconds: maxDelay,
            lastCompletedAt
          }
        })
        report.alertsTriggered.push('worker_cron_stale')
      }
    } else {
      if (!options.dryRun && manager.isAlertActive('worker_cron_stale')) {
        await manager.sendRecovery('worker_cron_stale', {
          title: 'Automation Worker Recovered',
          description: 'Worker has resumed processing and jobs are clearing.'
        })
        report.recoveriesTriggered.push('worker_cron_stale')
      }
    }

    // Job Queue Backlog Alert / Recovery
    if (maxDelay >= thresholds.jobBacklogDelaySeconds || stuckLocks > 0) {
      report.checks.jobQueue.healthy = false
      report.overallHealthy = false
      if (!options.dryRun) {
        await manager.sendAlert({
          category: 'stale_job_backlog',
          severity: 'warning',
          dedupKey: 'stale_job_backlog',
          title: 'Stale Automation Job Backlog',
          description: `Overdue job delay is ${maxDelay}s (threshold: ${thresholds.jobBacklogDelaySeconds}s), with ${stuckLocks} stuck lock(s).`,
          metadata: {
            overdueCount,
            maxDelaySeconds: maxDelay,
            stuckLocksCount: stuckLocks
          }
        })
        report.alertsTriggered.push('stale_job_backlog')
      }
    } else {
      if (!options.dryRun && manager.isAlertActive('stale_job_backlog')) {
        await manager.sendRecovery('stale_job_backlog', {
          title: 'Job Backlog Latency Normalized',
          description: 'Automation job queue backlog and locks have normalized.'
        })
        report.recoveriesTriggered.push('stale_job_backlog')
      }
    }
  } catch (err: any) {
    console.error('[SYSTEM_MONITOR_WORKER_CHECK_ERROR]', err?.message)
  }

  // ---------------------------------------------------------------------------
  // 3. Webhook Failures & Stuck Events Check
  // ---------------------------------------------------------------------------
  try {
    const staleWebhookCutoff = new Date(now.getTime() - thresholds.staleWebhookProcessingSeconds * 1000).toISOString()

    // 3a. Recent failed webhooks
    const { data: failedWebhooks } = await supabase
      .from('processed_events')
      .select('id, provider, status')
      .eq('status', 'failed')
      .limit(thresholds.webhookFailureThreshold * 2)

    // 3b. Stuck processing webhooks
    const { data: stuckWebhooks } = await supabase
      .from('processed_events')
      .select('id, provider, status, locked_at')
      .eq('status', 'processing')
      .lte('locked_at', staleWebhookCutoff)
      .limit(10)

    const failedCount = failedWebhooks?.length || 0
    const stuckCount = stuckWebhooks?.length || 0

    report.checks.webhooks.recentFailedCount = failedCount
    report.checks.webhooks.stuckProcessingCount = stuckCount

    if (failedCount >= thresholds.webhookFailureThreshold || stuckCount > 0) {
      report.checks.webhooks.healthy = false
      report.overallHealthy = false
      if (!options.dryRun) {
        await manager.sendAlert({
          category: 'repeated_webhook_failures',
          severity: failedCount >= thresholds.webhookFailureThreshold * 2 ? 'critical' : 'warning',
          dedupKey: 'repeated_webhook_failures',
          title: 'Repeated Webhook Ingestion Failures',
          description: `Detected ${failedCount} failed webhook event(s) and ${stuckCount} stuck in processing beyond ${thresholds.staleWebhookProcessingSeconds}s.`,
          metadata: {
            failedCount,
            stuckCount
          }
        })
        report.alertsTriggered.push('repeated_webhook_failures')
      }
    } else {
      if (!options.dryRun && manager.isAlertActive('repeated_webhook_failures')) {
        await manager.sendRecovery('repeated_webhook_failures', {
          title: 'Webhook Ingestion Restored',
          description: 'Webhook processing errors and stuck events have cleared.'
        })
        report.recoveriesTriggered.push('repeated_webhook_failures')
      }
    }
  } catch (err: any) {
    console.error('[SYSTEM_MONITOR_WEBHOOK_CHECK_ERROR]', err?.message)
  }

  // ---------------------------------------------------------------------------
  // 4. Telnyx Provisioning Failure Check
  // ---------------------------------------------------------------------------
  try {
    const stuckProvisioningCutoff = new Date(now.getTime() - thresholds.telnyxStuckMinutes * 60 * 1000).toISOString()

    // 4a. Organizations marked as failed
    const { data: failedOrgs } = await supabase
      .from('organizations')
      .select('id, phone_provisioning_status')
      .eq('phone_provisioning_status', 'failed')
      .limit(10)

    // 4b. Organizations stuck in 'provisioning'
    const { data: stuckOrgs } = await supabase
      .from('organizations')
      .select('id, phone_provisioning_status, updated_at')
      .eq('phone_provisioning_status', 'provisioning')
      .lte('updated_at', stuckProvisioningCutoff)
      .limit(10)

    const failedOrgsCount = failedOrgs?.length || 0
    const stuckOrgsCount = stuckOrgs?.length || 0

    report.checks.telnyxProvisioning.failedOrgsCount = failedOrgsCount
    report.checks.telnyxProvisioning.stuckProvisioningCount = stuckOrgsCount

    if (failedOrgsCount > 0 || stuckOrgsCount > 0) {
      report.checks.telnyxProvisioning.healthy = false
      report.overallHealthy = false
      if (!options.dryRun) {
        await manager.sendAlert({
          category: 'telnyx_provisioning_failure',
          severity: failedOrgsCount > 0 ? 'critical' : 'warning',
          dedupKey: 'telnyx_provisioning_failure',
          title: 'Telnyx DID Provisioning Issues Detected',
          description: `Found ${failedOrgsCount} organization(s) with failed phone provisioning and ${stuckOrgsCount} stuck in provisioning beyond ${thresholds.telnyxStuckMinutes}m.`,
          metadata: {
            failedOrgsCount,
            stuckOrgsCount
          }
        })
        report.alertsTriggered.push('telnyx_provisioning_failure')
      }
    } else {
      if (!options.dryRun && manager.isAlertActive('telnyx_provisioning_failure')) {
        await manager.sendRecovery('telnyx_provisioning_failure', {
          title: 'Telnyx DID Provisioning Resolved',
          description: 'No organizations are currently stuck or in failed provisioning states.'
        })
        report.recoveriesTriggered.push('telnyx_provisioning_failure')
      }
    }
  } catch (err: any) {
    console.error('[SYSTEM_MONITOR_TELNYX_CHECK_ERROR]', err?.message)
  }

  return report
}
