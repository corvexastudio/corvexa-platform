process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert'
import fs from 'fs'
import path from 'path'

import {
  DEMO_ORG_ID,
  PLATFORM_TOLL_FREE_NUMBER,
  hasDedicatedPhoneNumber,
  resolvePlatformTollFreeNumber,
  resolveSenderPhone,
} from '../src/lib/billing/plans.ts'
import { verifyTenantOutboundSender } from '../src/lib/telephony/telnyx-numbers.ts'
import { processInboundSms } from '../src/lib/services/sms-handler.ts'
import { notifyOwner } from '../src/lib/notifications/notification-service.ts'
import { executeAction } from '../src/lib/automations/action-registry.ts'
import { triggerDedicatedProvisioningOnUpgrade } from '../src/lib/telephony/provisioning.ts'

const ROOT_DIR = path.resolve(import.meta.dirname, '..')

function createLifecycleMockDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers || [],
    contacts: initialState.contacts || [],
    conversations: initialState.conversations || [],
    messages: initialState.messages || [],
    leads: initialState.leads || [],
    notifications: initialState.notifications || [],
    notification_deliveries: initialState.notification_deliveries || [],
    push_subscriptions: initialState.push_subscriptions || [],
    profiles: initialState.profiles || [],
    compliance_audit_logs: initialState.compliance_audit_logs || [],
    compliance_suppression_list: initialState.compliance_suppression_list || [],
    consent_records: initialState.consent_records || [],
    automation_runs: initialState.automation_runs || [],
    audit_logs: initialState.audit_logs || [],
  }

  const buildQuery = (tableName) => {
    if (!tables[tableName]) tables[tableName] = []
    const filters = []
    let pendingAction = null

    const applyFilters = (rows) => rows.filter((row) => filters.every((fn) => fn(row)))

    const qb = {
      select: () => qb,
      eq: (col, val) => {
        filters.push((row) => row?.[col] === val)
        return qb
      },
      in: (col, arr) => {
        filters.push((row) => Array.isArray(arr) && arr.includes(row?.[col]))
        return qb
      },
      or: () => qb,
      not: (col, op, val) => {
        if (op === 'is' && val === null) {
          filters.push((row) => row?.[col] !== null && row?.[col] !== undefined)
        }
        return qb
      },
      gte: (col, val) => {
        filters.push((row) => new Date(row?.[col]).getTime() >= new Date(val).getTime())
        return qb
      },
      order: () => qb,
      limit: () => qb,
      insert: (rowOrRows) => {
        const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
        const inserted = rows.map((r) => {
          const newRow = {
            id: r.id || `mock_${tableName}_${Math.random().toString(36).slice(2, 10)}`,
            created_at: r.created_at || new Date().toISOString(),
            ...r,
          }
          tables[tableName].push(newRow)
          return newRow
        })
        pendingAction = { type: 'insert', rows: inserted }
        return qb
      },
      upsert: (rowOrRows, opts = {}) => {
        const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
        const conflictCols = opts.onConflict ? String(opts.onConflict).split(',').map((s) => s.trim()) : []
        const upserted = []
        for (const r of rows) {
          const existingIdx =
            conflictCols.length > 0
              ? tables[tableName].findIndex((existing) =>
                  conflictCols.every((col) => existing?.[col] === r?.[col])
                )
              : -1
          if (existingIdx >= 0) {
            tables[tableName][existingIdx] = { ...tables[tableName][existingIdx], ...r }
            upserted.push(tables[tableName][existingIdx])
          } else {
            const newRow = {
              id: r.id || `mock_${tableName}_${Math.random().toString(36).slice(2, 10)}`,
              created_at: r.created_at || new Date().toISOString(),
              ...r,
            }
            tables[tableName].push(newRow)
            upserted.push(newRow)
          }
        }
        pendingAction = { type: 'upsert', rows: upserted }
        return qb
      },
      update: (patch) => {
        pendingAction = { type: 'update', patch }
        return qb
      },
      delete: () => {
        pendingAction = { type: 'delete' }
        return qb
      },
      maybeSingle: async () => {
        const rows = await execute()
        const item = rows.data[0] || null
        if (item && tableName === 'telnyx_phone_numbers') {
          const org = tables.organizations.find((o) => o.id === item.org_id) || null
          return { data: { ...item, organizations: org }, error: null }
        }
        return { data: item, error: null }
      },
      single: async () => {
        const rows = await execute()
        if (!rows.data[0]) return { data: null, error: new Error(`No row in ${tableName}`) }
        return { data: rows.data[0], error: null }
      },
      then: (resolve, reject) => execute().then(resolve, reject),
    }

    const execute = async () => {
      if (pendingAction?.type === 'insert' || pendingAction?.type === 'upsert') {
        return { data: pendingAction.rows, count: pendingAction.rows.length, error: null }
      }
      if (pendingAction?.type === 'update') {
        const matched = applyFilters(tables[tableName])
        for (const row of matched) {
          Object.assign(row, pendingAction.patch)
        }
        return { data: matched, count: matched.length, error: null }
      }
      if (pendingAction?.type === 'delete') {
        const toDelete = new Set(applyFilters(tables[tableName]))
        tables[tableName] = tables[tableName].filter((r) => !toDelete.has(r))
        return { data: [], count: 0, error: null }
      }
      const matched = applyFilters(tables[tableName])
      return { data: matched, count: matched.length, error: null }
    }

    return qb
  }

  return {
    _tables: tables,
    from: (tableName) => buildQuery(tableName),
  }
}

