import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAction, type ActionResult } from './action-registry.ts'
import { telemetryStore } from '../observability/telemetry-store.ts'
import { createStructuredLogger } from '../observability/logger.ts'
import { evaluateStaleLockRecovery, canTransition } from './state-machine.ts'

export interface AutomationRunRecord {
  id: string
  job_id: string
  org_id: string
  rule_id: string
  status: 'pending' | 'scheduled' | 'processing' | 'running' | 'success' | 'failed' | 'cancelled' | 'dead_letter'
  action_type: string
  action_params: Record<string, any>
  event_type: string
  event_payload: Record<string, any>
  retry_count: number
  max_retries: number
  scheduled_at: string
  started_at?: string | null
  completed_at?: string | null
  locked_at?: string | null
  locked_by?: string | null
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
      error: `Job ${job.job_id} is in non-executable state '${job.status}'`,
      isDeadLetter: false,
      isRetried: false
    }
  }

  const nowIso = new Date().toISOString()
  const logger = createStructuredLogger({
    organization_id: job.org_id,
    automation_run_id: job.id,
    event_id: job.event_payload?.eventId || job.job_id
  })

  const provider = job.action_type === 'send_sms'
    ? 'telnyx'
    : (job.action_type.includes('stripe') || job.action_type.includes('invoice') ? 'stripe' : 'internal')

  // 2. Mark job as running
  telemetryStore.recordJobTransition('running')
  logger.info(`Automation job ${job.job_id} started processing`, {
    organization_id: job.org_id,
    automation_run_id: job.id,
    automation_type: job.action_type,
    status: 'running',
    attempt: (job.retry_count || 0) + 1,
    provider,
    scheduled_at: job.scheduled_at,
    started_at: nowIso
  })

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
    const completedAtIso = new Date().toISOString()
    const durationMs = Date.now() - new Date(nowIso).getTime()
    const providerMessageId = result.data?.messageId || result.data?.id || null

    telemetryStore.recordJobTransition('completed')
    telemetryStore.recordAutomation('completed')
    logger.info(`Automation job ${job.job_id} completed successfully`, {
      organization_id: job.org_id,
      automation_run_id: job.id,
      automation_type: job.action_type,
      status: 'completed',
      attempt: (job.retry_count || 0) + 1,
      provider,
      provider_message_id: providerMessageId,
      duration_ms: durationMs,
      timestamps: {
        scheduled_at: job.scheduled_at,
        started_at: nowIso,
        completed_at: completedAtIso
      }
    })

    await supabase
      .from('automation_runs')
      .update({
        status: 'success',
        completed_at: completedAtIso,
        locked_at: null,
        locked_by: null,
        failure_reason: null,
        execution_log: updatedLogs
      })
      .eq('id', job.id)

    return {
      ...result,
      isDeadLetter: false,
      isRetried: false
    }
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
    logger.error(`Automation job ${job.job_id} permanently failed -> dead_letter`, new Error(deadLetterReason), {
      organization_id: job.org_id,
      automation_run_id: job.id,
      automation_type: job.action_type,
      status: 'dead_letter',
      attempt: nextRetryCount,
      max_retries: maxRetries,
      provider,
      failure_reason: deadLetterReason
    })
    
    await supabase
      .from('automation_runs')
      .update({
        status: 'dead_letter',
        completed_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
        retry_count: nextRetryCount,
        failure_reason: deadLetterReason,
        execution_log: updatedLogs
      })
      .eq('id', job.id)

    return {
      ...result,
      error: deadLetterReason,
      isDeadLetter: true,
      isRetried: false
    }
  }

  // Schedule next retry with exponential backoff
  telemetryStore.recordJobTransition('retried')
  const nextScheduledAt = calculateNextRetry(job.retry_count).toISOString()
  logger.warn(`Automation job ${job.job_id} transient failure, retry scheduled`, {
    organization_id: job.org_id,
    automation_run_id: job.id,
    automation_type: job.action_type,
    status: 'retrying',
    attempt: nextRetryCount,
    provider,
    failure_reason: result.error,
    next_scheduled_at: nextScheduledAt
  })
  
  await supabase
    .from('automation_runs')
    .update({
      status: 'pending',
      locked_at: null,
      locked_by: null,
      retry_count: nextRetryCount,
      scheduled_at: nextScheduledAt,
      failure_reason: `Transient failure (attempt ${nextRetryCount}/${maxRetries}): ${result.error}`,
      execution_log: updatedLogs
    })
    .eq('id', job.id)

  return {
    ...result,
    isDeadLetter: false,
    isRetried: true
  }
}

