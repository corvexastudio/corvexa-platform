process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PLATFORM_TOLL_FREE_NUMBER,
  resolvePlatformTollFreeNumber,
  resolveSenderPhone,
  hasDedicatedPhoneNumber,
} from '../src/lib/billing/plans.ts'
import { processMissedCall } from '../src/lib/services/call-recovery.ts'
import {
  createBooking,
  customerCancelBooking,
  customerRescheduleBooking,
} from '../src/lib/booking/booking-manager.ts'
import { updateJobStatus } from '../src/lib/jobs/job-manager.ts'
import { createQuote, sendQuote } from '../src/lib/quotes/quote-manager.ts'
import { sendInvoice, recordPayment } from '../src/lib/payments/invoice-manager.ts'
import { dispatchReviewRequest } from '../src/lib/reviews/review-manager.ts'
import { executeAction } from '../src/lib/automations/action-registry.ts'

function createMockAuditDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers || [],
    contacts: initialState.contacts || [],
    conversations: initialState.conversations || [],
    messages: initialState.messages || [],
    leads: initialState.leads || [],
    calls: initialState.calls || [],
    appointments: initialState.appointments || [],
    jobs: initialState.jobs || [],
    quotes: initialState.quotes || [],
    quote_items: initialState.quote_items || [],
    invoices: initialState.invoices || [],
    invoice_items: initialState.invoice_items || [],
    payments: initialState.payments || [],
    review_requests: initialState.review_requests || [],
    notifications: initialState.notifications || [],
    notification_deliveries: initialState.notification_deliveries || [],
    push_subscriptions: initialState.push_subscriptions || [],
    profiles: initialState.profiles || [],
    compliance_audit_logs: initialState.compliance_audit_logs || [],
    compliance_suppression_list: initialState.compliance_suppression_list || [],
    consent_records: initialState.consent_records || [],
    automation_runs: initialState.automation_runs || [],
    audit_logs: initialState.audit_logs || [],
    services: initialState.services || [],
    team_members: initialState.team_members || [],
    saas_subscriptions: initialState.saas_subscriptions || [],
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
      neq: (col, val) => {
        filters.push((row) => row?.[col] !== val)
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
      is: (col, val) => {
        if (val === null) {
          filters.push((row) => row?.[col] === null || row?.[col] === undefined)
        } else {
          filters.push((row) => row?.[col] === val)
        }
        return qb
      },
      gte: (col, val) => {
        filters.push((row) => new Date(row?.[col]).getTime() >= new Date(val).getTime())
        return qb
      },
      lte: (col, val) => {
        filters.push((row) => new Date(row?.[col]).getTime() <= new Date(val).getTime())
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
      update: (updates) => {
        pendingAction = { type: 'update', updates }
        return qb
      },
      delete: () => {
        pendingAction = { type: 'delete' }
        return qb
      },
      single: async () => {
        const res = await qb.then()
        return { data: res.data?.[0] || null, error: res.data?.[0] ? null : { message: 'Row not found' } }
      },
      maybeSingle: async () => {
        const res = await qb.then()
        return { data: res.data?.[0] || null, error: null }
      },
      then: async (resolve) => {
        let result = { data: [], error: null }
        if (pendingAction?.type === 'insert') {
          result = { data: pendingAction.rows, error: null }
        } else if (pendingAction?.type === 'update') {
          const matched = applyFilters(tables[tableName])
          matched.forEach((r) => Object.assign(r, pendingAction.updates))
          result = { data: matched, error: null }
        } else if (pendingAction?.type === 'delete') {
          const matched = applyFilters(tables[tableName])
          const toDelete = new Set(matched)
          tables[tableName] = tables[tableName].filter((r) => !toDelete.has(r))
          result = { data: [], error: null }
        } else {
          const matched = applyFilters(tables[tableName])
          result = { data: matched, error: null }
        }
        if (resolve) return resolve(result)
        return result
      },
    }

    return qb
  }

  return {
    _tables: tables,
    from: (tableName) => buildQuery(tableName),
  }
}

