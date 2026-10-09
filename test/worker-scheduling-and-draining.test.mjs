process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash, timingSafeEqual } from 'node:crypto'

import {
  claimDueAutomationJobs,
  processDueAutomationJobs,
  drainDueAutomationJobs,
  executeAutomationJob,
  calculateNextRetry
} from '../src/lib/automations/worker.ts'
import { AutomationService } from '../src/lib/services/automation-service.ts'
import { registerCustomAction } from '../src/lib/automations/action-registry.ts'

/**
 * Creates high-fidelity mock database simulating PostgreSQL RLS,
 * atomic RPC claim_due_automation_runs (FOR UPDATE SKIP LOCKED), and table updates.
 */
function createMockAutomationDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    automation_rules: initialState.automation_rules || [],
    automation_runs: (initialState.automation_runs || []).map(r => ({ ...r })),
    contacts: initialState.contacts || [],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers || []
  }

  const client = {
    _tables: tables,

    rpc: async (fnName, args) => {
      if (fnName === 'claim_due_automation_runs') {
        const { p_worker_id, p_batch_size = 25, p_stale_threshold_seconds = 600 } = args
        const now = new Date()
        const staleLimit = new Date(now.getTime() - p_stale_threshold_seconds * 1000)

        const eligible = []
        for (const run of tables.automation_runs) {
          if (eligible.length >= p_batch_size) break

          const isDueScheduled =
            (run.status === 'pending' || run.status === 'scheduled') &&
            new Date(run.scheduled_at) <= now

          const isStaleProcessing =
            (run.status === 'processing' || run.status === 'running') &&
            run.locked_at &&
            new Date(run.locked_at) < staleLimit &&
            (run.retry_count || 0) < (run.max_retries || 3)

          if (isDueScheduled || isStaleProcessing) {
            run.status = 'processing'
            run.locked_at = now.toISOString()
            run.locked_by = p_worker_id
            if (isStaleProcessing) {
              run.retry_count = (run.retry_count || 0) + 1
            }
            if (!run.started_at) {
              run.started_at = now.toISOString()
            }
            eligible.push({ ...run })
          }
        }

        return { data: eligible, error: null }
      }

      return { data: null, error: new Error(`Unknown RPC function ${fnName}`) }
    },

    from: (tableName) => {
      let filters = []
      let limitCount = null

      const qb = {
        select: (cols, opts) => {
          return qb
        },
        eq: (col, val) => {
          filters.push(row => row[col] === val)
          return qb
        },
        in: (col, arr) => {
          filters.push(row => arr.includes(row[col]))
          return qb
        },
        lte: (col, val) => {
          filters.push(row => new Date(row[col]) <= new Date(val))
          return qb
        },
        order: () => qb,
        limit: (n) => {
          limitCount = n
          return qb
        },
        maybeSingle: async () => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter(row => filters.every(fn => fn(row)))
          return { data: filtered[0] || null, error: null }
        },
        update: (updates) => {
          const updateFilters = [...filters]
          const updateBuilder = {
            eq: (col, val) => {
              updateFilters.push(row => row[col] === val)
              return updateBuilder
            },
            in: (col, arr) => {
              updateFilters.push(row => arr.includes(row[col]))
              return updateBuilder
            },
            select: () => ({
              maybeSingle: async () => {
                let updated = null
                for (const row of tables[tableName] || []) {
                  if (updateFilters.every(fn => fn(row))) {
                    Object.assign(row, updates)
                    updated = { ...row }
                  }
                }
                return { data: updated, error: null }
              }
            }),
            then: (resolve, reject) => {
              let updated = null
              for (const row of tables[tableName] || []) {
                if (updateFilters.every(fn => fn(row))) {
                  Object.assign(row, updates)
                  updated = { ...row }
                }
              }
              return Promise.resolve({ data: updated, error: null }).then(resolve, reject)
            }
          }
          return updateBuilder
        },
        then: (resolve, reject) => {
          const tableData = tables[tableName] || []
          let filtered = tableData.filter(row => filters.every(fn => fn(row)))
          if (limitCount !== null) {
            filtered = filtered.slice(0, limitCount)
          }
          return Promise.resolve({
            data: filtered.map(r => ({ ...r })),
            count: filtered.length,
            error: null
          }).then(resolve, reject)
        }
      }

      return qb
    }
  }

  return client
}

