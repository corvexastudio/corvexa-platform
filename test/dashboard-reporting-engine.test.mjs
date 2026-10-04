import test from 'node:test'
import assert from 'node:assert'
import {
  getAttentionQueue,
  getOutcomeMetrics,
  getOperationalMetrics,
  getJobsToday,
  getRecentCalls,
  getDashboardOverview
} from '../src/lib/dashboard/dashboard-service.ts'

/**
 * In-memory Supabase mock harness for Dashboard & Reporting tests
 */
function createMockDashboardDb(initialState = {}) {
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
          // Supports "status.eq.overdue" or custom combinations
          filters.push((row) => {
            if (row.status === 'overdue') return true
            if (['sent', 'partially_paid'].includes(row.status) && row.due_date && new Date(row.due_date) < new Date()) {
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

          // Hydrate relations
          const hydrated = filtered.map((row) => {
            const copy = { ...row }
            if (row.contact_id && tables.contacts) {
              copy.contacts = tables.contacts.find((c) => c.id === row.contact_id) || null
            }
            if (row.service_id && tables.services) {
              copy.services = tables.services.find((s) => s.id === row.service_id) || null
            }
            if (row.assigned_to && tables.profiles) {
              copy.profiles = tables.profiles.find((p) => p.id === row.assigned_to) || null
            }
            return copy
          })

          return Promise.resolve({ data: hydrated, count: filtered.length, error: null }).then(resolve, reject)
        }
      }

      return queryBuilder
    }
  }

  return client
}

// -----------------------------------------------------------------------------
// TESTS
// -----------------------------------------------------------------------------

test('1. Attention Queue: Surfaces new unhandled leads with critical urgency', async () => {
  const db = createMockDashboardDb({
    contacts: [
      { id: 'c1', name: 'John Doe', phone: '+15551112222' }
    ],
    leads: [
      { id: 'l1', org_id: 'org1', contact_id: 'c1', status: 'new', value: 750, created_at: '2026-10-01T10:00:00Z' }
    ]
  })

  const queue = await getAttentionQueue(db, 'org1')
  const leadItem = queue.find((i) => i.category === 'lead')

  assert.ok(leadItem, 'Lead item should be in attention queue')
  assert.strictEqual(leadItem.urgency, 'critical')
  assert.strictEqual(leadItem.title, 'New lead: John Doe')
  assert.strictEqual(leadItem.actionHref, '/client/leads')
})

test('2. Attention Queue: Surfaces unread customer conversations waiting for reply', async () => {
  const db = createMockDashboardDb({
    contacts: [
      { id: 'c2', name: 'Alice Smith', phone: '+15553334444' }
    ],
    conversations: [
      { id: 'cv1', org_id: 'org1', contact_id: 'c2', unread_count: 2, last_message_at: '2026-10-02T14:00:00Z' }
    ]
  })

  const queue = await getAttentionQueue(db, 'org1')
  const msgItem = queue.find((i) => i.category === 'message')

  assert.ok(msgItem, 'Message item should be in attention queue')
  assert.strictEqual(msgItem.urgency, 'critical')
  assert.strictEqual(msgItem.title, '2 unread texts from Alice Smith')
  assert.strictEqual(msgItem.actionHref, '/client/inbox')
})

test('3. Attention Queue: Flags expiring quotes with warning urgency', async () => {
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const db = createMockDashboardDb({
    contacts: [
      { id: 'c3', name: 'Bob Roberts', phone: '+15555556666' }
    ],
    quotes: [
      { id: 'q1', org_id: 'org1', contact_id: 'c3', quote_number: 'Q-201', total: 1850, status: 'sent', expires_at: in24h }
    ]
  })

  const queue = await getAttentionQueue(db, 'org1')
  const quoteItem = queue.find((i) => i.category === 'quote')

  assert.ok(quoteItem, 'Expiring quote should be in attention queue')
  assert.strictEqual(quoteItem.urgency, 'warning')
  assert.ok(quoteItem.title.includes('Quote Q-201'))
  assert.strictEqual(quoteItem.actionHref, '/client/quotes')
})

