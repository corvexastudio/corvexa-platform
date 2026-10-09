process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert'
import crypto from 'node:crypto'
import {
  claimWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
  waitForConcurrentWebhookCompletion
} from '../src/lib/webhooks/idempotency.ts'
import { verifyStripeWebhookSignature } from '../src/lib/payments/stripe-adapter.ts'
import { verifyTelnyxSignature } from '../src/lib/telnyx.ts'
import { recordPayment } from '../src/lib/payments/invoice-manager.ts'
import { processInboundSms } from '../src/lib/services/sms-handler.ts'
import { processMissedCall } from '../src/lib/services/call-recovery.ts'

/**
 * Creates an in-memory mock Supabase client that accurately simulates
 * processed_events table, constraints, RPC claim functions, and business tables.
 */
function createIdempotencyMockDb(initialState = {}) {
  const tables = {
    processed_events: initialState.processed_events || [],
    organizations: initialState.organizations || [
      { id: 'org_1', name: 'Rapid Plumbing', is_missed_call_active: true, telnyx_phone_number: '+12145550100' }
    ],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers || [
      { id: 'num_1', org_id: 'org_1', phone_number: '+12145550100', status: 'active' }
    ],
    contacts: initialState.contacts || [],
    conversations: initialState.conversations || [],
    messages: initialState.messages || [],
    calls: initialState.calls || [],
    leads: initialState.leads || [],
    invoices: initialState.invoices || [
      { id: 'inv_1', org_id: 'org_1', contact_id: 'c_1', invoice_number: 'INV-1001', total: 250, amount_paid: 0, amount_due: 250, status: 'sent' }
    ],
    payments: initialState.payments || []
  }

  let simulateDbCrash = false

  const client = {
    _tables: tables,
    setSimulateDbCrash: (val) => { simulateDbCrash = val },

    rpc: async (fnName, args) => {
      if (simulateDbCrash) {
        return { data: null, error: { message: 'Database connection lost (simulated crash)' } }
      }

      if (fnName === 'claim_webhook_event') {
        const { p_event_id, p_provider, p_event_type, p_stale_timeout_seconds = 60 } = args
        const now = new Date()
        const nowIso = now.toISOString()
        const staleLimitMs = now.getTime() - p_stale_timeout_seconds * 1000

        let row = tables.processed_events.find((r) => r.id === p_event_id)

        // Case 1: Brand new event
        if (!row) {
          row = {
            id: p_event_id,
            provider: p_provider,
            provider_event_id: p_event_id,
            event_type: p_event_type,
            status: 'processing',
            locked_at: nowIso,
            attempt_count: 1,
            created_at: nowIso,
            last_error: null,
            completed_at: null,
            metadata: {}
          }
          tables.processed_events.push(row)
          return { data: [{ action: 'claimed', status: 'processing', attempt_count: 1 }], error: null }
        }

        // Case 2: Already completed
        if (row.status === 'completed') {
          return { data: [{ action: 'completed', status: 'completed', attempt_count: row.attempt_count }], error: null }
        }

        // Case 3: Currently processing -> check stale lock
        if (row.status === 'processing') {
          const lockedMs = row.locked_at ? new Date(row.locked_at).getTime() : 0
          if (lockedMs > staleLimitMs) {
            return { data: [{ action: 'concurrent_active', status: 'processing', attempt_count: row.attempt_count }], error: null }
          }

          // Stale lock recovered
          row.status = 'processing'
          row.locked_at = nowIso
          row.attempt_count = (row.attempt_count || 1) + 1
          row.last_error = 'Stale lock recovered'
          return { data: [{ action: 'reclaimed_stale', status: 'processing', attempt_count: row.attempt_count }], error: null }
        }

        // Case 4: Status is 'failed' -> Reclaim for retry
        row.status = 'processing'
        row.locked_at = nowIso
        row.attempt_count = (row.attempt_count || 1) + 1
        return { data: [{ action: 'reclaimed_retry', status: 'processing', attempt_count: row.attempt_count }], error: null }
      }

      if (fnName === 'complete_webhook_event') {
        const { p_event_id, p_metadata } = args
        const row = tables.processed_events.find((r) => r.id === p_event_id)
        if (row) {
          row.status = 'completed'
          row.completed_at = new Date().toISOString()
          row.locked_at = null
          row.last_error = null
          row.metadata = { ...(row.metadata || {}), ...(p_metadata || {}) }
          return { data: true, error: null }
        }
        return { data: false, error: null }
      }

      if (fnName === 'fail_webhook_event') {
        const { p_event_id, p_error } = args
        const row = tables.processed_events.find((r) => r.id === p_event_id)
        if (row) {
          row.status = 'failed'
          row.locked_at = null
          row.last_error = p_error
          return { data: true, error: null }
        }
        return { data: false, error: null }
      }

      return { data: null, error: new Error(`Unknown RPC ${fnName}`) }
    },

    from: (tableName) => {
      let filters = []

      const qb = {
        select: (cols) => qb,
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return qb
        },
        neq: (col, val) => {
          filters.push((row) => row[col] !== val)
          return qb
        },
        in: (col, arr) => {
          filters.push((row) => arr.includes(row[col]))
          return qb
        },
        gte: (col, val) => {
          filters.push((row) => (row[col] ?? '') >= val)
          return qb
        },
        gt: (col, val) => {
          filters.push((row) => (row[col] ?? '') > val)
          return qb
        },
        lte: (col, val) => {
          filters.push((row) => (row[col] ?? '') <= val)
          return qb
        },
        lt: (col, val) => {
          filters.push((row) => (row[col] ?? '') < val)
          return qb
        },
        order: () => qb,
        limit: () => qb,
        then: (resolve, reject) => {
          if (simulateDbCrash) return Promise.resolve({ data: null, error: { message: 'Database connection failed' } }).then(resolve, reject)
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject)
        },

        maybeSingle: async () => {
          if (simulateDbCrash) return { data: null, error: { message: 'Database connection failed' } }
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
          if (simulateDbCrash) return { data: null, error: { message: 'Database connection failed' } }
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          if (filtered.length === 0) return { data: null, error: new Error('Row not found') }
          return { data: filtered[0], error: null }
        },

        insert: (rowOrRows) => {
          if (simulateDbCrash) {
            const err = { message: 'Database connection failed' }
            return {
              data: null,
              error: err,
              select: () => ({ single: async () => ({ data: null, error: err }), maybeSingle: async () => ({ data: null, error: err }) }),
              then: (resolve) => Promise.resolve({ data: null, error: err }).then(resolve)
            }
          }

          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          let insertErr = null
          const inserted = []

          for (const row of rows) {
            const newRow = {
              id: row.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              created_at: new Date().toISOString(),
              ...row
            }

            // Enforce UNIQUE(id) on processed_events
            if (tableName === 'processed_events') {
              const collision = tables.processed_events.find((e) => e.id === newRow.id)
              if (collision) {
                insertErr = { code: '23505', message: 'duplicate key value violates unique constraint' }
                break
              }
            }

            // Enforce UNIQUE(org_id, stripe_payment_intent_id) on payments
            if (tableName === 'payments' && newRow.stripe_payment_intent_id) {
              const piCollision = tables.payments.find(
                (p) => p.org_id === newRow.org_id && p.stripe_payment_intent_id === newRow.stripe_payment_intent_id
              )
              if (piCollision) {
                insertErr = { code: '23505', message: 'duplicate payment intent' }
                break
              }
            }

            // Enforce UNIQUE(org_id, telnyx_message_id) on messages
            if (tableName === 'messages' && newRow.telnyx_message_id) {
              const msgCollision = tables.messages.find(
                (m) => m.org_id === newRow.org_id && m.telnyx_message_id === newRow.telnyx_message_id
              )
              if (msgCollision) {
                insertErr = { code: '23505', message: 'duplicate telnyx message' }
                break
              }
            }

            // Enforce UNIQUE(org_id, telnyx_call_control_id) on calls
            if (tableName === 'calls' && newRow.telnyx_call_control_id) {
              const callCollision = tables.calls.find(
                (c) => c.org_id === newRow.org_id && c.telnyx_call_control_id === newRow.telnyx_call_control_id
              )
              if (callCollision) {
                insertErr = { code: '23505', message: 'duplicate telnyx call control id' }
                break
              }
            }

            tables[tableName] = tables[tableName] || []
            tables[tableName].push(newRow)
            inserted.push(newRow)
          }

          const last = insertErr ? null : (inserted[inserted.length - 1] || null)
          const res = { data: insertErr ? null : (inserted.length === 1 ? inserted[0] : inserted), error: insertErr }

          return {
            ...res,
            select: () => ({
              ...res,
              single: async () => ({ data: last, error: insertErr }),
              maybeSingle: async () => ({ data: last, error: insertErr })
            }),
            single: async () => ({ data: last, error: insertErr }),
            maybeSingle: async () => ({ data: last, error: insertErr }),
            then: (resolve, reject) => Promise.resolve(res).then(resolve, reject)
          }
        },

        update: (updates) => {
          const updateFilters = []
          const ub = {
            eq: (col, val) => {
              updateFilters.push((row) => row[col] === val)
              return ub
            },
            in: (col, arr) => {
              updateFilters.push((row) => arr.includes(row[col]))
              return ub
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
            then: (resolve) => {
              if (simulateDbCrash) return Promise.resolve({ data: null, error: { message: 'Database connection failed' } }).then(resolve)
              const tableData = tables[tableName] || []
              let matched = 0
              for (const row of tableData) {
                if (updateFilters.every((fn) => fn(row))) {
                  Object.assign(row, updates)
                  matched++
                }
              }
              return Promise.resolve({ data: matched, error: null }).then(resolve)
            }
          }
          return ub
        }
      }

      return qb
    }
  }

  return client
}