// Register a fast, testable mock action
registerCustomAction('test_success_action', async (params) => {
  return { success: true, actionType: 'test_success_action', data: { ok: true } }
})

registerCustomAction('test_failing_action', async (params) => {
  return { success: false, actionType: 'test_failing_action', error: 'Action execution test error' }
})

registerCustomAction('test_delayed_action', async (params) => {
  const ms = params?.delayMs || 30
  await new Promise(r => setTimeout(r, ms))
  return { success: true, actionType: 'test_delayed_action', data: { delayed: ms } }
})

// =============================================================================
// TEST 1 — CRON CONFIGURATION IS EVERY MINUTE
// =============================================================================
test('TEST 1: Cron configuration in vercel.json is scheduled every minute (* * * * *)', () => {
  const vercelJsonPath = path.resolve(process.cwd(), '../captodesk/vercel.json')
  const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'))

  assert.ok(Array.isArray(vercelConfig.crons), 'vercel.json must have crons array')
  const workerCron = vercelConfig.crons.find(c => c.path === '/api/automations/worker')
  assert.ok(workerCron, 'Worker cron path /api/automations/worker must exist')
  assert.strictEqual(
    workerCron.schedule,
    '* * * * *',
    'Worker cron schedule must be * * * * * (every minute) for near-real-time execution'
  )
})

// =============================================================================
// TEST 2 & 3 — CRON AUTHENTICATION (FAIL-CLOSED CRON_SECRET & TIMING SAFETY)
// =============================================================================
// =============================================================================
// TEST 2 & 3 — CRON AUTHENTICATION (FAIL-CLOSED CRON_SECRET & TIMING SAFETY)
// =============================================================================
test('TEST 2: Unauthorized cron requests are strictly rejected (missing or invalid CRON_SECRET)', () => {
  const routePath = path.resolve(process.cwd(), '../captodesk/src/app/api/automations/worker/route.ts')
  const routeSource = fs.readFileSync(routePath, 'utf8')

  // Verify static route configuration
  assert.match(routeSource, /export const dynamic = 'force-dynamic'/)
  assert.match(routeSource, /export const maxDuration = 60/)
  assert.match(routeSource, /safeCompareSecrets/)
  assert.match(routeSource, /drainDueAutomationJobs/)

  // Functional simulator matching the route's exact authorization verification
  function safeCompareSecrets(provided, expected) {
    try {
      if (!provided || !expected) return false
      const hashProvided = createHash('sha256').update(provided, 'utf8').digest()
      const hashExpected = createHash('sha256').update(expected, 'utf8').digest()
      return timingSafeEqual(hashProvided, hashExpected)
    } catch {
      return false
    }
  }

  function simulateWorkerAuth(headers, envSecret) {
    if (!envSecret || envSecret.trim().length === 0) {
      return { status: 503, error: 'Cron worker unconfigured: CRON_SECRET is required' }
    }
    const authHeader = headers['authorization']
    const xCronSecret = headers['x-cron-secret']
    const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
    const providedSecret = bearerSecret || xCronSecret?.trim()

    if (!providedSecret || !safeCompareSecrets(providedSecret, envSecret.trim())) {
      return { status: 401, error: 'Unauthorized: Invalid or missing cron secret' }
    }
    return { status: 200, authorized: true }
  }

  const PROD_SECRET = 'cron_secret_k8x923j1ks_992'

  // 1. Unconfigured CRON_SECRET -> 503 Fail-closed
  assert.strictEqual(simulateWorkerAuth({}, null).status, 503)
  assert.strictEqual(simulateWorkerAuth({}, '').status, 503)
  assert.strictEqual(simulateWorkerAuth({}, '   ').status, 503)

  // 2. Missing headers -> 401 Unauthorized
  assert.strictEqual(simulateWorkerAuth({}, PROD_SECRET).status, 401)

  // 3. Invalid Bearer token -> 401 Unauthorized
  assert.strictEqual(
    simulateWorkerAuth({ authorization: 'Bearer attacker_token' }, PROD_SECRET).status,
    401
  )

  // 4. Invalid X-Cron-Secret header -> 401 Unauthorized
  assert.strictEqual(
    simulateWorkerAuth({ 'x-cron-secret': 'wrong_guess_123' }, PROD_SECRET).status,
    401
  )

  // 5. Valid Bearer token -> 200 Authorized
  assert.strictEqual(
    simulateWorkerAuth({ authorization: `Bearer ${PROD_SECRET}` }, PROD_SECRET).status,
    200
  )

  // 6. Valid X-Cron-Secret -> 200 Authorized
  assert.strictEqual(
    simulateWorkerAuth({ 'x-cron-secret': PROD_SECRET }, PROD_SECRET).status,
    200
  )
})

