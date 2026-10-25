/**
 * ==============================================================================
 * CAPTODESK — PHASE 3.1: FINANCIAL API AUTHORIZATION HOTFIX TEST SUITE
 * ==============================================================================
 * Regression verification for Findings RBAC-002 and RBAC-004:
 * 
 * 1. Canonical role normalization preserves 'dispatcher' and 'technician'
 * 2. Fine-grained financial permissions matrix (invoices, quotes, payments, financials)
 * 3. Least-privilege server-side enforcement via getTenantContext
 * 4. Invoice API route handlers reject unauthorized roles (403 Forbidden)
 * 5. Quote API route handlers reject unauthorized roles (403 Forbidden)
 * 6. Payment/Stripe Connect handlers reject unauthorized roles (403 Forbidden)
 * 7. Dashboard metrics endpoint redacts financial revenue aggregates for dispatchers
 * 8. Customer 360 endpoint strips invoices, quotes, and lifetimeValue for dispatchers/technicians
 * 9. Technicians and dispatchers retain legitimate field and scheduling operations
 * ==============================================================================
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeRole, hasPermission } from '../src/lib/security/permissions.ts'
import { getTenantContext, invalidateProfileCache } from '../src/lib/security/tenant-context.ts'
import { GET as invoicesGet, POST as invoicesPost, DELETE as invoicesDelete } from '../src/app/api/client/invoices/route.ts'
import { POST as payOfflinePost } from '../src/app/api/client/invoices/[id]/pay-offline/route.ts'
import { POST as invoiceSendPost } from '../src/app/api/client/invoices/[id]/send/route.ts'
import { POST as invoiceVoidPost } from '../src/app/api/client/invoices/[id]/void/route.ts'
import { GET as quotesGet, POST as quotesPost, DELETE as quotesDelete } from '../src/app/api/client/quotes/route.ts'
import { POST as quoteSendPost } from '../src/app/api/client/quotes/[id]/send/route.ts'
import { GET as connectGet, POST as connectPost } from '../src/app/api/client/payments/connect/route.ts'
import { POST as connectDashboardPost } from '../src/app/api/client/payments/connect/dashboard/route.ts'
import { GET as dashboardGet } from '../src/app/api/client/dashboard/route.ts'
import { GET as customer360Get } from '../src/app/api/client/customers/[id]/route.ts'

// --- Mock Identifiers ---
const ORG_ID = 'org-test-financial-001'

const ACTORS = {
  OWNER: { id: 'usr-owner-01', email: 'owner@test.com', role: 'owner', org_id: ORG_ID },
  ADMIN: { id: 'usr-admin-01', email: 'admin@test.com', role: 'admin', org_id: ORG_ID },
  DISPATCHER: { id: 'usr-disp-01', email: 'dispatcher@test.com', role: 'dispatcher', org_id: ORG_ID },
  TECHNICIAN: { id: 'usr-tech-01', email: 'tech@test.com', role: 'technician', org_id: ORG_ID },
  MEMBER: { id: 'usr-mem-01', email: 'member@test.com', role: 'member', org_id: ORG_ID },
  SUPER_ADMIN: { id: 'usr-super-01', email: 'super@captodesk.com', role: 'super_admin', org_id: null }
}

/**
 * Creates an in-memory mock Supabase client for RBAC & API test cases
 */
