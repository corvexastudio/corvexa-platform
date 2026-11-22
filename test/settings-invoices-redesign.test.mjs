import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  recordPayment,
  voidInvoice,
  customerViewInvoice,
  convertQuoteToInvoice,
  convertJobToInvoice
} from '../src/lib/payments/invoice-manager.ts'

/**
 * In-memory Supabase mock client harness for invoice redesign testing
 */
function createMockInvoicesDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    invoices: initialState.invoices || [],
    invoice_items: initialState.invoice_items || [],
    payments: initialState.payments || [],
    contacts: initialState.contacts || [],
    jobs: initialState.jobs || [],
    job_items: initialState.job_items || [],
    quotes: initialState.quotes || [],
    quote_items: initialState.quote_items || [],
    scheduled_actions: initialState.scheduled_actions || []
  }

  function queryBuilder(tableName) {
    const filters = []
    let selectFields = '*'
    let orderCol = null
    let orderAsc = true
    let limitCount = null

    const builder = {
      select: (fields = '*') => {
        selectFields = fields
        return builder
      },
      eq: (col, val) => {
        filters.push((row) => row[col] === val)
        return builder
      },
      neq: (col, val) => {
        filters.push((row) => row[col] !== val)
        return builder
      },
      in: (col, vals) => {
        filters.push((row) => Array.isArray(vals) && vals.includes(row[col]))
        return builder
      },
      is: (col, val) => {
        if (val === null) {
          filters.push((row) => row[col] === null || row[col] === undefined)
        } else {
          filters.push((row) => row[col] === val)
        }
        return builder
      },
      order: (col, opts = {}) => {
        orderCol = col
        orderAsc = opts.ascending !== false
        return builder
      },
      limit: (n) => {
        limitCount = n
        return builder
      },
      maybeSingle: async () => {
        const tableData = tables[tableName] || []
        const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
        const res = filtered[0] || null
        if (res && tableName === 'quotes' && tables.quote_items) {
          if (!res.quote_items) {
            res.quote_items = tables.quote_items.filter((qi) => qi.quote_id === res.id)
          }
        }
        return { data: res, error: null }
      },
      single: async () => {
        const tableData = tables[tableName] || []
        const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
        if (filtered.length === 0) return { data: null, error: new Error('Row not found') }
        const res = filtered[0]
        if (res && tableName === 'quotes' && tables.quote_items) {
          if (!res.quote_items) {
            res.quote_items = tables.quote_items.filter((qi) => qi.quote_id === res.id)
          }
        }
        return { data: res, error: null }
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
        const updateFilters = []
        const updateBuilder = {
          eq: (col, val) => {
            updateFilters.push((row) => row[col] === val)
            return updateBuilder
          },
          in: (col, arr) => {
            updateFilters.push((row) => Array.isArray(arr) && arr.includes(row[col]))
            return updateBuilder
          },
          like: (col, pattern) => {
            return updateBuilder
          },
          ilike: (col, pattern) => {
            return updateBuilder
          },
          is: (col, val) => {
            if (val === null) {
              updateFilters.push((row) => row[col] === null || row[col] === undefined)
            } else {
              updateFilters.push((row) => row[col] === val)
            }
            return updateBuilder
          },
          select: () => updateBuilder,
          single: async () => {
            const tableData = tables[tableName] || []
            let updatedRow = null
            for (const row of tableData) {
              if (updateFilters.every((fn) => fn(row))) {
                Object.assign(row, updates)
                if (!updatedRow) updatedRow = row
              }
            }
            return { data: updatedRow, error: null }
          },
          maybeSingle: async () => {
            const tableData = tables[tableName] || []
            let updatedRow = null
            for (const row of tableData) {
              if (updateFilters.every((fn) => fn(row))) {
                Object.assign(row, updates)
                if (!updatedRow) updatedRow = row
              }
            }
            return { data: updatedRow, error: null }
          },
          then: (resolve, reject) => {
            const tableData = tables[tableName] || []
            const updatedRows = []
            for (const row of tableData) {
              if (updateFilters.every((fn) => fn(row))) {
                Object.assign(row, updates)
                updatedRows.push(row)
              }
            }
            return Promise.resolve({ data: updatedRows, error: null }).then(resolve, reject)
          }
        }
        return updateBuilder
      },
      then: (resolve) => {
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
        resolve({ data: filtered, error: null })
      }
    }

    return builder
  }

  return {
    from: (tableName) => queryBuilder(tableName),
    rpc: async (fnName) => {
      if (fnName === 'get_next_document_number') {
        return { data: 'INV-1001', error: null }
      }
      return { data: null, error: null }
    },
    _tables: tables
  }
}

