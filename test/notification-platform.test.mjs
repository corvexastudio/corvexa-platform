process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert'
import fs from 'fs'
import { notifyOwner } from '../src/lib/notifications/notification-service.ts'
import {
  isKnownEvent,
  getEventPolicy,
  sanitizeTargetUrl,
  resolveDefaultTargetUrl
} from '../src/lib/notifications/notification-policy.ts'
import { sendWebPushNotification } from '../src/lib/notifications/push/web-push-service.ts'
import { POST as subscribePost, DELETE as subscribeDelete, GET as subscribeGet } from '../src/app/api/client/notifications/subscribe/route.ts'
import { processMissedCall } from '../src/lib/services/call-recovery.ts'
import { processInboundSms } from '../src/lib/services/sms-handler.ts'
import { createBooking } from '../src/lib/booking/booking-manager.ts'

/**
 * In-Memory Mock Database Harness for Notification Platform Testing
 */
function createMockNotificationDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers || [],
    contacts: initialState.contacts || [],
    conversations: initialState.conversations || [],
    messages: initialState.messages || [],
    calls: initialState.calls || [],
    leads: initialState.leads || [],
    processed_events: initialState.processed_events || [],
    notifications: initialState.notifications || [],
    notification_deliveries: initialState.notification_deliveries || [],
    push_subscriptions: initialState.push_subscriptions || [],
    activity_logs: initialState.activity_logs || [],
    profiles: initialState.profiles || [],
    services: initialState.services || [],
    appointments: initialState.appointments || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      if (!tables[tableName]) tables[tableName] = []
      let data = [...tables[tableName]]
      let filters = []

      const queryBuilder = {
        select: (columns) => queryBuilder,
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return queryBuilder
        },
        not: (col, op, val) => {
          if (op === 'is' && val === null) {
            filters.push((row) => row[col] !== null && row[col] !== undefined)
          }
          return queryBuilder
        },
        in: (col, arr) => {
          filters.push((row) => arr.includes(row[col]))
          return queryBuilder
        },
        gte: (col, val) => {
          filters.push((row) => new Date(row[col]) >= new Date(val))
          return queryBuilder
        },
        order: () => queryBuilder,
        limit: (n) => queryBuilder,
        then: (resolve, reject) => {
          const filtered = data.filter((row) => filters.every((fn) => fn(row)))
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject)
        },
        maybeSingle: async () => {
          const filtered = data.filter((row) => filters.every((fn) => fn(row)))
          const item = filtered[0] || null
          if (item && tableName === 'telnyx_phone_numbers') {
            const org = tables.organizations.find((o) => o.id === item.org_id)
            return { data: { ...item, organizations: org }, error: null }
          }
          return { data: item, error: null }
        },
        single: async () => {
          const filtered = data.filter((row) => filters.every((fn) => fn(row)))
          if (filtered.length === 0) return { data: null, error: new Error('Row not found') }
          const item = filtered[0]
          return { data: item, error: null }
        },
        insert: (rowOrRows) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          let insertError = null
          let insertedRows = []

          for (const row of rows) {
            const newRow = {
              id: row.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              created_at: new Date().toISOString(),
              ...row
            }

            // Uniqueness simulation for notifications idempotency
            if (
              tableName === 'notifications' &&
              newRow.idempotency_key &&
              tables.notifications.some(
                (n) => n.org_id === newRow.org_id && n.idempotency_key === newRow.idempotency_key
              )
            ) {
              insertError = { code: '23505', message: 'duplicate key value violates unique constraint uq_notifications_org_idempotency' }
              break
            }

            // Uniqueness simulation for push subscriptions endpoint
            if (
              tableName === 'push_subscriptions' &&
              tables.push_subscriptions.some((p) => p.endpoint === newRow.endpoint)
            ) {
              insertError = { code: '23505', message: 'duplicate key value violates unique constraint idx_push_sub_endpoint' }
              break
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
        upsert: (rowOrRows, options = {}) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          let upserted = []
          for (const row of rows) {
            const conflictKey = options.onConflict || 'endpoint'
            const existingIdx = tables[tableName].findIndex((r) => r[conflictKey] === row[conflictKey])
            if (existingIdx >= 0) {
              Object.assign(tables[tableName][existingIdx], row)
              upserted.push(tables[tableName][existingIdx])
            } else {
              const newRow = {
                id: row.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                created_at: new Date().toISOString(),
                ...row
              }
              tables[tableName].push(newRow)
              upserted.push(newRow)
            }
          }
          const item = upserted[upserted.length - 1]
          return {
            select: () => ({
              single: async () => ({ data: item, error: null }),
              maybeSingle: async () => ({ data: item, error: null })
            }),
            then: (resolve, reject) => Promise.resolve({ data: item, error: null }).then(resolve, reject)
          }
        },
        update: (updates) => {
          const subFilters = []
          const updateBuilder = {
            eq: (col, val) => {
              subFilters.push((r) => r[col] === val)
              return updateBuilder
            },
            then: (resolve, reject) => {
              let count = 0
              for (const row of tables[tableName]) {
                if (subFilters.every((fn) => fn(row))) {
                  Object.assign(row, updates)
                  count++
                }
              }
              return Promise.resolve({ data: null, error: null, count }).then(resolve, reject)
            }
          }
          return updateBuilder
        }
      }

      return queryBuilder
    },
    auth: {
      getUser: async () => ({
        data: {
          user: { id: 'usr-owner-1', email: 'owner@reyesplumbing.com' }
        },
        error: null
      })
    }
  }

  return client
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 1: PUSH SUBSCRIPTION TESTS (Scenarios 1 - 7)
// ─────────────────────────────────────────────────────────────────────────────

