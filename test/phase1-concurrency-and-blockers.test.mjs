process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert'
import {
  claimDueAutomationJobs,
  processDueAutomationJobs,
  executeAutomationJob
} from '../src/lib/automations/worker.ts'
import {
  generateDocumentNumber,
  resetInMemoryDocumentCounters
} from '../src/lib/services/document-counter.ts'
import { createQuote } from '../src/lib/quotes/quote-manager.ts'
import { createInvoice } from '../src/lib/payments/invoice-manager.ts'
import { createJob } from '../src/lib/jobs/job-manager.ts'
import { resolveOrganizationByPhoneNumber } from '../src/lib/telephony/telnyx-numbers.ts'
import { provisionOrganizationPhoneNumber } from '../src/lib/telephony/provisioning.ts'
import { processMissedCall } from '../src/lib/services/call-recovery.ts'
import { evaluateCallOutcome } from '../src/lib/telephony/call-state-machine.ts'

/**
 * High-fidelity in-memory Supabase database harness for Phase 1 Concurrency & Blocker testing.
 * Supports table operations, simulated row locking, and atomic RPC simulation.
 */
function createPhase1MockDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers || [],
    document_counters: initialState.document_counters || [],
    automation_runs: initialState.automation_runs || [],
    contacts: initialState.contacts || [],
    conversations: initialState.conversations || [],
    messages: initialState.messages || [],
    calls: initialState.calls || [],
    leads: initialState.leads || [],
    quotes: initialState.quotes || [],
    quote_items: initialState.quote_items || [],
    invoices: initialState.invoices || [],
    invoice_items: initialState.invoice_items || [],
    jobs: initialState.jobs || [],
    job_items: initialState.job_items || [],
    activity_logs: initialState.activity_logs || []
  }

  const client = {
    _tables: tables,
    rpc: async (fnName, args) => {
      // 1. Simulate PostgreSQL atomic function next_document_number
      if (fnName === 'next_document_number') {
        const { p_org_id, p_doc_type, p_year } = args
        let row = tables.document_counters.find(
          (c) => c.org_id === p_org_id && c.document_type === p_doc_type && c.year === p_year
        )
        if (!row) {
          row = {
            id: `counter_${Date.now()}_${Math.random()}`,
            org_id: p_org_id,
            document_type: p_doc_type,
            year: p_year,
            next_value: 2,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          tables.document_counters.push(row)
          return { data: 1, error: null }
        } else {
          const currentVal = row.next_value
          row.next_value += 1
          row.updated_at = new Date().toISOString()
          return { data: currentVal, error: null }
        }
      }

      // 2. Simulate PostgreSQL atomic function claim_due_automation_runs (FOR UPDATE SKIP LOCKED)
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
            // Atomically lock and transition row
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

      const queryBuilder = {
        select: (cols) => queryBuilder,
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return queryBuilder
        },
        neq: (col, val) => {
          filters.push((row) => row[col] !== val)
          return queryBuilder
        },
        in: (col, arr) => {
          filters.push((row) => arr.includes(row[col]))
          return queryBuilder
        },
        lte: (col, val) => {
          filters.push((row) => new Date(row[col]) <= new Date(val))
          return queryBuilder
        },
        gte: (col, val) => {
          filters.push((row) => new Date(row[col]) >= new Date(val))
          return queryBuilder
        },
        order: () => queryBuilder,
        limit: (n) => queryBuilder,
        then: (resolve, reject) => {
          const tableData = tables[tableName] || []
          let filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject)
        },
        maybeSingle: async () => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          const item = filtered[0] || null
          if (item && tableName === 'telnyx_phone_numbers') {
            const org = tables.organizations.find((o) => o.id === item.org_id)
            return { data: { ...item, organizations: org }, error: null }
          }
          return { data: item, error: null }
        },
        single: async () => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          if (filtered.length === 0) return { data: null, error: new Error('Row not found') }
          const item = filtered[0]
          return { data: item, error: null }
        },
        insert: (rowOrRows) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          let insertErr = null
          const inserted = []

          for (const row of rows) {
            const newRow = {
              id: row.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              created_at: new Date().toISOString(),
              ...row
            }

            // Enforce UNIQUE(phone_number) on telnyx_phone_numbers
            if (tableName === 'telnyx_phone_numbers') {
              const collision = tables.telnyx_phone_numbers.find(
                (n) => n.phone_number === newRow.phone_number && n.status === 'active'
              )
              if (collision) {
                insertErr = { code: '23505', message: `Duplicate active phone number ${newRow.phone_number}` }
                break
              }
            }

            if (!tables[tableName]) tables[tableName] = []
            tables[tableName].push(newRow)
            inserted.push(newRow)
          }

          const last = inserted[inserted.length - 1] || null
          return {
            data: insertErr ? null : last,
            error: insertErr,
            select: () => ({
              single: async () => ({ data: insertErr ? null : last, error: insertErr }),
              maybeSingle: async () => ({ data: insertErr ? null : last, error: insertErr })
            }),
            then: (resolve, reject) => {
              return Promise.resolve({ data: insertErr ? null : last, error: insertErr }).then(resolve, reject)
            }
          }
        },
        update: (updates) => {
          const updateFilters = []
          const updateBuilder = {
            eq: (col, val) => {
              updateFilters.push((row) => row[col] === val)
              return updateBuilder
            },
            in: (col, arr) => {
              updateFilters.push((row) => arr.includes(row[col]))
              return updateBuilder
            },
            select: () => ({
              single: async () => {
                let updated = null
                for (const row of tables[tableName] || []) {
                  if (updateFilters.every((fn) => fn(row))) {
                    Object.assign(row, updates)
                    updated = row
                  }
                }
                return { data: updated, error: null }
              },
              maybeSingle: async () => {
                let updated = null
                for (const row of tables[tableName] || []) {
                  if (updateFilters.every((fn) => fn(row))) {
                    Object.assign(row, updates)
                    updated = row
                  }
                }
                return { data: updated, error: null }
              }
            }),
            then: (resolve, reject) => {
              let updated = null
              for (const row of tables[tableName] || []) {
                if (updateFilters.every((fn) => fn(row))) {
                  Object.assign(row, updates)
                  updated = row
                }
              }
              return Promise.resolve({ data: updated, error: null }).then(resolve, reject)
            }
          }
          return updateBuilder
        },
        upsert: (record, opts = {}) => {
          const onConflict = opts.onConflict || 'id'
          const conflictCol = onConflict.split(',')[0].trim()
          if (!tables[tableName]) tables[tableName] = []
          const existingIdx = tables[tableName].findIndex((r) => r[conflictCol] === record[conflictCol])
          let target
          if (existingIdx >= 0) {
            Object.assign(tables[tableName][existingIdx], record)
            target = tables[tableName][existingIdx]
          } else {
            const newRow = {
              id: record.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              created_at: new Date().toISOString(),
              ...record
            }
            tables[tableName].push(newRow)
            target = newRow
          }
          return {
            data: target,
            error: null,
            select: () => ({
              single: async () => ({ data: target, error: null }),
              maybeSingle: async () => ({ data: target, error: null })
            }),
            then: (resolve, reject) => Promise.resolve({ data: target, error: null }).then(resolve, reject)
          }
        }
      }

      return queryBuilder
    }
  }

  return client
}

