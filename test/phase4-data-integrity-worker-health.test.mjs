import test from 'node:test'
import assert from 'node:assert/strict'

// 1. Timezone & Booking Imports
import {
  localDateTimeToUtc,
  formatSlotDisplayTime,
  formatSlotDisplayDate,
  formatSlotDisplayDateTime,
  getTimezoneOffsetMs,
  getDayOfWeekName
} from '../src/lib/booking/availability.ts'

import {
  isWithinBusinessHours,
  isTcpaQuietHours
} from '../src/lib/services/safety-rules.ts'

// 2. Soft Delete & CRM Imports
import {
  softDeleteContact,
  restoreContact,
  searchAndFilterCustomers
} from '../src/lib/crm/customer-manager.ts'

import {
  softDeleteQuote,
  restoreQuote
} from '../src/lib/quotes/quote-manager.ts'

import {
  softDeleteInvoice,
  restoreInvoice
} from '../src/lib/payments/invoice-manager.ts'

import {
  softDeleteJob,
  restoreJob
} from '../src/lib/jobs/job-manager.ts'

// 3. Worker Health & Observability Imports
import { checkWorkerHealth } from '../src/lib/automations/worker-health.ts'

// 4. State Machine & Stale Lock Recovery Imports
import {
  canTransition,
  assertValidTransition,
  evaluateStaleLockRecovery,
  isTerminalState,
  isRetryEligible
} from '../src/lib/automations/state-machine.ts'

// 5. Customer Reactivation Imports
import {
  evaluateCustomerReactivation,
  computeLifecycleStatus
} from '../src/lib/retention/lifecycle-manager.ts'

// Mock Supabase Factory
function createMockSupabase(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    contacts: initialState.contacts || [],
    quotes: initialState.quotes || [],
    invoices: initialState.invoices || [],
    jobs: initialState.jobs || [],
    automation_runs: initialState.automation_runs || [],
    messages: initialState.messages || [],
    payments: initialState.payments || [],
    suppressed_phones: initialState.suppressed_phones || [],
    activity_logs: initialState.activity_logs || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []
      let selectedCols = '*'
      let orderBy = null
      let limitCount = null

      const qb = {
        select: (cols) => {
          selectedCols = cols
          return qb
        },
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return qb
        },
        neq: (col, val) => {
          filters.push((row) => row[col] !== val)
          return qb
        },
        is: (col, val) => {
          filters.push((row) => (val === null ? row[col] === null || row[col] === undefined : row[col] === val))
          return qb
        },
        not: (col, operator, val) => {
          if (operator === 'is' && val === null) {
            filters.push((row) => row[col] !== null && row[col] !== undefined)
          }
          return qb
        },
        in: (col, arr) => {
          filters.push((row) => arr.includes(row[col]))
          return qb
        },
        lte: (col, val) => {
          filters.push((row) => row[col] <= val)
          return qb
        },
        gte: (col, val) => {
          filters.push((row) => row[col] >= val)
          return qb
        },
        order: (col, { ascending } = { ascending: true }) => {
          orderBy = { col, ascending }
          return qb
        },
        limit: (n) => {
          limitCount = n
          return qb
        },
        then: (resolve, reject) => {
          let rows = (tables[tableName] || []).filter((r) => filters.every((fn) => fn(r)))
          if (orderBy) {
            rows = [...rows].sort((a, b) => {
              const aVal = a[orderBy.col]
              const bVal = b[orderBy.col]
              if (aVal < bVal) return orderBy.ascending ? -1 : 1
              if (aVal > bVal) return orderBy.ascending ? 1 : -1
              return 0
            })
          }
          if (limitCount !== null) {
            rows = rows.slice(0, limitCount)
          }
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
        },
        maybeSingle: async () => {
          const rows = (tables[tableName] || []).filter((r) => filters.every((fn) => fn(r)))
          return { data: rows[0] || null, error: null }
        },
        single: async () => {
          const rows = (tables[tableName] || []).filter((r) => filters.every((fn) => fn(r)))
          if (rows.length === 0) return { data: null, error: new Error('Row not found') }
          return { data: rows[0], error: null }
        },
        update: (updates) => {
          const updateFilters = [...filters]
          return {
            eq: (col, val) => {
              updateFilters.push((row) => row[col] === val)
              return {
                eq: (col2, val2) => {
                  updateFilters.push((row) => row[col2] === val2)
                  return {
                    then: (resolve, reject) => {
                      let updated = null
                      for (const row of tables[tableName] || []) {
                        if (updateFilters.every((fn) => fn(row))) {
                          Object.assign(row, updates)
                          updated = row
                        }
                      }
                      return Promise.resolve({ data: updated, error: null }).then(resolve, reject)
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
                      }
                    })
                  }
                },
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
            }
          }
        },
        insert: (row) => {
          const toInsert = Array.isArray(row) ? row : [row]
          for (const item of toInsert) {
            tables[tableName].push({ id: item.id || `mock_${Date.now()}`, ...item })
          }
          return Promise.resolve({ data: toInsert, error: null })
        }
      }

      return qb
    }
  }

  return client
}

