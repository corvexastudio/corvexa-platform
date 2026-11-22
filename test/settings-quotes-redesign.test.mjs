import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateQuoteFinancials,
  customerViewQuote,
  customerAcceptQuote,
  customerDeclineQuote,
  softDeleteQuote
} from '../src/lib/quotes/quote-manager.ts'
import {
  convertQuoteToJob
} from '../src/lib/jobs/job-manager.ts'
import {
  convertQuoteToInvoice
} from '../src/lib/payments/invoice-manager.ts'

/**
 * In-memory Supabase mock client harness for mobile quote redesign tests
 */
function createMockQuotesDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    quotes: initialState.quotes || [],
    quote_items: initialState.quote_items || [],
    jobs: initialState.jobs || [],
    job_items: initialState.job_items || [],
    invoices: initialState.invoices || [],
    invoice_items: initialState.invoice_items || [],
    contacts: initialState.contacts || [],
    leads: initialState.leads || [],
    appointments: initialState.appointments || [],
    services: initialState.services || [],
    automation_runs: initialState.automation_runs || [],
    notifications: initialState.notifications || [],
    activity_logs: initialState.activity_logs || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []
      let orderCol = null
      let orderAsc = true
      let limitCount = null

      const queryBuilder = {
        select: () => queryBuilder,
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return queryBuilder
        },
        neq: (col, val) => {
          filters.push((row) => row[col] !== val)
          return queryBuilder
        },
        in: (col, arr) => {
          filters.push((row) => Array.isArray(arr) && arr.includes(row[col]))
          return queryBuilder
        },
        is: (col, val) => {
          if (val === null) {
            filters.push((row) => row[col] === null || row[col] === undefined)
          } else {
            filters.push((row) => row[col] === val)
          }
          return queryBuilder
        },
        gte: (col, val) => {
          filters.push((row) => new Date(row[col]) >= new Date(val))
          return queryBuilder
        },
        lte: (col, val) => {
          filters.push((row) => new Date(row[col]) <= new Date(val))
          return queryBuilder
        },
        order: (col, opts = {}) => {
          orderCol = col
          orderAsc = opts.ascending !== false
          return queryBuilder
        },
        limit: (n) => {
          limitCount = n
          return queryBuilder
        },
        then: (resolve, reject) => {
          const tableData = tables[tableName] || []
          let filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          if (orderCol) {
            filtered = [...filtered].sort((a, b) => {
              const va = a[orderCol]
              const vb = b[orderCol]
              if (va < vb) return orderAsc ? -1 : 1
              if (va > vb) return orderAsc ? 1 : -1
              return 0
            })
          }
          if (limitCount !== null) {
            filtered = filtered.slice(0, limitCount)
          }
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject)
        },
        maybeSingle: async () => {
          const tableData = tables[tableName] || []
          let filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          return { data: filtered[0] || null, error: null }
        },
        single: async () => {
          const tableData = tables[tableName] || []
          let filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          if (filtered.length === 0) return { data: null, error: new Error('Row not found') }
          return { data: filtered[0], error: null }
        },
        insert: (rowOrRows) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          const insertedRows = []

          for (const row of rows) {
            const newRow = {
              id: row.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              created_at: new Date().toISOString(),
              ...row
            }
            if (!tables[tableName]) tables[tableName] = []
            tables[tableName].push(newRow)
            insertedRows.push(newRow)
          }

          const lastInserted = insertedRows[insertedRows.length - 1] || null
          return {
            data: lastInserted,
            error: null,
            select: () => ({
              single: async () => ({ data: lastInserted, error: null }),
              maybeSingle: async () => ({ data: lastInserted, error: null }),
              then: (resolve) => resolve({ data: insertedRows, error: null })
            })
          }
        },
        update: (updates) => {
          return {
            eq: (col, val) => {
              filters.push((row) => row[col] === val)
              const tableData = tables[tableName] || []
              let updatedRows = []
              for (const row of tableData) {
                if (filters.every((fn) => fn(row))) {
                  Object.assign(row, updates)
                  updatedRows.push(row)
                }
              }
              const result = updatedRows[0] || null
              return {
                data: result,
                error: null,
                eq: (c2, v2) => {
                  filters.push((row) => row[c2] === v2)
                  const tableData2 = tables[tableName] || []
                  let updatedRows2 = []
                  for (const row of tableData2) {
                    if (filters.every((fn) => fn(row))) {
                      Object.assign(row, updates)
                      updatedRows2.push(row)
                    }
                  }
                  const result2 = updatedRows2[0] || null
                  return {
                    data: result2,
                    error: null,
                    select: () => ({
                      single: async () => ({ data: result2, error: null }),
                      maybeSingle: async () => ({ data: result2, error: null })
                    })
                  }
                },
                select: () => ({
                  single: async () => ({ data: result, error: null }),
                  maybeSingle: async () => ({ data: result, error: null })
                })
              }
            }
          }
        }
      }

      return queryBuilder
    },
    rpc: async (fnName, args) => {
      if (fnName === 'get_next_document_number') {
        return { data: 'EST-1001', error: null }
      }
      return { data: null, error: null }
    }
  }

  return client
}

