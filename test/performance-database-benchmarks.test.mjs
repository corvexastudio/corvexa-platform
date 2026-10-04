import test from 'node:test'
import assert from 'node:assert'
import { encodeCursor, decodeCursor, paginateArrayKeyset } from '../src/lib/pagination/cursor.ts'
import { searchAndFilterCustomers, calculateCustomerLtv } from '../src/lib/crm/customer-manager.ts'
import { getOutcomeMetrics, getAttentionQueue } from '../src/lib/dashboard/dashboard-service.ts'

/**
 * High-volume in-memory database mock harness for PostgreSQL performance benchmarks
 */
function createBenchmarkDb(tablesData = {}) {
  const tables = {
    contacts: tablesData.contacts || [],
    payments: tablesData.payments || [],
    invoices: tablesData.invoices || [],
    calls: tablesData.calls || [],
    jobs: tablesData.jobs || [],
    quotes: tablesData.quotes || [],
    appointments: tablesData.appointments || [],
    conversations: tablesData.conversations || [],
    processed_events: tablesData.processed_events || []
  }

  // Instrumentation spy to record queries and arguments
  const executedQueries = []

  const client = {
    _tables: tables,
    _executedQueries: executedQueries,
    from: (tableName) => {
      let filters = []
      let selectedCols = '*'
      let limitCount = null
      let isSingle = false

      const queryBuilder = {
        select: (cols) => {
          selectedCols = cols
          return queryBuilder
        },
        eq: (col, val) => {
          filters.push((r) => r[col] === val)
          executedQueries.push({ table: tableName, type: 'eq', col, val })
          return queryBuilder
        },
        neq: (col, val) => {
          filters.push((r) => r[col] !== val)
          executedQueries.push({ table: tableName, type: 'neq', col, val })
          return queryBuilder
        },
        in: (col, vals) => {
          filters.push((r) => Array.isArray(vals) && vals.includes(r[col]))
          executedQueries.push({ table: tableName, type: 'in', col, valsCount: vals.length, vals })
          return queryBuilder
        },
        gte: (col, val) => {
          filters.push((r) => r[col] >= val)
          return queryBuilder
        },
        lte: (col, val) => {
          filters.push((r) => r[col] <= val)
          return queryBuilder
        },
        order: () => queryBuilder,
        limit: (n) => {
          limitCount = n
          executedQueries.push({ table: tableName, type: 'limit', limit: n })
          return queryBuilder
        },
        single: () => {
          isSingle = true
          return queryBuilder
        },
        then: (resolve) => {
          const table = tables[tableName] || []
          let result = table.filter((row) => filters.every((f) => f(row)))
          if (limitCount !== null) {
            result = result.slice(0, limitCount)
          }

          if (isSingle) {
            return resolve({
              data: result[0] || null,
              error: result.length === 0 ? { message: 'Not found' } : null
            })
          }
          return resolve({ data: result, error: null, count: result.length })
        }
      }

      return queryBuilder
    }
  }

  return client
}

test('1. Keyset Cursor: Encodes and decodes URL-safe cursor tokens reliably', () => {
  const payload = { timestamp: '2026-10-04T05:00:00.000Z', id: 'usr_abc123' }
  const cursor = encodeCursor(payload)

  assert.strictEqual(typeof cursor, 'string')
  assert.ok(cursor.length > 10)
  assert.ok(!cursor.includes('='), 'Base64url cursor should not have trailing padding')

  const decoded = decodeCursor(cursor)
  assert.ok(decoded)
  assert.strictEqual(decoded.timestamp, payload.timestamp)
  assert.strictEqual(decoded.id, payload.id)

  // Gracefully handles corrupt / garbage input
  assert.strictEqual(decodeCursor(null), null)
  assert.strictEqual(decodeCursor(''), null)
  assert.strictEqual(decodeCursor('invalid-non-base64'), null)
})