test('4. Attention Queue: Flags requested appointments needing owner confirmation', async () => {
  const db = createMockDashboardDb({
    contacts: [
      { id: 'c4', name: 'Carol Danvers', phone: '+15557778888' }
    ],
    services: [
      { id: 's1', name: 'AC Tune Up', price: 120 }
    ],
    appointments: [
      { id: 'a1', org_id: 'org1', contact_id: 'c4', service_id: 's1', status: 'requested', start_time: '2026-10-05T09:00:00Z' }
    ]
  })

  const queue = await getAttentionQueue(db, 'org1')
  const apptItem = queue.find((i) => i.category === 'appointment')

  assert.ok(apptItem, 'Booking request should be in attention queue')
  assert.strictEqual(apptItem.urgency, 'critical')
  assert.ok(apptItem.title.includes('Booking request: Carol Danvers'))
  assert.strictEqual(apptItem.actionHref, '/client/calendar')
})

test('5. Attention Queue: Flags overdue invoices with critical urgency', async () => {
  const db = createMockDashboardDb({
    contacts: [
      { id: 'c5', name: 'Dave Miller', phone: '+15559990000' }
    ],
    invoices: [
      { id: 'inv1', org_id: 'org1', contact_id: 'c5', invoice_number: 'INV-401', total: 640, status: 'overdue', due_date: '2026-09-20T00:00:00Z' }
    ]
  })

  const queue = await getAttentionQueue(db, 'org1')
  const invItem = queue.find((i) => i.category === 'invoice')

  assert.ok(invItem, 'Overdue invoice should be in attention queue')
  assert.strictEqual(invItem.urgency, 'critical')
  assert.ok(invItem.title.includes('Overdue invoice INV-401'))
  assert.strictEqual(invItem.actionHref, '/client/invoices')
})

test('6. Attention Queue: Flags customers due for repeat service follow-up', async () => {
  const db = createMockDashboardDb({
    contacts: [
      { id: 'c6', org_id: 'org1', name: 'Eve Adams', lifecycle_status: 'due', last_service_date: '2026-07-01T00:00:00Z', next_expected_service_date: '2026-10-01T00:00:00Z' }
    ]
  })

  const queue = await getAttentionQueue(db, 'org1')
  const custItem = queue.find((i) => i.category === 'retention')

  assert.ok(custItem, 'Due customer should be in attention queue')
  assert.strictEqual(custItem.title, 'Service due: Eve Adams')
  assert.strictEqual(custItem.actionHref, '/client/customers/c6')
})

test('7. Attention Queue: Returns clean empty array when no items require attention', async () => {
  const db = createMockDashboardDb({
    leads: [{ id: 'l1', org_id: 'org1', status: 'converted' }],
    conversations: [{ id: 'cv1', org_id: 'org1', unread_count: 0 }],
    quotes: [{ id: 'q1', org_id: 'org1', status: 'accepted' }],
    appointments: [{ id: 'a1', org_id: 'org1', status: 'confirmed' }],
    invoices: [{ id: 'inv1', org_id: 'org1', status: 'paid' }],
    contacts: [{ id: 'c1', org_id: 'org1', lifecycle_status: 'active' }]
  })

  const queue = await getAttentionQueue(db, 'org1')
  assert.strictEqual(queue.length, 0, 'Queue should be empty when all items resolved')
})

test('8. Outcome Metrics: Verifies Recovered Conversations rate calculation', async () => {
  const db = createMockDashboardDb({
    calls: [
      { id: 'call1', org_id: 'org1', contact_id: 'c1', status: 'missed', created_at: '2026-10-01T10:00:00Z' },
      { id: 'call2', org_id: 'org1', contact_id: 'c2', status: 'missed', created_at: '2026-10-01T11:00:00Z' },
      { id: 'call3', org_id: 'org1', contact_id: 'c3', status: 'completed', created_at: '2026-10-01T12:00:00Z' }
    ],
    conversations: [
      // c1 replied, c2 did not reply
      { id: 'conv1', org_id: 'org1', contact_id: 'c1', last_message_at: '2026-10-01T10:05:00Z' }
    ]
  })

  const outcomes = await getOutcomeMetrics(db, 'org1', 'all')
  assert.strictEqual(outcomes.recoveredConversations.totalMissedCalls, 2)
  assert.strictEqual(outcomes.recoveredConversations.recoveredCount, 1)
  assert.strictEqual(outcomes.recoveredConversations.recoveryRate, 50)
})

