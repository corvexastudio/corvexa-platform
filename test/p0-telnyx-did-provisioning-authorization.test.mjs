/**
 * ==============================================================================
 * CAPTODESK — P0 TELNYX DID PROVISIONING AUTHORIZATION REMEDIATION TEST SUITE
 * ==============================================================================
 * Proves that:
 * 1. Normal customer onboarding can NEVER order or purchase a Telnyx number.
 * 2. Onboarding with or without requestedNumber succeeds without any DID order.
 * 3. Telnyx DID provisioning is strictly restricted to Super Admin ('admin:all').
 * 4. Unauthenticated (401), Tenant Owner (403), Admin (403), Member/Dispatcher (403) are denied.
 * 5. Super Admin is authorized with strict route-based org targeting.
 * 6. Body tampering (org_id, status, role, phone_number) is rejected with 400.
 * 7. Non-existent org returns 404; Churned org returns 400.
 * 8. All existing DID protections (idempotency, concurrency locks, state machine) are preserved.
 * 9. All Telnyx requests are mocked; zero real external calls occur.
 * ==============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { POST as onboardingPost } from '../src/app/api/onboarding/route.ts'
import { POST as adminProvisionPost } from '../src/app/api/admin/organizations/[id]/provision-phone/route.ts'

/**
 * In-memory Mock Supabase for Onboarding & Admin Provisioning testing
 */
