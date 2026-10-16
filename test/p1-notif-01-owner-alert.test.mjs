process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert'
import { processMissedCall } from '../src/lib/services/call-recovery.ts'
import {
  resolveOwnerPhone,
  buildOwnerMissedCallAlertText,
  notifyOwnerOfMissedCall
} from '../src/lib/telephony/owner-notifier.ts'
import { evaluateCallOutcome } from '../src/lib/telephony/call-state-machine.ts'

/**
 * In-Memory Mock Database Harness
 */
function createMockTelephonyDb(initialState = {}) {
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
    activity_logs: initialState.activity_logs || [],
    profiles: initialState.profiles || []
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
        gte: (col, val) => {
          filters.push((row) => new Date(row[col]) >= new Date(val))
          return queryBuilder
        },
        in: (col, arr) => {
          filters.push((row) => arr.includes(row[col]))
          return queryBuilder
        },
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
            const newRow = { id: row.id || `mock_${Date.now()}_${Math.random()}`, created_at: new Date().toISOString(), ...row }
            if (tableName === 'processed_events' && tables.processed_events.some((e) => e.id === newRow.id)) {
              insertError = { code: '23505', message: 'Unique violation' }
              break
            }
            if (tableName === 'contacts' && tables.contacts.some((c) => c.org_id === newRow.org_id && c.phone === newRow.phone)) {
              insertError = { code: '23505', message: 'Unique violation' }
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
        update: (updates) => ({
          eq: (col, val) => {
            let updated = null
            for (const row of tables[tableName]) {
              if (row[col] === val) {
                Object.assign(row, updates)
                updated = row
              }
            }
            return {
              data: updated,
              error: null,
              select: () => ({
                maybeSingle: async () => ({ data: updated, error: null }),
                single: async () => ({ data: updated, error: null })
              }),
              then: (resolve) => resolve({ data: updated, error: null })
            }
          }
        })
      }

      return queryBuilder
    }
  }

  return client
}

// -----------------------------------------------------------------------------
// TEST SUITE: P1-NOTIF-01 OWNER MISSED-CALL NOTIFICATIONS
// -----------------------------------------------------------------------------

test('P1-NOTIF-01 Test 1: Missed call with valid owner_phone sends owner alert SMS', async () => {
  const sentSms = []
  const mockSendSms = async (params) => {
    sentSms.push(params)
    return { success: true, messageId: `msg_${Date.now()}` }
  }

  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Precision HVAC',
        owner_phone: '+12145550199',
        is_missed_call_active: true
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 20
  })

  const result = await processMissedCall(db, {
    callerNumber: '+12145550888',
    calledNumber: '+12145550100',
    callOutcome,
    sendSmsFn: mockSendSms
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.action, 'auto_reply_sent')
  assert.ok(result.ownerAlert, 'ownerAlert must be present in result')
  assert.strictEqual(result.ownerAlert.sent, true)
  assert.strictEqual(result.ownerAlert.ownerPhone, '+12145550199')

  // Verify two SMS dispatches: 1 to customer, 1 to owner
  assert.strictEqual(sentSms.length, 2)
  const [customerSms, ownerSms] = sentSms

  assert.strictEqual(customerSms.to, '+12145550888')
  assert.strictEqual(customerSms.from, '+12145550100')

  assert.strictEqual(ownerSms.to, '+12145550199')
  assert.strictEqual(ownerSms.from, '+12145550100')
  assert.strictEqual(
    ownerSms.text,
    'CaptoDesk: Missed call from (214) 555-0888. We texted them your booking link. Check your inbox for details.'
  )

  // Verify in-app notification created
  assert.strictEqual(db._tables.notifications.length, 1)
  assert.strictEqual(db._tables.notifications[0].title, 'Missed Call Recovered')
  assert.ok(db._tables.notifications[0].message.includes('(214) 555-0888'))
})

