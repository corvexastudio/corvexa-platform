/**
 * CAPTODESK — PHASE 3.7: UNLIMITED FREE BOOKING TIER, CONTEXTUAL $99 SOLO vs. $199 FLEET UPGRADE ROUTING, AND FOOLPROOF SANDBOX PRACTICE JOB
 * 
 * Verifies:
 * 1. Freemium Tiers Definition ($0 Free, $99 Solo, $199 Fleet) and Plan Resolution.
 * 2. Pro Telecom Entitlement Guard (`isProAutomationEntitled`).
 * 3. Toll-Free Number (`+18777713802`) Isolation Guard (strictly isolated to Demo tenant).
 * 4. $0 Public Booking Telnyx SMS Suppression on Free Tier.
 * 5. Missed Call Recovery Free Tier Suppression & Lead Logging (`free_tier_no_telecom`).
 * 6. Sandbox Practice Job Identification (`isPracticeJob`) and Idempotent Seeding.
 * 7. Safe Stripe Proration Updates (`proration_behavior: 'create_prorations'`) & SaaS Checkout Sessions.
 */

process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert/strict'

import { 
  getSaasPlan, 
  SAAS_PLANS, 
  SAAS_PLAN_LIST, 
  isProAutomationEntitled, 
  isTollFreeNumberRestricted,
  DEMO_TOLL_FREE_NUMBER,
  DEMO_ORG_ID
} from '../src/lib/billing/plans.ts'
import { isPracticeJob, seedPracticeJobIfMissing, PRACTICE_JOB_NUMBER, PRACTICE_JOB_TITLE } from '../src/lib/jobs/practice-job.ts'
import { StripeService } from '../src/lib/services/stripe-service.ts'
import { createBooking } from '../src/lib/booking/booking-manager.ts'
import { processMissedCall } from '../src/lib/services/call-recovery.ts'

// Mock DB Generator for Telecom & Booking Verification
function createMockFreemiumDb(options = {}) {
  const org = {
    id: options.orgId || 'org-freemium-101',
    name: options.orgName || 'Acme Free HVAC',
    slug: options.orgSlug || 'acme-free-hvac',
    subscription_status: options.subscriptionStatus || 'active',
    plan_id: options.planId || 'free',
    telnyx_phone_number: options.telnyxPhone || '+15125550100',
    owner_phone: '+15125550100',
    timezone: 'America/Chicago',
    is_missed_call_active: true,
    is_review_engine_active: true,
    auto_reply_template: 'Hi! We missed your call.',
    ...options.orgOverrides
  }

  const tables = {
    organizations: [org],
    profiles: [],
    services: [
      {
        id: 'svc-1',
        org_id: org.id,
        name: 'AC Diagnostic',
        duration_minutes: 60,
        price: 89.00,
        requires_address: true,
        is_active: true,
        sort_order: 1
      }
    ],
    contacts: [],
    appointments: [],
    leads: [],
    jobs: [],
    notifications: [],
    compliance_audit_logs: [],
    calls: [],
    conversations: [],
    messages: [],
    saas_subscriptions: []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []

      const queryBuilder = {
        select: (cols) => queryBuilder,
        eq: (col, val) => {
          filters.push(row => row[col] === val)
          return queryBuilder
        },
        in: (col, vals) => {
          filters.push(row => Array.isArray(vals) ? vals.includes(row[col]) : row[col] === vals)
          return queryBuilder
        },
        gte: () => queryBuilder,
        lte: () => queryBuilder,
        gt: () => queryBuilder,
        lt: () => queryBuilder,
        order: () => queryBuilder,
        limit: () => queryBuilder,
        then: (resolve, reject) => {
          const list = tables[tableName] || []
          const found = list.filter(row => filters.every(f => f(row)))
          return Promise.resolve({ data: found, error: null }).then(resolve, reject)
        },
        maybeSingle: async () => {
          const list = tables[tableName] || []
          const found = list.find(row => filters.every(f => f(row)))
          return { data: found || null, error: null }
        },
        single: async () => {
          const list = tables[tableName] || []
          const found = list.find(row => filters.every(f => f(row)))
          if (!found) return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
          return { data: found, error: null }
        },
        insert: (payload) => {
          const items = Array.isArray(payload) ? payload : [payload]
          const inserted = items.map(item => ({
            id: item.id || `gen-${Math.random().toString(36).substring(2, 9)}`,
            created_at: item.created_at || new Date().toISOString(),
            ...item
          }))
          tables[tableName] = tables[tableName] || []
          tables[tableName].push(...inserted)

          const insertChain = {
            select: () => insertChain,
            single: async () => ({ data: { ...inserted[0] }, error: null }),
            maybeSingle: async () => ({ data: { ...inserted[0] }, error: null }),
            then: (resolve, reject) => Promise.resolve({ data: inserted, error: null }).then(resolve, reject)
          }
          return insertChain
        },
        update: (payload) => ({
          eq: (col, val) => {
            const list = tables[tableName] || []
            const target = list.find(row => row[col] === val)
            if (target) Object.assign(target, payload)
            return Promise.resolve({ data: target || null, error: null })
          }
        }),
        upsert: async (payload, opts) => {
          const item = { ...payload, id: payload.id || crypto.randomUUID(), updated_at: new Date().toISOString() }
          tables[tableName] = tables[tableName] || []
          const conflictCol = opts?.onConflict?.includes('org_id') ? 'org_id' : 'id'
          const existingIdx = tables[tableName].findIndex(r => r[conflictCol] === payload[conflictCol])
          if (existingIdx >= 0) {
            tables[tableName][existingIdx] = { ...tables[tableName][existingIdx], ...item }
          } else {
            tables[tableName].push(item)
          }
          return { data: item, error: null }
        }
      }
      return queryBuilder
    }
  }

  return { client, tables }
}

