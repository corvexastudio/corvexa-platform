process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert/strict'

import { SAAS_PLANS, getSaasPlan, getStandardSetupFee, getEffectiveSetupFee } from '../src/lib/billing/plans.ts'
import { POST as billingPost } from '../src/app/api/client/billing/route.ts'

// --- Mock Multi-Tenant Constants ---
const ORG_A = 'org-apex-001'

const TEST_USER = {
  id: 'usr-owner-01',
  email: 'owner@apexplumbing.com',
  role: 'owner',
  org_id: ORG_A
}

function createMockSupabase(initialState = {}) {
  const db = {
    organizations: [{
      id: ORG_A,
      name: 'Apex Plumbing',
      slug: 'apex-plumbing',
      plan_id: 'solo',
      subscription_status: 'active',
      monthly_rate: 99.00,
      billing_provider: 'stripe',
      waive_setup_fee: true,
      ...initialState.org
    }],
    saas_subscriptions: [{
      id: 'sub-001',
      org_id: ORG_A,
      plan_id: 'solo',
      status: 'active',
      amount: 99.00,
      billing_interval: 'month',
      cancel_at_period_end: false,
      ...initialState.subscription
    }],
    audit_logs: []
  }

  const client = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: TEST_USER.id,
            email: TEST_USER.email,
            user_metadata: { role: TEST_USER.role, org_id: TEST_USER.org_id }
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
                  id: TEST_USER.id,
                  email: TEST_USER.email,
                  role: TEST_USER.role,
                  org_id: TEST_USER.org_id
                },
                error: null
              }),
              maybeSingle: async () => ({
                data: {
                  id: TEST_USER.id,
                  email: TEST_USER.email,
                  role: TEST_USER.role,
                  org_id: TEST_USER.org_id
                },
                error: null
              })
            })
          })
        }
      }

      let currentQuery = {
        table,
        filters: [],
        selectFields: '*'
      }

      const chain = {
        select: (fields = '*') => {
          currentQuery.selectFields = fields
          return chain
        },
        eq: (col, val) => {
          currentQuery.filters.push({ col, val })
          return chain
        },
        maybeSingle: async () => {
          const records = (db[table] || []).filter((r) => {
            return currentQuery.filters.every((f) => r[f.col] === f.val)
          })
          return { data: records[0] || null, error: null }
        },
        single: async () => {
          const records = (db[table] || []).filter((r) => {
            return currentQuery.filters.every((f) => r[f.col] === f.val)
          })
          return { data: records[0] || null, error: null }
        },
        update: (updates) => {
          return {
            eq: (col, val) => {
              const rows = db[table] || []
              let updatedRow = null
              for (const row of rows) {
                if (row[col] === val) {
                  Object.assign(row, updates)
                  updatedRow = { ...row }
                }
              }
              const res = { data: updatedRow, error: null }
              return {
                ...res,
                then: (resolve) => resolve(res),
                select: () => ({
                  single: async () => ({ data: updatedRow, error: null }),
                  maybeSingle: async () => ({ data: updatedRow, error: null })
                })
              }
            }
          }
        },
        upsert: async (record) => {
          const rows = db[table] || []
          const idx = rows.findIndex((r) => r.org_id === record.org_id)
          if (idx >= 0) {
            Object.assign(rows[idx], record)
          } else {
            rows.push(record)
          }
          return { data: null, error: null }
        },
        insert: async (record) => {
          if (!db[table]) db[table] = []
          db[table].push(record)
          return { data: null, error: null }
        }
      }

      return chain
    },
    _getDb: () => db
  }

  return client
}