test('P1-NOTIF-01 Test 2: Missed call without owner phone skips owner alert but core recovery succeeds', async () => {
  const sentSms = []
  const mockSendSms = async (params) => {
    sentSms.push(params)
    return { success: true, messageId: `msg_${Date.now()}` }
  }

  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Precision HVAC',
        owner_phone: null,
        is_missed_call_active: true
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 15
  })

  const result = await processMissedCall(db, {
    callerNumber: '+12145550888',
    calledNumber: '+12145550100',
    callOutcome,
    sendSmsFn: mockSendSms
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.action, 'auto_reply_sent')
  assert.strictEqual(result.ownerAlert.sent, false)
  assert.strictEqual(result.ownerAlert.skippedReason, 'no_owner_phone')

  // Exactly 1 SMS sent (customer recovery text only)
  assert.strictEqual(sentSms.length, 1)
  assert.strictEqual(sentSms[0].to, '+12145550888')

  // Lead and call were successfully created
  assert.strictEqual(db._tables.leads.length, 1)
  assert.strictEqual(db._tables.calls.length, 1)
})

test('P1-NOTIF-01 Test 3: Fallback to owner profile phone when organizations.owner_phone is empty', async () => {
  const sentSms = []
  const mockSendSms = async (params) => {
    sentSms.push(params)
    return { success: true, messageId: `msg_${Date.now()}` }
  }

  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Precision HVAC',
        owner_phone: null,
        is_missed_call_active: true
      }
    ],
    profiles: [
      {
        id: 'user-owner-1',
        org_id: 'org-1',
        role: 'owner',
        phone: '+12145550777'
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 15
  })

  const result = await processMissedCall(db, {
    callerNumber: '+12145550888',
    calledNumber: '+12145550100',
    callOutcome,
    sendSmsFn: mockSendSms
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.ownerAlert.sent, true)
  assert.strictEqual(result.ownerAlert.ownerPhone, '+12145550777')
  assert.strictEqual(sentSms.length, 2)
  assert.strictEqual(sentSms[1].to, '+12145550777')
})

test('P1-NOTIF-01 Test 4: When customer recovery SMS succeeds, owner message claims success accurately', () => {
  const text = buildOwnerMissedCallAlertText({
    callerPhone: '+12145550888',
    customerSmsSuccess: true,
    businessName: 'Precision HVAC'
  })

  assert.strictEqual(
    text,
    'CaptoDesk: Missed call from (214) 555-0888. We texted them your booking link. Check your inbox for details.'
  )
})

test('P1-NOTIF-01 Test 5: When customer recovery SMS fails, owner message accurately reports delivery failure', () => {
  const text = buildOwnerMissedCallAlertText({
    callerPhone: '+12145550888',
    customerSmsSuccess: false,
    businessName: 'Precision HVAC'
  })

  assert.strictEqual(
    text,
    "CaptoDesk: Missed call from (214) 555-0888. We couldn't deliver the automatic reply. Check your inbox."
  )
})

test('P1-NOTIF-01 Test 6: Failure mode - Customer SMS succeeds, Owner SMS fails (lead is preserved)', async () => {
  const sentSms = []
  const mockSendCustomerSms = async (params) => {
    sentSms.push(params)
    return { success: true, messageId: 'msg_customer_ok' }
  }
  const mockSendOwnerSms = async (params) => {
    sentSms.push(params)
    return { success: false, error: 'Carrier network unreachable' }
  }

  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Precision HVAC',
        owner_phone: '+12145550199',
        is_missed_call_active: true
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 20
  })

  const result = await processMissedCall(db, {
    callerNumber: '+12145550888',
    calledNumber: '+12145550100',
    callOutcome,
    sendSmsFn: mockSendCustomerSms,
    sendOwnerSmsFn: mockSendOwnerSms
  })

  // Core recovery remains successful
  assert.strictEqual(result.success, true)
  assert.strictEqual(result.action, 'auto_reply_sent')
  assert.strictEqual(result.messageId, 'msg_customer_ok')

  // Owner alert records failure cleanly without crashing
  assert.strictEqual(result.ownerAlert.attempted, true)
  assert.strictEqual(result.ownerAlert.sent, false)
  assert.strictEqual(result.ownerAlert.error, 'Carrier network unreachable')

  // Lead, conversation, and messages are completely intact
  assert.strictEqual(db._tables.leads.length, 1)
  assert.strictEqual(db._tables.conversations.length, 1)
  assert.strictEqual(db._tables.messages.length, 1)
  assert.strictEqual(db._tables.messages[0].delivery_status, 'sent')
})

