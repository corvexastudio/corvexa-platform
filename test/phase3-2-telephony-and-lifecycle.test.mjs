/**
 * CAPTODESK — PHASE 3.2: TELEPHONY ECONOMICS, BRAND DOMAIN HYGIENE & QUIET-HOURS LEAD RECOVERY TEST SUITE
 * 
 * Verifies:
 * - TEL-001: GSM-7 SMS template economics, zero em-dashes, normalizeToGsm7 helper
 * - FIELD-001: Elimination of hardcoded external agency domain fallbacks (captodesk.com default)
 * - FIELD-002: Compact /t/[token] tracking URLs in en-route and crew notifications
 * - CALL-001: TCPA quiet-hours lead preservation, morning recovery scheduling in automation_runs, and idempotency
 * - LIFECYCLE-001: Booking confirmation SMS synced to customer Inbox conversations thread
 */

process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert'
import {
  DEFAULT_OPEN_TEMPLATE,
  DEFAULT_AFTER_HOURS_TEMPLATE,
  DEFAULT_BUSY_TEMPLATE,
  isGsm7,
  normalizeToGsm7,
  renderTemplate,
  resolveMissedCallTemplate
} from '../src/lib/telephony/template-engine.ts'
import {
  processMissedCall,
  calculateNextMorning805,
  recordOrUpdateLeadForMissedCall
} from '../src/lib/services/call-recovery.ts'
import { evaluateSuppression } from '../src/lib/telephony/suppression-rules.ts'
import { updateJobStatus } from '../src/lib/jobs/job-manager.ts'
import { reassignJobCrew } from '../src/lib/crews/crew-manager.ts'
import { createBooking } from '../src/lib/booking/booking-manager.ts'

