import test from 'node:test'
import assert from 'node:assert'
import {
  calculateAvailableSlots,
  doesIntervalOverlap,
  localDateTimeToUtc,
  formatSlotDisplayTime,
  getDayOfWeekName
} from '../src/lib/booking/availability.ts'
import {
  createBooking,
  customerCancelBooking,
  customerRescheduleBooking,
  ownerUpdateBookingStatus
} from '../src/lib/booking/booking-manager.ts'

/**
 * In-memory Supabase mock harness for booking engine tests
 */
function createMockBookingDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    services: initialState.services || [],
    appointments: initialState.appointments || [],
    contacts: initialState.contacts || [],
    leads: initialState.leads || [],
    automation_runs: initialState.automation_runs || [],
    notifications: initialState.notifications || [],
    messages: initialState.messages || [],
    activity_logs: initialState.activity_logs || []
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
            then: (resolve, reject) => {
              return Promise.resolve({ data: lastInserted, error: null }).then(resolve, reject)
            }
          }
        },
        update: (updates) => {
          const updateFilters = [...filters]
          const updateBuilder = {
            eq: (col, val) => {
              updateFilters.push((row) => row[col] === val)
              return updateBuilder
            },
            in: (col, arr) => {
              updateFilters.push((row) => arr.includes(row[col]))
              return updateBuilder
            },
            select: () => ({
              single: async () => {
                let updated = null
                const tableData = tables[tableName] || []
                for (const row of tableData) {
                  if (updateFilters.every((fn) => fn(row))) {
                    Object.assign(row, updates)
                    updated = row
                  }
                }
                return { data: updated, error: null }
              },
              maybeSingle: async () => {
                let updated = null
                const tableData = tables[tableName] || []
                for (const row of tableData) {
                  if (updateFilters.every((fn) => fn(row))) {
                    Object.assign(row, updates)
                    updated = row
                  }
                }
                return { data: updated, error: null }
              }
            }),
            then: (resolve, reject) => {
              let updated = null
              const tableData = tables[tableName] || []
              for (const row of tableData) {
                if (updateFilters.every((fn) => fn(row))) {
                  Object.assign(row, updates)
                  updated = row
                }
              }
              return Promise.resolve({ data: updated, error: null }).then(resolve, reject)
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

// Standard test organization booking configuration
const mockOrgConfig = {
  timezone: 'America/Chicago',
  business_hours: {
    monday: { open: '08:00', close: '17:00', closed: false },
    tuesday: { open: '08:00', close: '17:00', closed: false },
    wednesday: { open: '08:00', close: '17:00', closed: false },
    thursday: { open: '08:00', close: '17:00', closed: false },
    friday: { open: '08:00', close: '17:00', closed: false },
    saturday: { open: '09:00', close: '13:00', closed: false },
    sunday: { open: '00:00', close: '00:00', closed: true }
  },
  buffer_minutes: 15,
  minimum_notice_hours: 2,
  max_booking_days_ahead: 30,
  blocked_dates: ['2026-10-15']
}

const mockService60 = {
  id: 'svc-tuneup',
  name: 'Standard Tune-Up',
  duration_minutes: 60
}

const mockService120 = {
  id: 'svc-install',
  name: 'Full AC Installation',
  duration_minutes: 120
}

/**
 * -----------------------------------------------------------------------------
 * 1. AVAILABILITY & WORKING DAYS TESTS
 * -----------------------------------------------------------------------------
 */
test('Availability: Returns empty slots for closed days (e.g. Sunday)', () => {
  // Sunday October 11, 2026
  const slots = calculateAvailableSlots({
    orgConfig: mockOrgConfig,
    service: mockService60,
    dateStr: '2026-10-11',
    existingAppointments: [],
    referenceTime: new Date('2026-10-01T00:00:00Z')
  })
  assert.strictEqual(slots.length, 0)
})

test('Availability: Returns empty slots for blocked blackout dates', () => {
  // Blocked date: 2026-10-15
  const slots = calculateAvailableSlots({
    orgConfig: mockOrgConfig,
    service: mockService60,
    dateStr: '2026-10-15',
    existingAppointments: [],
    referenceTime: new Date('2026-10-01T00:00:00Z')
  })
  assert.strictEqual(slots.length, 0)
})

test('Availability: Rejects dates exceeding max booking window', () => {
  // Date 45 days in future exceeds 30-day window
  const slots = calculateAvailableSlots({
    orgConfig: mockOrgConfig,
    service: mockService60,
    dateStr: '2026-11-20',
    existingAppointments: [],
    referenceTime: new Date('2026-10-01T00:00:00Z')
  })
  assert.strictEqual(slots.length, 0)
})

test('Availability: Filters out slots within minimum notice window', () => {
  // Reference time: Monday Oct 5 at 08:30 AM local time (13:30 UTC)
  const refTime = new Date(localDateTimeToUtc('2026-10-05', '08:30', 'America/Chicago'))
  
  const slots = calculateAvailableSlots({
    orgConfig: mockOrgConfig,
    service: mockService60,
    dateStr: '2026-10-05',
    existingAppointments: [],
    referenceTime: refTime,
    stepMinutes: 30
  })

  // With 2h minimum notice, earliest bookable slot must be >= 10:30 AM
  assert.ok(slots.length > 0)
  for (const slot of slots) {
    const slotStart = new Date(slot.startTime).getTime()
    const earliestAllowed = refTime.getTime() + 2 * 60 * 60 * 1000
    assert.ok(slotStart >= earliestAllowed, `Slot ${slot.displayTime} must be >= 10:30 AM`)
  }
})

/**
 * -----------------------------------------------------------------------------
 * 2. OVERLAPPING BOOKINGS & BUFFERS TESTS
 * -----------------------------------------------------------------------------
 */
test('Availability & Buffers: Never offers overlapping slots with existing appointments', () => {
  // Existing appointment: Monday Oct 5 from 10:00 AM to 11:00 AM (Central)
  const aptStartUtc = localDateTimeToUtc('2026-10-05', '10:00', 'America/Chicago').toISOString()
  const aptEndUtc = localDateTimeToUtc('2026-10-05', '11:00', 'America/Chicago').toISOString()

  const existingAppts = [
    {
      id: 'apt-1',
      start_time: aptStartUtc,
      end_time: aptEndUtc,
      status: 'confirmed'
    }
  ]

  const slots = calculateAvailableSlots({
    orgConfig: mockOrgConfig, // 15-min buffer
    service: mockService60,   // 60-min service
    dateStr: '2026-10-05',
    existingAppointments: existingAppts,
    referenceTime: new Date('2026-10-01T00:00:00Z'),
    stepMinutes: 30
  })

  // 10:00 AM must NOT be available
  assert.strictEqual(slots.some((s) => s.displayTime.includes('10:00')), false)
  // 10:30 AM must NOT be available
  assert.strictEqual(slots.some((s) => s.displayTime.includes('10:30')), false)
  // 9:30 AM ending at 10:30 AM with 15 min buffer extends to 10:45 AM -> overlaps with 10:00 AM! Must NOT be available
  assert.strictEqual(slots.some((s) => s.displayTime.includes('9:30')), false)
  // 9:00 AM ending at 10:00 AM with 15 min buffer extends to 10:15 AM -> overlaps with 10:00 AM! Must NOT be available
  assert.strictEqual(slots.some((s) => s.displayTime.includes('9:00')), false)
  // 11:00 AM starts immediately at end of 10:00-11:00 without buffer -> overlaps with 11:15 buffer! Must NOT be available
  assert.strictEqual(slots.some((s) => s.displayTime.includes('11:00')), false)
  // 11:30 AM (starts after 11:15 buffer) SHOULD be available!
  assert.strictEqual(slots.some((s) => s.displayTime.includes('11:30')), true)
})

test('Availability: Multiple services with distinct durations compute appropriate slots', () => {
  // 120-minute service on Monday (08:00 - 17:00)
  const slots120 = calculateAvailableSlots({
    orgConfig: mockOrgConfig,
    service: mockService120,
    dateStr: '2026-10-05',
    existingAppointments: [],
    referenceTime: new Date('2026-10-01T00:00:00Z'),
    stepMinutes: 60
  })

  // Latest 120-min slot can start at 15:00 (ends at 17:00). 16:00 cannot fit!
  assert.ok(slots120.some((s) => s.displayTime.includes('3:00 PM')))
  assert.strictEqual(slots120.some((s) => s.displayTime.includes('4:00 PM')), false)
})

test('Availability: Cancelled appointments immediately free up the time slot', () => {
  const aptStartUtc = localDateTimeToUtc('2026-10-05', '10:00', 'America/Chicago').toISOString()
  const aptEndUtc = localDateTimeToUtc('2026-10-05', '11:00', 'America/Chicago').toISOString()

  // Existing appointment is CANCELLED
  const existingAppts = [
    {
      id: 'apt-cancelled',
      start_time: aptStartUtc,
      end_time: aptEndUtc,
      status: 'cancelled'
    }
  ]

  const slots = calculateAvailableSlots({
    orgConfig: mockOrgConfig,
    service: mockService60,
    dateStr: '2026-10-05',
    existingAppointments: existingAppts,
    referenceTime: new Date('2026-10-01T00:00:00Z'),
    stepMinutes: 30
  })

  // Since it was cancelled, 10:00 AM MUST be available!
  assert.ok(slots.some((s) => s.displayTime.includes('10:00 AM')))
})

test('Availability: Timezone translation correctly positions slots in local business hours', () => {
  // Organization in America/New_York (UTC-4)
  const nyOrgConfig = {
    ...mockOrgConfig,
    timezone: 'America/New_York',
    business_hours: {
      monday: { open: '09:00', close: '17:00', closed: false }
    }
  }

  const slots = calculateAvailableSlots({
    orgConfig: nyOrgConfig,
    service: mockService60,
    dateStr: '2026-10-05',
    existingAppointments: [],
    referenceTime: new Date('2026-10-01T00:00:00Z'),
    stepMinutes: 60
  })

  // First slot display must be 9:00 AM in America/New_York
  assert.strictEqual(slots[0].displayTime, '9:00 AM')
  // In UTC, 9:00 AM EDT (UTC-4) is 13:00:00Z
  const firstSlotUtc = new Date(slots[0].startTime)
  assert.strictEqual(firstSlotUtc.getUTCHours(), 13)
})

/**
 * -----------------------------------------------------------------------------
 * 3. BOOKING MANAGER LIFECYCLE & TOKENIZED ACTIONS TESTS
 * -----------------------------------------------------------------------------
 */
test('Booking Manager: Instant booking creates confirmed appointment and schedules reminders', async () => {
  const db = createMockBookingDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Apex Heating & Air',
        slug: 'apex-hvac',
        timezone: 'America/Chicago',
        booking_mode: 'instant',
        telnyx_phone_number: '+12145550100',
        buffer_minutes: 15
      }
    ],
    services: [
      {
        id: 'svc-1',
        org_id: 'org-1',
        name: 'AC Diagnostic Inspection',
        duration_minutes: 60,
        requires_address: true,
        is_active: true
      }
    ]
  })

  // Booking for tomorrow at 10:00 AM (sufficient future time for 24h & 2h reminders)
  const futureStartTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const result = await createBooking(db, {
    orgId: 'org-1',
    serviceId: 'svc-1',
    customerName: 'Sarah Jenkins',
    customerPhone: '(214) 555-0199',
    customerAddress: '456 Oak Ave, Dallas, TX',
    startTime: futureStartTime
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.status, 'confirmed')
  assert.ok(result.manageToken)
  assert.ok(result.manageUrl.includes(result.manageToken))

  // Verify contact was created
  assert.strictEqual(db._tables.contacts.length, 1)
  assert.strictEqual(db._tables.contacts[0].phone, '+12145550199')

  // Verify appointment was created with confirmed status
  assert.strictEqual(db._tables.appointments.length, 1)
  const apt = db._tables.appointments[0]
  assert.strictEqual(apt.status, 'confirmed')
  assert.ok(apt.confirmed_at)
  assert.strictEqual(apt.manage_token, result.manageToken)

  // Verify pre-appointment reminders were scheduled
  const reminders = db._tables.automation_runs.filter(r => r.event_type === 'appointment.upcoming')
  assert.strictEqual(reminders.length, 2) // 24h and 2h reminders
  assert.ok(reminders.some(r => r.job_id.includes('remind_24h_')))
  assert.ok(reminders.some(r => r.job_id.includes('remind_2h_')))
})