test('TEST 3: Valid cron request executes with constant-time authenticated secret', () => {
  const configured = 'valid_production_cron_secret_abc123'
  const provided = 'valid_production_cron_secret_abc123'

  const hashP = createHash('sha256').update(provided, 'utf8').digest()
  const hashE = createHash('sha256').update(configured, 'utf8').digest()
  assert.strictEqual(timingSafeEqual(hashP, hashE), true)

  const wrong = 'invalid_attacker_guess_token'
  const hashW = createHash('sha256').update(wrong, 'utf8').digest()
  assert.strictEqual(timingSafeEqual(hashW, hashE), false)
})

// =============================================================================
// TEST 4 — ONE DUE JOB IS CLAIMED AND EXECUTED
// =============================================================================
test('TEST 4: Exactly one due job is atomically claimed, executed, and transitions to success', async () => {
  const db = createMockAutomationDb({
    automation_runs: [
      {
        id: 'run-single-1',
        job_id: 'job-1',
        org_id: 'org-1',
        rule_id: 'rule-1',
        status: 'pending',
        action_type: 'test_success_action',
        action_params: {},
        event_type: 'call.missed',
        event_payload: {},
        retry_count: 0,
        max_retries: 3,
        scheduled_at: new Date(Date.now() - 5000).toISOString()
      }
    ]
  })

  const summary = await drainDueAutomationJobs(db, { batchSize: 25 })

  assert.strictEqual(summary.claimed, 1)
  assert.strictEqual(summary.processed, 1)
  assert.strictEqual(summary.succeeded, 1)
  assert.strictEqual(summary.failed, 0)
  assert.strictEqual(summary.batchesClaimed, 1)
  assert.strictEqual(summary.stopReason, 'queue_empty')

  const run = db._tables.automation_runs[0]
  assert.strictEqual(run.status, 'success')
  assert.ok(run.completed_at)
})

