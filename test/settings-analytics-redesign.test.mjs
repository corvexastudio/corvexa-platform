import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import {
  getTimeRangeStart,
  getOutcomeMetrics,
  getOperationalMetrics,
  getDashboardOverview
} from '../src/lib/dashboard/dashboard-service.ts'

/**
 * In-memory Supabase mock harness for Analytics Redesign test suite
 */
function createMockDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    contacts: initialState.contacts || [],
    leads: initialState.leads || [],
    calls: initialState.calls || [],
    conversations: initialState.conversations || [],
    messages: initialState.messages || [],
    quotes: initialState.quotes || [],
    appointments: initialState.appointments || [],
    jobs: initialState.jobs || [],
    invoices: initialState.invoices || [],
    payments: initialState.payments || [],
    review_requests: initialState.review_requests || [],
    services: initialState.services || [],
    profiles: initialState.profiles || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []
      let selectOpts = {}

      const queryBuilder = {
        select: (columns, opts) => {
          if (opts) selectOpts = opts
          return queryBuilder
        },
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return queryBuilder
        },
        neq: (col, val) => {
          filters.push((row) => row[col] !== val)
          return queryBuilder
        },
        gt: (col, val) => {
          filters.push((row) => (row[col] ?? 0) > val)
          return queryBuilder
        },
        gte: (col, val) => {
          filters.push((row) => row[col] >= val)
          return queryBuilder
        },
        lte: (col, val) => {
          filters.push((row) => row[col] <= val)
          return queryBuilder
        },
        in: (col, arr) => {
          filters.push((row) => arr.includes(row[col]))
          return queryBuilder
        },
        not: (col, operator, val) => {
          if (operator === 'is' && val === null) {
            filters.push((row) => row[col] !== null && row[col] !== undefined)
          }
          return queryBuilder
        },
        or: (conditionString) => {
          filters.push((row) => {
            if (row.status === 'overdue') return true
            if (['sent', 'partially_paid', 'viewed'].includes(row.status) && row.due_date && new Date(row.due_date) < new Date()) {
              return true
            }
            return false
          })
          return queryBuilder
        },
        order: () => queryBuilder,
        limit: (n) => {
          queryBuilder._limit = n
          return queryBuilder
        },
        then: (resolve, reject) => {
          const tableData = tables[tableName] || []
          let filtered = tableData.filter((row) => filters.every((fn) => fn(row)))

          if (selectOpts.count === 'exact' && selectOpts.head === true) {
            return Promise.resolve({ count: filtered.length, data: null, error: null }).then(resolve, reject)
          }

          if (queryBuilder._limit) {
            filtered = filtered.slice(0, queryBuilder._limit)
          }

          return Promise.resolve({ data: filtered, count: filtered.length, error: null }).then(resolve, reject)
        }
      }

      return queryBuilder
    }
  }

  return client
}

test('1. Reporting Periods: Computes accurate cutoff timestamps for 7d, 30d, 90d, and all', () => {
  const t7 = getTimeRangeStart('7d')
  const t30 = getTimeRangeStart('30d')
  const t90 = getTimeRangeStart('90d')
  const tAll = getTimeRangeStart('all')

  assert.strictEqual(tAll, null, 'all period must return null for unbounded historical reporting')
  assert.ok(t7, '7d must return a valid ISO timestamp')
  assert.ok(t30, '30d must return a valid ISO timestamp')
  assert.ok(t90, '90d must return a valid ISO timestamp')

  const now = Date.now()
  const d7Ms = now - new Date(t7).getTime()
  const d30Ms = now - new Date(t30).getTime()
  const d90Ms = now - new Date(t90).getTime()

  // Verify approximately correct days in ms (with leeway for execution time)
  assert.ok(d7Ms >= 6.9 * 24 * 3600 * 1000 && d7Ms <= 7.1 * 24 * 3600 * 1000, '7d within 7 days window')
  assert.ok(d30Ms >= 29.9 * 24 * 3600 * 1000 && d30Ms <= 30.1 * 24 * 3600 * 1000, '30d within 30 days window')
  assert.ok(d90Ms >= 89.9 * 24 * 3600 * 1000 && d90Ms <= 90.1 * 24 * 3600 * 1000, '90d within 90 days window')

  // Timezone-aware calculation
  const t30Cst = getTimeRangeStart('30d', 'America/Chicago')
  assert.ok(t30Cst, 'Timezone-aware start time must return valid ISO timestamp')
})