test('Toll-free vs Dedicated DID resolution respects trial and paid lifecycle states', () => {
  const origLocal = process.env.TELNYX_PHONE_NUMBER
  const origSms = process.env.TELNYX_SMS_PHONE_NUMBER

  try {
    // Even if an unverified local TELNYX_PHONE_NUMBER is in env without TELNYX_SMS_PHONE_NUMBER,
    // free-trial sender resolution never falls back to the unverified local DID.
    process.env.TELNYX_PHONE_NUMBER = '+16823808060'
    delete process.env.TELNYX_SMS_PHONE_NUMBER

    assert.strictEqual(resolvePlatformTollFreeNumber(), '+18777713802')

    const freeTrialOrg = {
      id: 'org-free-1',
      plan_id: 'free',
      subscription_status: 'trial',
      telnyx_phone_number: null,
      phone_provisioning_status: 'pending_number',
    }
    assert.strictEqual(hasDedicatedPhoneNumber(freeTrialOrg), false)
    assert.strictEqual(resolveSenderPhone(freeTrialOrg), '+18777713802')

    const demoOrg = {
      id: DEMO_ORG_ID,
      plan_id: 'solo',
      telnyx_phone_number: '+18777713802',
      phone_provisioning_status: 'pending_number',
    }
    assert.strictEqual(hasDedicatedPhoneNumber(demoOrg), false)
    assert.strictEqual(resolveSenderPhone(demoOrg), '+18777713802')

    const provisioningPaidOrg = {
      id: 'org-paid-provisioning',
      plan_id: 'solo',
      subscription_status: 'active',
      telnyx_phone_number: '+15125550188',
      phone_provisioning_status: 'provisioning',
    }
    assert.strictEqual(hasDedicatedPhoneNumber(provisioningPaidOrg), false)
    assert.strictEqual(resolveSenderPhone(provisioningPaidOrg), '+18777713802')

    const activePaidOrg = {
      id: 'org-paid-active',
      plan_id: 'solo',
      subscription_status: 'active',
      telnyx_phone_number: '+15125550188',
      phone_provisioning_status: 'active',
    }
    assert.strictEqual(hasDedicatedPhoneNumber(activePaidOrg), true)
    assert.strictEqual(resolveSenderPhone(activePaidOrg), '+15125550188')
  } finally {
    if (origLocal !== undefined) process.env.TELNYX_PHONE_NUMBER = origLocal
    else delete process.env.TELNYX_PHONE_NUMBER
    if (origSms !== undefined) process.env.TELNYX_SMS_PHONE_NUMBER = origSms
    else delete process.env.TELNYX_SMS_PHONE_NUMBER
  }
})

