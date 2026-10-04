import test from 'node:test'
import assert from 'node:assert'
import {
  getPlatformOverview,
  getTenantHealthList,
  getTenantDetail,
  getPlatformEventTimeline,
  inspectEventPayload,
  scrubCredentials,
  normalizeSubscriptionStatus,
  runPlatformDiagnostic
} from '../src/lib/admin/admin-service.ts'
import { getTenantContext } from '../src/lib/security/tenant-context.ts'

/**
 * In-memory Supabase mock harness for Admin Platform Operations
 */
function createMockAdminDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    profiles: initialState.profiles || [],
    calls: initialState.calls || [],
    messages: initialState.messages || [],
    activity_logs: initialState.activity_logs || [],
    automation_runs: initialState.automation_runs || [],
    automation_dead_letters: initialState.automation_dead_letters || [],
    automation_rules: initialState.automation_rules || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []
      let selectOpts = {}
      let isSingle = false

      const queryBuilder = {
        select: (columns, opts) => {
          if (opts) selectOpts = opts
          return queryBuilder
        },
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return queryBuilder
        },
        neq: (col, val) => {
          filters.push((row) => row[col] !== val)
          return queryBuilder
        },
        gt: (col, val) => {
          filters.push((row) => (row[col] ?? 0) > val)
          return queryBuilder
        },
        gte: (col, val) => {
          filters.push((row) => row[col] >= val)
          return queryBuilder
        },
        lt: (col, val) => {
          filters.push((row) => row[col] < val)
          return queryBuilder
        },
        lte: (col, val) => {
          filters.push((row) => row[col] <= val)
          return queryBuilder
        },
        in: (col, arr) => {
          filters.push((row) => arr.includes(row[col]))
          return queryBuilder
        },
        order: () => queryBuilder,
        limit: (n) => {
          queryBuilder._limit = n
          return queryBuilder
        },
        single: () => {
          isSingle = true
          return queryBuilder
        },
        maybeSingle: () => {
          isSingle = true
          return queryBuilder
        },
        insert: (rowOrRows) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          const inserted = []
          for (const r of rows) {
            const newRow = { id: r.id || `mock_${Date.now()}`, ...r }
            if (!tables[tableName]) tables[tableName] = []
            tables[tableName].push(newRow)
            inserted.push(newRow)
          }
          const last = inserted[inserted.length - 1]
          return {
            data: last,
            select: () => ({
              single: async () => ({ data: last, error: null })
            }),
            then: (resolve) => resolve({ data: last, error: null })
          }
        },
        then: (resolve, reject) => {
          const tableData = tables[tableName] || []
          let filtered = tableData.filter((row) => filters.every((fn) => fn(row)))

          if (selectOpts.count === 'exact' && selectOpts.head === true) {
            return Promise.resolve({ count: filtered.length, data: null, error: null }).then(resolve, reject)
          }

          if (queryBuilder._limit) {
            filtered = filtered.slice(0, queryBuilder._limit)
          }

          // Hydrate relations
          const hydrated = filtered.map((row) => {
            const copy = { ...row }
            if (row.org_id && tables.organizations) {
              copy.organizations = tables.organizations.find((o) => o.id === row.org_id) || null
            }
            return copy
          })

          if (isSingle) {
            return Promise.resolve({ data: hydrated[0] || null, error: null }).then(resolve, reject)
          }

          return Promise.resolve({ data: hydrated, count: filtered.length, error: null }).then(resolve, reject)
        }
      }

      return queryBuilder
    }
  }

  return client
}

// -----------------------------------------------------------------------------
// TESTS
// -----------------------------------------------------------------------------

test('1. Platform Overview: Correctly aggregates active, trial, suspended, and churned organizations', async () => {
  const db = createMockAdminDb({
    organizations: [
      { id: 'org1', subscription_status: 'active', monthly_rate: 199, telnyx_phone_number: '+15551110001' },
      { id: 'org2', subscription_status: 'trial', monthly_rate: 99, telnyx_phone_number: '+15551110002' },
      { id: 'org3', subscription_status: 'past_due', monthly_rate: 99 }, // maps to suspended
      { id: 'org4', subscription_status: 'suspended', monthly_rate: 149 },
      { id: 'org5', subscription_status: 'canceled', monthly_rate: 99 }, // maps to churned
      { id: 'org6', subscription_status: 'churned', monthly_rate: 99 }
    ]
  })

  const overview = await getPlatformOverview(db)
  assert.strictEqual(overview.organizations.total, 6)
  assert.strictEqual(overview.organizations.active, 1)
  assert.strictEqual(overview.organizations.trial, 1)
  assert.strictEqual(overview.organizations.suspended, 2)
  assert.strictEqual(overview.organizations.churned, 2)
  assert.strictEqual(overview.organizations.mrr, 199)
})

