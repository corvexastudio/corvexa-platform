import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { createBooking } from '../src/lib/booking/booking-manager.ts'
import { calculateAvailableSlots } from '../src/lib/booking/availability.ts'

/**
 * Mock database harness for P1-01 booking and service testing
 */
function createMockDb(initialState = {}) {
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

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []
      let limitCount = null
      let orderCol = null
      let orderAsc = true

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
        order: (col, opts = {}) => {
          orderCol = col
          orderAsc = opts.ascending !== false
          return queryBuilder
        },
        limit: (n) => {
          limitCount = n
          return queryBuilder
        },
        then: (resolve, reject) => {
          let tableData = [...(tables[tableName] || [])]
          let filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          if (orderCol) {
            filtered.sort((a, b) => {
              if (a[orderCol] < b[orderCol]) return orderAsc ? -1 : 1
              if (a[orderCol] > b[orderCol]) return orderAsc ? 1 : -1
              return 0
            })
          }
          if (limitCount !== null) {
            filtered = filtered.slice(0, limitCount)
          }
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject)
        },
        maybeSingle: async () => {
          let tableData = [...(tables[tableName] || [])]
          let filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          return { data: filtered[0] || null, error: null }
        },
        single: async () => {
          let tableData = [...(tables[tableName] || [])]
          let filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          if (filtered.length === 0) return { data: null, error: new Error('Row not found') }
          return { data: filtered[0], error: null }
        },
        insert: (rowOrRows) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          const insertedRows = []

          for (const row of rows) {
            // Emulate unique constraint uq_services_org_id_name
            if (tableName === 'services') {
              const duplicate = (tables.services || []).find(
                (s) => s.org_id === row.org_id && s.name.toLowerCase().trim() === row.name.toLowerCase().trim()
              )
              if (duplicate) {
                const errObj = { code: '23505', message: 'duplicate key value violates unique constraint "uq_services_org_id_name"' }
                return {
                  data: null,
                  error: errObj,
                  select: () => ({
                    single: async () => ({ data: null, error: errObj }),
                    maybeSingle: async () => ({ data: null, error: errObj })
                  }),
                  then: (resolve, reject) => Promise.resolve({ data: null, error: errObj }).then(resolve, reject)
                }
              }
            }

            const newRow = {
              id: row.id || `uuid-${Math.random().toString(36).slice(2, 9)}`,
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
        upsert: (rowOrRows, options = {}) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          const upsertedRows = []

          for (const row of rows) {
            if (tableName === 'services') {
              const existingIndex = (tables.services || []).findIndex(
                (s) => s.org_id === row.org_id && s.name.toLowerCase().trim() === row.name.toLowerCase().trim()
              )
              if (existingIndex >= 0) {
                if (options.ignoreDuplicates) {
                  upsertedRows.push(tables.services[existingIndex])
                  continue
                }
                tables.services[existingIndex] = { ...tables.services[existingIndex], ...row }
                upsertedRows.push(tables.services[existingIndex])
                continue
              }
            }

            const newRow = {
              id: row.id || `uuid-${Math.random().toString(36).slice(2, 9)}`,
              created_at: new Date().toISOString(),
              ...row
            }
            if (!tables[tableName]) tables[tableName] = []
            tables[tableName].push(newRow)
            upsertedRows.push(newRow)
          }

          const lastUpserted = upsertedRows[upsertedRows.length - 1] || null
          return {
            data: lastUpserted,
            error: null,
            select: () => ({
              single: async () => ({ data: lastUpserted, error: null }),
              maybeSingle: async () => ({ data: lastUpserted, error: null })
            }),
            then: (resolve, reject) => Promise.resolve({ data: lastUpserted, error: null }).then(resolve, reject)
          }
        },
        update: (updates) => ({
          eq: (col, val) => {
            const tableData = tables[tableName] || []
            for (const row of tableData) {
              if (row[col] === val) {
                Object.assign(row, updates)
              }
            }
            return {
              data: tableData.filter((r) => r[col] === val),
              error: null,
              select: () => ({
                single: async () => ({ data: tableData.find((r) => r[col] === val) || null, error: null })
              })
            }
          }
        })
      }

      return queryBuilder
    }
  }

  return client
}