// In-Memory Supabase Mock Harness
function createMockDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers || [],
    contacts: initialState.contacts || [],
    conversations: initialState.conversations || [],
    messages: initialState.messages || [],
    calls: initialState.calls || [],
    leads: initialState.leads || [],
    automation_runs: initialState.automation_runs || [],
    jobs: initialState.jobs || [],
    crews: initialState.crews || [],
    crew_members: initialState.crew_members || [],
    appointments: initialState.appointments || [],
    services: initialState.services || [],
    compliance_audit_logs: initialState.compliance_audit_logs || [],
    compliance_suppression_list: initialState.compliance_suppression_list || [],
    notifications: initialState.notifications || [],
    activity_logs: initialState.activity_logs || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let data = [...(tables[tableName] || [])]
      let filters = []

      const queryBuilder = {
        select: (cols) => queryBuilder,
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return queryBuilder
        },
        in: (col, vals) => {
          filters.push((row) => vals.includes(row[col]))
          return queryBuilder
        },
        gte: (col, val) => {
          filters.push((row) => new Date(row[col]) >= new Date(val))
          return queryBuilder
        },
        lte: (col, val) => {
          filters.push((row) => new Date(row[col]) <= new Date(val))
          return queryBuilder
        },
        is: (col, val) => {
          filters.push((row) => (val === null ? row[col] === null || row[col] === undefined : row[col] === val))
          return queryBuilder
        },
        neq: (col, val) => {
          filters.push((row) => row[col] !== val)
          return queryBuilder
        },
        limit: (n) => queryBuilder,
        order: () => queryBuilder,
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
          const insertedRows = []

          for (const row of rows) {
            const newRow = {
              id: row.id || `mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              created_at: new Date().toISOString(),
              ...row
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
        update: (updates) => {
          const updateFilters = []
          const updateBuilder = {
            eq: (col, val) => {
              updateFilters.push((row) => row[col] === val)
              return updateBuilder
            },
            select: () => ({
              maybeSingle: async () => {
                const item = tables[tableName].find((row) => updateFilters.every((fn) => fn(row)))
                if (item) Object.assign(item, updates)
                return { data: item || null, error: null }
              },
              single: async () => {
                const item = tables[tableName].find((row) => updateFilters.every((fn) => fn(row)))
                if (!item) return { data: null, error: new Error('Row not found') }
                Object.assign(item, updates)
                return { data: item, error: null }
              }
            }),
            then: (resolve, reject) => {
              let lastUpdated = null
              for (const row of tables[tableName]) {
                if (updateFilters.every((fn) => fn(row))) {
                  Object.assign(row, updates)
                  lastUpdated = row
                }
              }
              return Promise.resolve({ data: lastUpdated, error: null }).then(resolve, reject)
            }
          }
          return updateBuilder
        }
      }
      return queryBuilder
    }
  }

  return client
}

// ============================================================================
// 1. GSM-7 TEMPLATE ECONOMICS & ENCODING TESTS (TEL-001)
// ============================================================================

test('TEL-001: Default missed call templates contain zero em-dashes and are GSM-7 compliant', () => {
  // Check em-dash (U+2014) and en-dash (U+2013) absence
  assert.strictEqual(DEFAULT_OPEN_TEMPLATE.includes('—'), false, 'DEFAULT_OPEN_TEMPLATE must not contain em-dash')
  assert.strictEqual(DEFAULT_OPEN_TEMPLATE.includes('–'), false, 'DEFAULT_OPEN_TEMPLATE must not contain en-dash')
  assert.strictEqual(DEFAULT_AFTER_HOURS_TEMPLATE.includes('—'), false, 'DEFAULT_AFTER_HOURS_TEMPLATE must not contain em-dash')
  assert.strictEqual(DEFAULT_AFTER_HOURS_TEMPLATE.includes('–'), false, 'DEFAULT_AFTER_HOURS_TEMPLATE must not contain en-dash')
  assert.strictEqual(DEFAULT_BUSY_TEMPLATE.includes('—'), false, 'DEFAULT_BUSY_TEMPLATE must not contain em-dash')
  assert.strictEqual(DEFAULT_BUSY_TEMPLATE.includes('–'), false, 'DEFAULT_BUSY_TEMPLATE must not contain en-dash')

  // Enforce GSM-7 character set validity
  assert.strictEqual(isGsm7(DEFAULT_OPEN_TEMPLATE), true, 'DEFAULT_OPEN_TEMPLATE must be GSM-7 compliant')
  assert.strictEqual(isGsm7(DEFAULT_AFTER_HOURS_TEMPLATE), true, 'DEFAULT_AFTER_HOURS_TEMPLATE must be GSM-7 compliant')
  assert.strictEqual(isGsm7(DEFAULT_BUSY_TEMPLATE), true, 'DEFAULT_BUSY_TEMPLATE must be GSM-7 compliant')
})

test('TEL-001: normalizeToGsm7 safely transforms typographic quotes, dashes, ellipses and non-breaking spaces', () => {
  const dirtyText = '“Hello!” — here’s an appointment… with ‘smart quotes’ and\u00A0non-breaking\u00A0space.'
  const cleaned = normalizeToGsm7(dirtyText)

  assert.strictEqual(isGsm7(cleaned), true, 'Normalized output must strictly satisfy GSM-7')
  assert.strictEqual(cleaned.includes('—'), false, 'Em-dash must be replaced')
  assert.strictEqual(cleaned.includes('“'), false, 'Left double quote must be replaced')
  assert.strictEqual(cleaned.includes('”'), false, 'Right double quote must be replaced')
  assert.strictEqual(cleaned.includes('‘'), false, 'Left single quote must be replaced')
  assert.strictEqual(cleaned.includes('’'), false, 'Right single quote must be replaced')
  assert.strictEqual(cleaned.includes('…'), false, 'Ellipsis must be replaced')
  assert.strictEqual(cleaned.includes('\u00A0'), false, 'NBSP must be replaced')
  assert.strictEqual(cleaned, '"Hello!" - here\'s an appointment... with \'smart quotes\' and non-breaking space.')
})

test('TEL-001: renderTemplate normalizes output to GSM-7 without breaking URLs or placeholders', () => {
  const customTemplate = "Thanks for calling {business_name}! We’re assisting a client — visit: {booking_url}…"
  const rendered = renderTemplate(customTemplate, {
    business_name: 'Apex Heating & Air',
    booking_url: 'https://captodesk.com/book/apex-hvac'
  })

  assert.strictEqual(isGsm7(rendered), true, 'Rendered custom template must be GSM-7')
  assert.strictEqual(rendered.includes('Apex Heating & Air'), true)
  assert.strictEqual(rendered.includes('https://captodesk.com/book/apex-hvac'), true)
  assert.strictEqual(rendered.includes("We're"), true, "Apostrophe must be ASCII normalized")
  assert.strictEqual(rendered.includes(' - visit:'), true, 'Em-dash must be ASCII hyphen normalized')
})

// ============================================================================
// 2. BRAND DOMAIN HYGIENE & COMPACT TRACKING URLS (FIELD-001, FIELD-002)
// ============================================================================

test('FIELD-001: Template resolution defaults to captodesk.com when NEXT_PUBLIC_APP_URL is unset', () => {
  const origPublic = process.env.NEXT_PUBLIC_APP_URL
  const origApp = process.env.APP_URL
  delete process.env.NEXT_PUBLIC_APP_URL
  delete process.env.APP_URL

  try {
    const org = { name: 'Acme Electric', slug: 'acme-electric' }
    const outcome = { state: 'no_answer', wasAnswered: false, isEligibleForRecovery: true, durationSeconds: 0 }
    const result = resolveMissedCallTemplate(org, outcome)

    assert.strictEqual(result.renderedText.includes('app.corvexastudio.com'), false, 'Must never leak corvexastudio domain')
    assert.strictEqual(result.renderedText.includes('https://captodesk.com/book/acme-electric'), true, 'Must use captodesk.com fallback')
  } finally {
    if (origPublic) process.env.NEXT_PUBLIC_APP_URL = origPublic
    if (origApp) process.env.APP_URL = origApp
  }
})

test('FIELD-002: updateJobStatus (en-route) sends compact /t/[token] tracking URL with captodesk domain', async () => {
  const origPublic = process.env.NEXT_PUBLIC_APP_URL
  const origApp = process.env.APP_URL
  const origTelnyxKey = process.env.TELNYX_API_KEY
  delete process.env.NEXT_PUBLIC_APP_URL
  delete process.env.APP_URL
  process.env.TELNYX_API_KEY = 'mock_telnyx_key_for_test'

  try {
    let sentSmsText = null
    const db = createMockDb({
      organizations: [{ id: 'org-test', name: 'Elite Plumbing', telnyx_phone_number: '+15551234000' }],
      contacts: [{ id: 'contact-test', name: 'Alice Smith', phone: '+15559876543' }],
      jobs: [{
        id: 'job-1',
        org_id: 'org-test',
        contact_id: 'contact-test',
        status: 'scheduled',
        tracking_token: 'tok_abc123xyz',
        technician_name: 'John Tech'
      }]
    })

    // Mock sendTelnyxSms via global or function call in job-manager
    const originalFetch = global.fetch
    global.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('telnyx')) {
        const body = JSON.parse(opts.body)
        sentSmsText = body.text
        return { ok: true, json: async () => ({ data: { id: 'msg_mock_123' } }) }
      }
      return originalFetch(url, opts)
    }

    try {
      await updateJobStatus(db, {
        jobId: 'job-1',
        orgId: 'org-test',
        newStatus: 'en_route',
        notifyCustomer: true,
        technicianName: 'Dave Tech',
        etaMinutes: 20
      })

      assert.ok(sentSmsText, 'SMS must have been dispatched')
      assert.strictEqual(sentSmsText.includes('app.corvexastudio.com'), false, 'Must not reference corvexastudio')
      assert.strictEqual(sentSmsText.includes('https://captodesk.com/t/tok_abc123xyz'), true, 'Must use compact /t/ URL')
      assert.strictEqual(sentSmsText.includes('/track/'), false, 'Must not use long /track/ route')
    } finally {
      global.fetch = originalFetch
    }
  } finally {
    if (origPublic) process.env.NEXT_PUBLIC_APP_URL = origPublic
    if (origApp) process.env.APP_URL = origApp
    if (origTelnyxKey) process.env.TELNYX_API_KEY = origTelnyxKey
    else delete process.env.TELNYX_API_KEY
  }
})

test('FIELD-002: reassignJobCrew generates compact /t/[token] tracking URL for customer notification', async () => {
  const origPublic = process.env.NEXT_PUBLIC_APP_URL
  const origTelnyxKey = process.env.TELNYX_API_KEY
  delete process.env.NEXT_PUBLIC_APP_URL
  process.env.TELNYX_API_KEY = 'mock_telnyx_key_for_test'

  try {
    let sentSms = null
    const db = createMockDb({
      organizations: [{ id: 'org-1', name: 'Clean Air HVAC', telnyx_phone_number: '+15551234000' }],
      contacts: [{ id: 'c-1', name: 'Bob Jones', phone: '+15559876543' }],
      crews: [{ id: 'crew-1', org_id: 'org-1', name: 'Team Alpha', is_active: true }],
      jobs: [{
        id: 'job-99',
        org_id: 'org-1',
        contact_id: 'c-1',
        tracking_token: 'trk_999888',
        scheduled_start: '2026-11-01T09:00:00.000Z',
        scheduled_end: '2026-11-01T11:00:00.000Z',
        contact: { id: 'c-1', name: 'Bob Jones', phone: '+15559876543' },
        crew: { id: 'crew-1', name: 'Team Alpha', color_code: '#3B82F6' }
      }]
    })

    const originalFetch = global.fetch
    global.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('telnyx')) {
        sentSms = JSON.parse(opts.body)
        return { ok: true, json: async () => ({ data: { id: 'msg_crew_1' } }) }
      }
      return originalFetch(url, opts)
    }

    try {
      await reassignJobCrew(db, {
        orgId: 'org-1',
        jobId: 'job-99',
        crewId: 'crew-1',
        notifyCustomer: true
      })
      assert.ok(sentSms, 'Customer notification SMS should be sent')
      assert.strictEqual(sentSms.text.includes('https://captodesk.com/t/trk_999888'), true, 'Must use /t/ tracking route')
      assert.strictEqual(sentSms.text.includes('app.corvexastudio.com'), false, 'Must not leak corvexastudio')
    } finally {
      global.fetch = originalFetch
    }
  } finally {
    if (origPublic) process.env.NEXT_PUBLIC_APP_URL = origPublic
    if (origTelnyxKey) process.env.TELNYX_API_KEY = origTelnyxKey
    else delete process.env.TELNYX_API_KEY
  }
})

// ============================================================================
// 3. TCPA QUIET-HOURS LEAD PRESERVATION & MORNING RECOVERY QUEUE (CALL-001)
// ============================================================================

test('CALL-001: calculateNextMorning805 produces exact 8:05 AM in local timezone for night and early morning calls', () => {
  // Late evening call (9:30 PM Chicago time on Oct 25)
  const eveningCall = new Date('2026-10-25T21:30:00-05:00')
  const eveningResult = calculateNextMorning805('America/Chicago', eveningCall)
  assert.strictEqual(eveningResult.targetDateKey, '2026-10-26')
  // Verify scheduledAt is exactly 8:05:00 AM Central
  const eveningDate = new Date(eveningResult.scheduledAt)
  const eveningHour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: 'numeric', hour12: false }).format(eveningDate)
  assert.strictEqual(eveningHour, '08:05')

  // Early morning call (3:15 AM Chicago time on Oct 26)
  const earlyCall = new Date('2026-10-26T03:15:00-05:00')
  const earlyResult = calculateNextMorning805('America/Chicago', earlyCall)
  assert.strictEqual(earlyResult.targetDateKey, '2026-10-26')
  const earlyDate = new Date(earlyResult.scheduledAt)
  const earlyHour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: 'numeric', hour12: false }).format(earlyDate)
  assert.strictEqual(earlyHour, '08:05')

  // Both calls produce the identical target date key for deduplication
  assert.strictEqual(eveningResult.targetDateKey, earlyResult.targetDateKey)
})

test('CALL-001: TCPA quiet-hours missed call suppresses immediate SMS, preserves contact, creates lead, and queues morning SMS', async () => {
  const db = createMockDb({
    organizations: [{
      id: 'org-tcpa',
      name: 'All Hours Plumbing',
      is_missed_call_active: true,
      timezone: 'America/Chicago'
    }],
    telnyx_phone_numbers: [{
      org_id: 'org-tcpa',
      phone_number: '+13125550100',
      status: 'active'
    }]
  })

  let immediateSmsDispatched = false
  const sendSmsMock = async () => {
    immediateSmsDispatched = true
    return { success: true, messageId: 'sms-unexpected' }
  }

  // Simulate late night call at 10:15 PM Central
  const nightTime = new Date('2026-10-25T22:15:00-05:00')

  const result = await processMissedCall(db, {
    callerNumber: '+13125559999',
    calledNumber: '+13125550100',
    callOutcome: {
      state: 'no_answer',
      wasAnswered: false,
      isEligibleForRecovery: true,
      durationSeconds: 0
    },
    callControlId: 'ctrl_tcpa_1',
    sendSmsFn: sendSmsMock,
    overrideDate: nightTime
  })

  // 1. Immediate SMS must NOT be sent
  assert.strictEqual(immediateSmsDispatched, false, 'TCPA strictly forbids immediate outbound SMS during quiet hours')
  assert.strictEqual(result.action, 'suppressed_tcpa_quiet_hours')
  assert.strictEqual(result.suppressionReason, 'tcpa_quiet_hours')

  // 2. Contact must exist in contacts table
  const contact = db._tables.contacts.find(c => c.phone === '+13125559999' && c.org_id === 'org-tcpa')
  assert.ok(contact, 'Caller must be saved in contacts')

  // 3. Lead must be created in leads table so contractor sees prospect
  const lead = db._tables.leads.find(l => l.contact_id === contact.id && l.org_id === 'org-tcpa')
  assert.ok(lead, 'Lead record must be created for quiet-hours missed call')
  assert.strictEqual(lead.source, 'missed_call')
  assert.strictEqual(lead.status, 'new')
  assert.match(lead.notes, /TCPA quiet hours/, 'Notes must record after-hours origin')

  // 4. Follow-up SMS must be scheduled in automation_runs for next morning 8:05 AM
  const runs = db._tables.automation_runs.filter(r => r.org_id === 'org-tcpa')
  assert.strictEqual(runs.length, 1, 'Exactly one morning recovery job must be scheduled')
  const run = runs[0]
  assert.strictEqual(run.status, 'scheduled')
  assert.strictEqual(run.action_type, 'send_sms')
  assert.strictEqual(run.action_params.to, '+13125559999')
  assert.strictEqual(run.action_params.from, '+13125550100')
  assert.match(run.action_params.text, /All Hours Plumbing/)
  assert.strictEqual(run.idempotency_key, 'tcpa_morning_recovery:org-tcpa:+13125559999:2026-10-26')
})

test('CALL-001: Repeat quiet-hours missed calls deduplicate in automation_runs and update lead count', async () => {
  const db = createMockDb({
    organizations: [{
      id: 'org-tcpa-rep',
      name: 'Night HVAC',
      is_missed_call_active: true,
      timezone: 'America/Chicago'
    }],
    telnyx_phone_numbers: [{
      org_id: 'org-tcpa-rep',
      phone_number: '+13125550200',
      status: 'active'
    }]
  })

  // First call at 9:00 PM
  const time1 = new Date('2026-10-25T21:00:00-05:00')
  await processMissedCall(db, {
    callerNumber: '+13125558888',
    calledNumber: '+13125550200',
    callOutcome: { state: 'no_answer', wasAnswered: false, isEligibleForRecovery: true, durationSeconds: 0 },
    callControlId: 'ctrl_tcpa_rep_1',
    overrideDate: time1
  })

  // Second call at 11:30 PM (same night, same caller)
  const time2 = new Date('2026-10-25T23:30:00-05:00')
  await processMissedCall(db, {
    callerNumber: '+13125558888',
    calledNumber: '+13125550200',
    callOutcome: { state: 'no_answer', wasAnswered: false, isEligibleForRecovery: true, durationSeconds: 0 },
    callControlId: 'ctrl_tcpa_rep_2',
    overrideDate: time2
  })

  // Verify: Exactly 1 job scheduled in automation_runs (idempotent protection)
  const runs = db._tables.automation_runs.filter(r => r.org_id === 'org-tcpa-rep')
  assert.strictEqual(runs.length, 1, 'Must not duplicate morning recovery job on repeat calls')

  // Verify: Lead updated with repeat call count
  const lead = db._tables.leads.find(l => l.org_id === 'org-tcpa-rep')
  assert.ok(lead)
  assert.strictEqual(lead.missed_call_count, 2, 'Lead missed call count must be incremented')
  assert.match(lead.notes, /Attempt #2/, 'Notes should track repeat attempt')
})

test('CALL-001: Opted-out caller is strictly suppressed and does NOT schedule morning recovery SMS', async () => {
  const db = createMockDb({
    organizations: [{
      id: 'org-optout',
      name: 'Safe Air',
      is_missed_call_active: true,
      timezone: 'America/Chicago'
    }],
    telnyx_phone_numbers: [{
      org_id: 'org-optout',
      phone_number: '+13125550300',
      status: 'active'
    }],
    contacts: [{
      id: 'contact-opted-out',
      org_id: 'org-optout',
      phone: '+13125557777',
      name: 'Opted Out User',
      opt_out: true
    }]
  })

  const nightTime = new Date('2026-10-25T22:00:00-05:00')
  const result = await processMissedCall(db, {
    callerNumber: '+13125557777',
    calledNumber: '+13125550300',
    callOutcome: { state: 'no_answer', wasAnswered: false, isEligibleForRecovery: true, durationSeconds: 0 },
    callControlId: 'ctrl_optout',
    overrideDate: nightTime
  })

  assert.strictEqual(result.suppressionReason, 'opted_out')
  // Verify NO morning recovery queued
  const runs = db._tables.automation_runs.filter(r => r.org_id === 'org-optout')
  assert.strictEqual(runs.length, 0, 'Opted-out callers must never be queued for morning recovery')
})

// ============================================================================
// 4. BOOKING CONFIRMATION SMS INBOX CONVERSATION SYNC (LIFECYCLE-001)
// ============================================================================

test('LIFECYCLE-001: Public booking confirmation SMS is logged into customer Inbox conversations and messages', async () => {
  const origTelnyxKey = process.env.TELNYX_API_KEY
  process.env.TELNYX_API_KEY = 'mock_telnyx_key_for_test'

  const db = createMockDb({
    organizations: [{
      id: 'org-booking',
      name: 'Quick Rooter Plumbing',
      slug: 'quick-rooter',
      telnyx_phone_number: '+15552223333',
      business_hours: {
        monday: { open: '08:00', close: '18:00', closed: false }
      }
    }],
    services: [{
      id: 'srv-drain',
      org_id: 'org-booking',
      name: 'Drain Cleaning',
      duration_minutes: 60,
      price: 150,
      is_active: true
    }]
  })

  let dispatchedSms = null
  const originalFetch = global.fetch
  global.fetch = async (url, opts) => {
    if (typeof url === 'string' && url.includes('telnyx')) {
      dispatchedSms = JSON.parse(opts.body)
      return { ok: true, json: async () => ({ data: { id: 'telnyx_msg_confirm_99' } }) }
    }
    return originalFetch(url, opts)
  }

  try {
    const bookingResult = await createBooking(db, {
      orgId: 'org-booking',
      customerName: 'Sarah Jenkins',
      customerPhone: '+15554445555',
      customerEmail: 'sarah@example.com',
      serviceId: 'srv-drain',
      startTime: '2026-11-02T10:00:00.000Z',
      source: 'public_booking',
      notes: 'Kitchen sink clogged'
    })

    assert.ok(bookingResult.appointment, 'Booking appointment must be created')
    assert.ok(dispatchedSms, 'Confirmation SMS must have been dispatched to customer')

    // Verify: conversations thread was created for customer
    const contact = db._tables.contacts.find(c => c.phone === '+15554445555' && c.org_id === 'org-booking')
    assert.ok(contact, 'Contact must be upserted')

    const conv = db._tables.conversations.find(c => c.contact_id === contact.id && c.org_id === 'org-booking')
    assert.ok(conv, 'Conversation record must be created for customer')
    assert.match(conv.last_message_preview, /Quick Rooter Plumbing/)

    // Verify: outbound message was inserted into messages table
    const msg = db._tables.messages.find(m => m.conversation_id === conv.id)
    assert.ok(msg, 'Message record must be inserted into Inbox thread')
    assert.strictEqual(msg.direction, 'outbound')
    assert.strictEqual(msg.sender_type, 'system')
    assert.strictEqual(msg.delivery_status, 'sent')
    assert.strictEqual(msg.automation_source, 'booking_confirmation')
    assert.strictEqual(msg.telnyx_message_id, 'telnyx_msg_confirm_99')
    assert.match(msg.body, /Drain Cleaning/)
  } finally {
    global.fetch = originalFetch
    if (origTelnyxKey) process.env.TELNYX_API_KEY = origTelnyxKey
    else delete process.env.TELNYX_API_KEY
  }
})

test('LIFECYCLE-001: Booking succeeds cleanly even if conversation logging encounters non-fatal DB failure', async () => {
  const db = createMockDb({
    organizations: [{
      id: 'org-booking-err',
      name: 'Resilient HVAC',
      slug: 'resilient-hvac',
      telnyx_phone_number: '+15558889999'
    }],
    services: [{
      id: 'srv-tuneup',
      org_id: 'org-booking-err',
      name: 'AC Tune Up',
      duration_minutes: 60,
      price: 99,
      is_active: true
    }]
  })

  // Intentionally break conversations table to simulate non-fatal DB error
  const origFrom = db.from
  db.from = (tableName) => {
    if (tableName === 'conversations') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => { throw new Error('Simulated conversations table connection failure') }
            })
          })
        }),
        insert: () => { throw new Error('Simulated conversation insert error') }
      }
    }
    return origFrom(tableName)
  }

  const originalFetch = global.fetch
  global.fetch = async (url, opts) => {
    if (typeof url === 'string' && url.includes('telnyx')) {
      return { ok: true, json: async () => ({ data: { id: 'telnyx_msg_mock_ok' } }) }
    }
    return originalFetch(url, opts)
  }

  try {
    const bookingResult = await createBooking(db, {
      orgId: 'org-booking-err',
      customerName: 'Marcus Vance',
      customerPhone: '+15556667777',
      serviceId: 'srv-tuneup',
      startTime: '2026-11-03T14:00:00.000Z',
      source: 'public_booking'
    })

    // Booking must succeed despite conversation logging error
    assert.ok(bookingResult.appointment, 'Customer booking MUST NOT fail when message logging fails')
    assert.strictEqual(bookingResult.appointment.status, 'confirmed')
  } finally {
    global.fetch = originalFetch
  }
})