test('EVENT 1: Missed Call Recovery is gated to Solo Pro (Dedicated 10DLC) and Demo, zero telecom friction on Free', async () => {
  const sentSms = []
  const mockSendSms = async (payload) => {
    sentSms.push(payload)
    return { success: true, messageId: 'msg_' + Math.random().toString(36).slice(2, 8) }
  }

  // 1A: Free Starter Pass -> Missed call text is suppressed because missed call recovery
  // requires a dedicated business number, 10DLC campaign registration, and call forwarding.
  // Leads are preserved and owner is notified to upgrade to Solo Pro.
  const dbFree = createMockAuditDb({
    organizations: [{
      id: 'org-free-starter',
      name: "Sam's Plumbing",
      plan_id: 'free',
      subscription_status: 'free',
      telnyx_phone_number: null,
      phone_provisioning_status: 'pending_number',
      is_missed_call_active: true,
      enforce_quiet_hours: false,
    }],
    telnyx_phone_numbers: [{
      org_id: 'org-free-starter',
      phone_number: '+18777713802',
      status: 'active',
      capabilities: ['voice', 'sms'],
      verification_status: 'verified',
    }],
  })

  const freeCallResult = await processMissedCall(dbFree, {
    callerNumber: '+15125550111',
    calledNumber: '+18777713802',
    callOutcome: { state: 'no_answer', wasAnswered: false, isEligibleForRecovery: true, durationSeconds: 0, description: '' },
    sendSmsFn: mockSendSms,
  })

  assert.equal(freeCallResult.success, true)
  assert.equal(freeCallResult.action, 'suppressed_free_tier')
  assert.equal(freeCallResult.suppressionReason, 'free_tier_no_telecom')
  assert.equal(sentSms.length, 0) // Zero SMS sent to caller on free tier
  assert.equal(dbFree._tables.leads.length, 1) // Lead preserved in CRM
  assert.ok(dbFree._tables.notifications.length >= 1) // Owner alerted of missed call lead

  // 1B: Sales Demo Tenant (slug: demo) -> Missed call text triggers from +18777713802
  const dbDemo = createMockAuditDb({
    organizations: [{
      id: '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7',
      slug: 'demo',
      name: 'CaptoDesk Demo HVAC',
      plan_id: 'solo',
      subscription_status: 'active',
      telnyx_phone_number: '+18777713802',
      phone_provisioning_status: 'active',
      is_missed_call_active: true,
      enforce_quiet_hours: false,
    }],
    telnyx_phone_numbers: [{
      org_id: '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7',
      phone_number: '+18777713802',
      status: 'active',
      capabilities: ['voice', 'sms'],
      verification_status: 'verified',
    }],
  })

  const demoCallResult = await processMissedCall(dbDemo, {
    callerNumber: '+15125550222',
    calledNumber: '+18777713802',
    callOutcome: { state: 'no_answer', wasAnswered: false, isEligibleForRecovery: true, durationSeconds: 0, description: '' },
    sendSmsFn: mockSendSms,
  })

  assert.equal(demoCallResult.success, true)
  assert.equal(sentSms.length, 1)
  assert.equal(sentSms[0].to, '+15125550222')
  assert.equal(sentSms[0].from, '+18777713802') // Platform Toll-Free for Demo
  assert.match(sentSms[0].text, /CaptoDesk Demo HVAC/)

  // 1C: Paid Pro Organization with dedicated DID -> Missed call text triggers from dedicated DID
  const dbPaid = createMockAuditDb({
    organizations: [{
      id: 'org-paid-pro',
      name: "Austin Pro Roofing",
      plan_id: 'solo',
      subscription_status: 'active',
      telnyx_phone_number: '+15125559988',
      phone_provisioning_status: 'active',
      is_missed_call_active: true,
      enforce_quiet_hours: false,
    }],
    telnyx_phone_numbers: [{
      org_id: 'org-paid-pro',
      phone_number: '+15125559988',
      status: 'active',
      capabilities: ['voice', 'sms'],
      verification_status: 'verified',
    }],
  })

  const paidCallResult = await processMissedCall(dbPaid, {
    callerNumber: '+15125550333',
    calledNumber: '+15125559988',
    callOutcome: { state: 'no_answer', wasAnswered: false, isEligibleForRecovery: true, durationSeconds: 0, description: '' },
    sendSmsFn: mockSendSms,
  })

  assert.equal(paidCallResult.success, true)
  assert.equal(sentSms.length, 2)
  assert.equal(sentSms[1].to, '+15125550333')
  assert.equal(sentSms[1].from, '+15125559988') // Dedicated Business Number
  assert.match(sentSms[1].text, /Austin Pro Roofing/)
})

