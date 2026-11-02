import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sendInvoice, createInvoice } from '../src/lib/payments/invoice-manager.ts'
import { updateJobStatus } from '../src/lib/jobs/job-manager.ts'

function createMockSupabase(mockDb) {
  return {
    from: (table) => {
      let filters = []
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
        order: () => qb,
        limit: () => qb,
        maybeSingle: async () => {
          const rows = mockDb[table] || []
          const filtered = rows.filter(r => filters.every(f => f(r)))
          return { data: filtered[0] || null, error: null }
        },
        single: async () => {
          const rows = mockDb[table] || []
          const filtered = rows.filter(r => filters.every(f => f(r)))
          return { data: filtered[0] || null, error: filtered[0] ? null : { message: 'Not found' } }
        },
        then: (resolve) => {
          const rows = mockDb[table] || []
          const filtered = rows.filter(r => filters.every(f => f(r)))
          return Promise.resolve({ data: filtered, error: null }).then(resolve)
        }
      }

      return {
        ...qb,
        insert: (payload) => {
          const row = { id: `${table}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...payload }
          mockDb[table] = mockDb[table] || []
          mockDb[table].push(row)
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
              maybeSingle: async () => ({ data: row, error: null }),
              then: (resolve) => Promise.resolve({ data: row, error: null }).then(resolve)
            }),
            then: (resolve) => Promise.resolve({ data: row, error: null }).then(resolve)
          }
        },
        update: (fields) => {
          let updateFilters = []
          const updateChain = {
            eq: (col, val) => {
              updateFilters.push(r => r[col] === val)
              // apply fields to matched rows
              const rows = mockDb[table] || []
              const matched = rows.filter(r => updateFilters.every(f => f(r)))
              for (const r of matched) Object.assign(r, fields)

              return {
                ...updateChain,
                select: () => ({
                  single: async () => ({ data: matched[0] || null, error: null }),
                  maybeSingle: async () => ({ data: matched[0] || null, error: null }),
                  then: (resolve) => Promise.resolve({ data: matched, error: null }).then(resolve)
                }),
                then: (resolve) => Promise.resolve({ data: matched, error: null }).then(resolve)
              }
            }
          }
          return updateChain
        }
      }
    }
  }
}

test('Phase 3 - Sunk Cost Paywall: Invoice drafting succeeds on Job 4+, but sendInvoice gates at finish line', async () => {
  const orgId = 'org-free-tier-starter'
  const jobId = 'job-4-gated'
  const contactId = 'contact-homeowner-4'

  const mockDb = {
    jobs: [
      { id: 'job-1', org_id: orgId, title: 'Job 1', status: 'completed', job_number: 'JOB-1' },
      { id: 'job-2', org_id: orgId, title: 'Job 2', status: 'completed', job_number: 'JOB-2' },
      { id: 'job-3', org_id: orgId, title: 'Job 3', status: 'completed', job_number: 'JOB-3' },
      { id: jobId, org_id: orgId, title: 'Job 4 - Water Heater', status: 'scheduled', job_number: 'JOB-4' }
    ],
    invoices: [],
    invoice_items: [],
    contacts: [
      { id: contactId, org_id: orgId, name: 'Alice Homeowner', phone: '+15125550188', email: 'alice@example.com' }
    ],
    organizations: [
      { id: orgId, name: 'Apex Plumbing', owner_phone: '+15125550199', subscription_tier: 'free', subscription_status: 'trialing' }
    ],
    subscriptions: []
  }

  const mockSupabase = createMockSupabase(mockDb)

  // 1. Contractor drafts invoice on Job #4 with $850 line item
  const draftRes = await createInvoice(mockSupabase, {
    orgId,
    contactId,
    jobId,
    title: 'Water Heater Replacement',
    items: [{ description: 'New 50-Gal Water Heater', quantity: 1, unit_price: 850 }]
  })

  assert.strictEqual(draftRes.success, true, 'Drafting invoice on Job #4 succeeds')
  assert.ok(draftRes.invoice, 'Invoice created')
  assert.strictEqual(draftRes.invoice.total, 850, 'Calculates correct total')
  assert.strictEqual(draftRes.invoice.status, 'draft', 'Status is draft')

  // 2. Contractor clicks "Send Invoice to Customer" -> Finish Line Sunk Cost Paywall triggers
  const sendRes = await sendInvoice(mockSupabase, {
    invoiceId: draftRes.invoice.id,
    orgId,
    baseUrl: 'https://captodesk.com'
  })

  assert.strictEqual(sendRes.success, false, 'Send invoice fails because starter limit reached')
  assert.strictEqual(sendRes.upgradeRequired, true, 'Flagged as requiring upgrade')
  assert.strictEqual(sendRes.code, 'STARTER_LIMIT_REACHED', 'Machine-readable code')
  assert.ok(sendRes.checkoutUrl.includes('/client/billing?reason=starter_limit'), 'Directs to billing upgrade')
  assert.strictEqual(draftRes.invoice.status, 'draft', 'Invoice remains safely drafted (no data loss)')
})

test('Phase 3 - Sunk Cost Paywall: Historical completed jobs and practice jobs can re-send invoices freely', async () => {
  const orgId = 'org-free-tier-starter'
  const practiceJobId = 'job-practice-101'
  const completedJobId = 'job-1-completed'

  const mockDb = {
    jobs: [
      { id: completedJobId, org_id: orgId, title: 'Job 1', status: 'completed', job_number: 'JOB-1' },
      { id: 'job-2', org_id: orgId, title: 'Job 2', status: 'completed', job_number: 'JOB-2' },
      { id: 'job-3', org_id: orgId, title: 'Job 3', status: 'completed', job_number: 'JOB-3' },
      { id: practiceJobId, org_id: orgId, title: '🧪 [PRACTICE] Job', notes: 'SANDBOX_PRACTICE_JOB', status: 'scheduled', job_number: 'PRACTICE-101' }
    ],
    invoices: [
      { id: 'inv-practice', org_id: orgId, job_id: practiceJobId, status: 'draft', total: 89, amount_due: 89, manage_token: 'tok-p' },
      { id: 'inv-completed', org_id: orgId, job_id: completedJobId, status: 'sent', total: 250, amount_due: 250, manage_token: 'tok-c' }
    ],
    invoice_items: [],
    contacts: [
      { id: 'c-1', org_id: orgId, name: 'Practice Customer', phone: '+15125550188' }
    ],
    organizations: [
      { id: orgId, name: 'Apex Plumbing', owner_phone: '+15125550199', subscription_tier: 'free' }
    ],
    subscriptions: []
  }

  const mockSupabase = createMockSupabase(mockDb)

  // 1. Practice job invoice send should not be blocked by limit
  const practiceRes = await sendInvoice(mockSupabase, {
    invoiceId: 'inv-practice',
    orgId,
    baseUrl: 'https://captodesk.com'
  })
  assert.notStrictEqual(practiceRes.code, 'STARTER_LIMIT_REACHED', 'Practice job is never blocked by starter limit')

  // 2. Already completed job invoice re-send should not be blocked
  const completedRes = await sendInvoice(mockSupabase, {
    invoiceId: 'inv-completed',
    orgId,
    baseUrl: 'https://captodesk.com'
  })
  assert.notStrictEqual(completedRes.code, 'STARTER_LIMIT_REACHED', 'Historical completed job invoice is never blocked')
})

test('Phase 3 - Sunk Cost Paywall: Job #4+ status advancement gates, but cancellation is permitted', async () => {
  const orgId = 'org-free-tier-starter'
  const gatedJobId = 'job-4-gated'
  const practiceJobId = 'job-practice'

  const mockDb = {
    jobs: [
      { id: 'job-1', org_id: orgId, title: 'Job 1', status: 'completed', job_number: 'JOB-1' },
      { id: 'job-2', org_id: orgId, title: 'Job 2', status: 'completed', job_number: 'JOB-2' },
      { id: 'job-3', org_id: orgId, title: 'Job 3', status: 'completed', job_number: 'JOB-3' },
      { id: gatedJobId, org_id: orgId, title: 'Job 4', status: 'scheduled', job_number: 'JOB-4' },
      { id: practiceJobId, org_id: orgId, title: '🧪 [PRACTICE] Job', notes: 'SANDBOX_PRACTICE_JOB', status: 'scheduled', job_number: 'PRACTICE-101' }
    ],
    organizations: [
      { id: orgId, name: 'Apex Plumbing', owner_phone: '+15125550199', subscription_tier: 'free' }
    ],
    subscriptions: []
  }

  const mockSupabase = createMockSupabase(mockDb)

  // 1. Attempting to dispatch / advance Job #4 to 'en_route' gates with paywall
  const enRouteRes = await updateJobStatus(mockSupabase, {
    jobId: gatedJobId,
    orgId,
    newStatus: 'en_route'
  })
  assert.strictEqual(enRouteRes.success, false, 'Advancing Job #4 to en_route fails')
  assert.strictEqual(enRouteRes.upgradeRequired, true, 'Requires upgrade')
  assert.strictEqual(enRouteRes.code, 'STARTER_LIMIT_REACHED')

  // 2. Attempting to mark Job #4 'completed' gates with paywall
  const completeRes = await updateJobStatus(mockSupabase, {
    jobId: gatedJobId,
    orgId,
    newStatus: 'completed'
  })
  assert.strictEqual(completeRes.success, false, 'Completing Job #4 directly gates')
  assert.strictEqual(completeRes.upgradeRequired, true)

  // 3. Cancelling Job #4 is allowed (so contractor can clean up calendar)
  const cancelRes = await updateJobStatus(mockSupabase, {
    jobId: gatedJobId,
    orgId,
    newStatus: 'cancelled'
  })
  assert.strictEqual(cancelRes.success, true, 'Cancelling Job #4 is permitted')

  // 4. Practice job can advance to 'completed' without paywall
  const practiceCompleteRes = await updateJobStatus(mockSupabase, {
    jobId: practiceJobId,
    orgId,
    newStatus: 'completed'
  })
  assert.strictEqual(practiceCompleteRes.success, true, 'Practice job completes freely')
})