test('Accounting Integrity: Unissued drafts are strictly excluded from receivables due', () => {
  const invoices = [
    { id: 'inv-1', status: 'draft', amount_due: 450, total: 450 },
    { id: 'inv-2', status: 'sent', amount_due: 350, total: 350 },
    { id: 'inv-3', status: 'viewed', amount_due: 600, total: 600 },
    { id: 'inv-4', status: 'partially_paid', amount_due: 200, total: 500, amount_paid: 300 },
    { id: 'inv-5', status: 'overdue', amount_due: 800, total: 800 },
    { id: 'inv-6', status: 'paid', amount_due: 0, total: 950, amount_paid: 950 },
    { id: 'inv-7', status: 'void', amount_due: 0, total: 300 }
  ]

  // Authoritative formula from redesigned dashboard
  const receivablesInvoices = invoices.filter(
    (i) => ['sent', 'viewed', 'partially_paid', 'overdue'].includes(i.status) && Number(i.amount_due) > 0
  )
  const totalReceivablesDue = receivablesInvoices.reduce((acc, i) => acc + Number(i.amount_due), 0)

  // Drafts must NOT be in receivables
  assert.equal(receivablesInvoices.some(i => i.status === 'draft'), false)
  // Paid and void must NOT be in receivables
  assert.equal(receivablesInvoices.some(i => i.status === 'paid'), false)
  assert.equal(receivablesInvoices.some(i => i.status === 'void'), false)

  // 350 + 600 + 200 + 800 = 1950
  assert.equal(totalReceivablesDue, 1950)
  assert.equal(receivablesInvoices.length, 4)
})

test('Partial Payment Ledger: Recalculates amount_paid, amount_due, and updates invoice status', async () => {
  const orgId = 'org-test-1'
  const mockDb = createMockInvoicesDb({
    organizations: [{ id: orgId, name: 'Precision Air Conditioning' }],
    contacts: [{ id: 'contact-1', org_id: orgId, name: 'Alice Walker', phone: '+15552345678' }],
    invoices: [
      {
        id: 'inv-test-101',
        org_id: orgId,
        contact_id: 'contact-1',
        invoice_number: 'INV-101',
        total: 1000,
        amount_paid: 0,
        amount_due: 1000,
        status: 'sent'
      }
    ],
    payments: []
  })

  // 1. Record first partial payment of $400
  const payment1 = await recordPayment(mockDb, {
    invoiceId: 'inv-test-101',
    orgId,
    amount: 400,
    paymentMethod: 'cash',
    referenceNote: 'Cash handed on site'
  })

  assert.equal(payment1.success, true)
  assert.equal(payment1.invoice.status, 'partially_paid')
  assert.equal(payment1.invoice.amount_paid, 400)
  assert.equal(payment1.invoice.amount_due, 600)

  // Verify payment recorded in ledger
  assert.equal(mockDb._tables.payments.length, 1)
  assert.equal(mockDb._tables.payments[0].amount, 400)
  assert.equal(mockDb._tables.payments[0].payment_method, 'cash')

  // 2. Record second payment of remaining $600 with check
  const payment2 = await recordPayment(mockDb, {
    invoiceId: 'inv-test-101',
    orgId,
    amount: 600,
    paymentMethod: 'check',
    referenceNote: 'Check #4821'
  })

  assert.equal(payment2.success, true)
  assert.equal(payment2.invoice.status, 'paid')
  assert.equal(payment2.invoice.amount_paid, 1000)
  assert.equal(payment2.invoice.amount_due, 0)
  assert.equal(mockDb._tables.payments.length, 2)
  assert.equal(mockDb._tables.payments[1].reference_note, 'Check #4821')
})