test('Booking Manager: Request mode creates requested appointment without instant confirmation', async () => {
  const db = createMockBookingDb({
    organizations: [
      {
        id: 'org-request',
        name: 'Custom Remodeling Co',
        slug: 'custom-remodel',
        timezone: 'America/Chicago',
        booking_mode: 'request',
        telnyx_phone_number: '+12145550100'
      }
    ]
  })

  const futureStartTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const result = await createBooking(db, {
    orgId: 'org-request',
    customerName: 'Robert Smith',
    customerPhone: '+12145550188',
    startTime: futureStartTime,
    customerAddress: '789 Elm St'
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.status, 'requested')
  assert.strictEqual(db._tables.appointments[0].status, 'requested')
  // Request mode should NOT immediately schedule pre-appointment reminders until confirmed
  const reminders = db._tables.automation_runs.filter(r => r.event_type === 'appointment.upcoming')
  assert.strictEqual(reminders.length, 0)
})

test('Booking Manager: Rejects overlapping booking on already reserved slot', async () => {
  const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const endTime = new Date(Date.now() + 49 * 60 * 60 * 1000).toISOString()

  const db = createMockBookingDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Apex Heating & Air',
        slug: 'apex-hvac',
        timezone: 'America/Chicago',
        booking_mode: 'instant',
        buffer_minutes: 15
      }
    ],
    appointments: [
      {
        id: 'apt-existing',
        org_id: 'org-1',
        start_time: startTime,
        end_time: endTime,
        status: 'confirmed'
      }
    ]
  })

  const result = await createBooking(db, {
    orgId: 'org-1',
    customerName: 'Second Caller',
    customerPhone: '+12145550177',
    startTime: startTime,
    customerAddress: '100 Main St'
  })

  assert.strictEqual(result.success, false)
  assert.ok(result.error.includes('no longer available'))
})