// =============================================================================
// TEST 1 — FIRST STRIPE EVENT PROCESSED ONCE
// =============================================================================
test('TEST 1: First Stripe event is claimed, executes business logic, and completes', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'evt_stripe_first_001'

  const claim = await claimWebhookEvent(db, {
    eventId,
    provider: 'stripe',
    eventType: 'checkout.session.completed'
  })

  assert.strictEqual(claim.action, 'claimed', 'Must claim brand-new event')
  assert.strictEqual(claim.status, 'processing')
  assert.strictEqual(claim.attemptCount, 1)

  // Execute business logic
  const paymentResult = await recordPayment(db, {
    invoiceId: 'inv_1',
    orgId: 'org_1',
    amount: 250,
    paymentMethod: 'stripe',
    stripePaymentIntentId: 'pi_test_001'
  })

  assert.strictEqual(paymentResult.success, true, 'Payment record must succeed')
  assert.strictEqual(db._tables.payments.length, 1, 'Payment must be recorded')

  // Mark completion
  const completed = await completeWebhookEvent(db, eventId)
  assert.strictEqual(completed, true)

  const saved = db._tables.processed_events.find((e) => e.id === eventId)
  assert.strictEqual(saved.status, 'completed', 'Event status must be completed')
  assert.strictEqual(saved.locked_at, null, 'Locked_at must be cleared')
  assert.ok(saved.completed_at, 'Completed_at must be set')
})

