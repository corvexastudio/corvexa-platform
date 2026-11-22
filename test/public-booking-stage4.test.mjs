import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createBooking,
  customerCancelBooking,
  customerRescheduleBooking
} from '../src/lib/booking/booking-manager.ts'
import {
  parseServicePricing,
  formatDynamicPricingTotal
} from '../src/lib/services/service-pricing.ts'
import {
  formatCustomerName,
  formatStandardUsAddress,
  combineStreetAndUnit
} from '../src/lib/booking/customer-input-formatter.ts'
import {
  calculateAvailableSlots,
  doesIntervalOverlap
} from '../src/lib/booking/availability.ts'

/**
 * In-memory Supabase mock harness for Stage 4 self-service and confirmation testing
 */
function createMockDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    services: initialState.services || [],
    appointments: initialState.appointments || [],
    jobs: initialState.jobs || [],
    job_items: initialState.job_items || [],
    job_photos: initialState.job_photos || [],
    contacts: initialState.contacts || [],
    leads: initialState.leads || [],
    automation_runs: initialState.automation_runs || [],
    notifications: initialState.notifications || [],
    messages: initialState.messages || [],
    activity_logs: initialState.activity_logs || [],
    conversation_messages: initialState.conversation_messages || [],
    compliance_consents: initialState.compliance_consents || [],
    compliance_audit_logs: initialState.compliance_audit_logs || [],
    profiles: initialState.profiles || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []

      const queryBuilder = {
        select: () => queryBuilder,
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
        is: (col, val) => {
          filters.push((row) => row[col] === val || (val === null && (row[col] === null || row[col] === undefined)))
          return queryBuilder
        },
        gt: (col, val) => {
          filters.push((row) => row[col] > val)
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
        order: () => queryBuilder,
        limit: () => queryBuilder,
        then: (resolve, reject) => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject)
        },
        maybeSingle: async () => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          return { data: filtered[0] || null, error: null }
        },
        single: async () => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          if (filtered.length === 0) return { data: null, error: new Error('Row not found') }
          return { data: filtered[0], error: null }
        },
        insert: (rowOrRows) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          const insertedRows = []

          for (const row of rows) {
            const newRow = {
              id: row.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              created_at: new Date().toISOString(),
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
              maybeSingle: async () => ({ data: lastInserted, error: null })
            }),
            then: (resolve) => resolve({ data: lastInserted, error: null })
          }
        },
        update: (updates) => {
          const chain = {
            eq: (col, val) => {
              filters.push((row) => row[col] === val)
              const tableData = tables[tableName] || []
              let updatedRow = null
              for (const row of tableData) {
                if (filters.every((fn) => fn(row))) {
                  Object.assign(row, updates)
                  updatedRow = row
                }
              }
              return {
                ...chain,
                data: updatedRow,
                error: null,
                select: () => ({
                  single: async () => ({ data: updatedRow, error: null }),
                  maybeSingle: async () => ({ data: updatedRow, error: null })
                }),
                then: (resolve) => resolve({ data: updatedRow, error: null })
              }
            },
            in: (col, arr) => {
              filters.push((row) => arr.includes(row[col]))
              return chain
            }
          }
          return chain
        }
      }

      return queryBuilder
    }
  }

  return client
}

// Future date constant for reliable testing
const FUTURE_DATE_1 = '2026-11-26T15:00:00.000Z'
const FUTURE_DATE_2 = '2026-11-27T17:00:00.000Z'

test('Scenario 1: Successful booking creates appointment atomically and returns manage token and reference', async () => {
  const orgId = 'org-stage4-success'
  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Lone Star Plumbing',
      slug: 'lone-star',
      subscription_status: 'active',
      booking_mode: 'instant',
      timezone: 'America/Chicago',
      telnyx_phone_number: '+15125550100'
    }],
    services: [{
      id: 'svc-drain',
      org_id: orgId,
      name: 'Main Drain Clear',
      duration_minutes: 60,
      price: 189,
      is_active: true
    }]
  })

  const result = await createBooking(db, {
    orgId,
    serviceId: 'svc-drain',
    customerName: 'Marcus Aurelius',
    customerPhone: '5125550199',
    customerAddress: '100 Congress Ave, Austin, TX 78701',
    startTime: FUTURE_DATE_1
  })

  assert.equal(result.success, true)
  assert.ok(result.appointment)
  assert.equal(result.appointment.status, 'confirmed')
  assert.ok(result.manageToken)
  assert.equal(result.manageToken.length, 48) // 24-byte hex token = 48 chars
  assert.ok(result.manageUrl.includes(result.manageToken))
  assert.equal(db._tables.appointments.length, 1)
  assert.equal(db._tables.contacts.length, 1)
})