test('Customer Actions: Tokenized cancellation terminates appointment and cancels pending reminders', async () => {
  const futureStartTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const db = createMockBookingDb({
    organizations: [
      { id: 'org-1', name: 'Apex AC', slug: 'apex-ac', telnyx_phone_number: '+12145550100' }
    ],
    contacts: [
      { id: 'cnt-1', org_id: 'org-1', phone: '+12145550199', name: 'Alice' }
    ],
    appointments: [
      {
        id: 'apt-to-cancel',
        org_id: 'org-1',
        contact_id: 'cnt-1',
        manage_token: 'secret-token-123',
        title: 'Inspection - Alice',
        start_time: futureStartTime,
        status: 'confirmed'
      }
    ],
    automation_runs: [
      {
        id: 'run-remind-24h',
        org_id: 'org-1',
        status: 'scheduled',
        event_type: 'appointment.upcoming',
        event_payload: { appointment_id: 'apt-to-cancel', contact_id: 'cnt-1' }
      },
      {
        id: 'run-remind-2h',
        org_id: 'org-1',
        status: 'scheduled',
        event_type: 'appointment.upcoming',
        event_payload: { appointment_id: 'apt-to-cancel', contact_id: 'cnt-1' }
      }
    ]
  })

  const cancelResult = await customerCancelBooking(db, 'secret-token-123', 'Customer caught flu')
  assert.strictEqual(cancelResult.success, true)
  assert.strictEqual(db._tables.appointments[0].status, 'cancelled')
  assert.strictEqual(db._tables.appointments[0].cancellation_reason, 'Customer caught flu')

  // Verify scheduled reminders are cancelled!
  const pendingReminders = db._tables.automation_runs.filter(r => r.status === 'scheduled')
  assert.strictEqual(pendingReminders.length, 0)
  const cancelledReminders = db._tables.automation_runs.filter(r => r.status === 'cancelled')
  assert.strictEqual(cancelledReminders.length, 2)
})