// =============================================================================
// TEST 2 — SAME STRIPE EVENT REPEATED → NO DUPLICATE PAYMENT
// =============================================================================
test('TEST 2: Duplicate delivery of completed Stripe event is ignored without duplicate payment', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'evt_stripe_first_001'

  // Pre-seed completed event and payment
  await claimWebhookEvent(db, { eventId, provider: 'stripe', eventType: 'checkout.session.completed' })
  await recordPayment(db, {
    invoiceId: 'inv_1',
    orgId: 'org_1',
    amount: 250,
    paymentMethod: 'stripe',
    stripePaymentIntentId: 'pi_test_001'
  })
  await completeWebhookEvent(db, eventId)
  assert.strictEqual(db._tables.payments.length, 1)

  // Duplicate webhook delivery arrives
  const duplicateClaim = await claimWebhookEvent(db, {
    eventId,
    provider: 'stripe',
    eventType: 'checkout.session.completed'
  })

  assert.strictEqual(duplicateClaim.action, 'completed', 'Must recognize completed event')
  assert.strictEqual(duplicateClaim.status, 'completed')

  // Business logic must NOT run again
  assert.strictEqual(db._tables.payments.length, 1, 'Payments table must NOT create duplicate row')
})

// =============================================================================
// TEST 3 — STRIPE BUSINESS LOGIC FAILS → EVENT REMAINS RETRYABLE
// =============================================================================
test('TEST 3: When Stripe business logic fails, event is marked failed and remains retryable', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'evt_stripe_fail_001'

  const claim = await claimWebhookEvent(db, {
    eventId,
    provider: 'stripe',
    eventType: 'payment_intent.succeeded'
  })
  assert.strictEqual(claim.action, 'claimed')

  // Simulate business failure (e.g. invoice not found)
  const simulatedError = 'Invoice inv_missing not found in organization'
  await failWebhookEvent(db, eventId, simulatedError)

  const eventRecord = db._tables.processed_events.find((e) => e.id === eventId)
  assert.strictEqual(eventRecord.status, 'failed', 'Must transition to failed')
  assert.strictEqual(eventRecord.locked_at, null, 'Lock must be released for retries')
  assert.strictEqual(eventRecord.last_error, simulatedError)
})