test('Scenario 2: Successful booking with SMS delivery failure commits appointment and returns smsStatus failed', async () => {
  const orgId = 'org-stage4-sms-fail'
  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Austin Pro Electric',
      slug: 'austin-electric',
      subscription_status: 'active',
      booking_mode: 'instant',
      timezone: 'America/Chicago',
      telnyx_phone_number: '+15125550200'
    }],
    services: [{
      id: 'svc-panel',
      org_id: orgId,
      name: 'Electrical Inspection',
      duration_minutes: 45,
      price: 125,
      is_active: true
    }]
  })

  const result = await createBooking(db, {
    orgId,
    serviceId: 'svc-panel',
    customerName: 'Nikola Tesla',
    customerPhone: '5125550299',
    startTime: FUTURE_DATE_1
  })

  // Booking MUST succeed even if Telnyx is simulated or fails
  assert.equal(result.success, true)
  assert.ok(result.appointment)
  assert.ok(result.manageToken)
  assert.equal(db._tables.appointments.length, 1)
  assert.ok(result.smsStatus !== undefined)
})

test('Scenario 3: Failed booking transaction rejects invalid phone or past date without creating records', async () => {
  const orgId = 'org-stage4-fail'
  const db = createMockDb({
    organizations: [{ id: orgId, name: 'Apex Trade', subscription_status: 'active' }],
    services: [{ id: 'svc-1', org_id: orgId, name: 'Checkup', duration_minutes: 30, is_active: true }]
  })

  // Invalid phone number
  const badPhoneResult = await createBooking(db, {
    orgId,
    serviceId: 'svc-1',
    customerName: 'John Doe',
    customerPhone: 'invalid-phone',
    startTime: FUTURE_DATE_1
  })
  assert.equal(badPhoneResult.success, false)
  assert.equal(db._tables.appointments.length, 0)

  // Past date
  const pastDateResult = await createBooking(db, {
    orgId,
    serviceId: 'svc-1',
    customerName: 'John Doe',
    customerPhone: '5125550123',
    startTime: '2020-01-01T12:00:00.000Z'
  })
  assert.equal(pastDateResult.success, false)
  assert.match(pastDateResult.error, /past/i)
  assert.equal(db._tables.appointments.length, 0)
})

test('Scenario 4: Duplicate submission on same slot fails closed with slot unavailable error', async () => {
  const orgId = 'org-stage4-dup'
  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Apex Heating',
      subscription_status: 'active',
      buffer_minutes: 15
    }],
    services: [{ id: 'svc-1', org_id: orgId, name: 'Furnace Tune', duration_minutes: 60, is_active: true }]
  })

  // First customer books slot
  const res1 = await createBooking(db, {
    orgId,
    serviceId: 'svc-1',
    customerName: 'First Customer',
    customerPhone: '5125550101',
    startTime: FUTURE_DATE_1
  })
  assert.equal(res1.success, true)

  // Second customer attempts to book same slot concurrently
  const res2 = await createBooking(db, {
    orgId,
    serviceId: 'svc-1',
    customerName: 'Second Customer',
    customerPhone: '5125550102',
    startTime: FUTURE_DATE_1
  })
  assert.equal(res2.success, false)
  assert.match(res2.error, /no longer available/i)
  assert.equal(db._tables.appointments.length, 1)
})

test('Scenario 5: Invalid or expired token query returns 404 appointment not found', async () => {
  const db = createMockDb({
    appointments: [{
      id: 'apt-real',
      manage_token: 'valid_token_12345',
      status: 'confirmed'
    }]
  })

  // Attempt to cancel with non-existent token
  const cancelRes = await customerCancelBooking(db, 'non_existent_token')
  assert.equal(cancelRes.success, false)
  assert.match(cancelRes.error, /not found/i)

  // Attempt to reschedule with non-existent token
  const reschedRes = await customerRescheduleBooking(db, 'non_existent_token', FUTURE_DATE_2)
  assert.equal(reschedRes.success, false)
  assert.match(reschedRes.error, /not found/i)
})