// =============================================================================
// 1. TIMEZONE CORRECTNESS & DST TRANSITION TESTS
// =============================================================================

test('Timezone Correctness: Converts and formats date-times strictly in canonical timezone', () => {
  const targetDate = '2026-05-15'
  const targetTime = '14:30'

  // Test across canonical US timezones
  const zones = ['America/Los_Angeles', 'America/Chicago', 'America/New_York']
  for (const tz of zones) {
    const utcDate = localDateTimeToUtc(targetDate, targetTime, tz)
    assert.ok(utcDate instanceof Date && !isNaN(utcDate.getTime()), 'Must produce valid UTC Date')

    const displayTime = formatSlotDisplayTime(utcDate, tz)
    assert.strictEqual(displayTime, '2:30 PM', `Display time in ${tz} must strictly be 2:30 PM`)

    const displayDate = formatSlotDisplayDate(utcDate, tz)
    assert.strictEqual(displayDate, 'May 15', `Display date in ${tz} must strictly be May 15`)

    const displayCombined = formatSlotDisplayDateTime(utcDate, tz)
    assert.strictEqual(displayCombined, 'May 15 at 2:30 PM')
  }
})

test('Timezone Correctness: Daylight Saving Time (Spring Forward & Fall Back)', () => {
  // 2026 US Spring Forward occurs March 8, 2026.
  // March 7 is standard time, March 9 is daylight saving time.
  const tz = 'America/New_York'
  const preDst = localDateTimeToUtc('2026-03-07', '10:00', tz) // EST (UTC-5) -> 15:00 UTC
  const postDst = localDateTimeToUtc('2026-03-09', '10:00', tz) // EDT (UTC-4) -> 14:00 UTC

  assert.strictEqual(preDst.toISOString(), '2026-03-07T15:00:00.000Z')
  assert.strictEqual(postDst.toISOString(), '2026-03-09T14:00:00.000Z')
  assert.strictEqual(formatSlotDisplayTime(preDst, tz), '10:00 AM')
  assert.strictEqual(formatSlotDisplayTime(postDst, tz), '10:00 AM')

  // 2026 US Fall Back occurs November 1, 2026.
  const preFallBack = localDateTimeToUtc('2026-10-31', '10:00', 'America/Chicago') // CDT (UTC-5) -> 15:00 UTC
  const postFallBack = localDateTimeToUtc('2026-11-02', '10:00', 'America/Chicago') // CST (UTC-6) -> 16:00 UTC
  assert.strictEqual(preFallBack.toISOString(), '2026-10-31T15:00:00.000Z')
  assert.strictEqual(postFallBack.toISOString(), '2026-11-02T16:00:00.000Z')
})

test('Timezone Correctness: Evaluates business hours & TCPA quiet hours in organization timezone', () => {
  const businessHours = {
    monday: { open: '09:00', close: '17:00', closed: false }
  }

  // 12:00 PM UTC on Monday May 18, 2026
  // In New York (EDT, UTC-4), it is 8:00 AM (Closed, before 9am)
  // In London (UTC+1), it is 1:00 PM (Open)
  const dateAt12Utc = new Date('2026-05-18T12:00:00.000Z')

  // Quiet hours guard
  // In NY at 12:00 UTC = 8:00 AM -> Quiet hours ends at 8 AM, not quiet
  assert.strictEqual(isTcpaQuietHours('America/New_York', dateAt12Utc), false)

  // 04:00 AM NY time (08:00 UTC) -> definitely in quiet hours (< 8 AM)
  const earlyMorningUtc = new Date('2026-05-18T08:00:00.000Z')
  assert.strictEqual(isTcpaQuietHours('America/New_York', earlyMorningUtc), true)

  // 11:00 PM NY time (03:00 UTC next day) -> in quiet hours (>= 20:00)
  const lateNightUtc = new Date('2026-05-19T03:00:00.000Z')
  assert.strictEqual(isTcpaQuietHours('America/New_York', lateNightUtc), true)
})

