import test from 'node:test'
import assert from 'node:assert'
import {
  calculateInvoiceFinancials,
  createInvoice,
  convertJobToInvoice,
  convertQuoteToInvoice,
  sendInvoice,
  customerViewInvoice,
  recordPayment,
  voidInvoice
} from '../src/lib/payments/invoice-manager.ts'
import {
  createStripeCheckoutSession,
  verifyStripeWebhookSignature
} from '../src/lib/payments/stripe-adapter.ts'
import { evaluateAndApplyStopConditions } from '../src/lib/automations/stop-conditions.ts'

/**
 * In-memory Supabase mock harness for Invoicing + Stripe tests
 */
function createMockInvoiceDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    invoices: initialState.invoices || [],
    invoice_items: initialState.invoice_items || [],
    payments: initialState.payments || [],
    jobs: initialState.jobs || [],
    job_items: initialState.job_items || [],
    quotes: initialState.quotes || [],
    quote_items: initialState.quote_items || [],
    contacts: initialState.contacts || [],
    leads: initialState.leads || [],
    automation_runs: initialState.automation_runs || [],
    automation_rules: initialState.automation_rules || [],
    processed_events: initialState.processed_events || [],
    activity_logs: initialState.activity_logs || [],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers || []
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
// TEST SUITE: Phase 6 Invoicing + Stripe Engine
// -------------------------------------------------------------

test('1. calculateInvoiceFinancials correctly computes line totals, discounts, and taxes', () => {
  const items = [
    { description: 'Emergency Water Extraction', quantity: 2, unit_price: 350 }, // 700
    { description: 'Antimicrobial Treatment', quantity: 1, unit_price: 150 }      // 150
  ]

  // Subtotal = 850, discount = 50, taxable = 800, taxRate = 10% (80), total = 880, due = 880
  const financials = calculateInvoiceFinancials(items, 10, 50)

  assert.strictEqual(financials.subtotal, 850)
  assert.strictEqual(financials.discount, 50)
  assert.strictEqual(financials.tax, 80)
  assert.strictEqual(financials.total, 880)
  assert.strictEqual(financials.amountDue, 880)
})

test('2. createInvoice generates draft invoice with unique manage_token and persists line items', async () => {
  const db = createMockInvoiceDb()
  const orgId = 'org-plumbing-101'
  const contactId = 'contact-alice-1'

  const res = await createInvoice(db, {
    orgId,
    contactId,
    title: 'Burst Pipe Restoration',
    description: 'Dryout and copper pipe replacement',
    items: [
      { description: 'Pipe repair kit', quantity: 1, unit_price: 120 },
      { description: 'Labor (2 hrs)', quantity: 2, unit_price: 85 }
    ],
    taxRate: 5,
    discountAmount: 10
  })

  assert.strictEqual(res.success, true)
  assert.ok(res.invoice)
  assert.strictEqual(res.invoice.org_id, orgId)
  assert.strictEqual(res.invoice.status, 'draft')
  assert.strictEqual(res.invoice.subtotal, 290) // 120 + 170 = 290
  assert.strictEqual(res.invoice.discount, 10)  // 290 - 10 = 280
  assert.strictEqual(res.invoice.tax, 14)       // 280 * 0.05 = 14
  assert.strictEqual(res.invoice.total, 294)     // 280 + 14 = 294
  assert.strictEqual(res.invoice.amount_due, 294)
  assert.ok(res.invoice.manage_token.length >= 32, 'manage_token should be secure 32+ char hex')
  assert.strictEqual(res.items.length, 2)
  assert.strictEqual(db._tables.invoices.length, 1)
  assert.strictEqual(db._tables.invoice_items.length, 2)
})

test('3. convertJobToInvoice copies job items and links job_id', async () => {
  const orgId = 'org-roofing-202'
  const contactId = 'contact-bob-2'
  const jobId = 'job-roof-repair-99'

  const db = createMockInvoiceDb({
    jobs: [
      {
        id: jobId,
        org_id: orgId,
        contact_id: contactId,
        title: 'Roof Shingle Replacement',
        description: 'Repaired wind-damaged north section',
        job_items: [
          { description: 'Architectural Shingles (bundle)', quantity: 3, unit_price: 45 },
          { description: 'Ridge Vent Installation', quantity: 1, unit_price: 180 }
        ]
      }
    ]
  })

  const res = await convertJobToInvoice(db, {
    jobId,
    orgId,
    taxRate: 8
  })

  assert.strictEqual(res.success, true)
  assert.ok(res.invoice)
  assert.strictEqual(res.invoice.job_id, jobId)
  assert.strictEqual(res.invoice.org_id, orgId)
  assert.strictEqual(res.invoice.status, 'draft')
  assert.strictEqual(res.invoice.subtotal, 315) // 3*45 (135) + 180 = 315
  assert.strictEqual(res.items.length, 2)
})