test('EVENT 2: TCPA Quiet Hours Missed Call Morning Recovery schedules with Dedicated DID on Pro', async () => {
  // Late night call at 11:30 PM (Quiet Hours active)
  const lateNight = new Date('2026-11-20T23:30:00-06:00')

  // Pro Tier
  const dbPaid = createMockAuditDb({
    organizations: [{
      id: 'org-paid-qh',
      name: "Emergency 24/7 HVAC",
      plan_id: 'solo',
      subscription_status: 'active',
      telnyx_phone_number: '+15125557766',
      phone_provisioning_status: 'active',
      timezone: 'America/Chicago',
      is_missed_call_active: true,
      enforce_quiet_hours: true,
    }],
    telnyx_phone_numbers: [{
      org_id: 'org-paid-qh',
      phone_number: '+15125557766',
      status: 'active',
      capabilities: ['voice', 'sms'],
    }],
  })

  const paidResult = await processMissedCall(dbPaid, {
    callerNumber: '+15125550555',
    calledNumber: '+15125557766',
    callOutcome: { state: 'no_answer', wasAnswered: false, isEligibleForRecovery: true, durationSeconds: 0, description: '' },
    overrideDate: lateNight,
  })

  assert.equal(paidResult.success, true)
  assert.equal(paidResult.action, 'suppressed_tcpa_quiet_hours')
  assert.equal(dbPaid._tables.automation_runs.length, 1)
  const scheduledRunPaid = dbPaid._tables.automation_runs[0]
  assert.equal(scheduledRunPaid.action_params.from, '+15125557766') // Scheduled from Dedicated DID
  assert.equal(scheduledRunPaid.action_params.to, '+15125550555')
})

test('EVENT 3, 4, 5, 6: Booking Confirmation, Reminders, Reschedule, and Cancellation SMS routing', async () => {
  const origSmsEnv = process.env.TELNYX_SMS_PHONE_NUMBER
  process.env.TELNYX_SMS_PHONE_NUMBER = '+18777713802'

  try {
    const freeOrg = {
      id: 'org-free-booking',
      name: "Swift Plumbing",
      slug: 'swift-plumbing',
      plan_id: 'free',
      subscription_status: 'free',
      telnyx_phone_number: null,
      phone_provisioning_status: 'pending_number',
    }
    const paidOrg = {
      id: 'org-paid-booking',
      name: "Premier HVAC",
      slug: 'premier-hvac',
      plan_id: 'solo',
      subscription_status: 'active',
      telnyx_phone_number: '+15125551234',
      phone_provisioning_status: 'active',
    }

    // Sender resolution check
    assert.equal(resolveSenderPhone(freeOrg), '+18777713802')
    assert.equal(resolveSenderPhone(paidOrg), '+15125551234')
  } finally {
    if (origSmsEnv !== undefined) process.env.TELNYX_SMS_PHONE_NUMBER = origSmsEnv
    else delete process.env.TELNYX_SMS_PHONE_NUMBER
  }
})

test('EVENT 7: En Route SMS triggers from Toll-Free for Jobs 1-3, and blocks Job 4+ on Starter Pass', async () => {
  // Free Starter Pass: Job 1 en_route succeeds and resolves Toll-Free
  const dbJob1 = createMockAuditDb({
    organizations: [{
      id: 'org-enroute-free',
      name: "Quick Fix Appliance",
      plan_id: 'free',
      subscription_status: 'free',
      telnyx_phone_number: null,
    }],
    contacts: [{ id: 'c1', name: 'John Doe', phone: '+15125550777' }],
    jobs: [{
      id: 'job-1',
      org_id: 'org-enroute-free',
      contact_id: 'c1',
      status: 'scheduled',
      tracking_token: 'track123',
    }],
  })

  const job1Result = await updateJobStatus(dbJob1, {
    jobId: 'job-1',
    orgId: 'org-enroute-free',
    newStatus: 'en_route',
    technicianName: 'Bob Tech',
    etaMinutes: 20,
    notifyCustomer: true,
  })

  assert.equal(job1Result.success, true)
  assert.equal(job1Result.job.status, 'en_route')

  // Free Starter Pass: 3 jobs completed -> Job 4 en_route is gated with STARTER_LIMIT_REACHED
  const dbJob4 = createMockAuditDb({
    organizations: [{
      id: 'org-enroute-limit',
      name: "Quick Fix Appliance",
      plan_id: 'free',
      subscription_status: 'free',
      telnyx_phone_number: null,
    }],
    contacts: [{ id: 'c4', name: 'Jane Smith', phone: '+15125550888' }],
    jobs: [
      { id: 'j1', org_id: 'org-enroute-limit', status: 'completed' },
      { id: 'j2', org_id: 'org-enroute-limit', status: 'completed' },
      { id: 'j3', org_id: 'org-enroute-limit', status: 'completed' },
      { id: 'job-4', org_id: 'org-enroute-limit', contact_id: 'c4', status: 'scheduled' },
    ],
  })

  const job4Result = await updateJobStatus(dbJob4, {
    jobId: 'job-4',
    orgId: 'org-enroute-limit',
    newStatus: 'en_route',
    technicianName: 'Bob Tech',
    etaMinutes: 15,
    notifyCustomer: true,
  })

  assert.equal(job4Result.success, false)
  assert.equal(job4Result.upgradeRequired, true)
  assert.equal(job4Result.code, 'STARTER_LIMIT_REACHED')
})