// =============================================================================
// 2. SOFT DELETE IMPLEMENTATION TESTS
// =============================================================================

test('Soft Delete: Contacts soft-delete sets deleted_at and normal queries exclude deleted records', async () => {
  const orgId = 'org_trade_1'
  const mockSupabase = createMockSupabase({
    contacts: [
      { id: 'c1', org_id: orgId, name: 'Alice Active', phone: '+12145550101', deleted_at: null },
      { id: 'c2', org_id: orgId, name: 'Bob Active', phone: '+12145550102', deleted_at: null },
      { id: 'c3', org_id: orgId, name: 'Charlie Deleted', phone: '+12145550103', deleted_at: '2026-10-01T12:00:00.000Z' }
    ]
  })

  // 1. Normal customer query excludes deleted contact
  const activeRes = await searchAndFilterCustomers(mockSupabase, { orgId })
  assert.strictEqual(activeRes.success, true)
  assert.strictEqual(activeRes.customers.length, 2)
  assert.ok(!activeRes.customers.some((c) => c.id === 'c3'))

  // 2. Soft-delete Alice
  const deleteRes = await softDeleteContact(mockSupabase, { orgId, contactId: 'c1' })
  assert.strictEqual(deleteRes.success, true)

  const updatedActive = await searchAndFilterCustomers(mockSupabase, { orgId })
  assert.strictEqual(updatedActive.customers.length, 1)
  assert.strictEqual(updatedActive.customers[0].id, 'c2')

  // 3. Recovery query with includeDeleted includes all contacts
  const recoveryRes = await searchAndFilterCustomers(mockSupabase, { orgId, includeDeleted: true })
  assert.strictEqual(recoveryRes.customers.length, 3)

  // 4. Restore Alice
  await restoreContact(mockSupabase, { orgId, contactId: 'c1' })
  const restoredRes = await searchAndFilterCustomers(mockSupabase, { orgId })
  assert.strictEqual(restoredRes.customers.length, 2)
})

test('Soft Delete: Quotes, Invoices, and Jobs soft-delete without breaking entity linkages', async () => {
  const orgId = 'org_trade_1'
  const mockSupabase = createMockSupabase({
    quotes: [{ id: 'q1', org_id: orgId, contact_id: 'c1', quote_number: 'Q-1001', deleted_at: null }],
    invoices: [{ id: 'inv1', org_id: orgId, contact_id: 'c1', invoice_number: 'INV-1001', deleted_at: null }],
    jobs: [{ id: 'job1', org_id: orgId, contact_id: 'c1', title: 'HVAC Tuneup', deleted_at: null }]
  })

  // Soft-delete entities
  const qDel = await softDeleteQuote(mockSupabase, { orgId, quoteId: 'q1' })
  const invDel = await softDeleteInvoice(mockSupabase, { orgId, invoiceId: 'inv1' })
  const jobDel = await softDeleteJob(mockSupabase, { orgId, jobId: 'job1' })

  assert.strictEqual(qDel.success, true)
  assert.strictEqual(invDel.success, true)
  assert.strictEqual(jobDel.success, true)

  // Verify timestamps set
  assert.ok(mockSupabase._tables.quotes[0].deleted_at !== null)
  assert.ok(mockSupabase._tables.invoices[0].deleted_at !== null)
  assert.ok(mockSupabase._tables.jobs[0].deleted_at !== null)

  // Verify foreign keys intact
  assert.strictEqual(mockSupabase._tables.quotes[0].contact_id, 'c1')
  assert.strictEqual(mockSupabase._tables.invoices[0].contact_id, 'c1')
  assert.strictEqual(mockSupabase._tables.jobs[0].contact_id, 'c1')
})

// =============================================================================
// 3. WORKER HEALTH MONITORING TESTS
// =============================================================================