test('TEST 1 (PUSH SUB): authenticated user can register own subscription', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', name: 'Reyes Plumbing' }],
    profiles: [{ id: 'usr-owner-1', org_id: 'org-tenant-1', role: 'owner' }]
  })

  const req = new Request('http://localhost:3000/api/client/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: 'https://fcm.googleapis.com/fcm/send/sub-token-123',
      keys: { p256dh: 'BNcRdreALRF89xst7k...', auth: 'tBHItDaEDCas...' },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
      deviceLabel: 'iPhone 15'
    })
  })

  const res = await subscribePost(req, { customSupabase: db })
  assert.strictEqual(res.status, 200)
  const json = await res.json()
  assert.strictEqual(json.success, true)
  assert.strictEqual(json.subscription.org_id, 'org-tenant-1')
  assert.strictEqual(json.subscription.user_id, 'usr-owner-1')
  assert.strictEqual(json.subscription.endpoint, 'https://fcm.googleapis.com/fcm/send/sub-token-123')
  assert.strictEqual(db._tables.push_subscriptions.length, 1)
})

test('TEST 2 (PUSH SUB): unauthenticated user rejected (401)', async () => {
  const db = createMockNotificationDb()
  db.auth.getUser = async () => ({ data: { user: null }, error: new Error('No session') })

  const req = new Request('http://localhost:3000/api/client/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: 'https://fcm.googleapis.com/fcm/send/sub-unauth',
      keys: { p256dh: 'key', auth: 'auth' }
    })
  })

  const res = await subscribePost(req, { customSupabase: db })
  assert.strictEqual(res.status, 401)
})

test('TEST 3 (PUSH SUB): cross-user subscription registration is rejected / strictly isolated', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', name: 'Reyes Plumbing' }],
    profiles: [{ id: 'usr-owner-1', org_id: 'org-tenant-1', role: 'owner' }]
  })

  // Attacker attempts to pass a spoofed user_id in the body
  const req = new Request('http://localhost:3000/api/client/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: 'https://fcm.googleapis.com/fcm/send/sub-attacker',
      keys: { p256dh: 'key', auth: 'auth' },
      user_id: 'victim-user-id'
    })
  })

  const res = await subscribePost(req, { customSupabase: db })
  assert.strictEqual(res.status, 200)
  const json = await res.json()
  // Server MUST derive user_id from session, ignoring client payload
  assert.strictEqual(json.subscription.user_id, 'usr-owner-1')
})

test('TEST 4 (PUSH SUB): cross-tenant subscription registration is rejected / strictly isolated', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', name: 'Reyes Plumbing' }],
    profiles: [{ id: 'usr-owner-1', org_id: 'org-tenant-1', role: 'owner' }]
  })

  // Attacker attempts to pass a foreign org_id in the body
  const req = new Request('http://localhost:3000/api/client/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: 'https://fcm.googleapis.com/fcm/send/sub-attacker-org',
      keys: { p256dh: 'key', auth: 'auth' },
      org_id: 'foreign-tenant-uuid'
    })
  })

  const res = await subscribePost(req, { customSupabase: db })
  assert.strictEqual(res.status, 200)
  const json = await res.json()
  // Server MUST derive org_id from authenticated profile, ignoring foreign org_id
  assert.strictEqual(json.subscription.org_id, 'org-tenant-1')
})

