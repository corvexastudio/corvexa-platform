import test from 'node:test'
import assert from 'node:assert'
import { createEventEnvelope } from '../src/lib/automations/events.ts'
import { evaluateConditions, evaluateSingleCondition, getNestedValue } from '../src/lib/automations/conditions.ts'
import { evaluateAndApplyStopConditions, manualCancelAutomationRun } from '../src/lib/automations/stop-conditions.ts'
import { executeAction } from '../src/lib/automations/action-registry.ts'
import { handleAutomationEvent } from '../src/lib/automations/engine.ts'
import { executeAutomationJob, processDueAutomationJobs, calculateNextRetry } from '../src/lib/automations/worker.ts'
import { formatRunInspection } from '../src/lib/automations/observability.ts'

/**
 * In-memory Supabase mock harness for automation engine tests
 */
function createMockAutomationDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    automation_rules: initialState.automation_rules || [],
    automation_runs: initialState.automation_runs || [],
    contacts: initialState.contacts || [],
    conversations: initialState.conversations || [],
    messages: initialState.messages || [],
    leads: initialState.leads || [],
    notifications: initialState.notifications || [],
    profiles: initialState.profiles || [],
    activity_logs: initialState.activity_logs || [],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let data = [...(tables[tableName] || [])]
      let filters = []

      const queryBuilder = {
        select: (cols) => queryBuilder,
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
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
        limit: () => queryBuilder,
        then: (resolve, reject) => {
          const filtered = data.filter((row) => filters.every((fn) => fn(row)))
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject)
        },
        maybeSingle: async () => {
          const filtered = data.filter((row) => filters.every((fn) => fn(row)))
          const item = filtered[0] || null
          return { data: item, error: null }
        },
        single: async () => {
          const filtered = data.filter((row) => filters.every((fn) => fn(row)))
          if (filtered.length === 0) return { data: null, error: new Error('Row not found') }
          return { data: filtered[0], error: null }
        },
        insert: (rowOrRows) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          let insertError = null
          let insertedRows = []

          for (const row of rows) {
            const newRow = {
              id: row.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              created_at: new Date().toISOString(),
              ...row
            }

            // Check unique constraints on idempotency_key and job_id
            if (tableName === 'automation_runs') {
              if (newRow.idempotency_key && tables.automation_runs.some((r) => r.idempotency_key === newRow.idempotency_key)) {
                insertError = { code: '23505', message: 'Unique violation on idempotency_key' }
                break
              }
            }

            tables[tableName].push(newRow)
            insertedRows.push(newRow)
          }

          const lastInserted = insertedRows[insertedRows.length - 1] || null

          return {
            data: insertError ? null : lastInserted,
            error: insertError,
            select: () => ({
              single: async () => ({ data: insertError ? null : lastInserted, error: insertError }),
              maybeSingle: async () => ({ data: insertError ? null : lastInserted, error: insertError })
            }),
            then: (resolve, reject) => {
              return Promise.resolve({ data: insertError ? null : lastInserted, error: insertError }).then(resolve, reject)
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
                for (const row of tables[tableName]) {
                  if (updateFilters.every((fn) => fn(row))) {
                    Object.assign(row, updates)
                    updated = row
                  }
                }
                return { data: updated, error: null }
              },
              maybeSingle: async () => {
                let updated = null
                for (const row of tables[tableName]) {
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
              for (const row of tables[tableName]) {
                if (updateFilters.every((fn) => fn(row))) {
                  Object.assign(row, updates)
                  updated = row
                }
              }
              return Promise.resolve({ data: updated, error: null }).then(resolve, reject)
            }
          }
          return updateBuilder
        }
      }

      return queryBuilder
    }
  }

  return client
}

/**
 * -----------------------------------------------------------------------------
 * 1. EVENT MODEL & ENVELOPE TESTS
 * -----------------------------------------------------------------------------
 */