test('2. Cash Flow & Revenue Collected: Strictly derives from succeeded payments in payments table', async () => {
  const db = createMockDb({
    invoices: [
      { id: 'inv1', org_id: 'org1', total: 1200, status: 'paid', amount_paid: 1200, amount_due: 0, created_at: '2026-10-01T00:00:00Z' },
      { id: 'inv2', org_id: 'org1', total: 800, status: 'sent', amount_paid: 0, amount_due: 800, created_at: '2026-10-02T00:00:00Z' },
      { id: 'inv3', org_id: 'org1', total: 500, status: 'draft', amount_paid: 0, amount_due: 500, created_at: '2026-10-03T00:00:00Z' }
    ],
    payments: [
      { id: 'p1', org_id: 'org1', amount: 1200, status: 'succeeded', created_at: '2026-10-01T12:00:00Z' },
      { id: 'p2', org_id: 'org1', amount: 300, status: 'failed', created_at: '2026-10-02T12:00:00Z' }
    ]
  })

  const outcomes = await getOutcomeMetrics(db, 'org1', 'all')

  // Collected amount strictly comes from succeeded payments
  assert.strictEqual(outcomes.paymentCollection.collectedAmount, 1200, 'Failed payment must not be included')
  // Total invoiced strictly sums issued invoices (inv1 + inv2 = 2000), excluding inv3 (draft)
  assert.strictEqual(outcomes.paymentCollection.invoicedAmount, 2000, 'Draft invoices must be excluded from issued total')
  assert.strictEqual(outcomes.paymentCollection.draftInvoicesCount, 1, 'Draft invoice counted separately')
  assert.strictEqual(outcomes.paymentCollection.draftInvoicesAmount, 500, 'Draft invoice value tracked separately')
  assert.strictEqual(outcomes.paymentCollection.collectionRate, 60, '1200 / 2000 = 60% collection efficiency')
  assert.strictEqual(outcomes.paymentCollection.paidInvoicesCount, 1, '1 invoice paid in full')
})

test('3. Outstanding Receivables: Sums unpaid balances on issued invoices only and excludes drafts and paid', async () => {
  const db = createMockDb({
    invoices: [
      { id: 'i1', org_id: 'org1', invoice_number: 'INV-101', total: 1000, amount_paid: 1000, amount_due: 0, status: 'paid', created_at: '2026-10-01T00:00:00Z' },
      { id: 'i2', org_id: 'org1', invoice_number: 'INV-102', total: 750, amount_paid: 250, amount_due: 500, status: 'partially_paid', created_at: '2026-10-02T00:00:00Z' },
      { id: 'i3', org_id: 'org1', invoice_number: 'INV-103', total: 450, amount_paid: 0, amount_due: 450, status: 'overdue', created_at: '2026-09-15T00:00:00Z' },
      { id: 'i4', org_id: 'org1', invoice_number: 'INV-104', total: 600, amount_paid: 0, amount_due: 600, status: 'draft', created_at: '2026-10-03T00:00:00Z' },
      { id: 'i5', org_id: 'org1', invoice_number: 'INV-105', total: 300, amount_paid: 0, amount_due: 300, status: 'void', created_at: '2026-10-04T00:00:00Z' }
    ]
  })

  const outcomes = await getOutcomeMetrics(db, 'org1', 'all')

  // Outstanding receivables must sum remaining due on i2 ($500) and i3 ($450) = $950
  assert.strictEqual(outcomes.paymentCollection.outstandingReceivables, 950, 'Outstanding receivables must be exactly $950')
  assert.strictEqual(outcomes.paymentCollection.outstandingInvoicesCount, 2, 'Must count exactly 2 open issued receivables')
})

test('4. Quote Conversion: Authoritative formula Accepted / (Accepted + Declined + Expired) * 100', async () => {
  const db = createMockDb({
    quotes: [
      { id: 'q1', org_id: 'org1', total: 1500, status: 'accepted', created_at: '2026-10-01T00:00:00Z' },
      { id: 'q2', org_id: 'org1', total: 2500, status: 'accepted', created_at: '2026-10-02T00:00:00Z' },
      { id: 'q3', org_id: 'org1', total: 1000, status: 'declined', created_at: '2026-10-03T00:00:00Z' },
      { id: 'q4', org_id: 'org1', total: 1000, status: 'expired', created_at: '2026-10-04T00:00:00Z' },
      // Pending quotes should NOT penalize win rate
      { id: 'q5', org_id: 'org1', total: 3000, status: 'sent', created_at: '2026-10-05T00:00:00Z' },
      { id: 'q6', org_id: 'org1', total: 1200, status: 'viewed', created_at: '2026-10-06T00:00:00Z' },
      // Draft quote should NOT be counted in sent/resolved
      { id: 'q7', org_id: 'org1', total: 800, status: 'draft', created_at: '2026-10-07T00:00:00Z' }
    ]
  })

  const outcomes = await getOutcomeMetrics(db, 'org1', 'all')

  // Resolved = 2 accepted + 1 declined + 1 expired = 4
  // Win rate = 2 / 4 = 50%
  assert.strictEqual(outcomes.quoteConversion.acceptedCount, 2)
  assert.strictEqual(outcomes.quoteConversion.declinedCount, 1)
  assert.strictEqual(outcomes.quoteConversion.expiredCount, 1)
  assert.strictEqual(outcomes.quoteConversion.pendingCount, 2)
  assert.strictEqual(outcomes.quoteConversion.draftCount, 1)
  assert.strictEqual(outcomes.quoteConversion.totalResolvedCount, 4)
  assert.strictEqual(outcomes.quoteConversion.conversionRate, 50, 'Win rate must be 50%')
  assert.strictEqual(outcomes.quoteConversion.acceptedValue, 4000)
  assert.strictEqual(outcomes.quoteConversion.pendingValue, 4200)
})