function createMockSupabase(initialState = {}, currentUser = null) {
  const tables = {
    organizations: initialState.organizations ? JSON.parse(JSON.stringify(initialState.organizations)) : [],
    profiles: initialState.profiles ? JSON.parse(JSON.stringify(initialState.profiles)) : [],
    automation_settings: initialState.automation_settings ? JSON.parse(JSON.stringify(initialState.automation_settings)) : [],
    services: initialState.services ? JSON.parse(JSON.stringify(initialState.services)) : [],
    activity_logs: initialState.activity_logs ? JSON.parse(JSON.stringify(initialState.activity_logs)) : [],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers ? JSON.parse(JSON.stringify(initialState.telnyx_phone_numbers)) : []
  }

  const client = {
    _tables: tables,
    auth: {
      getUser: async () => ({
        data: { user: currentUser },
        error: currentUser ? null : { message: 'Auth session missing' }
      }),
      getSession: async () => ({
        data: { session: currentUser ? { access_token: 'mock-jwt-token' } : null }
      })
    },
    from: (tableName) => {
      if (!tables[tableName]) tables[tableName] = []
      const table = tables[tableName]

      let filters = []
      let pendingUpdates = null

      const builder = {
        select: (fields = '*') => builder,
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return builder
        },
        neq: (col, val) => {
          filters.push((row) => row[col] !== val)
          return builder
        },
        in: (col, vals) => {
          filters.push((row) => vals.includes(row[col]))
          return builder
        },
        order: () => builder,
        limit: () => builder,
        update: (updates) => {
          pendingUpdates = updates
          return builder
        },
        maybeSingle: async () => {
          if (pendingUpdates) {
            const matched = table.filter((r) => filters.every((f) => f(r)))
            for (const row of matched) {
              Object.assign(row, pendingUpdates)
            }
            return { data: matched[0] || null, error: null }
          }
          const filtered = table.filter((r) => filters.every((f) => f(r)))
          return { data: filtered[0] || null, error: null }
        },
        single: async () => {
          const res = await builder.maybeSingle()
          if (!res.data) {
            return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
          }
          return res
        },
        insert: (payload) => {
          const records = Array.isArray(payload) ? payload : [payload]
          const inserted = records.map((r) => ({
            id: r.id || `row_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            ...r
          }))
          table.push(...inserted)
          const resultRow = Array.isArray(payload) ? inserted : inserted[0]
          return {
            data: resultRow,
            error: null,
            select: () => ({
              maybeSingle: async () => ({ data: inserted[0], error: null }),
              single: async () => ({ data: inserted[0], error: null })
            }),
            then: (resolve) => resolve({ data: resultRow, error: null })
          }
        },
        upsert: (record, opts = {}) => {
          const onConflict = opts.onConflict || 'id'
          const conflictCols = onConflict.split(',').map((c) => c.trim())
          const existingIdx = table.findIndex((r) =>
            conflictCols.every((col) => r[col] !== undefined && r[col] === record[col])
          )

          let target
          if (existingIdx >= 0) {
            if (!opts.ignoreDuplicates) {
              Object.assign(table[existingIdx], record)
            }
            target = table[existingIdx]
          } else {
            const newRow = { id: record.id || `row_${Date.now()}`, ...record }
            table.push(newRow)
            target = newRow
          }

          return {
            data: target,
            error: null,
            select: () => ({
              maybeSingle: async () => ({ data: target, error: null }),
              single: async () => ({ data: target, error: null })
            }),
            then: (resolve) => resolve({ data: target, error: null })
          }
        },
        then: (resolve, reject) => {
          try {
            if (pendingUpdates) {
              const matched = table.filter((r) => filters.every((f) => f(r)))
              for (const row of matched) {
                Object.assign(row, pendingUpdates)
              }
              resolve({ data: matched, error: null })
            } else {
              const filtered = table.filter((r) => filters.every((f) => f(r)))
              resolve({ data: filtered, error: null })
            }
          } catch (err) {
            reject(err)
          }
        }
      }

      return builder
    }
  }

  return client
}

/**
 * Creates a mock Telnyx API Client that tracks calls to verify ZERO external calls occur
 */
function createMockTelnyxClient(opts = {}) {
  let orderCount = 0
  let searchCount = 0

  return {
    getOrderCount: () => orderCount,
    getSearchCount: () => searchCount,
    searchAvailableNumbers: async (params) => {
      searchCount++
      if (opts.noNumbersAvailable) return []
      return [
        {
          phoneNumber: opts.mockNumber || '+12145550199',
          recordType: 'available_phone_number',
          features: ['sms', 'voice'],
          locality: 'Dallas',
          region: 'TX'
        }
      ]
    },
    createNumberOrder: async (params) => {
      orderCount++
      if (opts.shouldOrderFail) {
        throw new Error('Carrier rejected order submission')
      }
      return {
        orderId: opts.mockOrderId || `order_test_${orderCount}`,
        status: opts.orderStatus || 'success',
        customerReference: params.customerReference,
        phoneNumbers: [
          {
            id: `num_id_${orderCount}`,
            phoneNumber: params.phoneNumber,
            status: opts.orderStatus || 'success'
          }
        ],
        createdAt: new Date().toISOString()
      }
    },
    getNumberOrder: async (orderId) => ({
      orderId,
      status: opts.orderStatus || 'success',
      phoneNumbers: [{ id: 'num_rec_1', phoneNumber: opts.mockNumber || '+12145550199', status: 'success' }],
      createdAt: new Date().toISOString()
    }),
    findExistingNumberOrderByCustomerReference: async () => null,
    pollNumberOrderUntilSettled: async (orderId) => ({
      orderId,
      status: opts.orderStatus || 'success',
      phoneNumbers: [{ id: 'num_polled_1', phoneNumber: opts.mockNumber || '+12145550199', status: 'success' }],
      createdAt: new Date().toISOString()
    })
  }
}

// Fixed user fixtures
const SUPER_ADMIN = {
  id: 'usr_super_admin',
  email: 'admin@captodesk.com'
}

const NORMAL_OWNER = {
  id: 'usr_normal_owner',
  email: 'owner@normalbiz.com'
}

const TENANT_ADMIN = {
  id: 'usr_tenant_admin',
  email: 'admin@normalbiz.com'
}

const MEMBER_USER = {
  id: 'usr_member_user',
  email: 'dispatcher@normalbiz.com'
}

// Configure test environment
process.env.NODE_ENV = 'test'
process.env.APP_ENV = 'test'
process.env.SUPER_ADMIN_EMAILS = 'admin@captodesk.com'
process.env.TELNYX_API_KEY = 'KEY01_MOCK_TEST_KEY'

// ==============================================================================
// GROUP A: ONBOARDING SECURITY (TASK 2 & TASK 7.A)
// ==============================================================================

test('A1. Signup without requestedNumber: organization created without Telnyx number', async () => {
  const supabase = createMockSupabase({}, NORMAL_OWNER)

  const req = new Request('http://localhost:3000/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'Apex Plumbing',
      phone: '(214) 555-0100'
    })
  })

  const res = await onboardingPost(req, { customSupabase: supabase })
  assert.strictEqual(res.status, 200)
  const body = await res.json()
  assert.strictEqual(body.success, true)
  assert.ok(body.org_id)

  const org = supabase._tables.organizations.find((o) => o.id === body.org_id)
  assert.ok(org)
  assert.strictEqual(org.name, 'Apex Plumbing')
  assert.strictEqual(org.telnyx_phone_number, null, 'telnyx_phone_number must be NULL')
  assert.strictEqual(org.phone_provisioning_status, 'pending_number', 'phone_provisioning_status must be pending_number')
})

test('A2. Signup with requestedNumber: parameter is ignored, NO number ordered, creation succeeds', async () => {
  const supabase = createMockSupabase({}, NORMAL_OWNER)

  const req = new Request('http://localhost:3000/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'Stealth Electric',
      phone: '(512) 555-0155',
      requestedNumber: '+12145550199', // Malicious or legacy client parameter
      telnyxPhoneNumber: '+12145550199'
    })
  })

  const res = await onboardingPost(req, { customSupabase: supabase })
  assert.strictEqual(res.status, 200)
  const body = await res.json()
  assert.strictEqual(body.success, true)

  const org = supabase._tables.organizations.find((o) => o.id === body.org_id)
  assert.ok(org)
  assert.strictEqual(org.telnyx_phone_number, null, 'Must NOT set telnyx_phone_number during onboarding')
  assert.strictEqual(org.phone_provisioning_status, 'pending_number', 'Status must remain pending_number')
  assert.strictEqual(supabase._tables.telnyx_phone_numbers.length, 0, 'Zero records in telnyx_phone_numbers table')
})

test('A3. Customer profile is linked as owner without granting Telnyx DID provisioning', async () => {
  const supabase = createMockSupabase({}, NORMAL_OWNER)

  const req = new Request('http://localhost:3000/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'Roofers Pro'
    })
  })

  const res = await onboardingPost(req, { customSupabase: supabase })
  assert.strictEqual(res.status, 200)
  const body = await res.json()

  const profile = supabase._tables.profiles.find((p) => p.id === NORMAL_OWNER.id)
  assert.ok(profile)
  assert.strictEqual(profile.org_id, body.org_id)
  assert.strictEqual(profile.role, 'owner')
})

// ==============================================================================
// GROUP B: AUTHORIZATION DEFENSE (TASK 3, TASK 4, TASK 7.B)
// ==============================================================================

test('B1. Unauthenticated request to DID provisioning endpoint returns 401', async () => {
  const orgId = 'org_unauth_test'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Target Org', phone_provisioning_status: 'pending_number' }]
  }, null) // Null user -> unauthenticated

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  })

  const res = await adminProvisionPost(req, { params: Promise.resolve({ id: orgId }) }, {
    customSupabase: supabase
  })

  assert.strictEqual(res.status, 401)
  const body = await res.json()
  assert.match(body.error, /Unauthorized/)
})

test('B2. Normal tenant owner request to DID provisioning endpoint is denied with 403', async () => {
  const orgId = 'org_owner_target'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Owner Org', phone_provisioning_status: 'pending_number' }],
    profiles: [{ id: NORMAL_OWNER.id, email: NORMAL_OWNER.email, role: 'owner', org_id: orgId }]
  }, NORMAL_OWNER)

  const mockClient = createMockTelnyxClient()
  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ areaCode: '214' })
  })

  const res = await adminProvisionPost(req, { params: Promise.resolve({ id: orgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  })

  assert.strictEqual(res.status, 403)
  const body = await res.json()
  assert.match(body.error, /Forbidden/)
  assert.strictEqual(mockClient.getOrderCount(), 0, 'Zero Telnyx orders submitted')
})

test('B3. Tenant admin role (non-super-admin) is denied with 403', async () => {
  const orgId = 'org_admin_target'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Admin Org', phone_provisioning_status: 'pending_number' }],
    profiles: [{ id: TENANT_ADMIN.id, email: TENANT_ADMIN.email, role: 'admin', org_id: orgId }]
  }, TENANT_ADMIN)

  const mockClient = createMockTelnyxClient()
  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  })

  const res = await adminProvisionPost(req, { params: Promise.resolve({ id: orgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  })

  assert.strictEqual(res.status, 403)
  assert.strictEqual(mockClient.getOrderCount(), 0)
})

test('B4. Dispatcher / organization member is denied with 403', async () => {
  const orgId = 'org_member_target'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Member Org', phone_provisioning_status: 'pending_number' }],
    profiles: [{ id: MEMBER_USER.id, email: MEMBER_USER.email, role: 'member', org_id: orgId }]
  }, MEMBER_USER)

  const mockClient = createMockTelnyxClient()
  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  })

  const res = await adminProvisionPost(req, { params: Promise.resolve({ id: orgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  })

  assert.strictEqual(res.status, 403)
  assert.strictEqual(mockClient.getOrderCount(), 0)
})

test('B5. Super Admin is authorized and successfully provisions DID', async () => {
  const orgId = 'org_super_target'
  const mockClient = createMockTelnyxClient({
    mockNumber: '+12145550188',
    orderStatus: 'success'
  })

  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Target HVAC', slug: 'target-hvac', phone_provisioning_status: 'pending_number' }],
    profiles: [{ id: SUPER_ADMIN.id, email: SUPER_ADMIN.email, role: 'super_admin', org_id: orgId }]
  }, SUPER_ADMIN)

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ areaCode: '214' })
  })

  const res = await adminProvisionPost(req, { params: Promise.resolve({ id: orgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  })

  assert.strictEqual(res.status, 200)
  const body = await res.json()
  assert.strictEqual(body.success, true)
  assert.strictEqual(body.status, 'active')
  assert.strictEqual(body.phoneNumber, '+12145550188')
  assert.strictEqual(mockClient.getOrderCount(), 1, 'Exactly 1 Telnyx order placed')

  const org = supabase._tables.organizations.find((o) => o.id === orgId)
  assert.strictEqual(org.telnyx_phone_number, '+12145550188')
  assert.strictEqual(org.phone_provisioning_status, 'active')
})

// ==============================================================================
// GROUP C: TENANT ISOLATION & INPUT DEFENSE (TASK 4 & TASK 7.C)
// ==============================================================================

test('C1. Super Admin targeting non-existent organization returns 404', async () => {
  const orgId = 'org_does_not_exist'
  const mockClient = createMockTelnyxClient()

  const supabase = createMockSupabase({
    organizations: [], // Empty
    profiles: [{ id: SUPER_ADMIN.id, email: SUPER_ADMIN.email, role: 'super_admin' }]
  }, SUPER_ADMIN)

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  })

  const res = await adminProvisionPost(req, { params: Promise.resolve({ id: orgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  })

  assert.strictEqual(res.status, 404)
  const body = await res.json()
  assert.match(body.error, /Organization not found/)
  assert.strictEqual(mockClient.getOrderCount(), 0)
})

test('C2. Super Admin targeting churned organization returns 400', async () => {
  const orgId = 'org_churned'
  const mockClient = createMockTelnyxClient()

  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Churned Co', subscription_status: 'churned', phone_provisioning_status: 'pending_number' }],
    profiles: [{ id: SUPER_ADMIN.id, email: SUPER_ADMIN.email, role: 'super_admin' }]
  }, SUPER_ADMIN)

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  })

  const res = await adminProvisionPost(req, { params: Promise.resolve({ id: orgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  })

  assert.strictEqual(res.status, 400)
  const body = await res.json()
  assert.match(body.error, /churned/)
  assert.strictEqual(mockClient.getOrderCount(), 0)
})

test('C3. Body parameter tampering (orgId in body) is rejected with 400', async () => {
  const urlOrgId = 'org_url_legit'
  const maliciousOrgId = 'org_attacker_target'

  const supabase = createMockSupabase({
    organizations: [
      { id: urlOrgId, name: 'Legit Org', phone_provisioning_status: 'pending_number' },
      { id: maliciousOrgId, name: 'Attacker Org', phone_provisioning_status: 'pending_number' }
    ],
    profiles: [{ id: SUPER_ADMIN.id, email: SUPER_ADMIN.email, role: 'super_admin' }]
  }, SUPER_ADMIN)

  const mockClient = createMockTelnyxClient()
  const req = new Request(`http://localhost:3000/api/admin/organizations/${urlOrgId}/provision-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId: maliciousOrgId, areaCode: '214' })
  })

  const res = await adminProvisionPost(req, { params: Promise.resolve({ id: urlOrgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  })

  assert.strictEqual(res.status, 400)
  const body = await res.json()
  assert.match(body.error, /Prohibited parameter 'orgId'/)
  assert.strictEqual(mockClient.getOrderCount(), 0)
})

test('C4. Prohibited body injection (phoneNumber, status, role) is rejected with 400', async () => {
  const orgId = 'org_prohibited_test'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Test Org', phone_provisioning_status: 'pending_number' }],
    profiles: [{ id: SUPER_ADMIN.id, email: SUPER_ADMIN.email, role: 'super_admin' }]
  }, SUPER_ADMIN)

  const prohibitedPayloads = [
    { phoneNumber: '+12145550199' },
    { status: 'active' },
    { role: 'super_admin' },
    { orderId: 'ord_fake_123' }
  ]

  for (const payload of prohibitedPayloads) {
    const mockClient = createMockTelnyxClient()
    const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const res = await adminProvisionPost(req, { params: Promise.resolve({ id: orgId }) }, {
      apiClient: mockClient,
      customSupabase: supabase
    })

    assert.strictEqual(res.status, 400)
    assert.strictEqual(mockClient.getOrderCount(), 0)
  }
})

// ==============================================================================
// GROUP D: IDEMPOTENCY & SAFETY (TASK 5 & TASK 7.D/E)
// ==============================================================================

test('D1. Organization with existing active number returns 200 without second order', async () => {
  const orgId = 'org_active_already'
  const existingDID = '+15125550199'
  const mockClient = createMockTelnyxClient()

  const supabase = createMockSupabase({
    organizations: [
      {
        id: orgId,
        name: 'Already Active Org',
        telnyx_phone_number: existingDID,
        phone_provisioning_status: 'active'
      }
    ],
    profiles: [{ id: SUPER_ADMIN.id, email: SUPER_ADMIN.email, role: 'super_admin' }]
  }, SUPER_ADMIN)

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  })

  const res = await adminProvisionPost(req, { params: Promise.resolve({ id: orgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  })

  assert.strictEqual(res.status, 200)
  const body = await res.json()
  assert.strictEqual(body.status, 'already_assigned')
  assert.strictEqual(body.phoneNumber, existingDID)
  assert.strictEqual(mockClient.getOrderCount(), 0, 'Proves ZERO duplicate orders placed')
})

test('D2. In-flight lock rejects concurrent duplicate requests with 409', async () => {
  const orgId = 'org_concurrent_test'
  const mockClient = createMockTelnyxClient()

  const supabase = createMockSupabase({
    organizations: [
      { id: orgId, name: 'Concurrent Org', phone_provisioning_status: 'provisioning' }
    ],
    profiles: [{ id: SUPER_ADMIN.id, email: SUPER_ADMIN.email, role: 'super_admin' }]
  }, SUPER_ADMIN)

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  })

  const res = await adminProvisionPost(req, { params: Promise.resolve({ id: orgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  })

  assert.strictEqual(res.status, 409)
  const body = await res.json()
  assert.strictEqual(body.status, 'provisioning')
  assert.strictEqual(mockClient.getOrderCount(), 0)
})