test('Events: Creates standard envelope with deterministic idempotency key', () => {
  const envelope = createEventEnvelope('lead.created', 'org-100', { name: 'Alice', urgency: 'emergency' }, {
    entityId: 'lead-555',
    contactId: 'cnt-333'
  })

  assert.strictEqual(envelope.eventType, 'lead.created')
  assert.strictEqual(envelope.orgId, 'org-100')
  assert.strictEqual(envelope.entityId, 'lead-555')
  assert.strictEqual(envelope.contactId, 'cnt-333')
  assert.strictEqual(envelope.payload.urgency, 'emergency')
  assert.ok(envelope.timestamp)
  assert.ok(envelope.id.startsWith('evt_'))
  assert.strictEqual(envelope.idempotencyKey, 'org-100:lead.created:lead-555')
})

/**
 * -----------------------------------------------------------------------------
 * 2. CONDITION EVALUATION ENGINE TESTS
 * -----------------------------------------------------------------------------
 */
test('Conditions: Evaluates nested paths, comparisons, arrays, and operators', () => {
  const context = {
    lead: {
      urgency: 'emergency',
      estimated_value: 1200,
      tags: ['vip', 'residential']
    },
    source: 'missed_call'
  }

  // Nested dot path extraction
  assert.strictEqual(getNestedValue(context, 'lead.urgency'), 'emergency')
  assert.strictEqual(getNestedValue(context, 'lead.estimated_value'), 1200)

  // Single condition evaluations
  assert.strictEqual(evaluateSingleCondition({ field: 'lead.urgency', operator: 'equals', value: 'emergency' }, context), true)
  assert.strictEqual(evaluateSingleCondition({ field: 'lead.urgency', operator: 'equals', value: 'low' }, context), false)
  assert.strictEqual(evaluateSingleCondition({ field: 'lead.estimated_value', operator: 'greater_than', value: 1000 }, context), true)
  assert.strictEqual(evaluateSingleCondition({ field: 'lead.estimated_value', operator: 'less_than', value: 500 }, context), false)
  assert.strictEqual(evaluateSingleCondition({ field: 'source', operator: 'in', value: ['missed_call', 'web'] }, context), true)
  assert.strictEqual(evaluateSingleCondition({ field: 'lead.tags', operator: 'contains', value: 'vip' }, context), true)

  // Complex rule condition set (match: all)
  const allConfig = {
    match: 'all',
    rules: [
      { field: 'lead.urgency', operator: 'equals', value: 'emergency' },
      { field: 'lead.estimated_value', operator: 'greater_than', value: 1000 }
    ]
  }
  assert.strictEqual(evaluateConditions(allConfig, context), true)

  // Non-matching rule
  const failingConfig = {
    match: 'all',
    rules: [
      { field: 'lead.urgency', operator: 'equals', value: 'low' }
    ]
  }
  assert.strictEqual(evaluateConditions(failingConfig, context), false)
})

/**
 * -----------------------------------------------------------------------------
 * 3. ACTION REGISTRY TESTS
 * -----------------------------------------------------------------------------
 */
test('Actions: Executes change_status, add_tag, and create_notification', async () => {
  const db = createMockAutomationDb({
    leads: [{ id: 'lead-1', org_id: 'org-1', status: 'new' }],
    contacts: [{ id: 'cnt-1', org_id: 'org-1', phone: '+12145550199', tags: ['lead'] }],
    profiles: [{ id: 'usr-owner', org_id: 'org-1', role: 'owner' }]
  })

  // 1. change_status
  const statusRes = await executeAction('change_status', {
    entity_type: 'leads',
    entity_id: 'lead-1',
    status: 'contacted'
  }, { supabase: db, orgId: 'org-1' })
  assert.strictEqual(statusRes.success, true)
  assert.strictEqual(db._tables.leads[0].status, 'contacted')

  // 2. add_tag
  const tagRes = await executeAction('add_tag', {
    contact_id: 'cnt-1',
    tag: 'high_value'
  }, { supabase: db, orgId: 'org-1' })
  assert.strictEqual(tagRes.success, true)
  assert.ok(db._tables.contacts[0].tags.includes('high_value'))

  // 3. create_notification
  const notifRes = await executeAction('create_notification', {
    title: 'New Emergency Lead',
    message: 'A high urgency lead was booked'
  }, { supabase: db, orgId: 'org-1' })
  assert.strictEqual(notifRes.success, true)
  assert.strictEqual(db._tables.notifications.length, 1)
  assert.strictEqual(db._tables.notifications[0].title, 'New Emergency Lead')
})