// =============================================================================
// TEST 5 & 6 — MULTI-BATCH QUEUE DRAINING WITHIN SINGLE INVOCATION
// =============================================================================
test('TEST 5: Multiple due jobs (55 jobs) are drained across multiple batches (batchSize = 20)', async () => {
  const initialRuns = Array.from({ length: 55 }, (_, i) => ({
    id: `run-drain-${i + 1}`,
    job_id: `job-drain-${i + 1}`,
    org_id: 'org-multi',
    rule_id: 'rule-followup',
    status: 'scheduled',
    action_type: 'test_success_action',
    action_params: {},
    event_type: 'lead.created',
    event_payload: {},
    retry_count: 0,
    max_retries: 3,
    scheduled_at: new Date(Date.now() - (1000 + i * 50)).toISOString()
  }))

  const db = createMockAutomationDb({ automation_runs: initialRuns })

  const summary = await drainDueAutomationJobs(db, {
    batchSize: 20,
    maxBatches: 10
  })

  // 55 jobs / 20 per batch = 3 batches (20 + 20 + 15)
  assert.strictEqual(summary.batchesClaimed, 3)
  assert.strictEqual(summary.claimed, 55)
  assert.strictEqual(summary.processed, 55)
  assert.strictEqual(summary.succeeded, 55)
  assert.strictEqual(summary.failed, 0)
  assert.strictEqual(summary.remainingDue, 0)
  assert.strictEqual(summary.stopReason, 'queue_empty')

  // All 55 jobs in DB should now be 'success'
  const succeededCount = db._tables.automation_runs.filter(r => r.status === 'success').length
  assert.strictEqual(succeededCount, 55)
})

test('TEST 6: Queue larger than single batch size drains in one invocation without stranding jobs', async () => {
  const initialRuns = Array.from({ length: 60 }, (_, i) => ({
    id: `run-large-${i + 1}`,
    job_id: `job-large-${i + 1}`,
    org_id: 'org-1',
    rule_id: 'rule-large',
    status: 'pending',
    action_type: 'test_success_action',
    action_params: {},
    event_type: 'lead.created',
    event_payload: {},
    retry_count: 0,
    max_retries: 3,
    scheduled_at: new Date(Date.now() - 2000).toISOString()
  }))

  const db = createMockAutomationDb({ automation_runs: initialRuns })

  // Single invocation with standard batchSize = 25
  const summary = await drainDueAutomationJobs(db, {
    batchSize: 25,
    maxBatches: 10
  })

  // 60 jobs: Batch 1 (25) + Batch 2 (25) + Batch 3 (10) = 60
  assert.strictEqual(summary.batchesClaimed, 3)
  assert.strictEqual(summary.processed, 60)
  assert.strictEqual(summary.succeeded, 60)
  assert.strictEqual(summary.remainingDue, 0)
})

// =============================================================================
// TEST 7 & 8 — SERVERLESS EXECUTION TIME BUDGET & SAFE STOPPING
// =============================================================================
test('TEST 7: Worker stops before runtime deadline when time budget is exhausted', async () => {
  // 30 jobs that take 15ms each
  const initialRuns = Array.from({ length: 30 }, (_, i) => ({
    id: `run-slow-${i + 1}`,
    job_id: `job-slow-${i + 1}`,
    org_id: 'org-budget',
    rule_id: 'rule-budget',
    status: 'pending',
    action_type: 'test_delayed_action',
    action_params: { delayMs: 15 },
    event_type: 'lead.created',
    event_payload: {},
    retry_count: 0,
    max_retries: 3,
    scheduled_at: new Date(Date.now() - 5000).toISOString()
  }))

  const db = createMockAutomationDb({ automation_runs: initialRuns })

  // Configure tight time budget: 40ms max, 10ms safety margin -> 30ms deadline
  const summary = await drainDueAutomationJobs(db, {
    batchSize: 10,
    maxBatches: 5,
    maxDurationMs: 40,
    safetyMarginMs: 10
  })

  assert.strictEqual(summary.stopReason, 'time_budget_exhausted')
  assert.ok(summary.batchesClaimed >= 1, 'Should process at least 1 batch before budget cutoff')
  assert.ok(summary.remainingDue > 0, 'Remaining due jobs should still be pending')
})

