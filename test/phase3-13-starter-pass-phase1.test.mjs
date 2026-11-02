import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getSaasPlan,
  SAAS_PLANS,
  FREE_TIER_COMPLETED_JOB_LIMIT
} from '../src/lib/billing/plans.ts'
import { SubscriptionService } from '../src/lib/billing/subscription-service.ts'
import { PRACTICE_JOB_NUMBER, PRACTICE_JOB_TITLE } from '../src/lib/jobs/practice-job.ts'

test('Phase 1 - Plans: Free tier configuration includes 3-job Starter Pass', () => {
  assert.equal(FREE_TIER_COMPLETED_JOB_LIMIT, 3)
  const freePlan = getSaasPlan('free')
  assert.equal(freePlan.tier, 'free')
  assert.equal(freePlan.amount, 0)
  assert.equal(freePlan.maxFreeCompletedJobs, 3)
  assert.ok(freePlan.features.some(f => f.includes('3 completed customer jobs')))
})

test('Phase 1 - Entitlement: getFreeTierJobUsage ignores practice sandbox jobs', async () => {
  const mockJobs = [
    // Sandbox practice job (completed) - MUST BE IGNORED
    {
      id: 'job-practice',
      org_id: 'org-test-1',
      title: PRACTICE_JOB_TITLE,
      job_number: PRACTICE_JOB_NUMBER,
      notes: 'SANDBOX_PRACTICE_JOB: This is a safe practice job',
      status: 'completed'
    },
    // Real customer job 1 (completed)
    {
      id: 'job-real-1',
      org_id: 'org-test-1',
      title: 'AC Tune-up - Sarah Jenkins',
      job_number: 'JOB-001',
      notes: 'Customer requested filter replacement',
      status: 'completed'
    }
  ]

  const mockInvoices = [
    {
      id: 'inv-1',
      org_id: 'org-test-1',
      status: 'paid',
      total: 189.00,
      amount_paid: 189.00
    }
  ]

  const mockSupabase = {
    from: (table) => {
      let filters = []
      const qb = {
        select: () => qb,
        eq: (col, val) => {
          filters.push(r => r[col] === val)
          return qb
        },
        then: (resolve) => {
          let rows = []
          if (table === 'jobs') rows = mockJobs
          if (table === 'invoices') rows = mockInvoices
          const filtered = rows.filter(r => filters.every(f => f(r)))
          return Promise.resolve({ data: filtered, error: null }).then(resolve)
        }
      }
      return qb
    }
  }

  const usage = await SubscriptionService.getFreeTierJobUsage(mockSupabase, 'org-test-1')

  // Only 1 real job counted (practice job excluded)
  assert.equal(usage.completedJobsCount, 1)
  assert.equal(usage.limit, 3)
  assert.equal(usage.remainingJobs, 2)
  assert.equal(usage.isLimitReached, false)
  assert.equal(usage.totalRevenueEarned, 189.00)
})

test('Phase 1 - Entitlement: 3 real completed jobs triggers limit reached', async () => {
  const mockJobs = [
    { id: 'job-1', org_id: 'org-test-2', title: 'Job 1', job_number: 'JOB-001', status: 'completed' },
    { id: 'job-2', org_id: 'org-test-2', title: 'Job 2', job_number: 'JOB-002', status: 'completed' },
    { id: 'job-3', org_id: 'org-test-2', title: 'Job 3', job_number: 'JOB-003', status: 'completed' }
  ]

  const mockInvoices = [
    { id: 'inv-1', org_id: 'org-test-2', status: 'paid', total: 200.00, amount_paid: 200.00 },
    { id: 'inv-2', org_id: 'org-test-2', status: 'paid', total: 350.00, amount_paid: 350.00 },
    { id: 'inv-3', org_id: 'org-test-2', status: 'paid', total: 190.00, amount_paid: 190.00 }
  ]

  const mockSupabase = {
    from: (table) => {
      let filters = []
      const qb = {
        select: () => qb,
        eq: (col, val) => {
          filters.push(r => r[col] === val)
          return qb
        },
        maybeSingle: async () => {
          if (table === 'organizations') {
            return { data: { id: 'org-test-2', subscription_status: 'free', plan_id: 'free' }, error: null }
          }
          if (table === 'saas_subscriptions') {
            return { data: null, error: null }
          }
          return { data: null, error: null }
        },
        then: (resolve) => {
          let rows = []
          if (table === 'jobs') rows = mockJobs
          if (table === 'invoices') rows = mockInvoices
          const filtered = rows.filter(r => filters.every(f => f(r)))
          return Promise.resolve({ data: filtered, error: null }).then(resolve)
        }
      }
      return qb
    }
  }

  const entitlement = await SubscriptionService.getEntitlement(mockSupabase, 'org-test-2')

  assert.equal(entitlement.isEntitled, true)
  assert.equal(entitlement.status, 'starter_limit_reached')
  assert.ok(entitlement.starterUsage)
  assert.equal(entitlement.starterUsage.completedJobsCount, 3)
  assert.equal(entitlement.starterUsage.remainingJobs, 0)
  assert.equal(entitlement.starterUsage.isLimitReached, true)
  assert.equal(entitlement.starterUsage.totalRevenueEarned, 740.00)
})
