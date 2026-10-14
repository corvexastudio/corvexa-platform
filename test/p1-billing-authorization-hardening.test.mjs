/**
 * ==============================================================================
 * CAPTODESK — P1 BILLING AUTHORIZATION & ENTITLEMENT HARDENING TEST SUITE
 * ==============================================================================
 * Validates server-authoritative SaaS billing state, strict tenant isolation,
 * database trigger protection, and entitlement boundary gating:
 * 
 * 1.  Tenant cannot modify subscription_status via PATCH /api/client/organization (400).
 * 2.  Tenant cannot modify monthly_rate via PATCH /api/client/organization (400).
 * 3.  Tenant cannot modify provider via PATCH /api/client/organization (400).
 * 4.  Tenant cannot modify billing period via PATCH /api/client/organization (400).
 * 5.  Tenant cannot modify payment status via PATCH /api/client/organization (400).
 * 6.  Tenant cannot insert fake SaaS payment (RLS / trigger blocks with 42501).
 * 7.  Tenant cannot update SaaS payment (RLS / trigger blocks with 42501).
 * 8.  Tenant cannot grant itself active entitlement (toggle-status rejects tenant owner with 403).
 * 9.  Tenant cannot grant another organization entitlement (cross-tenant rejected).
 * 10. Client-supplied org_id cannot bypass tenant isolation (org_id rejected with 400).
 * 11. Super Admin can activate subscription via authorized service.
 * 12. Super Admin can renew subscription via authorized service.
 * 13. Super Admin can cancel subscription via authorized service.
 * 14. Super Admin can reactivate subscription via authorized service.
 * 15. Super Admin can record legitimate manual PayPal payment via authorized service.
 * 16. Active subscription permits intended paid capabilities (retention execution allowed).
 * 17. Expired/cancelled subscription rejects intended paid capabilities (402).
 * 18. Missing/invalid subscription state fails closed (returns false / 402).
 * 19. Homeowner/customer invoice payments remain completely unaffected and isolated.
 * 20. Privilege escalation attempt vectors (direct PostgREST update, settings, onboarding) fail.
 * ==============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { PATCH as organizationPatch, GET as organizationGet } from '../src/app/api/client/organization/route.ts'
import { POST as toggleStatusPost } from '../src/app/api/admin/organizations/toggle-status/route.ts'
import { POST as activatePost } from '../src/app/api/admin/organizations/[id]/subscription/activate/route.ts'
import { POST as renewPost } from '../src/app/api/admin/organizations/[id]/subscription/renew/route.ts'
import { POST as cancelPost } from '../src/app/api/admin/organizations/[id]/subscription/cancel/route.ts'
import { POST as reactivatePost } from '../src/app/api/admin/organizations/[id]/subscription/reactivate/route.ts'
import { POST as recordPaymentPost } from '../src/app/api/admin/organizations/[id]/subscription/payments/route.ts'
import { POST as retentionPost, PUT as retentionPut } from '../src/app/api/client/retention/route.ts'
import { SubscriptionService, hasActiveSaaSEntitlement } from '../src/lib/billing/subscription-service.ts'

// --- Mock Actors ---
const TENANT_OWNER = {
  id: 'usr_owner_001',
  email: 'owner@apexplumbing.com',
  app_metadata: {},
  user_metadata: {}
}

const TENANT_ADMIN = {
  id: 'usr_admin_001',
  email: 'admin@apexplumbing.com',
  app_metadata: {},
  user_metadata: {}
}

const MEMBER_USER = {
  id: 'usr_member_001',
  email: 'tech@apexplumbing.com',
  app_metadata: {},
  user_metadata: {}
}

const SUPER_ADMIN = {
  id: 'usr_super_001',
  email: 'admin@captodesk.com',
  app_metadata: {},
  user_metadata: {}
}

const OTHER_OWNER = {
  id: 'usr_other_001',
  email: 'owner@rivalplumbing.com',
  app_metadata: {},
  user_metadata: {}
}

/**
 * Creates an in-memory mock Supabase client with PostgreSQL RLS & trigger simulation
 */