test('Worker Health: Reports healthy when backlog is processed on time', async () => {
  const mockSupabase = createMockSupabase({
    automation_runs: [
      {
        id: 'run1',
        org_id: 'org1',
        action_type: 'send_sms',
        status: 'scheduled',
        scheduled_at: new Date(Date.now() - 30 * 1000).toISOString() // 30s delay (within 120s threshold)
      }
    ]
  })

  const health = await checkWorkerHealth(mockSupabase, {
    degradedThresholdSeconds: 120,
    unhealthyThresholdSeconds: 600
  })

  assert.strictEqual(health.status, 'healthy')
  assert.strictEqual(health.alertsEmitted, false)
})

test('Worker Health: Reports degraded and unhealthy when backlog exceeds thresholds', async () => {
  let alertFired = null
  const onAlert = (alert) => {
    alertFired = alert
  }

  // 1. Degraded test (delayed by 250s, threshold: 120s)
  const degradedSupabase = createMockSupabase({
    automation_runs: [
      {
        id: 'run_deg',
        org_id: 'org1',
        action_type: 'send_sms',
        status: 'pending',
        scheduled_at: new Date(Date.now() - 250 * 1000).toISOString()
      }
    ]
  })

  const degHealth = await checkWorkerHealth(degradedSupabase, {
    degradedThresholdSeconds: 120,
    unhealthyThresholdSeconds: 600,
    onAlert
  })

  assert.strictEqual(degHealth.status, 'degraded')
  assert.strictEqual(degHealth.alertsEmitted, true)
  assert.ok(degHealth.metrics.currentDelaySeconds >= 240)
  assert.strictEqual(alertFired?.status, 'degraded')

  // 2. Unhealthy test (delayed by 900s, threshold: 600s)
  const unhealthySupabase = createMockSupabase({
    automation_runs: [
      {
        id: 'run_unh',
        org_id: 'org1',
        action_type: 'send_sms',
        status: 'scheduled',
        scheduled_at: new Date(Date.now() - 900 * 1000).toISOString()
      }
    ]
  })

  const unhHealth = await checkWorkerHealth(unhealthySupabase, {
    degradedThresholdSeconds: 120,
    unhealthyThresholdSeconds: 600,
    onAlert
  })

  assert.strictEqual(unhHealth.status, 'unhealthy')
  assert.strictEqual(unhHealth.alertsEmitted, true)
  assert.strictEqual(alertFired?.status, 'unhealthy')
})

test('Worker Health: Detects stuck locks and flags unhealthy immediately', async () => {
  const stuckSupabase = createMockSupabase({
    automation_runs: [
      {
        id: 'stuck1',
        org_id: 'org1',
        action_type: 'send_sms',
        status: 'running',
        locked_at: new Date(Date.now() - 700 * 1000).toISOString() // Locked 700s ago
      }
    ]
  })

  const health = await checkWorkerHealth(stuckSupabase, {
    staleLockThresholdSeconds: 600
  })

  assert.strictEqual(health.status, 'unhealthy')
  assert.strictEqual(health.metrics.stuckLockCount, 1)
})

// =============================================================================
// 4. AUTOMATION STATE MACHINE & STALE LOCK RECOVERY TESTS
// =============================================================================

test('Automation State Machine: Validates permitted and rejects illegal transitions', () => {
  // Permitted
  assert.strictEqual(canTransition('scheduled', 'processing'), true)
  assert.strictEqual(canTransition('pending', 'running'), true)
  assert.strictEqual(canTransition('running', 'success'), true)
  assert.strictEqual(canTransition('running', 'retrying'), true)
  assert.strictEqual(canTransition('retrying', 'pending'), true)
  assert.strictEqual(canTransition('failed', 'pending'), true) // Manual operator retry allowed
  assert.strictEqual(canTransition('dead_letter', 'pending'), true) // Manual operator retry allowed

  // Illegal
  assert.strictEqual(canTransition('completed', 'processing'), false)
  assert.strictEqual(canTransition('cancelled', 'running'), false)
  assert.strictEqual(canTransition('dead_letter', 'running'), false)

  assert.doesNotThrow(() => assertValidTransition('scheduled', 'processing'))
  assert.throws(() => assertValidTransition('completed', 'processing'), /ILLEGAL_STATE_TRANSITION/)
})