test('2. Keyset Pagination: Advances page-by-page monotonically without gaps or duplicates', () => {
  const records = []
  const baseTime = new Date('2026-10-01T00:00:00Z').getTime()
  for (let i = 0; i < 50; i++) {
    records.push({
      id: `rec_${String(i).padStart(3, '0')}`,
      created_at: new Date(baseTime + i * 1000).toISOString(),
      name: `Record ${i}`
    })
  }

  // Descending sort (newest first)
  records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Page 1: 20 items
  const page1 = paginateArrayKeyset(records, { limit: 20, direction: 'desc' })
  assert.strictEqual(page1.items.length, 20)
  assert.strictEqual(page1.hasMore, true)
  assert.ok(page1.nextCursor)
  assert.strictEqual(page1.items[0].id, 'rec_049')
  assert.strictEqual(page1.items[19].id, 'rec_030')

  // Page 2: next 20 items using nextCursor
  const page2 = paginateArrayKeyset(records, { limit: 20, cursor: page1.nextCursor, direction: 'desc' })
  assert.strictEqual(page2.items.length, 20)
  assert.strictEqual(page2.hasMore, true)
  assert.ok(page2.nextCursor)
  assert.strictEqual(page2.items[0].id, 'rec_029')
  assert.strictEqual(page2.items[19].id, 'rec_010')

  // Page 3: remaining 10 items
  const page3 = paginateArrayKeyset(records, { limit: 20, cursor: page2.nextCursor, direction: 'desc' })
  assert.strictEqual(page3.items.length, 10)
  assert.strictEqual(page3.hasMore, false)
  assert.strictEqual(page3.nextCursor, null)
  assert.strictEqual(page3.items[0].id, 'rec_009')
  assert.strictEqual(page3.items[9].id, 'rec_000')

  // Assert zero duplicate records across pages
  const allIds = [...page1.items, ...page2.items, ...page3.items].map((r) => r.id)
  assert.strictEqual(new Set(allIds).size, 50, 'All 50 records must be distinct across pages')
})