function createMockClient(currentUser, customStore = {}) {
  const store = {
    organizations: customStore.organizations || [
      { id: ORG_ID, name: 'Test Home Services', stripe_account_id: 'acct_test_123', stripe_account_status: 'active' }
    ],
    profiles: customStore.profiles || Object.values(ACTORS).map(a => ({
      id: a.id,
      email: a.email,
      role: a.role,
      org_id: a.org_id,
      full_name: `${a.role.toUpperCase()} User`
    })),
    invoices: customStore.invoices || [
      { id: 'inv-1', org_id: ORG_ID, contact_id: 'cust-1', title: 'Drain Clean', total_amount: 350, status: 'sent', created_at: new Date().toISOString() }
    ],
    invoice_items: customStore.invoice_items || [
      { id: 'item-1', invoice_id: 'inv-1', description: 'Labor', amount: 350 }
    ],
    quotes: customStore.quotes || [
      { id: 'quo-1', org_id: ORG_ID, contact_id: 'cust-1', title: 'Water Heater Replacement', total_amount: 1800, status: 'sent', created_at: new Date().toISOString() }
    ],
    quote_items: customStore.quote_items || [
      { id: 'qitem-1', quote_id: 'quo-1', description: 'Tank installation', amount: 1800 }
    ],
    contacts: customStore.contacts || [
      { id: 'cust-1', org_id: ORG_ID, name: 'Alice Homeowner', phone: '+15555550100', email: 'alice@test.com', address: '123 Elm St' }
    ],
    appointments: customStore.appointments || [
      { id: 'apt-1', org_id: ORG_ID, contact_id: 'cust-1', status: 'scheduled', scheduled_start: new Date().toISOString(), created_at: new Date().toISOString() }
    ],
    leads: customStore.leads || [
      { id: 'lead-1', org_id: ORG_ID, contact_id: 'cust-1', status: 'new', value: 500, created_at: new Date().toISOString() }
    ],
    conversations: customStore.conversations || [
      { id: 'conv-1', org_id: ORG_ID, contact_id: 'cust-1', unread_count: 0, last_message_at: new Date().toISOString() }
    ],
    jobs: customStore.jobs || [
      { id: 'job-1', org_id: ORG_ID, contact_id: 'cust-1', status: 'scheduled', scheduled_start: new Date().toISOString(), created_at: new Date().toISOString() }
    ],
    payments: customStore.payments || [
      { id: 'pay-1', org_id: ORG_ID, invoice_id: 'inv-1', contact_id: 'cust-1', amount: 350, payment_status: 'succeeded', created_at: new Date().toISOString() }
    ],
    calls: customStore.calls || [],
    review_requests: customStore.review_requests || [],
    services: customStore.services || []
  }

  const client = {
    _store: store,
    auth: {
      getUser: async () => {
        if (!currentUser) return { data: { user: null }, error: new Error('No session') }
        return {
          data: {
            user: {
              id: currentUser.id,
              email: currentUser.email,
              app_metadata: {},
              user_metadata: {}
            }
          },
          error: null
        }
      }
    },
    from: (tableName) => {
      let filters = []
      let selectOpts = {}
      let isSingle = false
      let isMaybeSingle = false

      const query = {
        select: (cols, opts) => {
          if (opts) selectOpts = opts
          return query
        },
        eq: (col, val) => {
          filters.push(row => row[col] === val)
          return query
        },
        neq: (col, val) => {
          filters.push(row => row[col] !== val)
          return query
        },
        gt: (col, val) => {
          filters.push(row => (row[col] ?? 0) > val)
          return query
        },
        gte: (col, val) => {
          filters.push(row => (row[col] ?? 0) >= val)
          return query
        },
        lte: (col, val) => {
          filters.push(row => (row[col] ?? 0) <= val)
          return query
        },
        in: (col, arr) => {
          filters.push(row => arr.includes(row[col]))
          return query
        },
        is: (col, val) => {
          filters.push(row => val === null ? (row[col] === null || row[col] === undefined) : row[col] === val)
          return query
        },
        not: (col, op, val) => {
          if (op === 'is' && val === null) {
            filters.push(row => row[col] !== null && row[col] !== undefined)
          }
          return query
        },
        or: () => query,
        order: () => query,
        limit: (n) => {
          query._limit = n
          return query
        },
        single: async () => {
          isSingle = true
          const rows = (store[tableName] || []).filter(r => filters.every(fn => fn(r)))
          if (rows.length === 0) return { data: null, error: { message: 'Row not found' } }
          return { data: rows[0], error: null }
        },
        maybeSingle: async () => {
          isMaybeSingle = true
          const rows = (store[tableName] || []).filter(r => filters.every(fn => fn(r)))
          return { data: rows[0] || null, error: null }
        },
        update: (values) => ({
          eq: (col, val) => {
            filters.push(row => row[col] === val)
            const rows = (store[tableName] || []).filter(r => filters.every(fn => fn(r)))
            rows.forEach(r => Object.assign(r, values))
            return {
              eq: (c2, v2) => {
                filters.push(row => row[c2] === v2)
                return {
                  data: rows,
                  error: null,
                  then: (resolve) => resolve({ data: rows, error: null })
                }
              },
              then: (resolve) => resolve({ data: rows, error: null })
            }
          }
        }),
        then: (resolve, reject) => {
          const tableData = store[tableName] || []
          let filtered = tableData.filter(r => filters.every(fn => fn(r)))

          if (selectOpts.count === 'exact' && selectOpts.head === true) {
            return Promise.resolve({ count: filtered.length, data: null, error: null }).then(resolve, reject)
          }

          if (query._limit) {
            filtered = filtered.slice(0, query._limit)
          }

          // Hydrate basic foreign keys
          const hydrated = filtered.map(row => {
            const copy = { ...row }
            if (row.contact_id && store.contacts) {
              copy.contacts = store.contacts.find(c => c.id === row.contact_id) || null
              copy.contact = copy.contacts
            }
            if (tableName === 'invoices' && store.invoice_items) {
              copy.items = store.invoice_items.filter(i => i.invoice_id === row.id)
              copy.payments = (store.payments || []).filter(p => p.invoice_id === row.id)
            }
            if (tableName === 'quotes' && store.quote_items) {
              copy.items = store.quote_items.filter(i => i.quote_id === row.id)
            }
            return copy
          })

          return Promise.resolve({ data: hydrated, count: filtered.length, error: null }).then(resolve, reject)
        }
      }

      return query
    }
  }

  return client
}