/**
 * -----------------------------------------------------------------------------
 * 4. IMMEDIATE VS SCHEDULED AUTOMATION ENGINE TESTS
 * -----------------------------------------------------------------------------
 */
test('Engine: Executes immediate automation rule and transitions run to success', async () => {
  const db = createMockAutomationDb({
    organizations: [{ id: 'org-1', name: 'Apex AC' }],
    automation_rules: [
      {
        id: 'rule-immediate',
        org_id: 'org-1',
        name: 'Auto Tag New Leads',
        trigger_type: 'lead.created',
        version: 1,
        status: 'active',
        is_active: true,
        delay_seconds: 0,
        conditions: { 'urgency': 'emergency' },
        actions: [
          { type: 'create_task', params: { title: 'Emergency Dispatch Required' } }
        ]
      }
    ]
  })

  const event = createEventEnvelope('lead.created', 'org-1', {
    urgency: 'emergency',
    name: 'John Doe'
  }, { entityId: 'lead-999' })

  const result = await handleAutomationEvent(db, event)
  assert.strictEqual(result.matchedRulesCount, 1)
  assert.strictEqual(result.enqueuedJobsCount, 1)

  // Verify run record succeeded immediately
  assert.strictEqual(db._tables.automation_runs.length, 1)
  const run = db._tables.automation_runs[0]
  assert.strictEqual(run.status, 'success')
  assert.strictEqual(run.action_type, 'create_task')
  assert.ok(run.completed_at)
})

test('Engine: Schedules delayed automation rule (delay_seconds > 0) with status scheduled', async () => {
  const db = createMockAutomationDb({
    automation_rules: [
      {
        id: 'rule-delayed',
        org_id: 'org-1',
        name: '5-Minute Followup SMS',
        trigger_type: 'call.missed',
        version: 1,
        status: 'active',
        is_active: true,
        delay_seconds: 300, // 5 minutes delay
        actions: [{ type: 'send_sms', params: { text: 'Checking in on you!' } }]
      }
    ]
  })

  const event = createEventEnvelope('call.missed', 'org-1', {
    callerNumber: '+12145550199'
  })

  const result = await handleAutomationEvent(db, event)
  assert.strictEqual(result.matchedRulesCount, 1)
  assert.strictEqual(result.enqueuedJobsCount, 1)

  // Verify run record is scheduled in the future and not yet completed
  assert.strictEqual(db._tables.automation_runs.length, 1)
  const run = db._tables.automation_runs[0]
  assert.strictEqual(run.status, 'scheduled')
  assert.ok(!run.completed_at)
  assert.ok(new Date(run.scheduled_at) > new Date())
})

/**
 * -----------------------------------------------------------------------------
 * 5. STOP CONDITIONS TESTS
 * -----------------------------------------------------------------------------
 */
test('Stop Conditions: Cancels scheduled lead follow-up when customer replies', async () => {
  const futureDate = new Date(Date.now() + 600000).toISOString()
  const db = createMockAutomationDb({
    automation_runs: [
      {
        id: 'run-pending-followup',
        org_id: 'org-1',
        rule_id: 'rule-lead-nurture',
        status: 'scheduled',
        event_payload: { contact_id: 'cnt-target-1', phone: '+12145550100' },
        scheduled_at: futureDate
      }
    ]
  })

  // Customer replies via inbound SMS
  const inboundMessageEvent = createEventEnvelope('message.received', 'org-1', {
    contact_id: 'cnt-target-1',
    text: 'Yes I am interested, please call me!'
  }, { contactId: 'cnt-target-1' })

  const stopResult = await evaluateAndApplyStopConditions(db, inboundMessageEvent)
  assert.strictEqual(stopResult.triggered, true)
  assert.strictEqual(stopResult.stopCondition, 'customer_replied')
  assert.strictEqual(stopResult.cancelledRunIds.length, 1)

  // Verify database record transitioned to cancelled
  const cancelledRun = db._tables.automation_runs[0]
  assert.strictEqual(cancelledRun.status, 'cancelled')
  assert.match(cancelledRun.failure_reason, /customer_replied/)
})

