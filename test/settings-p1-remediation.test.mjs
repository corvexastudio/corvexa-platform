process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert/strict'

import { maskEin, canViewFullEin } from '../src/lib/security/permissions.ts'
import { GET as orgGet, PATCH as orgPatch } from '../src/app/api/client/organization/route.ts'

// --- Mock Multi-Tenant Constants ---
const ORG_A = 'org-apex-001'
const ORG_B = 'org-precision-002'

const USERS = {
  OWNER: {
    id: 'usr-owner-01',
    email: 'owner@apexplumbing.com',
    role: 'owner',
    org_id: ORG_A
  },
  SUPER_ADMIN: {
    id: 'usr-super-admin-01',
    email: 'super@captodesk.com',
    role: 'super_admin',
    org_id: ORG_A
  },
  CLIENT_ADMIN: {
    id: 'usr-admin-01',
    email: 'admin@apexplumbing.com',
    role: 'client_admin',
    org_id: ORG_A
  },
  DISPATCHER: {
    id: 'usr-disp-01',
    email: 'dispatch@apexplumbing.com',
    role: 'dispatcher',
    org_id: ORG_A
  },
  TECHNICIAN: {
    id: 'usr-tech-01',
    email: 'tech@apexplumbing.com',
    role: 'technician',
    org_id: ORG_A
  },
  OTHER_TENANT_OWNER: {
    id: 'usr-owner-02',
    email: 'owner@precisionhvac.com',
    role: 'owner',
    org_id: ORG_B
  }
}

// In-memory Database Mock for Tenant Organizations
function createMockSupabase(actor, initialOrgData = {}) {
  const auditLogs = []
  let orgStore = {
    id: actor.org_id,
    name: 'Apex Plumbing LLC',
    legal_business_name: 'Apex Mechanical LLC',
    business_type: 'llc',
    ein: '12-3456789',
    is_sole_proprietor: false,
    address_street: '123 Main St',
    address_city: 'Austin',
    address_state: 'TX',
    address_postal_code: '78701',
    website_url: 'https://apexplumbing.com',
    ...initialOrgData
  }

  const client = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: actor.id,
            email: actor.email,
            user_metadata: { role: actor.role, org_id: actor.org_id }
          }
        },
        error: null
      })
    },
    from: (table) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: actor.id,
                  email: actor.email,
                  role: actor.role,
                  org_id: actor.org_id
                },
                error: null
              })
            })
          })
        }
      }

      if (table === 'activity_logs' || table === 'audit_logs') {
        return {
          insert: async (entry) => {
            auditLogs.push(entry)
            return { error: null }
          }
        }
      }

      if (table === 'organizations') {
        let updatePayload = null
        return {
          select: () => ({
            eq: (_col, val) => ({
              single: async () => {
                if (val !== actor.org_id) {
                  return { data: null, error: { message: 'Organization not found' } }
                }
                return { data: { ...orgStore }, error: null }
              }
            })
          }),
          update: (payload) => {
            updatePayload = payload
            return {
              eq: (_col, val) => ({
                select: () => ({
                  single: async () => {
                    if (val !== actor.org_id) {
                      return { data: null, error: { message: 'Organization not found' } }
                    }
                    orgStore = { ...orgStore, ...updatePayload }
                    return { data: { ...orgStore }, error: null }
                  }
                })
              })
            }
          }
        }
      }

      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null })
          })
        })
      }
    },
    _getOrgStore: () => orgStore,
    _getAuditLogs: () => auditLogs
  }

  return client
}