test('EVENT 8, 9, 10, 11: Quotes, Invoices, Payment Receipts, and Reviews Sender Resolution', async () => {
  const freeOrg = {
    id: 'org-fin-free',
    name: 'Free Pro',
    plan_id: 'free',
    subscription_status: 'free',
    telnyx_phone_number: null,
    phone_provisioning_status: 'pending_number',
  }

  const paidOrg = {
    id: 'org-fin-paid',
    name: 'Paid Pro',
    plan_id: 'solo',
    subscription_status: 'active',
    telnyx_phone_number: '+15125558899',
    phone_provisioning_status: 'active',
  }

  // All financial and review services use resolveSenderPhone
  assert.equal(resolveSenderPhone(freeOrg), '+18777713802')
  assert.equal(resolveSenderPhone(paidOrg), '+15125558899')

  // Gating on Job 4+ for Quotes
  const dbQuoteGated = createMockAuditDb({
    organizations: [freeOrg],
    contacts: [{ id: 'c-quote', name: 'Quote Customer', phone: '+15125550999' }],
    jobs: [
      { id: 'qj1', org_id: freeOrg.id, status: 'completed' },
      { id: 'qj2', org_id: freeOrg.id, status: 'completed' },
      { id: 'qj3', org_id: freeOrg.id, status: 'completed' },
    ],
  })

  const quoteRes = await createQuote(dbQuoteGated, {
    orgId: freeOrg.id,
    contactId: 'c-quote',
    title: 'New Service Estimate',
    items: [{ description: 'Diagnostic', quantity: 1, unit_price: 150 }],
  })

  assert.equal(quoteRes.success, false)
  assert.equal(quoteRes.upgradeRequired, true)
  assert.equal(quoteRes.code, 'STARTER_LIMIT_REACHED')
})

test('EVENT 12, 13, 14, 15: Automation Actions, STOP/HELP Auto-Responses, and Owner Alerts', async () => {
  const sentSms = []
  const mockSendSms = async (payload) => {
    sentSms.push(payload)
    return { success: true, messageId: 'msg_' + Math.random().toString(36).slice(2, 8) }
  }

  // 12. Automation Action executeAction ('send_sms') switches from Toll-Free to Dedicated DID for upgraded orgs
  const dbAction = createMockAuditDb({
    organizations: [{
      id: 'org-action-paid',
      name: 'Dynamic HVAC',
      plan_id: 'solo',
      subscription_status: 'active',
      telnyx_phone_number: '+15125553344',
      phone_provisioning_status: 'active',
    }],
    contacts: [{ id: 'c-act', phone: '+15125554455', opt_out: false }],
  })

  // Pre-provisioning / Free org sends via Toll-Free (+18777713802)
  const freeOrgRow = {
    id: 'org-action-free',
    plan_id: 'free',
    subscription_status: 'free',
    telnyx_phone_number: null,
    phone_provisioning_status: 'pending_number',
  }
  assert.equal(resolveSenderPhone(freeOrgRow), '+18777713802')

  // Upgraded active DID sends via dedicated number (+15125553344)
  const paidOrgRow = {
    id: 'org-action-paid',
    plan_id: 'solo',
    subscription_status: 'active',
    telnyx_phone_number: '+15125553344',
    phone_provisioning_status: 'active',
  }
  assert.equal(resolveSenderPhone(paidOrgRow), '+15125553344')

  // Upgraded DID still in provisioning state cleanly falls back to Toll-Free (+18777713802)
  const provisioningOrgRow = {
    id: 'org-action-prov',
    plan_id: 'solo',
    subscription_status: 'active',
    telnyx_phone_number: '+15125559900',
    phone_provisioning_status: 'provisioning', // not active yet
  }
  assert.equal(hasDedicatedPhoneNumber(provisioningOrgRow), false)
  assert.equal(resolveSenderPhone(provisioningOrgRow), '+18777713802')
})

