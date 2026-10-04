import type { SupabaseClient } from '@supabase/supabase-js'

export interface AutomationRunInspection {
  runId: string
  jobId: string
  // 1. What automation ran?
  automation: {
    ruleId: string
    ruleName: string
    tenantId: string
  }
  // 2. Why did it run?
  trigger: {
    eventType: string
    payload: Record<string, any>
  }
  // 3. What action did it perform?
  action: {
    type: string
    params: Record<string, any>
  }
  // 4. Did it succeed?
  outcome: {
    status: string
    succeeded: boolean
    startedAt?: string | null
    completedAt?: string | null
  }
  // 5. If it failed, why?
  failure: {
    failed: boolean
    reason?: string | null
    executionLogs: any[]
  }
  // 6. Will it retry?
  retry: {
    willRetry: boolean
    currentAttempt: number
    maxRetries: number
    nextScheduledAt?: string | null
  }
}

/**
 * Formats a raw automation_run database row into a structured 6-point inspection object
 */
export function formatRunInspection(row: any): AutomationRunInspection {
  const isSuccess = row.status === 'success'
  const isFailed = row.status === 'failed' || row.status === 'dead_letter'
  const willRetry =
    (row.status === 'pending' || row.status === 'failed') &&
    row.retry_count < row.max_retries &&
    row.status !== 'dead_letter' &&
    row.status !== 'cancelled'

  return {
    runId: row.id,
    jobId: row.job_id || row.id,
    automation: {
      ruleId: row.rule_id,
      ruleName: row.automation_rules?.name || row.rule_name || 'Custom Automation Rule',
      tenantId: row.org_id
    },
    trigger: {
      eventType: row.event_type,
      payload: row.event_payload || {}
    },
    action: {
      type: row.action_type,
      params: row.action_params || {}
    },
    outcome: {
      status: row.status,
      succeeded: isSuccess,
      startedAt: row.started_at,
      completedAt: row.completed_at
    },
    failure: {
      failed: isFailed || Boolean(row.failure_reason),
      reason: row.failure_reason,
      executionLogs: row.execution_log || []
    },
    retry: {
      willRetry,
      currentAttempt: row.retry_count || 0,
      maxRetries: row.max_retries || 3,
      nextScheduledAt: willRetry ? row.scheduled_at : null
    }
  }
}

/**
 * Retrieves full 6-point observability details for a single automation run
 */
export async function inspectAutomationRun(
  supabase: SupabaseClient,
  runId: string
): Promise<AutomationRunInspection | null> {
  const { data: run, error } = await supabase
    .from('automation_runs')
    .select('*, automation_rules(name, trigger_type)')
    .eq('id', runId)
    .single()

  if (error || !run) {
    return null
  }

  return formatRunInspection(run)
}

/**
 * Lists automation runs for observability dashboard with status filtering
 */
export async function listAutomationRunsObservability(
  supabase: SupabaseClient,
  options?: {
    orgId?: string
    status?: string
    limit?: number
  }
): Promise<AutomationRunInspection[]> {
  let query = supabase
    .from('automation_runs')
    .select('*, automation_rules(name, trigger_type)')
    .order('created_at', { ascending: false })

  if (options?.orgId) {
    query = query.eq('org_id', options.orgId)
  }

  if (options?.status) {
    query = query.eq('status', options.status)
  }

  const { data, error } = await query.limit(options?.limit || 50)

  if (error || !data) {
    return []
  }

  return data.map(formatRunInspection)
}
