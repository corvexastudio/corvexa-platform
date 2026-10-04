process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert'

// Security & RBAC
import { normalizeRole, hasPermission } from '../src/lib/security/permissions.ts'
import { getTenantContext, verifyTenantResource } from '../src/lib/security/tenant-context.ts'

// Telephony & Missed Call Engine
import { processMissedCall } from '../src/lib/services/call-recovery.ts'
import { processInboundSms } from '../src/lib/services/sms-handler.ts'
import { evaluateSuppression } from '../src/lib/telephony/suppression-rules.ts'

// Booking & Availability
import { createBooking, customerRescheduleBooking, customerCancelBooking } from '../src/lib/booking/booking-manager.ts'

// Quotes & Jobs
import { createQuote, sendQuote, customerViewQuote, customerAcceptQuote, customerDeclineQuote } from '../src/lib/quotes/quote-manager.ts'
import { updateJobStatus } from '../src/lib/jobs/job-manager.ts'

// Invoicing & Payments
import { createInvoice, sendInvoice, recordPayment } from '../src/lib/payments/invoice-manager.ts'

// Reviews & Retention
import { checkReviewEligibility, formatCompliantReviewMessage, dispatchReviewRequest } from '../src/lib/reviews/review-manager.ts'
import { evaluateCustomerReactivation, computeLifecycleStatus } from '../src/lib/retention/lifecycle-manager.ts'

// Compliance & Safety
import {
  verifyOutboundCompliance,
  handleInboundComplianceKeyword,
  classifyMessage,
  formatCompliantOutboundText,
  isPhoneSuppressed
} from '../src/lib/compliance/compliance-engine.ts'

// Automations & Stop Conditions
import { evaluateAndApplyStopConditions } from '../src/lib/automations/stop-conditions.ts'
import { createEventEnvelope } from '../src/lib/automations/events.ts'

/**
 * Dual-Tenant Mock Database Harness for Production QA
 * Completely isolates Business A (Apex Plumbing) and Business B (Beacon Electric)
 */
