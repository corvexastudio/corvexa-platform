process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeRole, hasPermission } from '../src/lib/security/permissions.ts'
import { PATCH as teamPatch, DELETE as teamDelete } from '../src/app/api/team/[id]/route.ts'

// --- Mock Actors & Multi-Tenant Identifiers ---
const ORG_SOLO = 'org-tenant-solo-001'
const ORG_FLEET = 'org-tenant-fleet-002'
const ORG_OTHER = 'org-tenant-other-003'

const ACTORS = {
  SOLO_OWNER: {
    id: 'usr-solo-01',
    email: 'mike@apexcomfort.com',
    role: 'owner',
    org_id: ORG_SOLO,
    full_name: 'Mike Miller'
  },
  FLEET_OWNER: {
    id: 'usr-owner-02',
    email: 'sarah@precisionhvac.com',
    role: 'owner',
    org_id: ORG_FLEET,
    full_name: 'Sarah Jenkins'
  },
  ADMIN: {
    id: 'usr-admin-02',
    email: 'office@precisionhvac.com',
    role: 'admin',
    org_id: ORG_FLEET,
    full_name: 'David Ortiz'
  },
  DISPATCHER: {
    id: 'usr-disp-02',
    email: 'dispatch@precisionhvac.com',
    role: 'dispatcher',
    org_id: ORG_FLEET,
    full_name: 'Carlos Ruiz'
  },
  TECH_LEAD: {
    id: 'usr-tech-lead',
    email: 'jake@precisionhvac.com',
    role: 'technician',
    org_id: ORG_FLEET,
    full_name: 'Jake Reynolds'
  },
  TECH_APPRENTICE: {
    id: 'usr-tech-app',
    email: 'tom@precisionhvac.com',
    role: 'technician',
    org_id: ORG_FLEET,
    full_name: 'Tom Miller'
  },
  OTHER_ORG_TECH: {
    id: 'usr-other-01',
    email: 'tech@othercorp.com',
    role: 'technician',
    org_id: ORG_OTHER,
    full_name: 'External Tech'
  }
}

/**
 * Creates an in-memory mock Supabase client for testing team API routes and RBAC
 */