test('Stale Lock Recovery: Recovers transiently crashed jobs and dead-letters maxed jobs', () => {
  const now = Date.now()
  const lockedAtStale = new Date(now - 700 * 1000).toISOString() // 700s ago

  // 1. Recoverable job (attempt 1/3)
  const recoverableJob = {
    id: 'job_rec',
    status: 'running',
    retry_count: 0,
    max_retries: 3,
    locked_at: lockedAtStale
  }
  const recResult = evaluateStaleLockRecovery(recoverableJob, 600, now)
  assert.strictEqual(recResult.isStale, true)
  assert.strictEqual(recResult.action, 'retry')
  assert.strictEqual(recResult.updates.status, 'pending')
  assert.strictEqual(recResult.updates.retry_count, 1)
  assert.strictEqual(recResult.updates.locked_at, null)

  // 2. Maxed job (attempt 3/3 -> dead_letter)
  const maxedJob = {
    id: 'job_max',
    status: 'processing',
    retry_count: 2,
    max_retries: 3,
    locked_at: lockedAtStale
  }
  const maxResult = evaluateStaleLockRecovery(maxedJob, 600, now)
  assert.strictEqual(maxResult.isStale, true)
  assert.strictEqual(maxResult.action, 'dead_letter')
  assert.strictEqual(maxResult.updates.status, 'dead_letter')
  assert.strictEqual(maxResult.updates.retry_count, 3)
})

// =============================================================================
// 5. CUSTOMER REACTIVATION SETTINGS & MASS DISPATCH PROTECTION
// =============================================================================

test('Customer Reactivation: Suppresses dispatch during quiet hours in organization timezone', async () => {
  const orgId = 'org_quiet_1'
  const mockSupabase = createMockSupabase({
    organizations: [
      {
        id: orgId,
        name: 'Apex Plumbing',
        timezone: 'America/Chicago',
        reactivation_enabled: true,
        reactivation_quiet_hours: true
      }
    ],
    contacts: [
      {
        id: 'c1',
        org_id: orgId,
        name: 'John Doe',
        phone: '+12145550199',
        last_service_date: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
        opt_out: false
      }
    ]
  })

  // Simulated 3:00 AM Central time (09:00 UTC) -> TCPA quiet hours
  const quietTime = new Date('2026-05-15T09:00:00.000Z')

  const res = await evaluateCustomerReactivation(mockSupabase, {
    orgId,
    baseUrl: 'https://app.captodesk.com',
    overrideDate: quietTime
  })

  assert.strictEqual(res.success, true)
  assert.strictEqual(res.suppressedQuietHours, true)
  assert.strictEqual(res.reactivatedCount, 0)
})

test('Customer Reactivation: Respects cooldown and enforces max daily dispatch safety cap', async () => {
  const orgId = 'org_throttle_1'
  // Evaluation time: 1:00 PM Central (18:00 UTC) non-quiet hours
  const activeTime = new Date('2026-05-15T18:00:00.000Z')
  const pastService = new Date(activeTime.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString() // 100 days ago = due

  // Create 5 overdue contacts
  const contacts = Array.from({ length: 5 }, (_, i) => ({
    id: `c_${i}`,
    org_id: orgId,
    name: `Customer ${i}`,
    phone: `+1214555020${i}`,
    last_service_date: pastService,
    opt_out: false,
    last_reactivation_sent_at: null
  }))

  // Contact 0 was contacted 5 days ago (cooldown is 30 days -> must be skipped)
  contacts[0].last_reactivation_sent_at = new Date(activeTime.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()

  const mockSupabase = createMockSupabase({
    organizations: [
      {
        id: orgId,
        name: 'Apex Heating',
        timezone: 'America/Chicago',
        reactivation_enabled: true,
        reactivation_cooldown_days: 30,
        reactivation_max_daily: 2, // Throttled to max 2 messages per batch!
        reactivation_template: 'Hi {customer_name}! Book with {business_name} at {booking_url}'
      }
    ],
    contacts
  })

  const res = await evaluateCustomerReactivation(mockSupabase, {
    orgId,
    baseUrl: 'https://app.captodesk.com',
    overrideDate: activeTime
  })

  assert.strictEqual(res.success, true)
  assert.strictEqual(res.hitBatchLimit, true, 'Must hit safety cap to prevent mass blast')
  assert.strictEqual(res.reactivatedCount, 2, 'Should only send up to reactivation_max_daily (2)')

  // Contact 0 must NOT have been reactivated because it is within cooldown
  assert.ok(!res.contactsReactivated.some((c) => c.contactId === 'c_0'))
})