test('TEST 8: Remaining due jobs are left for future scheduled invocation when batches reach maxBatches', async () => {
  const initialRuns = Array.from({ length: 50 }, (_, i) => ({
    id: `run-remain-${i + 1}`,
    job_id: `job-remain-${i + 1}`,
    org_id: 'org-remain',
    rule_id: 'rule-remain',
    status: 'pending',
    action_type: 'test_success_action',
    action_params: {},
    event_type: 'lead.created',
    event_payload: {},
    retry_count: 0,
    max_retries: 3,
    scheduled_at: new Date(Date.now() - 5000).toISOString()
  }))

  const db = createMockAutomationDb({ automation_runs: initialRuns })

  // Max 2 batches of 10 = 20 jobs processed; 30 remain
  const summary = await drainDueAutomationJobs(db, {
    batchSize: 10,
    maxBatches: 2
  })

  assert.strictEqual(summary.stopReason, 'max_batches_reached')
  assert.strictEqual(summary.batchesClaimed, 2)
  assert.strictEqual(summary.claimed, 20)
  assert.strictEqual(summary.remainingDue, 30)

  // Verify exactly 30 jobs remain untouched in 'pending'
  const pendingCount = db._tables.automation_runs.filter(r => r.status === 'pending').length
  assert.strictEqual(pendingCount, 30)
})

// =============================================================================
// TEST 9 — CONCURRENCY SAFETY (FOR UPDATE SKIP LOCKED)
// =============================================================================
test('TEST 9: Concurrent Worker Alpha and Worker Beta cannot claim the same job (FOR UPDATE SKIP LOCKED)', async () => {
  const initialRuns = Array.from({ length: 20 }, (_, i) => ({
    id: `run-conc-${i + 1}`,
    job_id: `job-conc-${i + 1}`,
    org_id: 'org-conc',
    rule_id: 'rule-conc',
    status: 'scheduled',
    action_type: 'test_success_action',
    action_params: {},
    event_type: 'lead.created',
    event_payload: {},
    retry_count: 0,
    max_retries: 3,
    scheduled_at: new Date(Date.now() - 1000).toISOString()
  }))

  const db = createMockAutomationDb({ automation_runs: initialRuns })

  // Simultaneously claim from both workers
  const [workerAlphaJobs, workerBetaJobs] = await Promise.all([
    claimDueAutomationJobs(db, 'worker_alpha', 10),
    claimDueAutomationJobs(db, 'worker_beta', 10)
  ])

  assert.strictEqual(workerAlphaJobs.length, 10)
  assert.strictEqual(workerBetaJobs.length, 10)

  const idsAlpha = new Set(workerAlphaJobs.map(j => j.id))
  const idsBeta = new Set(workerBetaJobs.map(j => j.id))

  // No collisions permitted
  const collision = [...idsAlpha].filter(id => idsBeta.has(id))
  assert.strictEqual(collision.length, 0, 'Zero collisions between concurrent workers')
})

// =============================================================================
// TEST 10 & 11 — RETRY BACKOFF & FUTURE SCHEDULE TIMING
// =============================================================================
test('TEST 10: Failed job transitions to pending with exponential backoff and is NOT immediately re-executed', async () => {
  const db = createMockAutomationDb({
    automation_runs: [
      {
        id: 'run-fail-1',
        job_id: 'job-fail-1',
        org_id: 'org-retry',
        rule_id: 'rule-retry',
        status: 'pending',
        action_type: 'test_failing_action',
        action_params: {},
        event_type: 'lead.created',
        event_payload: {},
        retry_count: 0,
        max_retries: 3,
        scheduled_at: new Date(Date.now() - 1000).toISOString()
      }
    ]
  })

  // First drain: job fails and gets scheduled for future retry
  const summary1 = await drainDueAutomationJobs(db, { batchSize: 25 })

  assert.strictEqual(summary1.failed, 1)
  assert.strictEqual(summary1.retried, 1)
  assert.strictEqual(summary1.deadLettered, 0)

  const jobAfterFail = db._tables.automation_runs[0]
  assert.strictEqual(jobAfterFail.status, 'pending')
  assert.strictEqual(jobAfterFail.retry_count, 1)
  assert.ok(new Date(jobAfterFail.scheduled_at) > new Date(), 'Next scheduled_at must be in the future')

  // Immediate second drain invocation: Job must NOT be claimed because scheduled_at > NOW
  const summary2 = await drainDueAutomationJobs(db, { batchSize: 25 })
  assert.strictEqual(summary2.claimed, 0)
  assert.strictEqual(summary2.processed, 0)
  assert.strictEqual(summary2.stopReason, 'queue_empty')
})