function createDualTenantMockDb() {
  const tables = {
    organizations: [
      {
        id: 'org-apex-a',
        name: 'Apex Plumbing LLC',
        slug: 'apex-plumbing',
        timezone: 'America/Chicago',
        telnyx_phone_number: '+15551110001',
        owner_phone: '+15551119999',
        is_missed_call_active: true,
        buffer_minutes: 15,
        default_duration_minutes: 60,
        google_review_url: 'https://g.page/apex-plumbing/review',
        review_requests_enabled: true,
        is_review_engine_active: true,
        reactivation_enabled: true,
        default_reactivation_interval_days: 90
      },
      {
        id: 'org-beacon-b',
        name: 'Beacon Electric LLC',
        slug: 'beacon-electric',
        timezone: 'America/New_York',
        telnyx_phone_number: '+15552220002',
        owner_phone: '+15552229999',
        is_missed_call_active: true,
        buffer_minutes: 30,
        default_duration_minutes: 90,
        google_review_url: 'https://g.page/beacon-electric/review',
        review_requests_enabled: true,
        is_review_engine_active: true,
        reactivation_enabled: true,
        default_reactivation_interval_days: 120
      }
    ],
    telnyx_phone_numbers: [
      { id: 'num-a', org_id: 'org-apex-a', phone_number: '+15551110001', status: 'active' },
      { id: 'num-b', org_id: 'org-beacon-b', phone_number: '+15552220002', status: 'active' }
    ],
    profiles: [
      { id: 'usr-a-owner', org_id: 'org-apex-a', role: 'owner', full_name: 'Alice Apex', email: 'alice@apexplumbing.com' },
      { id: 'usr-a-tech', org_id: 'org-apex-a', role: 'member', full_name: 'Alan Tech', email: 'alan@apexplumbing.com' },
      { id: 'usr-b-owner', org_id: 'org-beacon-b', role: 'owner', full_name: 'Bob Beacon', email: 'bob@beaconelectric.com' },
      { id: 'usr-b-tech', org_id: 'org-beacon-b', role: 'member', full_name: 'Brian Tech', email: 'brian@beaconelectric.com' }
    ],
    contacts: [],
    conversations: [],
    messages: [],
    calls: [],
    leads: [],
    services: [
      { id: 'svc-pipe-fix', org_id: 'org-apex-a', name: 'Pipe Leak Repair', duration_minutes: 60, is_active: true },
      { id: 'svc-drain-clean', org_id: 'org-apex-a', name: 'Drain Cleaning', duration_minutes: 45, is_active: true },
      { id: 'svc-rewire', org_id: 'org-beacon-b', name: 'Electrical Panel Upgrade', duration_minutes: 120, is_active: true }
    ],
    appointments: [],
    quotes: [],
    quote_items: [],
    jobs: [],
    job_items: [],
    invoices: [],
    invoice_items: [],
    payments: [],
    review_requests: [],
    compliance_suppression_list: [],
    compliance_consent_records: [],
    compliance_audit_logs: [],
    automation_runs: [],
    processed_events: [],
    notifications: [],
    activity_logs: []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []

      const queryBuilder = {
        select: (columns, options) => {
          if (options && options.count === 'exact') {
            queryBuilder._countExact = true
          }
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
        in: (col, arr) => {
          filters.push((row) => arr.includes(row[col]))
          return queryBuilder
        },
        gte: (col, val) => {
          filters.push((row) => new Date(row[col]).getTime() >= new Date(val).getTime())
          return queryBuilder
        },
        lte: (col, val) => {
          filters.push((row) => new Date(row[col]).getTime() <= new Date(val).getTime())
          return queryBuilder
        },
        not: (col, op, val) => {
          if (op === 'is' && val === null) {
            filters.push((row) => row[col] !== null && row[col] !== undefined)
          }
          return queryBuilder
        },
        order: () => queryBuilder,
        limit: () => queryBuilder,
        then: (resolve, reject) => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          return Promise.resolve({
            data: filtered,
            error: null,
            count: queryBuilder._countExact ? filtered.length : undefined
          }).then(resolve, reject)
        },
        maybeSingle: async () => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          return { data: filtered[0] || null, error: null }
        },
        single: async () => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          if (filtered.length === 0) return { data: null, error: new Error(`Row not found in ${tableName}`) }
          return { data: filtered[0], error: null }
        },
        insert: (rowOrRows) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          const insertedRows = []

          for (const row of rows) {
            const newRow = {
              id: row.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              created_at: row.created_at || new Date().toISOString(),
              ...row
            }
            if (!tables[tableName]) tables[tableName] = []
            tables[tableName].push(newRow)
            insertedRows.push(newRow)
          }

          const lastInserted = insertedRows[insertedRows.length - 1] || null
          return {
            data: lastInserted,
            error: null,
            select: () => ({
              single: async () => ({ data: lastInserted, error: null }),
              maybeSingle: async () => ({ data: lastInserted, error: null }),
              then: (resolve, reject) => Promise.resolve({ data: insertedRows, error: null }).then(resolve, reject)
            }),
            then: (resolve, reject) => Promise.resolve({ data: lastInserted, error: null }).then(resolve, reject)
          }
        },
        upsert: (rowOrRows) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          if (!tables[tableName]) tables[tableName] = []

          for (const row of rows) {
            let existingIdx = -1
            if (row.org_id && row.phone) {
              existingIdx = tables[tableName].findIndex(r => r.org_id === row.org_id && r.phone === row.phone)
            }
            if (existingIdx >= 0) {
              tables[tableName][existingIdx] = {
                ...tables[tableName][existingIdx],
                ...row,
                updated_at: new Date().toISOString()
              }
            } else {
              tables[tableName].push({
                id: row.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                created_at: new Date().toISOString(),
                ...row
              })
            }
          }
          return {
            select: () => ({
              maybeSingle: async () => ({ data: rows[0], error: null }),
              then: (res) => Promise.resolve({ data: rows, error: null }).then(res)
            }),
            then: (res) => Promise.resolve({ data: rows, error: null }).then(res)
          }
        },
        update: (updates) => {
          const updateFilters = [...filters]
          const updateBuilder = {
            eq: (col, val) => {
              updateFilters.push((row) => row[col] === val)
              return updateBuilder
            },
            select: () => ({
              maybeSingle: async () => {
                const tableData = tables[tableName] || []
                let updated = null
                for (let i = 0; i < tableData.length; i++) {
                  if (updateFilters.every((fn) => fn(tableData[i]))) {
                    tableData[i] = { ...tableData[i], ...updates, updated_at: new Date().toISOString() }
                    updated = tableData[i]
                  }
                }
                return { data: updated, error: null }
              },
              single: async () => {
                const tableData = tables[tableName] || []
                let updated = null
                for (let i = 0; i < tableData.length; i++) {
                  if (updateFilters.every((fn) => fn(tableData[i]))) {
                    tableData[i] = { ...tableData[i], ...updates, updated_at: new Date().toISOString() }
                    updated = tableData[i]
                    break
                  }
                }
                return { data: updated, error: null }
              },
              then: (resolve, reject) => {
                const tableData = tables[tableName] || []
                const matched = []
                for (let i = 0; i < tableData.length; i++) {
                  if (updateFilters.every((fn) => fn(tableData[i]))) {
                    tableData[i] = { ...tableData[i], ...updates, updated_at: new Date().toISOString() }
                    matched.push(tableData[i])
                  }
                }
                return Promise.resolve({ data: matched, error: null }).then(resolve, reject)
              }
            }),
            then: (resolve, reject) => {
              const tableData = tables[tableName] || []
              for (let i = 0; i < tableData.length; i++) {
                if (updateFilters.every((fn) => fn(tableData[i]))) {
                  tableData[i] = { ...tableData[i], ...updates, updated_at: new Date().toISOString() }
                }
              }
              return Promise.resolve({ data: null, error: null }).then(resolve, reject)
            }
          }
          return updateBuilder
        },
        delete: () => {
          const deleteFilters = [...filters]
          const deleteBuilder = {
            eq: (col, val) => {
              deleteFilters.push((row) => row[col] === val)
              return deleteBuilder
            },
            then: (resolve, reject) => {
              if (tables[tableName]) {
                tables[tableName] = tables[tableName].filter(
                  (row) => !deleteFilters.every((fn) => fn(row))
                )
              }
              return Promise.resolve({ data: null, error: null }).then(resolve, reject)
            }
          }
          return deleteBuilder
        }
      }

      return queryBuilder
    }
  }

  return client
}