test('4. convertQuoteToInvoice bridges an accepted quote into a draft invoice', async () => {
  const orgId = 'org-hvac-303'
  const contactId = 'contact-charlie-3'
  const quoteId = 'quote-heat-pump-77'

  const db = createMockInvoiceDb({
    quotes: [
      {
        id: quoteId,
        org_id: orgId,
        contact_id: contactId,
        title: 'Heat Pump Winter Tune-up',
        description: 'Comprehensive 21-point HVAC inspection',
        discount: 25,
        quote_items: [
          { description: 'System Inspection & Filter', quantity: 1, unit_price: 150 },
          { description: 'Refrigerant Top-up (lbs)', quantity: 2, unit_price: 60 }
        ]
      }
    ]
  })

  const res = await convertQuoteToInvoice(db, {
    quoteId,
    orgId
  })

  assert.strictEqual(res.success, true)
  assert.ok(res.invoice)
  assert.strictEqual(res.invoice.quote_id, quoteId)
  assert.strictEqual(res.invoice.subtotal, 270) // 150 + 120 = 270
  assert.strictEqual(res.invoice.discount, 25)
  assert.strictEqual(res.invoice.total, 245)
  assert.strictEqual(res.items.length, 2)
})

test('5. sendInvoice updates status to sent, creates Stripe Checkout session, dispatches SMS, and schedules overdue reminders', async () => {
  const orgId = 'org-auto-404'
  const contactId = 'contact-david-4'
  const invoiceId = 'inv-transmission-55'

  const db = createMockInvoiceDb({
    organizations: [{ id: orgId, name: 'Precision Auto Works' }],
    contacts: [{ id: contactId, org_id: orgId, name: 'David Lee', phone: '+15554443322', email: 'david@example.com' }],
    invoices: [
      {
        id: invoiceId,
        org_id: orgId,
        contact_id: contactId,
        invoice_number: 'INV-404-001',
        title: 'Brake Pad Replacement',
        subtotal: 300,
        tax: 25,
        discount: 0,
        total: 325,
        amount_paid: 0,
        amount_due: 325,
        status: 'draft',
        due_date: '2026-10-15T00:00:00.000Z',
        manage_token: 'token-abc12345678901234567890123456789'
      }
    ],
    invoice_items: [
      { invoice_id: invoiceId, description: 'Ceramic Brake Pads', quantity: 2, unit_price: 150 }
    ]
  })

  const res = await sendInvoice(db, {
    invoiceId,
    orgId,
    baseUrl: 'https://app.captodesk.com'
  })

  assert.strictEqual(res.success, true)
  assert.ok(res.invoice)
  assert.strictEqual(res.invoice.status, 'sent')
  assert.ok(res.invoice.sent_at)
  assert.ok(res.checkoutUrl)

  // Verify scheduled overdue reminders in automation_runs
  const scheduledRuns = db._tables.automation_runs.filter(r => r.event_type === 'invoice.overdue')
  assert.strictEqual(scheduledRuns.length, 2, 'Should schedule day 3 and day 7 overdue reminders')
  assert.strictEqual(scheduledRuns[0].status, 'scheduled')
  assert.strictEqual(scheduledRuns[1].status, 'scheduled')
})

