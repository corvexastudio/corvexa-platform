import type { SupabaseClient } from '@supabase/supabase-js'
import type { AutomationEvent } from './events.ts'
import { evaluateConditions } from './conditions.ts'
import { evaluateAndApplyStopConditions } from './stop-conditions.ts'
import { executeAutomationJob, type AutomationRunRecord } from './worker.ts'
import { telemetryStore } from '../observability/telemetry-store.ts'
import { createStructuredLogger } from '../observability/logger.ts'

export interface AutomationRuleRecord {
  id: string
  org_id: string
  name: string
  trigger_type: string
  version: number
  status: 'active' | 'paused' | 'archived'
  is_active: boolean
  delay_seconds: number
  conditions: any
  actions: any
  stop_conditions: any[]
}

export interface HandleEventResult {
  eventId: string
  stopConditionsTriggered: boolean
  matchedRulesCount: number
  enqueuedJobsCount: number
  jobIds: string[]
}

/**
 * Main Event-Driven Automation Orchestrator
 * Matches events to rules, checks conditions, evaluates stop conditions,
 * and enqueues/executes actions.
 */
export async function handleAutomationEvent(
  supabase: SupabaseClient,
  event: AutomationEvent
): Promise<HandleEventResult> {
  const jobIds: string[] = []

  // 1. Evaluate & Apply Stop Conditions for incoming event
  const stopCheck = await evaluateAndApplyStopConditions(supabase, event)

  // 2. Fetch active automation rules for this tenant and event trigger
  const { data: rules, error: rulesError } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('org_id', event.orgId)
    .eq('trigger_type', event.eventType)
    .eq('status', 'active')
    .eq('is_active', true)

  if (rulesError) {
    console.error('[AUTOMATION RULES FETCH ERROR]', rulesError)
    return {
      eventId: event.id,
      stopConditionsTriggered: stopCheck.triggered,
      matchedRulesCount: 0,
      enqueuedJobsCount: 0,
      jobIds: []
    }
  }

  if (!rules || rules.length === 0) {
    return {
      eventId: event.id,
      stopConditionsTriggered: stopCheck.triggered,
      matchedRulesCount: 0,
      enqueuedJobsCount: 0,
      jobIds: []
    }
  }

  let matchedRulesCount = 0

  // Evaluation context combining envelope and payload
  const evaluationContext = {
    ...event.payload,
    event: {
      id: event.id,
      type: event.eventType,
      timestamp: event.timestamp,
      orgId: event.orgId
    },
    payload: event.payload
  }

  // 3. Process each candidate rule
  for (const rawRule of rules) {
    const rule = rawRule as AutomationRuleRecord

    // Check conditions
    const matchesConditions = evaluateConditions(rule.conditions, evaluationContext)
    if (!matchesConditions) {
      continue
    }

    matchedRulesCount++
    telemetryStore.recordAutomation('triggered')

    const logger = createStructuredLogger({
      orgId: event.orgId,
      eventId: event.id
    })
    logger.info(`Automation rule triggered: ${rule.name}`, {
      rule_id: rule.id,
      trigger_type: rule.trigger_type
    })

    // Parse actions (support array or single object)
    const rawActions = rule.actions
    const actionList: Array<{ type: string; params: Record<string, any> }> = Array.isArray(rawActions)
      ? rawActions
      : rawActions && typeof rawActions === 'object' && rawActions.type
      ? [rawActions]
      : []

    const delaySeconds = rule.delay_seconds || 0
    const scheduledAt = new Date(Date.now() + delaySeconds * 1000).toISOString()
    const initialStatus = delaySeconds > 0 ? 'scheduled' : 'pending'

    // 4. Enqueue jobs for each defined action
    for (let i = 0; i < actionList.length; i++) {
      const actionDef = actionList[i]
      const actionType = actionDef.type
      const actionParams = actionDef.params || {}

      const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const idempotencyKey = `${rule.id}:${event.idempotencyKey || event.id}:${i}`

      // Atomic insert into automation_runs
      const { data: createdRun, error: insertError } = await supabase
        .from('automation_runs')
        .insert({
          org_id: event.orgId,
          rule_id: rule.id,
          job_id: jobId,
          idempotency_key: idempotencyKey,
          event_type: event.eventType,
          event_payload: {
            ...event.payload,
            entityId: event.entityId,
            contactId: event.contactId,
            leadId: event.leadId
          },
          action_type: actionType,
          action_params: actionParams,
          status: initialStatus,
          retry_count: 0,
          max_retries: 3,
          scheduled_at: scheduledAt
        })
        .select('*')
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          // Idempotency constraint hit: job already exists, ignore duplicate
          continue
        }
        console.error('[AUTOMATION RUN INSERT ERROR]', insertError)
        continue
      }

      telemetryStore.recordJob('queued')
      jobIds.push(jobId)

      // 5. If immediate execution (0 delay), trigger worker directly
      if (delaySeconds === 0 && createdRun) {
        await executeAutomationJob(supabase, createdRun as AutomationRunRecord)
      }
    }
  }

  return {
    eventId: event.id,
    stopConditionsTriggered: stopCheck.triggered,
    matchedRulesCount,
    enqueuedJobsCount: jobIds.length,
    jobIds
  }
}