test('P1-NOTIF-01 Test 7: Failure mode - Customer SMS fails, Owner SMS succeeds', async () => {
  const sentSms = []
  const mockSendCustomerSms = async (params) => {
    sentSms.push(params)
    return { success: false, error: 'Landline number cannot receive SMS' }
  }
  const mockSendOwnerSms = async (params) => {
    sentSms.push(params)
    return { success: true, messageId: 'msg_owner_ok' }
  }

  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Precision HVAC',
        owner_phone: '+12145550199',
        is_missed_call_active: true
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 20
  })

  const result = await processMissedCall(db, {
    callerNumber: '+12145550888',
    calledNumber: '+12145550100',
    callOutcome,
    sendSmsFn: mockSendCustomerSms,
    sendOwnerSmsFn: mockSendOwnerSms
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.ownerAlert.sent, true)
  // Owner alert text accurately tells owner that auto-reply could not be delivered
  assert.ok(result.ownerAlert.text.includes("couldn't deliver the automatic reply"))

  // Lead still recorded so owner can call back manually
  assert.strictEqual(db._tables.leads.length, 1)
})

test('P1-NOTIF-01 Test 8: Failure mode - Customer SMS fails, Owner SMS fails (no unhandled crash)', async () => {
  const mockFail = async () => ({ success: false, error: 'Network timeout' })

  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Precision HVAC',
        owner_phone: '+12145550199',
        is_missed_call_active: true
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 20
  })

  const result = await processMissedCall(db, {
    callerNumber: '+12145550888',
    calledNumber: '+12145550100',
    callOutcome,
    sendSmsFn: mockFail,
    sendOwnerSmsFn: mockFail
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.ownerAlert.attempted, true)
  assert.strictEqual(result.ownerAlert.sent, false)
  // Lead is still saved
  assert.strictEqual(db._tables.leads.length, 1)
})

test('P1-NOTIF-01 Test 9: Duplicate processing attempt suppresses duplicate owner alert', async () => {
  let ownerAlertCount = 0
  const mockSendOwnerSms = async () => {
    ownerAlertCount++
    return { success: true, messageId: `msg_${ownerAlertCount}` }
  }

  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Precision HVAC',
        owner_phone: '+12145550199',
        is_missed_call_active: true
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 20
  })

  // First execution: Processes call and alerts owner
  const res1 = await processMissedCall(db, {
    callerNumber: '+12145550888',
    calledNumber: '+12145550100',
    callOutcome,
    callControlId: 'call-ctrl-unique-1',
    sendOwnerSmsFn: mockSendOwnerSms
  })
  assert.strictEqual(res1.action, 'auto_reply_sent')
  assert.strictEqual(ownerAlertCount, 1)

  // Second execution with same callControlId: Semantic deduplication kicks in
  const res2 = await processMissedCall(db, {
    callerNumber: '+12145550888',
    calledNumber: '+12145550100',
    callOutcome,
    callControlId: 'call-ctrl-unique-1',
    sendOwnerSmsFn: mockSendOwnerSms
  })
  assert.strictEqual(res2.action, 'call_already_processed')
  // Zero duplicate alerts dispatched
  assert.strictEqual(ownerAlertCount, 1)
})

test('P1-NOTIF-01 Test 10: Tenant isolation - Tenant A missed call alerts Tenant A owner, NOT Tenant B owner', async () => {
  const sentSms = []
  const mockSendSms = async (params) => {
    sentSms.push(params)
    return { success: true, messageId: `msg_${sentSms.length}` }
  }

  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-tenant-a',
        name: 'Alpha Plumbing',
        owner_phone: '+12145550111',
        is_missed_call_active: true
      },
      {
        id: 'org-tenant-b',
        name: 'Beta Roofing',
        owner_phone: '+12145550222',
        is_missed_call_active: true
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-tenant-a', phone_number: '+12145550001', status: 'active', capabilities: ['voice', 'sms'] },
      { org_id: 'org-tenant-b', phone_number: '+12145550002', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 20
  })

  // Inbound missed call to Tenant A's DID
  const resA = await processMissedCall(db, {
    callerNumber: '+12145550999',
    calledNumber: '+12145550001',
    callOutcome,
    sendSmsFn: mockSendSms
  })

  assert.strictEqual(resA.orgId, 'org-tenant-a')
  assert.strictEqual(resA.ownerAlert.sent, true)
  assert.strictEqual(resA.ownerAlert.ownerPhone, '+12145550111')

  // Find owner alerts
  const ownerAlerts = sentSms.filter((s) => s.text.startsWith('CaptoDesk:'))
  assert.strictEqual(ownerAlerts.length, 1)
  assert.strictEqual(ownerAlerts[0].to, '+12145550111')
  assert.strictEqual(ownerAlerts[0].from, '+12145550001')

  // Verify Tenant B owner received nothing
  const tenantBAlert = sentSms.find((s) => s.to === '+12145550222')
  assert.strictEqual(tenantBAlert, undefined, 'Tenant B owner must NEVER receive Tenant A alert')
})