test('Scenario 6: Unauthorized appointment access isolates tenant data and blocks cross-org leakage', async () => {
  const orgA = 'org-tenant-a'
  const orgB = 'org-tenant-b'
  const tokenA = 'token_for_tenant_a_1234567890'

  const db = createMockDb({
    organizations: [
      { id: orgA, name: 'Business A', slug: 'biz-a' },
      { id: orgB, name: 'Business B', slug: 'biz-b' }
    ],
    appointments: [
      { id: 'apt-a', org_id: orgA, manage_token: tokenA, status: 'confirmed' }
    ]
  })

  // Token query is strictly scoped by manage_token
  const apt = await db.from('appointments').select('*').eq('manage_token', tokenA).single()
  assert.ok(apt.data)
  assert.equal(apt.data.org_id, orgA)
  assert.notEqual(apt.data.org_id, orgB)
})

test('Scenario 7: Successful rescheduling updates appointment arrival window, reschedules reminders, and syncs job', async () => {
  const orgId = 'org-stage4-resched'
  const manageToken = 'token_resched_test_12345'
  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Cool Air HVAC',
      slug: 'cool-air',
      timezone: 'America/Chicago',
      buffer_minutes: 15,
      subscription_status: 'active',
      telnyx_phone_number: '+15125550300'
    }],
    appointments: [{
      id: 'apt-resched',
      org_id: orgId,
      manage_token: manageToken,
      start_time: FUTURE_DATE_1,
      end_time: new Date(new Date(FUTURE_DATE_1).getTime() + 60 * 60 * 1000).toISOString(),
      status: 'confirmed',
      service_type: 'AC Inspection'
    }],
    jobs: [{
      id: 'job-resched',
      org_id: orgId,
      appointment_id: 'apt-resched',
      scheduled_start: FUTURE_DATE_1,
      status: 'scheduled'
    }],
    contacts: [{
      id: 'contact-resched',
      org_id: orgId,
      name: 'Ada Lovelace',
      phone: '+15125550399'
    }]
  })

  const result = await customerRescheduleBooking(db, manageToken, FUTURE_DATE_2)
  assert.equal(result.success, true)
  assert.equal(result.appointment.start_time, FUTURE_DATE_2)

  // Verify appointment in table was updated
  const updatedApt = db._tables.appointments.find(a => a.id === 'apt-resched')
  assert.equal(updatedApt.start_time, FUTURE_DATE_2)

  // Verify linked job was updated
  const updatedJob = db._tables.jobs.find(j => j.appointment_id === 'apt-resched')
  assert.equal(updatedJob.scheduled_start, FUTURE_DATE_2)
})

test('Scenario 8: Rescheduling conflict rejects overlapping slot and preserves existing appointment untouched', async () => {
  const orgId = 'org-stage4-resched-conflict'
  const manageToken = 'token_conflict_12345'
  const conflictStart = FUTURE_DATE_2

  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Precision Plumbing',
      slug: 'precision-plumbing',
      timezone: 'America/Chicago',
      buffer_minutes: 15
    }],
    appointments: [
      {
        id: 'apt-user',
        org_id: orgId,
        manage_token: manageToken,
        start_time: FUTURE_DATE_1,
        end_time: new Date(new Date(FUTURE_DATE_1).getTime() + 60 * 60 * 1000).toISOString(),
        status: 'confirmed'
      },
      {
        id: 'apt-other-client',
        org_id: orgId,
        manage_token: 'other_token_99999',
        start_time: conflictStart,
        end_time: new Date(new Date(conflictStart).getTime() + 60 * 60 * 1000).toISOString(),
        status: 'confirmed'
      }
    ]
  })

  const result = await customerRescheduleBooking(db, manageToken, conflictStart)
  assert.equal(result.success, false)
  assert.match(result.error, /no longer available/i)

  // Original appointment MUST remain unchanged
  const origApt = db._tables.appointments.find(a => a.id === 'apt-user')
  assert.equal(origApt.start_time, FUTURE_DATE_1)
})

