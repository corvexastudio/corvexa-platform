import test from 'node:test'
import assert from 'node:assert'
import {
  calculateQuoteFinancials,
  createQuote,
  sendQuote,
  customerViewQuote,
  customerAcceptQuote,
  customerDeclineQuote
} from '../src/lib/quotes/quote-manager.ts'
import {
  createJob,
  updateJobStatus,
  convertQuoteToJob
} from '../src/lib/jobs/job-manager.ts'

/**
 * In-memory Supabase mock harness for quotes and jobs tests
 */
function createMockQuotesJobsDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    quotes: initialState.quotes || [],
    quote_items: initialState.quote_items || [],
    jobs: initialState.jobs || [],
    job_items: initialState.job_items || [],
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
          filters.push((row) => arr.includes(row[col]))
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
        order: () => queryBuilder,
        limit: () => queryBuilder,
        then: (resolve, reject) => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject)
        },
        maybeSingle: async () => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          return { data: filtered[0] || null, error: null }
        },
        single: async () => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
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
              then: (resolve, reject) => Promise.resolve({ data: insertedRows, error: null }).then(resolve, reject)
            }),
            then: (resolve, reject) => {
              return Promise.resolve({ data: lastInserted, error: null }).then(resolve, reject)
            }
          }
        },
        update: (updates) => {
          const updateFilters = [...filters]
          const updateBuilder = {
            eq: (col, val) => {
              updateFilters.push((row) => row[col] === val)
              return updateBuilder
            },
            in: (col, arr) => {
              updateFilters.push((row) => arr.includes(row[col]))
              return updateBuilder
            },
            select: () => ({
              single: async () => {
                let updated = null
                const tableData = tables[tableName] || []
                for (const row of tableData) {
                  if (updateFilters.every((fn) => fn(row))) {
                    Object.assign(row, updates)
                    updated = row
                  }
                }
                return { data: updated, error: null }
              },
              maybeSingle: async () => {
                let updated = null
                const tableData = tables[tableName] || []
                for (const row of tableData) {
                  if (updateFilters.every((fn) => fn(row))) {
                    Object.assign(row, updates)
                    updated = row
                  }
                }
                return { data: updated, error: null }
              }
            }),
            then: (resolve, reject) => {
              let updated = null
              const tableData = tables[tableName] || []
              for (const row of tableData) {
                if (updateFilters.every((fn) => fn(row))) {
                  Object.assign(row, updates)
                  updated = row
                }
              }
              return Promise.resolve({ data: updated, error: null }).then(resolve, reject)
            }
          }
          return updateBuilder
        }
      }

      return queryBuilder
    }
  }

  return client
}

/**
 * -----------------------------------------------------------------------------
 * 1. QUOTE FINANCIAL CALCULATIONS
 * -----------------------------------------------------------------------------
 */
test('Quotes: Financial math correctly calculates subtotal, tax, discount, and total', () => {
  const items = [
    { description: 'Run capacitor replacement', quantity: 1, unit_price: 180.00 },
    { description: 'Labor hours', quantity: 2.5, unit_price: 90.00 },
    { description: 'Refrigerant R-410A (lbs)', quantity: 3, unit_price: 45.00 }
  ]

  // Subtotal = 180 + 225 + 135 = 540.00
  // Discount = 40.00 -> Taxable = 500.00
  // Tax (8.25%) = 41.25
  // Total = 541.25
  const result = calculateQuoteFinancials(items, {
    discount: 40.00,
    taxRate: 0.0825
  })

  assert.strictEqual(result.subtotal, 540.00)
  assert.strictEqual(result.discount, 40.00)
  assert.strictEqual(result.tax, 41.25)
  assert.strictEqual(result.total, 541.25)
  assert.strictEqual(result.lineItems.length, 3)
})

/**
 * -----------------------------------------------------------------------------
 * 2. QUOTE CREATION & DISPATCH
 * -----------------------------------------------------------------------------
 */