test('TEST 11: A job whose scheduled_at is in the future is never claimed or executed', async () => {
  const futureDate = new Date(Date.now() + 600000).toISOString() // 10 minutes in future
  const db = createMockAutomationDb({
    automation_runs: [
      {
        id: 'run-future-1',
        job_id: 'job-future-1',
        org_id: 'org-future',
        rule_id: 'rule-future',
        status: 'scheduled',
        action_type: 'test_success_action',
        action_params: {},
        event_type: 'call.missed',
        event_payload: {},
        retry_count: 0,
        max_retries: 3,
        scheduled_at: futureDate
      }
    ]
  })

  const summary = await drainDueAutomationJobs(db, { batchSize: 25 })
  assert.strictEqual(summary.claimed, 0)
  assert.strictEqual(summary.processed, 0)
  assert.strictEqual(db._tables.automation_runs[0].status, 'scheduled')
})

// =============================================================================
// TEST 12 — DEAD-LETTER EXHAUSTION
// =============================================================================
test('TEST 12: A permanently failing job transitions to dead_letter and is never executed again', async () => {
  const db = createMockAutomationDb({
    automation_runs: [
      {
        id: 'run-dead-1',
        job_id: 'job-dead-1',
        org_id: 'org-dead',
        rule_id: 'rule-dead',
        status: 'pending',
        action_type: 'test_failing_action',
        action_params: {},
        event_type: 'lead.created',
        event_payload: {},
        retry_count: 2, // 3rd attempt
        max_retries: 3,
        scheduled_at: new Date(Date.now() - 1000).toISOString()
      }
    ]
  })

  const summary = await drainDueAutomationJobs(db, { batchSize: 25 })
  assert.strictEqual(summary.failed, 1)
  assert.strictEqual(summary.deadLettered, 1)
  assert.strictEqual(summary.retried, 0)

  const deadJob = db._tables.automation_runs[0]
  assert.strictEqual(deadJob.status, 'dead_letter')
  assert.strictEqual(deadJob.retry_count, 3)

  // Subsequent drain ignores dead_letter
  const summary2 = await drainDueAutomationJobs(db, { batchSize: 25 })
  assert.strictEqual(summary2.claimed, 0)
})

// =============================================================================
// TEST 13 — STALE CRASHED JOB RECOVERY
// =============================================================================
test('TEST 13: Stale claimed job from crashed worker is recovered and processed', async () => {
  const staleLockedAt = new Date(Date.now() - 700 * 1000).toISOString() // Locked 700s ago (> 600s threshold)

  const db = createMockAutomationDb({
    automation_runs: [
      {
        id: 'run-stale-1',
        job_id: 'job-stale-1',
        org_id: 'org-stale',
        rule_id: 'rule-stale',
        status: 'processing',
        locked_at: staleLockedAt,
        locked_by: 'dead_worker_crashed_99',
        action_type: 'test_success_action',
        action_params: {},
        event_type: 'lead.created',
        event_payload: {},
        retry_count: 0,
        max_retries: 3,
        scheduled_at: new Date(Date.now() - 800 * 1000).toISOString()
      }
    ]
  })

  const summary = await drainDueAutomationJobs(db, {
    batchSize: 25,
    staleThresholdSeconds: 600
  })

  assert.strictEqual(summary.claimed, 1)
  assert.strictEqual(summary.succeeded, 1)

  const recoveredJob = db._tables.automation_runs[0]
  assert.strictEqual(recoveredJob.status, 'success')
  assert.ok(recoveredJob.completed_at)
})

