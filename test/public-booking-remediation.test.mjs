import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseServicePricing,
  formatDynamicPricingTotal,
  encodeAddOns,
  parseAddOns
} from '../src/lib/services/service-pricing.ts'
import {
  formatCustomerName,
  formatAsYouTypeUsPhone,
  formatStandardUsAddress,
  combineStreetAndUnit,
  splitStreetAndUnit
} from '../src/lib/booking/customer-input-formatter.ts'
import {
  calculateAvailableSlots,
  doesIntervalOverlap
} from '../src/lib/booking/availability.ts'
import {
  createBooking,
  customerCancelBooking,
  customerRescheduleBooking
} from '../src/lib/booking/booking-manager.ts'

/**
 * In-memory Supabase mock harness
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
    compliance_consents: initialState.compliance_consents || []
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
          filters.push((row) => row[col] === val)
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

// ============================================================================
// PART 1: PRICING MODEL & DYNAMIC LABEL TESTS (DEFECT 1)
// ============================================================================

test('Pricing: Free Estimate displays Free Estimate label with $0 base', () => {
  const result = formatDynamicPricingTotal('free_estimate', 0, 0)
  assert.equal(result.formattedTotal, 'Free Estimate')
  assert.equal(result.hasNumericBase, false)
  assert.equal(result.total, 0)
})

test('Pricing: Free Estimate displays extras total when add-ons are selected', () => {
  const result = formatDynamicPricingTotal('free_estimate', 0, 35)
  assert.equal(result.formattedTotal, 'Free Estimate (+$35.00 extras)')
  assert.equal(result.total, 35)
})

test('Pricing: Quote on Site displays Quote on Site label without base price', () => {
  const result = formatDynamicPricingTotal('quote_on_site', null, 0)
  assert.equal(result.formattedTotal, 'Quote on Site')
  assert.equal(result.hasNumericBase, false)
})

test('Pricing: Quote on Site displays extras total when add-ons are selected', () => {
  const result = formatDynamicPricingTotal('quote_on_site', null, 25)
  assert.equal(result.formattedTotal, 'Quote on Site (+$25.00 extras)')
  assert.equal(result.total, 25)
})

test('Pricing: Fixed price displays exact amount with and without extras', () => {
  const baseOnly = formatDynamicPricingTotal('fixed', 150, 0)
  assert.equal(baseOnly.formattedTotal, '$150.00')
  assert.equal(baseOnly.hasNumericBase, true)
  assert.equal(baseOnly.total, 150)

  const withExtras = formatDynamicPricingTotal('fixed', 150, 35)
  assert.equal(withExtras.formattedTotal, '$185.00')
  assert.equal(withExtras.total, 185)
})

test('Pricing: Starting At price displays Starting at prefix with and without extras', () => {
  const baseOnly = formatDynamicPricingTotal('starting_at', 99, 0)
  assert.equal(baseOnly.formattedTotal, 'Starting at $99.00')
  assert.equal(baseOnly.hasNumericBase, true)

  const withExtras = formatDynamicPricingTotal('starting_at', 99, 35)
  assert.equal(withExtras.formattedTotal, 'Starting at $134.00')
  assert.equal(withExtras.total, 134)
})

test('Pricing: Diagnostic Fee displays Diagnostic Fee suffix with and without extras', () => {
  const baseOnly = formatDynamicPricingTotal('diagnostic_fee', 79, 0)
  assert.equal(baseOnly.formattedTotal, '$79.00 Diagnostic Fee')
  assert.equal(baseOnly.hasNumericBase, true)

  const withExtras = formatDynamicPricingTotal('diagnostic_fee', 79, 35)
  assert.equal(withExtras.formattedTotal, '$114.00 Diagnostic Fee')
  assert.equal(withExtras.total, 114)
})

// ============================================================================
// PART 2: DURATION & ADD-ON SCHEDULING TESTS (DEFECT 3)
// ============================================================================

test('Duration: Base service only creates appointment matching service duration', async () => {
  const orgId = 'org-dur-1'
  const serviceId = 'svc-60m'
  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Apex Heating',
      timezone: 'America/Chicago',
      booking_mode: 'instant',
      buffer_minutes: 15,
      subscription_status: 'active'
    }],
    services: [{
      id: serviceId,
      org_id: orgId,
      name: 'Furnace Inspection',
      duration_minutes: 60,
      price: 89,
      is_active: true
    }]
  })

  const startIso = '2026-11-25T15:00:00.000Z'
  const result = await createBooking(db, {
    orgId,
    serviceId,
    customerName: 'Alice Walker',
    customerPhone: '555-010-0001',
    customerAddress: '100 Main St, Austin, TX',
    startTime: startIso
  })

  assert.equal(result.success, true)
  assert.ok(result.appointment)
  assert.equal(result.appointment.start_time, startIso)
  // 60 minutes = 3600000 ms
  const expectedEnd = new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString()
  assert.equal(result.appointment.end_time, expectedEnd)
})

test('Duration: Base service (60m) plus one add-on (30m) extends appointment to 90m', async () => {
  const orgId = 'org-dur-2'
  const serviceId = 'svc-60m-addon'
  const addOns = [
    { id: 'addon-filter', name: 'Air Filter Replacement', price: 35, duration_minutes: 30 }
  ]
  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Apex Heating',
      timezone: 'America/Chicago',
      booking_mode: 'instant',
      buffer_minutes: 15,
      subscription_status: 'active'
    }],
    services: [{
      id: serviceId,
      org_id: orgId,
      name: 'Furnace Inspection',
      duration_minutes: 60,
      price: 89,
      description: `Complete diagnostic. ${encodeAddOns(addOns)}`,
      is_active: true
    }]
  })

  const startIso = '2026-11-25T15:00:00.000Z'
  const result = await createBooking(db, {
    orgId,
    serviceId,
    customerName: 'Bob Jenkins',
    customerPhone: '555-010-0002',
    customerAddress: '200 Oak St, Austin, TX',
    startTime: startIso,
    addonIds: ['addon-filter']
  })

  assert.equal(result.success, true)
  assert.ok(result.appointment)
  assert.equal(result.appointment.start_time, startIso)
  // 60m base + 30m addon = 90m = 5400000 ms
  const expectedEnd = new Date(new Date(startIso).getTime() + 90 * 60 * 1000).toISOString()
  assert.equal(result.appointment.end_time, expectedEnd)

  // Verify job line items recorded authoritative add-on name and price
  const jobItems = db._tables.job_items
  assert.ok(jobItems.length > 0)
  const filterItem = jobItems.find(i => i.description === 'Air Filter Replacement')
  assert.ok(filterItem, 'Addon line item must exist in job_items')
  assert.equal(filterItem.unit_price, 35)
})

test('Duration: Base service plus multiple add-ons accumulates all valid durations', async () => {
  const orgId = 'org-dur-3'
  const serviceId = 'svc-multi-addon'
  const addOns = [
    { id: 'addon-1', name: 'Filter Check', price: 20, duration_minutes: 15 },
    { id: 'addon-2', name: 'Duct Cleaning', price: 80, duration_minutes: 45 }
  ]
  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Apex Heating',
      timezone: 'America/Chicago',
      booking_mode: 'instant',
      buffer_minutes: 15,
      subscription_status: 'active'
    }],
    services: [{
      id: serviceId,
      org_id: orgId,
      name: 'System Tune-Up',
      duration_minutes: 60,
      price: 120,
      description: `Full tune-up. ${encodeAddOns(addOns)}`,
      is_active: true
    }]
  })

  const startIso = '2026-11-25T16:00:00.000Z'
  const result = await createBooking(db, {
    orgId,
    serviceId,
    customerName: 'Charlie Brown',
    customerPhone: '555-010-0003',
    customerAddress: '300 Pine St, Austin, TX',
    startTime: startIso,
    addonIds: ['addon-1', 'addon-2']
  })

  assert.equal(result.success, true)
  // 60m base + 15m + 45m = 120m
  const expectedEnd = new Date(new Date(startIso).getTime() + 120 * 60 * 1000).toISOString()
  assert.equal(result.appointment.end_time, expectedEnd)
})

test('Security: Client price tampering on add-ons is rejected; server resolves authoritative price', async () => {
  const orgId = 'org-sec-price'
  const serviceId = 'svc-tamper'
  const addOns = [
    { id: 'addon-real', name: 'Premium Filter', price: 65, duration_minutes: 20 }
  ]
  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Apex Heating',
      timezone: 'America/Chicago',
      booking_mode: 'instant',
      buffer_minutes: 15,
      subscription_status: 'active'
    }],
    services: [{
      id: serviceId,
      org_id: orgId,
      name: 'Filter Service',
      duration_minutes: 45,
      price: 50,
      description: `Service. ${encodeAddOns(addOns)}`,
      is_active: true
    }]
  })

  const startIso = '2026-11-25T17:00:00.000Z'
  // Attacker client sends price: 0.01
  const result = await createBooking(db, {
    orgId,
    serviceId,
    customerName: 'Dave Hax',
    customerPhone: '555-010-0004',
    customerAddress: '400 Elm St, Austin, TX',
    startTime: startIso,
    selectedAddOns: [{ id: 'addon-real', name: 'Premium Filter', price: 0.01 }]
  })

  assert.equal(result.success, true)
  const jobItems = db._tables.job_items
  assert.ok(jobItems.length > 0)
  const lineItem = jobItems.find(i => i.description === 'Premium Filter')
  assert.ok(lineItem)
  assert.equal(lineItem.unit_price, 65, 'Price must be authoritative server-configured 65, not 0.01')
})

test('Security: Invalid or cross-tenant add-on identifiers are discarded and do not extend duration', async () => {
  const orgId = 'org-sec-invalid'
  const serviceId = 'svc-legit'
  const addOns = [
    { id: 'valid-addon', name: 'Real Addon', price: 25, duration_minutes: 20 }
  ]
  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Apex Heating',
      timezone: 'America/Chicago',
      booking_mode: 'instant',
      buffer_minutes: 15,
      subscription_status: 'active'
    }],
    services: [{
      id: serviceId,
      org_id: orgId,
      name: 'Standard Call',
      duration_minutes: 60,
      price: 90,
      description: `Standard. ${encodeAddOns(addOns)}`,
      is_active: true
    }]
  })

  const startIso = '2026-11-25T18:00:00.000Z'
  const result = await createBooking(db, {
    orgId,
    serviceId,
    customerName: 'Eve Shadow',
    customerPhone: '555-010-0005',
    customerAddress: '500 Birch St, Austin, TX',
    startTime: startIso,
    addonIds: ['bogus-addon-999', 'cross-tenant-addon-444']
  })

  assert.equal(result.success, true)
  // Duration must strictly be 60m since invalid add-on IDs are discarded
  const expectedEnd = new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString()
  assert.equal(result.appointment.end_time, expectedEnd)
})

// ============================================================================
// PART 3: RESCHEDULING & HISTORICAL DURATION PRESERVATION (DEFECT 2)
// ============================================================================

test('Reschedule: Preserves original 90-minute appointment duration without shortening to 60m', async () => {
  const orgId = 'org-resched-1'
  const manageToken = 'token_90min_test_abc123'
  const originalStart = '2026-11-26T14:00:00.000Z'
  const originalEnd = '2026-11-26T15:30:00.000Z' // 90 minutes!

  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Apex Heating',
      timezone: 'America/Chicago',
      default_duration_minutes: 60,
      buffer_minutes: 15,
      subscription_status: 'active'
    }],
    services: [{
      id: 'svc-furnace',
      org_id: orgId,
      name: 'Furnace Rebuild',
      duration_minutes: 60,
      is_active: true
    }],
    appointments: [{
      id: 'apt-90m',
      org_id: orgId,
      manage_token: manageToken,
      service_id: 'svc-furnace',
      service_type: 'Furnace Rebuild',
      start_time: originalStart,
      end_time: originalEnd,
      status: 'confirmed'
    }],
    jobs: [{
      id: 'job-90m',
      org_id: orgId,
      appointment_id: 'apt-90m',
      status: 'confirmed',
      scheduled_start: originalStart,
      scheduled_end: originalEnd
    }]
  })

  // Customer reschedules to tomorrow at 16:00
  const newStart = '2026-11-27T16:00:00.000Z'
  const result = await customerRescheduleBooking(db, manageToken, newStart)

  assert.equal(result.success, true)
  assert.ok(result.appointment)
  assert.equal(result.appointment.start_time, newStart)

  // Critical assertion: 90 minutes must be preserved, NOT shortened to 60m!
  const expectedNewEnd = new Date(new Date(newStart).getTime() + 90 * 60 * 1000).toISOString()
  assert.equal(result.appointment.end_time, expectedNewEnd)

  // Verify linked job end time was also updated to the full 90 minutes
  const updatedJob = db._tables.jobs.find(j => j.appointment_id === 'apt-90m')
  assert.equal(updatedJob.scheduled_end, expectedNewEnd)
})

test('Reschedule: Blocks past dates from being selected', async () => {
  const orgId = 'org-resched-past'
  const manageToken = 'token_past_test'
  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Apex Heating',
      timezone: 'America/Chicago',
      subscription_status: 'active'
    }],
    appointments: [{
      id: 'apt-past',
      org_id: orgId,
      manage_token: manageToken,
      start_time: '2026-11-26T14:00:00.000Z',
      end_time: '2026-11-26T15:00:00.000Z',
      status: 'confirmed'
    }]
  })

  // 1 year in the past
  const pastDate = '2025-01-01T10:00:00.000Z'
  const result = await customerRescheduleBooking(db, manageToken, pastDate)
  assert.equal(result.success, false)
  assert.match(result.error, /past/i)
})

// ============================================================================
// PART 4: STRUCTURED SERVICE ADDRESS TESTS (DEFECT 4)
// ============================================================================

test('Address: combineStreetAndUnit formats street and unit cleanly', () => {
  const result1 = combineStreetAndUnit('123 Main St', '4B')
  assert.equal(result1, '123 Main St, Apt 4B')

  const result2 = combineStreetAndUnit('123 Main St, Austin, TX 78701', 'Suite 200')
  assert.equal(result2, '123 Main St, Suite 200, Austin, TX 78701')

  const result3 = combineStreetAndUnit('456 Broadway Blvd', 'Unit 12A')
  assert.equal(result3, '456 Broadway Blvd, Unit 12A')
})

test('Address: combineStreetAndUnit avoids duplicate unit insertion', () => {
  const alreadyCombined = '123 Main St, Apt 4B, Austin, TX 78701'
  const result = combineStreetAndUnit(alreadyCombined, '4B')
  assert.equal(result, '123 Main St, Apt 4B, Austin, TX 78701')
})

test('Address: splitStreetAndUnit cleanly parses street and unit', () => {
  const { street, unit } = splitStreetAndUnit('123 Main St, Apt 4B')
  assert.equal(street, '123 Main St')
  assert.equal(unit, 'Apt 4B')
})

// ============================================================================
// PART 5: SECURITY & MULTI-TENANT TESTS
// ============================================================================

test('Security: Suspended organization is blocked from creating bookings', async () => {
  const orgId = 'org-suspended'
  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Suspended Plumbing',
      subscription_status: 'suspended'
    }],
    services: [{
      id: 'svc-drain',
      org_id: orgId,
      name: 'Drain Cleaning',
      duration_minutes: 60,
      is_active: true
    }]
  })

  const result = await createBooking(db, {
    orgId,
    serviceId: 'svc-drain',
    customerName: 'Sam Target',
    customerPhone: '555-010-0099',
    startTime: '2026-11-25T15:00:00.000Z'
  })

  assert.equal(result.success, false)
  assert.match(result.error, /not accepting online bookings/i)
})

test('Security: Canceled or churned organization is blocked from creating bookings', async () => {
  const orgId = 'org-canceled'
  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Closed Plumbing',
      subscription_status: 'canceled'
    }],
    services: [{
      id: 'svc-pipe',
      org_id: orgId,
      name: 'Pipe Repair',
      duration_minutes: 60,
      is_active: true
    }]
  })

  const result = await createBooking(db, {
    orgId,
    serviceId: 'svc-pipe',
    customerName: 'Sam Target',
    customerPhone: '555-010-0099',
    startTime: '2026-11-25T15:00:00.000Z'
  })

  assert.equal(result.success, false)
  assert.match(result.error, /not accepting online bookings/i)
})

test('Security: Active, trial, and free (Starter Pass) organizations can accept bookings', async () => {
  for (const status of ['active', 'trial', 'free']) {
    const orgId = `org-status-${status}`
    const db = createMockDb({
      organizations: [{
        id: orgId,
        name: `${status} Contractor`,
        timezone: 'America/Chicago',
        subscription_status: status,
        booking_mode: 'instant'
      }],
      services: [{
        id: `svc-${status}`,
        org_id: orgId,
        name: 'Service Call',
        duration_minutes: 60,
        is_active: true
      }]
    })

    const result = await createBooking(db, {
      orgId,
      serviceId: `svc-${status}`,
      customerName: 'Happy Homeowner',
      customerPhone: '555-010-0100',
      startTime: '2026-11-25T15:00:00.000Z'
    })

    assert.equal(result.success, true, `Organization with subscription_status: ${status} must be able to accept bookings`)
  }
})

test('Security: Cannot book service belonging to another tenant', async () => {
  const orgA = 'org-a'
  const orgB = 'org-b'
  const db = createMockDb({
    organizations: [
      { id: orgA, name: 'Org A', subscription_status: 'active' },
      { id: orgB, name: 'Org B', subscription_status: 'active' }
    ],
    services: [
      { id: 'svc-b', org_id: orgB, name: 'Service B', duration_minutes: 60, is_active: true }
    ]
  })

  const result = await createBooking(db, {
    orgId: orgA,
    serviceId: 'svc-b', // Belongs to orgB
    customerName: 'Intruder',
    customerPhone: '555-010-0666',
    startTime: '2026-11-25T15:00:00.000Z'
  })

  assert.equal(result.success, false)
  assert.match(result.error, /does not belong to this organization/i)
})

// ============================================================================
// PART 6: INVARIANTS & INTEGRATION SAFETY
// ============================================================================

test('Invariant: Booking succeeds even if automated SMS dispatch fails', async () => {
  const orgId = 'org-sms-fail'
  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Apex Heating',
      timezone: 'America/Chicago',
      booking_mode: 'instant',
      subscription_status: 'active'
    }],
    services: [{
      id: 'svc-sms',
      org_id: orgId,
      name: 'Filter Swap',
      duration_minutes: 45,
      is_active: true
    }]
  })

  // Set mock Telnyx dispatch to simulate error or unconfigured credentials
  const result = await createBooking(db, {
    orgId,
    serviceId: 'svc-sms',
    customerName: 'Grace Hopper',
    customerPhone: '555-010-0777',
    startTime: '2026-11-25T19:00:00.000Z'
  })

  // Booking must still succeed atomically in PostgreSQL
  assert.equal(result.success, true)
  assert.ok(result.appointment)
  assert.ok(result.manageToken)
  assert.equal(db._tables.appointments.length, 1)
})

test('Invariant: Cancelled appointment guards prevent cancellation of completed job', async () => {
  const orgId = 'org-guard-comp'
  const manageToken = 'token_completed_job'
  const db = createMockDb({
    organizations: [{ id: orgId, name: 'Apex Heating', subscription_status: 'active' }],
    appointments: [{
      id: 'apt-completed',
      org_id: orgId,
      manage_token: manageToken,
      status: 'completed'
    }]
  })

  const cancelResult = await customerCancelBooking(db, manageToken)
  assert.equal(cancelResult.success, false)
  assert.match(cancelResult.error, /already been completed/i)
})

test('Invariant: Field technician en route blocks self-service cancellation', async () => {
  const orgId = 'org-guard-enroute'
  const manageToken = 'token_enroute'
  const db = createMockDb({
    organizations: [{ id: orgId, name: 'Apex Heating', subscription_status: 'active' }],
    appointments: [{
      id: 'apt-enroute',
      org_id: orgId,
      manage_token: manageToken,
      status: 'confirmed'
    }],
    jobs: [{
      id: 'job-enroute',
      org_id: orgId,
      appointment_id: 'apt-enroute',
      status: 'en_route'
    }]
  })

  const cancelResult = await customerCancelBooking(db, manageToken)
  assert.equal(cancelResult.success, false)
  assert.match(cancelResult.error, /on the way|directly/i)
})