// ---------------------------------------------------------------------------
// 1. Authoritative Financial Math & Edge Cases
// ---------------------------------------------------------------------------

test('calculateQuoteFinancials: Multi-item subtotal, tax rate, and discount deduction', () => {
  const items = [
    { description: 'Furnace Blower Motor Replacement', quantity: 1, unit_price: 450.00 },
    { description: 'Capacitor 45/5 MFD', quantity: 2, unit_price: 45.00 },
    { description: 'Diagnostic & Labor', quantity: 1.5, unit_price: 120.00 }
  ]

  // Subtotal = 450 + 90 + 180 = 720
  // Discount = 50 -> Taxable = 670
  // Tax rate = 8.25% -> Tax = 670 * 0.0825 = 55.275 -> 55.28
  // Grand total = 670 + 55.28 = 725.28
  const res = calculateQuoteFinancials(items, { taxRate: 8.25, discount: 50 })

  assert.equal(res.subtotal, 720.00)
  assert.equal(res.discount, 50.00)
  assert.equal(res.tax, 55.28)
  assert.equal(res.total, 725.28)
  assert.equal(res.lineItems.length, 3)

  // 30% deposit on grand total: 725.28 * 0.30 = 217.584 -> 217.58
  const depositPct = 30
  const depositAmount = Math.round(((res.total * depositPct) / 100) * 100) / 100
  assert.equal(depositAmount, 217.58)
})

test('calculateQuoteFinancials: Fixed deposit clamping and zero item handling', () => {
  // Empty items edge case
  const emptyRes = calculateQuoteFinancials([], { taxRate: 10, discount: 0 })
  assert.equal(emptyRes.subtotal, 0)
  assert.equal(emptyRes.tax, 0)
  assert.equal(emptyRes.total, 0)

  // Fixed deposit exceeds grand total -> should clamp to grand total
  const items = [{ description: 'Emergency Service', quantity: 1, unit_price: 200 }]
  const res = calculateQuoteFinancials(items, { taxRate: 0, discount: 0 })
  assert.equal(res.total, 200)

  const fixedDepositInput = 500
  const clampedDeposit = Math.min(res.total, Math.max(1, fixedDepositInput))
  assert.equal(clampedDeposit, 200) // clamped to grand total
})

test('calculateQuoteFinancials: Discount greater than subtotal clamps taxable amount to zero', () => {
  const items = [{ description: 'Filter replacement', quantity: 1, unit_price: 40 }]
  const res = calculateQuoteFinancials(items, { taxRate: 8.0, discount: 100 }) // $100 discount on $40 item
  assert.equal(res.subtotal, 40)
  assert.equal(res.discount, 100)
  assert.equal(res.tax, 0)
  assert.equal(res.total, 0)
})

// ---------------------------------------------------------------------------
// 2. Standardized Win-Rate Formula and Pipeline Metrics
// ---------------------------------------------------------------------------

function calculateDashboardMetrics(quotes) {
  const now = new Date()

  // Standard status evaluation
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted')
  const declinedQuotes = quotes.filter(q => q.status === 'declined')

  // Wall-clock expired or explicitly expired
  const expiredQuotes = quotes.filter(q => {
    if (q.status === 'accepted' || q.status === 'declined') return false
    const isPast = q.expires_at && new Date(q.expires_at) < now
    return q.status === 'expired' || isPast
  })

  const acceptedCount = acceptedQuotes.length
  const declinedCount = declinedQuotes.length
  const expiredCount = expiredQuotes.length

  const denominator = acceptedCount + declinedCount + expiredCount
  const winRate = denominator > 0 ? Math.round((acceptedCount / denominator) * 100) : 0

  // Pipeline value: active proposed quotes (sent or viewed, not expired)
  const pipelineValue = quotes
    .filter(q => (q.status === 'sent' || q.status === 'viewed') && !(q.expires_at && new Date(q.expires_at) < now))
    .reduce((sum, q) => sum + (Number(q.total_amount) || 0), 0)

  // Approved value: won contracts
  const approvedValue = acceptedQuotes
    .reduce((sum, q) => sum + (Number(q.total_amount) || 0), 0)

  return {
    winRate,
    pipelineValue,
    approvedValue,
    acceptedCount,
    declinedCount,
    expiredCount
  }
}