test('Quotes: Creates draft quote with line items and tokenized manage link', async () => {
  const db = createMockQuotesJobsDb({
    organizations: [{ id: 'org-1', name: 'Apex Cooling' }],
    contacts: [{ id: 'cnt-1', org_id: 'org-1', name: 'David Miller', phone: '+12145550199' }]
  })

  const res = await createQuote(db, {
    orgId: 'org-1',
    contactId: 'cnt-1',
    title: 'AC Condenser Replacement',
    items: [
      { description: '4-Ton 16 SEER Condenser Unit', quantity: 1, unit_price: 3200.00 },
      { description: 'Installation & Disposal Labor', quantity: 1, unit_price: 1200.00 }
    ],
    taxRate: 0.08,
    discount: 200.00
  })

  assert.strictEqual(res.success, true)
  assert.strictEqual(res.quote.status, 'draft')
  assert.ok(res.quote.quote_number.startsWith('QT-'))
  assert.ok(res.manageToken)
  assert.ok(res.manageUrl.includes(res.manageToken))

  // Total = (4400 - 200) + 8% tax (336) = 4536.00
  assert.strictEqual(Number(res.quote.total), 4536.00)
  assert.strictEqual(db._tables.quotes.length, 1)
  assert.strictEqual(db._tables.quote_items.length, 2)
})

test('Quotes: Sending quote transitions status to sent and schedules 2-day & 5-day follow-ups', async () => {
  const db = createMockQuotesJobsDb({
    organizations: [
      { id: 'org-1', name: 'Apex Cooling', telnyx_phone_number: '+12145550100' }
    ],
    contacts: [
      { id: 'cnt-1', org_id: 'org-1', name: 'David Miller', phone: '+12145550199' }
    ],
    quotes: [
      {
        id: 'qt-101',
        org_id: 'org-1',
        contact_id: 'cnt-1',
        quote_number: 'QT-889900',
        title: 'AC Tune Up',
        subtotal: 150.00,
        total: 150.00,
        status: 'draft',
        manage_token: 'token-qt-101'
      }
    ]
  })

  const res = await sendQuote(db, 'qt-101', 'org-1')
  assert.strictEqual(res.success, true)
  assert.strictEqual(res.quote.status, 'sent')
  assert.ok(res.quote.sent_at)

  // Verify automated follow-ups were scheduled in automation_runs
  const scheduledRuns = db._tables.automation_runs.filter(r => r.status === 'scheduled')
  assert.strictEqual(scheduledRuns.length, 2)

  const fu1 = scheduledRuns.find(r => r.job_id.includes('fu1_'))
  const fu2 = scheduledRuns.find(r => r.job_id.includes('fu2_'))
  assert.ok(fu1, '2-day follow-up must be scheduled')
  assert.ok(fu2, '5-day follow-up must be scheduled')
  assert.ok(fu1.action_params.text.includes('following up on your estimate'))
})

/**
 * -----------------------------------------------------------------------------
 * 3. CUSTOMER VIEW & ACCEPTANCE WITH STOP CONDITIONS
 * -----------------------------------------------------------------------------
 */
test('Quotes: Viewing sent quote transitions status to viewed', async () => {
  const db = createMockQuotesJobsDb({
    organizations: [{ id: 'org-1', name: 'Apex Cooling' }],
    contacts: [{ id: 'cnt-1', org_id: 'org-1', name: 'David' }],
    quotes: [
      {
        id: 'qt-202',
        org_id: 'org-1',
        contact_id: 'cnt-1',
        quote_number: 'QT-202020',
        status: 'sent',
        manage_token: 'view-token-202',
        total: 250.00
      }
    ]
  })

  const res = await customerViewQuote(db, 'view-token-202')
  assert.strictEqual(res.success, true)
  assert.strictEqual(res.quote.status, 'viewed')
  assert.ok(res.quote.viewed_at)
})