test('PHASE 3.7: Freemium Tiers & Plan Resolution', async (t) => {
  await t.test('resolves free tier correctly with $0 pricing and free features', () => {
    const freePlan = getSaasPlan('free')
    assert.equal(freePlan.id, 'free')
    assert.equal(freePlan.amount, 0)
    assert.equal(freePlan.currency, 'USD')
    assert.equal(freePlan.tier, 'free')
    assert.equal(freePlan.setupFee, 0)
    assert.equal(freePlan.maxUsers, 1)
    assert.ok(freePlan.features.length >= 5)
    assert.ok(freePlan.features.some(f => f.includes('Unlimited public web bookings')))
    assert.ok(freePlan.features.some(f => f.includes('unmasked customer contact info')))
  })

  await t.test('resolves solo and fleet plans correctly', () => {
    const soloPlan = getSaasPlan('solo')
    assert.equal(soloPlan.id, 'solo')
    assert.equal(soloPlan.amount, 99)
    assert.equal(soloPlan.tier, 'solo')

    const fleetPlan = getSaasPlan('fleet')
    assert.equal(fleetPlan.id, 'multi_crew')
    assert.equal(fleetPlan.amount, 199)
    assert.equal(fleetPlan.tier, 'multi_crew')
  })

  await t.test('includes free tier in SAAS_PLAN_LIST', () => {
    const ids = SAAS_PLAN_LIST.map(p => p.id)
    assert.ok(ids.includes('free'), 'SAAS_PLAN_LIST must contain the free tier')
    assert.ok(ids.includes('solo'), 'SAAS_PLAN_LIST must contain solo tier')
    assert.ok(ids.includes('multi_crew'), 'SAAS_PLAN_LIST must contain multi_crew tier')
  })
})

test('PHASE 3.7: Telecom Entitlement Function (isProAutomationEntitled)', async (t) => {
  await t.test('returns false for free tier organizations', () => {
    assert.equal(isProAutomationEntitled({ subscription_status: 'active', plan_id: 'free' }), false)
    assert.equal(isProAutomationEntitled({ subscription_status: 'trial', plan_id: 'free' }), false)
    assert.equal(isProAutomationEntitled({ subscription_status: 'active', plan_id: 'trial_free' }), false)
  })

  await t.test('returns true for active solo and fleet subscriptions', () => {
    assert.equal(isProAutomationEntitled({ subscription_status: 'active', plan_id: 'solo' }), true)
    assert.equal(isProAutomationEntitled({ subscription_status: 'active', plan_id: 'fleet' }), true)
    assert.equal(isProAutomationEntitled({ subscription_status: 'active', plan_id: 'multi_crew' }), true)
    assert.equal(isProAutomationEntitled({ subscription_status: 'trial', plan_id: 'solo' }), true)
  })

  await t.test('returns false for expired, canceled, or null subscriptions', () => {
    assert.equal(isProAutomationEntitled({ subscription_status: 'expired', plan_id: 'solo' }), false)
    assert.equal(isProAutomationEntitled({ subscription_status: 'canceled', plan_id: 'solo' }), false)
    assert.equal(isProAutomationEntitled({ subscription_status: 'past_due', plan_id: 'multi_crew' }), false)
    assert.equal(isProAutomationEntitled(null), false)
    assert.equal(isProAutomationEntitled(undefined), false)
  })
})