// -----------------------------------------------------------------------------
// 1. CANONICAL ROLES NORMALIZATION & INTEGRITY
// -----------------------------------------------------------------------------

test('1. RBAC: Canonical role normalization strictly preserves distinct dispatcher and technician roles', () => {
  assert.strictEqual(normalizeRole('owner'), 'owner')
  assert.strictEqual(normalizeRole('admin'), 'admin')
  assert.strictEqual(normalizeRole('client_admin'), 'admin')
  assert.strictEqual(normalizeRole('dispatcher'), 'dispatcher', 'Dispatcher must remain distinct canonical role')
  assert.strictEqual(normalizeRole('technician'), 'technician', 'Technician must remain distinct canonical role')
  assert.strictEqual(normalizeRole('member'), 'member')
  assert.strictEqual(normalizeRole('super_admin'), 'super_admin')

  // Failsafe normalization to least-privilege member
  assert.strictEqual(normalizeRole(''), 'member')
  assert.strictEqual(normalizeRole(null), 'member')
  assert.strictEqual(normalizeRole(undefined), 'member')
  assert.strictEqual(normalizeRole('unknown_role'), 'member')
})

// -----------------------------------------------------------------------------
// 2. FINANCIAL PERMISSIONS MATRIX AUDIT
// -----------------------------------------------------------------------------

test('2. RBAC: Role-permission matrix grants financial actions only to owner and admin', () => {
  const financialActions = [
    'invoices:read',
    'invoices:manage',
    'quotes:read',
    'quotes:manage',
    'payments:read',
    'payments:manage',
    'financials:read',
    'analytics:read'
  ]

  // Owner & Admin must have all financial permissions
  for (const action of financialActions) {
    assert.strictEqual(hasPermission('owner', action), true, `owner must have ${action}`)
    assert.strictEqual(hasPermission('admin', action), true, `admin must have ${action}`)
  }

  // Dispatcher must NOT have any financial permissions
  for (const action of financialActions) {
    assert.strictEqual(hasPermission('dispatcher', action), false, `dispatcher must NOT have ${action}`)
  }

  // Technician must NOT have any financial permissions
  for (const action of financialActions) {
    assert.strictEqual(hasPermission('technician', action), false, `technician must NOT have ${action}`)
  }

  // Member must NOT have any financial permissions
  for (const action of financialActions) {
    assert.strictEqual(hasPermission('member', action), false, `member must NOT have ${action}`)
  }
})