test('2. Platform Overview: Accurately aggregates messaging delivery counts and rates', async () => {
  const db = createMockAdminDb({
    messages: [
      { id: 'm1', status: 'delivered' },
      { id: 'm2', status: 'delivered' },
      { id: 'm3', status: 'sent' },
      { id: 'm4', status: 'failed' },
      { id: 'm5', status: 'undelivered' }
    ]
  })

  const overview = await getPlatformOverview(db)
  assert.strictEqual(overview.messaging.total, 5)
  assert.strictEqual(overview.messaging.delivered, 2)
  assert.strictEqual(overview.messaging.sent, 1)
  assert.strictEqual(overview.messaging.failed, 1)
  assert.strictEqual(overview.messaging.undelivered, 1)
  // 3 successful (2 delivered + 1 sent) of 5 total = 60%
  assert.strictEqual(overview.messaging.deliveryRate, 60)
})

test('3. Platform Overview: Tracks automation executions, failures, retries, and stuck jobs', async () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const db = createMockAdminDb({
    automation_runs: [
      { id: 'r1', status: 'completed', retry_count: 0 },
      { id: 'r2', status: 'completed', retry_count: 2 }, // retried
      { id: 'r3', status: 'failed', retry_count: 3 },
      { id: 'r4', status: 'running', scheduled_for: twoHoursAgo } // stuck job
    ],
    automation_dead_letters: [
      { id: 'dlq1', error_message: 'Max retries exhausted' }
    ]
  })

  const overview = await getPlatformOverview(db)
  assert.strictEqual(overview.automation.executions, 3)
  assert.strictEqual(overview.automation.failures, 1)
  assert.strictEqual(overview.automation.retries, 2)
  assert.strictEqual(overview.automation.stuckJobs, 1)
  assert.strictEqual(overview.automation.deadLetters, 1)
})

test('4. Tenant Health: Assigns degraded and warning health grades based on failures', async () => {
  const db = createMockAdminDb({
    organizations: [
      { id: 'org_healthy', name: 'Clean HVAC', slug: 'clean-hvac', subscription_status: 'active' },
      { id: 'org_warning', name: 'Warning Electric', slug: 'warning-elec', subscription_status: 'active' },
      { id: 'org_degraded', name: 'Broken Plumbing', slug: 'broken-plumb', subscription_status: 'active' }
    ],
    messages: [
      // org_warning has 1 failure
      { id: 'm1', org_id: 'org_warning', status: 'failed', created_at: '2026-10-01T00:00:00Z' },
      // org_degraded has 8 failures
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `m_deg_${i}`,
        org_id: 'org_degraded',
        status: 'failed',
        created_at: '2026-10-01T00:00:00Z'
      }))
    ]
  })

  const tenants = await getTenantHealthList(db)
  const healthy = tenants.find((t) => t.id === 'org_healthy')
  const warning = tenants.find((t) => t.id === 'org_warning')
  const degraded = tenants.find((t) => t.id === 'org_degraded')

  assert.strictEqual(healthy.healthGrade, 'healthy')
  assert.strictEqual(warning.healthGrade, 'warning')
  assert.strictEqual(degraded.healthGrade, 'degraded')
})

test('5. Tenant Health: Resolves last activity timestamp across calls, messages, and logs', async () => {
  const db = createMockAdminDb({
    organizations: [
      { id: 'org1', name: 'Rapid Roofers', slug: 'rapid-roofers', subscription_status: 'active' }
    ],
    calls: [
      { id: 'c1', org_id: 'org1', created_at: '2026-10-01T10:00:00Z' }
    ],
    messages: [
      { id: 'm1', org_id: 'org1', status: 'delivered', created_at: '2026-10-02T15:30:00Z' }
    ],
    activity_logs: [
      { id: 'l1', org_id: 'org1', event_type: 'call.missed_recovered', created_at: '2026-10-03T09:00:00Z' }
    ]
  })

  const tenants = await getTenantHealthList(db)
  assert.strictEqual(tenants[0].lastActivity, '2026-10-03T09:00:00Z', 'Must pick newest timestamp across tables')
})