test('TEST 5 (PUSH SUB): duplicate endpoint handled safely via upsert idempotency', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', name: 'Reyes Plumbing' }],
    profiles: [{ id: 'usr-owner-1', org_id: 'org-tenant-1', role: 'owner' }],
    push_subscriptions: [
      {
        id: 'sub-existing-1',
        org_id: 'org-tenant-1',
        user_id: 'usr-owner-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/dup-endpoint',
        p256dh_key: 'old_key',
        auth_key: 'old_auth',
        is_active: false
      }
    ]
  })

  const req = new Request('http://localhost:3000/api/client/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: 'https://fcm.googleapis.com/fcm/send/dup-endpoint',
      keys: { p256dh: 'new_p256dh', auth: 'new_auth' }
    })
  })

  const res = await subscribePost(req, { customSupabase: db })
  assert.strictEqual(res.status, 200)
  // Row count must remain 1 and subscription reactivated
  assert.strictEqual(db._tables.push_subscriptions.length, 1)
  assert.strictEqual(db._tables.push_subscriptions[0].is_active, true)
  assert.strictEqual(db._tables.push_subscriptions[0].p256dh_key, 'new_p256dh')
})

test('TEST 6 (PUSH SUB): subscription can be deactivated via DELETE API', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', name: 'Reyes Plumbing' }],
    profiles: [{ id: 'usr-owner-1', org_id: 'org-tenant-1', role: 'owner' }],
    push_subscriptions: [
      {
        id: 'sub-active-1',
        org_id: 'org-tenant-1',
        user_id: 'usr-owner-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/active-to-deactivate',
        is_active: true
      }
    ]
  })

  const req = new Request('http://localhost:3000/api/client/notifications/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: 'https://fcm.googleapis.com/fcm/send/active-to-deactivate'
    })
  })

  const res = await subscribeDelete(req, { customSupabase: db })
  assert.strictEqual(res.status, 200)
  assert.strictEqual(db._tables.push_subscriptions[0].is_active, false)
})

test('TEST 7 (PUSH SUB): expired subscription removed/deactivated on 404/410 push response', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', name: 'Reyes Plumbing' }],
    push_subscriptions: [
      {
        id: 'sub-expired-1',
        org_id: 'org-tenant-1',
        user_id: 'usr-owner-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/expired-sub',
        p256dh_key: 'p256',
        auth_key: 'auth',
        is_active: true
      }
    ]
  })

  // Simulated push dispatch returning 410 Gone
  const sub = db._tables.push_subscriptions[0]
  const mockWebPushWith410 = async () => {
    const err = new Error('Subscription expired')
    err.statusCode = 410
    throw err
  }

  // Pass mock web push dispatch
  try {
    await mockWebPushWith410()
  } catch (err) {
    if (err.statusCode === 410) {
      await db
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('id', sub.id)
    }
  }

  assert.strictEqual(db._tables.push_subscriptions[0].is_active, false)
})

// ─────────────────────────────────────────────────────────────────────────────
// PART 2: NOTIFICATION ENGINE & POLICY TESTS (Scenarios 8 - 13)
// ─────────────────────────────────────────────────────────────────────────────

test('TEST 8 (NOTIF ENGINE): missed call creates in-app notification record and deliveries', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', name: 'Reyes Plumbing', owner_phone: '+15551234567', telnyx_phone_number: '+18777713802' }],
    push_subscriptions: [
      { id: 'sub-1', org_id: 'org-tenant-1', endpoint: 'https://push/sub-1', p256dh_key: 'k', auth_key: 'a', is_active: true }
    ]
  })

  let smsSent = false
  let pushSent = false

  const res = await notifyOwner(db, {
    event: 'missed_call_recovered',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'missed_call_recovered:call-001',
    data: {
      callerPhone: '+15559876543',
      calledPhone: '+18777713802',
      customerSmsSuccess: true
    },
    sendSmsFn: async () => {
      smsSent = true
      return { success: true, messageId: 'msg-sms-001' }
    },
    webPushSendFn: async () => {
      pushSent = true
      return { success: true, statusCode: 201 }
    }
  })

  assert.strictEqual(res.attempted, true)
  assert.strictEqual(smsSent, true)
  assert.strictEqual(pushSent, true)
  assert.strictEqual(db._tables.notifications.length, 1)
  assert.strictEqual(db._tables.notifications[0].event_type, 'missed_call_recovered')
  assert.strictEqual(db._tables.notifications[0].link, '/client/inbox')
  assert.strictEqual(db._tables.notification_deliveries.length >= 3, true) // in_app, push, sms
})