test('PHASE 3.7: Demo Toll-Free Number (+18777713802) Isolation Guard', async (t) => {
  await t.test('strictly restricts TFN from non-demo client tenants', () => {
    const isRestrictedForClient = isTollFreeNumberRestricted('+18777713802', {
      id: 'org-client-123',
      slug: 'austin-premier-plumbing'
    })
    assert.equal(isRestrictedForClient, true, 'Client tenant should be restricted from sending via Demo TFN')

    const isRestrictedWithoutOrg = isTollFreeNumberRestricted(DEMO_TOLL_FREE_NUMBER, null)
    assert.equal(isRestrictedWithoutOrg, true, 'TFN without organization context must be restricted')
  })

  await t.test('allows TFN strictly for the platform demo organization', () => {
    const allowedForDemoSlug = isTollFreeNumberRestricted('+18777713802', {
      id: 'any-id',
      slug: 'demo'
    })
    assert.equal(allowedForDemoSlug, false, 'Demo organization slug must be allowed to use Demo TFN')

    const allowedForDemoId = isTollFreeNumberRestricted('+18777713802', {
      id: DEMO_ORG_ID,
      slug: 'interactive-showcase'
    })
    assert.equal(allowedForDemoId, false, 'Canonical DEMO_ORG_ID must be allowed to use Demo TFN')
  })

  await t.test('does not restrict non-TFN normal business numbers', () => {
    assert.equal(isTollFreeNumberRestricted('+15125550199', { slug: 'acme-plumbing' }), false)
  })
})

test('PHASE 3.7: Strict $0 Telnyx Guard on Public Booking', async (t) => {
  await t.test('creates appointment and contact without sending Telnyx SMS on free tier', async () => {
    const { client, tables } = createMockFreemiumDb({
      subscriptionStatus: 'active',
      planId: 'free'
    })

    const bookingResult = await createBooking(client, {
      orgId: 'org-freemium-101',
      customerName: 'Sarah Homeowner',
      customerPhone: '+15125550188',
      customerAddress: '404 Free Tier Blvd, Austin, TX',
      startTime: new Date(Date.now() + 86400000).toISOString(),
      serviceId: 'svc-1'
    })

    assert.equal(bookingResult.success, true, 'Booking should succeed seamlessly on free tier')
    assert.ok(bookingResult.appointment?.id, 'Appointment must be created')

    // Verify appointment was created with full unmasked details
    const appt = tables.appointments[0]
    assert.ok(appt, 'Appointment must exist in database')

    // Verify contact was created
    const contact = tables.contacts[0]
    assert.ok(contact, 'Contact must exist in database')
    assert.equal(contact.name, 'Sarah Homeowner')
    assert.equal(contact.phone, '+15125550188')

    // Verify zero Telnyx SMS was dispatched to messages table
    assert.equal(tables.messages.length, 0, 'No outbound Telnyx SMS should be sent on free tier')

    // Verify compliance audit record was logged with reason 'free_tier_no_telecom'
    const audit = tables.compliance_audit_logs.find(a => a.reason === 'free_tier_no_telecom')
    assert.ok(audit, 'A compliance audit with reason free_tier_no_telecom must be recorded')
    assert.equal(audit.action, 'message_suppressed')

    // Verify in-app notification was dispatched with unmasked info
    const notif = tables.notifications.find(n => n.title.includes('New Online Booking'))
    assert.ok(notif, 'In-app notification should alert contractor of booking')
    assert.ok(notif.message.includes('+15125550188'), 'Contractor must see full unmasked phone number')
  })
})

test('PHASE 3.7: Missed Call Recovery Free Tier Telecom Guard', async (t) => {
  await t.test('suppresses auto-reply SMS on free tier while preserving lead contact', async () => {
    const { client, tables } = createMockFreemiumDb({
      subscriptionStatus: 'active',
      planId: 'free'
    })

    const callResult = await processMissedCall(client, {
      callerNumber: '+15125550177',
      calledNumber: '+15125550100',
      callOutcome: {
        state: 'missed',
        wasAnswered: false,
        isEligibleForRecovery: true,
        durationSeconds: 0,
        hangupCause: 'normal_clearing'
      }
    })

    assert.equal(callResult.success, true)
    assert.equal(callResult.action, 'suppressed_free_tier')
    assert.equal(callResult.suppressionReason, 'free_tier_no_telecom')

    // Verify call row was recorded with suppression reason
    const callRecord = tables.calls[0]
    assert.ok(callRecord)
    assert.equal(callRecord.auto_reply_sent, false)
    assert.equal(callRecord.suppression_reason, 'free_tier_no_telecom')

    // Verify caller lead was preserved
    const lead = tables.leads[0]
    assert.ok(lead, 'Lead record must be created so contractor does not lose customer')
    assert.ok(lead.notes.includes('Free tier'))
  })
})

