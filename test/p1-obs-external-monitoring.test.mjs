import test from 'node:test'
import assert from 'node:assert/strict'

import { AlertDeduplicator } from '../src/lib/observability/alerts/dedup.ts'
import { AlertManager } from '../src/lib/observability/alerts/alert-manager.ts'
import { WebhookAlertProvider, isValidAlertWebhookUrl } from '../src/lib/observability/alerts/providers/webhook-provider.ts'
import { evaluateSystemHealthAndAlert } from '../src/lib/observability/monitors/system-monitor.ts'
import { GET as getHealth } from '../src/app/api/health/route.ts'
import { GET as getWorkerHealth } from '../src/app/api/health/worker/route.ts'

/**
 * In-memory Mock Supabase for Observability & Health testing
 */
function createMockSupabase(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    automation_runs: initialState.automation_runs || [],
    processed_events: initialState.processed_events || [],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []
      let selectCols = '*'
      let orderCol = null
      let isAsc = true
      let limitCount = null
      let isSingle = false
      let isMaybeSingle = false

      const queryBuilder = {
        select: (cols = '*') => {
          selectCols = cols
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
        in: (col, values) => {
          filters.push((row) => values.includes(row[col]))
          return queryBuilder
        },
        lte: (col, val) => {
          filters.push((row) => (row[col] ? new Date(row[col]) <= new Date(val) : false))
          return queryBuilder
        },
        gte: (col, val) => {
          filters.push((row) => (row[col] ? new Date(row[col]) >= new Date(val) : false))
          return queryBuilder
        },
        order: (col, { ascending = true } = {}) => {
          orderCol = col
          isAsc = ascending
          return queryBuilder
        },
        limit: (n) => {
          limitCount = n
          return queryBuilder
        },
        single: () => {
          isSingle = true
          return queryBuilder
        },
        maybeSingle: () => {
          isMaybeSingle = true
          return queryBuilder
        },
        then: (resolve) => {
          if (initialState._throwOnQuery) {
            throw new Error('Database connection failed: mock network error')
          }

          let rows = [...(tables[tableName] || [])]
          for (const f of filters) {
            rows = rows.filter(f)
          }

          if (orderCol) {
            rows.sort((a, b) => {
              const valA = a[orderCol] ?? ''
              const valB = b[orderCol] ?? ''
              if (valA < valB) return isAsc ? -1 : 1
              if (valA > valB) return isAsc ? 1 : -1
              return 0
            })
          }

          if (limitCount !== null) {
            rows = rows.slice(0, limitCount)
          }

          if (isSingle || isMaybeSingle) {
            return resolve({ data: rows[0] || null, error: null })
          }

          return resolve({ data: rows, error: null })
        }
      }

      return queryBuilder
    }
  }

  return client
}

// =============================================================================
// TEST SUITE: P1-OBS-01 EXTERNAL MONITORING & ALERTING
// =============================================================================

test('1. Healthy health endpoint returns 200, valid status, and zero sensitive leaks', async () => {
  const mockDb = createMockSupabase({
    organizations: [{ id: 'org_123', name: 'Acme Lawn' }]
  })

  const originalEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'test'

  const res = await getHealth(undefined, undefined, { customSupabase: mockDb })
  const data = await res.json()

  assert.strictEqual(res.status, 200)
  assert.ok(['healthy', 'degraded'].includes(data.status))
  assert.ok(data.timestamp)
  assert.strictEqual(data.password, undefined)
  assert.strictEqual(data.credentials, undefined)
  assert.strictEqual(data.stack, undefined)
  assert.strictEqual(data.organizations, undefined)
  assert.strictEqual(res.headers.get('X-Service-Status'), data.status)

  process.env.NODE_ENV = originalEnv
})

test('2. Unhealthy health endpoint on DB failure returns 503 and zero stack traces', async () => {
  const failingDb = {
    from: () => ({
      select: () => {
        throw new Error('PostgreSQL connection terminated unexpectedly')
      }
    })
  }

  const res = await getHealth(undefined, undefined, { customSupabase: failingDb })
  const data = await res.json()

  assert.strictEqual(res.status, 503)
  assert.strictEqual(data.status, 'unhealthy')
  assert.ok(data.timestamp)
  assert.strictEqual(data.stack, undefined)
  assert.strictEqual(data.password, undefined)
  assert.strictEqual(data.connectionString, undefined)
  assert.strictEqual(res.headers.get('X-Service-Status'), 'unhealthy')
})

