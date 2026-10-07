import type { SupabaseClient } from '@supabase/supabase-js'
import { createStructuredLogger } from '../observability/logger.ts'

export interface WorkerHealthOptions {
  degradedThresholdSeconds?: number
  unhealthyThresholdSeconds?: number
  staleLockThresholdSeconds?: number
  onAlert?: (alert: WorkerHealthAlert) => Promise<void> | void
}

export interface WorkerHealthAlert {
  status: 'degraded' | 'unhealthy'
  delaySeconds: number
  oldestRunId?: string
  scheduledAt?: string
  overdueCount: number
  stuckLockCount: number
  message: string
}

export interface WorkerHealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  metrics: {
    isProcessing: boolean
    currentDelaySeconds: number
    oldestScheduledRun: {
      id?: string
      orgId?: string
      actionType?: string
      scheduledAt?: string
      expectedExecutionTime?: string
    } | null
    totalOverdueRuns: number
    stuckLockCount: number
    lastCompletedAt: string | null
    thresholds: {
      degradedThresholdSeconds: number
      unhealthyThresholdSeconds: number
    }
  }
  alertsEmitted: boolean
  message: string
}

/**
 * Evaluates whether the automation worker is actively processing scheduled jobs.
 * Calculates backlog latency, detect stuck locks, and triggers operational alerts.
 */
export async function checkWorkerHealth(
  supabase: SupabaseClient,
  options: WorkerHealthOptions = {}
): Promise<WorkerHealthResult> {
  const degradedThreshold = options.degradedThresholdSeconds ?? 120 // 2 minutes
  const unhealthyThreshold = options.unhealthyThresholdSeconds ?? 600 // 10 minutes
  const staleLockThreshold = options.staleLockThresholdSeconds ?? 600 // 10 minutes

  const now = new Date()
  const nowIso = now.toISOString()
  const staleLockCutoff = new Date(now.getTime() - staleLockThreshold * 1000).toISOString()

  const logger = createStructuredLogger({ event_id: 'worker_health_check' })

  // 1. Query oldest overdue scheduled run
  const { data: overdueRuns, error: overdueErr } = await supabase
    .from('automation_runs')
    .select('id, org_id, action_type, scheduled_at, status')
    .in('status', ['pending', 'scheduled'])
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(10)

  // 2. Query potential stuck locked runs (processing/running past stale threshold)
  const { data: activeLockedRuns } = await supabase
    .from('automation_runs')
    .select('id, org_id, locked_at, status')
    .in('status', ['processing', 'running'])
    .lte('locked_at', staleLockCutoff)
    .limit(10)

  // 3. Query last completed run
  const { data: recentCompleted } = await supabase
    .from('automation_runs')
    .select('completed_at')
    .in('status', ['success', 'completed'])
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const oldestRun = overdueRuns && overdueRuns.length > 0 ? overdueRuns[0] : null
  const totalOverdueRuns = overdueRuns?.length || 0
  const stuckLockCount = activeLockedRuns?.length || 0
  const lastCompletedAt = recentCompleted?.completed_at || null

  let currentDelaySeconds = 0
  if (oldestRun && oldestRun.scheduled_at) {
    const scheduledMs = new Date(oldestRun.scheduled_at).getTime()
    currentDelaySeconds = Math.max(0, Math.floor((now.getTime() - scheduledMs) / 1000))
  }

  // 4. Determine Health Status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  let message = 'Automation worker is processing on schedule.'

  if (currentDelaySeconds >= unhealthyThreshold || stuckLockCount > 0) {
    status = 'unhealthy'
    message = stuckLockCount > 0
      ? `Automation worker degraded: ${stuckLockCount} job(s) stuck in running state beyond ${staleLockThreshold}s.`
      : `Automation worker stalled: oldest overdue job #${oldestRun?.id} is delayed by ${currentDelaySeconds}s (threshold: ${unhealthyThreshold}s).`
  } else if (currentDelaySeconds >= degradedThreshold) {
    status = 'degraded'
    message = `Automation worker backlog processing delayed by ${currentDelaySeconds}s (threshold: ${degradedThreshold}s).`
  }

  // 5. Operational Alerting Hook
  let alertsEmitted = false
  if (status !== 'healthy') {
    alertsEmitted = true
    logger.error(`[WORKER HEALTH ALERT] ${message}`, new Error(message), {
      status,
      delaySeconds: currentDelaySeconds,
      oldestRunId: oldestRun?.id,
      scheduledAt: oldestRun?.scheduled_at,
      overdueCount: totalOverdueRuns,
      stuckLockCount
    })

    if (options.onAlert) {
      try {
        await options.onAlert({
          status,
          delaySeconds: currentDelaySeconds,
          oldestRunId: oldestRun?.id,
          scheduledAt: oldestRun?.scheduled_at,
          overdueCount: totalOverdueRuns,
          stuckLockCount,
          message
        })
      } catch (alertErr) {
        console.error('[WORKER HEALTH ALERT CALLBACK ERROR]', alertErr)
      }
    }
  }

  return {
    status,
    timestamp: nowIso,
    metrics: {
      isProcessing: status !== 'unhealthy',
      currentDelaySeconds,
      oldestScheduledRun: oldestRun ? {
        id: oldestRun.id,
        orgId: oldestRun.org_id,
        actionType: oldestRun.action_type,
        scheduledAt: oldestRun.scheduled_at,
        expectedExecutionTime: oldestRun.scheduled_at
      } : null,
      totalOverdueRuns,
      stuckLockCount,
      lastCompletedAt,
      thresholds: {
        degradedThresholdSeconds: degradedThreshold,
        unhealthyThresholdSeconds: unhealthyThreshold
      }
    },
    alertsEmitted,
    message
  }
}
