import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { processMissedCall } from '../src/lib/services/call-recovery.ts'
import { processInboundSms } from '../src/lib/services/sms-handler.ts'
import { updateJobStatus } from '../src/lib/jobs/job-manager.ts'
import { verifyTelnyxSignature } from '../src/lib/telnyx.ts'
import { executeAction } from '../src/lib/automations/action-registry.ts'
import { getAttentionQueue, getRecentCalls } from '../src/lib/dashboard/dashboard-service.ts'
import {
  resolveTelnyxDeliveryStatus,
  shouldUpdateMessageStatus
} from '../src/lib/telephony/message-state.ts'

/**
 * In-memory Supabase mock with schema enforcement for `calls.caller_number`
 * and relational join hydration (`contacts(...)`) so Inbox & Dashboard flows
 * can be verified end-to-end without network calls.
 */
function createRecoveryMockDb(initialState = {}) {
  const tables = new Proxy(
    {
      organizations: initialState.organizations || [],
      telnyx_phone_numbers: initialState.telnyx_phone_numbers || [],
      contacts: initialState.contacts || [],
      calls: initialState.calls || [],
      leads: initialState.leads || [],
      conversations: initialState.conversations || [],
      messages: initialState.messages || [],
      notifications: initialState.notifications || [],
      profiles: initialState.profiles || [],
      automation_rules: initialState.automation_rules || [],
      automation_runs: initialState.automation_runs || [],
      automation_jobs: initialState.automation_jobs || [],
      activity_logs: initialState.activity_logs || [],
      compliance_suppression_list: initialState.compliance_suppression_list || [],
      compliance_consent_records: initialState.compliance_consent_records || [],
      compliance_audit_logs: initialState.compliance_audit_logs || [],
      appointments: initialState.appointments || [],
      quotes: initialState.quotes || [],
      jobs: initialState.jobs || [],
      invoices: initialState.invoices || [],
      payments: initialState.payments || [],
      review_requests: initialState.review_requests || [],
      usage_counters: initialState.usage_counters || [],
      subscriptions: initialState.subscriptions || []
    },
    {
      get(target, prop) {
        if (!(prop in target)) {
          target[prop] = []
        }
        return target[prop]
      }
    }
  )

  let seq = 1

  function hydrateRow(tableName, row, selectCols) {
    if (!row) return null
    const cloned = { ...row }
    if (selectCols && selectCols.includes('contacts(') && cloned.contact_id) {
      cloned.contacts = tables.contacts.find((c) => c.id === cloned.contact_id) || null
    }
    if (selectCols && selectCols.includes('leads(') && cloned.lead_id) {
      cloned.leads = tables.leads.find((l) => l.id === cloned.lead_id) || null
    }
    return cloned
  }

  function applySelect() {
    return null
  }

  const client = {
    _tables: tables,
    from(tableName) {
      let filters = []
      let selectCols = '*'
      let selectOptions = null
      let orderSpec = null
      let limitCount = null

      const getFiltered = () => {
        if (
          tableName === 'calls' &&
          typeof selectCols === 'string' &&
          selectCols.includes('from_number')
        ) {
          return {
            rows: null,
            error: { message: 'column calls.from_number does not exist' }
          }
        }

        let rows = (tables[tableName] || [])
          .filter((row) => filters.every((fn) => fn(row)))
          .map((row) => hydrateRow(tableName, row, selectCols))

        if (orderSpec) {
          rows.sort((a, b) => {
            const av = a[orderSpec.col] ?? ''
            const bv = b[orderSpec.col] ?? ''
            if (av === bv) return 0
            return orderSpec.ascending ? (av < bv ? -1 : 1) : av > bv ? -1 : 1
          })
        }

        if (typeof limitCount === 'number') {
          rows = rows.slice(0, limitCount)
        }

        return { rows, error: null }
      }

      const builder = {
        select(cols = '*', opts = null) {
          selectCols = cols
          selectOptions = opts
          return builder
        },
        eq(col, val) {
          filters.push((r) => r[col] === val)
          return builder
        },
        neq(col, val) {
          filters.push((r) => r[col] !== val)
          return builder
        },
        in(col, vals) {
          filters.push((r) => Array.isArray(vals) && vals.includes(r[col]))
          return builder
        },
        is(col, val) {
          filters.push((r) => (r[col] ?? null) === val)
          return builder
        },
        not(col, op, val) {
          if (op === 'is' && val === null) {
            filters.push((r) => r[col] !== null && r[col] !== undefined)
          } else if (op === 'eq') {
            filters.push((r) => r[col] !== val)
          }
          return builder
        },
        gt(col, val) {
          filters.push((r) => (r[col] ?? '') > val)
          return builder
        },
        gte(col, val) {
          filters.push((r) => (r[col] ?? '') >= val)
          return builder
        },
        lte(col, val) {
          filters.push((r) => (r[col] ?? '') <= val)
          return builder
        },
        or() {
          return builder
        },
        order(col, opts = {}) {
          orderSpec = { col, ascending: opts.ascending !== false }
          return builder
        },
        limit(n) {
          limitCount = n
          return builder
        },
        async maybeSingle() {
          const { rows, error } = getFiltered()
          if (error) return { data: null, error }
          return { data: rows[0] || null, error: null }
        },
        async single() {
          const { rows, error } = getFiltered()
          if (error) return { data: null, error }
          if (rows.length === 0) return { data: null, error: { message: 'Row not found' } }
          return { data: rows[0], error: null }
        },
        then(resolve, reject) {
          const { rows, error } = getFiltered()
          const result = error
            ? { data: null, error, count: null }
            : selectOptions?.head
              ? { data: null, error: null, count: rows.length }
              : { data: rows, error: null, count: rows.length }
          return Promise.resolve(result).then(resolve, reject)
        },
        insert(payload) {
          const inputRows = Array.isArray(payload) ? payload : [payload]
          const inserted = inputRows.map((row) => {
            const newRow = {
              id: row.id || `${tableName}_${seq++}`,
              created_at: row.created_at || new Date().toISOString(),
              ...row
            }
            tables[tableName].push(newRow)
            return { ...newRow }
          })
          const first = inserted[0] || null
          const insertResult = {
            data: Array.isArray(payload) ? inserted : first,
            error: null,
            select() {
              return {
                async single() {
                  return { data: first, error: null }
                },
                async maybeSingle() {
                  return { data: first, error: null }
                },
                then(resolve, reject) {
                  return Promise.resolve({ data: inserted, error: null }).then(resolve, reject)
                }
              }
            },
            then(resolve, reject) {
              return Promise.resolve({
                data: Array.isArray(payload) ? inserted : first,
                error: null
              }).then(resolve, reject)
            }
          }
          return insertResult
        },
        update(patch) {
          const updateFilters = []
          const updater = {
            eq(col, val) {
              updateFilters.push((r) => r[col] === val)
              return updater
            },
            in(col, vals) {
              updateFilters.push((r) => Array.isArray(vals) && vals.includes(r[col]))
              return updater
            },
            _apply() {
              const updatedRows = []
              for (const row of tables[tableName]) {
                if (updateFilters.every((fn) => fn(row))) {
                  Object.assign(row, patch)
                  updatedRows.push({ ...row })
                }
              }
              return updatedRows
            },
            select() {
              const updatedRows = updater._apply()
              return {
                async single() {
                  return { data: updatedRows[0] || null, error: null }
                },
                async maybeSingle() {
                  return { data: updatedRows[0] || null, error: null }
                },
                then(resolve, reject) {
                  return Promise.resolve({ data: updatedRows, error: null }).then(resolve, reject)
                }
              }
            },
            then(resolve, reject) {
              const updatedRows = updater._apply()
              return Promise.resolve({ data: updatedRows, error: null }).then(resolve, reject)
            }
          }
          return updater
        },
        upsert(payload) {
          const inserted = client.from(tableName).insert(payload)
          return inserted
        }
      }

      void applySelect
      return builder
    }
  }

  return client
}

