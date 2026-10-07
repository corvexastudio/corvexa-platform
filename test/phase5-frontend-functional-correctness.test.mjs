import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// 1. Inbox Pagination Service Import
import { fetchConversationMessagesPaginated } from '../src/lib/services/sms-handler.ts'

// 2. Dashboard Honesty & Soft Delete Imports
import {
  getAttentionQueue,
  getOutcomeMetrics,
  getOperationalMetrics
} from '../src/lib/dashboard/dashboard-service.ts'

// 3. Jobs Manager Imports
import { createJob } from '../src/lib/jobs/job-manager.ts'

// 4. Invoicing & Payment Imports
import { recordPayment, createInvoice } from '../src/lib/payments/invoice-manager.ts'

// Mock Supabase Factory for Phase 5
function createMockSupabase(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    contacts: initialState.contacts || [],
    quotes: initialState.quotes || [],
    quote_items: initialState.quote_items || [],
    invoices: initialState.invoices || [],
    invoice_items: initialState.invoice_items || [],
    jobs: initialState.jobs || [],
    job_items: initialState.job_items || [],
    messages: initialState.messages || [],
    payments: initialState.payments || [],
    leads: initialState.leads || [],
    calls: initialState.calls || [],
    appointments: initialState.appointments || [],
    audit_logs: initialState.audit_logs || [],
    automation_runs: initialState.automation_runs || [],
    profiles: initialState.profiles || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []
      let selectedCols = '*'
      let orderBy = null
      let limitCount = null

      const qb = {
        select: (cols) => {
          selectedCols = cols
          return qb
        },
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return qb
        },
        neq: (col, val) => {
          filters.push((row) => row[col] !== val)
          return qb
        },
        or: (_cond) => {
          return qb
        },
        is: (col, val) => {
          filters.push((row) => (val === null ? row[col] === null || row[col] === undefined : row[col] === val))
          return qb
        },
        not: (col, operator, val) => {
          if (operator === 'is' && val === null) {
            filters.push((row) => row[col] !== null && row[col] !== undefined)
          }
          return qb
        },
        in: (col, arr) => {
          filters.push((row) => arr.includes(row[col]))
          return qb
        },
        lte: (col, val) => {
          filters.push((row) => row[col] <= val)
          return qb
        },
        gte: (col, val) => {
          filters.push((row) => row[col] >= val)
          return qb
        },
        lt: (col, val) => {
          filters.push((row) => row[col] < val)
          return qb
        },
        gt: (col, val) => {
          filters.push((row) => row[col] > val)
          return qb
        },
        order: (col, { ascending } = { ascending: true }) => {
          orderBy = { col, ascending }
          return qb
        },
        limit: (n) => {
          limitCount = n
          return qb
        },
        range: (from, to) => {
          limitCount = to - from + 1
          return qb
        },
        single: async () => {
          const list = tables[tableName] || []
          let filtered = list.filter((row) => filters.every((fn) => fn(row)))
          if (filtered.length === 0) {
            return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
          }
          return { data: { ...filtered[0] }, error: null }
        },
        maybeSingle: async () => {
          const list = tables[tableName] || []
          let filtered = list.filter((row) => filters.every((fn) => fn(row)))
          return { data: filtered.length > 0 ? { ...filtered[0] } : null, error: null }
        },
        then: (resolve, reject) => {
          const list = tables[tableName] || []
          let filtered = list.filter((row) => filters.every((fn) => fn(row)))
          if (orderBy) {
            filtered.sort((a, b) => {
              const valA = a[orderBy.col]
              const valB = b[orderBy.col]
              if (valA < valB) return orderBy.ascending ? -1 : 1
              if (valA > valB) return orderBy.ascending ? 1 : -1
              return 0
            })
          }
          if (limitCount !== null) {
            filtered = filtered.slice(0, limitCount)
          }
          const cloned = filtered.map((r) => ({ ...r }))
          return Promise.resolve({ data: cloned, error: null }).then(resolve, reject)
        },
        insert: (data) => {
          const list = tables[tableName] || []
          const rowsToInsert = Array.isArray(data) ? data : [data]
          const inserted = rowsToInsert.map((item, idx) => ({
            id: item.id || `mock-${tableName}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
            ...item
          }))
          list.push(...inserted)

          return {
            select: () => ({
              single: async () => ({ data: { ...inserted[0] }, error: null }),
              then: (resolve, reject) => Promise.resolve({ data: inserted.map(r => ({ ...r })), error: null }).then(resolve, reject)
            }),
            then: (resolve, reject) => Promise.resolve({ data: inserted.map(r => ({ ...r })), error: null }).then(resolve, reject)
          }
        },
        update: (updates) => {
          const runUpdate = () => {
            const list = tables[tableName] || []
            let matched = []
            list.forEach((row) => {
              if (filters.every((fn) => fn(row))) {
                Object.assign(row, updates)
                matched.push(row)
              }
            })
            return matched
          }

          const updateChain = {
            eq: (col, val) => {
              filters.push((row) => row[col] === val)
              return updateChain
            },
            neq: (col, val) => {
              filters.push((row) => row[col] !== val)
              return updateChain
            },
            in: (col, arr) => {
              filters.push((row) => arr.includes(row[col]))
              return updateChain
            },
            select: () => ({
              single: async () => {
                const matched = runUpdate()
                return { data: matched.length > 0 ? { ...matched[0] } : null, error: null }
              },
              then: (resolve, reject) => {
                const matched = runUpdate()
                return Promise.resolve({ data: matched.map(r => ({ ...r })), error: null }).then(resolve, reject)
              }
            }),
            then: (resolve, reject) => {
              const matched = runUpdate()
              return Promise.resolve({ data: matched.length, error: null }).then(resolve, reject)
            }
          }

          return updateChain
        }
      }

      return qb
    }
  }

  return client
}

// ==============================================================================
// 1. INVENTORY ALL MOCK/SIMULATED BEHAVIOR: BROWSER ALERTS ELIMINATED
// ==============================================================================
test('Client Code Audit: All client application pages avoid browser alert() calls', () => {
  const clientDir = path.resolve(process.cwd(), 'src/app/client')
  
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const alertViolations = []

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        alertViolations.push(...scanDir(fullPath))
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
        const content = fs.readFileSync(fullPath, 'utf8')
        // Match alert("...") or alert('...') but ignore alert_dialog, AlertCircle, AlertTriangle, etc.
        const alertCalls = content.match(/\balert\s*\([^)]*\)/g)
        if (alertCalls && alertCalls.length > 0) {
          alertViolations.push({ file: fullPath, matches: alertCalls })
        }
      }
    }
    return alertViolations
  }

  const violations = scanDir(clientDir)
  assert.equal(
    violations.length,
    0,
    `Found unhandled browser alert() calls in client directory: ${JSON.stringify(violations, null, 2)}`
  )
})

// ==============================================================================
// 2. INBOX PERFORMANCE & CURSOR PAGINATION (500+ MESSAGES)
// ==============================================================================
test('Inbox Cursor Pagination: Correctly handles 550+ messages with 50/page slices', async () => {
  // Generate 550 messages spanning 550 minutes chronologically
  const baseTime = new Date('2026-01-01T00:00:00.000Z').getTime()
  const totalMessages = 550
  const mockMessages = []

  for (let i = 0; i < totalMessages; i++) {
    const timeIso = new Date(baseTime + i * 60000).toISOString()
    mockMessages.push({
      id: `msg-${i}`,
      org_id: 'org-test',
      conversation_id: 'conv-123',
      direction: i % 2 === 0 ? 'inbound' : 'outbound',
      body: `Message index ${i} at ${timeIso}`,
      created_at: timeIso
    })
  }

  const mockSupabase = createMockSupabase({ messages: mockMessages })

  // 1. Initial Page Load: fetches latest 50 messages
  const page1 = await fetchConversationMessagesPaginated(mockSupabase, {
    conversationId: 'conv-123',
    limit: 50
  })

  assert.equal(page1.count, 50)
  assert.equal(page1.messages.length, 50)
  assert.equal(page1.hasMore, true)
  // Oldest in page 1 is index 500, newest is index 549
  assert.equal(page1.messages[0].id, 'msg-500')
  assert.equal(page1.messages[49].id, 'msg-549')
  assert.equal(page1.oldestCursor, page1.messages[0].created_at)
  assert.equal(page1.newestCursor, page1.messages[49].created_at)

  // Chronological order verification (oldest to newest)
  for (let i = 1; i < page1.messages.length; i++) {
    const prev = new Date(page1.messages[i - 1].created_at).getTime()
    const curr = new Date(page1.messages[i].created_at).getTime()
    assert.ok(curr > prev, `Messages must be sorted in ascending order: ${curr} > ${prev}`)
  }

  // 2. Load Older Messages: paginate backwards using beforeCursor
  const page2 = await fetchConversationMessagesPaginated(mockSupabase, {
    conversationId: 'conv-123',
    limit: 50,
    beforeCursor: page1.oldestCursor
  })

  assert.equal(page2.count, 50)
  assert.equal(page2.hasMore, true)
  // Older messages slice: index 450 to 499
  assert.equal(page2.messages[0].id, 'msg-450')
  assert.equal(page2.messages[49].id, 'msg-499')
  assert.ok(
    new Date(page2.newestCursor).getTime() < new Date(page1.oldestCursor).getTime(),
    'Page 2 messages must precede Page 1 messages'
  )

  // 3. Paginate all the way to the beginning of the 550 messages
  let currentOldest = page1.oldestCursor
  let retrievedCount = page1.count
  let pageIterations = 1

  while (true) {
    const nextPage = await fetchConversationMessagesPaginated(mockSupabase, {
      conversationId: 'conv-123',
      limit: 50,
      beforeCursor: currentOldest
    })

    retrievedCount += nextPage.count
    pageIterations++
    currentOldest = nextPage.oldestCursor

    if (!nextPage.hasMore) {
      break
    }
  }

  // All 550 messages retrieved across 11 pages of 50
  assert.equal(retrievedCount, totalMessages)
  assert.equal(pageIterations, 11)
})

test('Inbox Cursor Pagination: Handles edge cases (empty thread, small thread, db error)', async () => {
  const mockSupabase = createMockSupabase({ messages: [] })

  // Empty conversation
  const emptyRes = await fetchConversationMessagesPaginated(mockSupabase, {
    conversationId: 'conv-empty',
    limit: 50
  })
  assert.equal(emptyRes.count, 0)
  assert.equal(emptyRes.messages.length, 0)
  assert.equal(emptyRes.hasMore, false)
  assert.equal(emptyRes.oldestCursor, null)
  assert.equal(emptyRes.newestCursor, null)

  // Small conversation (10 messages < 50 limit)
  const smallThread = Array.from({ length: 10 }, (_, i) => ({
    id: `small-${i}`,
    conversation_id: 'conv-small',
    created_at: new Date(Date.now() + i * 1000).toISOString()
  }))
  const smallDb = createMockSupabase({ messages: smallThread })

  const smallRes = await fetchConversationMessagesPaginated(smallDb, {
    conversationId: 'conv-small',
    limit: 50
  })
  assert.equal(smallRes.count, 10)
  assert.equal(smallRes.hasMore, false)

  // Faulty query returns empty safely without throwing
  const errorDb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({ data: null, error: { message: 'Database connection failed' } })
          })
        })
      })
    })
  }
  const errorRes = await fetchConversationMessagesPaginated(errorDb, {
    conversationId: 'conv-err'
  })
  assert.equal(errorRes.count, 0)
  assert.equal(errorRes.hasMore, false)
})

// ==============================================================================
// 3. DASHBOARD DATA HONESTY: SOFT-DELETE RECORD FILTERING
// ==============================================================================
test('Dashboard Service: getAttentionQueue strictly excludes soft-deleted records', async () => {
  const now = new Date()
  const nowIso = now.toISOString()
  const pastDate = new Date(Date.now() - 5 * 86400000).toISOString()
  const in24h = new Date(Date.now() + 24 * 3600 * 1000).toISOString()

  const orgId = 'org-honest-dash'
  const mockDb = createMockSupabase({
    quotes: [
      // Active pending quote (expiring soon attention item)
      { id: 'q-active', quote_number: 'Q-1001', org_id: orgId, status: 'sent', total: 500, expires_at: in24h, updated_at: pastDate, deleted_at: null },
      // Soft-deleted quote (should NOT be counted in attention queue)
      { id: 'q-deleted', quote_number: 'Q-1002', org_id: orgId, status: 'sent', total: 1000, expires_at: in24h, updated_at: pastDate, deleted_at: nowIso }
    ],
    invoices: [
      // Active overdue invoice (attention item)
      { id: 'inv-active', invoice_number: 'INV-1001', org_id: orgId, status: 'overdue', amount_due: 350, due_date: pastDate, deleted_at: null },
      // Soft-deleted invoice (should NOT be counted in attention queue)
      { id: 'inv-deleted', invoice_number: 'INV-1002', org_id: orgId, status: 'overdue', amount_due: 1200, due_date: pastDate, deleted_at: nowIso }
    ],
    leads: [
      // Active lead with active contact
      { id: 'lead-active', org_id: orgId, status: 'new', contact_id: 'c-active', contacts: { id: 'c-active', name: 'Alice Active', deleted_at: null }, created_at: nowIso },
      // Lead with soft-deleted contact
      { id: 'lead-deleted-contact', org_id: orgId, status: 'new', contact_id: 'c-deleted', contacts: { id: 'c-deleted', name: 'Bob Deleted', deleted_at: nowIso }, created_at: nowIso }
    ],
    contacts: [
      { id: 'c-active', org_id: orgId, name: 'Alice Active', phone: '+15551112222', deleted_at: null },
      { id: 'c-deleted', org_id: orgId, name: 'Bob Deleted', phone: '+15553334444', deleted_at: nowIso }
    ]
  })

  const queue = await getAttentionQueue(mockDb, orgId)

  // Verify quotes attention
  const quoteItems = queue.filter(item => item.category === 'quote')
  assert.equal(quoteItems.length, 1, 'Only non-deleted quotes should be in attention queue')
  assert.equal(quoteItems[0].id, 'quote-q-active')

  // Verify invoices attention
  const invoiceItems = queue.filter(item => item.category === 'invoice')
  assert.equal(invoiceItems.length, 1, 'Only non-deleted invoices should be in attention queue')
  assert.equal(invoiceItems[0].id, 'inv-inv-active')

  // Verify lead attention
  const leadItems = queue.filter(item => item.category === 'lead')
  assert.equal(leadItems.length, 1, 'Leads with deleted contacts should not appear in attention queue')
  assert.equal(leadItems[0].id, 'lead-lead-active')
})

test('Dashboard Service: getOutcomeMetrics and getOperationalMetrics exclude soft-deleted records', async () => {
  const orgId = 'org-honest-metrics'
  const today = new Date().toISOString()

  const mockDb = createMockSupabase({
    invoices: [
      { id: 'inv-paid-1', org_id: orgId, status: 'paid', total: 300, amount_paid: 300, created_at: today, deleted_at: null },
      { id: 'inv-paid-deleted', org_id: orgId, status: 'paid', total: 700, amount_paid: 700, created_at: today, deleted_at: today }
    ],
    jobs: [
      { id: 'job-active-1', org_id: orgId, status: 'completed', scheduled_start: today, deleted_at: null },
      { id: 'job-deleted-1', org_id: orgId, status: 'completed', scheduled_start: today, deleted_at: today }
    ],
    calls: []
  })

  // 1. Outcome metrics: collected revenue should only sum active invoice ($300, not $1000)
  const outcomes = await getOutcomeMetrics(mockDb, orgId, 'all')
  assert.equal(outcomes.paymentCollection.collectedAmount, 300, 'Collected revenue must exclude soft-deleted invoices')

  // 2. Operational metrics: jobs today should only count active job (1, not 2)
  const ops = await getOperationalMetrics(mockDb, orgId, 'all')
  assert.equal(ops.jobsToday, 1, 'Jobs today must exclude soft-deleted jobs')
})

// ==============================================================================
// 4. PRIMARY ACTIONS: JOB CREATION & INVOICE OFFLINE PAYMENT
// ==============================================================================
test('Primary Actions: createJob creates scheduled job with line items and validation', async () => {
  const orgId = 'org-job-test'
  const mockDb = createMockSupabase({
    contacts: [{ id: 'cust-1', org_id: orgId, name: 'John Doe', phone: '+15554443333' }]
  })

  // Validation failure: missing title
  const invalidRes = await createJob(mockDb, {
    orgId,
    contactId: 'cust-1',
    title: '',
    scheduledStart: new Date().toISOString()
  })
  assert.equal(invalidRes.success, false)
  assert.match(invalidRes.error, /Job title is required/i)

  // Success: valid job creation
  const validRes = await createJob(mockDb, {
    orgId,
    contactId: 'cust-1',
    title: 'AC Tune Up & Filter Replacement',
    description: 'Annual HVAC maintenance check',
    scheduledStart: '2026-06-15T14:00:00.000Z',
    scheduledEnd: '2026-06-15T16:00:00.000Z',
    items: [
      { description: 'Filter replacement', quantity: 2, unitPrice: 25 },
      { description: 'Labor fee', quantity: 1, unitPrice: 120 }
    ]
  })

  assert.equal(validRes.success, true)
  assert.ok(validRes.job)
  assert.equal(validRes.job.title, 'AC Tune Up & Filter Replacement')
  assert.equal(validRes.job.status, 'scheduled')
  assert.equal(validRes.job.org_id, orgId)
  assert.equal(validRes.job.contact_id, 'cust-1')

  // Verify in mock DB
  const storedJob = mockDb._tables.jobs.find(j => j.id === validRes.job.id)
  assert.ok(storedJob)
  assert.equal(storedJob.deleted_at ?? null, null)

  const storedItems = mockDb._tables.job_items.filter(it => it.job_id === validRes.job.id)
  assert.equal(storedItems.length, 2)
  assert.equal(storedItems[0].description, 'Filter replacement')
})

test('Primary Actions: recordPayment handles offline cash/check payments and settles balance', async () => {
  const orgId = 'org-pay-test'
  const invoiceId = 'inv-test-pay'

  const mockDb = createMockSupabase({
    invoices: [
      {
        id: invoiceId,
        org_id: orgId,
        total: 250,
        amount_paid: 0,
        amount_due: 250,
        status: 'sent',
        deleted_at: null
      }
    ]
  })

  // Validation failure: zero payment amount
  const zeroPayment = await recordPayment(mockDb, {
    invoiceId,
    orgId,
    amount: 0,
    paymentMethod: 'cash'
  })
  assert.equal(zeroPayment.success, false)
  assert.match(zeroPayment.error, /Payment amount must be greater than zero/i)

  // Success: record full offline payment
  const payRes = await recordPayment(mockDb, {
    invoiceId,
    orgId,
    amount: 250,
    paymentMethod: 'cash',
    referenceNote: 'Paid in cash upon job completion'
  })

  assert.equal(payRes.success, true)

  // Verify invoice transitioned to paid and amount_paid updated
  const updatedInv = mockDb._tables.invoices.find(i => i.id === invoiceId)
  assert.ok(updatedInv)
  assert.equal(updatedInv.amount_paid, 250)
  assert.equal(updatedInv.amount_due, 0)
  assert.equal(updatedInv.status, 'paid')

  // Verify payment record logged
  const recordedPayment = mockDb._tables.payments.find(p => p.invoice_id === invoiceId)
  assert.ok(recordedPayment)
  assert.equal(recordedPayment.amount, 250)
  assert.equal(recordedPayment.payment_method, 'cash')
})