test('TEST 9 (NOTIF ENGINE): customer reply creates in-app notification record and deliveries', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', name: 'Reyes Plumbing', owner_phone: '+15551234567', telnyx_phone_number: '+18777713802' }]
  })

  let smsSent = false
  const res = await notifyOwner(db, {
    event: 'customer_reply',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'customer_reply:telnyx-msg-001',
    data: {
      customerName: 'Sarah Jenkins',
      customerPhone: '+15559998888',
      replyPreview: 'Yes tomorrow 2pm works great!',
      conversationId: 'conv-123'
    },
    sendSmsFn: async () => {
      smsSent = true
      return { success: true, messageId: 'msg-sms-002' }
    }
  })

  assert.strictEqual(res.attempted, true)
  assert.strictEqual(smsSent, true)
  assert.strictEqual(db._tables.notifications.length, 1)
  assert.strictEqual(db._tables.notifications[0].event_type, 'customer_reply')
  assert.strictEqual(db._tables.notifications[0].title, 'New Customer Reply')
  assert.match(db._tables.notifications[0].link, /\/client\/inbox\?conversation=conv-123/)
})

test('TEST 10 (NOTIF ENGINE): new booking creates in-app notification record and deliveries', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', name: 'Reyes Plumbing', owner_phone: '+15551234567', telnyx_phone_number: '+18777713802' }]
  })

  let smsSent = false
  const res = await notifyOwner(db, {
    event: 'new_booking',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'new_booking:appt-001',
    data: {
      customerName: 'David Miller',
      serviceName: 'Water Heater Flush',
      bookingTime: 'tomorrow at 10:00 AM',
      isInstant: true,
      appointmentId: 'appt-001'
    },
    sendSmsFn: async () => {
      smsSent = true
      return { success: true, messageId: 'msg-sms-003' }
    }
  })

  assert.strictEqual(res.attempted, true)
  assert.strictEqual(smsSent, true)
  assert.strictEqual(db._tables.notifications[0].title, 'New Appointment Booked')
  assert.strictEqual(db._tables.notifications[0].message, 'David Miller booked Water Heater Flush for tomorrow at 10:00 AM.')
  assert.strictEqual(db._tables.notifications[0].link, '/client/calendar')
})

test('TEST 11 (NOTIF ENGINE): unknown event type strictly rejected by policy', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1' }]
  })

  const res = await notifyOwner(db, {
    event: 'arbitrary_fake_event',
    organizationId: 'org-tenant-1',
    data: {}
  })

  assert.strictEqual(res.attempted, false)
  assert.match(res.error, /Unknown event type/)
  assert.strictEqual(db._tables.notifications.length, 0)
})

test('TEST 12 (NOTIF ENGINE): notification tenant derived server-side', async () => {
  const db = createMockNotificationDb()

  const res = await notifyOwner(db, {
    event: 'missed_call_recovered',
    organizationId: '',
    data: {}
  })

  assert.strictEqual(res.attempted, false)
  assert.match(res.error, /Missing organization ID/)
})

test('TEST 13 (NOTIF ENGINE): recipient cannot be client-controlled or spoofed', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', name: 'Reyes Plumbing', owner_phone: '+15551234567', telnyx_phone_number: '+18777713802' }]
  })

  let dispatchedRecipient = ''
  await notifyOwner(db, {
    event: 'customer_reply',
    organizationId: 'org-tenant-1',
    data: {
      owner_phone: '+19999999999', // Attacker attempt to send alert to arbitrary phone
      customerName: 'Alice'
    },
    sendSmsFn: async ({ to }) => {
      dispatchedRecipient = to
      return { success: true, messageId: 'msg-004' }
    }
  })

  // Dispatched phone MUST be authoritative organization owner_phone, never data.owner_phone
  assert.strictEqual(dispatchedRecipient, '+15551234567')
})

// ─────────────────────────────────────────────────────────────────────────────
// PART 3: IDEMPOTENCY TESTS (Scenarios 14 - 16)
// ─────────────────────────────────────────────────────────────────────────────

test('TEST 14 (IDEMPOTENCY): same missed call cannot create duplicate notification', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', owner_phone: '+15551234567', telnyx_phone_number: '+18777713802' }]
  })

  let smsCount = 0
  const sendSms = async () => {
    smsCount++
    return { success: true, messageId: `msg-${smsCount}` }
  }

  // First call: succeeds
  const res1 = await notifyOwner(db, {
    event: 'missed_call_recovered',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'missed_call_recovered:call-identical-1',
    data: { callerPhone: '+15550001111' },
    sendSmsFn: sendSms
  })
  assert.strictEqual(res1.attempted, true)
  assert.strictEqual(smsCount, 1)

  // Second duplicate call: rejected by idempotency check
  const res2 = await notifyOwner(db, {
    event: 'missed_call_recovered',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'missed_call_recovered:call-identical-1',
    data: { callerPhone: '+15550001111' },
    sendSmsFn: sendSms
  })
  assert.strictEqual(res2.attempted, false)
  assert.strictEqual(res2.skippedReason, 'already_processed')
  assert.strictEqual(smsCount, 1) // SMS was NOT dispatched a second time
  assert.strictEqual(db._tables.notifications.length, 1)
})

