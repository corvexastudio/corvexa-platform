import test from 'node:test'
import assert from 'node:assert'
import {
  calculateCustomerLtv,
  aggregateCustomerTimeline,
  getCustomerProfile360,
  searchAndFilterCustomers
} from '../src/lib/crm/customer-manager.ts'

/**
 * In-memory Supabase mock harness for Customer Intelligence & CRM tests
 */
function createMockCrmDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    contacts: initialState.contacts || [],
    leads: initialState.leads || [],
    calls: initialState.calls || [],
    conversations: initialState.conversations || [],
    messages: initialState.messages || [],
    quotes: initialState.quotes || [],
    quote_items: initialState.quote_items || [],
    appointments: initialState.appointments || [],
    jobs: initialState.jobs || [],
    job_items: initialState.job_items || [],
    invoices: initialState.invoices || [],
    invoice_items: initialState.invoice_items || [],
    payments: initialState.payments || [],
    review_requests: initialState.review_requests || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []

      const queryBuilder = {
        select: (columns) => queryBuilder,
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
          if (filtered.length === 0) return { data: null, error: new Error(`Row not found in ${tableName}`) }
          return { data: filtered[0], error: null }
        },
        insert: (rowOrRows) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          const insertedRows = []

          for (const row of rows) {
            const newRow = {
              id: row.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              created_at: row.created_at || new Date().toISOString(),
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
            then: (resolve, reject) => Promise.resolve({ data: lastInserted, error: null }).then(resolve, reject)
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

// -------------------------------------------------------------
// TEST SUITE: Phase 8 Customer Database & Intelligence
// -------------------------------------------------------------

test('1. calculateCustomerLtv computes lifetime value from succeeded payments and paid invoices', () => {
  // Scenario A: Verified succeeded payments
  const payments = [
    { amount: 450, payment_status: 'succeeded' },
    { amount: 800, payment_status: 'succeeded' },
    { amount: 200, payment_status: 'failed' } // should be ignored
  ]
  assert.strictEqual(calculateCustomerLtv(payments), 1250)

  // Scenario B: Fallback to paid invoices when payments array empty
  const invoices = [
    { total: 600, amount_paid: 600, status: 'paid' },
    { total: 500, amount_paid: 250, status: 'partially_paid' },
    { total: 300, amount_paid: 0, status: 'sent' }
  ]
  assert.strictEqual(calculateCustomerLtv([], invoices), 850)

  // Scenario C: No payments or paid invoices
  assert.strictEqual(calculateCustomerLtv([], []), 0)
})

test('2. aggregateCustomerTimeline synthesizes real events from domain tables without duplication', () => {
  const context = {
    calls: [
      { id: 'c1', status: 'missed', caller_number: '+15551234567', created_at: '2026-10-01T10:00:00Z', direction: 'inbound' }
    ],
    messages: [
      { id: 'm1', content: 'We missed your call!', direction: 'outbound', created_at: '2026-10-01T10:01:00Z' },
      { id: 'm2', content: 'Yes, looking for a repair quote.', direction: 'inbound', created_at: '2026-10-01T10:05:00Z' }
    ],
    quotes: [
      { id: 'q1', quote_number: 'Q-101', title: 'Pipe Repair', total: 350, created_at: '2026-10-02T09:00:00Z', sent_at: '2026-10-02T09:30:00Z', accepted_at: '2026-10-03T11:00:00Z' }
    ],
    appointments: [
      { id: 'a1', start_time: '2026-10-04T14:00:00Z', created_at: '2026-10-03T11:30:00Z', status: 'confirmed' }
    ],
    jobs: [
      { id: 'j1', job_number: 'JOB-201', title: 'Pipe Replacement', created_at: '2026-10-03T12:00:00Z', completed_at: '2026-10-04T16:00:00Z' }
    ],
    invoices: [
      { id: 'i1', invoice_number: 'INV-301', total: 350, created_at: '2026-10-04T16:05:00Z', sent_at: '2026-10-04T16:10:00Z', paid_at: '2026-10-04T18:00:00Z' }
    ],
    payments: [
      { id: 'p1', amount: 350, payment_method: 'stripe_card', payment_status: 'succeeded', paid_at: '2026-10-04T18:00:00Z' }
    ],
    reviewRequests: [
      { id: 'r1', status: 'sent', created_at: '2026-10-05T10:00:00Z', sent_at: '2026-10-05T10:00:00Z', clicked_at: '2026-10-05T14:00:00Z', click_count: 1 }
    ]
  }

  const timeline = aggregateCustomerTimeline(context)

  // Verify all event types are represented
  const types = new Set(timeline.map(t => t.type))
  assert.ok(types.has('call'))
  assert.ok(types.has('message'))
  assert.ok(types.has('quote'))
  assert.ok(types.has('appointment'))
  assert.ok(types.has('job'))
  assert.ok(types.has('invoice'))
  assert.ok(types.has('payment'))
  assert.ok(types.has('review_request'))

  // Verify specific titles
  assert.ok(timeline.some(t => t.title === 'Missed Call'))
  assert.ok(timeline.some(t => t.title === 'Customer Replied'))
  assert.ok(timeline.some(t => t.title.includes('Quote Accepted')))
  assert.ok(timeline.some(t => t.title.includes('Job Completed')))
  assert.ok(timeline.some(t => t.title.includes('Payment Received')))
  assert.ok(timeline.some(t => t.title === 'Review Link Clicked'))
})

test('3. Timeline Ordering strictly sorts newest events first', () => {
  const context = {
    calls: [{ id: '1', created_at: '2026-10-01T10:00:00Z' }],
    jobs: [{ id: '2', completed_at: '2026-10-04T12:00:00Z' }],
    payments: [{ id: '3', paid_at: '2026-10-05T15:00:00Z' }]
  }

  const timeline = aggregateCustomerTimeline(context)
  assert.strictEqual(timeline.length, 3)
  assert.strictEqual(timeline[0].type, 'payment', 'Newest event (Oct 5) must be first')
  assert.strictEqual(timeline[1].type, 'job', 'Middle event (Oct 4) must be second')
  assert.strictEqual(timeline[2].type, 'call', 'Oldest event (Oct 1) must be third')
})

test('4. getCustomerProfile360 resolves initial lead acquisition source', async () => {
  const orgId = 'org-plumb-1'
  const contactId = 'contact-alice'

  const db = createMockCrmDb({
    contacts: [{ id: contactId, org_id: orgId, name: 'Alice Smith', phone: '+15551112233' }],
    leads: [
      { id: 'lead-1', org_id: orgId, contact_id: contactId, source: 'missed_call', created_at: '2026-09-01T10:00:00Z' }
    ]
  })

  const res = await getCustomerProfile360(db, { orgId, contactId })
  assert.strictEqual(res.success, true)
  assert.ok(res.profile)
  assert.strictEqual(res.profile.leadSource, 'missed_call')
})

test('5. searchAndFilterCustomers matches by partial name and phone', async () => {
  const orgId = 'org-search-test'
  const db = createMockCrmDb({
    contacts: [
      { id: 'c1', org_id: orgId, name: 'Michael Jordan', phone: '+15552345678', created_at: '2026-10-01T00:00:00Z' },
      { id: 'c2', org_id: orgId, name: 'LeBron James', phone: '+15559876543', created_at: '2026-10-02T00:00:00Z' }
    ]
  })

  // Search by name
  const nameRes = await searchAndFilterCustomers(db, { orgId, query: 'jordan' })
  assert.strictEqual(nameRes.customers.length, 1)
  assert.strictEqual(nameRes.customers[0].name, 'Michael Jordan')

  // Search by phone snippet
  const phoneRes = await searchAndFilterCustomers(db, { orgId, query: '9876' })
  assert.strictEqual(phoneRes.customers.length, 1)
  assert.strictEqual(phoneRes.customers[0].name, 'LeBron James')
})

test('6. searchAndFilterCustomers matches by email domain and street address', async () => {
  const orgId = 'org-search-test-2'
  const db = createMockCrmDb({
    contacts: [
      { id: 'c1', org_id: orgId, name: 'Clark Kent', phone: '+15553334444', email: 'clark@dailyplanet.com', address: '344 Clinton St', created_at: '2026-10-01T00:00:00Z' },
      { id: 'c2', org_id: orgId, name: 'Bruce Wayne', phone: '+15554445555', email: 'bruce@waynecorp.com', address: '1007 Mountain Drive', created_at: '2026-10-02T00:00:00Z' }
    ]
  })

  // Search by email domain
  const emailRes = await searchAndFilterCustomers(db, { orgId, query: 'waynecorp' })
  assert.strictEqual(emailRes.customers.length, 1)
  assert.strictEqual(emailRes.customers[0].name, 'Bruce Wayne')

  // Search by street address
  const addrRes = await searchAndFilterCustomers(db, { orgId, query: 'Clinton St' })
  assert.strictEqual(addrRes.customers.length, 1)
  assert.strictEqual(addrRes.customers[0].name, 'Clark Kent')
})

test('7. searchAndFilterCustomers filters by tag inclusion and lifecycle status', async () => {
  const orgId = 'org-filter-test'
  const db = createMockCrmDb({
    contacts: [
      { id: 'c1', org_id: orgId, name: 'Tony Stark', phone: '+15551110001', tags: ['VIP', 'Commercial'], last_service_date: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(), created_at: '2026-10-01T00:00:00Z' }, // active
      { id: 'c2', org_id: orgId, name: 'Peter Parker', phone: '+15551110002', tags: ['Residential'], last_service_date: new Date(Date.now() - 100 * 24 * 3600 * 1000).toISOString(), created_at: '2026-10-01T00:00:00Z' } // due (frequency 90)
    ]
  })

  // Filter by tag 'VIP'
  const tagRes = await searchAndFilterCustomers(db, { orgId, tag: 'VIP' })
  assert.strictEqual(tagRes.customers.length, 1)
  assert.strictEqual(tagRes.customers[0].name, 'Tony Stark')

  // Filter by lifecycle status 'due'
  const statusRes = await searchAndFilterCustomers(db, { orgId, status: 'due' })
  assert.strictEqual(statusRes.customers.length, 1)
  assert.strictEqual(statusRes.customers[0].name, 'Peter Parker')
})

test('8. searchAndFilterCustomers sorts customers by recent activity across all tables', async () => {
  const orgId = 'org-sort-test'
  const contactOld = 'c-old'
  const contactNew = 'c-new'

  const db = createMockCrmDb({
    contacts: [
      { id: contactOld, org_id: orgId, name: 'Old Contact', phone: '+1555111', created_at: '2026-08-01T00:00:00Z' },
      { id: contactNew, org_id: orgId, name: 'Active Contact', phone: '+1555222', created_at: '2026-08-01T00:00:00Z' }
    ],
    invoices: [
      { contact_id: contactNew, org_id: orgId, total: 500, amount_paid: 500, status: 'paid', created_at: '2026-10-05T12:00:00Z' }
    ]
  })

  const res = await searchAndFilterCustomers(db, { orgId, sortBy: 'last_activity' })
  assert.strictEqual(res.customers[0].id, contactNew, 'Contact with recent invoice activity must be sorted first')
})

test('9. searchAndFilterCustomers sorts customers by Lifetime Value descending', async () => {
  const orgId = 'org-ltv-sort'
  const db = createMockCrmDb({
    contacts: [
      { id: 'c-low', org_id: orgId, name: 'Low Value', phone: '+15551', created_at: '2026-10-01T00:00:00Z' },
      { id: 'c-high', org_id: orgId, name: 'High Value', phone: '+15552', created_at: '2026-10-01T00:00:00Z' }
    ],
    payments: [
      { contact_id: 'c-low', org_id: orgId, amount: 200, payment_status: 'succeeded' },
      { contact_id: 'c-high', org_id: orgId, amount: 3500, payment_status: 'succeeded' }
    ]
  })

  const res = await searchAndFilterCustomers(db, { orgId, sortBy: 'ltv' })
  assert.strictEqual(res.customers[0].id, 'c-high')
  assert.strictEqual(res.customers[0].lifetime_value, 3500)
  assert.strictEqual(res.customers[1].id, 'c-low')
  assert.strictEqual(res.customers[1].lifetime_value, 200)
})

test('10. getCustomerProfile360 assembles complete stats and sub-entities', async () => {
  const orgId = 'org-profile-full'
  const contactId = 'contact-full-test'

  const db = createMockCrmDb({
    contacts: [{ id: contactId, org_id: orgId, name: 'Diana Prince', phone: '+15559998888', address: 'Themyscira Embassy' }],
    jobs: [
      { id: 'j1', org_id: orgId, contact_id: contactId, job_number: 'J-1', title: 'Security Upgrade', status: 'completed' },
      { id: 'j2', org_id: orgId, contact_id: contactId, job_number: 'J-2', title: 'Perimeter Check', status: 'in_progress' }
    ],
    quotes: [
      { id: 'q1', org_id: orgId, contact_id: contactId, quote_number: 'Q-1', total: 1200, status: 'accepted' }
    ],
    invoices: [
      { id: 'inv-1', org_id: orgId, contact_id: contactId, invoice_number: 'INV-1', total: 1200, amount_paid: 1200, status: 'paid' }
    ],
    payments: [
      { id: 'p1', org_id: orgId, contact_id: contactId, amount: 1200, payment_status: 'succeeded' }
    ]
  })

  const res = await getCustomerProfile360(db, { orgId, contactId })
  assert.strictEqual(res.success, true)
  assert.ok(res.profile)
  assert.strictEqual(res.profile.stats.totalJobs, 2)
  assert.strictEqual(res.profile.stats.completedJobs, 1)
  assert.strictEqual(res.profile.stats.totalQuotes, 1)
  assert.strictEqual(res.profile.stats.totalInvoices, 1)
  assert.strictEqual(res.profile.stats.totalPayments, 1)
  assert.strictEqual(res.profile.lifetimeValue, 1200)
  assert.strictEqual(res.profile.jobs.length, 2)
  assert.strictEqual(res.profile.quotes.length, 1)
  assert.strictEqual(res.profile.invoices.length, 1)
})

test('11. Multi-Tenant Isolation prevents cross-tenant customer profile and search access', async () => {
  const orgA = 'org-alpha'
  const orgB = 'org-beta'
  const contactA = 'contact-alpha-1'

  const db = createMockCrmDb({
    contacts: [
      { id: contactA, org_id: orgA, name: 'Secret Customer', phone: '+15557778888' }
    ]
  })

  // Org B attempts to query Org A's customer profile
  const profileRes = await getCustomerProfile360(db, {
    orgId: orgB, // Mismatched tenant
    contactId: contactA
  })
  assert.strictEqual(profileRes.success, false)
  assert.strictEqual(profileRes.error, 'Row not found in contacts')

  // Org B searches for Org A's customer
  const searchRes = await searchAndFilterCustomers(db, {
    orgId: orgB, // Mismatched tenant
    query: 'Secret'
  })
  assert.strictEqual(searchRes.customers.length, 0)
})