test('3. Stale worker detection: triggers alert when worker has not completed runs while overdue jobs wait', async () => {
  const now = new Date()
  const mockDb = createMockSupabase({
    automation_runs: [
      {
        id: 'run_1',
        org_id: 'org_1',
        action_type: 'send_sms',
        status: 'pending',
        scheduled_at: new Date(now.getTime() - 1200 * 1000).toISOString() // 20m overdue
      },
      {
        id: 'run_completed_long_ago',
        org_id: 'org_1',
        action_type: 'send_sms',
        status: 'completed',
        completed_at: new Date(now.getTime() - 2000 * 1000).toISOString() // 33m ago
      }
    ]
  })

  const alertList = []
  const mockProvider = {
    name: 'test_mock',
    sendAlert: async (alert) => {
      alertList.push(alert)
      return true
    }
  }

  const testManager = new AlertManager({ providers: [mockProvider] })

  const report = await evaluateSystemHealthAndAlert(mockDb, {
    manager: testManager,
    thresholds: { workerStaleSeconds: 900 }
  })

  assert.strictEqual(report.overallHealthy, false)
  assert.strictEqual(report.checks.worker.healthy, false)
  assert.strictEqual(report.checks.worker.stale, true)
  assert.ok(report.alertsTriggered.includes('worker_cron_stale'))

  const workerAlert = alertList.find(a => a.category === 'worker_cron_stale')
  assert.ok(workerAlert)
  assert.strictEqual(workerAlert.severity, 'critical')
})

test('4. Stale job backlog detection: triggers alert when job delay exceeds threshold', async () => {
  const now = new Date()
  const mockDb = createMockSupabase({
    automation_runs: [
      {
        id: 'run_backlog',
        org_id: 'org_test',
        action_type: 'send_sms',
        status: 'pending',
        scheduled_at: new Date(now.getTime() - 750 * 1000).toISOString() // 12.5m delayed
      },
      {
        id: 'recent_run',
        org_id: 'org_test',
        action_type: 'send_sms',
        status: 'completed',
        completed_at: new Date(now.getTime() - 30 * 1000).toISOString() // worker is running
      }
    ]
  })

  const alertList = []
  const mockProvider = {
    name: 'test_mock',
    sendAlert: async (alert) => {
      alertList.push(alert)
      return true
    }
  }

  const testManager = new AlertManager({ providers: [mockProvider] })

  const report = await evaluateSystemHealthAndAlert(mockDb, {
    manager: testManager,
    thresholds: { jobBacklogDelaySeconds: 600 }
  })

  assert.strictEqual(report.checks.jobQueue.healthy, false)
  assert.ok(report.checks.jobQueue.maxDelaySeconds >= 700)
  assert.ok(report.alertsTriggered.includes('stale_job_backlog'))
  assert.ok(alertList.some(a => a.category === 'stale_job_backlog'))
})

test('5. Repeated webhook failure detection: triggers alert when failed webhooks reach threshold', async () => {
  const now = new Date()
  const mockDb = createMockSupabase({
    processed_events: [
      { id: 'evt_1', provider: 'stripe', status: 'failed', created_at: now.toISOString() },
      { id: 'evt_2', provider: 'stripe', status: 'failed', created_at: now.toISOString() },
      { id: 'evt_3', provider: 'telnyx', status: 'failed', created_at: now.toISOString() },
      { id: 'evt_4', provider: 'telnyx', status: 'failed', created_at: now.toISOString() },
      { id: 'evt_5', provider: 'stripe', status: 'failed', created_at: now.toISOString() }
    ]
  })

  let dispatched = null
  const mockProvider = {
    name: 'test_mock',
    sendAlert: async (alert) => {
      dispatched = alert
      return true
    }
  }

  const testManager = new AlertManager({ providers: [mockProvider] })

  const report = await evaluateSystemHealthAndAlert(mockDb, {
    manager: testManager,
    thresholds: { webhookFailureThreshold: 5 }
  })

  assert.strictEqual(report.checks.webhooks.healthy, false)
  assert.strictEqual(report.checks.webhooks.recentFailedCount, 5)
  assert.ok(report.alertsTriggered.includes('repeated_webhook_failures'))
  assert.strictEqual(dispatched?.category, 'repeated_webhook_failures')
})