test('5. Zero Handling: Zero resolved quotes returns 0% without NaN or division by zero', async () => {
  const db = createMockDb({
    quotes: [
      { id: 'q1', org_id: 'org1', total: 1000, status: 'sent', created_at: '2026-10-01T00:00:00Z' },
      { id: 'q2', org_id: 'org1', total: 2000, status: 'viewed', created_at: '2026-10-02T00:00:00Z' }
    ]
  })

  const outcomes = await getOutcomeMetrics(db, 'org1', 'all')

  assert.strictEqual(outcomes.quoteConversion.totalResolvedCount, 0)
  assert.strictEqual(outcomes.quoteConversion.conversionRate, 0, 'Conversion rate must be 0 when no resolved quotes')
  assert.strictEqual(isNaN(outcomes.quoteConversion.conversionRate), false, 'Must not be NaN')
})

test('6. Front Desk Recovery: Correct attribution when missed call recipient responds to automated SMS', async () => {
  const db = createMockDb({
    calls: [
      { id: 'call1', org_id: 'org1', contact_id: 'custA', status: 'missed', created_at: '2026-10-01T10:00:00Z' },
      { id: 'call2', org_id: 'org1', contact_id: 'custB', status: 'missed', created_at: '2026-10-01T11:00:00Z' },
      { id: 'call3', org_id: 'org1', contact_id: 'custC', status: 'missed', created_at: '2026-10-01T12:00:00Z' }
    ],
    conversations: [
      // custA and custB responded in conversation, custC did not
      { id: 'conv1', org_id: 'org1', contact_id: 'custA', last_message_at: '2026-10-01T10:04:00Z' },
      { id: 'conv2', org_id: 'org1', contact_id: 'custB', last_message_at: '2026-10-01T11:02:00Z' }
    ]
  })

  const outcomes = await getOutcomeMetrics(db, 'org1', 'all')

  assert.strictEqual(outcomes.recoveredConversations.totalMissedCalls, 3)
  assert.strictEqual(outcomes.recoveredConversations.recoveredCount, 2)
  assert.strictEqual(outcomes.recoveredConversations.recoveryRate, 67, '2 / 3 = 66.6% -> 67%')
})

test('7. Customer Retention & Repeat Loyalty: Accurately identifies contacts with >1 completed job', async () => {
  const db = createMockDb({
    jobs: [
      { id: 'j1', org_id: 'org1', contact_id: 'c1', status: 'completed' },
      { id: 'j2', org_id: 'org1', contact_id: 'c1', status: 'completed' }, // c1 has 2 completed jobs -> repeat
      { id: 'j3', org_id: 'org1', contact_id: 'c1', status: 'completed' }, // c1 has 3 completed jobs -> repeat
      { id: 'j4', org_id: 'org1', contact_id: 'c2', status: 'completed' }, // c2 has 1 completed job -> new
      { id: 'j5', org_id: 'org1', contact_id: 'c3', status: 'in_progress' } // c3 has 0 completed jobs
    ],
    appointments: [
      { id: 'a1', org_id: 'org1', contact_id: 'c1', status: 'confirmed', created_at: '2026-10-01T00:00:00Z' },
      { id: 'a2', org_id: 'org1', contact_id: 'c1', status: 'confirmed', created_at: '2026-10-05T00:00:00Z' },
      { id: 'a3', org_id: 'org1', contact_id: 'c2', status: 'confirmed', created_at: '2026-10-02T00:00:00Z' }
    ]
  })

  const outcomes = await getOutcomeMetrics(db, 'org1', 'all')

  assert.strictEqual(outcomes.repeatBookings.repeatCustomerCount, 1, 'Only c1 has >1 completed job')
  assert.strictEqual(outcomes.repeatBookings.repeatBookingsCount, 2, 'c1 has 2 bookings in reporting window')
  assert.strictEqual(outcomes.repeatBookings.repeatRate, 67, '2 / 3 = 66.6% -> 67%')
})