test('Stop Conditions: Cancels scheduled follow-up when lead is marked lost', async () => {
  const futureDate = new Date(Date.now() + 600000).toISOString()
  const db = createMockAutomationDb({
    automation_runs: [
      {
        id: 'run-lead-seq',
        org_id: 'org-1',
        status: 'scheduled',
        event_payload: { lead_id: 'lead-lost-target' },
        scheduled_at: futureDate
      }
    ]
  })

  // Lead status updated to lost
  const leadUpdatedEvent = createEventEnvelope('lead.updated', 'org-1', {
    lead_id: 'lead-lost-target',
    status: 'lost'
  }, { entityId: 'lead-lost-target' })

  const stopResult = await evaluateAndApplyStopConditions(db, leadUpdatedEvent)
  assert.strictEqual(stopResult.triggered, true)
  assert.strictEqual(stopResult.stopCondition, 'lead_lost')

  const cancelledRun = db._tables.automation_runs[0]
  assert.strictEqual(cancelledRun.status, 'cancelled')
  assert.match(cancelledRun.failure_reason, /lead_lost/)
})

test('Stop Conditions: Manual cancellation terminates pending run', async () => {
  const db = createMockAutomationDb({
    automation_runs: [
      {
        id: 'run-manual-target',
        org_id: 'org-1',
        status: 'pending'
      }
    ]
  })

  const cancelled = await manualCancelAutomationRun(db, 'run-manual-target', 'Dispatcher stopped follow-up')
  assert.strictEqual(cancelled, true)
  assert.strictEqual(db._tables.automation_runs[0].status, 'cancelled')
  assert.match(db._tables.automation_runs[0].failure_reason, /Dispatcher stopped follow-up/)
})

/**
 * -----------------------------------------------------------------------------
 * 6. EXPONENTIAL BACKOFF RETRIES & DEAD-LETTER QUEUE TESTS
 * -----------------------------------------------------------------------------
 */
test('Worker: Calculates exponential backoff with cap', () => {
  const r0 = calculateNextRetry(0, 60)
  const r1 = calculateNextRetry(1, 60)
  const r2 = calculateNextRetry(2, 60)

  // Delay increases with attempt count
  assert.ok(r0.getTime() > Date.now())
  assert.ok(r1.getTime() > r0.getTime())
  assert.ok(r2.getTime() > r1.getTime())
})

test('Worker: Retries transient failure and increments retry count with exponential delay', async () => {
  const db = createMockAutomationDb()

  const failingJob = {
    id: 'job-transient-fail',
    job_id: 'job_111',
    org_id: 'org-1',
    rule_id: 'rule-1',
    action_type: 'non_existent_action', // Triggers action failure
    action_params: {},
    event_type: 'lead.created',
    event_payload: {},
    status: 'pending',
    retry_count: 0,
    max_retries: 3,
    scheduled_at: new Date().toISOString()
  }

  db._tables.automation_runs.push(failingJob)

  const result = await executeAutomationJob(db, failingJob)
  assert.strictEqual(result.success, false)

  // Verify retry was scheduled
  const updatedJob = db._tables.automation_runs[0]
  assert.strictEqual(updatedJob.status, 'pending')
  assert.strictEqual(updatedJob.retry_count, 1)
  assert.match(updatedJob.failure_reason, /Transient failure/)
})

test('Worker: Transitions to dead_letter state when max retries are exhausted', async () => {
  const db = createMockAutomationDb()

  const finalAttemptJob = {
    id: 'job-dead-letter-test',
    job_id: 'job_222',
    org_id: 'org-1',
    rule_id: 'rule-1',
    action_type: 'non_existent_action',
    action_params: {},
    event_type: 'lead.created',
    event_payload: {},
    status: 'pending',
    retry_count: 2, // 3rd attempt about to fail
    max_retries: 3,
    scheduled_at: new Date().toISOString()
  }

  db._tables.automation_runs.push(finalAttemptJob)

  const result = await executeAutomationJob(db, finalAttemptJob)
  assert.strictEqual(result.success, false)

  // Verify transitioned to dead_letter
  const deadJob = db._tables.automation_runs[0]
  assert.strictEqual(deadJob.status, 'dead_letter')
  assert.strictEqual(deadJob.retry_count, 3)
  assert.match(deadJob.failure_reason, /Max retries \(3\) exhausted/)
})