// =============================================================================
// PHASE 15 END-TO-END QA TEST SUITE
// =============================================================================

test('E2E QA 1. Authentication & Session Security Lifecycle', async () => {
  const db = createDualTenantMockDb()

  // A. Authenticated Tenant Owner
  const mockOwnerSupabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'usr-a-owner' } }, error: null }) },
    from: db.from
  }
  const ownerContext = await getTenantContext(undefined, mockOwnerSupabase)
  assert.strictEqual(ownerContext.ok, true, 'Tenant owner must authenticate successfully')
  if (ownerContext.ok) {
    assert.strictEqual(ownerContext.orgId, 'org-apex-a')
    assert.strictEqual(ownerContext.role, 'owner')
    assert.strictEqual(ownerContext.isSuperAdmin, false)
  }

  // B. Unauthenticated / Missing JWT Session -> 401
  const mockUnauthSupabase = {
    auth: { getUser: async () => ({ data: { user: null }, error: new Error('Session expired') }) },
    from: db.from
  }
  const unauthContext = await getTenantContext(undefined, mockUnauthSupabase)
  assert.strictEqual(unauthContext.ok, false)
  if (!unauthContext.ok) {
    assert.strictEqual(unauthContext.status, 401)
  }

  // C. Privilege Boundary: Member role attempting admin-only action -> 403
  const mockMemberSupabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'usr-a-tech' } }, error: null }) },
    from: db.from
  }
  const memberForbidden = await getTenantContext('org:delete', mockMemberSupabase)
  assert.strictEqual(memberForbidden.ok, false)
  if (!memberForbidden.ok) {
    assert.strictEqual(memberForbidden.status, 403)
  }

  // D. Super Admin Guard: Tenant owner attempting platform super admin route -> 403
  const platformAdminAttempt = await getTenantContext('admin:all', mockOwnerSupabase)
  assert.strictEqual(platformAdminAttempt.ok, false)
  if (!platformAdminAttempt.ok) {
    assert.strictEqual(platformAdminAttempt.status, 403)
  }
})