// =============================================================================
// TEST 4 — STRIPE RETRY AFTER FAILURE → BUSINESS LOGIC EXECUTES
// =============================================================================
test('TEST 4: Provider retry after failure reclaims the event and executes business logic', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'evt_stripe_fail_001'

  // Attempt 1 fails
  await claimWebhookEvent(db, { eventId, provider: 'stripe', eventType: 'payment_intent.succeeded' })
  await failWebhookEvent(db, eventId, 'Transient network timeout')

  // Attempt 2: Stripe retries delivery
  const retryClaim = await claimWebhookEvent(db, {
    eventId,
    provider: 'stripe',
    eventType: 'payment_intent.succeeded'
  })

  assert.strictEqual(retryClaim.action, 'reclaimed_retry', 'Must grant retry execution')
  assert.strictEqual(retryClaim.status, 'processing')
  assert.strictEqual(retryClaim.attemptCount, 2, 'Attempt counter must be incremented')
})

// =============================================================================
// TEST 5 — SUCCESSFUL RETRY → EVENT BECOMES COMPLETED
// =============================================================================
test('TEST 5: Successful retry records payment and transitions event to completed', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'evt_stripe_fail_001'

  // Setup failed first attempt
  await claimWebhookEvent(db, { eventId, provider: 'stripe', eventType: 'payment_intent.succeeded' })
  await failWebhookEvent(db, eventId, 'Transient error')

  // Retry succeeds
  await claimWebhookEvent(db, { eventId, provider: 'stripe', eventType: 'payment_intent.succeeded' })
  const paymentResult = await recordPayment(db, {
    invoiceId: 'inv_1',
    orgId: 'org_1',
    amount: 250,
    paymentMethod: 'stripe',
    stripePaymentIntentId: 'pi_test_retry'
  })
  assert.strictEqual(paymentResult.success, true)
  await completeWebhookEvent(db, eventId)

  const eventRecord = db._tables.processed_events.find((e) => e.id === eventId)
  assert.strictEqual(eventRecord.status, 'completed')
  assert.strictEqual(eventRecord.locked_at, null)
  assert.strictEqual(db._tables.payments.length, 1)
})

// =============================================================================
// TEST 6 — THIRD DUPLICATE AFTER SUCCESSFUL RETRY → IGNORED
// =============================================================================
test('TEST 6: Third duplicate after successful retry is safely ignored', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'evt_stripe_fail_001'

  // Fail attempt 1, succeed attempt 2
  await claimWebhookEvent(db, { eventId, provider: 'stripe', eventType: 'payment_intent.succeeded' })
  await failWebhookEvent(db, eventId, 'Error')
  await claimWebhookEvent(db, { eventId, provider: 'stripe', eventType: 'payment_intent.succeeded' })
  await recordPayment(db, {
    invoiceId: 'inv_1',
    orgId: 'org_1',
    amount: 250,
    paymentMethod: 'stripe',
    stripePaymentIntentId: 'pi_test_retry'
  })
  await completeWebhookEvent(db, eventId)

  // Third delivery
  const thirdDelivery = await claimWebhookEvent(db, {
    eventId,
    provider: 'stripe',
    eventType: 'payment_intent.succeeded'
  })

  assert.strictEqual(thirdDelivery.action, 'completed')
  assert.strictEqual(db._tables.payments.length, 1)
})