test('6. Telnyx provisioning failure detection: detects failed or stuck tenant numbers', async () => {
  const now = new Date()
  const mockDb = createMockSupabase({
    organizations: [
      {
        id: 'org_failed_1',
        name: 'Landscaping Pro',
        phone_provisioning_status: 'failed',
        updated_at: now.toISOString()
      },
      {
        id: 'org_stuck_1',
        name: 'Stuck Mowers',
        phone_provisioning_status: 'provisioning',
        updated_at: new Date(now.getTime() - 45 * 60 * 1000).toISOString() // 45m stuck
      }
    ]
  })

  let dispatched = null
  const mockProvider = {
    name: 'test_mock',
    sendAlert: async (alert) => {
      dispatched = alert
      return true
    }
  }

  const testManager = new AlertManager({ providers: [mockProvider] })

  const report = await evaluateSystemHealthAndAlert(mockDb, {
    manager: testManager,
    thresholds: { telnyxStuckMinutes: 30 }
  })

  assert.strictEqual(report.checks.telnyxProvisioning.healthy, false)
  assert.strictEqual(report.checks.telnyxProvisioning.failedOrgsCount, 1)
  assert.strictEqual(report.checks.telnyxProvisioning.stuckProvisioningCount, 1)
  assert.ok(report.alertsTriggered.includes('telnyx_provisioning_failure'))
  assert.strictEqual(dispatched?.category, 'telnyx_provisioning_failure')
})

test('7. Alert deduplication: suppresses duplicate alerts with the same key', async () => {
  const dedup = new AlertDeduplicator(1800) // 30 min cooldown
  const alert = {
    category: 'worker_cron_stale',
    severity: 'critical',
    dedupKey: 'worker_cron_stale',
    title: 'Worker Stalled',
    description: 'Worker has stalled'
  }

  // First evaluation
  const first = dedup.evaluate(alert)
  assert.strictEqual(first.shouldSend, true)
  assert.strictEqual(first.isNew, true)
  dedup.recordSent(alert)

  // Immediate second evaluation (same key)
  const second = dedup.evaluate(alert)
  assert.strictEqual(second.shouldSend, false)
  assert.strictEqual(second.isNew, false)
  assert.ok(second.reason.includes('Suppressed by cooldown'))
})

test('8. Cooldown behavior: re-enables alert dispatch once cooldown window elapses', async () => {
  const dedup = new AlertDeduplicator(1) // 1 second cooldown for testing
  const alert = {
    category: 'database_connectivity_failure',
    severity: 'critical',
    dedupKey: 'db_failure',
    title: 'DB Failure',
    description: 'DB failure'
  }

  const first = dedup.evaluate(alert)
  assert.strictEqual(first.shouldSend, true)
  dedup.recordSent(alert)

  // Wait 1.1s for cooldown to elapse
  await new Promise((r) => setTimeout(r, 1100))

  const afterCooldown = dedup.evaluate(alert)
  assert.strictEqual(afterCooldown.shouldSend, true)
  assert.strictEqual(afterCooldown.isNew, false)
})

test('9. Alert-provider failure isolation: provider exception never throws or breaks execution', async () => {
  const throwingProvider = {
    name: 'faulty_remote_webhook',
    sendAlert: async () => {
      throw new Error('ETIMEDOUT: Connection to alerting endpoint timed out')
    }
  }

  const manager = new AlertManager({ providers: [throwingProvider] })

  // sendAlert must NEVER throw
  let result
  try {
    result = await manager.sendAlert({
      category: 'application_health_failure',
      severity: 'critical',
      dedupKey: 'test_isolation',
      title: 'Test Isolation',
      description: 'Testing error isolation'
    })
  } catch {
    assert.fail('manager.sendAlert must never throw')
  }

  assert.strictEqual(result?.sent, false)
  assert.ok(result?.error?.includes('ETIMEDOUT'))
})

test('10. Missing alert configuration: safe no-op without errors', async () => {
  const unconfiguredManager = new AlertManager({ providers: [] })

  const result = await unconfiguredManager.sendAlert({
    category: 'stale_job_backlog',
    severity: 'warning',
    dedupKey: 'test_missing_config',
    title: 'Unconfigured Test',
    description: 'No providers registered'
  })

  assert.strictEqual(result.sent, false)
  assert.strictEqual(result.deduplicated, false)
  assert.strictEqual(result.error, undefined)
})