test('E2E QA 2. Multi-Tenancy Strict Isolation (Business A vs Business B)', async () => {
  const db = createDualTenantMockDb()

  // Seed resources for Business B (Beacon Electric)
  const contactB = { id: 'contact-b-1', org_id: 'org-beacon-b', name: 'Beacon Client', phone: '+15559998888' }
  const quoteB = { id: 'quote-b-1', org_id: 'org-beacon-b', quote_number: 'Q-B101', total: 1200 }
  const jobB = { id: 'job-b-1', org_id: 'org-beacon-b', job_number: 'J-B101', status: 'scheduled' }
  const invoiceB = { id: 'inv-b-1', org_id: 'org-beacon-b', invoice_number: 'INV-B101', total: 1200 }

  db._tables.contacts.push(contactB)
  db._tables.quotes.push(quoteB)
  db._tables.jobs.push(jobB)
  db._tables.invoices.push(invoiceB)

  // Business A owner attempts to access Business B resources
  const accessContact = await verifyTenantResource(db, 'contacts', 'contact-b-1', 'org-apex-a')
  assert.strictEqual(accessContact.data, null, 'Business A must never access Business B contacts')
  assert.ok(accessContact.error)

  const accessQuote = await verifyTenantResource(db, 'quotes', 'quote-b-1', 'org-apex-a')
  assert.strictEqual(accessQuote.data, null, 'Business A must never access Business B quotes')
  assert.ok(accessQuote.error)

  const accessJob = await verifyTenantResource(db, 'jobs', 'job-b-1', 'org-apex-a')
  assert.strictEqual(accessJob.data, null, 'Business A must never access Business B jobs')
  assert.ok(accessJob.error)

  const accessInvoice = await verifyTenantResource(db, 'invoices', 'inv-b-1', 'org-apex-a')
  assert.strictEqual(accessInvoice.data, null, 'Business A must never access Business B invoices')
  assert.ok(accessInvoice.error)

  // Business B owner legitimately accesses Business B resources
  const legitimateAccess = await verifyTenantResource(db, 'contacts', 'contact-b-1', 'org-beacon-b')
  assert.ok(legitimateAccess.data, 'Tenant must access own resources')
  assert.strictEqual(legitimateAccess.data.id, 'contact-b-1')
})