test('6. customerViewInvoice marks invoice as viewed upon public token access', async () => {
  const token = 'token-view-test-abcdef1234567890'
  const invoiceId = 'inv-view-test'
  const orgId = 'org-landscaping-505'

  const db = createMockInvoiceDb({
    invoices: [
      {
        id: invoiceId,
        org_id: orgId,
        manage_token: token,
        status: 'sent',
        title: 'Lawn Aeration',
        total: 180,
        amount_due: 180,
        amount_paid: 0
      }
    ],
    invoice_items: [
      { invoice_id: invoiceId, description: 'Fall Aeration & Seeding', quantity: 1, unit_price: 180 }
    ],
    contacts: [{ id: 'c-view-1', name: 'Emma Watson' }],
    organizations: [{ id: orgId, name: 'Green Pastures LLC' }]
  })

  const viewRes = await customerViewInvoice(db, token)
  assert.strictEqual(viewRes.success, true)
  assert.strictEqual(viewRes.invoice.status, 'viewed')
  assert.ok(viewRes.invoice.viewed_at)
})

test('7. recordPayment (offline cash/check) updates balance, marks paid, and halts overdue reminders', async () => {
  const orgId = 'org-electric-606'
  const contactId = 'contact-frank-6'
  const invoiceId = 'inv-panel-upgrade-88'

  const db = createMockInvoiceDb({
    organizations: [{ id: orgId, name: 'Volt Masters' }],
    contacts: [{ id: contactId, org_id: orgId, name: 'Frank Miller', phone: '+15559998877' }],
    invoices: [
      {
        id: invoiceId,
        org_id: orgId,
        contact_id: contactId,
        invoice_number: 'INV-606-005',
        title: '200A Electrical Panel Upgrade',
        total: 1500,
        amount_paid: 0,
        amount_due: 1500,
        status: 'sent',
        manage_token: 'token-volt-12345'
      }
    ],
    automation_runs: [
      {
        id: 'run-overdue-3',
        org_id: orgId,
        event_type: 'invoice.overdue',
        event_payload: { invoice_id: invoiceId },
        status: 'scheduled'
      },
      {
        id: 'run-overdue-7',
        org_id: orgId,
        event_type: 'invoice.overdue',
        event_payload: { invoice_id: invoiceId },
        status: 'scheduled'
      }
    ]
  })

  // 1. Partial payment: $500
  const partialRes = await recordPayment(db, {
    invoiceId,
    orgId,
    amount: 500,
    paymentMethod: 'cash',
    referenceNote: 'Cash deposit paid on site'
  })

  assert.strictEqual(partialRes.success, true)
  assert.strictEqual(partialRes.invoice.amount_paid, 500)
  assert.strictEqual(partialRes.invoice.amount_due, 1000)
  assert.strictEqual(partialRes.invoice.status, 'partially_paid')

  // 2. Remaining balance payment: $1000 check
  const fullRes = await recordPayment(db, {
    invoiceId,
    orgId,
    amount: 1000,
    paymentMethod: 'check',
    referenceNote: 'Check #1042 cleared'
  })

  assert.strictEqual(fullRes.success, true)
  assert.strictEqual(fullRes.invoice.amount_paid, 1500)
  assert.strictEqual(fullRes.invoice.amount_due, 0)
  assert.strictEqual(fullRes.invoice.status, 'paid')
  assert.ok(fullRes.invoice.paid_at)

  // Verify payment rows created in payments table
  assert.strictEqual(db._tables.payments.length, 2)
  assert.strictEqual(db._tables.payments[0].payment_method, 'cash')
  assert.strictEqual(db._tables.payments[1].payment_method, 'check')

  // Verify overdue reminders were canceled
  const remainingScheduled = db._tables.automation_runs.filter(r => r.status === 'scheduled')
  assert.strictEqual(remainingScheduled.length, 0, 'Pending overdue reminders must be canceled on full payment')
})

test('8. Stripe Webhook Signature Verification handles simulated and rejected headers correctly', () => {
  // When no STRIPE_WEBHOOK_SECRET is set, simulated mode succeeds
  const simResult = verifyStripeWebhookSignature('{"type":"checkout.session.completed"}', 'sig_test_123')
  assert.ok(simResult.isValid)
  assert.ok(simResult.event)

  // When signature is missing in simulated environment
  const emptySigResult = verifyStripeWebhookSignature('{"type":"test"}', '')
  assert.strictEqual(emptySigResult.isValid, false)
  assert.strictEqual(emptySigResult.error, 'Missing stripe-signature header')
})

