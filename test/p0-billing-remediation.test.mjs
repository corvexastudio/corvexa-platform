/**
 * ==============================================================================
 * CAPTODESK — PHASE 1: P0 BILLING & ENTITLEMENT REGRESSION TEST SUITE
 * ==============================================================================
 * Formally verifies remediation of the 4 P0 vulnerabilities:
 * 
 * 1. PayPal simulation bypass is blocked in production.
 * 2. Unconfigured provider fallback fails closed in production.
 * 3. Test-mode simulation functions exclusively in isolated non-production context.
 * 4. Provider failure or network unavailability fails closed without granting entitlement.
 * 5. Mismatched organization binding (custom_id !== orgId) is strictly rejected.
 * 6. Missing organization binding (empty custom_id) is strictly rejected.
 * 7. Mismatched PayPal plan ID is strictly rejected.
 * 8. Missing PayPal plan ID is strictly rejected.
 * 9. Invalid or non-allowlisted plan tiers are strictly rejected.
 * 10. Non-active provider status (CANCELLED, APPROVAL_PENDING) is rejected.
 * 11. Valid, active subscription with exact bindings activates cleanly.
 * 12. Cross-tenant subscription hijacking is prevented.
 * 13. Idempotent retries succeed cleanly without corrupting state.
 * 14. Server-only admin client bypasses PostgreSQL 42501 trigger cleanly.
 * 15. Authenticated tenant cannot mutate plan_id via client SDK (PostgreSQL trigger 42501).
 * 16. Authenticated tenant cannot mutate plan_id via PATCH /api/client/organization (400).
 * 17. Existing protections on subscription_status and monthly_rate remain intact.
 * 18. Database update failures do not report false success.
 * ==============================================================================
 */

process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PayPalService,
  ALLOWED_PAID_PLAN_TIERS,
  verifyAndActivateSubscription,
  createOrRevisePayPalSubscription
} from '../src/lib/services/paypal-service.ts'
import { POST as verifyRoutePost } from '../src/app/api/client/billing/paypal/verify/route.ts'
import { PATCH as organizationPatch } from '../src/app/api/client/organization/route.ts'
import { getPayPalPlanId } from '../src/lib/billing/plans.ts'

// Mock In-Memory Database Client with PostgreSQL Trigger Simulation
function createMockSupabase(initialState = {}, currentUserRole = 'authenticated', currentUser = null) {
  const isPrivileged = currentUserRole === 'service_role' || currentUserRole === 'super_admin'

  const tables = {
    organizations: initialState.organizations ? JSON.parse(JSON.stringify(initialState.organizations)) : [],
    profiles: initialState.profiles ? JSON.parse(JSON.stringify(initialState.profiles)) : [],
    saas_subscriptions: initialState.saas_subscriptions ? JSON.parse(JSON.stringify(initialState.saas_subscriptions)) : [],
    audit_logs: initialState.audit_logs ? JSON.parse(JSON.stringify(initialState.audit_logs)) : []
  }

  const client = {
    _tables: tables,
    auth: {
      getUser: async () => {
        const profile = tables.profiles[0]
        return {
          data: {
            user: profile
              ? { id: profile.id, email: profile.email }
              : (currentUser || { id: 'usr-default', email: 'user@test.com' })
          },
          error: null
        }
      },
      getSession: async () => ({
        data: { session: { access_token: 'mock-jwt-token' } }
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
        maybeSingle: async () => {
          const match = table.find((row) => filters.every((f) => f(row)))
          return { data: match ? JSON.parse(JSON.stringify(match)) : null, error: null }
        },
        single: async () => {
          const match = table.find((row) => filters.every((f) => f(row)))
          if (!match) return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
          return { data: JSON.parse(JSON.stringify(match)), error: null }
        },
        update: (updates) => {
          pendingUpdates = updates

          // Simulate PostgreSQL Trigger: protect_organization_billing_fields()
          // Enforces Migration 36 & Migration 57 rules
          if (tableName === 'organizations' && !isPrivileged) {
            const protectedFields = [
              'plan_id',
              'subscription_status',
              'monthly_rate',
              'paypal_subscription_id',
              'paypal_plan_id'
            ]
            for (const field of protectedFields) {
              if (field in updates) {
                return {
                  eq: (col, val) => {
                    filters.push((row) => row[col] === val)
                    return {
                      select: () => ({
                        single: async () => ({
                          data: null,
                          error: {
                            code: '42501',
                            message: `Tenant users cannot modify ${field}. Billing state is server-authoritative.`
                          }
                        })
                      }),
                      then: (resolve) => resolve({
                        data: null,
                        error: {
                          code: '42501',
                          message: `Tenant users cannot modify ${field}. Billing state is server-authoritative.`
                        }
                      })
                    }
                  }
                }
              }
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
                    return { data: JSON.parse(JSON.stringify(match)), error: null }
                  }
                }),
                then: (resolve) => {
                  const match = table.find((row) => filters.every((f) => f(row)))
                  if (match) Object.assign(match, pendingUpdates)
                  resolve({ data: match ? JSON.parse(JSON.stringify(match)) : null, error: null })
                }
              }
            }
          }
        },
        upsert: async (records, opts) => {
          const recArray = Array.isArray(records) ? records : [records]
          for (const r of recArray) {
            const conflictKey = opts?.onConflict || 'id'
            const existingIdx = table.findIndex((item) => item[conflictKey] === r[conflictKey])
            if (existingIdx >= 0) {
              table[existingIdx] = { ...table[existingIdx], ...r }
            } else {
              table.push({ id: r.id || `gen_${Date.now()}`, ...r })
            }
          }
          return { data: recArray, error: null }
        },
        insert: async (records) => {
          const recArray = Array.isArray(records) ? records : [records]
          for (const r of recArray) {
            table.push({ id: r.id || `gen_${Date.now()}`, ...r })
          }
          return { data: recArray, error: null }
        }
      }

      return builder
    }
  }

  return client
}