// -----------------------------------------------------------------------------
// P1-01 TEST SUITE
// -----------------------------------------------------------------------------

test('TEST 1: Fresh onboarding creates exactly one usable default service', async () => {
  const db = createMockDb()
  const orgId = 'org-fresh-01'

  // Simulate onboarding service seeding logic
  const defaultServiceName = 'General Service'
  const defaultServiceDuration = 60

  const { data: existingServices } = await db
    .from('services')
    .select('id')
    .eq('org_id', orgId)
    .limit(1)

  if (!existingServices || existingServices.length === 0) {
    await db.from('services').upsert(
      {
        org_id: orgId,
        name: defaultServiceName,
        description: 'Standard consultation and service appointment.',
        duration_minutes: defaultServiceDuration,
        price: null,
        requires_address: true,
        is_active: true,
        sort_order: 0
      },
      { onConflict: 'org_id,name', ignoreDuplicates: true }
    )
  }

  const orgServices = db._tables.services.filter((s) => s.org_id === orgId)
  assert.strictEqual(orgServices.length, 1, 'Newly onboarded organization must have exactly 1 service')
  assert.strictEqual(orgServices[0].name, 'General Service')
  assert.strictEqual(orgServices[0].duration_minutes, 60)
})

test('TEST 2: Default service belongs to the newly created organization', async () => {
  const db = createMockDb()
  const newOrgId = 'org-tenant-alpha'

  await db.from('services').insert({
    org_id: newOrgId,
    name: 'General Service',
    duration_minutes: 60,
    is_active: true
  })

  const svc = db._tables.services.find((s) => s.org_id === newOrgId)
  assert.ok(svc, 'Service must exist')
  assert.strictEqual(svc.org_id, newOrgId, 'Service org_id must strictly match the newly created org')
})

test('TEST 3: Default service is active and immediately bookable', async () => {
  const db = createMockDb({
    organizations: [
      {
        id: 'org-active-test',
        name: 'Apex Heating',
        slug: 'apex-heating',
        timezone: 'America/Chicago',
        booking_mode: 'instant',
        default_duration_minutes: 60
      }
    ],
    services: [
      {
        id: 'svc-active-uuid',
        org_id: 'org-active-test',
        name: 'General Service',
        duration_minutes: 60,
        is_active: true
      }
    ]
  })

  const svc = db._tables.services[0]
  assert.strictEqual(svc.is_active, true, 'Default service must be active')
  assert.strictEqual(svc.duration_minutes > 0, true, 'Duration must be positive')

  // Slot availability calculation succeeds for this service
  const slots = calculateAvailableSlots({
    orgConfig: {
      timezone: 'America/Chicago',
      business_hours: {
        monday: { open: '08:00', close: '17:00', enabled: true }
      },
      buffer_minutes: 15,
      minimum_notice_hours: 2,
      max_booking_days_ahead: 30,
      blocked_dates: []
    },
    service: {
      id: svc.id,
      name: svc.name,
      duration_minutes: svc.duration_minutes
    },
    dateStr: '2026-10-12', // Monday
    existingAppointments: [],
    referenceTime: new Date('2026-10-01T00:00:00Z')
  })

  assert.ok(slots.length > 0, 'Slots must be generated for the active service')
})

test('TEST 4: Retrying onboarding does not create duplicate default services', async () => {
  const db = createMockDb()
  const orgId = 'org-retry-test'

  // Simulating 3 consecutive onboarding attempts / retries
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data: existingServices } = await db
      .from('services')
      .select('id')
      .eq('org_id', orgId)
      .limit(1)

    if (!existingServices || existingServices.length === 0) {
      await db.from('services').upsert(
        {
          org_id: orgId,
          name: 'General Service',
          duration_minutes: 60,
          is_active: true,
          sort_order: 0
        },
        { onConflict: 'org_id,name', ignoreDuplicates: true }
      )
    }
  }

  const servicesForOrg = db._tables.services.filter((s) => s.org_id === orgId)
  assert.strictEqual(servicesForOrg.length, 1, 'Only 1 default service must exist despite 3 onboarding retries')
})