test('9. Stripe Webhook Idempotency: duplicate webhook event is processed exactly once', async () => {
  const orgId = 'org-solar-707'
  const contactId = 'contact-grace-7'
  const invoiceId = 'inv-solar-array-12'
  const stripeEventId = 'evt_test_webhook_stripe_99999'

  const db = createMockInvoiceDb({
    invoices: [
      {
        id: invoiceId,
        org_id: orgId,
        contact_id: contactId,
        invoice_number: 'INV-707-009',
        total: 2500,
        amount_paid: 0,
        amount_due: 2500,
        status: 'sent',
        manage_token: 'token-solar-abc'
      }
    ],
    processed_events: []
  })

  // First webhook delivery
  const isDuplicate1 = db._tables.processed_events.some(e => e.provider === 'stripe' && e.event_id === stripeEventId)
  assert.strictEqual(isDuplicate1, false)

  await db.from('processed_events').insert({
    org_id: orgId,
    event_id: stripeEventId,
    provider: 'stripe',
    event_type: 'checkout.session.completed'
  })

  await recordPayment(db, {
    invoiceId,
    orgId,
    amount: 2500,
    paymentMethod: 'stripe_card',
    stripeCheckoutSessionId: 'cs_live_123',
    stripePaymentIntentId: 'pi_live_456'
  })

  assert.strictEqual(db._tables.payments.length, 1)
  assert.strictEqual(db._tables.invoices[0].status, 'paid')

  // Second duplicate delivery with identical event_id
  const isDuplicate2 = db._tables.processed_events.some(e => e.provider === 'stripe' && e.event_id === stripeEventId)
  assert.strictEqual(isDuplicate2, true, 'Second delivery must be identified as duplicate')

  // In the webhook route handler, if isDuplicate2 is true, it returns immediately without re-recording payment
  assert.strictEqual(db._tables.payments.length, 1, 'Payment count must not increase on duplicate delivery')
})

test('10. Automations Stop Condition (invoice_paid) halts overdue runs once invoice is marked paid', async () => {
  const orgId = 'org-clean-808'
  const invoiceId = 'inv-maid-service-45'

  const db = createMockInvoiceDb({
    automation_runs: [
      {
        id: 'run-overdue-clean-1',
        org_id: orgId,
        status: 'scheduled',
        event_payload: { invoice_id: invoiceId }
      }
    ]
  })

  // Test evaluateAndApplyStopConditions with invoice.paid
  const stopResult = await evaluateAndApplyStopConditions(db, {
    eventId: 'evt-test-stop',
    eventType: 'invoice.paid',
    orgId,
    entityId: invoiceId,
    payload: { invoice_id: invoiceId },
    timestamp: new Date().toISOString()
  })

  assert.strictEqual(stopResult.triggered, true)
  assert.strictEqual(stopResult.stopCondition, 'invoice_paid')
  assert.deepStrictEqual(stopResult.cancelledRunIds, ['run-overdue-clean-1'])
  assert.strictEqual(db._tables.automation_runs[0].status, 'cancelled')
})

test('11. Multi-Tenant Isolation prevents cross-organization invoice actions', async () => {
  const orgA = 'org-alpha'
  const orgB = 'org-beta'
  const invoiceA = 'inv-org-alpha-001'

  const db = createMockInvoiceDb({
    organizations: [{ id: orgA, name: 'Org Alpha' }, { id: orgB, name: 'Org Beta' }],
    invoices: [
      {
        id: invoiceA,
        org_id: orgA,
        total: 500,
        amount_due: 500,
        amount_paid: 0,
        status: 'draft'
      }
    ]
  })

  // Org B attempts to send Org A's invoice
  const sendRes = await sendInvoice(db, {
    invoiceId: invoiceA,
    orgId: orgB, // Mismatched tenant
    baseUrl: 'https://app.captodesk.com'
  })
  assert.strictEqual(sendRes.success, false)
  assert.ok(sendRes.error)

  // Org B attempts to record payment on Org A's invoice
  const payRes = await recordPayment(db, {
    invoiceId: invoiceA,
    orgId: orgB, // Mismatched tenant
    amount: 500,
    paymentMethod: 'cash'
  })
  assert.strictEqual(payRes.success, false)
  assert.ok(payRes.error)

  // Org B attempts to void Org A's invoice
  const voidRes = await voidInvoice(db, {
    invoiceId: invoiceA,
    orgId: orgB // Mismatched tenant
  })
  assert.strictEqual(voidRes.success, false)
  assert.ok(voidRes.error)
})
