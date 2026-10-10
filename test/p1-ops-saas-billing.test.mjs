/**
 * ==============================================================================
 * CAPTODESK — P1-OPS-03: SAAS BILLING FOUNDATION & MANUAL BILLING TEST SUITE
 * ==============================================================================
 * Covers all 19 verification requirements:
 * 1.  Super Admin Authorization: unauthenticated rejected (401).
 * 2.  Super Admin Authorization: normal tenant member rejected (403).
 * 3.  Super Admin Authorization: super admin allowed (200).
 * 4.  Super Admin Authorization: cross-tenant access denied / unknown org (404).
 * 5.  Subscription Creation: initial activation creates subscription row.
 * 6.  Subscription Creation: server sets default plan ($99 CaptoDesk Standard, USD, monthly).
 * 7.  Subscription Creation: sets status='active', creates initial payment, updates org status.
 * 8.  Subscription Creation: non-existent org returns 404.
 * 9.  Client Tampering: client-supplied amount rejected (400).
 * 10. Client Tampering: client-supplied non-USD currency rejected (400).
 * 11. Client Tampering: client-supplied status transition rejected (400).
 * 12. Client Tampering: mismatched org_id in body rejected (400).
 * 13. Client Tampering: invalid periodMonths rejected (400).
 * 14. Renewal: advances period cleanly and records payment.
 * 15. Idempotency: duplicate payment for identical period rejected by constraint.
 * 16. Cancellation: cancel at period end maintains entitlement until current_period_end.
 * 17. Cancellation: immediate cancellation terminates entitlement immediately.
 * 18. Reactivation: clears pending cancellation and restores subscription.
 * 19. Isolation: homeowner payments and invoices remain completely independent.
 * ==============================================================================
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GET as getSubscriptionRoute } from '../src/app/api/admin/organizations/[id]/subscription/route.ts'
import { POST as activateRoute } from '../src/app/api/admin/organizations/[id]/subscription/activate/route.ts'
import { POST as renewRoute } from '../src/app/api/admin/organizations/[id]/subscription/renew/route.ts'
import { POST as cancelRoute } from '../src/app/api/admin/organizations/[id]/subscription/cancel/route.ts'
import { POST as reactivateRoute } from '../src/app/api/admin/organizations/[id]/subscription/reactivate/route.ts'
import { GET as getPaymentsRoute, POST as recordPaymentRoute } from '../src/app/api/admin/organizations/[id]/subscription/payments/route.ts'
import { SubscriptionService } from '../src/lib/billing/subscription-service.ts'
import { getSaasPlan, DEFAULT_SAAS_PLAN_ID, calculatePeriodEnd } from '../src/lib/billing/plans.ts'

/**
 * Creates an in-memory mock database matching Supabase PostgREST client semantics
 */