// =============================================================================
// CRITICAL ISSUE 1: AUTOMATION WORKER CONCURRENCY & ROW CLAIMING TESTS
// =============================================================================

test('Issue 1: Concurrent Workers A and B race for 10 eligible jobs - exactly 0 duplicate claims', async () => {
  const initialRuns = Array.from({ length: 10 }, (_, i) => ({
    id: `run-${i + 1}`,
    job_id: `job-due-${i + 1}`,
    org_id: 'org-test-concurrency',
    rule_id: 'rule-missed-call',
    status: 'scheduled',
    action_type: 'send_sms',
    action_params: { text: `Hello prospect ${i + 1}` },
    event_type: 'call.missed',
    event_payload: { contact_id: `contact-${i + 1}` },
    retry_count: 0,
    max_retries: 3,
    scheduled_at: new Date(Date.now() - 5000).toISOString() // 5s in past
  }))

  const db = createPhase1MockDb({ automation_runs: initialRuns })

  // Launch Worker A and Worker B concurrently
  const [workerARuns, workerBRuns] = await Promise.all([
    claimDueAutomationJobs(db, 'worker_alpha', 10),
    claimDueAutomationJobs(db, 'worker_beta', 10)
  ])

  // Total claimed across both workers must equal exactly 10
  const totalClaimed = workerARuns.length + workerBRuns.length
  assert.strictEqual(totalClaimed, 10, 'Worker A + Worker B must collectively claim all 10 jobs')

  // Check for any duplicate IDs between worker A and worker B
  const idsA = new Set(workerARuns.map((r) => r.id))
  const idsB = new Set(workerBRuns.map((r) => r.id))
  const intersection = [...idsA].filter((id) => idsB.has(id))

  assert.strictEqual(intersection.length, 0, 'ZERO jobs may be claimed by both Worker A and Worker B')

  // All jobs in database must now be in 'processing' status with lock metadata
  for (const row of db._tables.automation_runs) {
    assert.strictEqual(row.status, 'processing')
    assert.ok(row.locked_at, 'locked_at must be populated')
    assert.ok(row.locked_by === 'worker_alpha' || row.locked_by === 'worker_beta')
  }
})