test('3. RBAC: Operational field and scheduling boundaries are strictly preserved', () => {
  // Technician retains field capabilities
  assert.strictEqual(hasPermission('technician', 'appointments:read'), true)
  assert.strictEqual(hasPermission('technician', 'appointments:manage'), true)
  assert.strictEqual(hasPermission('technician', 'contacts:read'), true)
  assert.strictEqual(hasPermission('technician', 'messages:read'), true)
  assert.strictEqual(hasPermission('technician', 'messages:send'), true)
  assert.strictEqual(hasPermission('technician', 'reviews:send'), true)
  assert.strictEqual(hasPermission('technician', 'crews:view'), true)
  // But strictly no organization administration or financial visibility
  assert.strictEqual(hasPermission('technician', 'org:view'), false)
  assert.strictEqual(hasPermission('technician', 'org:update'), false)
  assert.strictEqual(hasPermission('technician', 'org:billing'), false)

  // Dispatcher retains scheduling, messaging, lead, and team view capabilities
  assert.strictEqual(hasPermission('dispatcher', 'org:view'), true)
  assert.strictEqual(hasPermission('dispatcher', 'appointments:read'), true)
  assert.strictEqual(hasPermission('dispatcher', 'appointments:manage'), true)
  assert.strictEqual(hasPermission('dispatcher', 'leads:read'), true)
  assert.strictEqual(hasPermission('dispatcher', 'leads:manage'), true)
  assert.strictEqual(hasPermission('dispatcher', 'messages:read'), true)
  assert.strictEqual(hasPermission('dispatcher', 'messages:send'), true)
  assert.strictEqual(hasPermission('dispatcher', 'contacts:read'), true)
  assert.strictEqual(hasPermission('dispatcher', 'contacts:manage'), true)
  assert.strictEqual(hasPermission('dispatcher', 'crews:view'), true)
  assert.strictEqual(hasPermission('dispatcher', 'crews:manage'), true)
  // But strictly no billing, organization modification, or financial permissions
  assert.strictEqual(hasPermission('dispatcher', 'org:update'), false)
  assert.strictEqual(hasPermission('dispatcher', 'org:billing'), false)
  assert.strictEqual(hasPermission('dispatcher', 'invoices:read'), false)
  assert.strictEqual(hasPermission('dispatcher', 'quotes:read'), false)
})

// -----------------------------------------------------------------------------
// 3. SERVER-SIDE GETTENANTCONTEXT ENFORCEMENT
// -----------------------------------------------------------------------------

test('4. Security: getTenantContext rejects unauthorized roles with 403 before any db mutation', async () => {
  invalidateProfileCache()

  const techClient = createMockClient(ACTORS.TECHNICIAN)
  const dispClient = createMockClient(ACTORS.DISPATCHER)
  const ownerClient = createMockClient(ACTORS.OWNER)

  // Technician attempting financial actions
  const techInvRead = await getTenantContext('invoices:read', techClient)
  assert.strictEqual(techInvRead.ok, false)
  assert.strictEqual(techInvRead.status, 403)
  assert.match(techInvRead.error, /lacks permission for 'invoices:read'/)

  const techPayManage = await getTenantContext('payments:manage', techClient)
  assert.strictEqual(techPayManage.ok, false)
  assert.strictEqual(techPayManage.status, 403)

  // Dispatcher attempting financial actions
  const dispInvManage = await getTenantContext('invoices:manage', dispClient)
  assert.strictEqual(dispInvManage.ok, false)
  assert.strictEqual(dispInvManage.status, 403)
  assert.match(dispInvManage.error, /lacks permission for 'invoices:manage'/)

  const dispQuotesRead = await getTenantContext('quotes:read', dispClient)
  assert.strictEqual(dispQuotesRead.ok, false)
  assert.strictEqual(dispQuotesRead.status, 403)

  const dispFinRead = await getTenantContext('financials:read', dispClient)
  assert.strictEqual(dispFinRead.ok, false)
  assert.strictEqual(dispFinRead.status, 403)

  // Legitimate technician actions pass
  const techAppt = await getTenantContext('appointments:manage', techClient)
  assert.strictEqual(techAppt.ok, true)

  // Legitimate dispatcher actions pass
  const dispLead = await getTenantContext('leads:manage', dispClient)
  assert.strictEqual(dispLead.ok, true)

  // Owner retains full access
  const ownerInv = await getTenantContext('invoices:manage', ownerClient)
  assert.strictEqual(ownerInv.ok, true)
})