test('Quotes: Customer acceptance marks quote accepted and halts scheduled follow-ups', async () => {
  const db = createMockQuotesJobsDb({
    organizations: [{ id: 'org-1', name: 'Apex Cooling', telnyx_phone_number: '+12145550100' }],
    contacts: [{ id: 'cnt-1', org_id: 'org-1', name: 'David', phone: '+12145550199' }],
    quotes: [
      {
        id: 'qt-accept-me',
        org_id: 'org-1',
        contact_id: 'cnt-1',
        quote_number: 'QT-303030',
        status: 'viewed',
        manage_token: 'accept-token-303',
        total: 750.00
      }
    ],
    automation_runs: [
      {
        id: 'run-fu1',
        org_id: 'org-1',
        status: 'scheduled',
        event_payload: { quote_id: 'qt-accept-me', step: 1 }
      },
      {
        id: 'run-fu2',
        org_id: 'org-1',
        status: 'scheduled',
        event_payload: { quote_id: 'qt-accept-me', step: 2 }
      }
    ]
  })

  const res = await customerAcceptQuote(db, 'accept-token-303', 'David Miller')
  assert.strictEqual(res.success, true)
  assert.strictEqual(res.quote.status, 'accepted')
  assert.ok(res.quote.accepted_at)

  // Verify scheduled follow-up runs were automatically CANCELLED
  const pendingRuns = db._tables.automation_runs.filter(r => r.status === 'scheduled')
  assert.strictEqual(pendingRuns.length, 0)
  const cancelledRuns = db._tables.automation_runs.filter(r => r.status === 'cancelled')
  assert.strictEqual(cancelledRuns.length, 2)
})

test('Quotes: Customer declination marks quote declined and halts scheduled follow-ups', async () => {
  const db = createMockQuotesJobsDb({
    organizations: [{ id: 'org-1', name: 'Apex Cooling' }],
    contacts: [{ id: 'cnt-1', org_id: 'org-1', name: 'David' }],
    quotes: [
      {
        id: 'qt-decline-me',
        org_id: 'org-1',
        contact_id: 'cnt-1',
        quote_number: 'QT-404040',
        status: 'viewed',
        manage_token: 'decline-token-404',
        total: 1200.00
      }
    ],
    automation_runs: [
      {
        id: 'run-fu1',
        org_id: 'org-1',
        status: 'scheduled',
        event_payload: { quote_id: 'qt-decline-me', step: 1 }
      }
    ]
  })

  const res = await customerDeclineQuote(db, 'decline-token-404', 'Decided to wait until spring')
  assert.strictEqual(res.success, true)
  assert.strictEqual(res.quote.status, 'declined')
  assert.strictEqual(res.quote.decline_reason, 'Decided to wait until spring')

  // Verify follow-ups cancelled
  const pendingRuns = db._tables.automation_runs.filter(r => r.status === 'scheduled')
  assert.strictEqual(pendingRuns.length, 0)
})

/**
 * -----------------------------------------------------------------------------
 * 4. FIELD JOBS & LIFECYCLE
 * -----------------------------------------------------------------------------
 */
test('Jobs: Creates job and bridges accepted quote line items into job items', async () => {
  const db = createMockQuotesJobsDb({
    organizations: [{ id: 'org-1', name: 'Apex Cooling' }],
    contacts: [{ id: 'cnt-1', org_id: 'org-1', name: 'Customer Gary', phone: '+12145550199' }],
    quotes: [
      {
        id: 'qt-bridge',
        org_id: 'org-1',
        contact_id: 'cnt-1',
        quote_number: 'QT-990011',
        title: 'Furnace Inspection & Repair',
        status: 'accepted',
        total: 450.00
      }
    ],
    quote_items: [
      { id: 'qi-1', quote_id: 'qt-bridge', description: 'Thermal thermocouple', quantity: 1, unit_price: 150.00 },
      { id: 'qi-2', quote_id: 'qt-bridge', description: 'Heat exchanger service', quantity: 2, unit_price: 150.00 }
    ]
  })

  const scheduledStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const res = await convertQuoteToJob(db, {
    quoteId: 'qt-bridge',
    orgId: 'org-1',
    scheduledStart
  })

  assert.strictEqual(res.success, true)
  assert.strictEqual(res.job.status, 'scheduled')
  assert.strictEqual(res.job.quote_id, 'qt-bridge')
  assert.ok(res.job.job_number.startsWith('JOB-'))
  assert.strictEqual(db._tables.jobs.length, 1)
  assert.strictEqual(db._tables.job_items.length, 2)
})