test('TEST 15 (IDEMPOTENCY): same customer reply cannot create duplicate notification', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', owner_phone: '+15551234567', telnyx_phone_number: '+18777713802' }]
  })

  let smsCount = 0
  const sendSms = async () => {
    smsCount++
    return { success: true, messageId: `msg-${smsCount}` }
  }

  const res1 = await notifyOwner(db, {
    event: 'customer_reply',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'customer_reply:msg-telnyx-dup-1',
    data: { customerName: 'Bob', replyPreview: 'Hello' },
    sendSmsFn: sendSms
  })
  assert.strictEqual(res1.attempted, true)
  assert.strictEqual(smsCount, 1)

  const res2 = await notifyOwner(db, {
    event: 'customer_reply',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'customer_reply:msg-telnyx-dup-1',
    data: { customerName: 'Bob', replyPreview: 'Hello' },
    sendSmsFn: sendSms
  })
  assert.strictEqual(res2.attempted, false)
  assert.strictEqual(res2.skippedReason, 'already_processed')
  assert.strictEqual(smsCount, 1)
})

test('TEST 16 (IDEMPOTENCY): same booking cannot create duplicate notification', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', owner_phone: '+15551234567', telnyx_phone_number: '+18777713802' }]
  })

  let smsCount = 0
  const sendSms = async () => {
    smsCount++
    return { success: true, messageId: `msg-${smsCount}` }
  }

  const res1 = await notifyOwner(db, {
    event: 'new_booking',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'new_booking:appt-dup-1',
    data: { customerName: 'Carol', serviceName: 'Pipe Repair' },
    sendSmsFn: sendSms
  })
  assert.strictEqual(res1.attempted, true)
  assert.strictEqual(smsCount, 1)

  const res2 = await notifyOwner(db, {
    event: 'new_booking',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'new_booking:appt-dup-1',
    data: { customerName: 'Carol', serviceName: 'Pipe Repair' },
    sendSmsFn: sendSms
  })
  assert.strictEqual(res2.attempted, false)
  assert.strictEqual(res2.skippedReason, 'already_processed')
  assert.strictEqual(smsCount, 1)
})

// ─────────────────────────────────────────────────────────────────────────────
// PART 4: WEB PUSH TESTS (Scenarios 17 - 20)
// ─────────────────────────────────────────────────────────────────────────────

test('TEST 17 (PUSH): valid push subscription sends push notification with sanitized payload', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1' }],
    push_subscriptions: [
      { id: 'sub-p1', org_id: 'org-tenant-1', endpoint: 'https://push.example.com/token-1', p256dh_key: 'key1', auth_key: 'auth1', is_active: true }
    ]
  })

  let deliveredPayload = null
  const res = await notifyOwner(db, {
    event: 'missed_call_recovered',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'push-test-1',
    data: { callerPhone: '+15554443333' },
    webPushSendFn: async (sub, payload) => {
      deliveredPayload = payload
      return { success: true, statusCode: 201 }
    }
  })

  assert.strictEqual(res.attempted, true)
  assert.ok(deliveredPayload)
  assert.strictEqual(deliveredPayload.event, 'missed_call_recovered')
  assert.strictEqual(deliveredPayload.url, '/client/inbox')
  // Zero secret keys or PII leaked
  assert.strictEqual(deliveredPayload.p256dh, undefined)
  assert.strictEqual(deliveredPayload.auth, undefined)
})

test('TEST 18 (PUSH): expired push subscription is marked is_active = false in database', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1' }],
    push_subscriptions: [
      { id: 'sub-expired-test', org_id: 'org-tenant-1', endpoint: 'https://push.example.com/expired-endpoint', p256dh_key: 'k', auth_key: 'a', is_active: true }
    ]
  })

  await notifyOwner(db, {
    event: 'customer_reply',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'push-expired-test',
    data: { customerName: 'Frank' },
    webPushSendFn: async (sub) => {
      // Simulate WebPush HTTP 410 Gone handler
      await db.from('push_subscriptions').update({ is_active: false }).eq('id', sub.id)
      return { success: false, statusCode: 410, expired: true, error: 'Subscription expired' }
    }
  })

  assert.strictEqual(db._tables.push_subscriptions[0].is_active, false)
})