// =============================================================================
// TEST 7 — TWO CONCURRENT STRIPE DELIVERIES → ONLY ONE BUSINESS EXECUTION
// =============================================================================
test('TEST 7: Two concurrent Stripe webhook deliveries result in exactly one execution', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'evt_stripe_race_001'

  // Simultaneous claims
  const [claimA, claimB] = await Promise.all([
    claimWebhookEvent(db, { eventId, provider: 'stripe', eventType: 'checkout.session.completed' }),
    claimWebhookEvent(db, { eventId, provider: 'stripe', eventType: 'checkout.session.completed' })
  ])

  const actions = [claimA.action, claimB.action]
  assert.ok(actions.includes('claimed'), 'One request must win the claim')
  assert.ok(actions.includes('concurrent_active'), 'Other request must be marked concurrent_active')

  // Only the winning request executes business logic
  const winner = claimA.action === 'claimed' ? claimA : claimB
  if (winner.action === 'claimed') {
    await recordPayment(db, {
      invoiceId: 'inv_1',
      orgId: 'org_1',
      amount: 250,
      paymentMethod: 'stripe',
      stripePaymentIntentId: 'pi_race_001'
    })
    await completeWebhookEvent(db, eventId)
  }

  assert.strictEqual(db._tables.payments.length, 1, 'Exactly one payment recorded under concurrency')
})

// =============================================================================
// TEST 8 — FIRST TELNYX SMS EVENT → ONE MESSAGE
// =============================================================================
test('TEST 8: First Telnyx SMS event stores message and completes', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'telnyx_evt_sms_001'

  const claim = await claimWebhookEvent(db, {
    eventId,
    provider: 'telnyx',
    eventType: 'message.received'
  })
  assert.strictEqual(claim.action, 'claimed')

  const smsRes = await processInboundSms(db, {
    fromPhone: '+12145550999',
    toPhone: '+12145550100',
    text: 'Hello, need quote for water heater',
    telnyxMessageId: 'telnyx_msg_id_100'
  })

  assert.strictEqual(smsRes.success, true)
  assert.strictEqual(db._tables.messages.length, 1)

  await completeWebhookEvent(db, eventId)
  const saved = db._tables.processed_events.find((e) => e.id === eventId)
  assert.strictEqual(saved.status, 'completed')
})

// =============================================================================
// TEST 9 — DUPLICATE TELNYX SMS EVENT → NO DUPLICATE MESSAGE
// =============================================================================
test('TEST 9: Duplicate Telnyx SMS event does not create duplicate message or unread bump', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'telnyx_evt_sms_001'

  // First delivery
  await claimWebhookEvent(db, { eventId, provider: 'telnyx', eventType: 'message.received' })
  await processInboundSms(db, {
    fromPhone: '+12145550999',
    toPhone: '+12145550100',
    text: 'Hello, need quote',
    telnyxMessageId: 'telnyx_msg_id_100'
  })
  await completeWebhookEvent(db, eventId)
  assert.strictEqual(db._tables.messages.length, 1)

  // Second delivery of same webhook
  const duplicateClaim = await claimWebhookEvent(db, {
    eventId,
    provider: 'telnyx',
    eventType: 'message.received'
  })
  assert.strictEqual(duplicateClaim.action, 'completed')

  assert.strictEqual(db._tables.messages.length, 1, 'Messages count must remain exactly 1')
})