const DEMO_ORG_ID = '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7'
const TOLL_FREE_NUMBER = '+18777713802'
const DAYTIME_CHICAGO = new Date('2026-11-12T18:00:00.000Z') // 12:00 PM CST

test('Demo missed call creates open unread Inbox conversation on first call and increments unread_count on repeat missed call', async () => {
  const db = createRecoveryMockDb({
    organizations: [
      {
        id: DEMO_ORG_ID,
        name: 'CaptoDesk Demo Services',
        slug: 'captodesk-demo',
        plan_id: 'free',
        subscription_tier: 'trial',
        is_missed_call_active: true,
        timezone: 'America/Chicago',
        enforce_quiet_hours: false,
        cooldown_hours: 24,
        missed_call_template: 'Sorry we missed your call at {{business_name}}!'
      }
    ],
    telnyx_phone_numbers: [
      {
        id: 'pn_demo_tf',
        org_id: DEMO_ORG_ID,
        phone_number: TOLL_FREE_NUMBER,
        status: 'active',
        capabilities: { sms: true, voice: true }
      }
    ]
  })

  const sentSmsCalls = []
  const fakeSendSms = async (params) => {
    sentSmsCalls.push(params)
    return { success: true, messageId: `telnyx_msg_${sentSmsCalls.length}` }
  }

  const callerPhone = '+15125550142'

  // 1. First missed call in Demo Org
  const firstResult = await processMissedCall(db, {
    callerNumber: callerPhone,
    calledNumber: TOLL_FREE_NUMBER,
    callControlId: 'cc_demo_1',
    overrideDate: DAYTIME_CHICAGO,
    sendSmsFn: fakeSendSms,
    sendOwnerSmsFn: fakeSendSms,
    callOutcome: {
      state: 'missed',
      wasAnswered: false,
      isEligibleForRecovery: true,
      recoveryReason: 'no_answer',
      durationSeconds: 0,
      description: 'Caller hung up before answer'
    }
  })

  assert.equal(firstResult.success, true)
  assert.equal(firstResult.action, 'auto_reply_sent')
  assert.equal(db._tables.conversations.length, 1)
  assert.equal(db._tables.messages.length, 1)

  const convAfterFirst = db._tables.conversations[0]
  assert.equal(convAfterFirst.org_id, DEMO_ORG_ID)
  assert.equal(convAfterFirst.unread_count, 1)
  assert.equal(convAfterFirst.status, 'open')
  assert.ok(convAfterFirst.last_message_at, 'last_message_at should be populated')
  assert.ok(
    convAfterFirst.last_message_preview.includes('CaptoDesk Demo Services'),
    'last_message_preview should reflect sent auto-reply body'
  )

  const msgAfterFirst = db._tables.messages[0]
  assert.equal(msgAfterFirst.conversation_id, convAfterFirst.id)
  assert.equal(msgAfterFirst.direction, 'outbound')
  assert.equal(msgAfterFirst.sender_type, 'system')
  assert.equal(msgAfterFirst.delivery_status, 'sent')
  assert.equal(msgAfterFirst.telnyx_message_id, 'telnyx_msg_1')

  // Simulate owner previously closing the thread and expire cooldown window (> 24h before current clock)
  db._tables.conversations[0].status = 'closed'
  db._tables.calls[0].created_at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()

  // 2. Repeat missed call from same caller updates existing thread instead of creating duplicate or hiding unread badge
  const secondResult = await processMissedCall(db, {
    callerNumber: callerPhone,
    calledNumber: TOLL_FREE_NUMBER,
    callControlId: 'cc_demo_2',
    overrideDate: DAYTIME_CHICAGO,
    sendSmsFn: fakeSendSms,
    sendOwnerSmsFn: fakeSendSms,
    callOutcome: {
      state: 'missed',
      wasAnswered: false,
      isEligibleForRecovery: true,
      recoveryReason: 'no_answer',
      durationSeconds: 0,
      description: 'Second missed call after cooldown'
    }
  })

  assert.equal(secondResult.success, true)
  assert.equal(secondResult.action, 'auto_reply_sent')
  assert.equal(db._tables.conversations.length, 1, 'Should reuse existing conversation for same contact')
  assert.equal(db._tables.messages.length, 2, 'Should append second outbound recovery SMS to conversation')

  const convAfterSecond = db._tables.conversations[0]
  assert.equal(convAfterSecond.status, 'open', 'Repeat missed call should re-open closed conversation')
  assert.equal(convAfterSecond.unread_count, 2, 'Repeat missed call should increment unread_count')
  assert.equal(db._tables.messages[1].conversation_id, convAfterFirst.id)
  assert.equal(db._tables.messages[1].telnyx_message_id, 'telnyx_msg_2')
})