test('1. Canonical Plan Pricing and Entitlements Verification', async () => {
  // Free Starter Pass
  const freePlan = getSaasPlan('free')
  assert.equal(freePlan.amount, 0)
  assert.equal(freePlan.tier, 'free')
  assert.equal(freePlan.maxFreeCompletedJobs, 3)
  assert.equal(getStandardSetupFee('free'), 0)
  assert.equal(getEffectiveSetupFee('free'), 0)

  // Solo Pro
  const soloPlan = getSaasPlan('solo')
  assert.equal(soloPlan.amount, 99.00)
  assert.equal(soloPlan.billingInterval, 'month')
  assert.equal(getStandardSetupFee('solo'), 199.00)
  assert.equal(getEffectiveSetupFee('solo', { waive_setup_fee: true }), 0)

  // Solo Yearly
  const soloYearly = getSaasPlan('solo_yearly')
  assert.equal(soloYearly.amount, 990.00)
  assert.equal(soloYearly.billingInterval, 'year')
  // Verified annual savings: 12 * $99 = $1188. $1188 - $990 = $198 savings (2 months free)
  assert.equal((12 * 99) - soloYearly.amount, 198)

  // Multi-Crew Monthly
  const fleetPlan = getSaasPlan('multi_crew')
  assert.equal(fleetPlan.amount, 199.00)
  assert.equal(fleetPlan.tier, 'multi_crew')
  assert.equal(getStandardSetupFee('multi_crew'), 299.00)
  assert.equal(getEffectiveSetupFee('multi_crew', { waive_setup_fee: true }), 0)

  // Multi-Crew Yearly
  const fleetYearly = getSaasPlan('multi_crew_yearly')
  assert.equal(fleetYearly.amount, 1990.00)
  assert.equal(fleetYearly.billingInterval, 'year')
  // Verified annual savings: 12 * $199 = $2388. $2388 - $1990 = $398 savings (2 months free)
  assert.equal((12 * 199) - fleetYearly.amount, 398)
})

test('2. Subscription Actions Compatibility (cancel and cancel_subscription)', async () => {
  // Test action: cancel
  const mockSupabase1 = createMockSupabase()
  const req1 = new Request('http://localhost:3000/api/client/billing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel', reason: 'Seasonal slowdown' })
  })
  const res1 = await billingPost(req1, { customSupabase: mockSupabase1 })
  const data1 = await res1.json()
  assert.equal(res1.status, 200)
  assert.equal(data1.success, true)

  // Test action: cancel_subscription alias
  const mockSupabase2 = createMockSupabase()
  const req2 = new Request('http://localhost:3000/api/client/billing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel_subscription', reason: 'Switching tools' })
  })
  const res2 = await billingPost(req2, { customSupabase: mockSupabase2 })
  const data2 = await res2.json()
  assert.equal(res2.status, 200)
  assert.equal(data2.success, true)
})

test('3. Subscription Actions Compatibility (reactivate and reactivate_subscription)', async () => {
  // Test action: reactivate
  const mockSupabase1 = createMockSupabase({
    subscription: { cancel_at_period_end: true }
  })
  const req1 = new Request('http://localhost:3000/api/client/billing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reactivate' })
  })
  const res1 = await billingPost(req1, { customSupabase: mockSupabase1 })
  const data1 = await res1.json()
  assert.equal(res1.status, 200)
  assert.equal(data1.success, true)

  // Test action: reactivate_subscription alias
  const mockSupabase2 = createMockSupabase({
    subscription: { cancel_at_period_end: true }
  })
  const req2 = new Request('http://localhost:3000/api/client/billing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reactivate_subscription' })
  })
  const res2 = await billingPost(req2, { customSupabase: mockSupabase2 })
  const data2 = await res2.json()
  assert.equal(res2.status, 200)
  assert.equal(data2.success, true)
})

test('4. Downgrade to Free Starter Pass preserves organization without deletion', async () => {
  const mockSupabase = createMockSupabase()
  const req = new Request('http://localhost:3000/api/client/billing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'request_change',
      targetPlanId: 'free',
      notes: 'Returning to solo starter pass'
    })
  })
  const res = await billingPost(req, { customSupabase: mockSupabase })
  const data = await res.json()
  assert.equal(res.status, 200)
  assert.equal(data.success, true)
  assert.equal(data.downgraded, true)

  // Verify DB state
  const db = mockSupabase._getDb()
  const org = db.organizations[0]
  assert.equal(org.plan_id, 'free')
  assert.equal(org.monthly_rate, 0)
  assert.equal(org.subscription_status, 'free')
})