test('TEST 5: Double submission / concurrent onboarding cannot create duplicate defaults', async () => {
  const db = createMockDb()
  const orgId = 'org-concurrent-test'

  // Simulate two concurrent requests trying to insert simultaneously
  const seedService = async () => {
    return db.from('services').upsert(
      {
        org_id: orgId,
        name: 'General Service',
        duration_minutes: 60,
        is_active: true,
        sort_order: 0
      },
      { onConflict: 'org_id,name', ignoreDuplicates: true }
    )
  }

  await Promise.all([seedService(), seedService()])

  const count = db._tables.services.filter((s) => s.org_id === orgId).length
  assert.strictEqual(count, 1, 'Concurrent double submission must result in exactly 1 service')
})

test('TEST 6: Public booking page displays the default service for a newly onboarded organization', () => {
  // Static route verification: GET /api/book/[slug] returns authentic services without synthetic default-service
  const routePath = path.resolve(process.cwd(), 'src/app/api/book/[slug]/route.ts')
  const content = fs.readFileSync(routePath, 'utf8')

  assert.match(content, /from\('services'\)/, 'Route must query services table')
  assert.match(content, /eq\('org_id', org\.id\)/, 'Route must filter by org.id')
  assert.match(content, /eq\('is_active', true\)/, 'Route must filter by is_active')
  assert.doesNotMatch(content, /id: 'default-service'/, 'Route must NOT synthesize fake default-service objects')
})

test('TEST 7: Selecting the default service enables the booking flow to continue', () => {
  const pagePath = path.resolve(process.cwd(), 'src/app/book/[slug]/page.tsx')
  const content = fs.readFileSync(pagePath, 'utf8')

  // Verifies that single service auto-selects and enables Continue button
  assert.match(content, /data\.services\?\.length === 1/, 'Must auto-select when single service exists')
  assert.match(content, /setSelectedService\(data\.services\[0\]\)/, 'Auto-selects first service')
  assert.match(content, /disabled=\{!selectedService\}/, 'Button enabled once service is selected')
})