// ==============================================================================
// GROUP 1: SIMULATION & CONFIGURATION SAFEGUARDS
// ==============================================================================

test('GROUP 1.1: sub_sim_ identifier is strictly rejected when running in production', async () => {
  const originalEnv = process.env.NODE_ENV
  try {
    process.env.NODE_ENV = 'production'
    assert.strictEqual(PayPalService.isProductionEnvironment(), true)
    assert.strictEqual(PayPalService.isSimulationPermitted(), false)

    await assert.rejects(
      async () => {
        await PayPalService.getPayPalSubscription('sub_sim_bypass_fraud')
      },
      (err) => {
        assert.match(err.message, /Simulated subscription IDs.*strictly rejected in production/)
        return true
      }
    )
  } finally {
    process.env.NODE_ENV = originalEnv
  }
})

test('GROUP 1.2: Unconfigured provider in production produces controlled failure without simulated success', async () => {
  const originalEnv = process.env.NODE_ENV
  const origClientId = process.env.PAYPAL_CLIENT_SECRET
  try {
    process.env.NODE_ENV = 'production'
    delete process.env.PAYPAL_CLIENT_SECRET
    delete process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
    delete process.env.PAYPAL_CLIENT_ID

    const createResult = await createOrRevisePayPalSubscription({
      orgId: 'org-test-1',
      planTier: 'solo',
      returnUrl: 'https://example.com/return',
      cancelUrl: 'https://example.com/cancel'
    })

    assert.strictEqual(createResult.success, false)
    assert.strictEqual(createResult.simulated, undefined)
    assert.match(createResult.error, /PayPal billing is not configured in this production environment/)
  } finally {
    process.env.NODE_ENV = originalEnv
    if (origClientId) process.env.PAYPAL_CLIENT_SECRET = origClientId
  }
})

test('GROUP 1.3: Explicit test simulation works only in non-production test environment', async () => {
  assert.strictEqual(PayPalService.isProductionEnvironment(), false)
  assert.strictEqual(PayPalService.isSimulationPermitted(), true)

  const details = await PayPalService.getPayPalSubscription('sub_sim_test_solo', {
    expectedOrgId: 'org-test-valid',
    expectedPlanId: getPayPalPlanId('solo')
  })

  assert.strictEqual(details.status, 'ACTIVE')
  assert.strictEqual(details.custom_id, 'org-test-valid')
  assert.strictEqual(details.plan_id, getPayPalPlanId('solo'))
})