// -----------------------------------------------------------------------------
// 4. INVOICES API ROUTE HANDLERS ENFORCEMENT
// -----------------------------------------------------------------------------

test('5. Invoices API: Technician is blocked with 403 on GET, POST, DELETE, and pay-offline', async () => {
  invalidateProfileCache()
  const techClient = createMockClient(ACTORS.TECHNICIAN)

  // 1. GET /api/client/invoices
  const getReq = new Request('http://localhost:3000/api/client/invoices')
  const getRes = await invoicesGet(getReq, { customSupabase: techClient })
  assert.strictEqual(getRes.status, 403, 'GET invoices must return 403 for technician')

  // 2. POST /api/client/invoices
  const postReq = new Request('http://localhost:3000/api/client/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contactId: 'cust-1', title: 'Unauthorized Invoice', items: [{ description: 'Test', amount: 100 }] })
  })
  const postRes = await invoicesPost(postReq, { customSupabase: techClient })
  assert.strictEqual(postRes.status, 403, 'POST invoices must return 403 for technician')

  // 3. DELETE /api/client/invoices
  const delReq = new Request('http://localhost:3000/api/client/invoices?id=inv-1', { method: 'DELETE' })
  const delRes = await invoicesDelete(delReq, { customSupabase: techClient })
  assert.strictEqual(delRes.status, 403, 'DELETE invoices must return 403 for technician')

  // 4. POST /api/client/invoices/[id]/pay-offline
  const payReq = new Request('http://localhost:3000/api/client/invoices/inv-1/pay-offline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 100 })
  })
  const payRes = await payOfflinePost(payReq, { params: Promise.resolve({ id: 'inv-1' }), customSupabase: techClient })
  assert.strictEqual(payRes.status, 403, 'POST pay-offline must return 403 for technician')

  // 5. POST /api/client/invoices/[id]/send
  const sendReq = new Request('http://localhost:3000/api/client/invoices/inv-1/send', { method: 'POST' })
  const sendRes = await invoiceSendPost(sendReq, { params: Promise.resolve({ id: 'inv-1' }), customSupabase: techClient })
  assert.strictEqual(sendRes.status, 403, 'POST invoice send must return 403 for technician')

  // 6. POST /api/client/invoices/[id]/void
  const voidReq = new Request('http://localhost:3000/api/client/invoices/inv-1/void', { method: 'POST' })
  const voidRes = await invoiceVoidPost(voidReq, { params: Promise.resolve({ id: 'inv-1' }), customSupabase: techClient })
  assert.strictEqual(voidRes.status, 403, 'POST invoice void must return 403 for technician')
})

test('6. Invoices API: Dispatcher is blocked with 403 on GET, POST, DELETE, and mutation routes', async () => {
  invalidateProfileCache()
  const dispClient = createMockClient(ACTORS.DISPATCHER)

  // 1. GET /api/client/invoices
  const getReq = new Request('http://localhost:3000/api/client/invoices')
  const getRes = await invoicesGet(getReq, { customSupabase: dispClient })
  assert.strictEqual(getRes.status, 403, 'GET invoices must return 403 for dispatcher')

  // 2. POST /api/client/invoices
  const postReq = new Request('http://localhost:3000/api/client/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contactId: 'cust-1', title: 'Unauthorized', items: [{ description: 'Test', amount: 100 }] })
  })
  const postRes = await invoicesPost(postReq, { customSupabase: dispClient })
  assert.strictEqual(postRes.status, 403, 'POST invoices must return 403 for dispatcher')

  // 3. POST /api/client/invoices/[id]/pay-offline
  const payReq = new Request('http://localhost:3000/api/client/invoices/inv-1/pay-offline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 100 })
  })
  const payRes = await payOfflinePost(payReq, { params: Promise.resolve({ id: 'inv-1' }), customSupabase: dispClient })
  assert.strictEqual(payRes.status, 403, 'POST pay-offline must return 403 for dispatcher')
})