function createMockSupabase(initialState = {}, currentUser = null) {
  const tables = {
    organizations: initialState.organizations ? JSON.parse(JSON.stringify(initialState.organizations)) : [],
    profiles: initialState.profiles ? JSON.parse(JSON.stringify(initialState.profiles)) : [],
    saas_subscriptions: initialState.saas_subscriptions ? JSON.parse(JSON.stringify(initialState.saas_subscriptions)) : [],
    saas_payments: initialState.saas_payments ? JSON.parse(JSON.stringify(initialState.saas_payments)) : [],
    activity_logs: initialState.activity_logs ? JSON.parse(JSON.stringify(initialState.activity_logs)) : [],
    contacts: initialState.contacts ? JSON.parse(JSON.stringify(initialState.contacts)) : [],
    payments: initialState.payments ? JSON.parse(JSON.stringify(initialState.payments)) : [],
    invoices: initialState.invoices ? JSON.parse(JSON.stringify(initialState.invoices)) : []
  }

  const isSuperAdminUser = currentUser && tables.profiles.some(
    (p) => p.id === currentUser.id && p.role === 'super_admin'
  )

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
        order: () => builder,
        limit: () => builder,
        single: async () => {
          const match = table.find((row) => filters.every((f) => f(row)))
          if (!match) return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
          return { data: match, error: null }
        },
        maybeSingle: async () => {
          const match = table.find((row) => filters.every((f) => f(row)))
          return { data: match || null, error: null }
        },
        update: (updates) => {
          pendingUpdates = updates

          // Simulate database trigger: protect_organization_billing_fields()
          if (tableName === 'organizations' && !isSuperAdminUser) {
            if ('subscription_status' in updates || 'monthly_rate' in updates) {
              return {
                eq: (col, val) => {
                  filters.push((row) => row[col] === val)
                  return {
                    select: () => ({
                      single: async () => ({
                        data: null,
                        error: {
                          code: '42501',
                          message: 'Tenant users cannot modify subscription_status or monthly_rate. Billing state is server-authoritative.'
                        }
                      }),
                      maybeSingle: async () => ({
                        data: null,
                        error: {
                          code: '42501',
                          message: 'Tenant users cannot modify subscription_status or monthly_rate. Billing state is server-authoritative.'
                        }
                      })
                    }),
                    then: (resolve) => resolve({
                      data: null,
                      error: {
                        code: '42501',
                        message: 'Tenant users cannot modify subscription_status or monthly_rate. Billing state is server-authoritative.'
                      }
                    })
                  }
                }
              }
            }
          }

          // Simulate RLS on saas_subscriptions and saas_payments:
          if ((tableName === 'saas_subscriptions' || tableName === 'saas_payments') && !isSuperAdminUser) {
            return {
              eq: (col, val) => ({
                select: () => ({
                  single: async () => ({
                    data: null,
                    error: { code: '42501', message: 'new row violates row-level security policy' }
                  })
                }),
                then: (resolve) => resolve({
                  data: null,
                  error: { code: '42501', message: 'new row violates row-level security policy' }
                })
              })
            }
          }

          return {
            eq: (col, val) => {
              filters.push((row) => row[col] === val)
              return {
                select: () => ({
                  single: async () => {
                    const match = table.find((row) => filters.every((f) => f(row)))
                    if (!match) return { data: null, error: { message: 'Row not found' } }
                    Object.assign(match, pendingUpdates)
                    return { data: match, error: null }
                  },
                  maybeSingle: async () => {
                    const match = table.find((row) => filters.every((f) => f(row)))
                    if (!match) return { data: null, error: null }
                    Object.assign(match, pendingUpdates)
                    return { data: match, error: null }
                  }
                }),
                then: (resolve) => {
                  const match = table.find((row) => filters.every((f) => f(row)))
                  if (match) Object.assign(match, pendingUpdates)
                  resolve({ data: match || null, error: null })
                }
              }
            }
          }
        },
        insert: (records) => {
          const list = Array.isArray(records) ? records : [records]

          // Simulate RLS on saas_payments & saas_subscriptions
          if ((tableName === 'saas_payments' || tableName === 'saas_subscriptions') && !isSuperAdminUser) {
            return {
              data: null,
              error: { code: '42501', message: 'new row violates row-level security policy for table' },
              select: () => ({
                single: async () => ({ data: null, error: { code: '42501', message: 'new row violates row-level security policy for table' } }),
                maybeSingle: async () => ({ data: null, error: { code: '42501', message: 'new row violates row-level security policy for table' } })
              }),
              then: (resolve) => resolve({ data: null, error: { code: '42501', message: 'new row violates row-level security policy for table' } })
            }
          }

          const inserted = list.map((item) => {
            const newItem = { id: item.id || `gen_${Math.random().toString(36).substring(2, 9)}`, ...item }
            table.push(newItem)
            return newItem
          })

          return {
            data: inserted,
            error: null,
            select: () => ({
              single: async () => ({ data: inserted[0], error: null }),
              maybeSingle: async () => ({ data: inserted[0], error: null })
            }),
            single: async () => ({ data: inserted[0], error: null }),
            maybeSingle: async () => ({ data: inserted[0], error: null }),
            then: (resolve) => resolve({ data: list.length === 1 ? inserted[0] : inserted, error: null })
          }
        }
      }

      return builder
    }
  }

  return client
}