test('Customer Actions: Tokenized rescheduling updates appointment time and refreshes reminders', async () => {
  const oldStartTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const newStartTime = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  const db = createMockBookingDb({
    organizations: [
      { id: 'org-1', name: 'Apex AC', slug: 'apex-ac', telnyx_phone_number: '+12145550100', buffer_minutes: 15 }
    ],
    contacts: [
      { id: 'cnt-1', org_id: 'org-1', phone: '+12145550199', name: 'Alice' }
    ],
    services: [
      { id: 'svc-1', org_id: 'org-1', name: 'Tune-Up', duration_minutes: 60 }
    ],
    appointments: [
      {
        id: 'apt-reschedule',
        org_id: 'org-1',
        contact_id: 'cnt-1',
        service_id: 'svc-1',
        manage_token: 'reschedule-token-456',
        start_time: oldStartTime,
        status: 'confirmed'
      }
    ],
    automation_runs: [
      {
        id: 'run-old-24h',
        org_id: 'org-1',
        status: 'scheduled',
        event_type: 'appointment.upcoming',
        event_payload: { appointment_id: 'apt-reschedule', contact_id: 'cnt-1' }
      }
    ]
  })

  const reschedResult = await customerRescheduleBooking(db, 'reschedule-token-456', newStartTime)
  assert.strictEqual(reschedResult.success, true)
  assert.strictEqual(db._tables.appointments[0].start_time, newStartTime)

  // Old reminders must be cancelled
  const oldRun = db._tables.automation_runs.find(r => r.id === 'run-old-24h')
  assert.strictEqual(oldRun.status, 'cancelled')

  // New reminders must be scheduled
  const newRuns = db._tables.automation_runs.filter(r => r.status === 'scheduled')
  assert.ok(newRuns.length >= 1)
})

