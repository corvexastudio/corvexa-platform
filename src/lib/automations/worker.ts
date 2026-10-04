import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAction, type ActionResult } from './action-registry.ts'
import { telemetryStore } from '../observability/telemetry-store.ts'
import { createStructuredLogger } from '../observability/logger.ts'

export interface AutomationRunRecord {
  id: string
  job_id: string
  org_id: string
  rule_id: string
  status: 'pending' | 'scheduled' | 'running' | 'success' | 'failed' | 'cancelled' | 'dead_letter'
  action_type: string
  action_params: Record<string, any>
  event_type: string
  event_payload: Record<string, any>
  retry_count: number
  max_retries: number
  scheduled_at: string
  started_at?: string | null
  completed_at?: string | null
  failure_reason?: string | null
  execution_log?: any[]
}

/**
 * Calculates exponential backoff delay with jitter
 * delay = baseDelay * 2^retryCount + jitter
 */
export function calculateNextRetry(retryCount: number, baseDelaySeconds = 60): Date {
  const exponent = Math.min(retryCount, 6) // Cap exponential growth at 2^6 (64x)
  const backoff = baseDelaySeconds * Math.pow(2, exponent)
  const jitter = Math.floor(Math.random() * 15) // 0-15s jitter to avoid thundering herd
  const totalSeconds = backoff + jitter
  return new Date(Date.now() + totalSeconds * 1000)
}

/**
 * Executes a single automation job record through the worker lifecycle
 */
export async function executeAutomationJob(
  supabase: SupabaseClient,
  job: AutomationRunRecord
): Promise<ActionResult> {
  // 1. Guard against executing cancelled, succeeded, or dead-letter jobs
  if (job.status === 'cancelled' || job.status === 'success' || job.status === 'dead_letter') {
    return {
      success: false,
      actionType: job.action_type,
      error: `Job ${job.job_id} is in non-executable state '${job.status}'`
    }
  }

  const nowIso = new Date().toISOString()
  const logger = createStructuredLogger({
    organization_id: job.org_id,
    automation_run_id: job.id,
    event_id: job.event_payload?.eventId || job.job_id
  })

  // 2. Mark job as running
  telemetryStore.recordJobTransition('running')
  await supabase
    .from('automation_runs')
    .update({
      status: 'running',
      started_at: nowIso
    })
    .eq('id', job.id)

  const payload = job.event_payload || {}
  const actionContext = {
    supabase,
    orgId: job.org_id,
    ruleId: job.rule_id,
    entityId: payload.entityId || payload.lead_id || payload.id,
    contactId: payload.contactId || payload.contact_id,
    leadId: payload.leadId || payload.lead_id,
    eventPayload: payload
  }

  // 3. Execute the registered action
  const result = await executeAction(job.action_type, job.action_params || {}, actionContext)

  const executionLogEntry = {
    executed_at: nowIso,
    action_type: job.action_type,
    success: result.success,
    data: result.data,
    error: result.error,
    retry_count: job.retry_count
  }

  const updatedLogs = Array.isArray(job.execution_log)
    ? [...job.execution_log, executionLogEntry]
    : [executionLogEntry]

  if (result.success) {
    // 4. Job Succeeded
    telemetryStore.recordJobTransition('completed')
    telemetryStore.recordAutomation('completed')
    logger.info(`Automation job ${job.job_id} succeeded`, {
      action_type: job.action_type,
      duration_ms: Date.now() - new Date(nowIso).getTime()
    })

    await supabase
      .from('automation_runs')
      .update({
        status: 'success',
        completed_at: new Date().toISOString(),
        failure_reason: null,
        execution_log: updatedLogs
      })
      .eq('id', job.id)

    return result
  }

  // 5. Job Failed - Evaluate Retry vs Dead-Letter
  telemetryStore.recordJobTransition('failed')
  telemetryStore.recordAutomation('failed')
  const nextRetryCount = job.retry_count + 1
  const maxRetries = job.max_retries || 3

  if (nextRetryCount >= maxRetries) {
    // Max retries exceeded: Transition to Dead-Letter Queue
    telemetryStore.recordJobTransition('deadLetter')
    const deadLetterReason = `Max retries (${maxRetries}) exhausted. Final error: ${result.error || 'Unknown failure'}`
    logger.error(`Automation job ${job.job_id} permanently failed -> Dead Letter Queue`, new Error(deadLetterReason), {
      action_type: job.action_type,
      retry_count: nextRetryCount
    })
    
    await supabase
      .from('automation_runs')
      .update({
        status: 'dead_letter',
        completed_at: new Date().toISOString(),
        retry_count: nextRetryCount,
        failure_reason: deadLetterReason,
        execution_log: updatedLogs
      })
      .eq('id', job.id)

    return {
      ...result,
      error: deadLetterReason
    }
  }

  // Schedule next retry with exponential backoff
  telemetryStore.recordJobTransition('retried')
  const nextScheduledAt = calculateNextRetry(job.retry_count).toISOString()
  logger.warn(`Automation job ${job.job_id} transient failure, retry scheduled`, {
    action_type: job.action_type,
    retry_count: nextRetryCount,
    nextScheduledAt
  })
  
  await supabase
    .from('automation_runs')
    .update({
      status: 'pending',
      retry_count: nextRetryCount,
      scheduled_at: nextScheduledAt,
      failure_reason: `Transient failure (attempt ${nextRetryCount}/${maxRetries}): ${result.error}`,
      execution_log: updatedLogs
    })
    .eq('id', job.id)

  return result
}

/**
 * Polls and processes all pending or scheduled automation runs whose scheduled_at has arrived
 */
export async function processDueAutomationJobs(
  supabase: SupabaseClient,
  batchSize = 25
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const now = new Date().toISOString()

  const { data: dueJobs, error } = await supabase
    .from('automation_runs')
    .select('*')
    .in('status', ['pending', 'scheduled'])
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(batchSize)

  if (error || !dueJobs || dueJobs.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  let succeeded = 0
  let failed = 0

  for (const job of dueJobs) {
    try {
      const res = await executeAutomationJob(supabase, job as AutomationRunRecord)
      if (res.success) {
        succeeded++
      } else {
        failed++
      }
    } catch (err) {
      console.error(`[AUTOMATION WORKER ERROR] Job ${job.id} exception:`, err)
      failed++
    }
  }

  return {
    processed: dueJobs.length,
    succeeded,
    failed
  }
}
