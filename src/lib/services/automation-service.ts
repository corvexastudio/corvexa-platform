import type { SupabaseClient } from '@supabase/supabase-js'
import {
  processDueAutomationJobs,
  drainDueAutomationJobs,
  executeAutomationJob,
  type AutomationRunRecord,
  type DrainAutomationJobsOptions
} from '../automations/worker.ts'
import {
  checkWorkerHealth,
  type WorkerHealthResult
} from '../automations/worker-health.ts'
import {
  canTransition,
  assertValidTransition,
  isRetryEligible,
  evaluateStaleLockRecovery,
  type AutomationState
} from '../automations/state-machine.ts'
import { handleAutomationEvent } from '../automations/engine.ts'
import { createEventEnvelope, type DomainEventType } from '../automations/events.ts'

/**
 * AutomationService
 * 
 * Domain service managing the asynchronous background automation pipeline,
 * atomic PostgreSQL job claiming, state machine validation, and health checks.
 */
export class AutomationService {
  /**
   * Drains due runs across batches within serverless time budget.
   */
  static async drainPendingRuns(
    supabase: SupabaseClient,
    options: DrainAutomationJobsOptions = {}
  ) {
    return drainDueAutomationJobs(supabase, options)
  }

  /**
   * Triggers worker polling loop with atomic PostgreSQL row-claiming (SKIP LOCKED).
   */
  static async processPendingRuns(
    supabase: SupabaseClient,
    options: { batchSize?: number; workerId?: string } = {}
  ) {
    return processDueAutomationJobs(supabase, options.batchSize, options.workerId)
  }

  /**
   * Executes a single automation job record through the lifecycle.
   */
  static async executeJob(supabase: SupabaseClient, job: AutomationRunRecord) {
    return executeAutomationJob(supabase, job)
  }

  /**
   * Inspects operational health and processing recency of the automation worker.
   */
  static async getHealth(supabase: SupabaseClient): Promise<WorkerHealthResult> {
    return checkWorkerHealth(supabase)
  }

  /**
   * Evaluates state machine transition validity.
   */
  static canTransition(from: AutomationState, to: AutomationState): boolean {
    return canTransition(from, to)
  }

  /**
   * Enforces valid state machine transition or throws descriptive error.
   */
  static assertTransition(from: AutomationState, to: AutomationState): void {
    assertValidTransition(from, to)
  }

  /**
   * Evaluates whether an automation run can be retried.
   */
  static isRetryable(status: AutomationState): boolean {
    return isRetryEligible(status)
  }

  /**
   * Detects and recovers orphaned locks on stalled worker runs.
   */
  static evaluateStaleLock(
    job: {
      id: string
      status: string
      retry_count: number
      max_retries: number
      locked_at?: string | null
    },
    timeoutSeconds: number = 600
  ) {
    return evaluateStaleLockRecovery(job, timeoutSeconds)
  }

  /**
   * Dispatches a domain event into the automation engine.
   */
  static async dispatchEvent(
    supabase: SupabaseClient,
    eventType: DomainEventType,
    orgId: string,
    payload: Record<string, any>,
    metadata?: Record<string, any>
  ) {
    const envelope = createEventEnvelope(eventType, orgId, payload, metadata)
    return handleAutomationEvent(supabase, envelope)
  }

  /**
   * Alias for processPendingRuns.
   */
  static async runAutomationCycle(
    supabase: SupabaseClient,
    options: { batchSize?: number; workerId?: string } = {}
  ) {
    return this.processPendingRuns(supabase, options)
  }

  /**
   * Alias for getHealth.
   */
  static async getWorkerHealth(supabase: SupabaseClient): Promise<WorkerHealthResult> {
    return this.getHealth(supabase)
  }

  /**
   * Alias for dispatchEvent.
   */
  static async recordDomainEvent(
    supabase: SupabaseClient,
    eventType: DomainEventType,
    orgId: string,
    payload: Record<string, any>,
    metadata?: Record<string, any>
  ) {
    return this.dispatchEvent(supabase, eventType, orgId, payload, metadata)
  }
}
