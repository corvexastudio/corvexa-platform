/**
 * CAPTODESK — PHASE 3.3: QUOTE-TO-JOB CONTINUITY, DRIVEWAY COMPLETION & SCHEDULE SYNC TEST SUITE
 * 
 * Verifies:
 * - QUOTE-001: customerAcceptQuote creates linked job from quote & line items
 * - QUOTE-001: Idempotency - open active job is linked without creating duplicates
 * - QUOTE-001: convertQuoteToJob converts estimate to job and prevents double conversion
 * - QUOTE-002: Quote accepted and declined in-app notifications link to /client/quotes
 * - NAV-002: Bi-directional job and appointment status synchronization (en_route, in_progress, completed, cancelled, no_show)
 * - NAV-002: Self-service booking reschedule and cancellation propagates to linked jobs
 * - Lifecycle Step 5: On-site job completion auto-generates draft invoice and notifies office
 * - LIFECYCLE-002: "New Caller" contact name resolution during booking
 */

process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert'
import {
  customerAcceptQuote,
  customerDeclineQuote
} from '../src/lib/quotes/quote-manager.ts'
import {
  updateJobStatus,
  convertQuoteToJob,
  createJob,
  recordJobTimestamp
} from '../src/lib/jobs/job-manager.ts'
import {
  createBooking,
  customerRescheduleBooking,
  customerCancelBooking
} from '../src/lib/booking/booking-manager.ts'

// In-Memory Supabase Mock Harness
function createMockDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    contacts: initialState.contacts || [],
    conversations: initialState.conversations || [],
    messages: initialState.messages || [],
    leads: initialState.leads || [],
    quotes: initialState.quotes || [],
    quote_items: initialState.quote_items || [],
    jobs: initialState.jobs || [],
    job_items: initialState.job_items || [],
    appointments: initialState.appointments || [],
    services: initialState.services || [],
    invoices: initialState.invoices || [],
    invoice_items: initialState.invoice_items || [],
    notifications: initialState.notifications || [],
    activity_logs: initialState.activity_logs || [],
    automation_runs: initialState.automation_runs || [],
    compliance_audit_logs: initialState.compliance_audit_logs || [],
    compliance_suppression_list: initialState.compliance_suppression_list || [],
    profiles: initialState.profiles || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let data = [...(tables[tableName] || [])]
      let filters = []

      const queryBuilder = {
        select: (_cols) => queryBuilder,
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
        limit: (_n) => queryBuilder,
        order: () => queryBuilder,
        then: (resolve, reject) => {
          const filtered = data.filter((row) => filters.every((fn) => fn(row)))
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject)
        },
        maybeSingle: async () => {
          const filtered = data.filter((row) => filters.every((fn) => fn(row)))
          return { data: filtered[0] || null, error: null }
        },
        single: async () => {
          const filtered = data.filter((row) => filters.every((fn) => fn(row)))
          if (filtered.length === 0) return { data: null, error: new Error(`Row not found in ${tableName}`) }
          return { data: filtered[0], error: null }
        },
        insert: (rowOrRows) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
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
            data: lastInserted,
            error: null,
            select: () => ({
              single: async () => ({ data: lastInserted, error: null }),
              maybeSingle: async () => ({ data: lastInserted, error: null }),
              then: (resolve, reject) => Promise.resolve({ data: insertedRows, error: null }).then(resolve, reject)
            }),
            then: (resolve, reject) => Promise.resolve({ data: insertedRows, error: null }).then(resolve, reject)
          }
        },
        update: (updates) => {
          return {
            eq: (col, val) => {
              filters.push((row) => row[col] === val)
              const matched = tables[tableName].filter((row) => filters.every((fn) => fn(row)))
              for (const row of matched) {
                Object.assign(row, updates)
              }
              const firstUpdated = matched[0] || null

              const updateChain = {
                eq: (col2, val2) => {
                  filters.push((row) => row[col2] === val2)
                  const innerMatched = tables[tableName].filter((row) => filters.every((fn) => fn(row)))
                  for (const row of innerMatched) {
                    Object.assign(row, updates)
                  }
                  return updateChain
                },
                select: () => ({
                  single: async () => ({ data: firstUpdated, error: null }),
                  maybeSingle: async () => ({ data: firstUpdated, error: null }),
                  then: (resolve, reject) => Promise.resolve({ data: matched, error: null }).then(resolve, reject)
                }),
                single: async () => ({ data: firstUpdated, error: null }),
                maybeSingle: async () => ({ data: firstUpdated, error: null }),
                then: (resolve, reject) => Promise.resolve({ data: matched, error: null }).then(resolve, reject)
              }

              return updateChain
            }
          }
        }
      }

      return queryBuilder
    }
  }

  return client
}