/**
 * Atomically claims eligible automation runs for a worker using PostgreSQL FOR UPDATE SKIP LOCKED.
 * 
 * Guarantees:
 * 1. Concurrency Safety: Multiple concurrent workers will never claim the same job.
 * 2. Atomic Transition: Selected rows immediately transition to 'processing' with lock metadata.
 * 3. Crash Recovery: Jobs stranded in 'processing' or 'running' older than staleThresholdSeconds
 *    are safely recovered and retried, unless max_retries has been reached.
 */
export async function claimDueAutomationJobs(
  supabase: SupabaseClient,
  workerId: string,
  batchSize = 25,
  staleThresholdSeconds = 600
): Promise<AutomationRunRecord[]> {
  // 1. Primary: Use PostgreSQL RPC function with FOR UPDATE SKIP LOCKED
  if (typeof (supabase as any)?.rpc === 'function') {
    try {
      const { data, error } = await (supabase as any).rpc('claim_due_automation_runs', {
        p_worker_id: workerId,
        p_batch_size: batchSize,
        p_stale_threshold_seconds: staleThresholdSeconds
      })

      if (!error && Array.isArray(data)) {
        return data as AutomationRunRecord[]
      }

      if (error) {
        console.error('[WORKER CONCURRENCY WARNING] claim_due_automation_runs RPC error:', error.message)
        if (process.env.NODE_ENV === 'production') {
          console.error('[CRITICAL WORKER FAULT] Refusing non-atomic fallback in production to prevent race conditions & duplicate customer messages.')
          return []
        }
      }
    } catch (err: any) {
      console.error('[WORKER CONCURRENCY WARNING] claim_due_automation_runs RPC exception:', err?.message)
      if (process.env.NODE_ENV === 'production') {
        console.error('[CRITICAL WORKER FAULT] Refusing non-atomic fallback in production to prevent race conditions & duplicate customer messages.')
        return []
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[CRITICAL WORKER FAULT] Supabase client missing rpc capability in production. Refusing non-atomic fallback.')
    return []
  }

  // 2. Query fallback (for test harnesses or development where RPC function is not installed in mock DB):
  const now = new Date().toISOString()
  const staleLimit = new Date(Date.now() - staleThresholdSeconds * 1000).toISOString()

  let eligibleList: any[] = []

  // Check pending / scheduled jobs due now
  const { data: regularRuns } = await supabase
    .from('automation_runs')
    .select('*')
    .in('status', ['pending', 'scheduled'])
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(batchSize)

  if (regularRuns && regularRuns.length > 0) {
    eligibleList = [...regularRuns]
  }

  // Check for stale crashed jobs if batch has remaining room
  if (eligibleList.length < batchSize) {
    const remainingLimit = batchSize - eligibleList.length
    const { data: activeRuns } = await supabase
      .from('automation_runs')
      .select('*')
      .in('status', ['processing', 'running'])
      .limit(remainingLimit * 2)

    if (activeRuns && activeRuns.length > 0) {
      for (const r of activeRuns) {
        const evalResult = evaluateStaleLockRecovery(r, staleThresholdSeconds)
        if (evalResult.isStale && evalResult.updates) {
          if (evalResult.action === 'dead_letter') {
            await supabase.from('automation_runs').update(evalResult.updates).eq('id', r.id)
          } else if (evalResult.action === 'retry') {
            eligibleList.push({ ...r, ...evalResult.updates })
            if (eligibleList.length >= batchSize) break
          }
        }
      }
    }
  }

  if (eligibleList.length === 0) {
    return []
  }

  // Atomically claim each candidate
  const claimed: AutomationRunRecord[] = []
  for (const candidate of eligibleList) {
    const isStale = candidate.status === 'processing' || candidate.status === 'running'
    const newRetryCount = isStale ? (candidate.retry_count || 0) + 1 : (candidate.retry_count || 0)

    const { data: updated, error: updateErr } = await supabase
      .from('automation_runs')
      .update({
        status: 'processing',
        locked_at: now,
        locked_by: workerId,
        retry_count: newRetryCount,
        started_at: candidate.started_at || now
      })
      .eq('id', candidate.id)
      .select()
      .maybeSingle()

    if (!updateErr && updated) {
      claimed.push(updated as AutomationRunRecord)
    } else if (!updateErr) {
      candidate.status = 'processing'
      candidate.locked_at = now
      candidate.locked_by = workerId
      candidate.retry_count = newRetryCount
      candidate.started_at = candidate.started_at || now
      claimed.push(candidate as AutomationRunRecord)
    }
  }

  return claimed
}

export interface DrainAutomationJobsOptions {
  batchSize?: number
  maxBatches?: number
  maxDurationMs?: number
  safetyMarginMs?: number
  staleThresholdSeconds?: number
  workerId?: string
  invocationId?: string
}

export interface DrainAutomationJobsSummary {
  invocationId: string
  workerId: string
  batchesClaimed: number
  claimed: number
  processed: number
  succeeded: number
  failed: number
  retried: number
  deadLettered: number
  remainingDue: number
  durationMs: number
  stopReason: 'queue_empty' | 'time_budget_exhausted' | 'max_batches_reached'
}

/**
 * Drains due automation runs across batches within a serverless execution time budget.
 * Atomically reserves jobs batch-by-batch using PostgreSQL FOR UPDATE SKIP LOCKED.
 * 
 * Guarantees:
 * 1. Bounded Loop: Strictly honors maxBatches and runtime deadline to avoid serverless timeout kills.
 * 2. Concurrency Safety: Each batch claimed atomically; concurrent workers process distinct jobs.
 * 3. Infinite Loop Prevention: Never re-processes the same job ID within a single invocation.
 * 4. Structured Observability: Logs complete run lifecycle with redaction of sensitive credentials.
 */
export async function drainDueAutomationJobs(
  supabase: SupabaseClient,
  options: DrainAutomationJobsOptions = {}
): Promise<DrainAutomationJobsSummary> {
  const startTime = Date.now()
  const invocationId = options.invocationId || `inv_${startTime}_${Math.random().toString(36).slice(2, 8)}`
  const workerId = options.workerId || `worker_${startTime}_${Math.random().toString(36).slice(2, 8)}`
  const batchSize = Math.max(1, options.batchSize ?? 25)
  const maxBatches = Math.max(1, options.maxBatches ?? 10)
  const maxDurationMs = options.maxDurationMs ?? (process.env.WORKER_MAX_DURATION_MS ? parseInt(process.env.WORKER_MAX_DURATION_MS, 10) : 25000)
  const safetyMarginMs = options.safetyMarginMs ?? (process.env.WORKER_SAFETY_MARGIN_MS ? parseInt(process.env.WORKER_SAFETY_MARGIN_MS, 10) : 5000)
  const staleThresholdSeconds = options.staleThresholdSeconds ?? 600

  const deadline = startTime + Math.max(0, maxDurationMs - safetyMarginMs)

  const logger = createStructuredLogger({
    request_id: invocationId
  })

  logger.info('Automation worker invocation started', {
    invocation_id: invocationId,
    worker_id: workerId,
    batch_size: batchSize,
    max_batches: maxBatches,
    max_duration_ms: maxDurationMs,
    safety_margin_ms: safetyMarginMs,
    stale_threshold_seconds: staleThresholdSeconds
  })

  let batchesClaimed = 0
  let totalClaimed = 0
  let totalProcessed = 0
  let totalSucceeded = 0
  let totalFailed = 0
  let totalRetried = 0
  let totalDeadLettered = 0
  let stopReason: 'queue_empty' | 'time_budget_exhausted' | 'max_batches_reached' = 'queue_empty'
  const processedRunIds = new Set<string>()
  let lastBatchDurationMs = 0

  while (batchesClaimed < maxBatches) {
    const now = Date.now()
    // Verify time budget: if deadline reached or insufficient budget for another batch, stop
    if (now >= deadline || (batchesClaimed > 0 && deadline - now < Math.min(1000, lastBatchDurationMs))) {
      stopReason = 'time_budget_exhausted'
      break
    }

    const batchStartTime = Date.now()
    const claimedJobs = await claimDueAutomationJobs(
      supabase,
      workerId,
      batchSize,
      staleThresholdSeconds
    )

    if (!claimedJobs || claimedJobs.length === 0) {
      stopReason = 'queue_empty'
      break
    }

    // Filter out runs already touched in this invocation (loop safeguard)
    const runsToProcess = claimedJobs.filter((job) => !processedRunIds.has(job.id))
    if (runsToProcess.length === 0) {
      stopReason = 'queue_empty'
      break
    }

    batchesClaimed++
    totalClaimed += runsToProcess.length

    logger.info('Automation worker batch claimed', {
      invocation_id: invocationId,
      worker_id: workerId,
      batch_index: batchesClaimed,
      batch_count: runsToProcess.length,
      remaining_budget_ms: Math.max(0, deadline - Date.now())
    })

    for (const job of runsToProcess) {
      processedRunIds.add(job.id)
      totalProcessed++
      try {
        const res = await executeAutomationJob(supabase, job as AutomationRunRecord)
        if (res.success) {
          totalSucceeded++
        } else {
          totalFailed++
          if (res.isDeadLetter) {
            totalDeadLettered++
          } else if (res.isRetried) {
            totalRetried++
          }
        }
      } catch (err) {
        console.error(`[AUTOMATION WORKER ERROR] Job ${job.id} exception:`, err)
        totalFailed++
      }
    }

    lastBatchDurationMs = Date.now() - batchStartTime

    if (batchesClaimed >= maxBatches) {
      stopReason = 'max_batches_reached'
      break
    }
  }

  // Count remaining due jobs for queue backlog visibility
  let remainingDue = 0
  try {
    const { count, data } = await supabase
      .from('automation_runs')
      .select('id', { count: 'exact' })
      .in('status', ['pending', 'scheduled'])
      .lte('scheduled_at', new Date().toISOString())

    if (typeof count === 'number') {
      remainingDue = count
    } else if (Array.isArray(data)) {
      remainingDue = data.length
    }
  } catch {
    remainingDue = 0
  }

  const durationMs = Date.now() - startTime

  logger.info('Automation worker invocation completed', {
    invocation_id: invocationId,
    worker_id: workerId,
    batches_claimed: batchesClaimed,
    claimed: totalClaimed,
    processed: totalProcessed,
    succeeded: totalSucceeded,
    failed: totalFailed,
    retried: totalRetried,
    dead_lettered: totalDeadLettered,
    remaining_due: remainingDue,
    duration_ms: durationMs,
    stop_reason: stopReason
  })

  return {
    invocationId,
    workerId,
    batchesClaimed,
    claimed: totalClaimed,
    processed: totalProcessed,
    succeeded: totalSucceeded,
    failed: totalFailed,
    retried: totalRetried,
    deadLettered: totalDeadLettered,
    remainingDue,
    durationMs,
    stopReason
  }
}

/**
 * Polls and processes all pending or scheduled automation runs whose scheduled_at has arrived.
 * Atomically reserves jobs before processing so concurrent workers never process the same run.
 */
export async function processDueAutomationJobs(
  supabase: SupabaseClient,
  batchSize = 25,
  workerId?: string
): Promise<{
  processed: number
  succeeded: number
  failed: number
  claimed: number
  retried: number
  deadLettered: number
}> {
  const summary = await drainDueAutomationJobs(supabase, {
    batchSize,
    workerId,
    maxBatches: 1
  })

  return {
    processed: summary.processed,
    claimed: summary.claimed,
    succeeded: summary.succeeded,
    failed: summary.failed,
    retried: summary.retried,
    deadLettered: summary.deadLettered
  }
}