test('9. Outcome Metrics: Verifies Bookings from CaptoDesk attribution', async () => {
  const db = createMockDashboardDb({
    services: [
      { id: 's1', price: 150 },
      { id: 's2', price: 300 }
    ],
    appointments: [
      { id: 'a1', org_id: 'org1', service_id: 's1', source: 'booking_page', status: 'confirmed', created_at: '2026-10-01T00:00:00Z' },
      { id: 'a2', org_id: 'org1', service_id: 's2', source: 'recovery', status: 'scheduled', created_at: '2026-10-02T00:00:00Z' },
      { id: 'a3', org_id: 'org1', service_id: 's1', source: 'booking_page', status: 'cancelled', created_at: '2026-10-03T00:00:00Z' }
    ]
  })

  const outcomes = await getOutcomeMetrics(db, 'org1', 'all')
  assert.strictEqual(outcomes.bookingsFromCaptoDesk.totalBookings, 2, 'Cancelled bookings excluded')
  assert.strictEqual(outcomes.bookingsFromCaptoDesk.totalBookedValue, 450)
  assert.strictEqual(outcomes.bookingsFromCaptoDesk.onlineBookingsCount, 1)
  assert.strictEqual(outcomes.bookingsFromCaptoDesk.recoveryBookingsCount, 1)
})

test('10. Outcome Metrics: Verifies Quote Conversion win rate and accepted dollar volume', async () => {
  const db = createMockDashboardDb({
    quotes: [
      { id: 'q1', org_id: 'org1', total: 1000, status: 'accepted', created_at: '2026-10-01T00:00:00Z' },
      { id: 'q2', org_id: 'org1', total: 2000, status: 'accepted', created_at: '2026-10-01T00:00:00Z' },
      { id: 'q3', org_id: 'org1', total: 1500, status: 'declined', created_at: '2026-10-01T00:00:00Z' },
      { id: 'q4', org_id: 'org1', total: 800, status: 'sent', created_at: '2026-10-01T00:00:00Z' } // pending, not resolved
    ]
  })

  const outcomes = await getOutcomeMetrics(db, 'org1', 'all')
  assert.strictEqual(outcomes.quoteConversion.acceptedCount, 2)
  assert.strictEqual(outcomes.quoteConversion.totalResolvedCount, 3)
  assert.strictEqual(outcomes.quoteConversion.conversionRate, 67) // 2 / 3 = 66.6% -> 67%
  assert.strictEqual(outcomes.quoteConversion.acceptedValue, 3000)
})

test('11. Outcome Metrics: Verifies Payment Collection rate and amounts', async () => {
  const db = createMockDashboardDb({
    invoices: [
      { id: 'i1', org_id: 'org1', total: 1000, status: 'paid', created_at: '2026-10-01T00:00:00Z' },
      { id: 'i2', org_id: 'org1', total: 500, status: 'sent', created_at: '2026-10-01T00:00:00Z' }
    ],
    payments: [
      { id: 'p1', org_id: 'org1', amount: 1000, status: 'succeeded', created_at: '2026-10-01T00:00:00Z' }
    ]
  })

  const outcomes = await getOutcomeMetrics(db, 'org1', 'all')
  assert.strictEqual(outcomes.paymentCollection.collectedAmount, 1000)
  assert.strictEqual(outcomes.paymentCollection.invoicedAmount, 1500)
  assert.strictEqual(outcomes.paymentCollection.collectionRate, 67) // 1000 / 1500 = 66.6% -> 67%
  assert.strictEqual(outcomes.paymentCollection.paidInvoicesCount, 1)
})