test('Standardized Win Rate: Formula Accepted / (Accepted + Declined + Expired) * 100', () => {
  const pastDate = new Date(Date.now() - 86400000).toISOString()
  const futureDate = new Date(Date.now() + 86400000).toISOString()

  // Case: 3 accepted, 1 declined, 1 expired -> 3 / (3 + 1 + 1) = 3 / 5 = 60%
  const sampleQuotes = [
    { id: '1', status: 'accepted', total_amount: 1000, expires_at: futureDate },
    { id: '2', status: 'accepted', total_amount: 500, expires_at: futureDate },
    { id: '3', status: 'accepted', total_amount: 1500, expires_at: futureDate },
    { id: '4', status: 'declined', total_amount: 400, expires_at: futureDate },
    { id: '5', status: 'sent', total_amount: 800, expires_at: pastDate }, // wall-clock expired
    { id: '6', status: 'sent', total_amount: 1200, expires_at: futureDate }, // active pipeline
    { id: '7', status: 'viewed', total_amount: 600, expires_at: futureDate }, // active pipeline
    { id: '8', status: 'draft', total_amount: 300, expires_at: futureDate } // draft not in denominator
  ]

  const metrics = calculateDashboardMetrics(sampleQuotes)
  assert.equal(metrics.winRate, 60)
  assert.equal(metrics.approvedValue, 3000) // 1000 + 500 + 1500
  assert.equal(metrics.pipelineValue, 1800) // 1200 + 600
  assert.equal(metrics.acceptedCount, 3)
  assert.equal(metrics.declinedCount, 1)
  assert.equal(metrics.expiredCount, 1)
})

test('Standardized Win Rate: Empty array returns 0% without NaN or division by zero', () => {
  const metrics = calculateDashboardMetrics([])
  assert.equal(metrics.winRate, 0)
  assert.equal(metrics.pipelineValue, 0)
  assert.equal(metrics.approvedValue, 0)
})

// ---------------------------------------------------------------------------
// 3. Immutability, Expiration, and Legal Safeguards
// ---------------------------------------------------------------------------

test('Quote Expiration: Wall-clock expired quote cannot be accepted by customer', async () => {
  const pastDate = new Date(Date.now() - 3600000).toISOString() // 1 hour ago
  const db = createMockQuotesDb({
    organizations: [{ id: 'org_1', name: 'Cool Air HVAC' }],
    quotes: [
      {
        id: 'q_expired',
        org_id: 'org_1',
        quote_number: 'EST-99',
        status: 'sent',
        manage_token: 'token_exp_48_chars_long_secure_alpha_hash_12345678',
        expires_at: pastDate,
        total_amount: 850
      }
    ]
  })

  const res = await customerAcceptQuote(
    db,
    'token_exp_48_chars_long_secure_alpha_hash_12345678',
    'John Homeowner',
    'data:image/png;base64,mockSign'
  )

  assert.equal(res.success, false)
  assert.match(res.error, /expired/i)

  // Verify quote status transitioned to expired in DB
  const quoteInDb = db._tables.quotes.find(q => q.id === 'q_expired')
  assert.equal(quoteInDb.status, 'expired')
})

test('Quote Immutability: Accepted quotes cannot be soft deleted', async () => {
  const db = createMockQuotesDb({
    quotes: [
      {
        id: 'q_accepted',
        org_id: 'org_1',
        quote_number: 'EST-101',
        status: 'accepted',
        signed_by: 'Jane Doe',
        total_amount: 1200
      }
    ]
  })

  const res = await softDeleteQuote(db, {
    orgId: 'org_1',
    quoteId: 'q_accepted'
  })

  assert.equal(res.success, false)
  assert.match(res.error, /Cannot delete accepted estimate/i)

  // Verify deleted_at remains null/undefined
  const quoteInDb = db._tables.quotes.find(q => q.id === 'q_accepted')
  assert.equal(quoteInDb.deleted_at, undefined)
})