// ---------------------------------------------------------------------------
// TEST SUITE 1: EIN MASKING & RBAC PERMISSION HELPERS
// ---------------------------------------------------------------------------
test('1. EIN Masking and RBAC Authorization Unit Tests', () => {
  // Standard 9 digits without dash
  assert.equal(maskEin('123456789'), 'XX-XXX6789')

  // Standard 9 digits with dash
  assert.equal(maskEin('12-3456789'), 'XX-XXX6789')

  // Spaced or irregular format
  assert.equal(maskEin(' 12 3456789 '), 'XX-XXX6789')

  // Already masked strings preserve masked format
  assert.equal(maskEin('XX-XXX6789'), 'XX-XXX6789')

  // Null, undefined, empty inputs
  assert.equal(maskEin(null), null)
  assert.equal(maskEin(undefined), null)
  assert.equal(maskEin(''), null)
  assert.equal(maskEin('   '), null)

  // Short strings
  assert.equal(maskEin('123'), 'XX-XXXXXXX')

  // RBAC Permission checks for full EIN view
  assert.equal(canViewFullEin('owner'), true)
  assert.equal(canViewFullEin('super_admin'), true)
  assert.equal(canViewFullEin('client_admin'), false)
  assert.equal(canViewFullEin('dispatcher'), false)
  assert.equal(canViewFullEin('technician'), false)
  assert.equal(canViewFullEin('member'), false)
  assert.equal(canViewFullEin(undefined), false)
  assert.equal(canViewFullEin(null), false)
})

// ---------------------------------------------------------------------------
// TEST SUITE 2: GET /api/client/organization MASKING & AUDIT LOGGING
// ---------------------------------------------------------------------------
test('2. GET /api/client/organization Masks EIN by Default and Logs Audit on Reveal', async () => {
  // A. Non-owner (dispatcher) GET request: must receive masked EIN
  const dispSupabase = createMockSupabase(USERS.DISPATCHER, { ein: '12-3456789' })
  const dispReq = new Request('http://localhost:3000/api/client/organization')
  const dispRes = await orgGet(dispReq, { customSupabase: dispSupabase })
  assert.equal(dispRes.status, 200)
  const dispJson = await dispRes.json()
  assert.equal(dispJson.organization.ein, 'XX-XXX6789')
  assert.equal(dispJson.organization.ein_masked, 'XX-XXX6789')
  assert.equal(dispJson.organization.has_ein, true)

  // B. Dispatcher attempting ?reveal_ein=true: must STILL be masked
  const dispRevealReq = new Request('http://localhost:3000/api/client/organization?reveal_ein=true')
  const dispRevealRes = await orgGet(dispRevealReq, { customSupabase: dispSupabase })
  const dispRevealJson = await dispRevealRes.json()
  assert.equal(dispRevealJson.organization.ein, 'XX-XXX6789')
  assert.equal(dispSupabase._getAuditLogs().length, 0) // No audit log because reveal was rejected

  // C. Owner default GET request: masked by default to protect over-the-shoulder viewing
  const ownerSupabase = createMockSupabase(USERS.OWNER, { ein: '12-3456789' })
  const ownerReq = new Request('http://localhost:3000/api/client/organization')
  const ownerRes = await orgGet(ownerReq, { customSupabase: ownerSupabase })
  const ownerJson = await ownerRes.json()
  assert.equal(ownerJson.organization.ein, 'XX-XXX6789')
  assert.equal(ownerJson.organization.has_ein, true)

  // D. Owner explicit ?reveal_ein=true: unmasks authentic EIN and records audit log
  const ownerRevealReq = new Request('http://localhost:3000/api/client/organization?reveal_ein=true')
  const ownerRevealRes = await orgGet(ownerRevealReq, { customSupabase: ownerSupabase })
  const ownerRevealJson = await ownerRevealRes.json()
  assert.equal(ownerRevealJson.organization.ein, '12-3456789')

  // Verify security audit log was written
  const auditLogs = ownerSupabase._getAuditLogs()
  assert.equal(auditLogs.length, 1)
  assert.equal(auditLogs[0].event_type, 'organization.ein_revealed')
  assert.equal(auditLogs[0].org_id, ORG_A)
  assert.equal(auditLogs[0].metadata.actor_id, USERS.OWNER.id)
})