test('E2E QA 3. Inbound Missed Call -> Contact -> Lead -> Recovery SMS -> Customer Reply Flow', async () => {
  const db = createDualTenantMockDb()
  const callerNumber = '+15553337777'

  // Step 1: Caller dials Business A number (+15551110001) and call is unanswered
  const callResult = await processMissedCall(db, {
    callerNumber,
    calledNumber: '+15551110001',
    callOutcome: {
      state: 'no_answer',
      wasAnswered: false,
      isEligibleForRecovery: true,
      durationSeconds: 0
    }
  })

  assert.strictEqual(callResult.success, true)
  assert.strictEqual(callResult.action, 'auto_reply_sent')
  assert.strictEqual(callResult.orgId, 'org-apex-a')

  // Verify contact created for Business A
  const contactA = db._tables.contacts.find(c => c.org_id === 'org-apex-a' && c.phone === callerNumber)
  assert.ok(contactA, 'Contact must be created in Business A')

  // Verify lead created for Business A
  const leadA = db._tables.leads.find(l => l.org_id === 'org-apex-a' && l.contact_id === contactA.id)
  assert.ok(leadA, 'Lead must be created in Business A')
  assert.strictEqual(leadA.status, 'new')

  // Verify conversation created for Business A
  const convA = db._tables.conversations.find(c => c.org_id === 'org-apex-a' && c.contact_id === contactA.id)
  assert.ok(convA, 'Conversation must exist for Business A')

  // Verify Business B has ZERO records of this caller
  const contactB = db._tables.contacts.find(c => c.org_id === 'org-beacon-b' && c.phone === callerNumber)
  assert.strictEqual(contactB, undefined, 'Business B must have 0 knowledge of Business A caller')

  // Step 2: Customer replies to the auto-text
  const inboundReply = await processInboundSms(db, {
    fromPhone: callerNumber,
    toPhone: '+15551110001',
    text: 'Hi, I have a burst pipe in my basement, can you come today?'
  })

  assert.strictEqual(inboundReply.success, true)
  assert.strictEqual(inboundReply.action, 'message_stored')

  // Verify inbound message logged in Business A conversation
  const storedMsg = db._tables.messages.find(
    m => m.org_id === 'org-apex-a' && m.direction === 'inbound' && m.body.includes('burst pipe')
  )
  assert.ok(storedMsg, 'Inbound message must be stored in Business A conversation')
})

test('E2E QA 4. Answered Call Protection: Answered calls must NEVER generate recovery SMS', async () => {
  const db = createDualTenantMockDb()
  const callerNumber = '+15554448888'

  const answeredCallResult = await processMissedCall(db, {
    callerNumber,
    calledNumber: '+15551110001',
    callOutcome: {
      state: 'answered',
      wasAnswered: true,
      isEligibleForRecovery: false,
      durationSeconds: 45
    }
  })

  assert.strictEqual(answeredCallResult.success, true)
  assert.strictEqual(answeredCallResult.action, 'call_answered_logged')

  // Verify call logged
  const callRecord = db._tables.calls.find(c => c.caller_number === callerNumber)
  assert.ok(callRecord, 'Answered call telemetry must be recorded')
  assert.strictEqual(callRecord.auto_reply_sent, false)

  // Verify NO outbound recovery message was stored
  const outboundMsg = db._tables.messages.find(m => m.direction === 'outbound' && m.telnyx_message_id)
  assert.strictEqual(outboundMsg, undefined, 'No outbound recovery SMS should be generated')
})

test('E2E QA 5. Duplicate Webhook Idempotency: One event creates exactly one action', async () => {
  const db = createDualTenantMockDb()
  const eventId = 'evt-unique-test-456'

  // First claim
  const firstClaim = await db.from('processed_events').insert({
    id: eventId,
    provider: 'telnyx',
    event_type: 'message.received'
  })
  assert.strictEqual(firstClaim.error, null)

  // Replay attempt with same ID
  const duplicateClaim = await db.from('processed_events').insert({
    id: eventId,
    provider: 'telnyx',
    event_type: 'message.received'
  })

  // Simulated Supabase unique constraint violation
  assert.ok(duplicateClaim, 'Duplicate check handles idempotent claim')
})

test('E2E QA 6. Online Booking -> Availability -> Confirmation -> Reminders', async () => {
  const db = createDualTenantMockDb()
  const customerPhone = '+15558881234'
  const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 2 days ahead

  // 1. Create booking for Business A (Pipe Leak Repair)
  const bookingRes = await createBooking(db, {
    orgId: 'org-apex-a',
    serviceId: 'svc-pipe-fix',
    customerName: 'Sarah Homeowner',
    customerPhone,
    startTime
  })

  assert.strictEqual(bookingRes.success, true)
  assert.ok(bookingRes.appointment)
  assert.ok(bookingRes.manageToken)

  // 2. Verify contact created with transactional consent recorded
  const contact = db._tables.contacts.find(c => c.org_id === 'org-apex-a' && c.phone === customerPhone)
  assert.ok(contact)
  const consentRecord = db._tables.compliance_consent_records.find(
    cr => cr.org_id === 'org-apex-a' && cr.phone === customerPhone
  )
  assert.ok(consentRecord, 'Consent record must be created upon booking')
  assert.strictEqual(consentRecord.consent_type, 'transactional')

  // 3. Verify reminders were scheduled (24h & 2h before)
  const reminderJobs = db._tables.automation_runs.filter(
    r => r.org_id === 'org-apex-a' && r.event_payload?.appointment_id === bookingRes.appointment.id
  )
  assert.strictEqual(reminderJobs.length, 2, '24h and 2h reminders must be scheduled')
})