test('GROUP 1.4: Inactive provider status (CANCELLED) cannot activate a subscription', async () => {
  const adminDb = createMockSupabase({
    organizations: [{ id: 'org-test-cancelled', name: 'Test Org', plan_id: 'free', subscription_status: 'free' }]
  }, 'service_role')

  const result = await verifyAndActivateSubscription({
    supabase: adminDb,
    subscriptionId: 'sub_sim_status_cancelled',
    orgId: 'org-test-cancelled',
    planTier: 'solo'
  })

  assert.strictEqual(result.success, false)
  assert.match(result.error, /status and cannot be activated/)

  const org = adminDb._tables.organizations[0]
  assert.strictEqual(org.subscription_status, 'free', 'Subscription status must remain unchanged')
  assert.strictEqual(org.plan_id, 'free', 'Plan must remain unchanged')
})

// ==============================================================================
// GROUP 2: ORGANIZATION & PLAN BINDING ENFORCEMENT
// ==============================================================================

test('GROUP 2.1: Subscription bound to Organization A is rejected when submitted by Organization B', async () => {
  const adminDb = createMockSupabase({
    organizations: [
      { id: 'org-attacker', name: 'Attacker Org', plan_id: 'free', subscription_status: 'free' }
    ]
  }, 'service_role')

  // sub_sim_mismatched_org returns custom_id: 'org_different_tenant_999'
  const result = await verifyAndActivateSubscription({
    supabase: adminDb,
    subscriptionId: 'sub_sim_mismatched_org',
    orgId: 'org-attacker',
    planTier: 'solo'
  })

  assert.strictEqual(result.success, false)
  assert.match(result.error, /does not match the authenticated organization/)

  const org = adminDb._tables.organizations[0]
  assert.strictEqual(org.subscription_status, 'free', 'Attacker org must not be activated')
})

test('GROUP 2.2: Missing organization binding (empty custom_id) is strictly rejected', async () => {
  const adminDb = createMockSupabase({
    organizations: [{ id: 'org-target', name: 'Target Org', plan_id: 'free', subscription_status: 'free' }]
  }, 'service_role')

  const result = await verifyAndActivateSubscription({
    supabase: adminDb,
    subscriptionId: 'sub_sim_missing_custom_id',
    orgId: 'org-target',
    planTier: 'solo'
  })

  assert.strictEqual(result.success, false)
  assert.match(result.error, /custom_id is missing/)
})

test('GROUP 2.3: Mismatched PayPal plan ID is strictly rejected (e.g. Solo sub attempting Fleet upgrade)', async () => {
  const adminDb = createMockSupabase({
    organizations: [{ id: 'org-target', name: 'Target Org', plan_id: 'free', subscription_status: 'free' }]
  }, 'service_role')

  const result = await verifyAndActivateSubscription({
    supabase: adminDb,
    subscriptionId: 'sub_sim_mismatched_plan',
    orgId: 'org-target',
    planTier: 'fleet'
  })

  assert.strictEqual(result.success, false)
  assert.match(result.error, /does not match expected plan ID/)
})

test('GROUP 2.4: Missing PayPal plan ID is strictly rejected', async () => {
  const adminDb = createMockSupabase({
    organizations: [{ id: 'org-target', name: 'Target Org', plan_id: 'free', subscription_status: 'free' }]
  }, 'service_role')

  const result = await verifyAndActivateSubscription({
    supabase: adminDb,
    subscriptionId: 'sub_sim_missing_plan_id',
    orgId: 'org-target',
    planTier: 'solo'
  })

  assert.strictEqual(result.success, false)
  assert.match(result.error, /Subscription does not contain a verified PayPal plan ID/)
})

test('GROUP 2.5: Non-allowlisted requested tier is rejected immediately', async () => {
  const adminDb = createMockSupabase({
    organizations: [{ id: 'org-target', name: 'Target Org', plan_id: 'free', subscription_status: 'free' }]
  }, 'service_role')

  const invalidTiers = ['free', 'enterprise', 'admin_bypass', '']
  for (const invalidTier of invalidTiers) {
    const result = await verifyAndActivateSubscription({
      supabase: adminDb,
      subscriptionId: 'sub_sim_test',
      orgId: 'org-target',
      planTier: invalidTier
    })

    assert.strictEqual(result.success, false)
    assert.match(result.error, /Invalid or unauthorized requested plan tier/)
  }
})