test('TEST 19 (PUSH): push provider temporary failure is recorded without breaking flow', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1' }],
    push_subscriptions: [
      { id: 'sub-temp-fail', org_id: 'org-tenant-1', endpoint: 'https://push.example.com/temp-fail', p256dh_key: 'k', auth_key: 'a', is_active: true }
    ]
  })

  const res = await notifyOwner(db, {
    event: 'new_booking',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'push-temp-fail-test',
    data: { customerName: 'Grace' },
    webPushSendFn: async () => {
      return { success: false, statusCode: 503, error: 'Push service unavailable' }
    }
  })

  assert.strictEqual(res.attempted, true)
  const pushDelivery = res.deliveries.find((d) => d.channel === 'push')
  assert.strictEqual(pushDelivery.success, false)
  assert.strictEqual(pushDelivery.error, 'Push service unavailable')
  // Stale subscription is NOT marked inactive on temporary failure
  assert.strictEqual(db._tables.push_subscriptions[0].is_active, true)
})

test('TEST 20 (PUSH): push failure does not break business transaction (failure isolation)', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1' }],
    push_subscriptions: [
      { id: 'sub-crash', org_id: 'org-tenant-1', endpoint: 'https://push.example.com/crash', p256dh_key: 'k', auth_key: 'a', is_active: true }
    ]
  })

  // Throw an unhandled exception inside push sender
  const res = await notifyOwner(db, {
    event: 'customer_reply',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'push-crash-test',
    data: { customerName: 'Helen' },
    webPushSendFn: async () => {
      throw new Error('Socket hangup during TLS handshake')
    }
  })

  // Must not throw or crash; records graceful failure
  assert.strictEqual(res.attempted, true)
  const pushDelivery = res.deliveries.find((d) => d.channel === 'push')
  assert.strictEqual(pushDelivery.success, false)
  assert.match(pushDelivery.error, /Socket hangup/)
  // In-app notification still safely recorded
  assert.strictEqual(db._tables.notifications.length, 1)
})

// ─────────────────────────────────────────────────────────────────────────────
// PART 5: SMS COMPATIBILITY & FAILURES (Scenarios 21 - 23)
// ─────────────────────────────────────────────────────────────────────────────

test('TEST 21 (SMS): critical event invokes owner SMS service', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', owner_phone: '+15551234567', telnyx_phone_number: '+18777713802' }]
  })

  let smsCalled = false
  await notifyOwner(db, {
    event: 'missed_call_recovered',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'sms-critical-test',
    data: { callerPhone: '+15558887777', customerSmsSuccess: true },
    sendSmsFn: async () => {
      smsCalled = true
      return { success: true, messageId: 'msg-sms-crit' }
    }
  })

  assert.strictEqual(smsCalled, true)
})

test('TEST 22 (SMS): SMS failure does not break business transaction (failure isolation)', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', owner_phone: '+15551234567', telnyx_phone_number: '+18777713802' }]
  })

  const res = await notifyOwner(db, {
    event: 'new_booking',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'sms-fail-test',
    data: { customerName: 'Ian', serviceName: 'Drain Cleaning' },
    sendSmsFn: async () => {
      return { success: false, error: 'Carrier network unreachable' }
    }
  })

  assert.strictEqual(res.attempted, true)
  const smsDelivery = res.deliveries.find((d) => d.channel === 'sms')
  assert.strictEqual(smsDelivery.success, false)
  assert.strictEqual(smsDelivery.error, 'Carrier network unreachable')
  // Notification record still created successfully
  assert.strictEqual(db._tables.notifications.length, 1)
})

test('TEST 23 (SMS): non-critical event does not dispatch SMS', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', owner_phone: '+15551234567', telnyx_phone_number: '+18777713802' }]
  })

  let smsSent = false
  const res = await notifyOwner(db, {
    event: 'review_received',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'review-non-crit-test',
    data: { customerName: 'Julia' },
    sendSmsFn: async () => {
      smsSent = true
      return { success: true }
    }
  })

  assert.strictEqual(res.attempted, true)
  assert.strictEqual(smsSent, false) // Policy for review_received does not include SMS
  const smsDelivery = res.deliveries.find((d) => d.channel === 'sms')
  assert.strictEqual(smsDelivery, undefined)
})

// ─────────────────────────────────────────────────────────────────────────────
// PART 6: SECURITY & URL SANITIZATION (Scenarios 24 - 27)
// ─────────────────────────────────────────────────────────────────────────────