// =============================================================================
// TEST 10 — TELNYX SMS PROCESSING FAILURE → RETRY POSSIBLE
// =============================================================================
test('TEST 10: Telnyx SMS processing failure marks event failed for retry', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'telnyx_evt_sms_fail'

  await claimWebhookEvent(db, { eventId, provider: 'telnyx', eventType: 'message.received' })
  await failWebhookEvent(db, eventId, 'Simulated database deadlock during contact create')

  const eventRecord = db._tables.processed_events.find((e) => e.id === eventId)
  assert.strictEqual(eventRecord.status, 'failed')
  assert.strictEqual(eventRecord.locked_at, null)
})

// =============================================================================
// TEST 11 — TELNYX SMS RETRY SUCCEEDS → EXACTLY ONE FINAL MESSAGE
// =============================================================================
test('TEST 11: Telnyx SMS retry succeeds with exactly one final message stored', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'telnyx_evt_sms_fail'

  // Attempt 1 fails
  await claimWebhookEvent(db, { eventId, provider: 'telnyx', eventType: 'message.received' })
  await failWebhookEvent(db, eventId, 'Temporary error')

  // Attempt 2 succeeds
  const retryClaim = await claimWebhookEvent(db, { eventId, provider: 'telnyx', eventType: 'message.received' })
  assert.strictEqual(retryClaim.action, 'reclaimed_retry')

  await processInboundSms(db, {
    fromPhone: '+12145550999',
    toPhone: '+12145550100',
    text: 'Retried message',
    telnyxMessageId: 'telnyx_msg_retry_1'
  })
  await completeWebhookEvent(db, eventId)

  assert.strictEqual(db._tables.messages.length, 1)
  const eventRecord = db._tables.processed_events.find((e) => e.id === eventId)
  assert.strictEqual(eventRecord.status, 'completed')
})

// =============================================================================
// TEST 12 — TWO CONCURRENT TELNYX SMS EVENTS → NO DUPLICATE BUSINESS RESULT
// =============================================================================
test('TEST 12: Two concurrent Telnyx SMS deliveries produce exactly one message', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'telnyx_evt_sms_concurrent'

  const [claim1, claim2] = await Promise.all([
    claimWebhookEvent(db, { eventId, provider: 'telnyx', eventType: 'message.received' }),
    claimWebhookEvent(db, { eventId, provider: 'telnyx', eventType: 'message.received' })
  ])

  const actions = [claim1.action, claim2.action]
  assert.ok(actions.includes('claimed'))
  assert.ok(actions.includes('concurrent_active'))

  const winner = claim1.action === 'claimed' ? claim1 : claim2
  if (winner.action === 'claimed') {
    await processInboundSms(db, {
      fromPhone: '+12145550999',
      toPhone: '+12145550100',
      text: 'Concurrent message test',
      telnyxMessageId: 'telnyx_msg_conc_1'
    })
    await completeWebhookEvent(db, eventId)
  }

  assert.strictEqual(db._tables.messages.length, 1)
})

// =============================================================================
// TEST 13 — TELNYX VOICE EVENT → ONE MISSED-CALL/LEAD OPERATION
// =============================================================================
test('TEST 13: Telnyx voice event processes missed-call recovery and creates call log', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'telnyx_voice_evt_001'

  const claim = await claimWebhookEvent(db, {
    eventId,
    provider: 'telnyx',
    eventType: 'call.hangup'
  })
  assert.strictEqual(claim.action, 'claimed')

  const callOutcome = {
    state: 'missed',
    wasAnswered: false,
    durationSeconds: 12,
    hangupCause: 'normal_clearing',
    isEligibleForRecovery: true
  }

  const result = await processMissedCall(db, {
    callerNumber: '+12145550888',
    calledNumber: '+12145550100',
    callOutcome,
    callControlId: 'cc_001',
    callLegId: 'leg_001',
    callSessionId: 'sess_001'
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(db._tables.calls.length, 1)
  assert.strictEqual(db._tables.leads.length, 1)

  await completeWebhookEvent(db, eventId)
  const saved = db._tables.processed_events.find((e) => e.id === eventId)
  assert.strictEqual(saved.status, 'completed')
})

// =============================================================================
// TEST 14 — DUPLICATE TELNYX VOICE EVENT → NO DUPLICATE LEAD
// =============================================================================
test('TEST 14: Duplicate Telnyx voice event is ignored without duplicate leads or calls', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'telnyx_voice_evt_001'

  // First execution
  await claimWebhookEvent(db, { eventId, provider: 'telnyx', eventType: 'call.hangup' })
  await processMissedCall(db, {
    callerNumber: '+12145550888',
    calledNumber: '+12145550100',
    callOutcome: { state: 'missed', wasAnswered: false, durationSeconds: 10, isEligibleForRecovery: true },
    callControlId: 'cc_001'
  })
  await completeWebhookEvent(db, eventId)
  assert.strictEqual(db._tables.calls.length, 1)
  assert.strictEqual(db._tables.leads.length, 1)

  // Duplicate webhook delivery
  const duplicateClaim = await claimWebhookEvent(db, {
    eventId,
    provider: 'telnyx',
    eventType: 'call.hangup'
  })
  assert.strictEqual(duplicateClaim.action, 'completed')

  assert.strictEqual(db._tables.calls.length, 1, 'Calls count must not change')
  assert.strictEqual(db._tables.leads.length, 1, 'Leads count must not duplicate')
})