test('verifyTenantOutboundSender allows shared +18777713802 for trial orgs and enforces dedicated DID for upgraded orgs', async () => {
  const db = createLifecycleMockDb({
    organizations: [
      {
        id: DEMO_ORG_ID,
        name: 'CaptoDesk Demo Services',
        telnyx_phone_number: PLATFORM_TOLL_FREE_NUMBER,
        phone_provisioning_status: 'pending_number',
      },
      {
        id: 'org-free-trial',
        name: 'Trial Plumbing',
        plan_id: 'free',
        subscription_status: 'trial',
        telnyx_phone_number: null,
        phone_provisioning_status: 'pending_number',
      },
      {
        id: 'org-paid-client',
        name: 'Paid HVAC Co',
        plan_id: 'solo',
        subscription_status: 'active',
        telnyx_phone_number: '+15125550199',
        phone_provisioning_status: 'active',
      },
      {
        id: 'org-other-client',
        name: 'Other Roofing',
        plan_id: 'solo',
        subscription_status: 'active',
        telnyx_phone_number: '+15125550200',
        phone_provisioning_status: 'active',
      },
    ],
    telnyx_phone_numbers: [
      {
        id: 'num-demo',
        org_id: DEMO_ORG_ID,
        phone_number: PLATFORM_TOLL_FREE_NUMBER,
        status: 'active',
        verification_status: 'verified',
      },
      {
        id: 'num-paid',
        org_id: 'org-paid-client',
        phone_number: '+15125550199',
        status: 'active',
        verification_status: 'verified',
      },
      {
        id: 'num-other',
        org_id: 'org-other-client',
        phone_number: '+15125550200',
        status: 'active',
        verification_status: 'verified',
      },
    ],
  })

  // Free trial org may send on verified shared toll-free number even though row in telnyx_phone_numbers points to Demo org
  const freeTollFreeCheck = await verifyTenantOutboundSender(db, 'org-free-trial', PLATFORM_TOLL_FREE_NUMBER)
  assert.strictEqual(freeTollFreeCheck.allowed, true)

  // Free trial org may NOT spoof another org's dedicated DID
  const freeSpoofCheck = await verifyTenantOutboundSender(db, 'org-free-trial', '+15125550199')
  assert.strictEqual(freeSpoofCheck.allowed, false)

  // Paid org with active dedicated DID MUST NOT use shared toll-free line anymore
  const paidUsingTollFreeCheck = await verifyTenantOutboundSender(db, 'org-paid-client', PLATFORM_TOLL_FREE_NUMBER)
  assert.strictEqual(paidUsingTollFreeCheck.allowed, false)

  // Paid org CAN send from its dedicated DID
  const paidDedicatedCheck = await verifyTenantOutboundSender(db, 'org-paid-client', '+15125550199')
  assert.strictEqual(paidDedicatedCheck.allowed, true)
})