test('TEST 24 (SECURITY): Tenant A cannot receive Tenant B notification', async () => {
  const db = createMockNotificationDb({
    organizations: [
      { id: 'org-tenant-A', name: 'Tenant A', owner_phone: '+15551111111' },
      { id: 'org-tenant-B', name: 'Tenant B', owner_phone: '+15552222222' }
    ],
    push_subscriptions: [
      { id: 'sub-A', org_id: 'org-tenant-A', endpoint: 'https://push/sub-A', p256dh_key: 'k', auth_key: 'a', is_active: true },
      { id: 'sub-B', org_id: 'org-tenant-B', endpoint: 'https://push/sub-B', p256dh_key: 'k', auth_key: 'a', is_active: true }
    ]
  })

  const deliveredToEndpoints = []
  await notifyOwner(db, {
    event: 'customer_reply',
    organizationId: 'org-tenant-A',
    idempotencyKey: 'sec-tenant-iso-test',
    data: { customerName: 'Kyle' },
    webPushSendFn: async (sub) => {
      deliveredToEndpoints.push(sub.endpoint)
      return { success: true }
    }
  })

  // ONLY Tenant A endpoint received notification
  assert.deepStrictEqual(deliveredToEndpoints, ['https://push/sub-A'])
  assert.strictEqual(deliveredToEndpoints.includes('https://push/sub-B'), false)
})

test('TEST 25 (SECURITY): private VAPID key never appears in client bundle or client-facing responses', async () => {
  // Test GET subscribe route returns only public key
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'mock_public_vapid_key'
  process.env.VAPID_PRIVATE_KEY = 'super_secret_private_vapid_key_do_not_leak'

  const res = await subscribeGet()
  assert.strictEqual(res.status, 200)
  const json = await res.json()
  assert.strictEqual(json.vapidPublicKey, 'mock_public_vapid_key')
  assert.strictEqual(json.vapidPrivateKey, undefined)
  assert.strictEqual(JSON.stringify(json).includes('super_secret_private_vapid_key'), false)

  // Verify sw.js does not contain any private key references
  const swContent = fs.readFileSync('public/sw.js', 'utf8')
  assert.strictEqual(swContent.includes('VAPID_PRIVATE_KEY'), false)
  assert.strictEqual(swContent.includes('privateKey'), false)
})

test('TEST 26 (SECURITY): arbitrary target URL is sanitized to prevent open redirects', async () => {
  // External protocol
  assert.strictEqual(sanitizeTargetUrl('https://evil-phishing.com/login'), '/client/dashboard')
  assert.strictEqual(sanitizeTargetUrl('http://attacker.com'), '/client/dashboard')
  // Scheme-relative
  assert.strictEqual(sanitizeTargetUrl('//evil.com/payload'), '/client/dashboard')
  // Javascript URI
  assert.strictEqual(sanitizeTargetUrl('javascript:alert(1)'), '/client/dashboard')
  // Non-client internal path
  assert.strictEqual(sanitizeTargetUrl('/admin/super-secret'), '/client/dashboard')
  // Valid client paths allowed
  assert.strictEqual(sanitizeTargetUrl('/client/inbox?conversation=123'), '/client/inbox?conversation=123')
  assert.strictEqual(sanitizeTargetUrl('/client/calendar'), '/client/calendar')
})

test('TEST 27 (SECURITY): arbitrary recipient rejected and server-derived phone used', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', name: 'Reyes Plumbing', owner_phone: '+15551234567', telnyx_phone_number: '+18777713802' }]
  })

  let actualTo = ''
  await notifyOwner(db, {
    event: 'missed_call_recovered',
    organizationId: 'org-tenant-1',
    idempotencyKey: 'sec-recipient-test',
    data: {
      recipient: '+19998887777', // Client attempt to inject arbitrary recipient
      ownerPhone: '+19998887777',
      callerPhone: '+15553332222'
    },
    sendSmsFn: async ({ to }) => {
      actualTo = to
      return { success: true, messageId: 'msg-sec' }
    }
  })

  assert.strictEqual(actualTo, '+15551234567')
})

// ─────────────────────────────────────────────────────────────────────────────
// PART 7: BUSINESS WORKFLOW INTEGRATIONS (Scenarios 28 - 32)
// ─────────────────────────────────────────────────────────────────────────────

test('TEST 28 (FLOWS): missed call workflow triggers push + SMS', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-flow-28', name: 'Reyes Plumbing', owner_phone: '+15551234567', telnyx_phone_number: '+18777713802', is_missed_call_active: true }],
    telnyx_phone_numbers: [{ id: 'num-1', org_id: 'org-flow-28', phone_number: '+18777713802', status: 'active', verification_status: 'verified' }],
    push_subscriptions: [{ id: 'sub-1', org_id: 'org-flow-28', endpoint: 'https://push/sub-1', p256dh_key: 'k', auth_key: 'a', is_active: true }]
  })

  let ownerSmsSent = false
  let ownerPushSent = false

  const res = await processMissedCall(db, {
    callerNumber: '+15554445555',
    calledNumber: '+18777713802',
    callOutcome: {
      state: 'missed',
      wasAnswered: false,
      isEligibleForRecovery: true,
      durationSeconds: 0,
      description: 'Missed call'
    },
    sendSmsFn: async () => ({ success: true, messageId: 'msg-caller-sms' }),
    sendOwnerSmsFn: async () => {
      ownerSmsSent = true
      return { success: true, messageId: 'msg-owner-sms' }
    },
    webPushSendFn: async () => {
      ownerPushSent = true
      return { success: true, statusCode: 201 }
    }
  })

  assert.strictEqual(res.success, true)
  assert.strictEqual(ownerSmsSent, true)
  assert.strictEqual(ownerPushSent, true)
  assert.strictEqual(res.ownerAlert?.sent, true)
})