test('6. Credential Protection: Deeply and recursively redacts sensitive secrets', async () => {
  const sensitivePayload = {
    webhook_url: 'https://api.telnyx.com/v2/messages',
    headers: {
      Authorization: 'Bearer test_token_12345',
      'X-Telnyx-Signature': 'sig_987654321'
    },
    auth: {
      password: 'SuperSecretPassword123',
      api_key: 'KEY01827461829',
      stripe_secret_key: 'sk_test_51MockStripeSecretKey'
    },
    nested: [
      { token: 'secret_jwt_token', safe_field: 'ok_to_display' },
      'whsec_StripeWebhookSecret12345'
    ]
  }

  const scrubbed = scrubCredentials(sensitivePayload)

  assert.strictEqual(scrubbed.headers.Authorization, '[REDACTED]')
  assert.strictEqual(scrubbed.auth.password, '[REDACTED]')
  assert.strictEqual(scrubbed.auth.api_key, '[REDACTED]')
  assert.strictEqual(scrubbed.auth.stripe_secret_key, '[REDACTED]')
  assert.strictEqual(scrubbed.nested[0].token, '[REDACTED]')
  assert.strictEqual(scrubbed.nested[0].safe_field, 'ok_to_display')
  assert.strictEqual(scrubbed.nested[1], '[REDACTED]')
})

test('7. Safe Diagnostics: Runs Telnyx connectivity check safely', async () => {
  const db = createMockAdminDb()
  const result = await runPlatformDiagnostic(db, 'ping_telnyx')

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.diagnostic, 'ping_telnyx')
  assert.ok(result.latencyMs >= 0)
  assert.ok(result.status === 'connected' || result.status === 'simulated_fallback')
})

test('8. Safe Diagnostics: Runs Stripe configuration check safely', async () => {
  const db = createMockAdminDb()
  const result = await runPlatformDiagnostic(db, 'ping_stripe')

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.diagnostic, 'ping_stripe')
  assert.ok(typeof result.details.secretKeyPresent === 'boolean')
})

test('9. Safe Diagnostics: Detects stuck automation runs', async () => {
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  const db = createMockAdminDb({
    automation_runs: [
      { id: 'stuck_run_1', org_id: 'org1', status: 'running', scheduled_at: threeHoursAgo, scheduled_for: threeHoursAgo }
    ]
  })

  const result = await runPlatformDiagnostic(db, 'check_stuck_automations')
  assert.strictEqual(result.success, true)
  assert.strictEqual(result.stuckCount, 1)
  assert.strictEqual(result.stuckJobs[0].id, 'stuck_run_1')
})

test('10. Safe Diagnostics: Safely re-enqueues dead-letter queue item', async () => {
  const db = createMockAdminDb({
    automation_dead_letters: [
      {
        id: 'dlq_999',
        org_id: 'org1',
        rule_id: 'rule_10',
        error_message: 'Telnyx timeout',
        payload: { customer_phone: '+15554443333' }
      }
    ]
  })

  const result = await runPlatformDiagnostic(db, 'retry_dead_letter', { deadLetterId: 'dlq_999' })
  assert.strictEqual(result.success, true)
  assert.ok(result.replayedRunId)

  // Verify re-enqueued in automation_runs
  const added = db._tables.automation_runs.find((r) => r.id === result.replayedRunId)
  assert.ok(added, 'Re-enqueued run must exist in automation_runs table')
  assert.strictEqual(added.status, 'pending')
  assert.strictEqual(added.retry_count, 0)
})

test('11. Strict Authorization: Non-super_admin roles are strictly blocked with 403 Forbidden', async () => {
  const mockOwnerUser = { id: 'user_owner_1' }
  const mockClient = {
    auth: {
      getUser: async () => ({ data: { user: mockOwnerUser }, error: null })
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: 'user_owner_1', org_id: 'org1', role: 'owner', full_name: 'Owner Joe' },
            error: null
          })
        })
      })
    })
  }

  // Attempting to evaluate admin:all with an 'owner' role must fail
  const tenantResult = await getTenantContext('admin:all', mockClient)
  assert.strictEqual(tenantResult.ok, false)
  assert.strictEqual(tenantResult.status, 403)
  assert.ok(tenantResult.error.includes("lacks permission for 'admin:all'"))
})