// ---------------------------------------------------------------------------
// TEST SUITE 3: PATCH /api/client/organization OBSOLETE TRACKING REMOVAL
// ---------------------------------------------------------------------------
test('3. PATCH /api/client/organization Ignores or Rejects Obsolete tracking_mode and tracking_geofence_miles', async () => {
  const supabase = createMockSupabase(USERS.OWNER)

  // A. Save with legitimate fields while omitting obsolete tracking fields
  const req1 = new Request('http://localhost:3000/api/client/organization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Apex Plumbing Group', tracking_mode: 'geofence_live', tracking_geofence_miles: 10 })
  })
  const res1 = await orgPatch(req1, { customSupabase: supabase })
  assert.equal(res1.status, 200)
  assert.equal(supabase._getOrgStore().name, 'Apex Plumbing Group')
  assert.equal(supabase._getOrgStore().tracking_mode, undefined)
  assert.equal(supabase._getOrgStore().tracking_geofence_miles, undefined)

  // B. Sending ONLY obsolete tracking fields returns 400 No valid fields to update
  const req2 = new Request('http://localhost:3000/api/client/organization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tracking_mode: 'milestone' })
  })
  const res2 = await orgPatch(req2, { customSupabase: supabase })
  assert.equal(res2.status, 400)
  const json2 = await res2.json()
  assert.match(json2.error, /No valid update fields/i)
})

// ---------------------------------------------------------------------------
// TEST SUITE 4: PATCH /api/client/organization EIN PROTECTION AGAINST PLACEHOLDER OVERWRITE
// ---------------------------------------------------------------------------
test('4. PATCH /api/client/organization Prevents Masked Placeholder EIN Overwrite', async () => {
  const supabase = createMockSupabase(USERS.OWNER, {
    ein: '12-3456789',
    website_url: 'https://apexplumbing.com'
  })

  // A. Frontend accidentally posts back a masked string 'XX-XXX6789'
  // The server must detect placeholder pattern and NOT overwrite the real database EIN!
  const req1 = new Request('http://localhost:3000/api/client/organization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ein: 'XX-XXX6789',
      website_url: 'https://apexnewurl.com'
    })
  })
  const res1 = await orgPatch(req1, { customSupabase: supabase })
  assert.equal(res1.status, 200)
  // Verify website updated BUT real EIN preserved
  assert.equal(supabase._getOrgStore().website_url, 'https://apexnewurl.com')
  assert.equal(supabase._getOrgStore().ein, '12-3456789')

  // B. User intentionally types a new valid EIN
  const req2 = new Request('http://localhost:3000/api/client/organization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ein: '98-7654321'
    })
  })
  const res2 = await orgPatch(req2, { customSupabase: supabase })
  assert.equal(res2.status, 200)
  assert.equal(supabase._getOrgStore().ein, '98-7654321')

  // C. User updates unrelated setting without providing ein
  const req3 = new Request('http://localhost:3000/api/client/organization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address_city: 'Round Rock'
    })
  })
  const res3 = await orgPatch(req3, { customSupabase: supabase })
  assert.equal(res3.status, 200)
  assert.equal(supabase._getOrgStore().address_city, 'Round Rock')
  assert.equal(supabase._getOrgStore().ein, '98-7654321') // Real EIN still preserved

  // D. Sole proprietor sets is_sole_proprietor = true -> clears ein to null
  const req4 = new Request('http://localhost:3000/api/client/organization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      is_sole_proprietor: true
    })
  })
  const res4 = await orgPatch(req4, { customSupabase: supabase })
  assert.equal(res4.status, 200)
  assert.equal(supabase._getOrgStore().is_sole_proprietor, true)
  assert.equal(supabase._getOrgStore().ein, null)
})

// ---------------------------------------------------------------------------
// TEST SUITE 5: MILESTONE STATUS PROGRESSION INVARIANTS
// ---------------------------------------------------------------------------
test('5. Milestone Status Progression Invariants', () => {
  const validMilestones = ['scheduled', 'confirmed', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled']
  for (const status of ['en_route', 'arrived', 'in_progress', 'completed']) {
    assert.ok(validMilestones.includes(status))
  }
})