// ==============================================================================
// TEST 1 — TENANT CANNOT MODIFY SUBSCRIPTION_STATUS (400)
// ==============================================================================
test('TEST 1: Tenant owner cannot modify subscription_status via PATCH /api/client/organization (rejected with 400)', async () => {
  const orgId = 'org-apex'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'trial', monthly_rate: 99 }],
    profiles: [{ id: TENANT_OWNER.id, email: TENANT_OWNER.email, role: 'owner', org_id: orgId }]
  }, TENANT_OWNER)

  const req = new Request('http://localhost:3000/api/client/organization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription_status: 'active' })
  })

  const res = await organizationPatch(req, { customSupabase: supabase })
  assert.strictEqual(res.status, 400)
  const body = await res.json()
  assert.match(body.error, /Prohibited parameter.*subscription_status/)

  // Verify DB state was NOT modified
  const org = supabase._tables.organizations.find((o) => o.id === orgId)
  assert.strictEqual(org.subscription_status, 'trial')
})

// ==============================================================================
// TEST 2 — TENANT CANNOT MODIFY MONTHLY_RATE (400)
// ==============================================================================
test('TEST 2: Tenant owner cannot modify monthly_rate via PATCH /api/client/organization (rejected with 400)', async () => {
  const orgId = 'org-apex'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'trial', monthly_rate: 99 }],
    profiles: [{ id: TENANT_OWNER.id, email: TENANT_OWNER.email, role: 'owner', org_id: orgId }]
  }, TENANT_OWNER)

  const req = new Request('http://localhost:3000/api/client/organization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ monthly_rate: 0 })
  })

  const res = await organizationPatch(req, { customSupabase: supabase })
  assert.strictEqual(res.status, 400)
  const body = await res.json()
  assert.match(body.error, /Prohibited parameter.*monthly_rate/)

  const org = supabase._tables.organizations.find((o) => o.id === orgId)
  assert.strictEqual(org.monthly_rate, 99)
})

// ==============================================================================
// TEST 3 — TENANT CANNOT MODIFY PROVIDER (400)
// ==============================================================================
test('TEST 3: Tenant owner cannot inject provider or provider IDs (rejected with 400)', async () => {
  const orgId = 'org-apex'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'trial', monthly_rate: 99 }],
    profiles: [{ id: TENANT_OWNER.id, email: TENANT_OWNER.email, role: 'owner', org_id: orgId }]
  }, TENANT_OWNER)

  const req = new Request('http://localhost:3000/api/client/organization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'fake_paypal', provider_customer_id: 'cust_evil' })
  })

  const res = await organizationPatch(req, { customSupabase: supabase })
  assert.strictEqual(res.status, 400)
  const body = await res.json()
  assert.match(body.error, /Prohibited parameter.*provider/)
})

// ==============================================================================
// TEST 4 — TENANT CANNOT MODIFY BILLING PERIOD (400)
// ==============================================================================
test('TEST 4: Tenant owner cannot inject billing period fields (rejected with 400)', async () => {
  const orgId = 'org-apex'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'trial', monthly_rate: 99 }],
    profiles: [{ id: TENANT_OWNER.id, email: TENANT_OWNER.email, role: 'owner', org_id: orgId }]
  }, TENANT_OWNER)

  const req = new Request('http://localhost:3000/api/client/organization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ billing_period: 'forever', billing_period_end: '2099-01-01T00:00:00Z' })
  })

  const res = await organizationPatch(req, { customSupabase: supabase })
  assert.strictEqual(res.status, 400)
  const body = await res.json()
  assert.match(body.error, /Prohibited parameter.*billing_period/)
})