// ---------------------------------------------------------------------------
// SUITE 1: QUOTE-001 & QUOTE-002 Quote Acceptance, Continuity & Notifications
// ---------------------------------------------------------------------------

test('QUOTE-001: customerAcceptQuote automatically creates a linked field service job', async () => {
  const db = createMockDb({
    organizations: [{ id: 'org_1', name: 'Apex Driveway & Masonry', telnyx_phone_number: '+18005550100' }],
    contacts: [{ id: 'cont_1', org_id: 'org_1', name: 'Dan Contractor', phone: '+15555550199' }],
    quotes: [{
      id: 'quote_1',
      org_id: 'org_1',
      contact_id: 'cont_1',
      quote_number: 'Q-1001',
      title: 'Driveway Sealcoating & Crack Fill',
      description: 'Full surface pressure wash and 2 coats sealer',
      total: 1250.00,
      subtotal: 1250.00,
      tax: 0,
      discount: 0,
      status: 'sent',
      manage_token: 'tok_quote_1'
    }],
    quote_items: [
      { id: 'item_1', quote_id: 'quote_1', description: 'Commercial Sealcoat 5000 sq ft', quantity: 1, unit_price: 1000 },
      { id: 'item_2', quote_id: 'quote_1', description: 'Hot Pour Crack Fill', quantity: 1, unit_price: 250 }
    ]
  })

  const result = await customerAcceptQuote(db, 'tok_quote_1', 'Dan Contractor')
  assert.strictEqual(result.success, true)
  assert.strictEqual(result.quote.status, 'accepted')

  // Check that job was created and linked
  assert.ok(result.job, 'Expected job to be returned in customerAcceptQuote result')
  assert.strictEqual(result.job.quote_id, 'quote_1')
  assert.strictEqual(result.job.contact_id, 'cont_1')
  assert.strictEqual(result.job.status, 'scheduled')
  assert.strictEqual(result.job.title, 'Driveway Sealcoating & Crack Fill')

  // Verify job exists in jobs table
  const jobInDb = db._tables.jobs.find(j => j.quote_id === 'quote_1')
  assert.ok(jobInDb, 'Job record must be saved in database')

  // Verify line items were copied
  const jobItems = db._tables.job_items.filter(it => it.job_id === jobInDb.id)
  assert.strictEqual(jobItems.length, 2, 'Line items from quote must be copied into job_items')
  assert.strictEqual(jobItems[0].description, 'Commercial Sealcoat 5000 sq ft')
})