test('PHASE 3.7: Sandbox Practice Job Identification & Seeding', async (t) => {
  await t.test('isPracticeJob accurately detects sandbox practice jobs', () => {
    assert.equal(isPracticeJob({ notes: 'SANDBOX_PRACTICE_JOB: Tap buttons to test' }), true)
    assert.equal(isPracticeJob({ title: '🧪 [PRACTICE] Water Heater Diagnostic' }), true)
    assert.equal(isPracticeJob({ title: '[PRACTICE] Alex Homeowner' }), true)
    assert.equal(isPracticeJob({ job_number: 'PRACTICE-101' }), true)

    assert.equal(isPracticeJob({ title: 'AC Filter Replacement', notes: 'Real customer repair' }), false)
    assert.equal(isPracticeJob({ job_number: 'JOB-2024-001' }), false)
    assert.equal(isPracticeJob(null), false)
  })

  await t.test('seedPracticeJobIfMissing is idempotent', async () => {
    const { client, tables } = createMockFreemiumDb()

    const firstSeed = await seedPracticeJobIfMissing(client, 'org-freemium-101', {
      ownerPhone: '+15125550199',
      ownerName: 'Acme Owner'
    })

    assert.equal(firstSeed.success, true)
    assert.equal(tables.jobs.length, 1)
    assert.equal(tables.jobs[0].job_number, PRACTICE_JOB_NUMBER)
    assert.equal(tables.jobs[0].title, PRACTICE_JOB_TITLE)

    // Repeat call should not duplicate
    const secondSeed = await seedPracticeJobIfMissing(client, 'org-freemium-101')
    assert.equal(secondSeed.success, true)
    assert.equal(tables.jobs.length, 1, 'Should not insert duplicate practice jobs')
  })
})

test('PHASE 3.7: Safe Stripe Proration Updates & SaaS Checkout Sessions', async (t) => {
  await t.test('updateSubscriptionPlan executes with create_prorations', async () => {
    let capturedUpdateParams = null

    const mockStripeClient = {
      subscriptions: {
        retrieve: async (subId) => ({
          id: subId,
          items: {
            data: [{ id: 'si_item_123' }]
          }
        }),
        update: async (subId, params) => {
          capturedUpdateParams = params
          return {
            id: subId,
            status: 'active'
          }
        }
      }
    }

    const result = await StripeService.updateSubscriptionPlan({
      stripeSubscriptionId: 'sub_test_solo_to_fleet',
      targetPlanId: 'fleet',
      customStripeClient: mockStripeClient
    })

    assert.equal(result.success, true)
    assert.equal(result.prorationBehavior, 'create_prorations')
    assert.ok(capturedUpdateParams, 'Stripe subscriptions.update must have been called')
    assert.equal(capturedUpdateParams.proration_behavior, 'create_prorations', 'Must use create_prorations to prevent double-billing')
    assert.equal(capturedUpdateParams.items[0].id, 'si_item_123')
  })

  await t.test('createSaaSCheckoutSession configures subscription mode with proper amount', async () => {
    let capturedSessionParams = null

    const mockStripeClient = {
      checkout: {
        sessions: {
          create: async (params) => {
            capturedSessionParams = params
            return {
              id: 'cs_test_session_123',
              url: 'https://checkout.stripe.com/pay/cs_test_session_123'
            }
          }
        }
      }
    }

    const sessionResult = await StripeService.createSaaSCheckoutSession({
      orgId: 'org-test-123',
      orgSlug: 'test-hvac',
      customerEmail: 'owner@test-hvac.com',
      planId: 'solo',
      baseUrl: 'https://app.captodesk.com',
      customStripeClient: mockStripeClient
    })

    assert.equal(sessionResult.sessionId, 'cs_test_session_123')
    assert.ok(sessionResult.checkoutUrl.includes('stripe.com'))
    assert.ok(capturedSessionParams)
    assert.equal(capturedSessionParams.mode, 'subscription')
    assert.equal(capturedSessionParams.line_items[0].price_data.unit_amount, 9900)
    assert.equal(capturedSessionParams.line_items[0].price_data.recurring.interval, 'month')
  })
})