test('Live paid org with dedicated DID logs missed-call auto-reply into Inbox using dedicated sender number', async () => {
  const paidOrgId = 'org_paid_dedicated_001'
  const dedicatedDid = '+15125550199'

  const db = createRecoveryMockDb({
    organizations: [
      {
        id: paidOrgId,
        name: 'Austin Copper Plumbing',
        slug: 'austin-copper',
        plan_id: 'solo',
        subscription_status: 'active',
        is_missed_call_active: true,
        timezone: 'America/Chicago',
        enforce_quiet_hours: false,
        cooldown_hours: 24
      }
    ],
    telnyx_phone_numbers: [
      {
        id: 'pn_dedicated_1',
        org_id: paidOrgId,
        phone_number: dedicatedDid,
        status: 'active',
        capabilities: { sms: true, voice: true }
      }
    ]
  })

  let capturedFrom = null
  const result = await processMissedCall(db, {
    callerNumber: '+15125550166',
    calledNumber: dedicatedDid,
    callControlId: 'cc_live_1',
    overrideDate: DAYTIME_CHICAGO,
    sendSmsFn: async (params) => {
      capturedFrom = params.from
      return { success: true, messageId: 'telnyx_live_1' }
    },
    sendOwnerSmsFn: async () => ({ success: true, messageId: 'telnyx_owner_1' }),
    callOutcome: {
      state: 'missed',
      wasAnswered: false,
      isEligibleForRecovery: true,
      recoveryReason: 'no_answer',
      durationSeconds: 0,
      description: 'Live caller hung up'
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.action, 'auto_reply_sent')
  assert.equal(capturedFrom, dedicatedDid, 'Paid org should send missed-call reply from its dedicated DID')
  assert.equal(db._tables.conversations.length, 1)
  assert.equal(db._tables.conversations[0].unread_count, 1)
  assert.equal(db._tables.messages.length, 1)
  assert.equal(db._tables.messages[0].telnyx_message_id, 'telnyx_live_1')
})

test('executeAction send_sms creates missing conversation and increments unread only for missed_call_recovery', async () => {
  const prevMock = process.env.TELNYX_MOCK_DISPATCH
  process.env.TELNYX_MOCK_DISPATCH = 'true'

  try {
    const orgId = 'org_action_test_1'
    const contactMissedId = 'contact_missed_1'
    const contactGeneralId = 'contact_general_1'

    const db = createRecoveryMockDb({
      organizations: [
        {
          id: orgId,
          name: 'Lone Star HVAC',
          plan_id: 'trial',
          subscription_tier: 'trial',
          trial_jobs_used: 0,
          trial_jobs_limit: 3,
          timezone: 'America/Chicago',
          enforce_quiet_hours: false,
          max_daily_sms_per_recipient: 10
        }
      ],
      contacts: [
        {
          id: contactMissedId,
          org_id: orgId,
          name: 'Alex Caller',
          phone: '+15125550171',
          opt_out: false
        },
        {
          id: contactGeneralId,
          org_id: orgId,
          name: 'Jamie Customer',
          phone: '+15125550172',
          opt_out: false
        }
      ]
    })

    // Delayed missed call recovery (e.g. quiet hours 8:05 AM job) with NO pre-existing conversation
    const missedAction = await executeAction(
      'send_sms',
      {
        template: 'Good morning {{first_name}}, following up on your call!',
        flowType: 'missed_call_recovery'
      },
      {
        supabase: db,
        orgId,
        contactId: contactMissedId,
        eventPayload: { phone: '+15125550171' }
      }
    )

    assert.equal(missedAction.success, true)
    assert.equal(db._tables.conversations.length, 1)
    assert.equal(db._tables.conversations[0].contact_id, contactMissedId)
    assert.equal(db._tables.conversations[0].unread_count, 1)
    assert.equal(db._tables.conversations[0].status, 'open')
    assert.equal(db._tables.messages.length, 1)
    assert.equal(db._tables.messages[0].conversation_id, db._tables.conversations[0].id)

    // Generic automation SMS also ensures conversation exists, keeping unread_count at 0
    const generalAction = await executeAction(
      'send_sms',
      {
        template: 'Reminder: technician arrives soon.',
        flowType: 'appointment_reminder'
      },
      {
        supabase: db,
        orgId,
        contactId: contactGeneralId,
        eventPayload: { phone: '+15125550172' }
      }
    )

    assert.equal(generalAction.success, true)
    assert.equal(db._tables.conversations.length, 2)
    const generalConv = db._tables.conversations.find((c) => c.contact_id === contactGeneralId)
    assert.ok(generalConv)
    assert.equal(generalConv.unread_count, 0)
    assert.equal(db._tables.messages.length, 2)
  } finally {
    if (prevMock === undefined) delete process.env.TELNYX_MOCK_DISPATCH
    else process.env.TELNYX_MOCK_DISPATCH = prevMock
  }
})

test('Dashboard getAttentionQueue and getRecentCalls query caller_number without from_number SQL errors', async () => {
  const orgId = 'org_dash_1'
  const contactId = 'contact_dash_1'
  const db = createRecoveryMockDb({
    contacts: [
      { id: contactId, org_id: orgId, name: 'Morgan Diaz', phone: '+15125550188' }
    ],
    calls: [
      {
        id: 'call_dash_1',
        org_id: orgId,
        contact_id: contactId,
        caller_number: '+15125550188',
        called_number: TOLL_FREE_NUMBER,
        status: 'missed',
        auto_reply_sent: true,
        created_at: new Date().toISOString()
      }
    ]
  })

  const attention = await getAttentionQueue(db, orgId)
  const missedCard = attention.find((item) => item.category === 'missed_call')
  assert.ok(missedCard, 'Expected missed_call attention item from calls.caller_number')
  assert.equal(missedCard.metadata.phoneNumber, '+15125550188')
  assert.equal(missedCard.title, 'Missed Call: Morgan Diaz')

  const recentCalls = await getRecentCalls(db, orgId, 5)
  assert.equal(recentCalls.length, 1)
  assert.equal(recentCalls[0].callerNumber, '+15125550188')
  assert.equal(recentCalls[0].customerName, 'Morgan Diaz')
  assert.equal(recentCalls[0].autoReplySent, true)
})

test('Telnyx message.finalized status resolution and webhook/Inbox regression guards', () => {
  assert.equal(
    resolveTelnyxDeliveryStatus('message.finalized', { to: [{ status: 'delivered' }] }),
    'delivered'
  )
  assert.equal(
    resolveTelnyxDeliveryStatus('message.finalized', { to: [{ status: 'delivery_failed' }] }),
    'failed'
  )
  assert.equal(
    resolveTelnyxDeliveryStatus('message.finalized', { to: [{ status: 'sending_failed' }] }),
    'failed'
  )
  assert.equal(
    resolveTelnyxDeliveryStatus('message.finalized', { to: [{ status: 'delivery_unconfirmed' }] }),
    'undelivered'
  )
  assert.equal(
    resolveTelnyxDeliveryStatus('message.finalized', { errors: [{ detail: 'Blocked' }], to: [] }),
    'failed'
  )

  assert.equal(shouldUpdateMessageStatus('sent', 'delivered').allowed, true)
  assert.equal(shouldUpdateMessageStatus('delivered', 'sent').allowed, false)

  const webhookRouteSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/api/webhooks/telnyx/messages/route.ts'),
    'utf8'
  )
  assert.ok(webhookRouteSrc.includes("'message.finalized'"))
  assert.ok(webhookRouteSrc.includes('resolveTelnyxDeliveryStatus(eventType, payload)'))

  const inboxPageSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/client/inbox/page.tsx'),
    'utf8'
  )
  assert.ok(inboxPageSrc.includes('isConvError ?'))
  assert.ok(inboxPageSrc.includes('Failed to load conversations'))
})