test('QUOTE-001: customerAcceptQuote links existing open job without creating duplicate', async () => {
  const db = createMockDb({
    organizations: [{ id: 'org_1', name: 'Apex Driveway & Masonry' }],
    contacts: [{ id: 'cont_1', org_id: 'org_1', name: 'Dan Contractor', phone: '+15555550199' }],
    quotes: [{
      id: 'quote_2',
      org_id: 'org_1',
      contact_id: 'cont_1',
      quote_number: 'Q-1002',
      title: 'Driveway Extension Quote',
      total: 2400.00,
      status: 'sent',
      manage_token: 'tok_quote_2'
    }],
    jobs: [{
      id: 'job_existing_1',
      org_id: 'org_1',
      contact_id: 'cont_1',
      quote_id: null,
      job_number: 'J-1001',
      title: 'On-site Driveway Assessment',
      status: 'in_progress',
      scheduled_start: new Date().toISOString(),
      notes: 'Initial on-site visit'
    }]
  })

  const result = await customerAcceptQuote(db, 'tok_quote_2', 'Dan Contractor')
  assert.strictEqual(result.success, true)

  // Verify it linked the existing job
  assert.strictEqual(result.job.id, 'job_existing_1')
  assert.strictEqual(result.job.quote_id, 'quote_2')
  assert.ok(result.job.notes.includes('Accepted Estimate #Q-1002'))

  // Verify no second job was inserted
  assert.strictEqual(db._tables.jobs.length, 1, 'No duplicate job should be created')
})

test('QUOTE-001: convertQuoteToJob converts estimate to job and prevents double conversion', async () => {
  const db = createMockDb({
    organizations: [{ id: 'org_1', name: 'Apex Masonry' }],
    contacts: [{ id: 'cont_1', org_id: 'org_1', name: 'Sarah Miller', phone: '+15555550177' }],
    quotes: [{
      id: 'quote_conv_1',
      org_id: 'org_1',
      contact_id: 'cont_1',
      quote_number: 'Q-1003',
      title: 'Patio Paver Install',
      total: 3500.00,
      status: 'accepted',
      notes: 'Custom herringbone pattern'
    }],
    quote_items: [
      { id: 'qi_1', quote_id: 'quote_conv_1', description: 'Paver Material & Base', quantity: 1, unit_price: 2000 },
      { id: 'qi_2', quote_id: 'quote_conv_1', description: 'Labor & Compaction', quantity: 1, unit_price: 1500 }
    ]
  })

  // First conversion
  const res1 = await convertQuoteToJob(db, {
    quoteId: 'quote_conv_1',
    orgId: 'org_1'
  })
  assert.strictEqual(res1.success, true)
  assert.ok(res1.job)
  assert.strictEqual(res1.job.quote_id, 'quote_conv_1')
  assert.strictEqual(db._tables.jobs.length, 1)

  // Second conversion attempt (idempotency check)
  const res2 = await convertQuoteToJob(db, {
    quoteId: 'quote_conv_1',
    orgId: 'org_1'
  })
  assert.strictEqual(res2.success, true)
  assert.strictEqual(res2.job.id, res1.job.id, 'Must return identical job on re-conversion')
  assert.strictEqual(db._tables.jobs.length, 1, 'Must not create duplicate job')
})

test('QUOTE-002: Quote accepted and declined in-app notifications link to /client/quotes', async () => {
  const db = createMockDb({
    organizations: [{ id: 'org_1', name: 'Apex Masonry' }],
    contacts: [{ id: 'cont_1', org_id: 'org_1', name: 'Mike Ross', phone: '+15555550188' }],
    quotes: [
      {
        id: 'quote_acc_notif',
        org_id: 'org_1',
        contact_id: 'cont_1',
        quote_number: 'Q-2001',
        total: 500,
        status: 'sent',
        manage_token: 'tok_acc_notif'
      },
      {
        id: 'quote_dec_notif',
        org_id: 'org_1',
        contact_id: 'cont_1',
        quote_number: 'Q-2002',
        total: 750,
        status: 'sent',
        manage_token: 'tok_dec_notif'
      }
    ]
  })

  // Accept quote
  await customerAcceptQuote(db, 'tok_acc_notif', 'Mike Ross')
  const acceptNotif = db._tables.notifications.find(n => n.title === 'Quote Accepted!')
  assert.ok(acceptNotif, 'Quote Accepted notification must be created')
  assert.strictEqual(acceptNotif.link, '/client/quotes', 'Quote accepted notification must link to /client/quotes')

  // Decline quote
  await customerDeclineQuote(db, 'tok_dec_notif', 'Too expensive')
  const declineNotif = db._tables.notifications.find(n => n.title === 'Quote Declined')
  assert.ok(declineNotif, 'Quote Declined notification must be created')
  assert.strictEqual(declineNotif.link, '/client/quotes', 'Quote declined notification must link to /client/quotes')
})