test('Issue 1: High concurrency stress test - 3 workers race on 30 eligible jobs with 0 collisions', async () => {
  const initialRuns = Array.from({ length: 30 }, (_, i) => ({
    id: `stress-run-${i + 1}`,
    job_id: `stress-job-${i + 1}`,
    org_id: 'org-stress',
    rule_id: 'rule-quote-followup',
    status: 'pending',
    action_type: 'send_sms',
    action_params: { text: 'Quote check' },
    event_type: 'quote.sent',
    event_payload: {},
    retry_count: 0,
    max_retries: 3,
    scheduled_at: new Date(Date.now() - 1000).toISOString()
  }))

  const db = createPhase1MockDb({ automation_runs: initialRuns })

  // Run 3 workers simultaneously
  const [runs1, runs2, runs3] = await Promise.all([
    claimDueAutomationJobs(db, 'worker_1', 15),
    claimDueAutomationJobs(db, 'worker_2', 15),
    claimDueAutomationJobs(db, 'worker_3', 15)
  ])

  const allClaimedIds = [...runs1, ...runs2, ...runs3].map((r) => r.id)
  const uniqueClaimedIds = new Set(allClaimedIds)

  assert.strictEqual(allClaimedIds.length, 30, 'All 30 jobs must be claimed across the 3 workers')
  assert.strictEqual(uniqueClaimedIds.size, 30, 'All claimed job IDs must be strictly unique (0 duplicates)')
})

test('Issue 1: Crash Recovery - Worker recovers stale job stranded in processing state', async () => {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const db = createPhase1MockDb({
    automation_runs: [
      {
        id: 'crashed-job-1',
        job_id: 'job-crashed-lambda',
        org_id: 'org-test',
        rule_id: 'rule-1',
        status: 'processing',
        action_type: 'send_sms',
        action_params: { text: 'Recheck' },
        event_type: 'call.missed',
        event_payload: {},
        retry_count: 0,
        max_retries: 3,
        scheduled_at: fifteenMinutesAgo,
        locked_at: fifteenMinutesAgo,
        locked_by: 'dead_worker_pid_9999'
      }
    ]
  })

  // New healthy worker starts claiming
  const claimed = await claimDueAutomationJobs(db, 'healthy_worker_live', 25, 600) // 10 min threshold

  assert.strictEqual(claimed.length, 1, 'Stale job must be safely claimed by healthy worker')
  assert.strictEqual(claimed[0].id, 'crashed-job-1')
  assert.strictEqual(claimed[0].status, 'processing')
  assert.strictEqual(claimed[0].locked_by, 'healthy_worker_live')
  assert.strictEqual(claimed[0].retry_count, 1, 'Retry count must be incremented upon recovering crashed run')
})

test('Issue 1: Crash Recovery respects max_retries limit and does not recover exhausted jobs', async () => {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const db = createPhase1MockDb({
    automation_runs: [
      {
        id: 'exhausted-crashed-job',
        job_id: 'job-exhausted',
        org_id: 'org-test',
        rule_id: 'rule-1',
        status: 'processing',
        action_type: 'send_sms',
        action_params: {},
        event_type: 'call.missed',
        event_payload: {},
        retry_count: 3, // Already reached max_retries
        max_retries: 3,
        scheduled_at: fifteenMinutesAgo,
        locked_at: fifteenMinutesAgo,
        locked_by: 'dead_worker_old'
      }
    ]
  })

  const claimed = await claimDueAutomationJobs(db, 'worker_new', 25, 600)
  assert.strictEqual(claimed.length, 0, 'Exhausted job exceeding max_retries must NOT be recovered')
})

// =============================================================================
// CRITICAL ISSUE 2: MULTI-TENANT TELNYX PHONE COLLISION & PROVISIONING TESTS
// =============================================================================

