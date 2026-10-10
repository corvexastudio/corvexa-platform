import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  createBooking,
  customerCancelBooking,
  customerRescheduleBooking,
  ownerUpdateBookingStatus
} from '../src/lib/booking/booking-manager.ts'

/**
 * Enhanced Mock DB with simulated PostgreSQL GiST Exclusion Constraint engine:
 * Emulates: EXCLUDE USING gist (org_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)
 * WHERE (status IN ('requested', 'confirmed', 'scheduled') AND deleted_at IS NULL)
 */
function createMockGiSTDatabase(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    services: initialState.services || [],
    appointments: initialState.appointments || [],
    contacts: initialState.contacts || [],
    leads: initialState.leads || [],
    automation_runs: initialState.automation_runs || [],
    automation_settings: initialState.automation_settings || [],
    profiles: initialState.profiles || []
  }

  // Helper to check range overlap with [) semantics
  // [startA, endA) && [startB, endB) <=> startA < endB && startB < endA
  function rangesOverlap(startA, endA, startB, endB) {
    const sA = new Date(startA).getTime()
    const eA = new Date(endA).getTime()
    const sB = new Date(startB).getTime()
    const eB = new Date(endB).getTime()
    return sA < eB && sB < eA
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
        order: () => queryBuilder,
        limit: () => queryBuilder,
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
            // Emulate PostgreSQL GiST exclusion constraint on appointments
            if (tableName === 'appointments') {
              const activeStatuses = ['requested', 'confirmed', 'scheduled']
              const isCandidateActive = activeStatuses.includes(row.status) && !row.deleted_at

              if (isCandidateActive) {
                const conflict = (tables.appointments || []).find((existing) => {
                  const isExistingActive = activeStatuses.includes(existing.status) && !existing.deleted_at
                  if (!isExistingActive) return false
                  // Must be same organization
                  if (existing.org_id !== row.org_id) return false
                  // Check [) range overlap
                  const existingEnd = existing.end_time || new Date(new Date(existing.start_time).getTime() + 3600000).toISOString()
                  const candidateEnd = row.end_time || new Date(new Date(row.start_time).getTime() + 3600000).toISOString()
                  return rangesOverlap(existing.start_time, existingEnd, row.start_time, candidateEnd)
                })

                if (conflict) {
                  const errorObj = {
                    code: '23P01',
                    message: 'conflicting key value violates exclusion constraint "appointments_no_overlapping_bookings"'
                  }
                  return {
                    data: null,
                    error: errorObj,
                    select: () => ({
                      single: async () => ({ data: null, error: errorObj }),
                      maybeSingle: async () => ({ data: null, error: errorObj })
                    }),
                    then: (resolve, reject) => Promise.resolve({ data: null, error: errorObj }).then(resolve, reject)
                  }
                }
              }
            }

            const newRow = {
              id: row.id || `appt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
            then: (resolve, reject) => Promise.resolve({ data: lastInserted, error: null }).then(resolve, reject)
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
              single: async () => {
                const tableData = tables[tableName] || []
                const target = tableData.find((row) => updateFilters.every((fn) => fn(row)))
                if (!target) return { data: null, error: new Error('Row not found') }

                // Check GiST exclusion on update if appointment time/status changed
                if (tableName === 'appointments') {
                  const candidate = { ...target, ...updates }
                  const activeStatuses = ['requested', 'confirmed', 'scheduled']
                  if (activeStatuses.includes(candidate.status) && !candidate.deleted_at) {
                    const conflict = tableData.find((other) => {
                      if (other.id === target.id) return false
                      if (other.org_id !== candidate.org_id) return false
                      if (!activeStatuses.includes(other.status) || other.deleted_at) return false

                      const otherEnd = other.end_time || new Date(new Date(other.start_time).getTime() + 3600000).toISOString()
                      const candEnd = candidate.end_time || new Date(new Date(candidate.start_time).getTime() + 3600000).toISOString()
                      return rangesOverlap(other.start_time, otherEnd, candidate.start_time, candEnd)
                    })

                    if (conflict) {
                      return {
                        data: null,
                        error: {
                          code: '23P01',
                          message: 'conflicting key value violates exclusion constraint "appointments_no_overlapping_bookings"'
                        }
                      }
                    }
                  }
                }

                Object.assign(target, updates)
                return { data: target, error: null }
              }
            }),
            then: (resolve, reject) => {
              const tableData = tables[tableName] || []
              const target = tableData.find((row) => updateFilters.every((fn) => fn(row)))
              if (target) Object.assign(target, updates)
              return Promise.resolve({ data: target || null, error: null }).then(resolve, reject)
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

// -----------------------------------------------------------------------------
// P1-02 TESTS
// -----------------------------------------------------------------------------

const ORG_A_ID = 'org-alpha-1111'
const ORG_B_ID = 'org-bravo-2222'

test('TEST 1: Two appointments with identical start/end cannot both succeed in same org', async () => {
  const db = createMockGiSTDatabase({
    organizations: [{ id: ORG_A_ID, name: 'Alpha Plumbing', booking_mode: 'instant' }],
    services: [{ id: 'svc-1', org_id: ORG_A_ID, name: 'General Service', duration_minutes: 60, is_active: true }]
  })

  const slotStart = new Date(Date.now() + 48 * 3600 * 1000).toISOString()

  const res1 = await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-1',
    customerName: 'First Caller',
    customerPhone: '+12145550101',
    customerAddress: '100 Main St',
    startTime: slotStart
  })
  assert.strictEqual(res1.success, true, 'First booking should succeed')

  const res2 = await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-1',
    customerName: 'Second Caller',
    customerPhone: '+12145550102',
    customerAddress: '100 Main St',
    startTime: slotStart
  })
  assert.strictEqual(res2.success, false, 'Second booking on identical slot must fail')
  assert.match(res2.error, /no longer available/)
  assert.strictEqual(db._tables.appointments.length, 1, 'Only 1 appointment should exist in database')
})

test('TEST 2: 10:00–11:00 and 10:30–11:30 cannot coexist for the same organization (overlapping intervals)', async () => {
  const baseTime = Date.now() + 48 * 3600 * 1000
  const time10_00 = new Date(baseTime).toISOString()
  const time10_30 = new Date(baseTime + 30 * 60 * 1000).toISOString()

  const db = createMockGiSTDatabase({
    organizations: [{ id: ORG_A_ID, name: 'Alpha Plumbing', booking_mode: 'instant', buffer_minutes: 0 }],
    services: [{ id: 'svc-60', org_id: ORG_A_ID, name: '60 Min Repair', duration_minutes: 60, is_active: true }]
  })

  const resA = await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-60',
    customerName: 'Customer A',
    customerPhone: '+12145550101',
    customerAddress: '100 Main St',
    startTime: time10_00
  })
  assert.strictEqual(resA.success, true)

  const resB = await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-60',
    customerName: 'Customer B',
    customerPhone: '+12145550102',
    customerAddress: '200 Oak St',
    startTime: time10_30
  })
  assert.strictEqual(resB.success, false, 'Overlapping interval (10:30-11:30) must be rejected')
  assert.match(resB.error, /no longer available/)
  assert.strictEqual(db._tables.appointments.length, 1)
})

test('TEST 3: 10:00–11:00 and 11:00–12:00 CAN coexist with [) end-exclusive range semantics', async () => {
  const baseTime = Date.now() + 48 * 3600 * 1000
  const time10_00 = new Date(baseTime).toISOString()
  const time11_00 = new Date(baseTime + 60 * 60 * 1000).toISOString()

  const db = createMockGiSTDatabase({
    organizations: [{ id: ORG_A_ID, name: 'Alpha Plumbing', booking_mode: 'instant', buffer_minutes: 0 }],
    services: [{ id: 'svc-60', org_id: ORG_A_ID, name: '60 Min Repair', duration_minutes: 60, is_active: true }]
  })

  const res1 = await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-60',
    customerName: 'Customer 1',
    customerPhone: '+12145550101',
    customerAddress: '100 Main St',
    startTime: time10_00
  })
  assert.strictEqual(res1.success, true)

  const res2 = await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-60',
    customerName: 'Customer 2',
    customerPhone: '+12145550102',
    customerAddress: '200 Oak St',
    startTime: time11_00
  })
  assert.strictEqual(res2.success, true, 'Back-to-back appointment starting exactly at 11:00 must be allowed')
  assert.strictEqual(db._tables.appointments.length, 2, 'Both non-overlapping appointments must exist')
})

test('TEST 4: Two overlapping appointments belonging to DIFFERENT organizations are allowed', async () => {
  const baseTime = Date.now() + 48 * 3600 * 1000
  const time10_00 = new Date(baseTime).toISOString()

  const db = createMockGiSTDatabase({
    organizations: [
      { id: ORG_A_ID, name: 'Alpha Plumbing', booking_mode: 'instant' },
      { id: ORG_B_ID, name: 'Bravo HVAC', booking_mode: 'instant' }
    ],
    services: [
      { id: 'svc-a', org_id: ORG_A_ID, name: 'Alpha Service', duration_minutes: 60, is_active: true },
      { id: 'svc-b', org_id: ORG_B_ID, name: 'Bravo Service', duration_minutes: 60, is_active: true }
    ]
  })

  const resOrgA = await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-a',
    customerName: 'Customer Alpha',
    customerPhone: '+12145550101',
    customerAddress: '100 Main St',
    startTime: time10_00
  })
  assert.strictEqual(resOrgA.success, true)

  // Same start time (10:00) and duration, but for ORG_B
  const resOrgB = await createBooking(db, {
    orgId: ORG_B_ID,
    serviceId: 'svc-b',
    customerName: 'Customer Bravo',
    customerPhone: '+12145550102',
    customerAddress: '200 Elm St',
    startTime: time10_00
  })
  assert.strictEqual(resOrgB.success, true, 'Different organizations must be allowed to book overlapping slots')
  assert.strictEqual(db._tables.appointments.length, 2)
})

test('TEST 5: Cancelled appointments do not block a new appointment on the same slot', async () => {
  const baseTime = Date.now() + 48 * 3600 * 1000
  const time10_00 = new Date(baseTime).toISOString()

  const db = createMockGiSTDatabase({
    organizations: [{ id: ORG_A_ID, name: 'Alpha Plumbing', booking_mode: 'instant' }],
    services: [{ id: 'svc-1', org_id: ORG_A_ID, name: 'General Service', duration_minutes: 60, is_active: true }]
  })

  // 1. Initial booking
  const res1 = await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-1',
    customerName: 'Original Customer',
    customerPhone: '+12145550101',
    customerAddress: '100 Main St',
    startTime: time10_00
  })
  assert.strictEqual(res1.success, true)
  assert.ok(res1.manageToken)

  // 2. Customer cancels appointment
  const cancelRes = await customerCancelBooking(db, res1.manageToken, 'Schedule conflict')
  assert.strictEqual(cancelRes.success, true)
  assert.strictEqual(db._tables.appointments[0].status, 'cancelled')

  // 3. New customer books the freed slot
  const res2 = await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-1',
    customerName: 'New Customer',
    customerPhone: '+12145550102',
    customerAddress: '100 Main St',
    startTime: time10_00
  })
  assert.strictEqual(res2.success, true, 'Cancelled slot must be immediately bookable')
  assert.strictEqual(db._tables.appointments.length, 2)
})

test('TEST 6: Completed and no-show appointments do not block future appointments', async () => {
  const baseTime = Date.now() + 48 * 3600 * 1000
  const time10_00 = new Date(baseTime).toISOString()
  const time11_00 = new Date(baseTime + 3600000).toISOString()

  const db = createMockGiSTDatabase({
    organizations: [{ id: ORG_A_ID, name: 'Alpha Plumbing', booking_mode: 'instant' }],
    services: [{ id: 'svc-1', org_id: ORG_A_ID, name: 'General Service', duration_minutes: 60, is_active: true }],
    appointments: [
      {
        id: 'appt-completed',
        org_id: ORG_A_ID,
        start_time: time10_00,
        end_time: time11_00,
        status: 'completed'
      }
    ]
  })

  const res = await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-1',
    customerName: 'Next Customer',
    customerPhone: '+12145550199',
    customerAddress: '123 Test Rd',
    startTime: time10_00
  })

  assert.strictEqual(res.success, true, 'Completed appointments do not block active bookings')
})

test('TEST 7: Soft-deleted appointments (deleted_at IS NOT NULL) do not block bookings', async () => {
  const baseTime = Date.now() + 48 * 3600 * 1000
  const time10_00 = new Date(baseTime).toISOString()
  const time11_00 = new Date(baseTime + 3600000).toISOString()

  const db = createMockGiSTDatabase({
    organizations: [{ id: ORG_A_ID, name: 'Alpha Plumbing', booking_mode: 'instant' }],
    services: [{ id: 'svc-1', org_id: ORG_A_ID, name: 'General Service', duration_minutes: 60, is_active: true }],
    appointments: [
      {
        id: 'appt-deleted',
        org_id: ORG_A_ID,
        start_time: time10_00,
        end_time: time11_00,
        status: 'confirmed',
        deleted_at: new Date().toISOString()
      }
    ]
  })

  const res = await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-1',
    customerName: 'Fresh Customer',
    customerPhone: '+12145550188',
    customerAddress: '456 Test Rd',
    startTime: time10_00
  })

  assert.strictEqual(res.success, true, 'Soft-deleted appointments do not block bookings')
})

test('TEST 8: Concurrent overlapping booking attempts result in exactly one successful booking', async () => {
  const baseTime = Date.now() + 48 * 3600 * 1000
  const time10_00 = new Date(baseTime).toISOString()
  const time10_30 = new Date(baseTime + 30 * 60 * 1000).toISOString()

  const db = createMockGiSTDatabase({
    organizations: [{ id: ORG_A_ID, name: 'Alpha Plumbing', booking_mode: 'instant', buffer_minutes: 0 }],
    services: [{ id: 'svc-1', org_id: ORG_A_ID, name: 'General Service', duration_minutes: 60, is_active: true }]
  })

  // Two truly simultaneous booking attempts targeting overlapping times (10:00-11:00 and 10:30-11:30)
  const [result1, result2] = await Promise.all([
    createBooking(db, {
      orgId: ORG_A_ID,
      serviceId: 'svc-1',
      customerName: 'Concurrent User 1',
      customerPhone: '+12145550111',
      customerAddress: '100 Main St',
      startTime: time10_00
    }),
    createBooking(db, {
      orgId: ORG_A_ID,
      serviceId: 'svc-1',
      customerName: 'Concurrent User 2',
      customerPhone: '+12145550122',
      customerAddress: '200 Elm St',
      startTime: time10_30
    })
  ])

  const successes = [result1, result2].filter((r) => r.success)
  const failures = [result1, result2].filter((r) => !r.success)

  assert.strictEqual(successes.length, 1, 'Exactly one concurrent booking must succeed')
  assert.strictEqual(failures.length, 1, 'Exactly one concurrent booking must fail')
  assert.match(failures[0].error, /no longer available/)
  assert.strictEqual(db._tables.appointments.length, 1, 'Database must contain exactly 1 appointment')
})

test('TEST 9: Booking API translates PostgreSQL conflict into customer-facing slot-unavailable response', async () => {
  const baseTime = Date.now() + 48 * 3600 * 1000
  const time10_00 = new Date(baseTime).toISOString()

  const db = createMockGiSTDatabase({
    organizations: [{ id: ORG_A_ID, name: 'Alpha Plumbing', booking_mode: 'instant' }],
    services: [{ id: 'svc-1', org_id: ORG_A_ID, name: 'General Service', duration_minutes: 60, is_active: true }]
  })

  await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-1',
    customerName: 'Booked Customer',
    customerPhone: '+12145550101',
    customerAddress: '100 Main St',
    startTime: time10_00
  })

  const secondAttempt = await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-1',
    customerName: 'Conflicting Customer',
    customerPhone: '+12145550102',
    customerAddress: '100 Main St',
    startTime: time10_00
  })

  assert.strictEqual(secondAttempt.success, false)
  assert.strictEqual(secondAttempt.error, 'This time slot is no longer available. Please select another time.')
})

test('TEST 10: Raw PostgreSQL constraint details or 23P01 codes are never returned to client', async () => {
  const baseTime = Date.now() + 48 * 3600 * 1000
  const time10_00 = new Date(baseTime).toISOString()

  const db = createMockGiSTDatabase({
    organizations: [{ id: ORG_A_ID, name: 'Alpha Plumbing', booking_mode: 'instant' }],
    services: [{ id: 'svc-1', org_id: ORG_A_ID, name: 'General Service', duration_minutes: 60, is_active: true }]
  })

  await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-1',
    customerName: 'Booked Customer',
    customerPhone: '+12145550101',
    customerAddress: '100 Main St',
    startTime: time10_00
  })

  const conflictAttempt = await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-1',
    customerName: 'Conflicting Customer',
    customerPhone: '+12145550102',
    customerAddress: '100 Main St',
    startTime: time10_00
  })

  assert.strictEqual(conflictAttempt.success, false)
  assert.doesNotMatch(conflictAttempt.error, /23P01/, 'Must not leak error code')
  assert.doesNotMatch(conflictAttempt.error, /exclusion/i, 'Must not leak exclusion keyword')
  assert.doesNotMatch(conflictAttempt.error, /appointments_no_overlapping_bookings/, 'Must not leak constraint name')
  assert.doesNotMatch(conflictAttempt.error, /gist/i, 'Must not leak index details')
})

test('TEST 11: Rescheduling into an overlapping interval is rejected while valid appointment remains intact', async () => {
  const baseTime = Date.now() + 48 * 3600 * 1000
  const time10_00 = new Date(baseTime).toISOString()
  const time11_00 = new Date(baseTime + 3600000).toISOString()
  const time10_30 = new Date(baseTime + 1800000).toISOString()

  const db = createMockGiSTDatabase({
    organizations: [{ id: ORG_A_ID, name: 'Alpha Plumbing', booking_mode: 'instant', buffer_minutes: 0 }],
    services: [{ id: 'svc-1', org_id: ORG_A_ID, name: 'General Service', duration_minutes: 60, is_active: true }]
  })

  // Appointment A: 10:00 - 11:00
  await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-1',
    customerName: 'Customer A',
    customerPhone: '+12145550101',
    customerAddress: '100 Main St',
    startTime: time10_00
  })

  // Appointment B: 11:00 - 12:00
  const resB = await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-1',
    customerName: 'Customer B',
    customerPhone: '+12145550102',
    customerAddress: '200 Elm St',
    startTime: time11_00
  })

  // Attempt to reschedule B to 10:30 (overlaps with A: 10:00-11:00)
  const reschedResult = await customerRescheduleBooking(db, resB.manageToken, time10_30)
  assert.strictEqual(reschedResult.success, false, 'Rescheduling to overlapping slot must be rejected')
  assert.match(reschedResult.error, /no longer available/)

  // Verify Appointment B remains unchanged at 11:00
  const apptB = db._tables.appointments.find((a) => a.manage_token === resB.manageToken)
  assert.strictEqual(apptB.start_time, time11_00, 'Original start time must be preserved')
})

test('TEST 12: Migration 32 defines PostgreSQL GiST exclusion constraint and pre-flight conflict check', () => {
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/32_prevent_overlapping_appointments.sql')
  assert.ok(fs.existsSync(migrationPath), 'Migration 32 must exist')
  const content = fs.readFileSync(migrationPath, 'utf8')

  assert.match(content, /CREATE EXTENSION IF NOT EXISTS btree_gist/, 'Must enable btree_gist extension')
  assert.match(content, /appointments_no_overlapping_bookings/, 'Must name constraint appointments_no_overlapping_bookings')
  assert.match(content, /EXCLUDE USING gist/i, 'Must use GiST exclusion constraint')
  assert.match(content, /org_id WITH =/i, 'Must enforce multi-tenant isolation via org_id WITH =')
  assert.match(content, /tstzrange\(start_time, end_time, '\[\)'\) WITH &&/i, 'Must use [) range semantics with && operator')
  assert.match(content, /WHERE \(status IN \('requested', 'confirmed', 'scheduled'\) AND deleted_at IS NULL\)/i, 'Must apply predicate to active statuses only')
  assert.match(content, /conflict_count/i, 'Must perform diagnostic pre-check on existing overlapping data')
})