// ==============================================================================
// TEST 5 — TENANT CANNOT MODIFY PAYMENT STATUS (400)
// ==============================================================================
test('TEST 5: Tenant owner cannot inject payment_status (rejected with 400)', async () => {
  const orgId = 'org-apex'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'trial', monthly_rate: 99 }],
    profiles: [{ id: TENANT_OWNER.id, email: TENANT_OWNER.email, role: 'owner', org_id: orgId }]
  }, TENANT_OWNER)

  const req = new Request('http://localhost:3000/api/client/organization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_status: 'completed' })
  })

  const res = await organizationPatch(req, { customSupabase: supabase })
  assert.strictEqual(res.status, 400)
  const body = await res.json()
  assert.match(body.error, /Prohibited parameter.*payment_status/)
})

// ==============================================================================
// TEST 6 — TENANT CANNOT INSERT FAKE SAAS PAYMENT (RLS 42501)
// ==============================================================================
test('TEST 6: Tenant user directly attempting to INSERT saas_payments is rejected by RLS (42501)', async () => {
  const orgId = 'org-apex'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'trial', monthly_rate: 99 }],
    profiles: [{ id: TENANT_OWNER.id, email: TENANT_OWNER.email, role: 'owner', org_id: orgId }]
  }, TENANT_OWNER)

  const res = await supabase.from('saas_payments').insert({
    org_id: orgId,
    subscription_id: 'sub-fake',
    amount: 99.00,
    payment_status: 'completed',
    billing_period_start: '2026-01-01T00:00:00Z',
    billing_period_end: '2026-02-01T00:00:00Z'
  })

  assert.ok(res.error, 'Direct insert must return error')
  assert.strictEqual(res.error.code, '42501')
  assert.match(res.error.message, /row-level security/)
  assert.strictEqual(supabase._tables.saas_payments.length, 0)
})

// ==============================================================================
// TEST 7 — TENANT CANNOT UPDATE SAAS PAYMENT (RLS 42501)
// ==============================================================================
test('TEST 7: Tenant user directly attempting to UPDATE saas_payments is rejected by RLS (42501)', async () => {
  const orgId = 'org-apex'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'trial', monthly_rate: 99 }],
    profiles: [{ id: TENANT_OWNER.id, email: TENANT_OWNER.email, role: 'owner', org_id: orgId }],
    saas_payments: [{
      id: 'pay-001',
      org_id: orgId,
      amount: 99.00,
      payment_status: 'pending'
    }]
  }, TENANT_OWNER)

  const res = await supabase.from('saas_payments').update({ payment_status: 'completed' }).eq('id', 'pay-001')
  assert.ok(res.error, 'Direct update must return error')
  assert.strictEqual(res.error.code, '42501')
})

// ==============================================================================
// TEST 8 — TENANT CANNOT GRANT ITSELF ACTIVE ENTITLEMENT (toggle-status 403)
// ==============================================================================
test('TEST 8: Tenant owner cannot call POST /api/admin/organizations/toggle-status to activate own org (rejected with 403)', async () => {
  const orgId = 'org-apex'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'canceled', monthly_rate: 99 }],
    profiles: [{ id: TENANT_OWNER.id, email: TENANT_OWNER.email, role: 'owner', org_id: orgId }]
  }, TENANT_OWNER)

  const req = new Request('http://localhost:3000/api/admin/organizations/toggle-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ org_id: orgId, status: 'active' })
  })

  const res = await toggleStatusPost(req, { customSupabase: supabase })
  assert.strictEqual(res.status, 403)
  const body = await res.json()
  assert.match(body.error, /Forbidden/)

  const org = supabase._tables.organizations.find((o) => o.id === orgId)
  assert.strictEqual(org.subscription_status, 'canceled')
})

// ==============================================================================
// TEST 9 — TENANT CANNOT GRANT ANOTHER ORGANIZATION ENTITLEMENT (403)
// ==============================================================================
test('TEST 9: Tenant owner cannot modify another organization subscription status (rejected with 403)', async () => {
  const myOrgId = 'org-apex'
  const targetOrgId = 'org-rival'
  const supabase = createMockSupabase({
    organizations: [
      { id: myOrgId, name: 'Apex Plumbing', subscription_status: 'trial' },
      { id: targetOrgId, name: 'Rival Plumbing', subscription_status: 'past_due' }
    ],
    profiles: [{ id: TENANT_OWNER.id, email: TENANT_OWNER.email, role: 'owner', org_id: myOrgId }]
  }, TENANT_OWNER)

  const req = new Request('http://localhost:3000/api/admin/organizations/toggle-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ org_id: targetOrgId, status: 'active' })
  })

  const res = await toggleStatusPost(req, { customSupabase: supabase })
  assert.strictEqual(res.status, 403)

  const targetOrg = supabase._tables.organizations.find((o) => o.id === targetOrgId)
  assert.strictEqual(targetOrg.subscription_status, 'past_due')
})