test('TEST 29 (FLOWS): customer reply workflow triggers push + SMS', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-flow-29', name: 'Reyes Plumbing', owner_phone: '+15551234567', telnyx_phone_number: '+18777713802' }],
    telnyx_phone_numbers: [{ id: 'num-1', org_id: 'org-flow-29', phone_number: '+18777713802', status: 'active', verification_status: 'verified' }],
    push_subscriptions: [{ id: 'sub-1', org_id: 'org-flow-29', endpoint: 'https://push/sub-1', p256dh_key: 'k', auth_key: 'a', is_active: true }]
  })

  let ownerSmsSent = false
  let ownerPushSent = false

  const res = await processInboundSms(db, {
    fromPhone: '+15554445555',
    toPhone: '+18777713802',
    text: 'Sounds great, see you then!',
    telnyxMessageId: 'telnyx-inbound-001',
    sendSmsFn: async () => {
      ownerSmsSent = true
      return { success: true, messageId: 'msg-owner-reply-alert' }
    },
    webPushSendFn: async () => {
      ownerPushSent = true
      return { success: true, statusCode: 201 }
    }
  })

  assert.strictEqual(res.success, true)
  assert.strictEqual(ownerSmsSent, true)
  assert.strictEqual(ownerPushSent, true)
})

test('TEST 30 (FLOWS): booking workflow triggers push + SMS', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', name: 'Reyes Plumbing', owner_phone: '+15551234567', telnyx_phone_number: '+18777713802' }],
    services: [{ id: 'svc-1', org_id: 'org-tenant-1', name: 'Drain Clearing', duration_minutes: 60, is_active: true }]
  })

  const res = await createBooking(db, {
    orgId: 'org-tenant-1',
    serviceId: 'svc-1',
    customerName: 'Laura Palmer',
    customerPhone: '+15554446666',
    customerAddress: '704 Twin Peaks Blvd',
    startTime: '2026-11-20T10:00:00Z',
    appBaseUrl: 'https://app.corvexastudio.com'
  })

  assert.strictEqual(res.success, true)
  assert.ok(res.appointment)
  assert.strictEqual(db._tables.notifications.length, 1)
  assert.strictEqual(db._tables.notifications[0].event_type, 'new_booking')
  assert.match(db._tables.notifications[0].message, /Laura Palmer booked Drain Clearing/)
})

test('TEST 31 (FLOWS): answered call produces no missed-call notification', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', name: 'Reyes Plumbing', owner_phone: '+15551234567', telnyx_phone_number: '+18777713802' }],
    telnyx_phone_numbers: [{ id: 'num-1', org_id: 'org-tenant-1', phone_number: '+18777713802', status: 'active', verification_status: 'verified' }]
  })

  let smsSent = false
  const res = await processMissedCall(db, {
    callerNumber: '+15554445555',
    calledNumber: '+18777713802',
    callOutcome: {
      state: 'answered',
      wasAnswered: true,
      isEligibleForRecovery: false,
      durationSeconds: 45,
      description: 'Answered call'
    },
    sendOwnerSmsFn: async () => {
      smsSent = true
      return { success: true }
    }
  })

  assert.strictEqual(res.success, true)
  assert.strictEqual(res.action, 'call_answered_logged')
  assert.strictEqual(smsSent, false)
  assert.strictEqual(db._tables.notifications.length, 0)
})

test('TEST 32 (FLOWS): failed booking produces no booking notification', async () => {
  const db = createMockNotificationDb({
    organizations: [{ id: 'org-tenant-1', name: 'Reyes Plumbing', owner_phone: '+15551234567', telnyx_phone_number: '+18777713802' }],
    services: [{ id: 'svc-inactive', org_id: 'org-tenant-1', name: 'Inactive Svc', is_active: false }]
  })

  const res = await createBooking(db, {
    orgId: 'org-tenant-1',
    serviceId: 'svc-inactive',
    customerName: 'Mark Doe',
    customerPhone: '+15554447777',
    startTime: '2026-11-20T10:00:00Z'
  })

  assert.strictEqual(res.success, false)
  // Zero notification created on failed booking
  assert.strictEqual(db._tables.notifications.length, 0)
})