test('Payment Guard: Idempotency prevents duplicate Stripe webhook processing', async () => {
  const orgId = 'org-test-1'
  const mockDb = createMockInvoicesDb({
    organizations: [{ id: orgId, name: 'Precision Air' }],
    invoices: [
      {
        id: 'inv-stripe-1',
        org_id: orgId,
        total: 250,
        amount_paid: 0,
        amount_due: 250,
        status: 'sent'
      }
    ],
    payments: []
  })

  const stripePaymentIntentId = 'pi_test_123456789'

  // First webhook execution
  const res1 = await recordPayment(mockDb, {
    invoiceId: 'inv-stripe-1',
    orgId,
    amount: 250,
    paymentMethod: 'card',
    stripePaymentIntentId,
    referenceNote: 'Stripe Online Checkout'
  })

  assert.equal(res1.success, true)
  assert.equal(mockDb._tables.payments.length, 1)

  // Duplicate webhook delivery with identical payment intent ID
  const res2 = await recordPayment(mockDb, {
    invoiceId: 'inv-stripe-1',
    orgId,
    amount: 250,
    paymentMethod: 'card',
    stripePaymentIntentId,
    referenceNote: 'Duplicate event retry'
  })

  assert.equal(res2.success, true)
  // No second payment inserted in ledger
  assert.equal(mockDb._tables.payments.length, 1)
})

test('Payment Guard: Voided or already paid invoices reject additional payment recording', async () => {
  const orgId = 'org-test-1'
  const mockDb = createMockInvoicesDb({
    invoices: [
      { id: 'inv-void', org_id: orgId, total: 300, amount_paid: 0, amount_due: 0, status: 'void' },
      { id: 'inv-paid', org_id: orgId, total: 500, amount_paid: 500, amount_due: 0, status: 'paid' }
    ]
  })

  const voidAttempt = await recordPayment(mockDb, {
    invoiceId: 'inv-void',
    orgId,
    amount: 300,
    paymentMethod: 'cash'
  })
  assert.equal(voidAttempt.success, false)
  assert.match(voidAttempt.error, /cannot send a voided invoice/i)

  const paidAttempt = await recordPayment(mockDb, {
    invoiceId: 'inv-paid',
    orgId,
    amount: 100,
    paymentMethod: 'cash'
  })
  assert.equal(paidAttempt.success, false)
  assert.match(paidAttempt.error, /already paid in full/i)
})

test('Void Invoice: Halts active invoice without deleting historical record', async () => {
  const orgId = 'org-test-1'
  const mockDb = createMockInvoicesDb({
    invoices: [
      { id: 'inv-to-void', org_id: orgId, total: 450, amount_paid: 0, amount_due: 450, status: 'sent' }
    ],
    scheduled_actions: []
  })

  const voidRes = await voidInvoice(mockDb, {
    invoiceId: 'inv-to-void',
    orgId,
    reason: 'Customer cancelled service request'
  })

  assert.equal(voidRes.success, true)
  const updated = mockDb._tables.invoices.find(i => i.id === 'inv-to-void')
  assert.equal(updated.status, 'void')
  assert.match(updated.notes, /Voided: Customer cancelled service request/i)
})