function createMockSupabase(initialData = {}, currentUser = null) {
  const store = {
    organizations: initialData.organizations ? JSON.parse(JSON.stringify(initialData.organizations)) : [],
    profiles: initialData.profiles ? JSON.parse(JSON.stringify(initialData.profiles)) : [],
    saas_subscriptions: initialData.saas_subscriptions ? JSON.parse(JSON.stringify(initialData.saas_subscriptions)) : [],
    saas_payments: initialData.saas_payments ? JSON.parse(JSON.stringify(initialData.saas_payments)) : [],
    activity_logs: initialData.activity_logs ? JSON.parse(JSON.stringify(initialData.activity_logs)) : [],
    // Homeowner payments tables
    payments: initialData.payments ? JSON.parse(JSON.stringify(initialData.payments)) : [],
    invoices: initialData.invoices ? JSON.parse(JSON.stringify(initialData.invoices)) : []
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

      const builder = {
        select(fields = '*') {
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

          // Check unique constraint on saas_subscriptions (org_id)
          if (tableName === 'saas_subscriptions') {
            for (const r of records) {
              const dup = table.find((existing) => existing.org_id === r.org_id)
              if (dup) {
                return {
                  data: null,
                  error: {
                    code: '23505',
                    message: 'duplicate key value violates unique constraint "uq_saas_subscriptions_org_id"'
                  },
                  async single() {
                    return { data: null, error: { code: '23505', message: 'duplicate key error' } }
                  },
                  async maybeSingle() {
                    return { data: null, error: { code: '23505', message: 'duplicate key error' } }
                  }
                }
              }
            }
          }

          // Check unique constraint on saas_payments (subscription_id, billing_period_start, billing_period_end)
          if (tableName === 'saas_payments') {
            for (const r of records) {
              const dup = table.find(
                (existing) =>
                  existing.subscription_id === r.subscription_id &&
                  existing.billing_period_start === r.billing_period_start &&
                  existing.billing_period_end === r.billing_period_end
              )
              if (dup) {
                return {
                  data: null,
                  error: {
                    code: '23505',
                    message: 'duplicate key value violates unique constraint "uq_saas_payments_period"'
                  },
                  async single() {
                    return { data: null, error: { code: '23505', message: 'duplicate key error' } }
                  },
                  async maybeSingle() {
                    return { data: null, error: { code: '23505', message: 'duplicate key error' } }
                  }
                }
              }
            }
          }

          const inserted = records.map((r) => {
            const row = {
              id: r.id || `mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              created_at: new Date().toISOString(),
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
                async single() {
                  return { data: inserted[0], error: null }
                },
                async maybeSingle() {
                  return { data: inserted[0], error: null }
                }
              }
            },
            async single() {
              return { data: inserted[0], error: null }
            },
            async maybeSingle() {
              return { data: inserted[0], error: null }
            }
          }
        }
      }

      return builder
    }
  }
}

// Fixtures
const SUPER_ADMIN_USER = {
  id: 'usr-super-admin-1',
  email: 'admin@captodesk.com'
}

const SUPER_ADMIN_PROFILE = {
  id: 'usr-super-admin-1',
  email: 'admin@captodesk.com',
  role: 'super_admin',
  org_id: 'org-admin-hub'
}

const REGULAR_USER = {
  id: 'usr-regular-member-1',
  email: 'member@contractor.com'
}

const REGULAR_PROFILE = {
  id: 'usr-regular-member-1',
  email: 'member@contractor.com',
  role: 'member',
  org_id: 'org-client-1'
}

const SAMPLE_ORG_1 = {
  id: 'org-client-1',
  name: 'Apex Heating & Air',
  slug: 'apex-hvac',
  subscription_status: 'trial',
  monthly_rate: 99.00
}

const SAMPLE_ORG_2 = {
  id: 'org-client-2',
  name: 'Blue Star Plumbing',
  slug: 'blue-star',
  subscription_status: 'trial',
  monthly_rate: 99.00
}

function createTestHarness(currentUser = SUPER_ADMIN_USER) {
  return createMockSupabase(
    {
      organizations: [SAMPLE_ORG_1, SAMPLE_ORG_2],
      profiles: [SUPER_ADMIN_PROFILE, REGULAR_PROFILE],
      saas_subscriptions: [],
      saas_payments: [],
      activity_logs: [],
      payments: [
        {
          id: 'pay-job-1',
          org_id: 'org-client-1',
          amount: 250.00,
          status: 'completed',
          provider: 'stripe'
        }
      ],
      invoices: [
        {
          id: 'inv-job-1',
          org_id: 'org-client-1',
          total_amount: 250.00,
          status: 'paid'
        }
      ]
    },
    currentUser
  )
}

// ==============================================================================
// TEST CASES
// ==============================================================================

test('1. Super Admin Authorization: Unauthenticated request rejected (401)', async () => {
  const harness = createTestHarness(null) // no user
  const req = new Request('http://localhost/api/admin/organizations/org-client-1/subscription', {
    method: 'GET'
  })

  const res = await getSubscriptionRoute(
    req,
    { params: Promise.resolve({ id: 'org-client-1' }) },
    { customSupabase: harness }
  )

  assert.equal(res.status, 401)
  const data = await res.json()
  assert.ok(data.error)
})

test('2. Super Admin Authorization: Regular client member rejected (403)', async () => {
  const harness = createTestHarness(REGULAR_USER)
  const req = new Request('http://localhost/api/admin/organizations/org-client-1/subscription', {
    method: 'GET'
  })

  const res = await getSubscriptionRoute(
    req,
    { params: Promise.resolve({ id: 'org-client-1' }) },
    { customSupabase: harness }
  )

  assert.equal(res.status, 403)
  const data = await res.json()
  assert.ok(data.error)
})

test('3. Super Admin Authorization: Super Admin allowed (200)', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)
  const req = new Request('http://localhost/api/admin/organizations/org-client-1/subscription', {
    method: 'GET'
  })

  const res = await getSubscriptionRoute(
    req,
    { params: Promise.resolve({ id: 'org-client-1' }) },
    { customSupabase: harness }
  )

  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.organization.id, 'org-client-1')
  assert.equal(data.plan.id, 'captodesk_standard')
  assert.equal(data.plan.amount, 99)
})

test('4. Super Admin Authorization: Non-existent org returns 404', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)
  const req = new Request('http://localhost/api/admin/organizations/org-non-existent/subscription', {
    method: 'GET'
  })

  const res = await getSubscriptionRoute(
    req,
    { params: Promise.resolve({ id: 'org-non-existent' }) },
    { customSupabase: harness }
  )

  assert.equal(res.status, 404)
  const data = await res.json()
  assert.match(data.error, /Organization not found/i)
})

test('5. Subscription Activation: Super Admin activates subscription cleanly', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)
  const req = new Request('http://localhost/api/admin/organizations/org-client-1/subscription/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentReference: 'PAYID-M5XYZ123456789',
      notes: 'Initial PayPal invoice paid by customer'
    })
  })

  const res = await activateRoute(
    req,
    { params: Promise.resolve({ id: 'org-client-1' }) },
    { customSupabase: harness }
  )

  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.success, true)
  assert.equal(data.subscription.org_id, 'org-client-1')
  assert.equal(data.subscription.plan_id, 'captodesk_standard')
  assert.equal(data.subscription.status, 'active')
  assert.equal(data.subscription.amount, 99)
  assert.equal(data.subscription.currency, 'USD')
  assert.equal(data.subscription.billing_interval, 'month')
  assert.equal(data.subscription.provider, 'manual')
  assert.ok(data.subscription.current_period_start)
  assert.ok(data.subscription.current_period_end)

  // Verify payment was recorded
  assert.ok(data.payment)
  assert.equal(data.payment.amount, 99)
  assert.equal(data.payment.provider, 'paypal_manual')
  assert.equal(data.payment.provider_payment_reference, 'PAYID-M5XYZ123456789')
  assert.equal(data.payment.payment_status, 'completed')

  // Verify organization table subscription_status was updated
  const org = harness._tables.organizations.find((o) => o.id === 'org-client-1')
  assert.equal(org.subscription_status, 'active')

  // Verify audit log entry
  const logs = harness._tables.activity_logs
  assert.ok(logs.some((l) => l.event_type === 'billing.subscription_activated' && l.org_id === 'org-client-1'))
})

test('6. Server-Authoritative Pricing: Reject client supplying amount (400)', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)
  const req = new Request('http://localhost/api/admin/organizations/org-client-1/subscription/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 19.99, // Attempted price override
      paymentReference: 'PAYID-HACK'
    })
  })

  const res = await activateRoute(
    req,
    { params: Promise.resolve({ id: 'org-client-1' }) },
    { customSupabase: harness }
  )

  assert.equal(res.status, 400)
  const data = await res.json()
  assert.match(data.error, /server-authoritative/i)
})

test('7. Server-Authoritative Currency: Reject non-USD currency (400)', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)
  const req = new Request('http://localhost/api/admin/organizations/org-client-1/subscription/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currency: 'EUR',
      paymentReference: 'PAYID-EUR'
    })
  })

  const res = await activateRoute(
    req,
    { params: Promise.resolve({ id: 'org-client-1' }) },
    { customSupabase: harness }
  )

  assert.equal(res.status, 400)
  const data = await res.json()
  assert.match(data.error, /Only USD is currently supported/i)
})

test('8. Client Tampering: Reject forced status transition (400)', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)
  const req = new Request('http://localhost/api/admin/organizations/org-client-1/subscription/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'active', // Should not be client-specified
      paymentReference: 'PAYID-TEST'
    })
  })

  const res = await activateRoute(
    req,
    { params: Promise.resolve({ id: 'org-client-1' }) },
    { customSupabase: harness }
  )

  assert.equal(res.status, 400)
  const data = await res.json()
  assert.match(data.error, /Subscription status transitions are server-controlled/i)
})

test('9. Client Tampering: Reject cross-tenant org_id mismatch in payload (400)', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)
  const req = new Request('http://localhost/api/admin/organizations/org-client-1/subscription/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      org_id: 'org-client-2', // Mismatched ID from route parameter
      paymentReference: 'PAYID-TEST'
    })
  })

  const res = await activateRoute(
    req,
    { params: Promise.resolve({ id: 'org-client-1' }) },
    { customSupabase: harness }
  )

  assert.equal(res.status, 400)
  const data = await res.json()
  assert.match(data.error, /Cross-tenant organization ID manipulation/i)
})

test('10. Client Tampering: Reject invalid periodMonths (400)', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)
  const req = new Request('http://localhost/api/admin/organizations/org-client-1/subscription/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodMonths: 24, // Exceeds max 12
      paymentReference: 'PAYID-TEST'
    })
  })

  const res = await activateRoute(
    req,
    { params: Promise.resolve({ id: 'org-client-1' }) },
    { customSupabase: harness }
  )

  assert.equal(res.status, 400)
  const data = await res.json()
  assert.match(data.error, /between 1 and 12 months/i)
})

test('11. Subscription Renewal: Extends subscription period and records payment', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)

  // First activate
  await SubscriptionService.activateSubscription(
    harness,
    { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin' },
    'org-client-1',
    { paymentReference: 'PAYID-MONTH-1' }
  )

  const initialSub = harness._tables.saas_subscriptions.find((s) => s.org_id === 'org-client-1')
  const initialEnd = new Date(initialSub.current_period_end)

  // Renew for 1 month
  const renewReq = new Request('http://localhost/api/admin/organizations/org-client-1/subscription/renew', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentReference: 'PAYID-MONTH-2',
      periodMonths: 1
    })
  })

  const renewRes = await renewRoute(
    renewReq,
    { params: Promise.resolve({ id: 'org-client-1' }) },
    { customSupabase: harness }
  )

  assert.equal(renewRes.status, 200)
  const data = await renewRes.json()
  assert.equal(data.success, true)

  const renewedEnd = new Date(data.subscription.current_period_end)
  assert.ok(renewedEnd.getTime() > initialEnd.getTime(), 'Renewed period end must be strictly after initial end')

  // Verify payment record
  assert.equal(data.payment.provider_payment_reference, 'PAYID-MONTH-2')
  assert.equal(data.payment.amount, 99)

  // Verify audit log entry
  const logs = harness._tables.activity_logs
  assert.ok(logs.some((l) => l.event_type === 'billing.subscription_renewed' && l.org_id === 'org-client-1'))
})

test('12. Idempotency: Duplicate payment for identical period rejected by DB constraint', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)

  const sub = await SubscriptionService.activateSubscription(
    harness,
    { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin' },
    'org-client-1',
    { paymentReference: 'PAYID-ORIGINAL' }
  )

  // Attempt duplicate recordPayment for the exact same billing period
  await assert.rejects(
    async () => {
      await SubscriptionService.recordPayment(
        harness,
        { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin' },
        'org-client-1',
        {
          amount: 99,
          currency: 'USD',
          billingPeriodStart: sub.payment.billing_period_start,
          billingPeriodEnd: sub.payment.billing_period_end,
          paymentReference: 'PAYID-DUPLICATE'
        }
      )
    },
    /already been recorded/i
  )
})

test('13. Cancellation at period end: Keeps active entitlement until period end', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)

  await SubscriptionService.activateSubscription(
    harness,
    { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin' },
    'org-client-1',
    { paymentReference: 'PAYID-ACTIVE' }
  )

  // Cancel with immediate: false
  const cancelReq = new Request('http://localhost/api/admin/organizations/org-client-1/subscription/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      immediate: false,
      reason: 'Customer requested cancellation at end of billing cycle'
    })
  })

  const cancelRes = await cancelRoute(
    cancelReq,
    { params: Promise.resolve({ id: 'org-client-1' }) },
    { customSupabase: harness }
  )

  assert.equal(cancelRes.status, 200)
  const data = await cancelRes.json()
  assert.equal(data.subscription.status, 'active')
  assert.equal(data.subscription.cancel_at_period_end, true)

  // Check entitlement: Still active because period has not yet expired!
  const entitlement = await SubscriptionService.getEntitlement(harness, 'org-client-1')
  assert.equal(entitlement.isEntitled, true)
  assert.equal(entitlement.status, 'active')
  assert.equal(entitlement.cancelAtPeriodEnd, true)
})

test('14. Immediate Cancellation: Immediately revokes entitlement and sets status to canceled', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)

  await SubscriptionService.activateSubscription(
    harness,
    { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin' },
    'org-client-1',
    { paymentReference: 'PAYID-ACTIVE' }
  )

  // Cancel immediately
  const cancelReq = new Request('http://localhost/api/admin/organizations/org-client-1/subscription/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      immediate: true,
      reason: 'Immediate termination requested'
    })
  })

  const cancelRes = await cancelRoute(
    cancelReq,
    { params: Promise.resolve({ id: 'org-client-1' }) },
    { customSupabase: harness }
  )

  assert.equal(cancelRes.status, 200)
  const data = await cancelRes.json()
  assert.equal(data.subscription.status, 'canceled')
  assert.equal(data.subscription.cancel_at_period_end, false)
  assert.ok(data.subscription.canceled_at)

  // Check entitlement: Revoked immediately!
  const entitlement = await SubscriptionService.getEntitlement(harness, 'org-client-1')
  assert.equal(entitlement.isEntitled, false)
  assert.equal(entitlement.status, 'canceled')

  // Organization table updated
  const org = harness._tables.organizations.find((o) => o.id === 'org-client-1')
  assert.equal(org.subscription_status, 'canceled')
})

test('15. Reactivation: Clears pending cancellation and restores subscription', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)

  await SubscriptionService.activateSubscription(
    harness,
    { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin' },
    'org-client-1',
    { paymentReference: 'PAYID-ACTIVE' }
  )

  // Schedule cancellation
  await SubscriptionService.cancelSubscription(
    harness,
    { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin' },
    'org-client-1',
    { immediate: false }
  )

  // Reactivate
  const reactivateReq = new Request('http://localhost/api/admin/organizations/org-client-1/subscription/reactivate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })

  const reactivateRes = await reactivateRoute(
    reactivateReq,
    { params: Promise.resolve({ id: 'org-client-1' }) },
    { customSupabase: harness }
  )

  assert.equal(reactivateRes.status, 200)
  const data = await reactivateRes.json()
  assert.equal(data.subscription.status, 'active')
  assert.equal(data.subscription.cancel_at_period_end, false)
  assert.equal(data.subscription.canceled_at, null)

  const entitlement = await SubscriptionService.getEntitlement(harness, 'org-client-1')
  assert.equal(entitlement.isEntitled, true)
  assert.equal(entitlement.cancelAtPeriodEnd, false)
})

test('16. Direct Manual Payment Recording: POST payments route succeeds with valid params', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)

  const sub = await SubscriptionService.activateSubscription(
    harness,
    { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin' },
    'org-client-1',
    { paymentReference: 'PAYID-INIT' }
  )

  const nextMonthStart = new Date(Date.now() + 35 * 86400000).toISOString()
  const nextMonthEnd = new Date(Date.now() + 65 * 86400000).toISOString()

  const payReq = new Request('http://localhost/api/admin/organizations/org-client-1/subscription/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 99.00,
      currency: 'USD',
      billingPeriodStart: nextMonthStart,
      billingPeriodEnd: nextMonthEnd,
      paymentReference: 'PAYID-OFFLINE-MANUAL-1',
      provider: 'paypal_manual',
      notes: 'Manually logged bank transfer / PayPal balance payment'
    })
  })

  const payRes = await recordPaymentRoute(
    payReq,
    { params: Promise.resolve({ id: 'org-client-1' }) },
    { customSupabase: harness }
  )

  assert.equal(payRes.status, 201)
  const data = await payRes.json()
  assert.equal(data.success, true)
  assert.equal(data.payment.amount, 99)
  assert.equal(data.payment.provider_payment_reference, 'PAYID-OFFLINE-MANUAL-1')

  // Verify GET payments returns both
  const getReq = new Request('http://localhost/api/admin/organizations/org-client-1/subscription/payments', {
    method: 'GET'
  })
  const getRes = await getPaymentsRoute(
    getReq,
    { params: Promise.resolve({ id: 'org-client-1' }) },
    { customSupabase: harness }
  )
  assert.equal(getRes.status, 200)
  const getData = await getRes.json()
  assert.equal(getData.payments.length, 2)
})

test('17. Direct Manual Payment Recording: Rejects invalid date ordering (end <= start)', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)

  const payReq = new Request('http://localhost/api/admin/organizations/org-client-1/subscription/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 99.00,
      billingPeriodStart: '2026-11-01T00:00:00Z',
      billingPeriodEnd: '2026-10-01T00:00:00Z', // END BEFORE START
      paymentReference: 'PAYID-INVALID-DATES'
    })
  })

  const payRes = await recordPaymentRoute(
    payReq,
    { params: Promise.resolve({ id: 'org-client-1' }) },
    { customSupabase: harness }
  )

  assert.equal(payRes.status, 400)
  const data = await payRes.json()
  assert.match(data.error, /End date must be strictly after start date/i)
})

test('18. Entitlement Logic: Expired subscription denies access', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)

  // Seed an expired subscription
  const pastStart = new Date(Date.now() - 60 * 86400000).toISOString()
  const pastEnd = new Date(Date.now() - 30 * 86400000).toISOString()

  harness._tables.saas_subscriptions.push({
    id: 'sub-expired-1',
    org_id: 'org-client-1',
    plan_id: 'captodesk_standard',
    status: 'active',
    billing_interval: 'month',
    amount: 99.00,
    currency: 'USD',
    current_period_start: pastStart,
    current_period_end: pastEnd,
    cancel_at_period_end: false,
    provider: 'paypal_manual'
  })

  const entitlement = await SubscriptionService.getEntitlement(harness, 'org-client-1')
  assert.equal(entitlement.isEntitled, false)
  assert.equal(entitlement.status, 'expired')
})

test('19. Segregation: Homeowner payments & invoices remain completely untouched', async () => {
  const harness = createTestHarness(SUPER_ADMIN_USER)

  // Verify baseline homeowner data
  assert.equal(harness._tables.payments.length, 1)
  assert.equal(harness._tables.payments[0].amount, 250.00)
  assert.equal(harness._tables.payments[0].provider, 'stripe')
  assert.equal(harness._tables.invoices.length, 1)

  // Perform full SaaS subscription lifecycle
  await SubscriptionService.activateSubscription(
    harness,
    { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin' },
    'org-client-1',
    { paymentReference: 'PAYID-SAAS-SUB' }
  )

  await SubscriptionService.renewSubscription(
    harness,
    { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin' },
    'org-client-1',
    { paymentReference: 'PAYID-SAAS-RENEW' }
  )

  // Homeowner tables must remain 100% untouched
  assert.equal(harness._tables.payments.length, 1, 'Homeowner payments table must not receive SaaS subscription payments')
  assert.equal(harness._tables.payments[0].amount, 250.00)
  assert.equal(harness._tables.invoices.length, 1, 'Homeowner invoices table must not receive SaaS subscription data')

  // SaaS tables must contain the 2 subscription payments
  assert.equal(harness._tables.saas_payments.length, 2)
  assert.equal(harness._tables.saas_subscriptions.length, 1)
})