// ---------------------------------------------------------------------------
// SUITE 2: NAV-002 Bi-Directional Appointment & Job Status Synchronization
// ---------------------------------------------------------------------------

test('NAV-002: updateJobStatus synchronizes linked appointment status cleanly without updated_at column errors', async () => {
  const db = createMockDb({
    organizations: [{ id: 'org_1', name: 'Apex Masonry' }],
    contacts: [{ id: 'cont_1', org_id: 'org_1', name: 'Test Client', phone: '+15555550111' }],
    appointments: [{
      id: 'appt_sync_1',
      org_id: 'org_1',
      contact_id: 'cont_1',
      status: 'scheduled',
      start_time: new Date().toISOString()
    }],
    jobs: [{
      id: 'job_sync_1',
      org_id: 'org_1',
      contact_id: 'cont_1',
      appointment_id: 'appt_sync_1',
      job_number: 'J-2001',
      title: 'Roof Repair',
      status: 'scheduled',
      scheduled_start: new Date().toISOString()
    }]
  })

  // 1. Progress to en_route -> appointment should become confirmed
  const resRoute = await updateJobStatus(db, {
    orgId: 'org_1',
    jobId: 'job_sync_1',
    newStatus: 'en_route',
    technicianName: 'Bob',
    etaMinutes: 15
  })
  assert.strictEqual(resRoute.success, true)
  assert.strictEqual(db._tables.appointments[0].status, 'confirmed')
  assert.ok(db._tables.appointments[0].confirmed_at)

  // 2. Progress to in_progress -> appointment stays confirmed
  const resProg = await updateJobStatus(db, {
    orgId: 'org_1',
    jobId: 'job_sync_1',
    newStatus: 'in_progress'
  })
  assert.strictEqual(resProg.success, true)
  assert.strictEqual(db._tables.appointments[0].status, 'confirmed')

  // 3. Mark completed -> appointment becomes completed
  const resComp = await updateJobStatus(db, {
    orgId: 'org_1',
    jobId: 'job_sync_1',
    newStatus: 'completed'
  })
  assert.strictEqual(resComp.success, true)
  assert.strictEqual(db._tables.appointments[0].status, 'completed')
})

test('NAV-002: updateJobStatus synchronizes no_show and cancelled to appointments', async () => {
  const db = createMockDb({
    organizations: [{ id: 'org_1', name: 'Apex Masonry' }],
    contacts: [{ id: 'cont_1', org_id: 'org_1', name: 'No Show Client', phone: '+15555550112' }],
    appointments: [
      { id: 'appt_noshow', org_id: 'org_1', contact_id: 'cont_1', status: 'confirmed', start_time: new Date().toISOString() },
      { id: 'appt_cancel', org_id: 'org_1', contact_id: 'cont_1', status: 'confirmed', start_time: new Date().toISOString() }
    ],
    jobs: [
      { id: 'job_noshow', org_id: 'org_1', appointment_id: 'appt_noshow', status: 'scheduled', scheduled_start: new Date().toISOString() },
      { id: 'job_cancel', org_id: 'org_1', appointment_id: 'appt_cancel', status: 'scheduled', scheduled_start: new Date().toISOString() }
    ]
  })

  // no_show
  await updateJobStatus(db, {
    orgId: 'org_1',
    jobId: 'job_noshow',
    newStatus: 'no_show'
  })
  assert.strictEqual(db._tables.appointments[0].status, 'no_show')
  assert.strictEqual(db._tables.appointments[0].cancellation_reason, 'Customer no-show')

  // cancelled
  await updateJobStatus(db, {
    orgId: 'org_1',
    jobId: 'job_cancel',
    newStatus: 'cancelled'
  })
  assert.strictEqual(db._tables.appointments[1].status, 'cancelled')
  assert.strictEqual(db._tables.appointments[1].cancellation_reason, 'Job cancelled')
})