test('processInboundSms opens new conversation on cold toll-free text and re-opens closed trial thread on reply', async () => {
  const trialOrgId = 'org_trial_reply_1'
  const contactId = 'contact_reply_1'
  const db = createRecoveryMockDb({
    organizations: [
      {
        id: DEMO_ORG_ID,
        name: 'CaptoDesk Demo Services',
        slug: 'captodesk-demo',
        plan_id: 'free',
        subscription_tier: 'trial',
        owner_phone: '+15125550100'
      },
      {
        id: trialOrgId,
        name: 'Trial HVAC Pros',
        slug: 'trial-hvac-pros',
        plan_id: 'free',
        subscription_tier: 'trial',
        trial_jobs_used: 1,
        trial_jobs_limit: 3,
        owner_phone: '+15125550101'
      }
    ],
    telnyx_phone_numbers: [
      {
        id: 'pn_demo_tf',
        org_id: DEMO_ORG_ID,
        phone_number: TOLL_FREE_NUMBER,
        status: 'active',
        capabilities: { sms: true, voice: true }
      }
    ],
    contacts: [
      {
        id: contactId,
        org_id: trialOrgId,
        name: 'Sam Customer',
        phone: '+15125550155',
        opt_out: false,
        updated_at: new Date().toISOString()
      }
    ],
    conversations: [
      {
        id: 'conv_closed_1',
        org_id: trialOrgId,
        contact_id: contactId,
        status: 'closed',
        unread_count: 0,
        last_message_at: new Date(Date.now() - 60_000).toISOString(),
        last_message_preview: 'Previous outbound text'
      }
    ]
  })

  // 1. Reply from Sam Customer to shared +18777713802 routes to Trial HVAC Pros and re-opens closed conversation
  const replyRes = await processInboundSms(db, {
    fromPhone: '+15125550155',
    toPhone: TOLL_FREE_NUMBER,
    text: 'Yes please send a tech tomorrow morning!',
    telnyxMessageId: 'telnyx_in_reply_1',
    sendSmsFn: async () => ({ success: true, messageId: 'owner_alert_1' })
  })

  assert.equal(replyRes.success, true)
  assert.equal(replyRes.action, 'message_stored')
  const trialConv = db._tables.conversations.find((c) => c.id === 'conv_closed_1')
  assert.equal(trialConv.status, 'open', 'Inbound reply should re-open previously closed conversation')
  assert.equal(trialConv.unread_count, 1)
  assert.equal(trialConv.last_message_preview, 'Yes please send a tech tomorrow morning!')

  // 2. Cold inbound SMS from unknown caller to +18777713802 routes to Demo Org with status open
  const coldRes = await processInboundSms(db, {
    fromPhone: '+15125550190',
    toPhone: TOLL_FREE_NUMBER,
    text: 'Hi, how does CaptoDesk work?',
    telnyxMessageId: 'telnyx_in_cold_1',
    sendSmsFn: async () => ({ success: true, messageId: 'owner_alert_2' })
  })

  assert.equal(coldRes.success, true)
  assert.equal(coldRes.action, 'message_stored')
  const demoConv = db._tables.conversations.find((c) => c.org_id === DEMO_ORG_ID)
  assert.ok(demoConv)
  assert.equal(demoConv.status, 'open')
  assert.equal(demoConv.unread_count, 1)
  assert.equal(demoConv.last_message_preview, 'Hi, how does CaptoDesk work?')
})