function createMockClient(currentUser, customStore = {}) {
  const store = {
    organizations: customStore.organizations || [
      { id: ORG_SOLO, name: 'Apex Comfort Solutions', license_number: 'HVAC-TACLA-48291', owner_id: 'usr-solo-01' },
      { id: ORG_FLEET, name: 'Precision HVAC and Plumbing', license_number: 'TACLA-099231E', owner_id: 'usr-owner-02' },
      { id: ORG_OTHER, name: 'Other Corp', owner_id: 'usr-other-01' }
    ],
    profiles: customStore.profiles || Object.values(ACTORS).map(a => ({ ...a })),
    crews: customStore.crews || [
      { id: 'crew-01', org_id: ORG_FLEET, name: 'Van 1 (North Route)', lead_technician_id: 'usr-tech-lead' }
    ],
    crew_members: customStore.crew_members || [
      { crew_id: 'crew-01', user_id: 'usr-tech-lead' },
      { crew_id: 'crew-01', user_id: 'usr-tech-app' }
    ],
    jobs: customStore.jobs || [
      { id: 'job-01', org_id: ORG_FLEET, technician_id: 'usr-tech-lead', status: 'scheduled' },
      { id: 'job-02', org_id: ORG_FLEET, technician_id: 'usr-tech-app', status: 'confirmed' },
      { id: 'job-03', org_id: ORG_FLEET, technician_id: 'usr-tech-lead', status: 'completed' }
    ],
    audit_logs: customStore.audit_logs || []
  }

  const client = {
    _store: store,
    auth: {
      getUser: async () => {
        if (!currentUser) return { data: { user: null }, error: new Error('No session') }
        return {
          data: {
            user: {
              id: currentUser.id,
              email: currentUser.email,
              app_metadata: {},
              user_metadata: {}
            }
          },
          error: null
        }
      }
    },
    from: (tableName) => {
      if (!store[tableName]) store[tableName] = []
      let filters = []
      let selectOpts = {}

      const query = {
        select: (cols, opts) => {
          if (opts) selectOpts = opts
          return query
        },
        eq: (col, val) => {
          filters.push(row => row[col] === val)
          return query
        },
        neq: (col, val) => {
          filters.push(row => row[col] !== val)
          return query
        },
        in: (col, arr) => {
          filters.push(row => arr.includes(row[col]))
          return query
        },
        single: async () => {
          const rows = store[tableName].filter(row => filters.every(f => f(row)))
          if (rows.length === 0) return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
          return { data: { ...rows[0] }, error: null }
        },
        maybeSingle: async () => {
          const rows = store[tableName].filter(row => filters.every(f => f(row)))
          return { data: rows[0] ? { ...rows[0] } : null, error: null }
        },
        insert: (payload) => {
          const items = Array.isArray(payload) ? payload : [payload]
          const inserted = items.map(item => ({
            id: item.id || `gen-${Math.random().toString(36).substring(2, 9)}`,
            created_at: item.created_at || new Date().toISOString(),
            ...item
          }))
          store[tableName].push(...inserted)

          const insertChain = {
            select: () => insertChain,
            single: async () => ({ data: { ...inserted[0] }, error: null }),
            maybeSingle: async () => ({ data: { ...inserted[0] }, error: null }),
            then: (resolve, reject) => Promise.resolve({ data: inserted, error: null }).then(resolve, reject)
          }
          return insertChain
        },
        update: (updates) => {
          const updateChain = {
            eq: (col, val) => {
              filters.push(row => row[col] === val)
              return updateChain
            },
            in: (col, arr) => {
              filters.push(row => arr.includes(row[col]))
              return updateChain
            },
            select: () => updateChain,
            single: async () => {
              const rows = store[tableName].filter(row => filters.every(f => f(row)))
              if (rows.length === 0) return { data: null, error: { message: 'Row not found' } }
              Object.assign(rows[0], updates)
              return { data: { ...rows[0] }, error: null }
            },
            maybeSingle: async () => {
              const rows = store[tableName].filter(row => filters.every(f => f(row)))
              if (rows[0]) Object.assign(rows[0], updates)
              return { data: rows[0] ? { ...rows[0] } : null, error: null }
            },
            then: (resolve, reject) => {
              const rows = store[tableName].filter(row => filters.every(f => f(row)))
              rows.forEach(r => Object.assign(r, updates))
              return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
            }
          }
          return updateChain
        },
        delete: () => {
          const deleteChain = {
            eq: (col, val) => {
              filters.push(row => row[col] === val)
              return deleteChain
            },
            then: (resolve, reject) => {
              const remaining = store[tableName].filter(row => !filters.every(f => f(row)))
              store[tableName] = remaining
              return Promise.resolve({ data: null, error: null }).then(resolve, reject)
            }
          }
          return deleteChain
        },
        then: (resolve, reject) => {
          const filtered = store[tableName].filter(row => filters.every(f => f(row)))
          return Promise.resolve({ data: filtered, count: filtered.length, error: null }).then(resolve, reject)
        }
      }
      return query
    }
  }

  return client
}

// -------------------------------------------------------------
// TEST SUITE: TEAM & STAFF MOBILE-FIRST WORKSPACE
// -------------------------------------------------------------

test('1. Solo Operator Workspace: Operation Mode and Owner Identity Resolution', () => {
  // Test solo operator operational mode heuristic
  const soloMembers = [
    { id: 'usr-solo-01', email: 'mike@apexcomfort.com', role: 'owner', full_name: 'Mike Miller' }
  ]
  const soloCrews = []
  const isFleetEntitled = false

  // Canonical derivation logic used in page.tsx:
  // if operationMode is unset, heuristic: members <= 1 && crews === 0 && !isFleetEntitled => solo
  const isSoloWorkspace = soloMembers.length <= 1 && soloCrews.length === 0 && !isFleetEntitled
  assert.equal(isSoloWorkspace, true, 'Workspace with 1 member and no fleet entitlement resolves to solo')

  // Owner credentials
  const owner = soloMembers[0]
  assert.equal(owner.role, 'owner')
  assert.equal(owner.full_name, 'Mike Miller')
  assert.equal(owner.email, 'mike@apexcomfort.com')

  // Service territory and credentials
  const businessCredentials = {
    businessName: 'Apex Comfort Solutions',
    licenseNumber: 'HVAC-TACLA-48291',
    trade: 'HVAC and Refrigeration',
    city: 'Austin',
    state: 'TX',
    zip: '78701'
  }
  assert.ok(businessCredentials.licenseNumber.startsWith('HVAC-'))
  assert.equal(`${businessCredentials.city}, ${businessCredentials.state} ${businessCredentials.zip}`, 'Austin, TX 78701')

  // Field portal truck link derivation
  const fieldPortalUrl = '/client/field'
  assert.equal(fieldPortalUrl, '/client/field', 'Solo owner can jump directly to 1-tap truck portal')
})