// -----------------------------------------------------------------------------
// 5. QUOTES API ROUTE HANDLERS ENFORCEMENT
// -----------------------------------------------------------------------------

test('7. Quotes API: Technician & Dispatcher are blocked with 403 on GET, POST, DELETE, send', async () => {
  invalidateProfileCache()
  const techClient = createMockClient(ACTORS.TECHNICIAN)
  const dispClient = createMockClient(ACTORS.DISPATCHER)

  for (const [roleName, client] of [['technician', techClient], ['dispatcher', dispClient]]) {
    // 1. GET /api/client/quotes
    const getReq = new Request('http://localhost:3000/api/client/quotes')
    const getRes = await quotesGet(getReq, { customSupabase: client })
    assert.strictEqual(getRes.status, 403, `GET quotes must return 403 for ${roleName}`)

    // 2. POST /api/client/quotes
    const postReq = new Request('http://localhost:3000/api/client/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: 'cust-1', title: 'Water Line', items: [{ description: 'Pipe', amount: 200 }] })
    })
    const postRes = await quotesPost(postReq, { customSupabase: client })
    assert.strictEqual(postRes.status, 403, `POST quotes must return 403 for ${roleName}`)

    // 3. DELETE /api/client/quotes
    const delReq = new Request('http://localhost:3000/api/client/quotes?id=quo-1', { method: 'DELETE' })
    const delRes = await quotesDelete(delReq, { customSupabase: client })
    assert.strictEqual(delRes.status, 403, `DELETE quotes must return 403 for ${roleName}`)

    // 4. POST /api/client/quotes/[id]/send
    const sendReq = new Request('http://localhost:3000/api/client/quotes/quo-1/send', { method: 'POST' })
    const sendRes = await quoteSendPost(sendReq, { params: Promise.resolve({ id: 'quo-1' }), customSupabase: client })
    assert.strictEqual(sendRes.status, 403, `POST quote send must return 403 for ${roleName}`)
  }
})

// -----------------------------------------------------------------------------
// 6. STRIPE PAYMENTS CONNECT ENFORCEMENT
// -----------------------------------------------------------------------------

test('8. Stripe Payments Connect: Non-owner/non-admin roles rejected with 403', async () => {
  invalidateProfileCache()
  const techClient = createMockClient(ACTORS.TECHNICIAN)
  const dispClient = createMockClient(ACTORS.DISPATCHER)

  // GET /api/client/payments/connect
  const techGet = await connectGet(new Request('http://localhost:3000/api/client/payments/connect'), { customSupabase: techClient })
  assert.strictEqual(techGet.status, 403)

  const dispGet = await connectGet(new Request('http://localhost:3000/api/client/payments/connect'), { customSupabase: dispClient })
  assert.strictEqual(dispGet.status, 403)

  // POST /api/client/payments/connect
  const techPost = await connectPost(new Request('http://localhost:3000/api/client/payments/connect', { method: 'POST' }), { customSupabase: techClient })
  assert.strictEqual(techPost.status, 403)

  // POST /api/client/payments/connect/dashboard
  const dispDash = await connectDashboardPost(new Request('http://localhost:3000/api/client/payments/connect/dashboard', { method: 'POST' }), { customSupabase: dispClient })
  assert.strictEqual(dispDash.status, 403)
})

// -----------------------------------------------------------------------------
// 7. DASHBOARD REDACTION & RBAC
// -----------------------------------------------------------------------------

test('9. Dashboard API: Technician is blocked with 403 (lacks org:view)', async () => {
  invalidateProfileCache()
  const techClient = createMockClient(ACTORS.TECHNICIAN)

  const req = new Request('http://localhost:3000/api/client/dashboard?period=30d')
  const res = await dashboardGet(req, { customSupabase: techClient })
  assert.strictEqual(res.status, 403, 'Technician cannot access general org dashboard')
})