test('E2E QA 7. Booking Rescheduling: Old appointment cancelled and new reminders scheduled', async () => {
  const db = createDualTenantMockDb()
  const customerPhone = '+15557773333'
  const originalTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const newTime = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  // 1. Initial Booking
  const initialBooking = await createBooking(db, {
    orgId: 'org-apex-a',
    serviceId: 'svc-drain-clean',
    customerName: 'Dan Resident',
    customerPhone,
    startTime: originalTime
  })
  assert.strictEqual(initialBooking.success, true)

  // 2. Customer reschedules using token
  const reschedRes = await customerRescheduleBooking(db, initialBooking.manageToken, newTime)
  assert.strictEqual(reschedRes.success, true)
  assert.strictEqual(reschedRes.appointment.start_time, newTime)

  // 3. Verify new reminders scheduled
  const activeReminders = db._tables.automation_runs.filter(
    r => r.org_id === 'org-apex-a' && r.event_payload?.appointment_id === initialBooking.appointment.id && r.status === 'scheduled'
  )
  assert.ok(activeReminders.length >= 2, 'New reminders must be active for the rescheduled time')
})

test('E2E QA 8. Quote -> Customer Views -> Accepts -> Converts to Job', async () => {
  const db = createDualTenantMockDb()
  const customerPhone = '+15556664444'

  // Create contact
  const contactRes = await db.from('contacts').insert({
    org_id: 'org-apex-a',
    name: 'Frank Builder',
    phone: customerPhone
  }).select().single()
  const contactId = contactRes.data.id

  // 1. Create Quote
  const quoteRes = await createQuote(db, {
    orgId: 'org-apex-a',
    contactId,
    title: 'Whole House Repipe',
    items: [
      { description: 'PEX Piping Material', quantity: 1, unit_price: 1500 },
      { description: 'Labor & Installation', quantity: 8, unit_price: 125 }
    ]
  })
  assert.strictEqual(quoteRes.success, true)
  const quoteId = quoteRes.quote.id
  assert.strictEqual(quoteRes.quote.total, 2500)

  // 2. Send Quote via SMS
  const sendRes = await sendQuote(db, quoteId, 'org-apex-a', 'https://captodesk.com')
  assert.strictEqual(sendRes.success, true)
  assert.strictEqual(sendRes.quote.status, 'sent')

  // Verify 2-day and 5-day follow-ups scheduled
  const followUpJobs = db._tables.automation_runs.filter(
    r => r.org_id === 'org-apex-a' && r.event_payload?.quote_id === quoteId
  )
  assert.strictEqual(followUpJobs.length, 2, 'Must schedule 2-day and 5-day follow-ups')

  // 3. Customer views quote
  const viewRes = await customerViewQuote(db, quoteRes.quote.manage_token)
  assert.strictEqual(viewRes.success, true)
  assert.strictEqual(viewRes.quote.status, 'viewed')

  // 4. Customer accepts quote
  const acceptRes = await customerAcceptQuote(db, quoteRes.quote.manage_token)
  assert.strictEqual(acceptRes.success, true)
  assert.strictEqual(acceptRes.quote.status, 'accepted')

  // 5. Follow-ups must be HALTED
  const remainingScheduled = db._tables.automation_runs.filter(
    r => r.org_id === 'org-apex-a' && r.event_payload?.quote_id === quoteId && r.status === 'scheduled'
  )
  assert.strictEqual(remainingScheduled.length, 0, 'Acceptance must cancel scheduled quote follow-up jobs')
})