test('P1-NOTIF-01 Test 11: Outbound sender DID strictly belongs to tenant organization', async () => {
  const sentSms = []
  const mockSendSms = async (params) => {
    sentSms.push(params)
    return { success: true, messageId: `msg_${sentSms.length}` }
  }

  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Precision HVAC',
        owner_phone: '+12145550199',
        is_missed_call_active: true
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 20
  })

  await processMissedCall(db, {
    callerNumber: '+12145550888',
    calledNumber: '+12145550100',
    callOutcome,
    sendSmsFn: mockSendSms
  })

  const ownerSms = sentSms.find((s) => s.to === '+12145550199')
  assert.strictEqual(ownerSms.from, '+12145550100', 'Sender DID must match tenant verified DID')
})

test('P1-NOTIF-01 Test 12: Answered call does NOT trigger owner missed-call alert', async () => {
  const sentSms = []
  const mockSendSms = async (params) => {
    sentSms.push(params)
    return { success: true, messageId: 'msg_1' }
  }

  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Precision HVAC',
        owner_phone: '+12145550199',
        is_missed_call_active: true
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'answered',
    hangup_cause: 'normal_clearing',
    duration_secs: 45
  })

  const res = await processMissedCall(db, {
    callerNumber: '+12145550888',
    calledNumber: '+12145550100',
    callOutcome,
    sendSmsFn: mockSendSms
  })

  assert.strictEqual(res.action, 'call_answered_logged')
  assert.strictEqual(sentSms.length, 0, 'No SMS must be sent for answered call')
  assert.strictEqual(res.ownerAlert, undefined)
})

test('P1-NOTIF-01 Test 13: Suppressed call (e.g. cooldown active) does NOT trigger owner alert', async () => {
  const sentSms = []
  const mockSendSms = async (params) => {
    sentSms.push(params)
    return { success: true, messageId: 'msg_1' }
  }

  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Precision HVAC',
        owner_phone: '+12145550199',
        is_missed_call_active: true,
        cooldown_hours: 24
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ],
    calls: [
      {
        id: 'call-prior',
        org_id: 'org-1',
        caller_number: '+12145550888',
        called_number: '+12145550100',
        status: 'missed',
        auto_reply_sent: true,
        created_at: new Date().toISOString()
      }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 20
  })

  const res = await processMissedCall(db, {
    callerNumber: '+12145550888',
    calledNumber: '+12145550100',
    callOutcome,
    sendSmsFn: mockSendSms
  })

  assert.strictEqual(res.action, 'suppressed_cooldown_active')
  assert.strictEqual(sentSms.length, 0, 'Zero SMS dispatched for suppressed call')
  assert.strictEqual(res.ownerAlert, undefined)
})

test('P1-NOTIF-01 Test 14: Sensitive fields are never leaked in owner alert copy', () => {
  const alertText = buildOwnerMissedCallAlertText({
    callerPhone: '+12145550888',
    customerSmsSuccess: true,
    businessName: 'Precision HVAC'
  })

  const lower = alertText.toLowerCase()
  assert.strictEqual(lower.includes('ein'), false)
  assert.strictEqual(lower.includes('token'), false)
  assert.strictEqual(lower.includes('secret'), false)
  assert.strictEqual(lower.includes('password'), false)
  assert.strictEqual(lower.includes('address'), false)
  assert.strictEqual(lower.includes('stripe'), false)
  assert.strictEqual(lower.includes('org-'), false)
})

test('P1-NOTIF-01 Test 15: Owner alert is NEVER inserted into customer conversation messages', async () => {
  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Precision HVAC',
        owner_phone: '+12145550199',
        is_missed_call_active: true
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 20
  })

  await processMissedCall(db, {
    callerNumber: '+12145550888',
    calledNumber: '+12145550100',
    callOutcome
  })

  // Customer conversation thread must contain ONLY the customer-facing message
  assert.strictEqual(db._tables.messages.length, 1)
  assert.ok(!db._tables.messages[0].body.startsWith('CaptoDesk: Missed call from'))
  assert.ok(db._tables.messages[0].body.includes('missed your call'))
})