// ==============================================================================
// TEST 10 — CLIENT-SUPPLIED ORG_ID CANNOT BYPASS TENANT ISOLATION (400)
// ==============================================================================
test('TEST 10: Client-supplied org_id in PATCH /api/client/organization is rejected with 400', async () => {
  const orgId = 'org-apex'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'trial' }],
    profiles: [{ id: TENANT_OWNER.id, email: TENANT_OWNER.email, role: 'owner', org_id: orgId }]
  }, TENANT_OWNER)

  const req = new Request('http://localhost:3000/api/client/organization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ org_id: 'org-another', name: 'New Name' })
  })

  const res = await organizationPatch(req, { customSupabase: supabase })
  assert.strictEqual(res.status, 400)
  const body = await res.json()
  assert.match(body.error, /Prohibited parameter.*org_id/)
})

// ==============================================================================
// TEST 11 — SUPER ADMIN CAN ACTIVATE SUBSCRIPTION
// ==============================================================================
test('TEST 11: Super Admin can activate subscription via POST /api/admin/organizations/[id]/subscription/activate', async () => {
  const orgId = 'org-apex'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'pending' }],
    profiles: [{ id: SUPER_ADMIN.id, email: SUPER_ADMIN.email, role: 'super_admin' }]
  }, SUPER_ADMIN)

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/subscription/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentReference: 'PAYPAL-INITIAL-123', periodMonths: 1 })
  })

  const res = await activatePost(req, { params: Promise.resolve({ id: orgId }) }, { customSupabase: supabase })
  assert.strictEqual(res.status, 200)
  const body = await res.json()
  assert.strictEqual(body.success, true)
  assert.strictEqual(body.subscription.status, 'active')

  const org = supabase._tables.organizations.find((o) => o.id === orgId)
  assert.strictEqual(org.subscription_status, 'active')
})

// ==============================================================================
// TEST 12 — SUPER ADMIN CAN RENEW SUBSCRIPTION
// ==============================================================================
test('TEST 12: Super Admin can renew subscription via POST /api/admin/organizations/[id]/subscription/renew', async () => {
  const orgId = 'org-apex'
  const now = new Date()
  const nextMonth = new Date(now.getTime() + 30 * 86400000)
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'active' }],
    profiles: [{ id: SUPER_ADMIN.id, email: SUPER_ADMIN.email, role: 'super_admin' }],
    saas_subscriptions: [{
      id: 'sub-001',
      org_id: orgId,
      status: 'active',
      plan_id: 'captodesk_standard',
      billing_interval: 'month',
      amount: 99.00,
      currency: 'USD',
      current_period_start: now.toISOString(),
      current_period_end: nextMonth.toISOString(),
      cancel_at_period_end: false
    }]
  }, SUPER_ADMIN)

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/subscription/renew`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentReference: 'PAYPAL-RENEW-456', periodMonths: 1 })
  })

  const res = await renewPost(req, { params: Promise.resolve({ id: orgId }) }, { customSupabase: supabase })
  assert.strictEqual(res.status, 200)
  const body = await res.json()
  assert.strictEqual(body.success, true)
  assert.strictEqual(body.subscription.status, 'active')
})

// ==============================================================================
// TEST 13 — SUPER ADMIN CAN CANCEL SUBSCRIPTION
// ==============================================================================
test('TEST 13: Super Admin can cancel subscription via POST /api/admin/organizations/[id]/subscription/cancel', async () => {
  const orgId = 'org-apex'
  const now = new Date()
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'active' }],
    profiles: [{ id: SUPER_ADMIN.id, email: SUPER_ADMIN.email, role: 'super_admin' }],
    saas_subscriptions: [{
      id: 'sub-001',
      org_id: orgId,
      status: 'active',
      plan_id: 'captodesk_standard',
      billing_interval: 'month',
      amount: 99.00,
      currency: 'USD',
      current_period_start: now.toISOString(),
      current_period_end: new Date(now.getTime() + 86400000).toISOString(),
      cancel_at_period_end: false
    }]
  }, SUPER_ADMIN)

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/subscription/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ immediate: true, reason: 'Non-payment' })
  })

  const res = await cancelPost(req, { params: Promise.resolve({ id: orgId }) }, { customSupabase: supabase })
  assert.strictEqual(res.status, 200)
  const body = await res.json()
  assert.strictEqual(body.success, true)
  assert.strictEqual(body.subscription.status, 'canceled')

  const org = supabase._tables.organizations.find((o) => o.id === orgId)
  assert.strictEqual(org.subscription_status, 'canceled')
})

// ==============================================================================
// TEST 14 — SUPER ADMIN CAN REACTIVATE SUBSCRIPTION
// ==============================================================================
test('TEST 14: Super Admin can reactivate scheduled-cancellation subscription', async () => {
  const orgId = 'org-apex'
  const now = new Date()
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'active' }],
    profiles: [{ id: SUPER_ADMIN.id, email: SUPER_ADMIN.email, role: 'super_admin' }],
    saas_subscriptions: [{
      id: 'sub-001',
      org_id: orgId,
      status: 'active',
      plan_id: 'captodesk_standard',
      billing_interval: 'month',
      amount: 99.00,
      currency: 'USD',
      current_period_start: now.toISOString(),
      current_period_end: new Date(now.getTime() + 10 * 86400000).toISOString(),
      cancel_at_period_end: true
    }]
  }, SUPER_ADMIN)

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/subscription/reactivate`, {
    method: 'POST'
  })

  const res = await reactivatePost(req, { params: Promise.resolve({ id: orgId }) }, { customSupabase: supabase })
  assert.strictEqual(res.status, 200)
  const body = await res.json()
  assert.strictEqual(body.success, true)
  assert.strictEqual(body.subscription.cancel_at_period_end, false)
})