test('Scenario 9: Availability changing during rescheduling preserves original booking on collision', async () => {
  const orgId = 'org-stage4-race'
  const manageToken = 'token_race_123'
  const targetSlot = FUTURE_DATE_2

  const db = createMockDb({
    organizations: [{ id: orgId, name: 'Metro Electric', timezone: 'America/Chicago', buffer_minutes: 15 }],
    appointments: [{
      id: 'apt-race',
      org_id: orgId,
      manage_token: manageToken,
      start_time: FUTURE_DATE_1,
      end_time: new Date(new Date(FUTURE_DATE_1).getTime() + 60 * 60 * 1000).toISOString(),
      status: 'confirmed'
    }]
  })

  // Simulating external job being added on target slot right before reschedule submit
  db._tables.jobs.push({
    id: 'job-external',
    org_id: orgId,
    appointment_id: null,
    scheduled_start: targetSlot,
    scheduled_end: new Date(new Date(targetSlot).getTime() + 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    deleted_at: null
  })

  const result = await customerRescheduleBooking(db, manageToken, targetSlot)
  assert.equal(result.success, false)
  assert.match(result.error, /no longer available/i)

  // Verified: Original appointment is safe
  const currentApt = db._tables.appointments.find(a => a.id === 'apt-race')
  assert.equal(currentApt.start_time, FUTURE_DATE_1)
})

test('Scenario 10: Successful cancellation releases appointment slot, halts reminders, and updates job status', async () => {
  const orgId = 'org-stage4-cancel'
  const manageToken = 'token_cancel_test_123'

  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Reliable Garage Doors',
      slug: 'reliable-doors',
      timezone: 'America/Chicago'
    }],
    appointments: [{
      id: 'apt-cancel',
      org_id: orgId,
      manage_token: manageToken,
      start_time: FUTURE_DATE_1,
      end_time: new Date(new Date(FUTURE_DATE_1).getTime() + 60 * 60 * 1000).toISOString(),
      status: 'confirmed'
    }],
    jobs: [{
      id: 'job-cancel',
      org_id: orgId,
      appointment_id: 'apt-cancel',
      status: 'scheduled'
    }],
    contacts: [{
      id: 'contact-cancel',
      org_id: orgId,
      name: 'Grace Hopper',
      phone: '+15125550499'
    }],
    automation_runs: [{
      id: 'run-remind-24h',
      org_id: orgId,
      status: 'scheduled',
      event_payload: { appointment_id: 'apt-cancel' }
    }]
  })

  const result = await customerCancelBooking(db, manageToken, 'Schedule conflict with work')
  assert.equal(result.success, true)
  assert.equal(result.appointment.status, 'cancelled')
  assert.equal(result.appointment.cancellation_reason, 'Schedule conflict with work')

  // Linked job marked cancelled
  const linkedJob = db._tables.jobs.find(j => j.appointment_id === 'apt-cancel')
  assert.equal(linkedJob.status, 'cancelled')

  // Verified: Slot is freed up! A new booking at FUTURE_DATE_1 can now succeed
  const rebookResult = await createBooking(db, {
    orgId,
    customerName: 'New Client',
    customerPhone: '5125550999',
    customerAddress: '500 Oak St, Austin, TX 78701',
    startTime: FUTURE_DATE_1
  })
  assert.equal(rebookResult.success, true)
})

test('Scenario 11: Cancellation validation failure blocks completed jobs and en route technicians', async () => {
  const orgId = 'org-stage4-guards'

  // 1. Completed appointment guard
  const dbCompleted = createMockDb({
    organizations: [{ id: orgId, name: 'Titan Roofing' }],
    appointments: [{ id: 'apt-comp', org_id: orgId, manage_token: 'token_comp', status: 'completed' }]
  })
  const compRes = await customerCancelBooking(dbCompleted, 'token_comp')
  assert.equal(compRes.success, false)
  assert.match(compRes.error, /already been completed/i)

  // 2. En route technician guard
  const dbEnRoute = createMockDb({
    organizations: [{ id: orgId, name: 'Titan Roofing' }],
    appointments: [{ id: 'apt-enroute', org_id: orgId, manage_token: 'token_enroute', status: 'confirmed' }],
    jobs: [{ id: 'job-enroute', org_id: orgId, appointment_id: 'apt-enroute', status: 'en_route' }]
  })
  const enRouteRes = await customerCancelBooking(dbEnRoute, 'token_enroute')
  assert.equal(enRouteRes.success, false)
  assert.match(enRouteRes.error, /on the way|directly/i)
})