test('Owner alerts and automation actions send from +18777713802 on free trial and switch to dedicated DID once provisioned', async () => {
  const sentSms = []
  const fakeSendSms = async (params) => {
    sentSms.push(params)
    return { success: true, messageId: `msg_${sentSms.length}` }
  }

  const db = createLifecycleMockDb({
    organizations: [
      {
        id: 'org-trial',
        name: 'Starter Trial Pipework',
        plan_id: 'free',
        subscription_status: 'trial',
        owner_phone: '+14695550101',
        telnyx_phone_number: null,
        phone_provisioning_status: 'pending_number',
        timezone: 'America/Chicago',
      },
      {
        id: 'org-upgraded',
        name: 'Upgraded Air Conditioning',
        plan_id: 'solo',
        subscription_status: 'active',
        owner_phone: '+15125550102',
        telnyx_phone_number: '+15125550999',
        phone_provisioning_status: 'active',
        timezone: 'America/Chicago',
      },
    ],
    telnyx_phone_numbers: [
      {
        id: 'num-upgraded',
        org_id: 'org-upgraded',
        phone_number: '+15125550999',
        status: 'active',
        verification_status: 'verified',
      },
    ],
  })

  await notifyOwner(db, {
    event: 'new_booking',
    organizationId: 'org-trial',
    idempotencyKey: 'test-trial-booking-1',
    data: {
      customerName: 'Alice Homeowner',
      serviceName: 'Drain Clearing',
      bookingTime: '10:00 AM',
    },
    sendSmsFn: fakeSendSms,
  })

  await notifyOwner(db, {
    event: 'new_booking',
    organizationId: 'org-upgraded',
    idempotencyKey: 'test-paid-booking-1',
    data: {
      customerName: 'Bob Homeowner',
      serviceName: 'AC Tune-Up',
      bookingTime: '2:00 PM',
    },
    sendSmsFn: fakeSendSms,
  })

  assert.strictEqual(sentSms.length, 2)
  assert.strictEqual(sentSms[0].from, PLATFORM_TOLL_FREE_NUMBER)
  assert.strictEqual(sentSms[0].to, '+14695550101')
  assert.strictEqual(sentSms[1].from, '+15125550999')
  assert.strictEqual(sentSms[1].to, '+15125550102')

  // Automation action executeAction: verify exact outbound `from` payload posted to Telnyx
  const origMockDispatch = process.env.TELNYX_MOCK_DISPATCH
  const origApiKey = process.env.TELNYX_API_KEY
  const origFetch = globalThis.fetch
  const capturedPayloads = []

  delete process.env.TELNYX_MOCK_DISPATCH
  process.env.TELNYX_API_KEY = 'KEY_UNIT_TEST_ONLY'
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('/v2/messages')) {
      capturedPayloads.push(JSON.parse(String(init?.body || '{}')))
      return new Response(JSON.stringify({ data: { id: `telnyx_${capturedPayloads.length}` } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return origFetch(url, init)
  }

  try {
    const autoTrialRes = await executeAction(
      'send_sms',
      { to: '+14695550888', message: 'Trial update', checkQuietHours: false, flowType: 'booking_confirmation' },
      {
        supabase: db,
        orgId: 'org-trial',
        eventPayload: { event_type: 'booking.confirmed', business_name: 'Starter Trial Pipework' },
      }
    )
    assert.strictEqual(autoTrialRes.success, true, `Trial send_sms failed: ${autoTrialRes.error}`)

    // Even if params.from previously cached '+18777713802', upgraded org resolves its active dedicated DID instead
    const autoUpgradedRes = await executeAction(
      'send_sms',
      {
        to: '+15125550889',
        from: PLATFORM_TOLL_FREE_NUMBER,
        message: 'Paid update',
        checkQuietHours: false,
        flowType: 'booking_confirmation',
      },
      {
        supabase: db,
        orgId: 'org-upgraded',
        eventPayload: { event_type: 'booking.confirmed', business_name: 'Upgraded Air Conditioning' },
      }
    )
    assert.strictEqual(autoUpgradedRes.success, true, `Upgraded send_sms failed: ${autoUpgradedRes.error}`)

    assert.strictEqual(capturedPayloads.length, 2)
    assert.strictEqual(capturedPayloads[0].from, PLATFORM_TOLL_FREE_NUMBER)
    assert.strictEqual(capturedPayloads[1].from, '+15125550999')
  } finally {
    globalThis.fetch = origFetch
    if (origMockDispatch !== undefined) process.env.TELNYX_MOCK_DISPATCH = origMockDispatch
    else delete process.env.TELNYX_MOCK_DISPATCH
    if (origApiKey !== undefined) process.env.TELNYX_API_KEY = origApiKey
    else delete process.env.TELNYX_API_KEY
  }
})

test('Shared toll-free inbound SMS correlates to active trial tenant, propagates STOP, and isolates dedicated DIDs', async () => {
  const customerPhone = '+14695550777'
  const tOld = '2026-11-10T10:00:00.000Z'
  const tNew = '2026-11-11T09:30:00.000Z'

  const db = createLifecycleMockDb({
    organizations: [
      {
        id: DEMO_ORG_ID,
        name: 'CaptoDesk Demo Services',
        telnyx_phone_number: PLATFORM_TOLL_FREE_NUMBER,
        phone_provisioning_status: 'pending_number',
      },
      {
        id: 'org-trial-old',
        name: 'Older Trial Plumber',
        plan_id: 'free',
        telnyx_phone_number: null,
        phone_provisioning_status: 'pending_number',
      },
      {
        id: 'org-trial-recent',
        name: 'Recent Trial Electrician',
        plan_id: 'free',
        telnyx_phone_number: null,
        phone_provisioning_status: 'pending_number',
      },
      {
        id: 'org-paid-dedicated',
        name: 'Paid Dedicated HVAC',
        plan_id: 'solo',
        subscription_status: 'active',
        telnyx_phone_number: '+15125550333',
        phone_provisioning_status: 'active',
      },
    ],
    telnyx_phone_numbers: [
      {
        id: 'num-demo',
        org_id: DEMO_ORG_ID,
        phone_number: PLATFORM_TOLL_FREE_NUMBER,
        status: 'active',
        verification_status: 'verified',
      },
      {
        id: 'num-paid',
        org_id: 'org-paid-dedicated',
        phone_number: '+15125550333',
        status: 'active',
        verification_status: 'verified',
      },
    ],
    contacts: [
      { id: 'c-old', org_id: 'org-trial-old', phone: customerPhone, name: 'Chris', opt_out: false, created_at: tOld, updated_at: tOld },
      { id: 'c-recent', org_id: 'org-trial-recent', phone: customerPhone, name: 'Chris', opt_out: false, created_at: tNew, updated_at: tNew },
      { id: 'c-paid', org_id: 'org-paid-dedicated', phone: customerPhone, name: 'Chris', opt_out: false, created_at: '2026-11-11T10:00:00.000Z' },
    ],
    conversations: [
      { id: 'conv-old', org_id: 'org-trial-old', contact_id: 'c-old', last_message_at: tOld, unread_count: 0 },
      { id: 'conv-recent', org_id: 'org-trial-recent', contact_id: 'c-recent', last_message_at: tNew, unread_count: 0 },
    ],
    compliance_audit_logs: [
      { org_id: 'org-trial-old', phone: customerPhone, action: 'message_sent', created_at: tOld },
      { org_id: 'org-trial-recent', phone: customerPhone, action: 'message_sent', created_at: tNew },
    ],
  })

  // 1. Reply to shared toll-free number should route to most recently interacting free-trial tenant (org-trial-recent),
  // NOT Demo org and NOT org-paid-dedicated (which owns a dedicated DID)
  const inboundTrialReply = await processInboundSms(db, {
    fromPhone: customerPhone,
    toPhone: PLATFORM_TOLL_FREE_NUMBER,
    text: 'Yes, 2pm works great!',
    telnyxMessageId: 'telnyx_inbound_trial_1',
    sendSmsFn: async () => ({ success: true }),
  })
  assert.strictEqual(inboundTrialReply.success, true)
  assert.strictEqual(inboundTrialReply.action, 'message_stored')

  const storedMsg = db._tables.messages.find((m) => m.telnyx_message_id === 'telnyx_inbound_trial_1')
  assert.ok(storedMsg, 'Inbound message should be stored')
  assert.strictEqual(storedMsg.org_id, 'org-trial-recent')

  // 2. Reply to paid client's dedicated DID MUST route strictly to paid client
  const inboundDedicatedReply = await processInboundSms(db, {
    fromPhone: customerPhone,
    toPhone: '+15125550333',
    text: 'On my way home now',
    telnyxMessageId: 'telnyx_inbound_paid_1',
    sendSmsFn: async () => ({ success: true }),
  })
  assert.strictEqual(inboundDedicatedReply.success, true)
  const paidMsg = db._tables.messages.find((m) => m.telnyx_message_id === 'telnyx_inbound_paid_1')
  assert.strictEqual(paidMsg?.org_id, 'org-paid-dedicated')

  // 3. Unknown caller on +18777713802 still falls back to Demo org
  const demoFallbackRes = await processInboundSms(db, {
    fromPhone: '+15125550998',
    toPhone: PLATFORM_TOLL_FREE_NUMBER,
    text: 'Do you service my area?',
    telnyxMessageId: 'telnyx_inbound_demo_1',
    sendSmsFn: async () => ({ success: true }),
  })
  assert.strictEqual(demoFallbackRes.success, true)
  const demoMsg = db._tables.messages.find((m) => m.telnyx_message_id === 'telnyx_inbound_demo_1')
  assert.strictEqual(demoMsg?.org_id, DEMO_ORG_ID)

  // 4. STOP sent to shared toll-free number opts out BOTH shared-number trial orgs
  const origMock = process.env.TELNYX_MOCK_DISPATCH
  process.env.TELNYX_MOCK_DISPATCH = 'true'
  try {
    const stopRes = await processInboundSms(db, {
      fromPhone: customerPhone,
      toPhone: PLATFORM_TOLL_FREE_NUMBER,
      text: 'STOP',
      telnyxMessageId: 'telnyx_inbound_stop_1',
    })
    assert.strictEqual(stopRes.success, true)
    assert.strictEqual(stopRes.action, 'opt_out_processed')

    const cOld = db._tables.contacts.find((c) => c.id === 'c-old')
    const cRecent = db._tables.contacts.find((c) => c.id === 'c-recent')
    const cPaid = db._tables.contacts.find((c) => c.id === 'c-paid')
    assert.strictEqual(cOld?.opt_out, true, 'Older shared-number trial org contact should be opted out')
    assert.strictEqual(cRecent?.opt_out, true, 'Recent shared-number trial org contact should be opted out')
    assert.strictEqual(cPaid?.opt_out, false, 'Dedicated DID paid org must remain isolated from shared toll-free STOP')
  } finally {
    if (origMock !== undefined) process.env.TELNYX_MOCK_DISPATCH = origMock
    else delete process.env.TELNYX_MOCK_DISPATCH
  }
})

test('triggerDedicatedProvisioningOnUpgrade provisions dedicated DID from owner area code and switches outbound sender', async () => {
  const db = createLifecycleMockDb({
    organizations: [
      {
        id: 'org-upgrade-1',
        name: 'Hill Country Plumbing',
        plan_id: 'solo',
        subscription_status: 'active',
        owner_phone: '+15125554444',
        telnyx_phone_number: null,
        phone_provisioning_status: 'pending_number',
      },
    ],
  })

  // Without Telnyx API key in test env, upgrade hook skips without marking status failed
  const skippedRes = await triggerDedicatedProvisioningOnUpgrade(db, 'org-upgrade-1')
  assert.strictEqual(skippedRes.triggered, false)
  assert.strictEqual(db._tables.organizations[0].phone_provisioning_status, 'pending_number')

  // With a Telnyx client injected, upgrade hook searches owner area code (512), buys dedicated DID,
  // marks phone_provisioning_status = 'active', and resolveSenderPhone immediately switches over
  let searchedAreaCode = null
  const mockTelnyxClient = {
    findExistingNumberOrderByCustomerReference: async () => null,
    getNumberOrdersByCustomerReference: async () => [],
    searchAvailableNumbers: async ({ areaCode }) => {
      searchedAreaCode = areaCode
      return [{ phoneNumber: '+15125550777', locality: 'Austin', region: 'TX' }]
    },
    createNumberOrder: async ({ phoneNumber }) => ({
      id: 'ord_live_123',
      status: 'success',
      phoneNumbers: [{ id: 'pn_123', phoneNumber, status: 'active' }],
    }),
  }

  const upgradeRes = await triggerDedicatedProvisioningOnUpgrade(db, 'org-upgrade-1', {
    apiClient: mockTelnyxClient,
  })
  assert.strictEqual(upgradeRes.triggered, true)
  assert.strictEqual(searchedAreaCode, '512')
  assert.strictEqual(upgradeRes.result?.status, 'active')
  assert.strictEqual(upgradeRes.result?.phoneNumber, '+15125550777')

  const updatedOrg = db._tables.organizations[0]
  assert.strictEqual(updatedOrg.telnyx_phone_number, '+15125550777')
  assert.strictEqual(updatedOrg.phone_provisioning_status, 'active')
  assert.strictEqual(hasDedicatedPhoneNumber(updatedOrg), true)
  assert.strictEqual(resolveSenderPhone(updatedOrg), '+15125550777')

  // Verify dedicated DID enforcement: +18777713802 is now rejected and +15125550777 is required
  assert.strictEqual((await verifyTenantOutboundSender(db, 'org-upgrade-1', PLATFORM_TOLL_FREE_NUMBER)).allowed, false)
  assert.strictEqual((await verifyTenantOutboundSender(db, 'org-upgrade-1', '+15125550777')).allowed, true)
})

test('No SMS route or service falls back to owner_phone as outbound caller ID and all use resolveSenderPhone', () => {
  const filesToCheck = [
    'src/app/api/messages/send/route.ts',
    'src/app/api/telnyx/test-sms/route.ts',
    'src/app/api/track/[token]/feedback/route.ts',
    'src/lib/reporting/weekly-digest.ts',
    'src/lib/crews/crew-manager.ts',
    'src/lib/retention/lifecycle-manager.ts',
    'src/lib/automations/action-registry.ts',
    'src/lib/services/messaging-service.ts',
    'src/lib/notifications/notification-service.ts',
  ]

  for (const relPath of filesToCheck) {
    const content = fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8')
    assert.strictEqual(
      content.includes('resolveSenderPhone'),
      true,
      `${relPath} must resolve sender phone via resolveSenderPhone`
    )
    assert.strictEqual(
      /telnyx_phone_number\s*\|\|\s*org\??\.owner_phone/.test(content),
      false,
      `${relPath} must not fall back to org.owner_phone as SMS sender caller ID`
    )
  }
})