test('11. Secret & PII redaction: scrubs phone numbers, emails, and credentials from alert metadata', async () => {
  let receivedPayload = null
  const capturingProvider = {
    name: 'capturing',
    sendAlert: async (alert) => {
      receivedPayload = alert
      return true
    }
  }

  const manager = new AlertManager({ providers: [capturingProvider] })

  await manager.sendAlert({
    category: 'application_health_failure',
    severity: 'warning',
    dedupKey: 'pii_test',
    title: 'PII Test Alert',
    description: 'Testing scrubbing',
    metadata: {
      customerPhone: '+1 (555) 867-5309',
      customerEmail: 'customer@test.com',
      apiKey: 'TELNYX_SECRET_API_KEY_1234567890',
      password: 'super_secret_password',
      safeCount: 42
    }
  })

  assert.ok(receivedPayload)
  assert.strictEqual(receivedPayload.metadata.customerPhone, '[REDACTED_PHONE]')
  assert.strictEqual(receivedPayload.metadata.customerEmail, '[REDACTED_EMAIL]')
  assert.strictEqual(receivedPayload.metadata.apiKey, '[REDACTED]')
  assert.strictEqual(receivedPayload.metadata.password, '[REDACTED]')
  assert.strictEqual(receivedPayload.metadata.safeCount, 42)
})

test('12. Tenant isolation: public worker health endpoint sanitizes tenant identifiers', async () => {
  const mockDb = createMockSupabase({
    automation_runs: [
      {
        id: 'run_leak_check',
        org_id: 'secret_tenant_org_id',
        action_type: 'send_sms',
        status: 'pending',
        scheduled_at: new Date(Date.now() - 100 * 1000).toISOString()
      }
    ]
  })

  const req = new Request('http://localhost:3000/api/health/worker')
  const res = await getWorkerHealth(req, undefined, { customSupabase: mockDb })
  const data = await res.json()

  assert.ok([200, 503].includes(res.status))
  assert.ok(data.status)
  if (data.metrics?.oldestScheduledRun) {
    // Must NOT contain internal tenant orgId
    assert.strictEqual(data.metrics.oldestScheduledRun.orgId, undefined)
  }
})

test('13. Recovery alerts: emits recovery notification when alert condition clears', async () => {
  let recoveredAlert = null
  const mockProvider = {
    name: 'test_mock',
    sendAlert: async () => true,
    sendRecovery: async (alert) => {
      recoveredAlert = alert
      return true
    }
  }

  const manager = new AlertManager({ providers: [mockProvider] })

  // Trigger active alert
  await manager.sendAlert({
    category: 'database_connectivity_failure',
    severity: 'critical',
    dedupKey: 'db_recovery_test',
    title: 'DB Connection Down',
    description: 'Cannot reach Postgres'
  })

  assert.strictEqual(manager.isAlertActive('db_recovery_test'), true)

  // Trigger recovery
  const recoveryResult = await manager.sendRecovery('db_recovery_test', {
    title: 'DB Connection Restored',
    description: 'Postgres query executed successfully'
  })

  assert.strictEqual(recoveryResult.sent, true)
  assert.strictEqual(recoveredAlert?.title, '[RECOVERED] DB Connection Restored')
  assert.strictEqual(manager.isAlertActive('db_recovery_test'), false)
})

test('14. SSRF protection: WebhookAlertProvider strictly rejects forbidden / insecure destinations in production', () => {
  // Production security checks
  assert.strictEqual(isValidAlertWebhookUrl('http://insecure-webhook.com/alert', true), false)
  assert.strictEqual(isValidAlertWebhookUrl('https://localhost:8080/hook', true), false)
  assert.strictEqual(isValidAlertWebhookUrl('https://127.0.0.1/hook', true), false)
  assert.strictEqual(isValidAlertWebhookUrl('https://10.0.0.5/hook', true), false)
  assert.strictEqual(isValidAlertWebhookUrl('https://192.168.1.50/hook', true), false)
  assert.strictEqual(isValidAlertWebhookUrl('https://172.16.0.5/hook', true), false)
  assert.strictEqual(isValidAlertWebhookUrl('https://metadata.google.internal/hook', true), false)
  assert.strictEqual(isValidAlertWebhookUrl('not-a-valid-url', true), false)

  // Valid external production destinations
  assert.strictEqual(isValidAlertWebhookUrl('https://hooks.slack.com/services/T00/B00/X00', true), true)
  assert.strictEqual(isValidAlertWebhookUrl('https://discord.com/api/webhooks/123/abc', true), true)
  assert.strictEqual(isValidAlertWebhookUrl('https://events.pagerduty.com/v2/enqueue', true), true)
})