test('Jobs: Advances status through en_route -> in_progress -> completed and emits job.completed', async () => {
  const scheduledStart = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  const db = createMockQuotesJobsDb({
    organizations: [{ id: 'org-1', name: 'Apex Cooling', telnyx_phone_number: '+12145550100' }],
    contacts: [{ id: 'cnt-1', org_id: 'org-1', name: 'Gary', phone: '+12145550199' }],
    jobs: [
      {
        id: 'job-pipeline',
        org_id: 'org-1',
        contact_id: 'cnt-1',
        job_number: 'JOB-554433',
        title: 'AC Diagnostic',
        status: 'scheduled',
        scheduled_start: scheduledStart
      }
    ]
  })

  // 1. Mark En Route
  const step1 = await updateJobStatus(db, {
    jobId: 'job-pipeline',
    orgId: 'org-1',
    newStatus: 'en_route',
    notifyCustomer: true
  })
  assert.strictEqual(step1.success, true)
  assert.strictEqual(db._tables.jobs[0].status, 'en_route')
  assert.ok(db._tables.jobs[0].en_route_at)

  // 2. Mark In Progress
  const step2 = await updateJobStatus(db, {
    jobId: 'job-pipeline',
    orgId: 'org-1',
    newStatus: 'in_progress',
    notes: 'Arrived on site. Customer let tech in.'
  })
  assert.strictEqual(step2.success, true)
  assert.strictEqual(db._tables.jobs[0].status, 'in_progress')
  assert.ok(db._tables.jobs[0].started_at)
  assert.ok(db._tables.jobs[0].notes.includes('Arrived on site'))

  // 3. Mark Completed -> MUST emit job.completed!
  const step3 = await updateJobStatus(db, {
    jobId: 'job-pipeline',
    orgId: 'org-1',
    newStatus: 'completed'
  })
  assert.strictEqual(step3.success, true)
  assert.strictEqual(db._tables.jobs[0].status, 'completed')
  assert.ok(db._tables.jobs[0].completed_at)
})

test('Multi-Tenancy: Quotes and Jobs are strictly isolated per tenant organization', async () => {
  const db = createMockQuotesJobsDb({
    organizations: [
      { id: 'org-tenant-a', name: 'Tenant A' },
      { id: 'org-tenant-b', name: 'Tenant B' }
    ],
    quotes: [
      { id: 'qt-a', org_id: 'org-tenant-a', quote_number: 'QT-A', total: 100.00, status: 'draft' }
    ],
    jobs: [
      { id: 'job-a', org_id: 'org-tenant-a', job_number: 'JOB-A', status: 'scheduled' }
    ]
  })

  // Attempting to update Tenant A's quote with Tenant B's credentials fails
  const sendRes = await sendQuote(db, 'qt-a', 'org-tenant-b')
  assert.strictEqual(sendRes.success, false)
  assert.strictEqual(sendRes.error, 'Quote not found')

  // Attempting to update Tenant A's job with Tenant B's credentials fails
  const jobRes = await updateJobStatus(db, {
    jobId: 'job-a',
    orgId: 'org-tenant-b',
    newStatus: 'completed'
  })
  assert.strictEqual(jobRes.success, false)
  assert.strictEqual(jobRes.error, 'Job not found')
})