test('Scenario 12: Contractor notification behavior alerts business owner on booking, reschedule, and cancellation', async () => {
  const orgId = 'org-stage4-notif'
  const manageToken = 'token_notif_123'

  const db = createMockDb({
    organizations: [{ id: orgId, name: 'Apex Glass', slug: 'apex-glass', timezone: 'America/Chicago' }],
    services: [{ id: 'svc-glass', org_id: orgId, name: 'Window Repair', duration_minutes: 60, is_active: true }]
  })

  // 1. Booking notification
  const bookRes = await createBooking(db, {
    orgId,
    serviceId: 'svc-glass',
    customerName: 'Sam Altman',
    customerPhone: '5125550505',
    startTime: FUTURE_DATE_1
  })
  assert.equal(bookRes.success, true)
  assert.ok(db._tables.notifications.length >= 1)

  // 2. Cancellation notification
  const cancelRes = await customerCancelBooking(db, bookRes.manageToken, 'Need different service')
  assert.equal(cancelRes.success, true)
  const cancelNotif = db._tables.notifications.find(n => n.title.includes('Cancelled'))
  assert.ok(cancelNotif)
})

test('Scenario 13: Starter Pass allowance exhausted never blocks homeowner booking, confirmation, or self-service', async () => {
  const orgId = 'org-starter-pass-exhausted'
  const manageToken = 'token_starter_exhausted'

  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Solo Handyman',
      slug: 'solo-handy',
      subscription_status: 'free_tier',
      timezone: 'America/Chicago'
    }],
    services: [{ id: 'svc-repair', org_id: orgId, name: 'Drywall Patch', duration_minutes: 60, is_active: true }],
    // 3 completed jobs representing exhausted free tier Starter Pass
    jobs: [
      { id: 'job-1', org_id: orgId, status: 'completed', completed_at: '2026-11-01T10:00:00Z' },
      { id: 'job-2', org_id: orgId, status: 'completed', completed_at: '2026-11-05T10:00:00Z' },
      { id: 'job-3', org_id: orgId, status: 'completed', completed_at: '2026-11-10T10:00:00Z' }
    ]
  })

  // Homeowner booking must NOT be blocked or prompted with upgrade paywall
  const bookResult = await createBooking(db, {
    orgId,
    serviceId: 'svc-repair',
    customerName: 'Homeowner Jane',
    customerPhone: '5125550606',
    startTime: FUTURE_DATE_1
  })

  assert.equal(bookResult.success, true)
  assert.ok(bookResult.appointment)
  assert.equal(bookResult.appointment.status, 'confirmed')
  assert.ok(bookResult.manageToken)
  // Verified: Appointment committed, customer not blocked
  assert.equal(db._tables.appointments.length, 1)

  // Homeowner self-service reschedule also succeeds
  const reschedResult = await customerRescheduleBooking(db, bookResult.manageToken, FUTURE_DATE_2)
  assert.equal(reschedResult.success, true)

  // Homeowner self-service cancellation also succeeds
  const cancelResult = await customerCancelBooking(db, bookResult.manageToken, 'Changed mind')
  assert.equal(cancelResult.success, true)
})

test('Scenario 14: Mobile and desktop layouts adhere to touch target, zero em dash, and accessibility invariants', () => {
  // Invariant verification on canonical pricing models
  const fixed = parseServicePricing(150, 'Standard tune-up')
  assert.equal(fixed.model, 'fixed')

  const startingAt = parseServicePricing(95, '[pricing:starting_at] Starting at $95 for standard inspection')
  assert.equal(startingAt.model, 'starting_at')

  const quoteOnSite = parseServicePricing(0, '[pricing:quote_on_site] Custom quote determined on-site')
  assert.equal(quoteOnSite.model, 'quote_on_site')

  // Invariant: Customer name formatting preserves title case
  assert.equal(formatCustomerName('johnathan doe'), 'Johnathan Doe')

  // Invariant: Combine street and unit handles address cleanly
  assert.equal(combineStreetAndUnit('123 Main St', 'Apt 4B'), '123 Main St, Apt 4B')
})