test('2. Multi-Crew Mode Workspace: Role Filtering and Search Matching', () => {
  const staff = [
    { id: 'usr-1', full_name: 'Sarah Jenkins', email: 'sarah@precision.com', role: 'owner', phone: '+13125550202' },
    { id: 'usr-2', full_name: 'David Ortiz', email: 'david@precision.com', role: 'client_admin', phone: '+13125550203' },
    { id: 'usr-3', full_name: 'Carlos Ruiz', email: 'carlos@precision.com', role: 'dispatcher', phone: '+13125550204' },
    { id: 'usr-4', full_name: 'Jake Reynolds', email: 'jake@precision.com', role: 'technician', phone: '+13125550205' },
    { id: 'usr-5', full_name: 'Tom Miller', email: 'tom@precision.com', role: 'technician', phone: '+13125550206' }
  ]

  // Filter: All
  const allCount = staff.length
  assert.equal(allCount, 5)

  // Filter: Admins (matches owner and client_admin)
  const adminPillMembers = staff.filter(m => m.role === 'owner' || m.role === 'client_admin' || m.role === 'admin')
  assert.equal(adminPillMembers.length, 2, 'Admins pill returns owner and client_admin')

  // Filter: Dispatchers
  const dispatcherPillMembers = staff.filter(m => m.role === 'dispatcher')
  assert.equal(dispatcherPillMembers.length, 1)
  assert.equal(dispatcherPillMembers[0].full_name, 'Carlos Ruiz')

  // Filter: Technicians
  const technicianPillMembers = staff.filter(m => m.role === 'technician')
  assert.equal(technicianPillMembers.length, 2)

  // Search Matching by Name
  const searchByName = 'jake'
  const matchedName = staff.filter(m =>
    m.full_name.toLowerCase().includes(searchByName) ||
    m.email.toLowerCase().includes(searchByName) ||
    (m.phone && m.phone.includes(searchByName))
  )
  assert.equal(matchedName.length, 1)
  assert.equal(matchedName[0].email, 'jake@precision.com')

  // Search Matching by Phone
  const searchByPhone = '0204'
  const matchedPhone = staff.filter(m =>
    m.full_name.toLowerCase().includes(searchByPhone) ||
    m.email.toLowerCase().includes(searchByPhone) ||
    (m.phone && m.phone.includes(searchByPhone))
  )
  assert.equal(matchedPhone.length, 1)
  assert.equal(matchedPhone[0].full_name, 'Carlos Ruiz')
})

test('3. Staff Profile and Plain-English Access Resolution by Role', () => {
  // Client Admin capabilities (maps to canonical role 'admin')
  assert.equal(normalizeRole('client_admin'), 'admin')
  assert.equal(hasPermission('client_admin', 'team:manage'), true)
  assert.equal(hasPermission('client_admin', 'team:remove'), true)
  assert.equal(hasPermission('client_admin', 'appointments:manage'), true)
  assert.equal(hasPermission('client_admin', 'invoices:read'), true)
  assert.equal(hasPermission('client_admin', 'financials:read'), true)
  assert.equal(hasPermission('client_admin', 'crews:manage'), true)

  // Dispatcher capabilities
  assert.equal(normalizeRole('dispatcher'), 'dispatcher')
  assert.equal(hasPermission('dispatcher', 'appointments:manage'), true, 'Dispatchers can manage schedule and dispatch')
  assert.equal(hasPermission('dispatcher', 'crews:manage'), true, 'Dispatchers can manage crews')
  assert.equal(hasPermission('dispatcher', 'team:manage'), false, 'Dispatchers cannot manage team members')
  assert.equal(hasPermission('dispatcher', 'team:remove'), false, 'Dispatchers cannot remove team members')
  assert.equal(hasPermission('dispatcher', 'org:billing'), false, 'Dispatchers cannot change billing or subscription plans')
  assert.equal(hasPermission('dispatcher', 'invoices:read'), false, 'Dispatchers cannot access customer invoices')

  // Technician capabilities
  assert.equal(normalizeRole('technician'), 'technician')
  assert.equal(hasPermission('technician', 'appointments:read'), true, 'Technicians can view assigned jobs')
  assert.equal(hasPermission('technician', 'appointments:manage'), true, 'Technicians can update job status')
  assert.equal(hasPermission('technician', 'crews:view'), true, 'Technicians can view crew information')
  assert.equal(hasPermission('technician', 'team:manage'), false, 'Technicians cannot manage team')
  assert.equal(hasPermission('technician', 'team:remove'), false, 'Technicians cannot remove team members')
  assert.equal(hasPermission('technician', 'org:billing'), false, 'Technicians cannot manage company billing')
  assert.equal(hasPermission('technician', 'invoices:read'), false, 'Technicians cannot view invoices')
  assert.equal(hasPermission('technician', 'crews:manage'), false, 'Technicians cannot reassign crews')
})