test('8. Starter Pass Reconciliation Scenario: 3 completed jobs ($2,569), 1 $250 draft invoice, 1 accepted $160 WIP quote', async () => {
  // Scenario:
  // - Starter Pass allows 3 free completed jobs ($2,569 total paid).
  // - Job 4 has an accepted quote of $160, but is WIP / blocked from completion until upgrade.
  // - A draft invoice of $250 exists for materials.
  // - Payment ledger is authoritative: collected revenue is exactly $2,569.
  // - The $250 draft is not an issued receivable.
  // - The $160 accepted quote is WIP / pipeline, not counted as collected revenue.
  const db = createMockDb({
    jobs: [
      { id: 'job1', org_id: 'org_starter', contact_id: 'c1', status: 'completed', job_number: 'JOB-001' },
      { id: 'job2', org_id: 'org_starter', contact_id: 'c2', status: 'completed', job_number: 'JOB-002' },
      { id: 'job3', org_id: 'org_starter', contact_id: 'c3', status: 'completed', job_number: 'JOB-003' },
      { id: 'job4', org_id: 'org_starter', contact_id: 'c4', status: 'in_progress', job_number: 'JOB-004' }
    ],
    invoices: [
      { id: 'inv1', org_id: 'org_starter', invoice_number: 'INV-001', total: 850, amount_paid: 850, amount_due: 0, status: 'paid', created_at: '2026-10-01T00:00:00Z' },
      { id: 'inv2', org_id: 'org_starter', invoice_number: 'INV-002', total: 920, amount_paid: 920, amount_due: 0, status: 'paid', created_at: '2026-10-02T00:00:00Z' },
      { id: 'inv3', org_id: 'org_starter', invoice_number: 'INV-003', total: 799, amount_paid: 799, amount_due: 0, status: 'paid', created_at: '2026-10-03T00:00:00Z' },
      // $250 draft invoice - not issued
      { id: 'inv4', org_id: 'org_starter', invoice_number: 'INV-004', total: 250, amount_paid: 0, amount_due: 250, status: 'draft', created_at: '2026-10-04T00:00:00Z' }
    ],
    payments: [
      { id: 'pay1', org_id: 'org_starter', amount: 850, status: 'succeeded', created_at: '2026-10-01T12:00:00Z' },
      { id: 'pay2', org_id: 'org_starter', amount: 920, status: 'succeeded', created_at: '2026-10-02T12:00:00Z' },
      { id: 'pay3', org_id: 'org_starter', amount: 799, status: 'succeeded', created_at: '2026-10-03T12:00:00Z' }
    ],
    quotes: [
      // $160 accepted quote for WIP job
      { id: 'quote1', org_id: 'org_starter', total: 160, status: 'accepted', created_at: '2026-10-04T00:00:00Z' }
    ]
  })

  const outcomes = await getOutcomeMetrics(db, 'org_starter', 'all')

  // 1. Revenue collected is strictly $2,569
  assert.strictEqual(outcomes.paymentCollection.collectedAmount, 2569, 'Revenue collected must equal sum of succeeded payments ($2,569)')

  // 2. Outstanding receivables is $0 because the $250 invoice is a draft, not issued
  assert.strictEqual(outcomes.paymentCollection.outstandingReceivables, 0, 'Draft invoice must not count as outstanding receivable')
  assert.strictEqual(outcomes.paymentCollection.outstandingInvoicesCount, 0, 'No issued invoices are outstanding')
  assert.strictEqual(outcomes.paymentCollection.draftInvoicesCount, 1, 'Draft invoice tracked separately')
  assert.strictEqual(outcomes.paymentCollection.draftInvoicesAmount, 250, 'Draft invoice amount tracked separately')

  // 3. Accepted quote ($160) is pipeline value, not collected revenue
  assert.strictEqual(outcomes.quoteConversion.acceptedCount, 1)
  assert.strictEqual(outcomes.quoteConversion.acceptedValue, 160)
  assert.notStrictEqual(outcomes.paymentCollection.collectedAmount, outcomes.quoteConversion.acceptedValue)
})

test('9. Zero Em Dash Invariant: Strict check across all Analytics module files', () => {
  const filesToCheck = [
    'src/lib/dashboard/dashboard-service.ts',
    'src/app/api/client/dashboard/route.ts',
    'src/app/client/analytics/page.tsx'
  ]

  for (const filePath of filesToCheck) {
    const content = fs.readFileSync(filePath, 'utf8')
    const emDashMatches = content.match(/[\u2013\u2014—–]/g)
    assert.strictEqual(
      emDashMatches ? emDashMatches.length : 0,
      0,
      `File ${filePath} must contain ZERO em dashes or en dashes`
    )
  }
})