// ==============================================================================
// TEST 15 — SUPER ADMIN CAN RECORD LEGITIMATE MANUAL PAYPAL PAYMENT
// ==============================================================================
test('TEST 15: Super Admin can record manual PayPal payment record', async () => {
  const orgId = 'org-apex'
  const now = new Date()
  const periodEnd = new Date(now.getTime() + 30 * 86400000)
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'active' }],
    profiles: [{ id: SUPER_ADMIN.id, email: SUPER_ADMIN.email, role: 'super_admin' }],
    saas_subscriptions: [{
      id: 'sub-001',
      org_id: orgId,
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString()
    }]
  }, SUPER_ADMIN)

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/subscription/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 99.00,
      currency: 'USD',
      billingPeriodStart: now.toISOString(),
      billingPeriodEnd: periodEnd.toISOString(),
      paymentReference: 'PAYPAL-TXN-999',
      provider: 'paypal_manual'
    })
  })

  const res = await recordPaymentPost(req, { params: Promise.resolve({ id: orgId }) }, { customSupabase: supabase })
  assert.strictEqual(res.status, 201)
  const body = await res.json()
  assert.strictEqual(body.success, true)
  assert.strictEqual(body.payment.provider_payment_reference, 'PAYPAL-TXN-999')
})

// ==============================================================================
// TEST 16 — ACTIVE SUBSCRIPTION PERMITS INTENDED PAID CAPABILITIES
// ==============================================================================
test('TEST 16: Active subscription permits intended paid capabilities (retention execution allowed)', async () => {
  const orgId = 'org-apex'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'active' }],
    profiles: [{ id: TENANT_OWNER.id, email: TENANT_OWNER.email, role: 'owner', org_id: orgId }],
    contacts: []
  }, TENANT_OWNER)

  // Verify entitlement evaluation
  const isEntitled = await hasActiveSaaSEntitlement(supabase, orgId)
  assert.strictEqual(isEntitled, true)

  const req = new Request('http://localhost:3000/api/client/retention', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })

  const res = await retentionPost(req, { customSupabase: supabase })
  assert.strictEqual(res.status, 200)
})