test('verifyTelnyxSignature verifies Ed25519 signature and rejects tampered webhook payloads', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  const spkiDer = publicKey.export({ format: 'der', type: 'spki' })
  // Ed25519 SPKI DER starts with 12-byte ASN.1 header followed by 32-byte raw key
  const rawPubBase64 = Buffer.from(spkiDer).subarray(12).toString('base64')

  const timestamp = String(Math.floor(Date.now() / 1000))
  const rawBody = JSON.stringify({ data: { id: 'evt_1', event_type: 'message.received' } })
  const signedPayload = `${timestamp}|${rawBody}`
  const sigBase64 = crypto.sign(null, Buffer.from(signedPayload, 'utf8'), privateKey).toString('base64')

  assert.equal(verifyTelnyxSignature(rawBody, sigBase64, timestamp, rawPubBase64), true)
  assert.equal(verifyTelnyxSignature(`${rawBody} `, sigBase64, timestamp, rawPubBase64), false)
  assert.equal(verifyTelnyxSignature(rawBody, 'invalid-sig', timestamp, rawPubBase64), false)
})

test('updateJobStatus en_route logs compliance audit + Inbox conversation and routes shared toll-free reply to that org', async () => {
  const prevMock = process.env.TELNYX_MOCK_DISPATCH
  const prevTz = process.env.TZ
  process.env.TELNYX_MOCK_DISPATCH = 'true'

  try {
    const olderOrgId = 'org_older_enroute'
    const activeOrgId = 'org_active_enroute'
    const customerPhone = '+15125550166'
    const olderContactId = 'contact_older_1'
    const activeContactId = 'contact_active_1'
    const jobId = 'job_enroute_1'
    const earlierIso = new Date(Date.now() - 120_000).toISOString()

    const db = createRecoveryMockDb({
      organizations: [
        {
          id: olderOrgId,
          name: 'Earlier Plumbing',
          plan_id: 'free',
          subscription_status: 'free',
          timezone: 'America/Chicago',
          enforce_quiet_hours: false,
          owner_phone: '+15125550100'
        },
        {
          id: activeOrgId,
          name: 'Active HVAC Dispatch',
          plan_id: 'free',
          subscription_status: 'free',
          timezone: 'America/Chicago',
          enforce_quiet_hours: false,
          owner_phone: '+15125550101'
        }
      ],
      contacts: [
        {
          id: olderContactId,
          org_id: olderOrgId,
          name: 'Alex Rivera',
          phone: customerPhone,
          opt_out: false,
          updated_at: earlierIso
        },
        {
          id: activeContactId,
          org_id: activeOrgId,
          name: 'Alex Rivera',
          phone: customerPhone,
          opt_out: false,
          updated_at: earlierIso
        }
      ],
      conversations: [
        {
          id: 'conv_older_1',
          org_id: olderOrgId,
          contact_id: olderContactId,
          status: 'open',
          unread_count: 0,
          last_message_at: earlierIso,
          last_message_preview: 'Older thread'
        }
      ],
      compliance_audit_logs: [
        {
          id: 'audit_older_1',
          org_id: olderOrgId,
          phone: customerPhone,
          contact_id: olderContactId,
          action: 'message_sent',
          reason: 'booking_confirmed',
          created_at: earlierIso
        }
      ],
      jobs: [
        {
          id: jobId,
          org_id: activeOrgId,
          contact_id: activeContactId,
          job_number: 'JOB-2026-000099',
          title: 'AC Diagnostic',
          status: 'scheduled',
          tracking_token: 'tok_enroute_test_1',
          created_at: earlierIso
        }
      ]
    })

    const res = await updateJobStatus(db, {
      orgId: activeOrgId,
      jobId,
      newStatus: 'en_route',
      notifyCustomer: true,
      technicianName: 'Sam Tech',
      etaMinutes: 20
    })

    assert.equal(res.success, true, `updateJobStatus failed: ${res.error || JSON.stringify(res)}`)
    const auditEntry = db._tables.compliance_audit_logs.find(
      (a) => a.org_id === activeOrgId && a.action === 'message_sent' && a.reason === 'job_en_route'
    )
    assert.ok(auditEntry, 'en_route SMS must record message_sent compliance audit log')

    const activeConv = db._tables.conversations.find((c) => c.org_id === activeOrgId)
    assert.ok(activeConv, 'en_route SMS must create/update an Inbox conversation')
    const activeMsg = db._tables.messages.find(
      (m) => m.org_id === activeOrgId && m.automation_source === 'job_en_route'
    )
    assert.ok(activeMsg, 'en_route SMS must log a message row with automation_source job_en_route')

    // Subsequent inbound reply from customer to shared toll-free must route to activeOrgId (latest outbound), not olderOrgId
    const inboundRes = await processInboundSms(db, {
      fromPhone: customerPhone,
      toPhone: TOLL_FREE_NUMBER,
      text: 'Thanks, gate code is 4580!',
      telnyxMessageId: 'telnyx_in_enroute_reply',
      sendSmsFn: async () => ({ success: true, messageId: 'owner_alert_enroute' })
    })

    assert.equal(inboundRes.success, true)
    const routedMsg = db._tables.messages.find(
      (m) => m.org_id === activeOrgId && m.body === 'Thanks, gate code is 4580!'
    )
    assert.ok(routedMsg, 'Customer reply after On My Way text must route to the active dispatching org')
  } finally {
    if (prevMock === undefined) delete process.env.TELNYX_MOCK_DISPATCH
    else process.env.TELNYX_MOCK_DISPATCH = prevMock
    if (prevTz === undefined) delete process.env.TZ
    else process.env.TZ = prevTz
  }
})