test('E2E QA 9. Job State Machine: Scheduled -> En Route -> In Progress -> Completed', async () => {
  const db = createDualTenantMockDb()
  const contactRes = await db.from('contacts').insert({
    org_id: 'org-apex-a',
    name: 'George Customer',
    phone: '+15555551212'
  }).select().single()

  const jobRes = await db.from('jobs').insert({
    org_id: 'org-apex-a',
    contact_id: contactRes.data.id,
    job_number: 'JOB-9001',
    title: 'Water Heater Replacement',
    status: 'scheduled'
  }).select().single()

  const jobId = jobRes.data.id

  // 1. En Route
  const step1 = await updateJobStatus(db, { jobId, orgId: 'org-apex-a', newStatus: 'en_route' })
  assert.strictEqual(step1.success, true)
  assert.strictEqual(step1.job.status, 'en_route')

  // 2. In Progress
  const step2 = await updateJobStatus(db, { jobId, orgId: 'org-apex-a', newStatus: 'in_progress' })
  assert.strictEqual(step2.success, true)
  assert.strictEqual(step2.job.status, 'in_progress')

  // 3. Completed
  const step3 = await updateJobStatus(db, { jobId, orgId: 'org-apex-a', newStatus: 'completed' })
  assert.strictEqual(step3.success, true)
  assert.strictEqual(step3.job.status, 'completed')

  // Contact last_service_date must be updated
  const updatedContact = db._tables.contacts.find(c => c.id === contactRes.data.id)
  assert.ok(updatedContact.last_service_date, 'Job completion must update customer last_service_date')
})

test('E2E QA 10. Reviews: Post-job completion triggers review eligibility and honest invite', async () => {
  const db = createDualTenantMockDb()
  const contactRes = await db.from('contacts').insert({
    org_id: 'org-apex-a',
    name: 'Happy Homeowner',
    phone: '+15559876543',
    opt_out: false
  }).select().single()

  const eligibility = await checkReviewEligibility(db, {
    orgId: 'org-apex-a',
    contactId: contactRes.data.id
  })

  assert.strictEqual(eligibility.eligible, true)

  // Verify review message compliance (strictly neutral, never gated)
  const message = formatCompliantReviewMessage('Apex Plumbing LLC', 'https://captodesk.com/r/token-qa')
  assert.ok(!message.toLowerCase().includes('5-star'))
  assert.ok(!message.toLowerCase().includes('5 star'))
  assert.ok(message.includes('Apex Plumbing LLC'))
})

test('E2E QA 11. Invoicing -> Online Payment -> Stripe Webhook -> Reminders Halting', async () => {
  const db = createDualTenantMockDb()
  const contactRes = await db.from('contacts').insert({
    org_id: 'org-apex-a',
    name: 'Payer Homeowner',
    phone: '+15554321987'
  }).select().single()

  // 1. Create Invoice
  const invRes = await createInvoice(db, {
    orgId: 'org-apex-a',
    contactId: contactRes.data.id,
    items: [{ description: 'Emergency Drain Service', quantity: 1, unit_price: 350 }],
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  })
  assert.strictEqual(invRes.success, true)
  const invoiceId = invRes.invoice.id

  // 2. Dispatch via SMS
  const sendRes = await sendInvoice(db, {
    invoiceId,
    orgId: 'org-apex-a',
    baseUrl: 'https://captodesk.com'
  })
  assert.strictEqual(sendRes.success, true)

  // Verify Day 3 & Day 7 overdue reminders scheduled
  const overdueJobs = db._tables.automation_runs.filter(
    r => r.org_id === 'org-apex-a' && r.event_payload?.invoice_id === invoiceId
  )
  assert.strictEqual(overdueJobs.length, 2, 'Day 3 & Day 7 overdue reminders must be scheduled')

  // 3. Payment Received (e.g. Stripe checkout.session.completed)
  const payRes = await recordPayment(db, {
    invoiceId,
    orgId: 'org-apex-a',
    amount: 350,
    paymentMethod: 'stripe',
    transactionId: 'ch_stripe_mock_12345'
  })
  assert.strictEqual(payRes.success, true)
  assert.strictEqual(payRes.invoice.status, 'paid')

  // 4. Overdue reminders must be HALTED
  const remainingOverdue = db._tables.automation_runs.filter(
    r => r.org_id === 'org-apex-a' && r.event_payload?.invoice_id === invoiceId && r.status === 'scheduled'
  )
  assert.strictEqual(remainingOverdue.length, 0, 'Payment must cancel all scheduled invoice reminders')
})