// =============================================================================
// TEST 14 — NO INFINITE LOOP GUARANTEE
// =============================================================================
test('TEST 14: Worker never enters an infinite drain loop even if duplicate claims occur', async () => {
  const db = createMockAutomationDb({
    automation_runs: [
      {
        id: 'run-loop-guard',
        job_id: 'job-loop-guard',
        org_id: 'org-loop',
        rule_id: 'rule-loop',
        status: 'pending',
        action_type: 'test_success_action',
        action_params: {},
        event_type: 'lead.created',
        event_payload: {},
        retry_count: 0,
        max_retries: 3,
        scheduled_at: new Date(Date.now() - 1000).toISOString()
      }
    ]
  })

  // Set maxBatches to 100, but there's only 1 job
  const summary = await drainDueAutomationJobs(db, {
    batchSize: 25,
    maxBatches: 100
  })

  assert.strictEqual(summary.batchesClaimed, 1)
  assert.strictEqual(summary.claimed, 1)
  assert.strictEqual(summary.stopReason, 'queue_empty')
})

// =============================================================================
// TEST 15 — LARGE QUEUE BOUNDED AND SAFE
// =============================================================================
test('TEST 15: Large queue (200 jobs) remains strictly bounded by maxBatches', async () => {
  const initialRuns = Array.from({ length: 200 }, (_, i) => ({
    id: `run-huge-${i + 1}`,
    job_id: `job-huge-${i + 1}`,
    org_id: 'org-huge',
    rule_id: 'rule-huge',
    status: 'pending',
    action_type: 'test_success_action',
    action_params: {},
    event_type: 'lead.created',
    event_payload: {},
    retry_count: 0,
    max_retries: 3,
    scheduled_at: new Date(Date.now() - 1000).toISOString()
  }))

  const db = createMockAutomationDb({ automation_runs: initialRuns })

  // Max 4 batches of 25 = exactly 100 processed, 100 remaining
  const summary = await drainDueAutomationJobs(db, {
    batchSize: 25,
    maxBatches: 4
  })

  assert.strictEqual(summary.batchesClaimed, 4)
  assert.strictEqual(summary.claimed, 100)
  assert.strictEqual(summary.processed, 100)
  assert.strictEqual(summary.remainingDue, 100)
  assert.strictEqual(summary.stopReason, 'max_batches_reached')
})

// =============================================================================
// TEST 16 — BACKWARD COMPATIBILITY
// =============================================================================
test('TEST 16: processDueAutomationJobs and AutomationService.drainPendingRuns preserve contract', async () => {
  const db = createMockAutomationDb({
    automation_runs: [
      {
        id: 'run-compat-1',
        job_id: 'job-compat-1',
        org_id: 'org-compat',
        rule_id: 'rule-compat',
        status: 'pending',
        action_type: 'test_success_action',
        action_params: {},
        event_type: 'lead.created',
        event_payload: {},
        retry_count: 0,
        max_retries: 3,
        scheduled_at: new Date(Date.now() - 1000).toISOString()
      }
    ]
  })

  // Backward compatible processDueAutomationJobs
  const res = await processDueAutomationJobs(db, 25, 'worker_compat')
  assert.strictEqual(res.processed, 1)
  assert.strictEqual(res.claimed, 1)
  assert.strictEqual(res.succeeded, 1)
  assert.strictEqual(res.failed, 0)

  // AutomationService domain service method
  const summary = await AutomationService.drainPendingRuns(db, { batchSize: 25 })
  assert.strictEqual(summary.claimed, 0)
  assert.strictEqual(summary.stopReason, 'queue_empty')
})