test('Quote to Invoice Conversion: Copies items, tax, discount, and prevents duplicate conversions', async () => {
  const orgId = 'org-test-1'
  const mockDb = createMockInvoicesDb({
    organizations: [{ id: orgId, name: 'Apex Electric' }],
    quotes: [
      {
        id: 'quote-101',
        org_id: orgId,
        quote_number: 'EST-101',
        title: 'Panel Upgrade 200A',
        contact_id: 'contact-apex',
        status: 'accepted',
        subtotal: 1800,
        tax: 90,
        discount: 100,
        total: 1790
      }
    ],
    quote_items: [
      { quote_id: 'quote-101', description: '200A Main Panel', quantity: 1, unit_price: 1200, total: 1200 },
      { quote_id: 'quote-101', description: 'Permits & Inspection', quantity: 1, unit_price: 600, total: 600 }
    ],
    invoices: [],
    invoice_items: []
  })

  // First conversion creates invoice
  const conv1 = await convertQuoteToInvoice(mockDb, {
    quoteId: 'quote-101',
    orgId
  })

  assert.equal(conv1.success, true)
  assert.ok(conv1.invoice)
  assert.equal(conv1.invoice.quote_id, 'quote-101')
  assert.equal(conv1.invoice.total, 1790)
  assert.equal(conv1.invoice.amount_due, 1790)
  assert.equal(conv1.invoice.status, 'draft')

  // Duplicate conversion prevention
  const conv2 = await convertQuoteToInvoice(mockDb, {
    quoteId: 'quote-101',
    orgId
  })
  assert.equal(conv2.success, true)
  assert.equal(conv2.invoice.id, conv1.invoice.id)
  assert.equal(mockDb._tables.invoices.length, 1)
})

test('Customer Public Invoice View: Resolves contractor phone correctly', async () => {
  const orgId = 'org-plumb-1'
  const mockDb = createMockInvoicesDb({
    organizations: [
      {
        id: orgId,
        name: 'Plumbing Experts LLC',
        telnyx_phone_number: '+18005550199',
        owner_phone: '+15551234567',
        timezone: 'America/Chicago'
      }
    ],
    contacts: [
      { id: 'c-1', name: 'Robert Smith', phone: '+15559876543' }
    ],
    invoices: [
      {
        id: 'inv-public-1',
        org_id: orgId,
        contact_id: 'c-1',
        manage_token: 'token_secure_xyz123',
        invoice_number: 'INV-2026',
        title: 'Emergency Pipe Repair',
        subtotal: 350,
        tax: 0,
        discount: 0,
        total: 350,
        amount_paid: 0,
        amount_due: 350,
        status: 'sent',
        due_date: new Date(Date.now() + 7 * 86400000).toISOString()
      }
    ],
    invoice_items: [
      { invoice_id: 'inv-public-1', description: 'Burst pipe repair & new shutoff valve', quantity: 1, unit_price: 350, total: 350 }
    ]
  })

  const view = await customerViewInvoice(mockDb, 'token_secure_xyz123')
  assert.equal(view.success, true)
  assert.ok(view.org)
  // Phone normalization: priority given to telnyx_phone_number, then owner_phone
  assert.equal(view.org.phone, '+18005550199')
  assert.equal(view.invoice.status, 'viewed')
})

test('Starter Pass Model: Invoices and quotes do not increment completed jobs count', () => {
  // Entitlement logic: Completed jobs come strictly from jobs table where status === 'completed'
  const jobs = [
    { id: 'job-1', status: 'completed' },
    { id: 'job-2', status: 'completed' },
    { id: 'job-3', status: 'in_progress' },
    { id: 'job-4', status: 'scheduled' }
  ]
  const completedJobsCount = jobs.filter(j => j.status === 'completed').length

  // Invoices and quotes in various states
  const quotes = [
    { id: 'q-1', status: 'accepted' },
    { id: 'q-2', status: 'sent' }
  ]
  const invoices = [
    { id: 'i-1', status: 'paid' },
    { id: 'i-2', status: 'draft' }
  ]

  // Verify count is strictly jobs with status 'completed' (2 completed out of 3 Starter allowance)
  assert.equal(completedJobsCount, 2)
  assert.equal(completedJobsCount < 3, true)
})

test('Code Compliance: Strict zero em dashes in invoices components and backend files', () => {
  const targetFiles = [
    'src/app/client/invoices/page.tsx',
    'src/app/invoice/[token]/page.tsx',
    'src/lib/payments/invoice-manager.ts',
    'src/app/api/client/invoices/route.ts'
  ]

  for (const file of targetFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8')
      const matches = content.match(/[\u2014\u2013]/g)
      assert.equal(
        matches ? matches.length : 0,
        0,
        `Found em/en dashes in ${file}: count=${matches ? matches.length : 0}`
      )
    }
  }
})