/**
 * -----------------------------------------------------------------------------
 * 7. IDEMPOTENCY PROTECTION TESTS
 * -----------------------------------------------------------------------------
 */
test('Engine: Idempotency key prevents duplicate execution for identical event & action', async () => {
  const db = createMockAutomationDb({
    automation_rules: [
      {
        id: 'rule-idempotent',
        org_id: 'org-1',
        name: 'Single SMS Trigger',
        trigger_type: 'lead.created',
        version: 1,
        status: 'active',
        is_active: true,
        delay_seconds: 60,
        actions: [{ type: 'send_sms', params: { text: 'Hello' } }]
      }
    ]
  })

  const event = createEventEnvelope('lead.created', 'org-1', { id: 'lead-xyz' }, {
    entityId: 'lead-xyz',
    idempotencyKey: 'fixed_idempotency_key_777'
  })

  // First dispatch: 1 job enqueued
  const res1 = await handleAutomationEvent(db, event)
  assert.strictEqual(res1.enqueuedJobsCount, 1)

  // Second duplicate dispatch: 0 duplicate jobs enqueued
  const res2 = await handleAutomationEvent(db, event)
  assert.strictEqual(res2.enqueuedJobsCount, 0)
  assert.strictEqual(db._tables.automation_runs.length, 1)
})

/**
 * -----------------------------------------------------------------------------
 * 8. OBSERVABILITY INSPECTION TESTS (THE 6 QUESTIONS)
 * -----------------------------------------------------------------------------
 */
test('Observability: formatRunInspection answers all 6 observability questions', () => {
  const rawRunRow = {
    id: 'run-audit-123',
    job_id: 'job_audit_456',
    org_id: 'org-tenant-blue',
    rule_id: 'rule-789',
    rule_name: 'VIP Lead Fast Track',
    event_type: 'lead.created',
    event_payload: { lead_id: 'lead-888', urgency: 'emergency' },
    action_type: 'send_sms',
    action_params: { text: 'VIP dispatch en route' },
    status: 'failed',
    retry_count: 1,
    max_retries: 3,
    scheduled_at: '2026-10-03T19:30:00.000Z',
    started_at: '2026-10-03T19:25:00.000Z',
    completed_at: null,
    failure_reason: 'Telnyx rate limit',
    execution_log: [{ attempt: 1, error: 'Rate limit' }]
  }

  const inspection = formatRunInspection(rawRunRow)

  // Q1: What automation ran?
  assert.strictEqual(inspection.automation.ruleId, 'rule-789')
  assert.strictEqual(inspection.automation.ruleName, 'VIP Lead Fast Track')
  assert.strictEqual(inspection.automation.tenantId, 'org-tenant-blue')

  // Q2: Why did it run?
  assert.strictEqual(inspection.trigger.eventType, 'lead.created')
  assert.strictEqual(inspection.trigger.payload.urgency, 'emergency')

  // Q3: What action did it perform?
  assert.strictEqual(inspection.action.type, 'send_sms')
  assert.strictEqual(inspection.action.params.text, 'VIP dispatch en route')

  // Q4: Did it succeed?
  assert.strictEqual(inspection.outcome.succeeded, false)
  assert.strictEqual(inspection.outcome.status, 'failed')

  // Q5: If it failed, why?
  assert.strictEqual(inspection.failure.failed, true)
  assert.strictEqual(inspection.failure.reason, 'Telnyx rate limit')

  // Q6: Will it retry?
  assert.strictEqual(inspection.retry.willRetry, true)
  assert.strictEqual(inspection.retry.currentAttempt, 1)
  assert.strictEqual(inspection.retry.maxRetries, 3)
  assert.strictEqual(inspection.retry.nextScheduledAt, '2026-10-03T19:30:00.000Z')
})