test('NAV-002: customerRescheduleBooking and customerCancelBooking synchronize linked job', async () => {
  const initialTime = new Date('2026-11-01T14:00:00Z').toISOString()
  const db = createMockDb({
    organizations: [{ id: 'org_1', name: 'Apex Masonry', timezone: 'America/Chicago' }],
    contacts: [{ id: 'cont_1', org_id: 'org_1', name: 'Rescheduling Customer', phone: '+15555550113' }],
    services: [{ id: 'svc_1', org_id: 'org_1', name: 'Masonry Inspection', duration_minutes: 60, is_active: true }],
    appointments: [{
      id: 'appt_resched',
      org_id: 'org_1',
      contact_id: 'cont_1',
      service_id: 'svc_1',
      title: 'Masonry Inspection - Rescheduling Customer',
      status: 'confirmed',
      start_time: initialTime,
      end_time: new Date('2026-11-01T15:00:00Z').toISOString(),
      manage_token: 'tok_resched_1'
    }],
    jobs: [{
      id: 'job_resched',
      org_id: 'org_1',
      appointment_id: 'appt_resched',
      status: 'scheduled',
      scheduled_start: initialTime,
      scheduled_end: new Date('2026-11-01T15:00:00Z').toISOString()
    }]
  })

  // Reschedule
  const newStartTime = new Date('2026-11-02T16:00:00Z').toISOString()
  const reschedResult = await customerRescheduleBooking(db, 'tok_resched_1', newStartTime)
  assert.strictEqual(reschedResult.success, true)

  const linkedJob = db._tables.jobs[0]
  assert.strictEqual(linkedJob.scheduled_start, newStartTime, 'Job scheduled_start must update to rescheduled appointment start')
  assert.strictEqual(linkedJob.status, 'scheduled')

  // Cancel
  const cancelResult = await customerCancelBooking(db, 'tok_resched_1', 'Family emergency')
  assert.strictEqual(cancelResult.success, true)
  assert.strictEqual(linkedJob.status, 'cancelled', 'Job status must update to cancelled when customer cancels appointment')
})

// ---------------------------------------------------------------------------
// SUITE 3: Lifecycle Step 5 On-Site Completion to Draft Invoice Handoff
// ---------------------------------------------------------------------------