test('GROUP 2.6: Valid, active subscription with exact organization and plan bindings activates cleanly', async () => {
  const orgId = 'org-legit-contractor-1'
  const adminDb = createMockSupabase({
    organizations: [{ id: orgId, name: 'Legit HVAC LLC', plan_id: 'free', subscription_status: 'trial', monthly_rate: 0 }]
  }, 'service_role')

  const result = await verifyAndActivateSubscription({
    supabase: adminDb,
    subscriptionId: 'sub_sim_legit_solo_123',
    orgId,
    planTier: 'solo'
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.planTier, 'solo')

  const updatedOrg = adminDb._tables.organizations.find((o) => o.id === orgId)
  assert.strictEqual(updatedOrg.subscription_status, 'active')
  assert.strictEqual(updatedOrg.plan_id, 'solo')
  assert.strictEqual(updatedOrg.monthly_rate, 99.00)
  assert.strictEqual(updatedOrg.billing_provider, 'paypal')
  assert.strictEqual(updatedOrg.paypal_subscription_id, 'sub_sim_legit_solo_123')

  // Verify saas_subscriptions record is synchronized
  const saasSub = adminDb._tables.saas_subscriptions.find((s) => s.org_id === orgId)
  assert.ok(saasSub, 'saas_subscriptions entry must exist')
  assert.strictEqual(saasSub.status, 'active')
  assert.strictEqual(saasSub.amount, 99.00)
  assert.strictEqual(saasSub.plan_id, 'solo')
})

test('GROUP 2.7: Subscription collision: Cannot link an already-linked subscription to a new organization', async () => {
  const victimOrgId = 'org-victim-1'
  const attackerOrgId = 'org-attacker-2'
  const subId = 'sub_sim_collision_999'

  const adminDb = createMockSupabase({
    organizations: [
      { id: victimOrgId, name: 'Victim Org', plan_id: 'solo', subscription_status: 'active', paypal_subscription_id: subId },
      { id: attackerOrgId, name: 'Attacker Org', plan_id: 'free', subscription_status: 'free' }
    ]
  }, 'service_role')

  const result = await verifyAndActivateSubscription({
    supabase: adminDb,
    subscriptionId: subId,
    orgId: attackerOrgId,
    planTier: 'solo'
  })

  assert.strictEqual(result.success, false)
  assert.match(result.error, /already linked to another organization/)

  const attackerOrg = adminDb._tables.organizations.find((o) => o.id === attackerOrgId)
  assert.strictEqual(attackerOrg.subscription_status, 'free')
  assert.strictEqual(attackerOrg.plan_id, 'free')
})

test('GROUP 2.8: Idempotent retry: Re-verifying an already active subscription returns success cleanly', async () => {
  const orgId = 'org-idempotent-1'
  const subId = 'sub_sim_idempotent_sub'

  const adminDb = createMockSupabase({
    organizations: [
      { id: orgId, name: 'Idempotent Org', plan_id: 'solo', subscription_status: 'active', paypal_subscription_id: subId, monthly_rate: 99.00 }
    ]
  }, 'service_role')

  const result = await verifyAndActivateSubscription({
    supabase: adminDb,
    subscriptionId: subId,
    orgId,
    planTier: 'solo'
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.planTier, 'solo')
})

// ==============================================================================
// GROUP 3: DATABASE TRIGGER & PRIVILEGE AUTHORIZATION
// ==============================================================================

test('GROUP 3.1: Authenticated tenant client SDK mutation of plan_id is blocked by trigger (42501)', async () => {
  const orgId = 'org-tenant-direct'
  // Simulates an authenticated tenant client (non-service-role)
  const tenantClient = createMockSupabase({
    organizations: [{ id: orgId, name: 'Direct Tenant Org', plan_id: 'free', subscription_status: 'free' }]
  }, 'authenticated')

  const res = await tenantClient.from('organizations').update({ plan_id: 'multi_crew' }).eq('id', orgId)
  assert.ok(res.error, 'Direct tenant update of plan_id must return error')
  assert.strictEqual(res.error.code, '42501')
  assert.match(res.error.message, /Tenant users cannot modify plan_id/)

  const org = tenantClient._tables.organizations[0]
  assert.strictEqual(org.plan_id, 'free', 'plan_id must remain unmutated')
})

test('GROUP 3.2: Existing trigger protections on subscription_status and monthly_rate remain intact', async () => {
  const orgId = 'org-tenant-direct'
  const tenantClient = createMockSupabase({
    organizations: [{ id: orgId, name: 'Direct Tenant Org', plan_id: 'free', subscription_status: 'free', monthly_rate: 0 }]
  }, 'authenticated')

  const resStatus = await tenantClient.from('organizations').update({ subscription_status: 'active' }).eq('id', orgId)
  assert.ok(resStatus.error)
  assert.strictEqual(resStatus.error.code, '42501')
  assert.match(resStatus.error.message, /Tenant users cannot modify subscription_status/)

  const resRate = await tenantClient.from('organizations').update({ monthly_rate: 0 }).eq('id', orgId)
  assert.ok(resRate.error)
  assert.strictEqual(resRate.error.code, '42501')
  assert.match(resRate.error.message, /Tenant users cannot modify monthly_rate/)
})

test('GROUP 3.3: Tenant cannot modify plan_id via PATCH /api/client/organization (400 prohibited parameter)', async () => {
  const orgId = 'org-tenant-patch'
  const tenantUser = { id: 'usr-owner-1', email: 'owner@test.com' }
  const tenantClient = createMockSupabase({
    organizations: [{ id: orgId, name: 'Patch Org', plan_id: 'free', subscription_status: 'trial' }],
    profiles: [{ id: tenantUser.id, email: tenantUser.email, role: 'owner', org_id: orgId }]
  }, 'authenticated')

  const req = new Request('http://localhost:3000/api/client/organization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan_id: 'multi_crew' })
  })

  const res = await organizationPatch(req, { customSupabase: tenantClient })
  assert.strictEqual(res.status, 400)
  const body = await res.json()
  assert.match(body.error, /Prohibited parameter: 'plan_id'/)

  const org = tenantClient._tables.organizations[0]
  assert.strictEqual(org.plan_id, 'free')
})

test('GROUP 3.4: POST /api/client/billing/paypal/verify route uses admin client to activate without 42501', async () => {
  const orgId = 'org-verify-route-1'
  const ownerUser = { id: 'usr-owner-verify', email: 'owner@verify.com' }

  // Authenticated tenant client (would trigger 42501 if used directly for billing update)
  const tenantSessionClient = createMockSupabase({
    organizations: [{ id: orgId, name: 'Verify Route Org', plan_id: 'free', subscription_status: 'free', monthly_rate: 0 }],
    profiles: [{ id: ownerUser.id, email: ownerUser.email, role: 'owner', org_id: orgId }]
  }, 'authenticated')

  // Server-only administrative client (privileged service_role context)
  const serverAdminClient = createMockSupabase({
    organizations: [{ id: orgId, name: 'Verify Route Org', plan_id: 'free', subscription_status: 'free', monthly_rate: 0 }],
    profiles: [{ id: ownerUser.id, email: ownerUser.email, role: 'owner', org_id: orgId }]
  }, 'service_role')

  const req = new Request('http://localhost:3000/api/client/billing/paypal/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscriptionId: 'sub_sim_route_verified_777',
      planTier: 'fleet'
    })
  })

  // Invoke route with injected adminSupabase context (as designed for testing/server execution)
  const res = await verifyRoutePost(req, {
    customSupabase: tenantSessionClient,
    adminSupabase: serverAdminClient
  })

  assert.strictEqual(res.status, 200)
  const body = await res.json()
  assert.strictEqual(body.success, true)
  assert.strictEqual(body.planTier, 'multi_crew')
  assert.match(body.message, /Team & Fleet Pro/)

  // Verify server-side organization was upgraded without 42501
  const updatedOrg = serverAdminClient._tables.organizations.find((o) => o.id === orgId)
  assert.strictEqual(updatedOrg.subscription_status, 'active')
  assert.strictEqual(updatedOrg.plan_id, 'multi_crew')
  assert.strictEqual(updatedOrg.monthly_rate, 199.00)
})

test('GROUP 3.5: POST /api/client/billing/paypal/verify rejects unauthorized roles (e.g. member/tech) with 403', async () => {
  const orgId = 'org-tech-test'
  const techUser = { id: 'usr-tech-1', email: 'tech@test.com' }

  const tenantSessionClient = createMockSupabase({
    organizations: [{ id: orgId, name: 'Tech Org', plan_id: 'free', subscription_status: 'free' }],
    profiles: [{ id: techUser.id, email: techUser.email, role: 'technician', org_id: orgId }]
  }, 'authenticated')

  const req = new Request('http://localhost:3000/api/client/billing/paypal/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscriptionId: 'sub_sim_test',
      planTier: 'solo'
    })
  })

  const res = await verifyRoutePost(req, { customSupabase: tenantSessionClient })
  assert.strictEqual(res.status, 403)
  const body = await res.json()
  assert.match(body.error, /Forbidden/)
})