test('Issue 2: Organization A gets number X; Organization B attempting to get number X is REJECTED', async () => {
  const db = createPhase1MockDb({
    organizations: [
      { id: 'org-a', name: 'Alpha Plumbing', telnyx_phone_number: '+12145550100', phone_provisioning_status: 'active' },
      { id: 'org-b', name: 'Beta Roofing', telnyx_phone_number: null, phone_provisioning_status: 'pending_number' }
    ],
    telnyx_phone_numbers: [
      { id: 'num-1', org_id: 'org-a', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  // Org B attempts to provision the exact same number +12145550100
  const result = await provisionOrganizationPhoneNumber(db, {
    orgId: 'org-b',
    preferredNumberOrAreaCode: '+12145550100'
  })

  assert.strictEqual(result.success, false, 'Provisioning duplicate phone number must fail')
  assert.strictEqual(result.status, 'failed')
  assert.match(result.error || '', /already assigned to another organization/)

  // Verify Org B did not receive the number
  const orgB = db._tables.organizations.find((o) => o.id === 'org-b')
  assert.strictEqual(orgB.telnyx_phone_number, null)
})

test('Issue 2: Inbound call to number X routes strictly and ONLY to Organization A', async () => {
  const db = createPhase1MockDb({
    organizations: [
      {
        id: 'org-a',
        name: 'Alpha HVAC',
        is_missed_call_active: true,
        telnyx_phone_number: '+12145550100',
        business_hours: { monday: { open: '00:00', close: '23:59', closed: false } }
      },
      {
        id: 'org-b',
        name: 'Beta Electric',
        is_missed_call_active: true,
        telnyx_phone_number: '+12145550200',
        business_hours: { monday: { open: '00:00', close: '23:59', closed: false } }
      }
    ],
    telnyx_phone_numbers: [
      { id: 'num-a', org_id: 'org-a', phone_number: '+12145550100', status: 'active' },
      { id: 'num-b', org_id: 'org-b', phone_number: '+12145550200', status: 'active' }
    ]
  })

  const resolution = await resolveOrganizationByPhoneNumber(db, '+12145550100')
  assert.ok(resolution, 'Resolution must succeed for assigned phone number')
  assert.strictEqual(resolution.org.id, 'org-a')
  assert.strictEqual(resolution.org.name, 'Alpha HVAC')

  // Execute missed call recovery
  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 15
  })

  const callResult = await processMissedCall(db, {
    callerNumber: '+19725550999',
    calledNumber: '+12145550100',
    callOutcome
  })

  assert.strictEqual(callResult.success, true)
  assert.strictEqual(callResult.orgId, 'org-a', 'Missed call event must be credited strictly to Org A')

  // Verify database record belongs strictly to Org A
  assert.strictEqual(db._tables.calls.length, 1)
  assert.strictEqual(db._tables.calls[0].org_id, 'org-a')
  assert.strictEqual(db._tables.leads.length, 1)
  assert.strictEqual(db._tables.leads[0].org_id, 'org-a')
})

test('Issue 2: Organization without phone has null telnyx_phone_number and pending_number state', async () => {
  const db = createPhase1MockDb({
    organizations: [
      { id: 'org-new', name: 'Fresh Start Landscaping', telnyx_phone_number: null, phone_provisioning_status: 'pending_number' }
    ]
  })

  const org = db._tables.organizations[0]
  assert.strictEqual(org.telnyx_phone_number, null, 'Must not assign fake or shared phone number')
  assert.strictEqual(org.phone_provisioning_status, 'pending_number')

  // Inbound call to an unassigned number returns null safely
  const lookup = await resolveOrganizationByPhoneNumber(db, '+16823808060')
  assert.strictEqual(lookup, null, 'Unassigned or shared numbers must not arbitrarily resolve')
})

test('Issue 2: Duplicate provisioning requests are idempotent and return the existing number', async () => {
  const db = createPhase1MockDb({
    organizations: [
      { id: 'org-idempotent', name: 'Steady Trades', telnyx_phone_number: null, phone_provisioning_status: 'pending_number' }
    ]
  })

  // First request: provisions dedicated number
  const res1 = await provisionOrganizationPhoneNumber(db, {
    orgId: 'org-idempotent',
    preferredNumberOrAreaCode: '+12145558888'
  })

  assert.strictEqual(res1.success, true)
  assert.strictEqual(res1.status, 'active')
  assert.strictEqual(res1.phoneNumber, '+12145558888')

  // Second duplicate request: detects existing number idempotently
  const res2 = await provisionOrganizationPhoneNumber(db, {
    orgId: 'org-idempotent',
    preferredNumberOrAreaCode: '+12145558888'
  })

  assert.strictEqual(res2.success, true)
  assert.strictEqual(res2.status, 'already_assigned')
  assert.strictEqual(res2.phoneNumber, '+12145558888')

  // Ensure only 1 number record was created in the database
  assert.strictEqual(db._tables.telnyx_phone_numbers.length, 1)
})

test('Issue 2: Inbound routing rejects ambiguous mappings safely if multiple records share number', async () => {
  const db = createPhase1MockDb({
    organizations: [
      { id: 'org-1', name: 'Tenant One' },
      { id: 'org-2', name: 'Tenant Two' }
    ],
    telnyx_phone_numbers: [
      { id: 'num-1', org_id: 'org-1', phone_number: '+12145559999', status: 'active' },
      { id: 'num-2', org_id: 'org-2', phone_number: '+12145559999', status: 'active' }
    ]
  })

  // When ambiguous mappings exist, resolveOrganizationByPhoneNumber must reject to prevent cross-tenant data leaks
  const resolved = await resolveOrganizationByPhoneNumber(db, '+12145559999')
  assert.strictEqual(resolved, null, 'Ambiguous number must return null safely')
})

// =============================================================================
// CRITICAL ISSUE 3: QUOTE, INVOICE, AND JOB NUMBER COLLISION TESTS
// =============================================================================

test('Issue 3: Sequential document generation creates human-readable non-modulo numbers', async () => {
  resetInMemoryDocumentCounters()
  const db = createPhase1MockDb()

  const q1 = await generateDocumentNumber(db, 'org-seq', 'quote', { year: 2026 })
  const q2 = await generateDocumentNumber(db, 'org-seq', 'quote', { year: 2026 })
  const inv1 = await generateDocumentNumber(db, 'org-seq', 'invoice', { year: 2026 })
  const job1 = await generateDocumentNumber(db, 'org-seq', 'job', { year: 2026 })

  assert.strictEqual(q1, 'QT-2026-000001')
  assert.strictEqual(q2, 'QT-2026-000002')
  assert.strictEqual(inv1, 'INV-2026-000001')
  assert.strictEqual(job1, 'JOB-2026-000001')
})

test('Issue 3: Multi-tenant isolation - Org A and Org B document counters operate independently', async () => {
  resetInMemoryDocumentCounters()
  const db = createPhase1MockDb()

  const invA1 = await generateDocumentNumber(db, 'org-alpha', 'invoice', { year: 2026 })
  const invB1 = await generateDocumentNumber(db, 'org-beta', 'invoice', { year: 2026 })
  const invA2 = await generateDocumentNumber(db, 'org-alpha', 'invoice', { year: 2026 })

  assert.strictEqual(invA1, 'INV-2026-000001')
  assert.strictEqual(invB1, 'INV-2026-000001')
  assert.strictEqual(invA2, 'INV-2026-000002')
})

test('Issue 3: Year rollover resets sequence counter cleanly to 000001 for new year', async () => {
  resetInMemoryDocumentCounters()
  const db = createPhase1MockDb()

  const q2026 = await generateDocumentNumber(db, 'org-rollover', 'quote', { year: 2026 })
  const q2027 = await generateDocumentNumber(db, 'org-rollover', 'quote', { year: 2027 })

  assert.strictEqual(q2026, 'QT-2026-000001')
  assert.strictEqual(q2027, 'QT-2027-000001')
})

test('Issue 3: High-frequency document generation (100+ documents rapidly) produces ZERO collisions', async () => {
  resetInMemoryDocumentCounters()
  const db = createPhase1MockDb()

  const generated = []
  for (let i = 0; i < 100; i++) {
    const num = await generateDocumentNumber(db, 'org-high-volume', 'invoice', { year: 2026 })
    generated.push(num)
  }

  assert.strictEqual(generated.length, 100)
  const uniqueSet = new Set(generated)
  assert.strictEqual(uniqueSet.size, 100, 'All 100 rapid invoice numbers must be unique')
  assert.strictEqual(generated[0], 'INV-2026-000001')
  assert.strictEqual(generated[99], 'INV-2026-000100')
})

test('Issue 3: Concurrent creation from simultaneous requests produces strictly unique identifiers', async () => {
  resetInMemoryDocumentCounters()
  const db = createPhase1MockDb()

  // Fire 20 simultaneous requests
  const promises = Array.from({ length: 20 }, () =>
    generateDocumentNumber(db, 'org-concurrent', 'job', { year: 2026 })
  )

  const results = await Promise.all(promises)
  const uniqueResults = new Set(results)

  assert.strictEqual(uniqueResults.size, 20, 'All 20 concurrent job numbers must be unique with ZERO collisions')
})