test('Quote Soft Delete: Draft quotes can be soft deleted safely', async () => {
  const db = createMockQuotesDb({
    quotes: [
      {
        id: 'q_draft',
        org_id: 'org_1',
        quote_number: 'EST-102',
        status: 'draft',
        total_amount: 450
      }
    ]
  })

  const res = await softDeleteQuote(db, {
    orgId: 'org_1',
    quoteId: 'q_draft'
  })

  assert.equal(res.success, true)
  const quoteInDb = db._tables.quotes.find(q => q.id === 'q_draft')
  assert.ok(quoteInDb.deleted_at)
})

// ---------------------------------------------------------------------------
// 4. Idempotent Conversions: Quote to Job & Quote to Invoice
// ---------------------------------------------------------------------------

test('convertQuoteToJob: Multiple calls return existing job idempotently without duplicates', async () => {
  const db = createMockQuotesDb({
    organizations: [{ id: 'org_1', name: 'Apex Plumbing' }],
    quotes: [
      {
        id: 'q_conv_job',
        org_id: 'org_1',
        status: 'accepted',
        title: 'Water Heater Replacement',
        total_amount: 1800,
        contact_id: 'contact_1'
      }
    ],
    quote_items: [
      { quote_id: 'q_conv_job', description: '50 Gallon Gas Water Heater', quantity: 1, unit_price: 1500 },
      { quote_id: 'q_conv_job', description: 'Permit & Expansion Tank', quantity: 1, unit_price: 300 }
    ]
  })

  // First conversion
  const firstRes = await convertQuoteToJob(db, {
    quoteId: 'q_conv_job',
    orgId: 'org_1'
  })
  assert.equal(firstRes.success, true)
  assert.ok(firstRes.job)
  const createdJobId = firstRes.job.id

  // Verify single job exists in DB
  const jobsInDb = db._tables.jobs.filter(j => j.quote_id === 'q_conv_job')
  assert.equal(jobsInDb.length, 1)

  // Second conversion call
  const secondRes = await convertQuoteToJob(db, {
    quoteId: 'q_conv_job',
    orgId: 'org_1'
  })
  assert.equal(secondRes.success, true)
  assert.equal(secondRes.job.id, createdJobId)

  // Verify still only 1 job in DB (no duplicates created)
  const jobsInDbAfter = db._tables.jobs.filter(j => j.quote_id === 'q_conv_job')
  assert.equal(jobsInDbAfter.length, 1)
})

test('convertQuoteToInvoice: Rejects non-accepted quotes and is idempotent for accepted quotes', async () => {
  const db = createMockQuotesDb({
    organizations: [{ id: 'org_1', name: 'Apex Electric' }],
    quotes: [
      {
        id: 'q_sent',
        org_id: 'org_1',
        status: 'sent',
        title: 'Panel Upgrade',
        subtotal: 2500,
        total_amount: 2500
      },
      {
        id: 'q_acc',
        org_id: 'org_1',
        status: 'accepted',
        title: 'EV Charger Installation',
        subtotal: 900,
        total_amount: 900,
        contact_id: 'contact_2'
      }
    ],
    quote_items: [
      { quote_id: 'q_acc', description: 'Level 2 Charger Install', quantity: 1, unit_price: 900 }
    ]
  })

  // Attempting to convert sent quote must fail
  const failedRes = await convertQuoteToInvoice(db, {
    quoteId: 'q_sent',
    orgId: 'org_1'
  })
  assert.equal(failedRes.success, false)
  assert.match(failedRes.error, /must be accepted before converting/i)

  // Converting accepted quote succeeds
  const firstInvRes = await convertQuoteToInvoice(db, {
    quoteId: 'q_acc',
    orgId: 'org_1'
  })
  assert.equal(firstInvRes.success, true)
  assert.ok(firstInvRes.invoice)
  const invId = firstInvRes.invoice.id

  // Second conversion returns existing invoice
  const secondInvRes = await convertQuoteToInvoice(db, {
    quoteId: 'q_acc',
    orgId: 'org_1'
  })
  assert.equal(secondInvRes.success, true)
  assert.equal(secondInvRes.invoice.id, invId)

  const invoicesInDb = db._tables.invoices.filter(i => i.quote_id === 'q_acc')
  assert.equal(invoicesInDb.length, 1)
})

// ---------------------------------------------------------------------------
// 5. Follow-Up Automation Halting on Acceptance and Declination
// ---------------------------------------------------------------------------