test('Owner Workflow: Approving a requested booking confirms slot and triggers reminders', async () => {
  const futureStartTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const db = createMockBookingDb({
    organizations: [
      { id: 'org-1', name: 'Apex AC', slug: 'apex-ac', telnyx_phone_number: '+12145550100' }
    ],
    contacts: [
      { id: 'cnt-1', org_id: 'org-1', phone: '+12145550199', name: 'Bob' }
    ],
    appointments: [
      {
        id: 'apt-pending',
        org_id: 'org-1',
        contact_id: 'cnt-1',
        manage_token: 'token-bob',
        title: 'Consultation - Bob',
        start_time: futureStartTime,
        status: 'requested'
      }
    ]
  })

  const result = await ownerUpdateBookingStatus(db, {
    appointmentId: 'apt-pending',
    orgId: 'org-1',
    newStatus: 'confirmed'
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(db._tables.appointments[0].status, 'confirmed')
  assert.ok(db._tables.appointments[0].confirmed_at)

  // Pre-appointment reminders must now be scheduled
  const scheduledReminders = db._tables.automation_runs.filter(r => r.status === 'scheduled')
  assert.strictEqual(scheduledReminders.length, 2)
})

test('Multi-Tenancy: Distinct businesses maintain completely isolated availability', async () => {
  const testTime = new Date('2026-10-05T15:00:00Z').toISOString()
  const endTime = new Date('2026-10-05T16:00:00Z').toISOString()

  // Business A has appointment at 15:00 UTC
  const aptsBusinessA = [
    {
      id: 'apt-a',
      start_time: testTime,
      end_time: endTime,
      status: 'confirmed'
    }
  ]

  // Business B has NO appointments
  const aptsBusinessB = []

  const slotsA = calculateAvailableSlots({
    orgConfig: mockOrgConfig,
    service: mockService60,
    dateStr: '2026-10-05',
    existingAppointments: aptsBusinessA,
    referenceTime: new Date('2026-10-01T00:00:00Z')
  })

  const slotsB = calculateAvailableSlots({
    orgConfig: mockOrgConfig,
    service: mockService60,
    dateStr: '2026-10-05',
    existingAppointments: aptsBusinessB,
    referenceTime: new Date('2026-10-01T00:00:00Z')
  })

  // Business B has more available slots than Business A because Business A's slot is booked
  assert.ok(slotsB.length > slotsA.length)
})