test('Lifecycle Step 5: updateJobStatus(completed) auto-generates draft invoice and notifies office', async () => {
  const db = createMockDb({
    organizations: [{ id: 'org_1', name: 'Apex Masonry' }],
    contacts: [{ id: 'cont_1', org_id: 'org_1', name: 'Completed Job Customer', phone: '+15555550114' }],
    jobs: [{
      id: 'job_to_inv_1',
      org_id: 'org_1',
      contact_id: 'cont_1',
      job_number: 'J-3001',
      title: 'Driveway Resurfacing',
      description: 'Two-car garage driveway asphalt repair',
      status: 'in_progress',
      scheduled_start: new Date().toISOString()
    }],
    job_items: [
      { id: 'ji_1', job_id: 'job_to_inv_1', org_id: 'org_1', description: 'Asphalt Patching & Base', quantity: 2, unit_price: 350 },
      { id: 'ji_2', job_id: 'job_to_inv_1', org_id: 'org_1', description: 'Acrylic Sealer Coat', quantity: 1, unit_price: 450 }
    ]
  })

  const result = await updateJobStatus(db, {
    orgId: 'org_1',
    jobId: 'job_to_inv_1',
    newStatus: 'completed'
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.job.status, 'completed')

  // Check draft invoice returned
  assert.ok(result.invoice, 'Must return draft invoice on job completion')
  assert.strictEqual(result.invoice.job_id, 'job_to_inv_1')
  assert.strictEqual(result.invoice.status, 'draft')
  assert.strictEqual(result.invoice.total, 1150) // (2 * 350) + (1 * 450) = 700 + 450 = 1150

  // Check notification emitted for office
  const invNotif = db._tables.notifications.find(n => n.title === 'Draft Invoice Ready')
  assert.ok(invNotif, 'Office notification for draft invoice must be created')
  assert.strictEqual(invNotif.link, '/client/invoices')

  // Idempotency check: completing again or updating should not create duplicate invoice
  const secondResult = await updateJobStatus(db, {
    orgId: 'org_1',
    jobId: 'job_to_inv_1',
    newStatus: 'completed'
  })
  assert.strictEqual(db._tables.invoices.length, 1, 'Only one invoice should exist for this job')
})

test('Lifecycle Step 5: recordJobTimestamp(completed) propagates draft invoice', async () => {
  const db = createMockDb({
    organizations: [{ id: 'org_1', name: 'Apex Masonry' }],
    contacts: [{ id: 'cont_1', org_id: 'org_1', name: 'Field Customer', phone: '+15555550115' }],
    jobs: [{
      id: 'job_field_tap',
      org_id: 'org_1',
      contact_id: 'cont_1',
      job_number: 'J-4001',
      title: 'Emergency Chimney Cap Repair',
      status: 'in_progress',
      scheduled_start: new Date().toISOString()
    }],
    job_items: [
      { id: 'ji_tap', job_id: 'job_field_tap', org_id: 'org_1', description: 'Chimney Cap Flashing & Seal', quantity: 1, unit_price: 295 }
    ]
  })

  const res = await recordJobTimestamp(db, {
    orgId: 'org_1',
    jobId: 'job_field_tap',
    action: 'completed'
  })

  assert.strictEqual(res.success, true)
  assert.strictEqual(res.job.status, 'completed')
  assert.ok(res.invoice)
  assert.strictEqual(res.invoice.total, 295)
})

// ---------------------------------------------------------------------------
// SUITE 4: LIFECYCLE-002 "New Caller" Name Resolution During Booking
// ---------------------------------------------------------------------------

test('LIFECYCLE-002: createBooking updates contact name from "New Caller" to customer real name', async () => {
  const db = createMockDb({
    organizations: [{
      id: 'org_1',
      name: 'Apex Masonry',
      booking_mode: 'instant',
      timezone: 'America/Chicago',
      telnyx_phone_number: '+18005550100'
    }],
    contacts: [{
      id: 'cont_new_caller',
      org_id: 'org_1',
      name: 'New Caller',
      phone: '+15555550199',
      tags: ['lead']
    }],
    leads: [{
      id: 'lead_1',
      org_id: 'org_1',
      contact_id: 'cont_new_caller',
      source: 'missed_call',
      status: 'new'
    }],
    services: [{
      id: 'svc_std',
      org_id: 'org_1',
      name: 'Standard Consultation',
      duration_minutes: 60,
      is_active: true
    }]
  })

  const bookResult = await createBooking(db, {
    orgId: 'org_1',
    serviceId: 'svc_std',
    customerName: 'Robert Johnson',
    customerPhone: '+15555550199',
    startTime: new Date('2026-11-10T15:00:00Z').toISOString(),
    source: 'booking_page'
  })

  assert.strictEqual(bookResult.success, true)

  // Verify contact was updated
  const updatedContact = db._tables.contacts.find(c => c.id === 'cont_new_caller')
  assert.strictEqual(updatedContact.name, 'Robert Johnson', 'Contact name must be updated from "New Caller" to real customer name')

  // Verify lead was linked and updated to booked
  const updatedLead = db._tables.leads.find(l => l.contact_id === 'cont_new_caller')
  assert.strictEqual(updatedLead.status, 'booked')
})