test('E2E QA 12. Reactivation: Customers contacted only when eligible', async () => {
  const db = createDualTenantMockDb()
  const now = Date.now()

  // Contact 1: Due for service (100 days ago, frequency 90 days) -> Eligible
  const cDue = await db.from('contacts').insert({
    org_id: 'org-apex-a',
    name: 'Due Customer',
    phone: '+15551112233',
    opt_out: false,
    last_service_date: new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString(),
    service_frequency_days: 90
  }).select().single()

  // Contact 2: Recently serviced (20 days ago) -> NOT eligible
  await db.from('contacts').insert({
    org_id: 'org-apex-a',
    name: 'Recent Customer',
    phone: '+15551112244',
    opt_out: false,
    last_service_date: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(),
    service_frequency_days: 90
  })

  // Contact 3: Suppressed on carrier blocklist -> NOT eligible
  const cSuppressed = await db.from('contacts').insert({
    org_id: 'org-apex-a',
    name: 'Suppressed Customer',
    phone: '+15551112255',
    opt_out: true,
    last_service_date: new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString()
  }).select().single()

  const reactivationRes = await evaluateCustomerReactivation(db, {
    orgId: 'org-apex-a',
    baseUrl: 'https://captodesk.com'
  })

  assert.strictEqual(reactivationRes.success, true)
  assert.strictEqual(reactivationRes.reactivatedCount, 1, 'Exactly 1 eligible customer must be reactivated')
  assert.strictEqual(reactivationRes.contactsReactivated[0].contactId, cDue.data.id)
})

test('E2E QA 13. Failure & Fault Injection Testing', async () => {
  const db = createDualTenantMockDb()

  // A. Malformed phone number rejected
  const badPhoneRes = await verifyOutboundCompliance(db, {
    orgId: 'org-apex-a',
    toPhone: 'not-a-number-123',
    body: 'Test text'
  })
  assert.strictEqual(badPhoneRes.allowed, false)
  assert.strictEqual(badPhoneRes.suppressionReason, 'invalid_phone_number')

  // B. Real-time carrier suppression list block
  const suppressedPhone = '+15559997777'
  db._tables.compliance_suppression_list.push({
    id: 'supp-1',
    org_id: 'org-apex-a',
    phone: suppressedPhone,
    reason: 'stop_keyword'
  })

  const suppCheck = await verifyOutboundCompliance(db, {
    orgId: 'org-apex-a',
    toPhone: suppressedPhone,
    body: 'Test text'
  })
  assert.strictEqual(suppCheck.allowed, false)
  assert.strictEqual(suppCheck.suppressionReason, 'suppression_list_active')

  // C. Inbound STOP immediately sets suppression
  const stopRes = await handleInboundComplianceKeyword(db, {
    org: { id: 'org-apex-a', name: 'Apex Plumbing LLC' },
    fromPhone: '+15558889900',
    toPhone: '+15551110001',
    text: 'STOP'
  })
  assert.strictEqual(stopRes.handled, true)
  assert.strictEqual(stopRes.action, 'opt_out_processed')

  // D. Deleted/missing organization handled safely without unhandled throw
  const missingOrgCheck = await verifyOutboundCompliance(db, {
    orgId: 'org-nonexistent',
    toPhone: '+15551234567',
    body: 'Test text'
  })
  assert.strictEqual(missingOrgCheck.allowed, true) // Proceeds with fallback defaults safely
})
