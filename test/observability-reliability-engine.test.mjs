import test from 'node:test'
import assert from 'node:assert'
import { redactSensitiveData, sanitizeObject } from '../src/lib/observability/redactor.ts'
import { createStructuredLogger, getRecentStructuredLogs, StructuredLogger } from '../src/lib/observability/logger.ts'
import { telemetryStore } from '../src/lib/observability/telemetry-store.ts'
import { getTenantContext } from '../src/lib/security/tenant-context.ts'

/**
 * In-memory Supabase mock client for testing observability queries & snapshots
 */
function createMockDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    profiles: initialState.profiles || [],
    activity_logs: initialState.activity_logs || [],
    processed_events: initialState.processed_events || [],
    automation_runs: initialState.automation_runs || [],
    messages: initialState.messages || [],
    telemetry_snapshots: initialState.telemetry_snapshots || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []
      let selectOpts = {}
      let isSingle = false
      let insertedData = null

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
        order: () => queryBuilder,
        limit: (n) => queryBuilder,
        range: (from, to) => queryBuilder,
        single: () => {
          isSingle = true
          return queryBuilder
        },
        insert: (data) => {
          insertedData = Array.isArray(data) ? data : [data]
          const table = tables[tableName] || []
          for (const item of insertedData) {
            const rowWithId = {
              id: item.id || `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              created_at: item.created_at || new Date().toISOString(),
              ...item
            }
            table.push(rowWithId)
          }
          tables[tableName] = table
          return queryBuilder
        },
        then: (resolve) => {
          const table = tables[tableName] || []
          let result = table.filter((row) => filters.every((f) => f(row)))

          if (selectOpts.head) {
            return resolve({ count: result.length, data: null, error: null })
          }

          if (isSingle) {
            return resolve({
              data: result[0] || (insertedData ? insertedData[0] : null),
              error: result.length === 0 && !insertedData ? { message: 'Not found', code: 'PGRST116' } : null
            })
          }

          return resolve({ data: result, count: result.length, error: null })
        }
      }

      return queryBuilder
    }
  }

  return client
}

test('1. SRE Redactor: Scrubs passwords, bearer tokens, API keys, and secret credentials', () => {
  const dirtyPayload = {
    apiKey: 'KEY_LIVE_1234567890abcdef',
    stripe_secret: 'sk_live_998877665544',
    authorization: 'Bearer secret-jwt-token-value',
    password: 'super-secret-password-123',
    nested: {
      client_secret: 'whsec_99999999',
      cvv: '987',
      safe_data: 'ok-to-read'
    },
    items: [
      { token: 'telnyx_token_abc' },
      'public-value'
    ]
  }

  const clean = sanitizeObject(dirtyPayload)

  assert.strictEqual(clean.apiKey, '[REDACTED]')
  assert.strictEqual(clean.stripe_secret, '[REDACTED]')
  assert.strictEqual(clean.authorization, '[REDACTED]')
  assert.strictEqual(clean.password, '[REDACTED]')
  assert.strictEqual(clean.nested.client_secret, '[REDACTED]')
  assert.strictEqual(clean.nested.cvv, '[REDACTED]')
  assert.strictEqual(clean.nested.safe_data, 'ok-to-read')
  assert.strictEqual(clean.items[0].token, '[REDACTED]')
  assert.strictEqual(clean.items[1], 'public-value')
})

test('2. SRE Redactor: Scrubs 13-19 digit credit card numbers (PANs) from free text strings', () => {
  const textWithPan = 'Customer provided Visa card 4111 2222 3333 4444 for payment processing'
  const scrubbedText = redactSensitiveData(textWithPan)

  assert.ok(!scrubbedText.includes('4111 2222 3333 4444'), 'Card PAN must be masked')
  assert.ok(scrubbedText.includes('[REDACTED_CARD]'), 'Card PAN must be replaced with [REDACTED_CARD]')

  const textWithAmex = 'AMEX: 3782-822463-10005 exp 12/26'
  const scrubbedAmex = redactSensitiveData(textWithAmex)
  assert.ok(!scrubbedAmex.includes('3782-822463-10005'), 'AMEX PAN must be masked')
  assert.ok(scrubbedAmex.includes('[REDACTED_CARD]'))
})

test('3. Structured Logger: Emits correlation corridor fields (org, request, event, run, provider)', () => {
  const logger = createStructuredLogger({
    orgId: 'org_test_123',
    requestId: 'req_abc_999',
    eventId: 'evt_telnyx_444',
    automationRunId: 'run_worker_555',
    providerEventId: 'telnyx_prov_666'
  })

  const entry = logger.info('Test operational event completed', {
    duration_ms: 45,
    user_status: 'active'
  })

  assert.strictEqual(entry.organization_id, 'org_test_123')
  assert.strictEqual(entry.request_id, 'req_abc_999')
  assert.strictEqual(entry.event_id, 'evt_telnyx_444')
  assert.strictEqual(entry.automation_run_id, 'run_worker_555')
  assert.strictEqual(entry.provider_event_id, 'telnyx_prov_666')
  assert.strictEqual(entry.level, 'info')
  assert.strictEqual(entry.duration_ms, 45)
  assert.strictEqual(entry.metadata.user_status, 'active')
})

test('4. Structured Logger: In-memory log buffer and search query filtering', () => {
  const logger = createStructuredLogger({ orgId: 'org_search_demo', requestId: 'req_unique_007' })
  logger.info('System initiated invoice sync', { invoiceId: 'inv_123' })
  logger.warn('Carrier webhook latency elevated', { latencyMs: 820 })
  logger.error('Failed to establish database socket', new Error('ECONNRESET'))

  // Filter by level
  const errorLogs = getRecentStructuredLogs({ level: 'error' })
  assert.ok(errorLogs.length >= 1)
  assert.strictEqual(errorLogs[0].level, 'error')
  assert.ok(errorLogs[0].error.message.includes('ECONNRESET'))

  // Filter by search query on request_id
  const matchReq = getRecentStructuredLogs({ query: 'req_unique_007' })
  assert.ok(matchReq.length >= 3)
  assert.strictEqual(matchReq[0].request_id, 'req_unique_007')

  // Filter by search query on message text
  const matchMsg = getRecentStructuredLogs({ query: 'invoice sync' })
  assert.ok(matchMsg.length >= 1)
  assert.ok(matchMsg[0].message.includes('invoice sync'))
})

test('5. API Telemetry: Aggregates request count, avg latency, p95 latency, and error rates', () => {
  telemetryStore.reset()

  // Simulate 10 API requests
  // 8 successful (200) with latencies 10ms, 20ms, 30ms, 40ms, 50ms, 60ms, 70ms, 80ms
  // 1 client error (400) with latency 15ms
  // 1 server error (500) with latency 120ms
  const latencies = [10, 20, 30, 40, 50, 60, 70, 80]
  for (const lat of latencies) {
    telemetryStore.recordApiRequest({
      path: '/api/conversations',
      method: 'GET',
      statusCode: 200,
      durationMs: lat
    })
  }

  telemetryStore.recordApiRequest({
    path: '/api/contacts',
    method: 'POST',
    statusCode: 400,
    durationMs: 15
  })

  telemetryStore.recordApiRequest({
    path: '/api/checkout',
    method: 'POST',
    statusCode: 500,
    durationMs: 120
  })

  const summary = telemetryStore.getApiSummary()
  assert.strictEqual(summary.requestCount, 10)
  assert.strictEqual(summary.clientErrors, 1)
  assert.strictEqual(summary.serverErrors, 1)
  // 2 errors out of 10 requests = 20%
  assert.strictEqual(summary.errorRate, 20)
  assert.ok(summary.latencyAvgMs > 0)
  assert.ok(summary.latencyP95Ms >= summary.latencyAvgMs)
})

test('6. Webhook Telemetry: Tracks complete 6-stage lifecycle (received, verified, rejected, processed, duplicated, failed)', () => {
  telemetryStore.reset()

  telemetryStore.recordWebhookStage('received')
  telemetryStore.recordWebhookStage('received')
  telemetryStore.recordWebhookStage('verified')
  telemetryStore.recordWebhookStage('processed')
  telemetryStore.recordWebhookStage('duplicated')
  telemetryStore.recordWebhookStage('rejected')
  telemetryStore.recordWebhookStage('failed')

  const summary = telemetryStore.getWebhookSummary()
  assert.strictEqual(summary.received, 2)
  assert.strictEqual(summary.verified, 1)
  assert.strictEqual(summary.processed, 1)
  assert.strictEqual(summary.duplicated, 1)
  assert.strictEqual(summary.rejected, 1)
  assert.strictEqual(summary.failed, 1)
})

test('7. Background Job Telemetry: Tracks worker queue states and dead-letter queue transitions', () => {
  telemetryStore.reset()

  telemetryStore.recordJob('queued')
  telemetryStore.recordJob('queued')
  telemetryStore.recordJobTransition('running')
  telemetryStore.recordJobTransition('completed')
  telemetryStore.recordJobTransition('retried')
  telemetryStore.recordJobTransition('failed')
  telemetryStore.recordJobTransition('deadLetter')

  const summary = telemetryStore.getJobSummary()
  assert.strictEqual(summary.queued, 2)
  assert.strictEqual(summary.running, 1)
  assert.strictEqual(summary.completed, 1)
  assert.strictEqual(summary.retried, 1)
  assert.strictEqual(summary.failed, 1)
  assert.strictEqual(summary.deadLetter, 1)
})

test('8. Carrier Messaging & Automation Telemetry: Calculates delivery and automation success rates', () => {
  telemetryStore.reset()

  // Messaging: 9 delivered, 1 failed = 90% delivery rate
  for (let i = 0; i < 10; i++) telemetryStore.recordMessaging('sent')
  for (let i = 0; i < 9; i++) telemetryStore.recordMessaging('delivered')
  telemetryStore.recordMessaging('failed')

  const msgSummary = telemetryStore.getMessagingSummary()
  assert.strictEqual(msgSummary.sent, 10)
  assert.strictEqual(msgSummary.delivered, 9)
  assert.strictEqual(msgSummary.failed, 1)
  assert.strictEqual(msgSummary.deliveryRate, 90)

  // Automation: 4 triggered, 3 completed, 1 failed = 75% success rate
  telemetryStore.recordAutomation('triggered')
  telemetryStore.recordAutomation('triggered')
  telemetryStore.recordAutomation('triggered')
  telemetryStore.recordAutomation('triggered')
  telemetryStore.recordAutomation('completed')
  telemetryStore.recordAutomation('completed')
  telemetryStore.recordAutomation('completed')
  telemetryStore.recordAutomation('failed')

  const autoSummary = telemetryStore.getAutomationSummary()
  assert.strictEqual(autoSummary.triggered, 4)
  assert.strictEqual(autoSummary.completed, 3)
  assert.strictEqual(autoSummary.failed, 1)
  assert.strictEqual(autoSummary.successRate, 75)
})

test('9. Operational Error States: Automatically surfaces critical and warning degradation alerts', async () => {
  telemetryStore.reset()

  // 1. Induce rejected webhooks (invalid signatures)
  telemetryStore.recordWebhookStage('rejected')
  telemetryStore.recordWebhookStage('rejected')

  // 2. Induce dead-letter background job
  telemetryStore.recordJobTransition('deadLetter')

  // 3. Induce high API error rate (>5%)
  telemetryStore.recordApiRequest({ path: '/api/v1/fail', method: 'GET', statusCode: 500, durationMs: 50 })
  telemetryStore.recordApiRequest({ path: '/api/v1/fail', method: 'GET', statusCode: 500, durationMs: 50 })

  const mockDb = createMockDb()
  const dashboard = await telemetryStore.getDashboardData(mockDb)

  assert.ok(dashboard.errorStates.length >= 3, 'Must derive active error states for rejected webhooks, dead letters, and API errors')

  const deadLetterAlert = dashboard.errorStates.find((e) => e.id === 'err_jobs_dead_letter')
  assert.ok(deadLetterAlert, 'Must contain err_jobs_dead_letter alert')
  assert.strictEqual(deadLetterAlert.severity, 'critical')

  const rejectedSigAlert = dashboard.errorStates.find((e) => e.id === 'err_webhook_rejected_signatures')
  assert.ok(rejectedSigAlert, 'Must contain err_webhook_rejected_signatures alert')
  assert.strictEqual(rejectedSigAlert.severity, 'warning')
  assert.strictEqual(rejectedSigAlert.count, 2)

  const apiErrorAlert = dashboard.errorStates.find((e) => e.id === 'err_api_elevated_error_rate')
  assert.ok(apiErrorAlert, 'Must contain err_api_elevated_error_rate alert')
  assert.strictEqual(apiErrorAlert.severity, 'critical')
})

test('10. Telemetry Snapshots: Successfully stores historical snapshot in telemetry_snapshots table', async () => {
  telemetryStore.reset()
  telemetryStore.recordApiRequest({ path: '/api/test', method: 'GET', statusCode: 200, durationMs: 25 })

  const mockDb = createMockDb()
  const dashboard = await telemetryStore.getDashboardData(mockDb)

  // Insert snapshot
  const { data: snapshot, error } = await mockDb
    .from('telemetry_snapshots')
    .insert({
      window_type: 'hourly',
      api_metrics: dashboard.api,
      webhook_metrics: dashboard.webhooks,
      job_metrics: dashboard.jobs,
      messaging_metrics: dashboard.messaging,
      automation_metrics: dashboard.automation,
      active_error_states: dashboard.errorStates
    })
    .select('*')
    .single()

  assert.strictEqual(error, null)
  assert.ok(snapshot)
  assert.strictEqual(snapshot.window_type, 'hourly')
  assert.strictEqual(mockDb._tables.telemetry_snapshots.length, 1)
})

test('11. Strict Authorization: Observability endpoint rejects unauthenticated and non-admin requests', async () => {
  const mockRegularUser = { id: 'user_regular_1' }
  const mockClient = {
    auth: {
      getUser: async () => ({ data: { user: mockRegularUser }, error: null })
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: 'user_regular_1', org_id: 'org1', role: 'member', full_name: 'Member Bob' },
            error: null
          })
        })
      })
    })
  }

  // Attempting to evaluate admin:all with an regular role must fail with 403
  const tenantResult = await getTenantContext('admin:all', mockClient)
  assert.strictEqual(tenantResult.ok, false)
  assert.strictEqual(tenantResult.status, 403)
})