test('12. Outcome Metrics: Verifies Repeat Bookings rate from returning customers', async () => {
  const db = createMockDashboardDb({
    jobs: [
      { id: 'j1', org_id: 'org1', contact_id: 'c1', status: 'completed' },
      { id: 'j2', org_id: 'org1', contact_id: 'c1', status: 'completed' }, // c1 has 2 jobs -> repeat
      { id: 'j3', org_id: 'org1', contact_id: 'c2', status: 'completed' }  // c2 has 1 job
    ],
    appointments: [
      { id: 'a1', org_id: 'org1', contact_id: 'c1', status: 'confirmed', created_at: '2026-10-01T00:00:00Z' },
      { id: 'a2', org_id: 'org1', contact_id: 'c2', status: 'confirmed', created_at: '2026-10-01T00:00:00Z' }
    ]
  })

  const outcomes = await getOutcomeMetrics(db, 'org1', 'all')
  assert.strictEqual(outcomes.repeatBookings.repeatCustomerCount, 1)
  assert.strictEqual(outcomes.repeatBookings.repeatBookingsCount, 1)
  assert.strictEqual(outcomes.repeatBookings.repeatRate, 50)
})

test('13. Daily Operations: Accurately counts operational pulse across all modules', async () => {
  const db = createMockDashboardDb({
    leads: [{ id: 'l1', org_id: 'org1', status: 'new', created_at: new Date().toISOString() }],
    calls: [{ id: 'cl1', org_id: 'org1', status: 'missed', created_at: new Date().toISOString() }],
    appointments: [{ id: 'ap1', org_id: 'org1', status: 'confirmed', created_at: new Date().toISOString() }],
    quotes: [{ id: 'q1', org_id: 'org1', status: 'sent', total: 450 }],
    jobs: [{ id: 'j1', org_id: 'org1', scheduled_start: new Date().toISOString() }],
    invoices: [{ id: 'i1', org_id: 'org1', status: 'sent', total: 320 }],
    payments: [{ id: 'p1', org_id: 'org1', status: 'succeeded', amount: 320, created_at: new Date().toISOString() }],
    review_requests: [{ id: 'r1', org_id: 'org1', created_at: new Date().toISOString() }],
    contacts: [{ id: 'c1', org_id: 'org1', lifecycle_status: 'due' }]
  })

  const ops = await getOperationalMetrics(db, 'org1', '30d')
  assert.strictEqual(ops.newLeads, 1)
  assert.strictEqual(ops.missedCallsRecovered, 1)
  assert.strictEqual(ops.activeBookings, 1)
  assert.strictEqual(ops.quotesAwaitingResponse, 1)
  assert.strictEqual(ops.quotesAwaitingResponseValue, 450)
  assert.strictEqual(ops.outstandingInvoices, 1)
  assert.strictEqual(ops.outstandingInvoicesBalance, 320)
  assert.strictEqual(ops.paymentsReceived, 1)
  assert.strictEqual(ops.paymentsReceivedAmount, 320)
  assert.strictEqual(ops.reviewRequestsSent, 1)
  assert.strictEqual(ops.customersDueForFollowup, 1)
})

test('14. Multi-Tenancy Isolation: Strictly prevents cross-tenant dashboard metrics leakage', async () => {
  const db = createMockDashboardDb({
    leads: [
      { id: 'l_tenant1', org_id: 'org1', status: 'new', value: 500, created_at: new Date().toISOString() },
      { id: 'l_tenant2', org_id: 'org2', status: 'new', value: 9999, created_at: new Date().toISOString() }
    ],
    invoices: [
      { id: 'inv_tenant1', org_id: 'org1', total: 100, status: 'sent', due_date: '2026-09-01T00:00:00Z' },
      { id: 'inv_tenant2', org_id: 'org2', total: 8888, status: 'sent', due_date: '2026-09-01T00:00:00Z' }
    ]
  })

  const queue1 = await getAttentionQueue(db, 'org1')
  const lead1 = queue1.find((i) => i.category === 'lead')
  const inv1 = queue1.find((i) => i.category === 'invoice')

  assert.ok(lead1, 'Tenant 1 lead present')
  assert.strictEqual(lead1.metadata.leadId, 'l_tenant1')
  assert.ok(!queue1.some((i) => i.metadata?.leadId === 'l_tenant2'), 'Tenant 2 lead must NEVER leak to Tenant 1')

  assert.ok(inv1, 'Tenant 1 invoice present')
  assert.strictEqual(inv1.metadata.invoiceId, 'inv_tenant1')
  assert.ok(!queue1.some((i) => i.metadata?.invoiceId === 'inv_tenant2'), 'Tenant 2 invoice must NEVER leak to Tenant 1')
})