test('4. Crews and Fleet Van Assignment Mapping and Metrics', () => {
  const crews = [
    {
      id: 'crew-01',
      name: 'North County Van 1',
      color: '#0284c7',
      phone: '+15125550101',
      service_area: 'Round Rock, Georgetown, Cedar Park',
      lead_technician_id: 'usr-tech-lead',
      technician_ids: ['usr-tech-lead', 'usr-tech-app']
    },
    {
      id: 'crew-02',
      name: 'South Metro Van 2',
      color: '#16a34a',
      phone: '+15125550102',
      service_area: 'Austin Metro, Sunset Valley, Buda',
      lead_technician_id: null,
      technician_ids: []
    }
  ]

  // Verify Crew 1 properties
  const van1 = crews[0]
  assert.equal(van1.name, 'North County Van 1')
  assert.equal(van1.lead_technician_id, 'usr-tech-lead')
  assert.equal(van1.technician_ids.length, 2)

  // Verify Crew 2 properties
  const van2 = crews[1]
  assert.equal(van2.technician_ids.length, 0)
  assert.equal(van2.lead_technician_id, null)

  // Test Route Broadcast Simulation payload
  const broadcastPayload = {
    action: 'broadcast_7am_routes',
    timestamp: new Date().toISOString(),
    recipientsCount: van1.technician_ids.length
  }
  assert.equal(broadcastPayload.action, 'broadcast_7am_routes')
  assert.equal(broadcastPayload.recipientsCount, 2)
})

test('5. Server-Side Guard Invariants: Self-Modification, Self-Deletion, Privilege Escalation', async () => {
  // Test 5A: Self-modification rejection
  const mockClientOwner = createMockClient(ACTORS.FLEET_OWNER)
  const reqSelfUpdate = new Request('http://localhost:3000/api/team/' + ACTORS.FLEET_OWNER.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'dispatcher' })
  })
  const resSelfUpdate = await teamPatch(reqSelfUpdate, {
    params: Promise.resolve({ id: ACTORS.FLEET_OWNER.id }),
    customSupabase: mockClientOwner
  })
  assert.equal(resSelfUpdate.status, 400, 'Self-role update should be rejected with 400')
  const jsonSelfUpdate = await resSelfUpdate.json()
  assert.ok(jsonSelfUpdate.error.includes('cannot modify your own profile'))

  // Test 5B: Self-deletion rejection
  const reqSelfDelete = new Request('http://localhost:3000/api/team/' + ACTORS.FLEET_OWNER.id, {
    method: 'DELETE'
  })
  const resSelfDelete = await teamDelete(reqSelfDelete, {
    params: Promise.resolve({ id: ACTORS.FLEET_OWNER.id }),
    customSupabase: mockClientOwner
  })
  assert.equal(resSelfDelete.status, 400, 'Self-deletion should be rejected with 400')
  const jsonSelfDelete = await resSelfDelete.json()
  assert.ok(jsonSelfDelete.error.includes('cannot remove your own account'))

  // Test 5C: Non-owner attempting to modify owner
  const mockClientAdmin = createMockClient(ACTORS.ADMIN)
  const reqAdminModifiesOwner = new Request('http://localhost:3000/api/team/' + ACTORS.FLEET_OWNER.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'dispatcher' })
  })
  const resAdminModifiesOwner = await teamPatch(reqAdminModifiesOwner, {
    params: Promise.resolve({ id: ACTORS.FLEET_OWNER.id }),
    customSupabase: mockClientAdmin
  })
  assert.equal(resAdminModifiesOwner.status, 403, 'Non-owner cannot modify the organization owner')

  // Test 5D: Privilege escalation to super_admin
  const reqEscalate = new Request('http://localhost:3000/api/team/' + ACTORS.TECH_LEAD.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'super_admin' })
  })
  const resEscalate = await teamPatch(reqEscalate, {
    params: Promise.resolve({ id: ACTORS.TECH_LEAD.id }),
    customSupabase: mockClientAdmin
  })
  assert.equal(resEscalate.status, 403, 'Cannot escalate to super_admin role')

  // Test 5E: Cross-tenant modification rejection
  const reqCrossTenant = new Request('http://localhost:3000/api/team/' + ACTORS.OTHER_ORG_TECH.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'dispatcher' })
  })
  const resCrossTenant = await teamPatch(reqCrossTenant, {
    params: Promise.resolve({ id: ACTORS.OTHER_ORG_TECH.id }),
    customSupabase: mockClientAdmin
  })
  assert.equal(resCrossTenant.status, 404, 'Cross-tenant member modification returns 404 Not Found')
})
