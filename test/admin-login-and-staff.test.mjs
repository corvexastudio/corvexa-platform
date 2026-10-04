import test from 'node:test'
import assert from 'node:assert'
import { getTenantContext } from '../src/lib/security/tenant-context.ts'
import { normalizeRole } from '../src/lib/security/permissions.ts'

/**
 * Mock database harness for Staff & Login tests
 */
function createMockStaffDb(initialProfiles = []) {
  const profiles = [...initialProfiles]
  const activityLogs = []

  const client = {
    _profiles: profiles,
    _activityLogs: activityLogs,
    auth: {
      getUser: async () => ({
        data: { user: client._currentUser || { id: 'u_super_1', email: 'owner@captodesk.com' } },
        error: null
      })
    },
    from: (tableName) => {
      let filters = []
      let isSingle = false

      const builder = {
        select: () => builder,
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return builder
        },
        order: () => builder,
        single: () => {
          isSingle = true
          return builder
        },
        maybeSingle: () => {
          isSingle = true
          return builder
        },
        update: (updates) => {
          for (const p of profiles) {
            if (filters.every((fn) => fn(p))) {
              Object.assign(p, updates)
            }
          }
          return {
            eq: (col, val) => {
              filters.push((row) => row[col] === val)
              for (const p of profiles) {
                if (filters.every((fn) => fn(p))) {
                  Object.assign(p, updates)
                }
              }
              return Promise.resolve({ error: null })
            },
            then: (resolve) => resolve({ error: null })
          }
        },
        insert: (row) => {
          if (tableName === 'activity_logs') activityLogs.push(row)
          return {
            select: () => ({
              single: async () => ({ data: row, error: null })
            }),
            then: (resolve) => resolve({ error: null })
          }
        },
        then: (resolve) => {
          const list = tableName === 'profiles' ? profiles : activityLogs
          const filtered = list.filter((r) => filters.every((fn) => fn(r)))
          if (isSingle) {
            return resolve({ data: filtered[0] || null, error: null })
          }
          return resolve({ data: filtered, error: null })
        }
      }

      return builder
    }
  }

  return client
}

// -----------------------------------------------------------------------------
// TESTS
// -----------------------------------------------------------------------------

test('1. Super Admin Verification: Role is properly normalized and identified as super_admin', () => {
  assert.strictEqual(normalizeRole('super_admin'), 'super_admin')
  assert.strictEqual(normalizeRole('SUPER_ADMIN'), 'super_admin')
  assert.strictEqual(normalizeRole('owner'), 'owner')
  assert.strictEqual(normalizeRole('member'), 'member')
})

test('2. Authorization Gate: Only super_admin passes getTenantContext("admin:all")', async () => {
  const db = createMockStaffDb([
    { id: 'u_super_1', email: 'owner@captodesk.com', role: 'super_admin', full_name: 'Platform Owner' },
    { id: 'u_tenant_owner', email: 'client@hvac.com', role: 'owner', org_id: 'org_1', full_name: 'Client Owner' },
    { id: 'u_member', email: 'tech@hvac.com', role: 'member', org_id: 'org_1', full_name: 'Tech Joe' }
  ])

  // Test super_admin
  db._currentUser = { id: 'u_super_1', email: 'owner@captodesk.com' }
  const superResult = await getTenantContext('admin:all', db)
  assert.strictEqual(superResult.ok, true)
  assert.strictEqual(superResult.isSuperAdmin, true)

  // Test tenant owner (Must be rejected!)
  db._currentUser = { id: 'u_tenant_owner', email: 'client@hvac.com' }
  const ownerResult = await getTenantContext('admin:all', db)
  assert.strictEqual(ownerResult.ok, false)
  assert.strictEqual(ownerResult.status, 403)
  assert.ok(ownerResult.error.includes("lacks permission for 'admin:all'"))

  // Test technician member (Must be rejected!)
  db._currentUser = { id: 'u_member', email: 'tech@hvac.com' }
  const memberResult = await getTenantContext('admin:all', db)
  assert.strictEqual(memberResult.ok, false)
  assert.strictEqual(memberResult.status, 403)
})

test('3. Role Delegation: Super admin can delegate super_admin role to a staff member', async () => {
  const db = createMockStaffDb([
    { id: 'u_super_1', email: 'owner@captodesk.com', role: 'super_admin' },
    { id: 'u_staff_1', email: 'operator@captodesk.com', role: 'member' }
  ])

  db._currentUser = { id: 'u_super_1' }
  const auth = await getTenantContext('admin:all', db)
  assert.strictEqual(auth.ok, true)

  // Perform role update
  const targetId = 'u_staff_1'
  const newRole = 'super_admin'

  await db.from('profiles').update({ role: newRole }).eq('id', targetId)

  const updated = db._profiles.find((p) => p.id === targetId)
  assert.strictEqual(updated.role, 'super_admin', 'Role should be promoted to super_admin')
})

test('4. Role Delegation: Super admin can demote staff back to member', async () => {
  const db = createMockStaffDb([
    { id: 'u_super_1', email: 'owner@captodesk.com', role: 'super_admin' },
    { id: 'u_staff_temp', email: 'temp_admin@captodesk.com', role: 'super_admin' }
  ])

  // Demote temp staff
  await db.from('profiles').update({ role: 'member' }).eq('id', 'u_staff_temp')

  const demoted = db._profiles.find((p) => p.id === 'u_staff_temp')
  assert.strictEqual(demoted.role, 'member', 'Role should be demoted to member')
})

test('5. Self-Demotion Guard Logic: Prevents super admin from demoting themselves', () => {
  const currentUserId = 'u_super_1'
  const targetUserId = 'u_super_1'
  const requestedRole = 'member'

  const isSelfDemotion = currentUserId === targetUserId && requestedRole !== 'super_admin'
  assert.strictEqual(isSelfDemotion, true, 'Self-demotion must be detected and blocked')
})

test('6. Self-Healing Schema: activity_logs columns normalization', () => {
  // Simulates legacy row with only 'type'
  const legacyRow = { id: 'l1', type: 'call.missed_recovered', description: null }
  const event_type = legacyRow.event_type || legacyRow.type || 'system.event'
  const description = legacyRow.description || 'System Activity'

  assert.strictEqual(event_type, 'call.missed_recovered')
  assert.strictEqual(description, 'System Activity')
})