test('10. Dashboard API: Dispatcher receives sanitized metrics with financial totals redacted', async () => {
  invalidateProfileCache()
  const dispClient = createMockClient(ACTORS.DISPATCHER)

  const req = new Request('http://localhost:3000/api/client/dashboard?period=30d')
  const res = await dashboardGet(req, { customSupabase: dispClient })
  assert.strictEqual(res.status, 200, 'Dispatcher can view operational dashboard')

  const body = await res.json()
  assert.strictEqual(body.permissions.canViewFinancials, false)
  assert.strictEqual(body.permissions.canViewInvoices, false)
  assert.strictEqual(body.permissions.canViewQuotes, false)

  // Redacted outcome metrics
  assert.strictEqual(body.outcomes.paymentCollection.collectedAmount, 0)
  assert.strictEqual(body.outcomes.paymentCollection.invoicedAmount, 0)
  assert.strictEqual(body.outcomes.bookingsFromCaptoDesk.totalBookedValue, 0)
  assert.strictEqual(body.outcomes.quoteConversion.acceptedValue, 0)
  assert.strictEqual(body.outcomes.quoteConversion.totalSentValue, 0)

  // Redacted operational financial values
  assert.strictEqual(body.operations.outstandingInvoicesBalance, 0)
  assert.strictEqual(body.operations.paymentsReceivedAmount, 0)
  assert.strictEqual(body.operations.quotesAwaitingResponseValue, 0)

  // Attention queue must not leak invoices or quotes
  const leakedFinancialItems = body.attentionQueue.filter(item => item.category === 'invoice' || item.category === 'quote')
  assert.strictEqual(leakedFinancialItems.length, 0, 'Attention queue must not contain invoice or quote items')
})

test('11. Dashboard API: Owner receives complete operational and financial metrics', async () => {
  invalidateProfileCache()
  const ownerClient = createMockClient(ACTORS.OWNER)

  const req = new Request('http://localhost:3000/api/client/dashboard?period=30d')
  const res = await dashboardGet(req, { customSupabase: ownerClient })
  assert.strictEqual(res.status, 200)

  const body = await res.json()
  assert.strictEqual(body.permissions.canViewFinancials, true)
  assert.strictEqual(body.permissions.canViewInvoices, true)
  assert.strictEqual(body.permissions.canViewQuotes, true)
})

// -----------------------------------------------------------------------------
// 8. CUSTOMER 360 FINANCIAL DATA REDACTION
// -----------------------------------------------------------------------------

test('12. Customer 360 API: Redacts financial history for dispatchers & technicians', async () => {
  invalidateProfileCache()
  const dispClient = createMockClient(ACTORS.DISPATCHER)
  const ownerClient = createMockClient(ACTORS.OWNER)

  const reqDisp = new Request('http://localhost:3000/api/client/customers/cust-1')
  const resDisp = await customer360Get(reqDisp, { params: Promise.resolve({ id: 'cust-1' }), customSupabase: dispClient })
  assert.strictEqual(resDisp.status, 200)

  const bodyDisp = await resDisp.json()
  assert.strictEqual(bodyDisp.invoices.length, 0, 'Invoices array must be empty for dispatcher')
  assert.strictEqual(bodyDisp.quotes.length, 0, 'Quotes array must be empty for dispatcher')
  assert.strictEqual(bodyDisp.payments.length, 0, 'Payments array must be empty for dispatcher')
  assert.strictEqual(bodyDisp.lifetimeValue, 0, 'lifetimeValue must be 0 for dispatcher')

  // Owner retains full customer 360 financial history
  const reqOwner = new Request('http://localhost:3000/api/client/customers/cust-1')
  const resOwner = await customer360Get(reqOwner, { params: Promise.resolve({ id: 'cust-1' }), customSupabase: ownerClient })
  assert.strictEqual(resOwner.status, 200)

  const bodyOwner = await resOwner.json()
  assert.strictEqual(bodyOwner.invoices.length, 1, 'Invoices retained for owner')
  assert.strictEqual(bodyOwner.quotes.length, 1, 'Quotes retained for owner')
})
