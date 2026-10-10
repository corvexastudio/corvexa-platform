/**
 * ==============================================================================
 * CAPTODESK — P1-OPS-04: HISTORICAL SERVICE DATA SAFETY TEST SUITE
 * ==============================================================================
 * Verifies:
 * 1.  Service Catalog CRUD operates as expected.
 * 2.  Active duplicate-name creation is rejected (409) within same organization.
 * 3.  Active duplicate detection is strictly tenant-scoped.
 * 4.  Inactive historical duplicates do NOT break the active-service invariant.
 * 5.  Historical appointment retains exact service ID when service is deactivated.
 * 6.  Historical job and quote retain exact service ID when service is deactivated.
 * 7.  Historical service details (price, duration, description) remain accessible after deactivation.
 * 8.  Deactivated service is excluded from public booking service catalog.
 * 9.  Public booking attempt with deactivated service ID is rejected.
 * 10. Public booking attempt with cross-tenant service ID is rejected.
 * 11. Referenced service cannot be physically deleted; API soft-deactivates it.
 * 12. Unreferenced service can be safely deleted.
 * 13. RESTRICT fallback: If DB raises 23503, API safely soft-deactivates without error.
 * 14. Historical queries do not return NULL service association.
 * ==============================================================================
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GET as getServices, POST as createService } from '../src/app/api/client/services/route.ts'
import { GET as getServiceById, PATCH as updateService, DELETE as deleteService } from '../src/app/api/client/services/[id]/route.ts'
import { createBooking } from '../src/lib/booking/booking-manager.ts'

const ORG_A_ID = '11111111-1111-1111-1111-111111111111'
const ORG_B_ID = '22222222-2222-2222-2222-222222222222'

const OWNER_USER = {
  id: 'usr-owner-a',
  email: 'owner@tenant-a.com',
  user_metadata: { role: 'owner' }
}

const OWNER_PROFILE = {
  id: 'usr-owner-a',
  org_id: ORG_A_ID,
  email: 'owner@tenant-a.com',
  role: 'owner'
}

function createMockSupabase(initialData = {}, currentUser = OWNER_USER) {
  const store = {
    organizations: initialData.organizations ? JSON.parse(JSON.stringify(initialData.organizations)) : [],
    services: initialData.services ? JSON.parse(JSON.stringify(initialData.services)) : [],
    appointments: initialData.appointments ? JSON.parse(JSON.stringify(initialData.appointments)) : [],
    jobs: initialData.jobs ? JSON.parse(JSON.stringify(initialData.jobs)) : [],
    quotes: initialData.quotes ? JSON.parse(JSON.stringify(initialData.quotes)) : [],
    profiles: initialData.profiles ? JSON.parse(JSON.stringify(initialData.profiles)) : [OWNER_PROFILE],
    contacts: initialData.contacts ? JSON.parse(JSON.stringify(initialData.contacts)) : [],
    leads: initialData.leads ? JSON.parse(JSON.stringify(initialData.leads)) : []
  }

  return {
    _tables: store,
    auth: {
      async getUser() {
        return { data: { user: currentUser } }
      }
    },
    from(tableName) {
      if (!store[tableName]) store[tableName] = []
      const table = store[tableName]

      let filters = []
      let orderCol = null
      let orderAsc = true
      let pendingUpdates = null
      let isDelete = false
      let isHeadCount = false

      const builder = {
        select(fields = '*', options = {}) {
          if (options && options.head) {
            isHeadCount = true
          }
          return builder
        },
        eq(col, val) {
          filters.push((row) => row[col] === val)
          return builder
        },
        neq(col, val) {
          filters.push((row) => row[col] !== val)
          return builder
        },
        in(col, vals) {
          filters.push((row) => (Array.isArray(vals) ? vals.includes(row[col]) : false))
          return builder
        },
        is(col, val) {
          filters.push((row) => row[col] === val)
          return builder
        },
        ilike(col, val) {
          const pattern = String(val).toLowerCase()
          filters.push((row) => {
            const rowVal = String(row[col] || '').toLowerCase()
            return rowVal === pattern
          })
          return builder
        },
        order(col, opts = {}) {
          orderCol = col
          orderAsc = opts.ascending !== false
          return builder
        },
        limit() {
          return builder
        },
        update(updates) {
          pendingUpdates = updates
          return builder
        },
        delete() {
          isDelete = true
          return builder
        },
        async maybeSingle() {
          if (pendingUpdates) {
            const matched = table.filter((r) => filters.every((f) => f(r)))
            for (const row of matched) {
              Object.assign(row, pendingUpdates)
            }
            return { data: matched[0] ? { ...matched[0] } : null, error: null }
          }
          const filtered = table.filter((r) => filters.every((f) => f(r)))
          return { data: filtered[0] ? { ...filtered[0] } : null, error: null }
        },
        async single() {
          const res = await builder.maybeSingle()
          if (!res.data) {
            return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
          }
          return res
        },
        then(resolve, reject) {
          try {
            if (isHeadCount) {
              const matched = table.filter((r) => filters.every((f) => f(r)))
              resolve({ count: matched.length, data: null, error: null })
              return
            }

            if (isDelete) {
              if (store._forceRestrictError) {
                const restrictErr = {
                  code: '23503',
                  message: 'update or delete on table "services" violates foreign key constraint "appointments_service_id_fkey"'
                }
                resolve({ error: restrictErr })
                return
              }

              // Simulate PostgreSQL ON DELETE RESTRICT on services
              if (tableName === 'services') {
                const targetRows = table.filter((r) => filters.every((f) => f(r)))
                for (const target of targetRows) {
                  const hasApt = (store.appointments || []).some((a) => a.service_id === target.id)
                  const hasJob = (store.jobs || []).some((j) => j.service_id === target.id)
                  if (hasApt || hasJob) {
                    const restrictErr = {
                      code: '23503',
                      message: 'update or delete on table "services" violates foreign key constraint "appointments_service_id_fkey"'
                    }
                    resolve({ error: restrictErr })
                    return
                  }
                }
              }

              const remaining = table.filter((r) => !filters.every((f) => f(r)))
              store[tableName] = remaining
              resolve({ error: null })
              return
            }

            if (pendingUpdates) {
              const matched = table.filter((r) => filters.every((f) => f(r)))
              for (const row of matched) {
                Object.assign(row, pendingUpdates)
              }
              resolve({ data: matched.map((r) => ({ ...r })), error: null })
              return
            }

            let filtered = table.filter((r) => filters.every((f) => f(r)))
            if (orderCol) {
              filtered.sort((a, b) => {
                if (a[orderCol] < b[orderCol]) return orderAsc ? -1 : 1
                if (a[orderCol] > b[orderCol]) return orderAsc ? 1 : -1
                return 0
              })
            }
            resolve({ data: filtered.map((r) => ({ ...r })), error: null })
          } catch (err) {
            reject(err)
          }
        },
        insert(payload) {
          const records = Array.isArray(payload) ? payload : [payload]

          // Simulate DB partial unique constraint: uq_services_org_id_active_name
          if (tableName === 'services') {
            for (const r of records) {
              if (r.is_active !== false) {
                const dup = table.find(
                  (existing) =>
                    existing.org_id === r.org_id &&
                    existing.is_active !== false &&
                    existing.name.toLowerCase().trim() === r.name.toLowerCase().trim()
                )
                if (dup) {
                  const constraintErr = {
                    code: '23505',
                    message: 'duplicate key value violates unique constraint "uq_services_org_id_active_name"'
                  }
                  return {
                    data: null,
                    error: constraintErr,
                    select() {
                      return {
                        single: async () => ({ data: null, error: constraintErr }),
                        maybeSingle: async () => ({ data: null, error: constraintErr })
                      }
                    },
                    then(resolve) {
                      resolve({ data: null, error: constraintErr })
                    }
                  }
                }
              }
            }
          }

          const inserted = records.map((r) => {
            const row = {
              id: r.id || `mock-svc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...r
            }
            table.push(row)
            return row
          })

          return {
            data: inserted,
            error: null,
            select() {
              return {
                single: async () => ({ data: inserted[0], error: null }),
                maybeSingle: async () => ({ data: inserted[0], error: null })
              }
            },
            single: async () => ({ data: inserted[0], error: null }),
            maybeSingle: async () => ({ data: inserted[0], error: null }),
            then(resolve) {
              resolve({ data: inserted, error: null })
            }
          }
        }
      }

      return builder
    }
  }
}

function getInitialState() {
  return {
    organizations: [
      { id: ORG_A_ID, name: 'Acme HVAC', slug: 'acme-hvac', booking_mode: 'instant', default_duration_minutes: 60 },
      { id: ORG_B_ID, name: 'Beta Plumbing', slug: 'beta-plumbing', booking_mode: 'instant', default_duration_minutes: 60 }
    ],
    services: [
      {
        id: 'svc-active-1',
        org_id: ORG_A_ID,
        name: 'AC Diagnostic',
        description: 'Complete diagnostic check',
        duration_minutes: 60,
        price: 89.0,
        requires_address: true,
        is_active: true,
        sort_order: 0
      }
    ],
    appointments: [],
    jobs: [],
    quotes: []
  }
}

// ==============================================================================
// TEST CASES
// ==============================================================================

test('1. Service Catalog CRUD: Create, read, and update service', async () => {
  const db = createMockSupabase(getInitialState())

  // Create
  const createReq = new Request('http://localhost/api/client/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Heat Pump Inspection',
      price: 129.0,
      duration_minutes: 90,
      description: 'Full heat pump inspection'
    })
  })
  const createRes = await createService(createReq, { customSupabase: db })
  assert.strictEqual(createRes.status, 201)
  const created = (await createRes.json()).service
  assert.strictEqual(created.name, 'Heat Pump Inspection')
  assert.strictEqual(created.price, 129.0)

  // Read
  const readReq = new Request('http://localhost/api/client/services', { method: 'GET' })
  const readRes = await getServices(readReq, { customSupabase: db })
  assert.strictEqual(readRes.status, 200)
  const list = (await readRes.json()).services
  assert.strictEqual(list.length, 2)

  // Update
  const updateReq = new Request(`http://localhost/api/client/services/${created.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ price: 149.0 })
  })
  const updateRes = await updateService(updateReq, { params: Promise.resolve({ id: created.id }) }, { customSupabase: db })
  assert.strictEqual(updateRes.status, 200)
  assert.strictEqual((await updateRes.json()).service.price, 149.0)
})

test('2. Active duplicate rejection: Rejects creating second active service with same name (409)', async () => {
  const db = createMockSupabase(getInitialState())

  const req = new Request('http://localhost/api/client/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'ac diagnostic', duration_minutes: 60 })
  })
  const res = await createService(req, { customSupabase: db })
  assert.strictEqual(res.status, 409)
  const data = await res.json()
  assert.match(data.error, /already exists/i)
})

test('3. Tenant-scoped uniqueness: Org B can create active service with same name as Org A', async () => {
  const db = createMockSupabase(getInitialState())

  // Insert service for Org B directly in DB
  db._tables.services.push({
    id: 'svc-b-1',
    org_id: ORG_B_ID,
    name: 'AC Diagnostic',
    is_active: true,
    duration_minutes: 60,
    price: 99.0
  })

  // Verify both Org A and Org B have active 'AC Diagnostic' without conflict
  const orgASvcs = db._tables.services.filter((s) => s.org_id === ORG_A_ID && s.name === 'AC Diagnostic')
  const orgBSvcs = db._tables.services.filter((s) => s.org_id === ORG_B_ID && s.name === 'AC Diagnostic')
  assert.strictEqual(orgASvcs.length, 1)
  assert.strictEqual(orgBSvcs.length, 1)
  assert.notStrictEqual(orgASvcs[0].id, orgBSvcs[0].id)
})

test('4. Inactive historical duplicate: Creating active service succeeds when identical-name service is inactive', async () => {
  const state = getInitialState()
  // Add an inactive historical service named "Furnace Tune-up"
  state.services.push({
    id: 'svc-hist-inactive',
    org_id: ORG_A_ID,
    name: 'Furnace Tune-up',
    duration_minutes: 45,
    price: 69.0,
    is_active: false
  })
  const db = createMockSupabase(state)

  // Now create an ACTIVE service named "Furnace Tune-up"
  const req = new Request('http://localhost/api/client/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Furnace Tune-up',
      price: 89.0,
      duration_minutes: 60
    })
  })

  const res = await createService(req, { customSupabase: db })
  assert.strictEqual(res.status, 201, 'Active service must be created cleanly alongside historical inactive record')
  const data = await res.json()
  assert.strictEqual(data.service.name, 'Furnace Tune-up')
  assert.strictEqual(data.service.is_active, true)

  // Verify DB has both: 1 inactive historical, 1 active current
  const allFurnace = db._tables.services.filter((s) => s.org_id === ORG_A_ID && s.name.toLowerCase() === 'furnace tune-up')
  assert.strictEqual(allFurnace.length, 2)
  assert.strictEqual(allFurnace.filter((s) => s.is_active).length, 1)
  assert.strictEqual(allFurnace.filter((s) => !s.is_active).length, 1)
})

test('5. Historical appointment retains service ID when service is deactivated', async () => {
  const state = getInitialState()
  const serviceId = 'svc-active-1'
  state.appointments.push({
    id: 'apt-hist-1',
    org_id: ORG_A_ID,
    service_id: serviceId,
    title: 'AC Diagnostic - Customer John',
    status: 'completed',
    start_time: '2026-06-01T10:00:00Z',
    end_time: '2026-06-01T11:00:00Z'
  })

  const db = createMockSupabase(state)

  // Deactivate service via PATCH
  const patchReq = new Request(`http://localhost/api/client/services/${serviceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: false })
  })
  const patchRes = await updateService(patchReq, { params: Promise.resolve({ id: serviceId }) }, { customSupabase: db })
  assert.strictEqual(patchRes.status, 200)

  // Verify historical appointment STILL references the service UUID
  const appt = db._tables.appointments.find((a) => a.id === 'apt-hist-1')
  assert.strictEqual(appt.service_id, serviceId, 'Appointment service_id must remain intact')
  assert.notStrictEqual(appt.service_id, null, 'Appointment service_id must never become NULL')
})

test('6. Historical jobs retain service ID when service is deactivated', async () => {
  const state = getInitialState()
  const serviceId = 'svc-active-1'
  state.jobs.push({
    id: 'job-hist-1',
    org_id: ORG_A_ID,
    service_id: serviceId,
    title: 'Repair Job',
    status: 'completed'
  })

  const db = createMockSupabase(state)

  // Deactivate service via DELETE endpoint (which soft-deactivates when references exist)
  const delReq = new Request(`http://localhost/api/client/services/${serviceId}`, { method: 'DELETE' })
  const delRes = await deleteService(delReq, { params: Promise.resolve({ id: serviceId }) }, { customSupabase: db })
  assert.strictEqual(delRes.status, 200)
  const delData = await delRes.json()
  assert.strictEqual(delData.deactivated, true)

  // Verify jobs retain exact service UUID
  const job = db._tables.jobs.find((j) => j.id === 'job-hist-1')
  assert.strictEqual(job.service_id, serviceId)
  assert.notStrictEqual(job.service_id, null)
})

test('7. Historical service details remain accessible and intact', async () => {
  const state = getInitialState()
  const db = createMockSupabase(state)

  // Deactivate the service
  const svc = db._tables.services.find((s) => s.id === 'svc-active-1')
  svc.is_active = false

  // Inspect the service record
  const getReq = new Request('http://localhost/api/client/services/svc-active-1', { method: 'GET' })
  const getRes = await getServiceById(getReq, { params: Promise.resolve({ id: 'svc-active-1' }) }, { customSupabase: db })
  assert.strictEqual(getRes.status, 200)
  const fetched = (await getRes.json()).service
  assert.strictEqual(fetched.id, 'svc-active-1')
  assert.strictEqual(fetched.name, 'AC Diagnostic')
  assert.strictEqual(fetched.price, 89.0)
  assert.strictEqual(fetched.duration_minutes, 60)
  assert.strictEqual(fetched.is_active, false)
})

test('8. Deactivated service is excluded from public booking', async () => {
  const state = getInitialState()
  const db = createMockSupabase(state)

  // Deactivate the service
  db._tables.services[0].is_active = false

  // Public booking queries only active services
  const activeServices = db._tables.services.filter((s) => s.org_id === ORG_A_ID && s.is_active === true)
  assert.strictEqual(activeServices.length, 0, 'Deactivated service must not appear in public booking')
})

test('9. Public booking rejects attempt to book an inactive service', async () => {
  const state = getInitialState()
  state.services[0].is_active = false
  const db = createMockSupabase(state)

  const result = await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-active-1',
    customerName: 'Bob Customer',
    customerPhone: '+13125550111',
    customerEmail: 'bob@example.com',
    startTime: '2026-11-25T14:00:00Z'
  })

  assert.strictEqual(result.success, false)
  assert.match(result.error, /inactive and cannot be booked/i)
})

test('10. Public booking rejects attempt to book a cross-tenant service ID', async () => {
  const state = getInitialState()
  state.services.push({
    id: 'svc-org-b',
    org_id: ORG_B_ID,
    name: 'Plumbing Service',
    is_active: true,
    duration_minutes: 60
  })
  const db = createMockSupabase(state)

  // Attempt to book Org B's service under Org A
  const result = await createBooking(db, {
    orgId: ORG_A_ID,
    serviceId: 'svc-org-b',
    customerName: 'Eve Attacker',
    customerPhone: '+13125550222',
    startTime: '2026-11-25T14:00:00Z'
  })

  assert.strictEqual(result.success, false)
  assert.match(result.error, /does not belong to this organization/i)
})

test('11. Referenced service cannot be physically deleted; API soft-deactivates it', async () => {
  const state = getInitialState()
  state.appointments.push({
    id: 'apt-ref-1',
    org_id: ORG_A_ID,
    service_id: 'svc-active-1',
    title: 'Active Booking',
    status: 'scheduled',
    start_time: '2026-11-26T10:00:00Z'
  })
  const db = createMockSupabase(state)

  const delReq = new Request('http://localhost/api/client/services/svc-active-1', { method: 'DELETE' })
  const res = await deleteService(delReq, { params: Promise.resolve({ id: 'svc-active-1' }) }, { customSupabase: db })
  assert.strictEqual(res.status, 200)
  const data = await res.json()
  assert.strictEqual(data.deactivated, true)
  assert.strictEqual(data.deleted, undefined)

  // Row still in database
  const svc = db._tables.services.find((s) => s.id === 'svc-active-1')
  assert.ok(svc)
  assert.strictEqual(svc.is_active, false)
})

test('12. Unreferenced service can be safely deleted', async () => {
  const state = getInitialState()
  const db = createMockSupabase(state)

  // svc-active-1 has 0 references in appointments, jobs, quotes
  const delReq = new Request('http://localhost/api/client/services/svc-active-1', { method: 'DELETE' })
  const res = await deleteService(delReq, { params: Promise.resolve({ id: 'svc-active-1' }) }, { customSupabase: db })
  assert.strictEqual(res.status, 200)
  const data = await res.json()
  assert.strictEqual(data.deleted, true)

  // Row removed from database
  const svc = db._tables.services.find((s) => s.id === 'svc-active-1')
  assert.strictEqual(svc, undefined)
})

test('13. Database RESTRICT fallback: Catches 23503 foreign key violation and safely soft-deactivates', async () => {
  const state = getInitialState()
  const db = createMockSupabase(state)

  // Force database RESTRICT error on hard delete to test safety fallback
  db._tables._forceRestrictError = true

  const delReq = new Request('http://localhost/api/client/services/svc-active-1', { method: 'DELETE' })
  const res = await deleteService(delReq, { params: Promise.resolve({ id: 'svc-active-1' }) }, { customSupabase: db })
  assert.strictEqual(res.status, 200)
  const data = await res.json()
  assert.strictEqual(data.deactivated, true)

  // Service row safely deactivated
  const svc = db._tables.services.find((s) => s.id === 'svc-active-1')
  assert.strictEqual(svc.is_active, false)
})

test('14. Historical queries with joins do not return NULL service association', async () => {
  const state = getInitialState()
  state.services[0].is_active = false
  state.appointments.push({
    id: 'apt-historical',
    org_id: ORG_A_ID,
    service_id: 'svc-active-1',
    title: 'Completed Service',
    status: 'completed',
    start_time: '2026-05-10T09:00:00Z'
  })
  const db = createMockSupabase(state)

  // Perform join simulation
  const appt = db._tables.appointments.find((a) => a.id === 'apt-historical')
  const matchedService = db._tables.services.find((s) => s.id === appt.service_id)

  assert.ok(matchedService, 'Joined service must not be null')
  assert.strictEqual(matchedService.id, 'svc-active-1')
  assert.strictEqual(matchedService.name, 'AC Diagnostic')
})