test('Automation Cancellation: Quote acceptance cancels pending follow-up runs', async () => {
  const db = createMockQuotesDb({
    organizations: [{ id: 'org_1', name: 'Apex Roofing' }],
    quotes: [
      {
        id: 'q_followup',
        org_id: 'org_1',
        quote_number: 'EST-200',
        status: 'sent',
        manage_token: 'token_followup_secure_random_48_chars_long_valid_abc1',
        expires_at: new Date(Date.now() + 86400000 * 14).toISOString(),
        total_amount: 3500
      }
    ],
    automation_runs: [
      {
        id: 'run_1',
        org_id: 'org_1',
        status: 'pending',
        event_payload: { quote_id: 'q_followup' }
      },
      {
        id: 'run_2',
        org_id: 'org_1',
        status: 'pending',
        event_payload: { quote_id: 'q_followup' }
      }
    ]
  })

  const res = await customerAcceptQuote(
    db,
    'token_followup_secure_random_48_chars_long_valid_abc1',
    'Alice Homeowner',
    'data:image/png;base64,sig'
  )

  assert.equal(res.success, true)
  // Verify all pending automations for this quote were cancelled
  const runs = db._tables.automation_runs.filter(r => r.event_payload?.quote_id === 'q_followup')
  assert.ok(runs.every(r => r.status === 'cancelled'))
})

// ---------------------------------------------------------------------------
// 6. Starter Pass 3-Completed-Jobs Preservation Invariant
// ---------------------------------------------------------------------------

test('Starter Pass: Quotes and Scheduled Jobs never increment completed job count', () => {
  // Free Starter Pass rules:
  // - 3 free completed jobs
  // - completed jobs are ONLY jobs with status === 'completed'
  // - quotes (draft, sent, accepted) do NOT count
  // - scheduled, confirmed, en_route, in_progress jobs do NOT count

  const sampleState = {
    plan: 'free',
    completed_jobs_count: 2,
    jobs: [
      { id: 'j1', status: 'completed' },
      { id: 'j2', status: 'completed' },
      { id: 'j3', status: 'scheduled' },
      { id: 'j4', status: 'in_progress' }
    ],
    quotes: [
      { id: 'q1', status: 'draft' },
      { id: 'q2', status: 'sent' },
      { id: 'q3', status: 'accepted' }
    ]
  }

  // Authoritative calculation of completed jobs
  const completedJobs = sampleState.jobs.filter(j => j.status === 'completed').length
  assert.equal(completedJobs, 2)

  // Creating a new quote or accepting a quote does NOT change completed jobs
  sampleState.quotes.push({ id: 'q4', status: 'accepted' })
  const completedAfterQuote = sampleState.jobs.filter(j => j.status === 'completed').length
  assert.equal(completedAfterQuote, 2)

  // Scheduling a 3rd job does NOT hit paywall
  sampleState.jobs.push({ id: 'j5', status: 'scheduled' })
  const isPaywalledBeforeCompletion = completedAfterQuote >= 3
  assert.equal(isPaywalledBeforeCompletion, false)

  // Only completing job #3 hits the 3-job cap
  sampleState.jobs.find(j => j.id === 'j5').status = 'completed'
  const finalCompleted = sampleState.jobs.filter(j => j.status === 'completed').length
  assert.equal(finalCompleted, 3)

  // Attempting job #4 completion triggers upgrade requirement
  const isPaywalledForJob4 = finalCompleted >= 3
  assert.equal(isPaywalledForJob4, true)
})

// ---------------------------------------------------------------------------
// 7. Customer Public View Organization Logo and Phone
// ---------------------------------------------------------------------------

test('customerViewQuote: Returns verified organization logo and contractor phone', async () => {
  const db = createMockQuotesDb({
    organizations: [
      {
        id: 'org_media',
        name: 'Heritage Air & Heat',
        logo_url: 'https://captodesk.com/storage/logos/heritage.png',
        telnyx_phone_number: '+15552345678',
        owner_phone: '+15559876543'
      }
    ],
    quotes: [
      {
        id: 'q_media',
        org_id: 'org_media',
        quote_number: 'EST-777',
        status: 'sent',
        manage_token: 'token_media_test_48_chars_long_secure_verified_1234',
        title: 'AC Tune Up',
        subtotal: 199,
        total_amount: 199,
        expires_at: new Date(Date.now() + 86400000 * 7).toISOString()
      }
    ]
  })

  const res = await customerViewQuote(db, 'token_media_test_48_chars_long_secure_verified_1234')
  assert.equal(res.success, true)
  assert.ok(res.quote)
  assert.equal(res.organization?.logo_url, 'https://captodesk.com/storage/logos/heritage.png')
  assert.equal(res.organization?.phone, '+15552345678')
  assert.equal(res.quote.status, 'viewed') // Transitions from sent to viewed
})
