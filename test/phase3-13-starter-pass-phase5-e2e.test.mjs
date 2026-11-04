import { test } from 'node:test'
import assert from 'node:assert/strict'

import { SubscriptionService } from '../src/lib/billing/subscription-service.ts'
import { createBooking } from '../src/lib/booking/booking-manager.ts'
import { updateJobStatus } from '../src/lib/jobs/job-manager.ts'
import { createInvoice, sendInvoice } from '../src/lib/payments/invoice-manager.ts'
import { PRACTICE_JOB_NUMBER, PRACTICE_JOB_TITLE } from '../src/lib/jobs/practice-job.ts'
import { renderSituationAwareText } from '../src/lib/notifications/situation-templates.ts'
import { formatCompliantReviewMessage } from '../src/lib/reviews/review-manager.ts'

/**
 * High-fidelity in-memory Supabase mock client
 * Accurately mimics query builder chaining (select, eq, neq, is, in, gte, lte, order, limit, maybeSingle, single, insert, update, delete)
 */
function createMockSupabase(mockDb) {
  return {
    from: (table) => {
      let filters = []
      let limitCount = null
      let orderCol = null
      let orderAsc = true

      const qb = {
        select: () => qb,
        eq: (col, val) => {
          filters.push(r => r[col] === val)
          return qb
        },
        neq: (col, val) => {
          filters.push(r => r[col] !== val)
          return qb
        },
        is: (col, val) => {
          filters.push(r => r[col] === val)
          return qb
        },
        in: (col, vals) => {
          filters.push(r => Array.isArray(vals) && vals.includes(r[col]))
          return qb
        },
        gte: (col, val) => {
          filters.push(r => r[col] >= val)
          return qb
        },
        lte: (col, val) => {
          filters.push(r => r[col] <= val)
          return qb
        },
        order: (col, opts) => {
          orderCol = col
          orderAsc = opts?.ascending !== false
          return qb
        },
        limit: (n) => {
          limitCount = n
          return qb
        },
        maybeSingle: async () => {
          const rows = mockDb[table] || []
          let filtered = rows.filter(r => filters.every(f => f(r)))
          if (orderCol) {
            filtered = [...filtered].sort((a, b) => {
              if (a[orderCol] < b[orderCol]) return orderAsc ? -1 : 1
              if (a[orderCol] > b[orderCol]) return orderAsc ? 1 : -1
              return 0
            })
          }
          return { data: filtered[0] || null, error: null }
        },
        single: async () => {
          const rows = mockDb[table] || []
          let filtered = rows.filter(r => filters.every(f => f(r)))
          if (orderCol) {
            filtered = [...filtered].sort((a, b) => {
              if (a[orderCol] < b[orderCol]) return orderAsc ? -1 : 1
              if (a[orderCol] > b[orderCol]) return orderAsc ? 1 : -1
              return 0
            })
          }
          return { data: filtered[0] || null, error: filtered[0] ? null : { message: `Not found in ${table}` } }
        },
        then: (resolve) => {
          const rows = mockDb[table] || []
          let filtered = rows.filter(r => filters.every(f => f(r)))
          if (orderCol) {
            filtered = [...filtered].sort((a, b) => {
              if (a[orderCol] < b[orderCol]) return orderAsc ? -1 : 1
              if (a[orderCol] > b[orderCol]) return orderAsc ? 1 : -1
              return 0
            })
          }
          if (typeof limitCount === 'number') {
            filtered = filtered.slice(0, limitCount)
          }
          return Promise.resolve({ data: filtered, error: null }).then(resolve)
        }
      }

      return {
        ...qb,
        insert: (payload) => {
          const items = Array.isArray(payload) ? payload : [payload]
          const inserted = items.map(p => ({
            id: p.id || `${table}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            created_at: p.created_at || new Date().toISOString(),
            ...p
          }))
          mockDb[table] = mockDb[table] || []
          mockDb[table].push(...inserted)

          const first = inserted[0]
          return {
            select: () => ({
              single: async () => ({ data: first, error: null }),
              maybeSingle: async () => ({ data: first, error: null }),
              then: (resolve) => Promise.resolve({ data: Array.isArray(payload) ? inserted : first, error: null }).then(resolve)
            }),
            single: async () => ({ data: first, error: null }),
            maybeSingle: async () => ({ data: first, error: null }),
            then: (resolve) => Promise.resolve({ data: Array.isArray(payload) ? inserted : first, error: null }).then(resolve)
          }
        },
        update: (fields) => {
          let updateFilters = []
          const updateChain = {
            eq: (col, val) => {
              updateFilters.push(r => r[col] === val)
              const rows = mockDb[table] || []
              const matched = rows.filter(r => updateFilters.every(f => f(r)))
              for (const r of matched) {
                Object.assign(r, fields)
              }

              return {
                ...updateChain,
                select: () => ({
                  single: async () => ({ data: matched[0] || null, error: null }),
                  maybeSingle: async () => ({ data: matched[0] || null, error: null }),
                  then: (resolve) => Promise.resolve({ data: matched, error: null }).then(resolve)
                }),
                single: async () => ({ data: matched[0] || null, error: null }),
                maybeSingle: async () => ({ data: matched[0] || null, error: null }),
                then: (resolve) => Promise.resolve({ data: matched, error: null }).then(resolve)
              }
            }
          }
          return updateChain
        },
        delete: () => {
          let deleteFilters = []
          const deleteChain = {
            eq: (col, val) => {
              deleteFilters.push(r => r[col] === val)
              if (mockDb[table]) {
                mockDb[table] = mockDb[table].filter(r => !deleteFilters.every(f => f(r)))
              }
              return {
                ...deleteChain,
                then: (resolve) => Promise.resolve({ data: null, error: null }).then(resolve)
              }
            }
          }
          return deleteChain
        }
      }
    },
    rpc: async (name, params) => {
      if (name === 'next_document_number') {
        const type = params.p_doc_type || 'job'
        mockDb._docCounters = mockDb._docCounters || {}
        mockDb._docCounters[type] = (mockDb._docCounters[type] || 0) + 1
        return { data: mockDb._docCounters[type], error: null }
      }
      return { data: null, error: null }
    }
  }
}

test('Phase 5 E2E: Full Lifecycle Simulation - Free Starter Pass to Pro Upgrade', async () => {
  const orgId = 'org-apex-electric'
  const mockDb = {
    organizations: [
      {
        id: orgId,
        name: 'Apex Electric',
        slug: 'apex-electric',
        plan_id: 'free',
        subscription_status: 'free',
        operation_mode: 'solo',
        owner_phone: '+15551234567',
        telnyx_phone_number: '+15551234567',
        timezone: 'America/New_York',
        buffer_minutes: 15,
        default_duration_minutes: 60,
        google_review_url: 'https://g.page/r/apex-electric/review',
        review_requests_enabled: true,
        is_review_engine_active: true
      }
    ],
    saas_subscriptions: [
      {
        id: 'sub-free',
        org_id: orgId,
        plan_id: 'free',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: null
      }
    ],
    services: [
      {
        id: 'svc-diag',
        org_id: orgId,
        name: 'Electrical Diagnostic',
        duration_minutes: 60,
        price: 150.00,
        requires_address: true,
        is_active: true,
        sort_order: 1
      },
      {
        id: 'svc-panel',
        org_id: orgId,
        name: 'Subpanel Upgrade',
        duration_minutes: 120,
        price: 400.00,
        requires_address: true,
        is_active: true,
        sort_order: 2
      },
      {
        id: 'svc-charger',
        org_id: orgId,
        name: 'EV Charger Installation',
        duration_minutes: 180,
        price: 650.00,
        requires_address: true,
        is_active: true,
        sort_order: 3
      },
      {
        id: 'svc-rewire',
        org_id: orgId,
        name: 'Whole Home Rewire',
        duration_minutes: 240,
        price: 850.00,
        requires_address: true,
        is_active: true,
        sort_order: 4
      }
    ],
    contacts: [],
    leads: [],
    appointments: [],
    jobs: [],
    job_items: [],
    invoices: [],
    invoice_items: [],
    notifications: [],
    notification_deliveries: [],
    automation_runs: [],
    review_requests: [],
    profiles: [{ id: 'user-dave', org_id: orgId, role: 'owner' }],
    crews: []
  }

  const mockSupabase = createMockSupabase(mockDb)

  // =========================================================================
  // 1. Onboarding & Initial State Verification
  // =========================================================================
  const initialEntitlement = await SubscriptionService.getEntitlement(mockSupabase, orgId)
  assert.equal(initialEntitlement.isEntitled, true)
  assert.equal(initialEntitlement.planId, 'free')
  assert.equal(initialEntitlement.status, 'free')
  assert.equal(initialEntitlement.starterUsage?.completedJobsCount, 0)
  assert.equal(initialEntitlement.starterUsage?.remainingJobs, 3)
  assert.equal(initialEntitlement.starterUsage?.isLimitReached, false)
  assert.equal(initialEntitlement.starterUsage?.totalRevenueEarned, 0)

  // Verify welcome text contains contractor's booking page
  const welcomeText = renderSituationAwareText('starter_pass_welcome', {
    targetUrl: 'https://captodesk.com/book/apex-electric'
  })
  assert.ok(welcomeText.includes('first 3 customer jobs are 100% free'))
  assert.ok(welcomeText.includes('https://captodesk.com/book/apex-electric'))

  // =========================================================================
  // 2. Job #1: Homeowner Booking -> En Route -> Complete -> Paid -> Review
  // =========================================================================
  const booking1Res = await createBooking(mockSupabase, {
    orgId,
    serviceId: 'svc-diag',
    customerName: 'Sarah Jenkins',
    customerPhone: '+15559871111',
    customerEmail: 'sarah@example.com',
    customerAddress: '123 Elm St, Austin, TX',
    startTime: '2026-11-10T10:00:00.000Z'
  })
  assert.equal(booking1Res.success, true, 'Job #1 booking must succeed')
  assert.ok(booking1Res.appointment?.id, 'Appointment record created')

  // Verify Job #1 notification
  const notif1 = mockDb.notifications.find(n => n.title?.includes('[Job 1 of 3 Free]'))
  assert.ok(notif1, 'Milestone 1 booking notification generated')
  assert.ok(notif1.message.includes('Sarah Jenkins'), 'Includes customer name')
  assert.ok(notif1.message.includes('2 free job(s) remaining'), 'Accurate remaining quota')

  // Find linked field job
  const job1 = mockDb.jobs.find(j => j.title?.includes('Sarah Jenkins'))
  assert.ok(job1, 'Linked job created in database')
  assert.equal(job1.status, 'scheduled')

  // Advance Job #1 to en_route (Permitted on Starter Pass)
  const enRoute1Res = await updateJobStatus(mockSupabase, {
    jobId: job1.id,
    orgId,
    newStatus: 'en_route',
    notifyCustomer: true,
    technicianName: 'Dave Apex',
    etaMinutes: 15
  })
  assert.equal(enRoute1Res.success, true, 'En route status update allowed')
  assert.equal(mockDb.jobs.find(j => j.id === job1.id).status, 'en_route')

  // Complete Job #1
  const complete1Res = await updateJobStatus(mockSupabase, {
    jobId: job1.id,
    orgId,
    newStatus: 'completed'
  })
  assert.equal(complete1Res.success, true, 'Job #1 completion allowed')
  assert.equal(mockDb.jobs.find(j => j.id === job1.id).status, 'completed')

  // Verify automated draft invoice created for Job #1
  const inv1 = mockDb.invoices.find(i => i.job_id === job1.id)
  assert.ok(inv1, 'Draft invoice auto-generated upon completion')

  // Verify milestone 1 completion notification
  const compNotif1 = mockDb.notifications.find(n => n.title?.includes('[Job 1 of 3 Free Completed]'))
  assert.ok(compNotif1, 'Milestone 1 completion notification created')
  assert.ok(compNotif1.message.includes('Sarah Jenkins'))
  assert.ok(compNotif1.message.includes('2 free jobs remaining'))

  // Verify review automation was scheduled
  const reviewRun1 = mockDb.automation_runs.find(r => r.job_id === `job_review_${job1.id}`)
  assert.ok(reviewRun1, 'Google review request automation run scheduled')
  assert.equal(reviewRun1.action_type, 'send_review_request')

  // Contractor marks Job #1 invoice paid ($150)
  inv1.status = 'paid'
  inv1.amount_paid = 150.00
  inv1.total = 150.00

  // Verify updated entitlement after Job #1
  const usageAfterJob1 = await SubscriptionService.getFreeTierJobUsage(mockSupabase, orgId)
  assert.equal(usageAfterJob1.completedJobsCount, 1)
  assert.equal(usageAfterJob1.remainingJobs, 2)
  assert.equal(usageAfterJob1.totalRevenueEarned, 150.00)
  assert.equal(usageAfterJob1.isLimitReached, false)

  // =========================================================================
  // 3. Job #2: Homeowner Booking -> Complete -> Paid ($400)
  // =========================================================================
  const booking2Res = await createBooking(mockSupabase, {
    orgId,
    serviceId: 'svc-panel',
    customerName: 'Marcus Vance',
    customerPhone: '+15559872222',
    customerEmail: 'marcus@example.com',
    customerAddress: '456 Oak Ave, Austin, TX',
    startTime: '2026-11-11T14:00:00.000Z'
  })
  assert.equal(booking2Res.success, true, 'Job #2 booking must succeed')

  const notif2 = mockDb.notifications.find(n => n.title?.includes('[Job 2 of 3 Free]'))
  assert.ok(notif2, 'Milestone 2 booking notification generated')
  assert.ok(notif2.message.includes('1 free job(s) remaining'))

  const job2 = mockDb.jobs.find(j => j.title?.includes('Marcus Vance'))
  assert.ok(job2)

  // Complete Job #2
  await updateJobStatus(mockSupabase, { jobId: job2.id, orgId, newStatus: 'completed' })
  const inv2 = mockDb.invoices.find(i => i.job_id === job2.id)
  assert.ok(inv2)
  inv2.status = 'paid'
  inv2.amount_paid = 400.00
  inv2.total = 400.00

  // Verify milestone 2 completion notification
  const compNotif2 = mockDb.notifications.find(n => n.title?.includes('[Job 2 of 3 Free Completed]'))
  assert.ok(compNotif2, 'Milestone 2 completion notification created')
  assert.ok(compNotif2.message.includes('$400 collected ($550 total on free pass)'))
  assert.ok(compNotif2.message.includes('1 free job left!'))

  const usageAfterJob2 = await SubscriptionService.getFreeTierJobUsage(mockSupabase, orgId)
  assert.equal(usageAfterJob2.completedJobsCount, 2)
  assert.equal(usageAfterJob2.remainingJobs, 1)
  assert.equal(usageAfterJob2.totalRevenueEarned, 550.00)

  // =========================================================================
  // 4. Job #3: Final Free Job -> Complete -> Trophy Celebration ($650)
  // =========================================================================
  const booking3Res = await createBooking(mockSupabase, {
    orgId,
    serviceId: 'svc-charger',
    customerName: 'Emily Stone',
    customerPhone: '+15559873333',
    customerAddress: '789 Pine Rd, Austin, TX',
    startTime: '2026-11-12T09:00:00.000Z'
  })
  assert.equal(booking3Res.success, true, 'Job #3 booking must succeed')

  const notif3 = mockDb.notifications.find(n => n.title?.includes('[Job 3 of 3 Free]'))
  assert.ok(notif3, 'Milestone 3 booking notification generated')
  assert.ok(notif3.message.includes('This is your final free starter job!'))

  const job3 = mockDb.jobs.find(j => j.title?.includes('Emily Stone'))
  assert.ok(job3)

  // Complete Job #3
  await updateJobStatus(mockSupabase, { jobId: job3.id, orgId, newStatus: 'completed' })
  const inv3 = mockDb.invoices.find(i => i.job_id === job3.id)
  assert.ok(inv3)
  inv3.status = 'paid'
  inv3.amount_paid = 650.00
  inv3.total = 650.00

  // Verify Trophy celebration milestone notification
  const trophyNotif = mockDb.notifications.find(n => n.title?.includes('Starter Pass Completed!'))
  assert.ok(trophyNotif, 'Trophy celebration notification emitted')
  assert.ok(trophyNotif.message.includes('earned $1,200 across 3 jobs on CaptoDesk with $0 platform fees!'))
  assert.ok(trophyNotif.message.includes('Upgrade to Pro'))

  // Verify entitlement status after Job #3: STARTER_LIMIT_REACHED
  const entitlementAfterJob3 = await SubscriptionService.getEntitlement(mockSupabase, orgId)
  assert.equal(entitlementAfterJob3.isEntitled, true)
  assert.equal(entitlementAfterJob3.status, 'starter_limit_reached')
  assert.equal(entitlementAfterJob3.starterUsage?.completedJobsCount, 3)
  assert.equal(entitlementAfterJob3.starterUsage?.remainingJobs, 0)
  assert.equal(entitlementAfterJob3.starterUsage?.isLimitReached, true)
  assert.equal(entitlementAfterJob3.starterUsage?.totalRevenueEarned, 1200.00)

  // =========================================================================
  // 5. Job #4: "Found Money" Booking (NEVER BLOCKED for Homeowner)
  // =========================================================================
  const booking4Res = await createBooking(mockSupabase, {
    orgId,
    serviceId: 'svc-rewire',
    customerName: 'David Miller',
    customerPhone: '+15559874444',
    customerAddress: '321 Maple St, Austin, TX',
    startTime: '2026-11-13T13:00:00.000Z'
  })
  // Homeowner booking MUST NEVER FAIL
  assert.equal(booking4Res.success, true, 'Homeowner booking on Job 4+ must NEVER fail')
  assert.ok(booking4Res.appointment?.id, 'Appointment created')
  assert.ok(booking4Res.manageToken, 'Manage token provided')

  // Contractor receives gated alert
  const gatedAlert = mockDb.notifications.find(n => n.title?.includes('New Online Booking Waiting'))
  assert.ok(gatedAlert, 'Gated booking alert created for contractor')
  assert.ok(gatedAlert.message.includes('David Miller booked Whole Home Rewire'))
  assert.ok(gatedAlert.message.includes("You've completed your 3 free starter jobs"))
  assert.ok(gatedAlert.link.includes('/client/billing?reason=starter_limit'))

  const job4 = mockDb.jobs.find(j => j.title?.includes('David Miller'))
  assert.ok(job4, 'Job 4 record created in database')
  assert.equal(job4.status, 'scheduled')

  // =========================================================================
  // 6. Job #4: Sunk Cost Finish-Line Paywall (Drafting allowed, sending gated)
  // =========================================================================
  // Contractor enters line items and drafts $850 invoice
  const draftInvoiceRes = await createInvoice(mockSupabase, {
    orgId,
    jobId: job4.id,
    contactId: job4.contact_id,
    title: 'Invoice for Whole Home Rewire',
    items: [
      { description: 'Subpanel Installation & Breakers', quantity: 1, unit_price: 550.00 },
      { description: 'Conduit & Copper Wiring Labor', quantity: 1, unit_price: 300.00 }
    ]
  })
  assert.equal(draftInvoiceRes.success, true, 'Contractor CAN draft invoice on Job 4 (zero data loss)')
  assert.equal(draftInvoiceRes.invoice?.total, 850.00)
  const inv4 = draftInvoiceRes.invoice

  // Contractor attempts to send live invoice -> FINISH-LINE PAYWALL
  const sendInvoiceGatedRes = await sendInvoice(mockSupabase, {
    invoiceId: inv4.id,
    orgId,
    baseUrl: 'https://captodesk.com'
  })
  assert.equal(sendInvoiceGatedRes.success, false, 'Send invoice must be gated on Job 4')
  assert.equal(sendInvoiceGatedRes.upgradeRequired, true)
  assert.equal(sendInvoiceGatedRes.code, 'STARTER_LIMIT_REACHED')
  assert.equal(sendInvoiceGatedRes.checkoutUrl, '/client/billing?reason=starter_limit')
  // Assert draft invoice is completely preserved in database
  const preservedInv4 = mockDb.invoices.find(i => i.id === inv4.id)
  assert.ok(preservedInv4, 'Draft invoice remains safely stored')
  assert.equal(preservedInv4.total, 850.00)

  // Contractor attempts to advance status to en_route -> GATED
  const enRouteGatedRes = await updateJobStatus(mockSupabase, {
    jobId: job4.id,
    orgId,
    newStatus: 'en_route',
    technicianName: 'Dave Apex'
  })
  assert.equal(enRouteGatedRes.success, false, 'Advancing to en_route must be gated on Job 4')
  assert.equal(enRouteGatedRes.upgradeRequired, true)
  assert.equal(enRouteGatedRes.code, 'STARTER_LIMIT_REACHED')
  assert.equal(mockDb.jobs.find(j => j.id === job4.id).status, 'scheduled', 'Status remained scheduled')

  // Contractor CAN cancel Job #4 without penalty
  const cancelRes = await updateJobStatus(mockSupabase, {
    jobId: job4.id,
    orgId,
    newStatus: 'cancelled'
  })
  assert.equal(cancelRes.success, true, 'Cancellation is never gated')
  assert.equal(mockDb.jobs.find(j => j.id === job4.id).status, 'cancelled')

  // Re-schedule for upgrade unlock test
  const targetJob4 = mockDb.jobs.find(j => j.id === job4.id)
  targetJob4.status = 'scheduled'

  // =========================================================================
  // 7. Historical Jobs & Practice Sandbox Resilience
  // =========================================================================
  // Historical completed Job #1 re-sending invoice is NEVER gated
  const resendHistRes = await sendInvoice(mockSupabase, {
    invoiceId: inv1.id,
    orgId,
    baseUrl: 'https://captodesk.com'
  })
  assert.equal(resendHistRes.success, true, 'Re-sending invoice for historical completed job is never blocked')

  // Practice sandbox job (PRACTICE-101) can complete without gating or consuming quota
  const practiceJob = {
    id: 'job-practice-101',
    org_id: orgId,
    title: PRACTICE_JOB_TITLE,
    job_number: PRACTICE_JOB_NUMBER,
    status: 'scheduled',
    notes: 'SANDBOX_PRACTICE_JOB: This is a safe practice job'
  }
  mockDb.jobs.push(practiceJob)

  const practiceCompleteRes = await updateJobStatus(mockSupabase, {
    jobId: practiceJob.id,
    orgId,
    newStatus: 'completed'
  })
  assert.equal(practiceCompleteRes.success, true, 'Practice job completion is never gated')

  // Still exactly 3 completed real jobs counted
  const usageWithPractice = await SubscriptionService.getFreeTierJobUsage(mockSupabase, orgId)
  assert.equal(usageWithPractice.completedJobsCount, 3, 'Practice job excluded from quota calculation')

  // =========================================================================
  // 8. Seamless Pro Upgrade Unlocks Job #4 Immediately
  // =========================================================================
  // Contractor upgrades to Solo Pro ($99/mo)
  const futurePeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const orgSub = mockDb.saas_subscriptions.find(s => s.org_id === orgId)
  orgSub.plan_id = 'solo'
  orgSub.status = 'active'
  orgSub.current_period_end = futurePeriodEnd

  const orgRecord = mockDb.organizations.find(o => o.id === orgId)
  orgRecord.plan_id = 'solo'
  orgRecord.subscription_status = 'active'

  const proEntitlement = await SubscriptionService.getEntitlement(mockSupabase, orgId)
  assert.equal(proEntitlement.isEntitled, true)
  assert.equal(proEntitlement.planId, 'solo')
  assert.equal(proEntitlement.status, 'active')

  // Job #4 status advancement is now UNLOCKED
  const enRouteUnlockedRes = await updateJobStatus(mockSupabase, {
    jobId: job4.id,
    orgId,
    newStatus: 'en_route',
    technicianName: 'Dave Apex',
    etaMinutes: 20
  })
  assert.equal(enRouteUnlockedRes.success, true, 'Status advancement unlocked immediately after Pro upgrade')
  assert.equal(mockDb.jobs.find(j => j.id === job4.id).status, 'en_route')

  // Job #4 live invoice sending is now UNLOCKED
  const sendInvoiceUnlockedRes = await sendInvoice(mockSupabase, {
    invoiceId: inv4.id,
    orgId,
    baseUrl: 'https://captodesk.com'
  })
  assert.equal(sendInvoiceUnlockedRes.success, true, 'Live invoice sending unlocked immediately after Pro upgrade')
  assert.ok(sendInvoiceUnlockedRes.checkoutUrl, 'Live payment link generated')
  assert.equal(mockDb.invoices.find(i => i.id === inv4.id).status, 'sent')
})

test('Phase 5 E2E: Multi-Crew Operation Mode Variation & Crew Action Routing', () => {
  const soloText = renderSituationAwareText('starter_job_booked', {
    operationMode: 'solo',
    customerName: 'Alice Green',
    serviceName: 'HVAC Tune-up',
    bookingTime: 'Tomorrow at 10:00 AM',
    jobMilestone: 1,
    targetUrl: '/client/jobs'
  })
  assert.ok(soloText.includes('Tap to review: /client/jobs'), 'Solo mode directs contractor to review job')

  const multiCrewText = renderSituationAwareText('starter_job_booked', {
    operationMode: 'multi_crew',
    customerName: 'Alice Green',
    serviceName: 'HVAC Tune-up',
    bookingTime: 'Tomorrow at 10:00 AM',
    jobMilestone: 1,
    targetUrl: '/client/jobs'
  })
  assert.ok(multiCrewText.includes('Tap to assign crew: /client/jobs'), 'Multi-crew mode directs contractor to assign crew')
})

test('Phase 5 E2E: Compliant Review Request Formatting & Zero Star Mention', () => {
  const reviewMessage = formatCompliantReviewMessage('Apex Electric', 'https://g.page/r/apex-electric/review', {
    operationMode: 'solo',
    customerName: 'Sarah',
    technicianName: 'Dave'
  })

  // Google compliance: never mandate or gate for 5 stars
  assert.ok(!reviewMessage.includes('5 star') && !reviewMessage.includes('5-star'), 'Compliant with Google policies (no 5-star gating)')
  assert.ok(reviewMessage.includes('Apex Electric'), 'Includes trade business name')
  assert.ok(reviewMessage.includes('https://g.page/r/apex-electric/review'), 'Includes verified review URL')
})

test('Phase 5 E2E: Booking Slot Concurrency & Friendly Homeowner Handling', async () => {
  const orgId = 'org-concurrency-test'
  const mockDb = {
    organizations: [
      {
        id: orgId,
        name: 'Speedy Plumber',
        slug: 'speedy-plumber',
        plan_id: 'free',
        subscription_status: 'free',
        timezone: 'America/Chicago',
        buffer_minutes: 15,
        default_duration_minutes: 60
      }
    ],
    services: [
      {
        id: 'svc-drain',
        org_id: orgId,
        name: 'Drain Cleaning',
        duration_minutes: 60,
        price: 200.00,
        requires_address: true,
        is_active: true
      }
    ],
    appointments: [],
    contacts: [],
    leads: [],
    jobs: [],
    notifications: []
  }
  const mockSupabase = createMockSupabase(mockDb)

  // First customer books slot at 10:00 AM
  const booking1 = await createBooking(mockSupabase, {
    orgId,
    serviceId: 'svc-drain',
    customerName: 'Customer A',
    customerPhone: '+15551112222',
    customerAddress: '100 Main St',
    startTime: '2026-11-20T10:00:00.000Z'
  })
  assert.equal(booking1.success, true, 'First booking succeeds')

  // Second customer tries to book overlapping slot (10:30 AM within 60 min duration + 15 min buffer)
  const booking2 = await createBooking(mockSupabase, {
    orgId,
    serviceId: 'svc-drain',
    customerName: 'Customer B',
    customerPhone: '+15553334444',
    customerAddress: '200 Main St',
    startTime: '2026-11-20T10:30:00.000Z'
  })
  assert.equal(booking2.success, false, 'Overlapping booking safely rejected')
  assert.ok(booking2.error?.includes('slot is no longer available'), 'Friendly slot collision message')

  // Contractor Starter Pass quota is unaffected
  const usage = await SubscriptionService.getFreeTierJobUsage(mockSupabase, orgId)
  assert.equal(usage.completedJobsCount, 0, 'No jobs completed')
  assert.equal(usage.remainingJobs, 3, 'Full 3 free jobs remaining')
})

test('Phase 5 E2E: Precise Fractional Revenue Tracking ($0 Platform Fees)', async () => {
  const orgId = 'org-fractional-revenue'
  const mockDb = {
    jobs: [
      { id: 'j-1', org_id: orgId, title: 'Job 1', status: 'completed' },
      { id: 'j-2', org_id: orgId, title: 'Job 2', status: 'completed' },
      { id: 'j-3', org_id: orgId, title: 'Job 3', status: 'completed' }
    ],
    invoices: [
      { id: 'inv-1', org_id: orgId, status: 'paid', amount_paid: 149.99, total: 149.99 },
      { id: 'inv-2', org_id: orgId, status: 'paid', amount_paid: 399.50, total: 399.50 },
      { id: 'inv-3', org_id: orgId, status: 'paid', amount_paid: 650.51, total: 650.51 }
    ]
  }
  const mockSupabase = createMockSupabase(mockDb)

  const usage = await SubscriptionService.getFreeTierJobUsage(mockSupabase, orgId)
  assert.equal(usage.completedJobsCount, 3)
  assert.equal(usage.isLimitReached, true)
  assert.equal(usage.remainingJobs, 0)
  // 149.99 + 399.50 + 650.51 = 1200.00 exactly
  assert.equal(Math.round(usage.totalRevenueEarned * 100) / 100, 1200.00)
})

test('Phase 5 E2E: Mobile Ergonomics & Found-Money Visual Integrity', async () => {
  const fs = await import('node:fs')
  const { fileURLToPath } = await import('node:url')

  const resolveFile = (rel) => fileURLToPath(new URL(`../${rel}`, import.meta.url))

  const meterFile = fs.readFileSync(resolveFile('src/components/billing/starter-pass-meter.tsx'), 'utf-8')
  assert.ok(meterFile.includes('min-h-[44px]'), 'StarterPassMeter provides minimum 44px mobile touch target')
  assert.ok(meterFile.includes('active:scale-[0.99]'), 'Tactile touch press feedback')
  assert.ok(meterFile.includes('$0 platform fees'), 'Reassures zero platform fees')

  const modalFile = fs.readFileSync(resolveFile('src/components/billing/found-money-unlock-modal.tsx'), 'utf-8')
  assert.ok(modalFile.includes('min-h-[48px]'), 'FoundMoneyUnlockModal primary button is 48px touch ergonomic')
  assert.ok(modalFile.includes('100% saved'), 'Reassures contractor their draft is safely preserved')

  const badgeFile = fs.readFileSync(resolveFile('src/components/jobs/job-won-badge.tsx'), 'utf-8')
  assert.ok(badgeFile.includes('CONTRACT WON'), 'JobWonBadge triggers dopamine badge')
  assert.ok(badgeFile.includes('Sparkles'), 'Sparkles celebration visual')
})