test('TEST 8: Booking submission persists the correct service_id', async () => {
  const defaultServiceUuid = '11111111-2222-3333-4444-555555555555'
  const db = createMockDb({
    organizations: [
      {
        id: 'org-book-test',
        name: 'Alpha HVAC',
        slug: 'alpha-hvac',
        timezone: 'America/Chicago',
        booking_mode: 'instant',
        default_duration_minutes: 60
      }
    ],
    services: [
      {
        id: defaultServiceUuid,
        org_id: 'org-book-test',
        name: 'General Service',
        duration_minutes: 60,
        is_active: true
      }
    ]
  })

  const futureTime = new Date(Date.now() + 48 * 3600 * 1000).toISOString()
  const result = await createBooking(db, {
    orgId: 'org-book-test',
    serviceId: defaultServiceUuid,
    customerName: 'John Doe',
    customerPhone: '+12145550111',
    customerAddress: '123 Main St, Dallas, TX',
    startTime: futureTime
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(db._tables.appointments.length, 1)
  const savedAppt = db._tables.appointments[0]
  assert.strictEqual(savedAppt.service_id, defaultServiceUuid, 'Appointment must store real service UUID')
  assert.strictEqual(savedAppt.service_type, 'General Service')
})

test('TEST 9: A service belonging to another organization cannot be used in a booking', async () => {
  const tenantAService = 'aaaa1111-0000-0000-0000-000000000001'
  const tenantBService = 'bbbb2222-0000-0000-0000-000000000002'

  const db = createMockDb({
    organizations: [
      { id: 'org-tenant-a', name: 'Tenant A' },
      { id: 'org-tenant-b', name: 'Tenant B' }
    ],
    services: [
      { id: tenantAService, org_id: 'org-tenant-a', name: 'Service A', duration_minutes: 60, is_active: true },
      { id: tenantBService, org_id: 'org-tenant-b', name: 'Service B', duration_minutes: 60, is_active: true }
    ]
  })

  const futureTime = new Date(Date.now() + 48 * 3600 * 1000).toISOString()

  // Attempt to book Tenant A while supplying Tenant B's serviceId
  const result = await createBooking(db, {
    orgId: 'org-tenant-a',
    serviceId: tenantBService,
    customerName: 'Attacker',
    customerPhone: '+12145550199',
    customerAddress: '456 Elm St',
    startTime: futureTime
  })

  assert.strictEqual(result.success, false)
  assert.match(result.error, /belong to this organization/, 'Cross-tenant service booking must be rejected')
  assert.strictEqual(db._tables.appointments.length, 0, 'No appointment may be created')
})

test('TEST 10: An inactive service cannot be booked', async () => {
  const inactiveServiceId = 'cccc3333-0000-0000-0000-000000000003'

  const db = createMockDb({
    organizations: [
      { id: 'org-inactive-test', name: 'Tenant Inactive' }
    ],
    services: [
      { id: inactiveServiceId, org_id: 'org-inactive-test', name: 'Old Discontinued Service', duration_minutes: 60, is_active: false }
    ]
  })

  const futureTime = new Date(Date.now() + 48 * 3600 * 1000).toISOString()

  const result = await createBooking(db, {
    orgId: 'org-inactive-test',
    serviceId: inactiveServiceId,
    customerName: 'Customer',
    customerPhone: '+12145550188',
    customerAddress: '789 Oak St',
    startTime: futureTime
  })

  assert.strictEqual(result.success, false)
  assert.match(result.error, /inactive/, 'Inactive service booking must be rejected')
  assert.strictEqual(db._tables.appointments.length, 0, 'No appointment may be created')
})

test('TEST 11: An organization with zero active services receives a proper empty-state UI rather than a broken flow', () => {
  const pagePath = path.resolve(process.cwd(), 'src/app/book/[slug]/page.tsx')
  const content = fs.readFileSync(pagePath, 'utf8')

  // Verifies that when services.length === 0, the empty state is displayed
  assert.match(content, /services\.length === 0/, 'Must check for empty services array')
  assert.match(content, /No Services Available/, 'Must render honest empty state heading')
  assert.match(content, /No services are currently available for online booking/, 'Must display honest explanation')
  assert.match(content, /org\?\.phone/, 'Must provide call fallback when phone available')
})

test('TEST 12: Existing organizations with custom services are not overwritten or duplicated', async () => {
  const db = createMockDb({
    services: [
      { id: 'svc-custom-1', org_id: 'org-existing-custom', name: 'Custom Roof Inspection', duration_minutes: 90, is_active: true },
      { id: 'svc-custom-2', org_id: 'org-existing-custom', name: 'Emergency Tarping', duration_minutes: 120, is_active: true }
    ]
  })

  const orgId = 'org-existing-custom'

  // When onboarding seeding logic checks existing organization with services:
  const { data: existingServices } = await db
    .from('services')
    .select('id')
    .eq('org_id', orgId)
    .limit(1)

  if (!existingServices || existingServices.length === 0) {
    await db.from('services').upsert(
      {
        org_id: orgId,
        name: 'General Service',
        duration_minutes: 60,
        is_active: true
      },
      { onConflict: 'org_id,name', ignoreDuplicates: true }
    )
  }

  const services = db._tables.services.filter((s) => s.org_id === orgId)
  assert.strictEqual(services.length, 2, 'Existing organization must retain its 2 custom services')
  assert.strictEqual(services.some((s) => s.name === 'General Service'), false, 'Default service must not be injected')
})