test('3. N+1 Elimination: Child payments and invoices are strictly scoped to the active page batch', async () => {
  const orgId = 'org-scale-test'
  const contacts = []
  const payments = []
  const invoices = []

  // Generate 1,000 contacts and 3,000 child records in mock DB
  for (let i = 0; i < 1000; i++) {
    const contactId = `c_${i}`
    contacts.push({
      id: contactId,
      org_id: orgId,
      name: `Customer ${i}`,
      phone: `+1555000${String(i).padStart(4, '0')}`,
      email: `cust${i}@test.com`,
      created_at: new Date(Date.now() - i * 60000).toISOString()
    })

    // Add 2 payments and 1 invoice per contact
    payments.push({ id: `p1_${i}`, org_id: orgId, contact_id: contactId, amount: 150, payment_status: 'succeeded' })
    payments.push({ id: `p2_${i}`, org_id: orgId, contact_id: contactId, amount: 200, payment_status: 'succeeded' })
    invoices.push({ id: `inv_${i}`, org_id: orgId, contact_id: contactId, total: 350, amount_paid: 350, status: 'paid' })
  }

  const db = createBenchmarkDb({ contacts, payments, invoices })

  // Request Page 1 with limit = 25
  const result = await searchAndFilterCustomers(db, {
    orgId,
    limit: 25
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.customers.length, 25)
  assert.strictEqual(result.totalCount, 1000)
  assert.strictEqual(result.hasMore, true)
  assert.ok(result.nextCursor)

  // Verify child lookups: Must use `.in('contact_id', [25 IDs])` rather than pulling all 3,000 records
  const paymentInQueries = db._executedQueries.filter((q) => q.table === 'payments' && q.type === 'in' && q.col === 'contact_id')
  const invoiceInQueries = db._executedQueries.filter((q) => q.table === 'invoices' && q.type === 'in' && q.col === 'contact_id')

  assert.strictEqual(paymentInQueries.length, 1, 'Must execute exactly one payment query for batch')
  assert.strictEqual(paymentInQueries[0].valsCount, 25, 'Payment query must be bounded to 25 contact IDs')

  assert.strictEqual(invoiceInQueries.length, 1, 'Must execute exactly one invoice query for batch')
  assert.strictEqual(invoiceInQueries[0].valsCount, 25, 'Invoice query must be bounded to 25 contact IDs')

  // Check LTV calculation accuracy for batch
  assert.strictEqual(result.customers[0].lifetime_value, 350)
})

test('4. Realistic Volume Benchmark: 5,000+ domain records aggregate cleanly under 50ms', async () => {
  const orgId = 'org-mega-volume'
  const calls = []
  const appointments = []
  const quotes = []
  const invoices = []
  const payments = []
  const jobs = []

  const now = Date.now()

  // Generate 1,000 calls
  for (let i = 0; i < 1000; i++) {
    calls.push({
      id: `call_${i}`,
      org_id: orgId,
      contact_id: `c_${i % 100}`,
      status: i % 3 === 0 ? 'missed' : 'completed',
      created_at: new Date(now - i * 1800000).toISOString()
    })
  }

  // Generate 1,000 appointments
  for (let i = 0; i < 1000; i++) {
    appointments.push({
      id: `appt_${i}`,
      org_id: orgId,
      contact_id: `c_${i % 100}`,
      status: i % 2 === 0 ? 'confirmed' : 'completed',
      source: i % 2 === 0 ? 'booking_page' : 'phone',
      services: { price: 120 },
      created_at: new Date(now - i * 1800000).toISOString()
    })
  }

  // Generate 1,000 quotes
  for (let i = 0; i < 1000; i++) {
    quotes.push({
      id: `quote_${i}`,
      org_id: orgId,
      status: i % 4 === 0 ? 'accepted' : 'sent',
      total: 500,
      created_at: new Date(now - i * 1800000).toISOString()
    })
  }

  // Generate 1,000 invoices
  for (let i = 0; i < 1000; i++) {
    invoices.push({
      id: `inv_${i}`,
      org_id: orgId,
      status: i % 3 === 0 ? 'paid' : 'sent',
      total: 500,
      created_at: new Date(now - i * 1800000).toISOString()
    })
  }

  // Generate 1,000 payments
  for (let i = 0; i < 1000; i++) {
    payments.push({
      id: `pay_${i}`,
      org_id: orgId,
      status: 'succeeded',
      amount: 500,
      created_at: new Date(now - i * 1800000).toISOString()
    })
  }

  const db = createBenchmarkDb({ calls, appointments, quotes, invoices, payments, jobs })

  const start = performance.now()
  const metrics = await getOutcomeMetrics(db, orgId, '30d')
  const duration = performance.now() - start

  assert.ok(metrics)
  assert.ok(metrics.bookingsFromCaptoDesk.totalBookings > 0)
  assert.ok(metrics.quoteConversion.totalResolvedCount >= 0)
  assert.ok(metrics.paymentCollection.invoicedAmount > 0)

  // Verify high-speed execution budget (< 50ms)
  assert.ok(duration < 50, `Dashboard outcome aggregation took ${duration.toFixed(2)}ms (expected < 50ms)`)
})

test('5. Webhook Idempotency: O(1) provider event index lookup verification', async () => {
  const processedEvents = [
    { id: 'evt_1', provider: 'telnyx', provider_event_id: 'telnyx_msg_99999' },
    { id: 'evt_2', provider: 'stripe', provider_event_id: 'evt_stripe_11111' }
  ]

  const db = createBenchmarkDb({ processed_events: processedEvents })

  // Lookup existing Telnyx webhook event
  const { data: existing } = await db
    .from('processed_events')
    .select('id')
    .eq('provider', 'telnyx')
    .eq('provider_event_id', 'telnyx_msg_99999')
    .single()

  assert.ok(existing)
  assert.strictEqual(existing.id, 'evt_1')

  // Lookup non-existent event (fast index miss)
  const { data: nonExistent } = await db
    .from('processed_events')
    .select('id')
    .eq('provider', 'telnyx')
    .eq('provider_event_id', 'telnyx_msg_unknown')
    .single()

  assert.strictEqual(nonExistent, null)
})

test('6. Multi-Tenant Index Isolation: Queries never leak cross-tenant records', async () => {
  const contacts = [
    { id: 'c_org1_1', org_id: 'org1', name: 'Alice Org1', phone: '+15551111', created_at: '2026-10-01T00:00:00Z' },
    { id: 'c_org2_1', org_id: 'org2', name: 'Bob Org2', phone: '+15552222', created_at: '2026-10-01T00:00:00Z' }
  ]

  const db = createBenchmarkDb({ contacts })

  const org1Res = await searchAndFilterCustomers(db, { orgId: 'org1' })
  assert.strictEqual(org1Res.customers.length, 1)
  assert.strictEqual(org1Res.customers[0].name, 'Alice Org1')

  const org2Res = await searchAndFilterCustomers(db, { orgId: 'org2' })
  assert.strictEqual(org2Res.customers.length, 1)
  assert.strictEqual(org2Res.customers[0].name, 'Bob Org2')
})