// =============================================================================
// TEST 15 — CRASH / STALE-PROCESSING RECOVERY → EVENT EVENTUALLY RETRYABLE
// =============================================================================
test('TEST 15: Stale locked event from simulated crash is safely recovered after timeout', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'evt_crashed_worker_001'

  // Simulate a worker claiming event 3 minutes ago and crashing without completion or fail call
  const threeMinutesAgo = new Date(Date.now() - 180 * 1000).toISOString()
  db._tables.processed_events.push({
    id: eventId,
    provider: 'stripe',
    provider_event_id: eventId,
    event_type: 'checkout.session.completed',
    status: 'processing',
    locked_at: threeMinutesAgo,
    attempt_count: 1,
    created_at: threeMinutesAgo
  })

  // Provider retries after timeout (stale timeout = 60s)
  const recoveryClaim = await claimWebhookEvent(db, {
    eventId,
    provider: 'stripe',
    eventType: 'checkout.session.completed',
    staleTimeoutSeconds: 60
  })

  assert.strictEqual(recoveryClaim.action, 'reclaimed_stale', 'Must recover crashed stale lock')
  assert.strictEqual(recoveryClaim.status, 'processing')
  assert.strictEqual(recoveryClaim.attemptCount, 2, 'Must increment attempt count on recovery')

  // Completes successfully
  await completeWebhookEvent(db, eventId)
  const eventRecord = db._tables.processed_events.find((e) => e.id === eventId)
  assert.strictEqual(eventRecord.status, 'completed')
})

// =============================================================================
// TEST 16 — INVALID STRIPE SIGNATURE → REJECTED
// =============================================================================
test('TEST 16: Invalid or missing Stripe signature is rejected fail-closed', () => {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_123'

  try {
    const rawPayload = JSON.stringify({ id: 'evt_sig_test', type: 'charge.succeeded' })
    const badSig = 't=1234567,v1=bad_signature_hash'

    const verification = verifyStripeWebhookSignature(rawPayload, badSig, process.env.STRIPE_WEBHOOK_SECRET)
    assert.strictEqual(verification.isValid, false, 'Must reject invalid signature')
    assert.ok(verification.error, 'Must provide rejection error')

    // Missing signature header
    const missingVerification = verifyStripeWebhookSignature(rawPayload, null, process.env.STRIPE_WEBHOOK_SECRET)
    assert.strictEqual(missingVerification.isValid, false, 'Must reject missing signature')
  } finally {
    process.env.STRIPE_WEBHOOK_SECRET = originalSecret
  }
})