test('Inbox API & Demo quiet-hours: GET /api/client/inbox does not query missing contacts.lifetime_value and enforce_quiet_hours=false sends 24/7', async () => {
  const inboxRouteSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/client/inbox/route.ts'),
    'utf8'
  )
  assert.equal(
    inboxRouteSrc.includes('lifetime_value'),
    false,
    'src/app/api/client/inbox/route.ts must not select non-existent contacts.lifetime_value column'
  )

  const demoOrgId = 'org_demo_247'
  const db = createRecoveryMockDb({
    organizations: [
      {
        id: demoOrgId,
        name: 'Demo Services 24/7',
        slug: 'demo-services-247',
        is_missed_call_active: true,
        enforce_quiet_hours: false,
        cooldown_hours: 0,
        timezone: 'America/Chicago',
        telnyx_phone_number: TOLL_FREE_NUMBER,
        plan_id: 'solo'
      }
    ],
    telnyx_phone_numbers: [
      {
        id: 'num_demo_tfn',
        org_id: demoOrgId,
        phone_number: TOLL_FREE_NUMBER,
        status: 'active',
        verification_status: 'verified'
      }
    ]
  })

  // Simulate 3:05 AM CST (quiet hours if enforce_quiet_hours were true)
  const nightDate = new Date('2026-11-12T09:05:00.000Z')
  let sentCount = 0
  const sendMock = async () => {
    sentCount += 1
    return { success: true, messageId: `demo_msg_${sentCount}` }
  }

  const firstRes = await processMissedCall(db, {
    callerNumber: '+16823808060',
    calledNumber: TOLL_FREE_NUMBER,
    callOutcome: { state: 'no_answer', wasAnswered: false, isEligibleForRecovery: true, durationSeconds: 0 },
    callControlId: 'ctrl_demo_night_1',
    sendSmsFn: sendMock,
    overrideDate: nightDate
  })

  assert.equal(firstRes.action, 'auto_reply_sent')
  assert.equal(sentCount, 1)

  // Immediate repeat call when cooldown_hours = 0 must NOT coerce 0 || 24 -> 24
  const secondRes = await processMissedCall(db, {
    callerNumber: '+16823808060',
    calledNumber: TOLL_FREE_NUMBER,
    callOutcome: { state: 'no_answer', wasAnswered: false, isEligibleForRecovery: true, durationSeconds: 0 },
    callControlId: 'ctrl_demo_night_2',
    sendSmsFn: sendMock,
    overrideDate: nightDate
  })

  assert.equal(secondRes.action, 'auto_reply_sent')
  assert.equal(sentCount, 2)
})