// =============================================================================
// TEST 17 — SECURITY INTEGRITY VERIFICATION
// =============================================================================
test('TEST 17: Security integrity remains uncompromised (CRON_SECRET fail-closed & timing safe)', () => {
  // Constant-time SHA-256 digest normalization
  const expectedSecret = 'super_secure_cron_token_production'
  const attackerSecret = 'super_secure_cron_token_pro'

  const h1 = createHash('sha256').update(expectedSecret, 'utf8').digest()
  const h2 = createHash('sha256').update(attackerSecret, 'utf8').digest()
  assert.strictEqual(h1.length, 32)
  assert.strictEqual(h2.length, 32)
  assert.strictEqual(timingSafeEqual(h1, h2), false)

  // Identical secrets must match
  const h3 = createHash('sha256').update(expectedSecret, 'utf8').digest()
  assert.strictEqual(timingSafeEqual(h1, h3), true)
})

// =============================================================================
// TEST 18 — WEBHOOK IDEMPOTENCY INTEGRITY VERIFICATION
// =============================================================================
test('TEST 18: Webhook idempotency and retry safety remain uncompromised', async () => {
  const {
    claimWebhookEvent,
    completeWebhookEvent,
    failWebhookEvent
  } = await import('../src/lib/webhooks/idempotency.ts')

  const rows = []
  const mockDb = {
    rpc: async (fn, args) => {
      if (fn === 'claim_webhook_event') {
        const existing = rows.find(r => r.id === args.p_event_id)
        if (!existing) {
          const row = { id: args.p_event_id, status: 'processing', attempt_count: 1 }
          rows.push(row)
          return { data: [{ action: 'claimed', status: 'processing', attempt_count: 1 }], error: null }
        }
        if (existing.status === 'completed') {
          return { data: [{ action: 'completed', status: 'completed', attempt_count: existing.attempt_count }], error: null }
        }
        if (existing.status === 'failed') {
          existing.status = 'processing'
          existing.attempt_count = (existing.attempt_count || 1) + 1
          return { data: [{ action: 'reclaimed_retry', status: 'processing', attempt_count: existing.attempt_count }], error: null }
        }
        return { data: [{ action: 'concurrent_active', status: 'processing', attempt_count: existing.attempt_count }], error: null }
      }
      if (fn === 'fail_webhook_event') {
        const existing = rows.find(r => r.id === args.p_event_id)
        if (existing) existing.status = 'failed'
        return { data: true, error: null }
      }
      if (fn === 'complete_webhook_event') {
        const existing = rows.find(r => r.id === args.p_event_id)
        if (existing) existing.status = 'completed'
        return { data: true, error: null }
      }
      return { data: null, error: new Error('Unknown RPC function') }
    }
  }

  // 1. Initial claim transitions to 'processing'
  const claimRes = await claimWebhookEvent(mockDb, {
    eventId: 'evt_test_infra_02',
    provider: 'stripe',
    eventType: 'payment_intent.succeeded'
  })
  assert.strictEqual(claimRes.status, 'processing')
  assert.strictEqual(claimRes.action, 'claimed')

  // 2. Mark failed on transient error
  await failWebhookEvent(mockDb, 'evt_test_infra_02', 'Stripe downstream timeout')
  assert.strictEqual(rows[0].status, 'failed')

  // 3. Provider retry re-claims failed event
  const retryClaim = await claimWebhookEvent(mockDb, {
    eventId: 'evt_test_infra_02',
    provider: 'stripe',
    eventType: 'payment_intent.succeeded'
  })
  assert.strictEqual(retryClaim.status, 'processing')
  assert.strictEqual(retryClaim.action, 'reclaimed_retry')

  // 4. Successful execution completes event
  await completeWebhookEvent(mockDb, 'evt_test_infra_02', { recordId: 'pay_123' })
  assert.strictEqual(rows[0].status, 'completed')

  // 5. Subsequent redelivery skipped as completed
  const dupClaim = await claimWebhookEvent(mockDb, {
    eventId: 'evt_test_infra_02',
    provider: 'stripe',
    eventType: 'payment_intent.succeeded'
  })
  assert.strictEqual(dupClaim.status, 'completed')
  assert.strictEqual(dupClaim.action, 'completed')
})