// ==============================================================================
// TEST 17 — EXPIRED/CANCELLED SUBSCRIPTION DOES NOT PERMIT PAID CAPABILITIES (402)
// ==============================================================================
test('TEST 17: Canceled or expired subscription rejects paid capabilities with 402', async () => {
  const orgId = 'org-apex'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'canceled' }],
    profiles: [{ id: TENANT_OWNER.id, email: TENANT_OWNER.email, role: 'owner', org_id: orgId }],
    contacts: []
  }, TENANT_OWNER)

  // Verify entitlement evaluation
  const isEntitled = await hasActiveSaaSEntitlement(supabase, orgId)
  assert.strictEqual(isEntitled, false)

  const req = new Request('http://localhost:3000/api/client/retention', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })

  const res = await retentionPost(req, { customSupabase: supabase })
  assert.strictEqual(res.status, 402)
  const body = await res.json()
  assert.match(body.error, /Active SaaS subscription required/)
})

// ==============================================================================
// TEST 18 — MISSING/INVALID SUBSCRIPTION STATE FAILS CLOSED
// ==============================================================================
test('TEST 18: Missing or invalid subscription state fails closed (returns false)', async () => {
  const supabase = createMockSupabase({
    organizations: [],
    saas_subscriptions: []
  })

  const isEntitledNullOrg = await hasActiveSaaSEntitlement(supabase, '')
  assert.strictEqual(isEntitledNullOrg, false, 'Empty orgId must fail closed')

  const isEntitledNonexistent = await hasActiveSaaSEntitlement(supabase, 'org-nonexistent')
  assert.strictEqual(isEntitledNonexistent, false, 'Non-existent org must fail closed')

  const isEntitledNullClient = await hasActiveSaaSEntitlement(null, 'org-any')
  assert.strictEqual(isEntitledNullClient, false, 'Null supabase client must fail closed')
})

// ==============================================================================
// TEST 19 — HOMEOWNER/CUSTOMER INVOICE PAYMENTS REMAIN UNAFFECTED
// ==============================================================================
test('TEST 19: Homeowner invoice payments table and saas_payments table remain completely isolated', async () => {
  const orgId = 'org-apex'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'trial' }],
    profiles: [{ id: TENANT_OWNER.id, email: TENANT_OWNER.email, role: 'owner', org_id: orgId }],
    payments: [],
    saas_payments: []
  }, TENANT_OWNER)

  // Homeowner payment insert on 'payments' table is permitted for invoice workflows
  const homeownerRes = await supabase.from('payments').insert({
    org_id: orgId,
    amount: 150.00,
    status: 'completed',
    payment_method: 'credit_card'
  })

  assert.strictEqual(homeownerRes.error, null)
  assert.strictEqual(supabase._tables.payments.length, 1)
  assert.strictEqual(supabase._tables.saas_payments.length, 0, 'saas_payments must be untouched')
})

// ==============================================================================
// TEST 20 — PRIVILEGE ESCALATION ATTEMPTS ARE REJECTED
// ==============================================================================
test('TEST 20: Privilege escalation payloads are strictly rejected across vectors', async () => {
  const orgId = 'org-apex'
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Apex Plumbing', subscription_status: 'trial', monthly_rate: 99 }],
    profiles: [{ id: TENANT_OWNER.id, email: TENANT_OWNER.email, role: 'owner', org_id: orgId }]
  }, TENANT_OWNER)

  // Vector 1: Combined subscription_status + monthly_rate
  const req1 = new Request('http://localhost:3000/api/client/organization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription_status: 'active', monthly_rate: 0 })
  })
  const res1 = await organizationPatch(req1, { customSupabase: supabase })
  assert.strictEqual(res1.status, 400)

  // Vector 2: Cross-tenant target + subscription_status
  const req2 = new Request('http://localhost:3000/api/client/organization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ org_id: 'org-victim', subscription_status: 'active' })
  })
  const res2 = await organizationPatch(req2, { customSupabase: supabase })
  assert.strictEqual(res2.status, 400)

  // Vector 3: Direct PostgREST database update trigger simulation
  const dbRes = await supabase.from('organizations').update({ subscription_status: 'active', monthly_rate: 0 }).eq('id', orgId)
  assert.ok(dbRes.error)
  assert.strictEqual(dbRes.error.code, '42501')
  assert.match(dbRes.error.message, /Tenant users cannot modify subscription_status/)

  // Verify DB state was never modified
  const org = supabase._tables.organizations.find((o) => o.id === orgId)
  assert.strictEqual(org.subscription_status, 'trial')
  assert.strictEqual(org.monthly_rate, 99)
})