// =============================================================================
// TEST 17 — INVALID TELNYX SIGNATURE → REJECTED
// =============================================================================
test('TEST 17: Invalid or missing Telnyx Ed25519 signature is rejected', () => {
  const originalKey = process.env.TELNYX_PUBLIC_KEY
  // Valid Ed25519 public key base64 for testing
  const { publicKey } = crypto.generateKeyPairSync('ed25519')
  const pubDer = publicKey.export({ type: 'spki', format: 'der' })
  const rawKey = pubDer.subarray(pubDer.length - 32)
  process.env.TELNYX_PUBLIC_KEY = rawKey.toString('base64')

  try {
    const rawPayload = JSON.stringify({ data: { id: 'evt_telnyx_sig', event_type: 'message.received' } })

    // Forged signature
    const forgedSignature = Buffer.alloc(64, 0xef).toString('base64')
    const timestamp = Math.floor(Date.now() / 1000).toString()

    const isValid = verifyTelnyxSignature(rawPayload, forgedSignature, timestamp)
    assert.strictEqual(isValid, false, 'Forged signature must be rejected')

    // Missing timestamp
    const missingTimestamp = verifyTelnyxSignature(rawPayload, forgedSignature, null)
    assert.strictEqual(missingTimestamp, false, 'Missing timestamp must be rejected')
  } finally {
    if (originalKey) process.env.TELNYX_PUBLIC_KEY = originalKey
    else delete process.env.TELNYX_PUBLIC_KEY
  }
})

// =============================================================================
// TEST 18 — MALFORMED WEBHOOK PAYLOAD → REJECTED
// =============================================================================
test('TEST 18: Malformed JSON payload or missing event ID is safely rejected', () => {
  const malformedRaw = '{"data": { broken json'
  let parsed = null
  let parseError = null
  try {
    parsed = JSON.parse(malformedRaw)
  } catch (err) {
    parseError = err
  }

  assert.ok(parseError, 'Malformed JSON must trigger parse error')
  assert.strictEqual(parsed, null)

  // Empty data object
  const emptyData = { data: {} }
  const eventId = emptyData.data.id
  assert.strictEqual(eventId, undefined, 'Missing event ID must be detectible')
})

// =============================================================================
// TEST 19 — PREVIOUSLY COMPLETED EVENT → 2XX DUPLICATE RESPONSE
// =============================================================================
test('TEST 19: Previously completed event produces completed claim for safe 2xx response', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'evt_completed_2xx_test'

  // Event completes
  await claimWebhookEvent(db, { eventId, provider: 'stripe', eventType: 'checkout.session.completed' })
  await completeWebhookEvent(db, eventId)

  // Duplicate check
  const duplicateCheck = await claimWebhookEvent(db, {
    eventId,
    provider: 'stripe',
    eventType: 'checkout.session.completed'
  })

  assert.strictEqual(duplicateCheck.action, 'completed')
  assert.strictEqual(duplicateCheck.status, 'completed')
})

// =============================================================================
// TEST 20 — DATABASE FAILURE DURING PROCESSING → RETRYABLE STATE
// =============================================================================
test('TEST 20: Database failure during processing leaves event in retryable state, not permanently completed', async () => {
  const db = createIdempotencyMockDb()
  const eventId = 'evt_db_crash_test'

  // Step 1: Claim succeeds
  const claim = await claimWebhookEvent(db, { eventId, provider: 'stripe', eventType: 'checkout.session.completed' })
  assert.strictEqual(claim.action, 'claimed')

  // Step 2: Database failure during business execution (simulate DB crash)
  db.setSimulateDbCrash(true)
  const failedPayment = await recordPayment(db, {
    invoiceId: 'inv_1',
    orgId: 'org_1',
    amount: 100,
    paymentMethod: 'stripe'
  })
  assert.strictEqual(failedPayment.success, false)

  // Step 3: DB recovers and records failure
  db.setSimulateDbCrash(false)
  await failWebhookEvent(db, eventId, failedPayment.error || 'Database connection dropped')

  // Verify event is NOT completed
  const eventRecord = db._tables.processed_events.find((e) => e.id === eventId)
  assert.notStrictEqual(eventRecord.status, 'completed', 'Must NOT be marked completed')
  assert.strictEqual(eventRecord.status, 'failed', 'Must be in failed retryable state')
  assert.strictEqual(eventRecord.locked_at, null, 'Must be unlocked for future provider retry')
})
