process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert'
import { processMissedCall } from '../src/lib/services/call-recovery.ts'
import { processInboundSms } from '../src/lib/services/sms-handler.ts'
import { createQuote } from '../src/lib/quotes/quote-manager.ts'
import { createInvoice } from '../src/lib/payments/invoice-manager.ts'
import { evaluateCallOutcome } from '../src/lib/telephony/call-state-machine.ts'

/**
 * Phase 2 Mock Database Harness
 * Simulates atomic webhook deduplication, transactional rollbacks, and multi-tenant scoping.
 */
function createPhase2MockDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers || [],
    contacts: initialState.contacts || [],
    conversations: initialState.conversations || [],
    messages: initialState.messages || [],
    calls: initialState.calls || [],
    leads: initialState.leads || [],
    quotes: initialState.quotes || [],
    quote_items: initialState.quote_items || [],
    invoices: initialState.invoices || [],
    invoice_items: initialState.invoice_items || [],
    processed_events: initialState.processed_events || [],
    document_counters: initialState.document_counters || []
  }

  let simulateItemError = false

  const client = {
    _tables: tables,
    setSimulateItemError: (val) => {
      simulateItemError = val
    },
    rpc: async (fnName, args) => {
      if (fnName === 'next_document_number') {
        const { p_org_id, p_doc_type, p_year } = args
        let row = tables.document_counters.find(
          (c) => c.org_id === p_org_id && c.document_type === p_doc_type && c.year === p_year
        )
        if (!row) {
          row = { org_id: p_org_id, document_type: p_doc_type, year: p_year, next_value: 2 }
          tables.document_counters.push(row)
          return { data: 1, error: null }
        } else {
          const val = row.next_value
          row.next_value += 1
          return { data: val, error: null }
        }
      }

      if (fnName === 'create_quote_with_items') {
        if (simulateItemError) {
          return { data: null, error: { message: 'Simulated database transaction rollback on line items' } }
        }
        const quoteId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        const quote = {
          id: quoteId,
          org_id: args.p_org_id,
          contact_id: args.p_contact_id,
          quote_number: args.p_quote_number,
          title: args.p_title,
          subtotal: args.p_subtotal,
          tax: args.p_tax,
          total: args.p_total,
          status: 'draft',
          created_at: new Date().toISOString()
        }
        tables.quotes.push(quote)

        const insertedItems = (args.p_items || []).map((item) => {
          const row = { id: `qi_${Math.random()}`, quote_id: quoteId, ...item }
          tables.quote_items.push(row)
          return row
        })

        return { data: { quote, items: insertedItems }, error: null }
      }

      if (fnName === 'create_invoice_with_items') {
        if (simulateItemError) {
          return { data: null, error: { message: 'Simulated database transaction rollback on invoice items' } }
        }
        const invId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        const invoice = {
          id: invId,
          org_id: args.p_org_id,
          contact_id: args.p_contact_id,
          invoice_number: args.p_invoice_number,
          title: args.p_title,
          subtotal: args.p_subtotal,
          tax: args.p_tax,
          total: args.p_total,
          amount_paid: 0,
          amount_due: args.p_total,
          status: 'draft',
          created_at: new Date().toISOString()
        }
        tables.invoices.push(invoice)

        const insertedItems = (args.p_items || []).map((item) => {
          const row = { id: `ii_${Math.random()}`, invoice_id: invId, ...item }
          tables.invoice_items.push(row)
          return row
        })

        return { data: { invoice, items: insertedItems }, error: null }
      }

      return { data: null, error: new Error(`Unknown RPC ${fnName}`) }
    },

    from: (tableName) => {
      let filters = []

      const qb = {
        select: (cols) => qb,
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return qb
        },
        neq: (col, val) => {
          filters.push((row) => row[col] !== val)
          return qb
        },
        in: (col, arr) => {
          filters.push((row) => arr.includes(row[col]))
          return qb
        },
        gte: (col, val) => {
          filters.push((row) => (row[col] ?? '') >= val)
          return qb
        },
        gt: (col, val) => {
          filters.push((row) => (row[col] ?? '') > val)
          return qb
        },
        lte: (col, val) => {
          filters.push((row) => (row[col] ?? '') <= val)
          return qb
        },
        lt: (col, val) => {
          filters.push((row) => (row[col] ?? '') < val)
          return qb
        },
        order: () => qb,
        limit: () => qb,
        then: (resolve, reject) => {
          const tableData = tables[tableName] || []
          let filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject)
        },
        maybeSingle: async () => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          const item = filtered[0] || null
          if (item && tableName === 'telnyx_phone_numbers') {
            const org = tables.organizations.find((o) => o.id === item.org_id)
            return { data: { ...item, organizations: org }, error: null }
          }
          return { data: item, error: null }
        },
        single: async () => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          if (filtered.length === 0) return { data: null, error: new Error('Row not found') }
          return { data: filtered[0], error: null }
        },
        insert: (rowOrRows) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          let insertErr = null
          const inserted = []

          for (const row of rows) {
            const newRow = {
              id: row.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              created_at: new Date().toISOString(),
              ...row
            }

            // Enforce UNIQUE(id) / UNIQUE(provider, provider_event_id) on processed_events
            if (tableName === 'processed_events') {
              const collision = tables.processed_events.find(
                (e) => (e.id === newRow.id) || (e.provider === newRow.provider && e.provider_event_id === newRow.provider_event_id)
              )
              if (collision) {
                insertErr = { code: '23505', message: `duplicate key value violates unique constraint` }
                break
              }
            }

            // Simulate line-item failure if triggered
            if ((tableName === 'quote_items' || tableName === 'invoice_items') && simulateItemError) {
              insertErr = { code: '42P01', message: 'Simulated line items database failure' }
              break
            }

            if (!tables[tableName]) tables[tableName] = []
            tables[tableName].push(newRow)
            inserted.push(newRow)
          }

          const last = inserted[inserted.length - 1] || null
          return {
            data: insertErr ? null : last,
            error: insertErr,
            select: () => ({
              single: async () => ({ data: insertErr ? null : last, error: insertErr }),
              maybeSingle: async () => ({ data: insertErr ? null : last, error: insertErr })
            }),
            then: (resolve, reject) => {
              return Promise.resolve({ data: insertErr ? null : last, error: insertErr }).then(resolve, reject)
            }
          }
        },
        update: (updates) => {
          const updateFilters = []
          const ub = {
            eq: (col, val) => {
              updateFilters.push((row) => row[col] === val)
              return ub
            },
            in: (col, arr) => {
              updateFilters.push((row) => arr.includes(row[col]))
              return ub
            },
            select: () => ({
              single: async () => {
                let updated = null
                for (const row of tables[tableName] || []) {
                  if (updateFilters.every((fn) => fn(row))) {
                    Object.assign(row, updates)
                    updated = row
                  }
                }
                return { data: updated, error: null }
              },
              maybeSingle: async () => {
                let updated = null
                for (const row of tables[tableName] || []) {
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
              for (const row of tables[tableName] || []) {
                if (updateFilters.every((fn) => fn(row))) {
                  Object.assign(row, updates)
                  updated = row
                }
              }
              return Promise.resolve({ data: updated, error: null }).then(resolve, reject)
            }
          }
          return ub
        },
        delete: () => {
          const deleteFilters = []
          const db = {
            eq: (col, val) => {
              deleteFilters.push((row) => row[col] === val)
              return db
            },
            then: (resolve, reject) => {
              const prev = tables[tableName] || []
              tables[tableName] = prev.filter((row) => !deleteFilters.every((fn) => fn(row)))
              return Promise.resolve({ data: null, error: null }).then(resolve, reject)
            }
          }
          return db
        }
      }

      return qb
    }
  }

  return client
}

// =============================================================================
// 1. WEBHOOK IDEMPOTENCY TESTS (STRIPE & TELNYX)
// =============================================================================

test('Idempotency: Simultaneous duplicate Stripe webhooks - exactly one succeeds, second returns duplicate', async () => {
  const db = createPhase2MockDb()
  const eventId = 'evt_stripe_test_123'

  // Simultaneous insert claims
  const [claim1, claim2] = await Promise.all([
    db.from('processed_events').insert({ id: eventId, provider: 'stripe', event_type: 'checkout.session.completed', provider_event_id: eventId }),
    db.from('processed_events').insert({ id: eventId, provider: 'stripe', event_type: 'checkout.session.completed', provider_event_id: eventId })
  ])

  // Exactly one must succeed and one must fail with 23505 unique violation
  const successes = [claim1, claim2].filter((c) => !c.error)
  const errors = [claim1, claim2].filter((c) => c.error?.code === '23505')

  assert.strictEqual(successes.length, 1, 'Exactly one webhook execution claims the event')
  assert.strictEqual(errors.length, 1, 'Second webhook execution receives 23505 unique violation')
  assert.strictEqual(db._tables.processed_events.length, 1, 'Only one event stored in database')
})

test('Idempotency: Simultaneous duplicate Telnyx message webhooks - exactly one claims event ID', async () => {
  const db = createPhase2MockDb()
  const telnyxId = 'telnyx_msg_event_999'

  const [claimA, claimB] = await Promise.all([
    db.from('processed_events').insert({ id: telnyxId, provider: 'telnyx', event_type: 'message.received', provider_event_id: telnyxId }),
    db.from('processed_events').insert({ id: telnyxId, provider: 'telnyx', event_type: 'message.received', provider_event_id: telnyxId })
  ])

  const successes = [claimA, claimB].filter((c) => !c.error)
  const errors = [claimA, claimB].filter((c) => c.error?.code === '23505')

  assert.strictEqual(successes.length, 1)
  assert.strictEqual(errors.length, 1)
})

// =============================================================================
// 2. MISSED-CALL LEAD DEDUPLICATION TESTS
// =============================================================================

test('Lead Deduplication: Repeated missed calls from same contact increment count on existing open lead', async () => {
  const db = createPhase2MockDb({
    organizations: [
      { id: 'org-trades', name: 'Rapid Plumbing', is_missed_call_active: true, telnyx_phone_number: '+12145550100' }
    ],
    telnyx_phone_numbers: [
      { id: 'num-1', org_id: 'org-trades', phone_number: '+12145550100', status: 'active' }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 20
  })

  // First missed call: creates contact and first open lead
  const res1 = await processMissedCall(db, {
    callerNumber: '+19725550111',
    calledNumber: '+12145550100',
    callOutcome
  })
  assert.strictEqual(res1.success, true)
  assert.strictEqual(db._tables.leads.length, 1)
  assert.strictEqual(db._tables.leads[0].status, 'new')
  assert.strictEqual(db._tables.leads[0].missed_call_count, 1)

  // Second missed call: contact already has open lead -> do not create duplicate lead, increment count
  const res2 = await processMissedCall(db, {
    callerNumber: '+19725550111',
    calledNumber: '+12145550100',
    callOutcome
  })
  assert.strictEqual(res2.success, true)
  assert.strictEqual(db._tables.leads.length, 1, 'Must NOT create duplicate lead row')
  assert.strictEqual(db._tables.leads[0].missed_call_count, 2, 'Must increment missed_call_count to 2')
  assert.match(db._tables.leads[0].notes || '', /Attempt #2/)

  // Third missed call: increments count to 3
  await processMissedCall(db, {
    callerNumber: '+19725550111',
    calledNumber: '+12145550100',
    callOutcome
  })
  assert.strictEqual(db._tables.leads.length, 1)
  assert.strictEqual(db._tables.leads[0].missed_call_count, 3)
})

test('Lead Deduplication: A new call creates a new lead if previous lead was won or lost', async () => {
  const db = createPhase2MockDb({
    organizations: [
      { id: 'org-trades', name: 'Rapid Plumbing', is_missed_call_active: true, telnyx_phone_number: '+12145550100' }
    ],
    telnyx_phone_numbers: [
      { id: 'num-1', org_id: 'org-trades', phone_number: '+12145550100', status: 'active' }
    ],
    contacts: [
      { id: 'c-repeat', org_id: 'org-trades', phone: '+19725550222', name: 'Repeat Client' }
    ],
    leads: [
      { id: 'old-lead-won', org_id: 'org-trades', contact_id: 'c-repeat', status: 'booked', missed_call_count: 1 }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 15
  })

  await processMissedCall(db, {
    callerNumber: '+19725550222',
    calledNumber: '+12145550100',
    callOutcome
  })

  // Since previous lead is in 'booked' state (not open), a new open lead should be created
  assert.strictEqual(db._tables.leads.length, 2, 'Should create a new lead since previous lead is booked/closed')
  const newLead = db._tables.leads.find((l) => l.status === 'new')
  assert.ok(newLead)
  assert.strictEqual(newLead.contact_id, 'c-repeat')
})

// =============================================================================
// 3. INBOUND SMS -> LEAD STATUS TRANSITION TESTS
// =============================================================================

test('Inbound SMS: Customer reply transitions open lead from new to contacted', async () => {
  const db = createPhase2MockDb({
    organizations: [
      { id: 'org-hvac', name: 'Cool Air', telnyx_phone_number: '+12145550300' }
    ],
    telnyx_phone_numbers: [
      { id: 'num-3', org_id: 'org-hvac', phone_number: '+12145550300', status: 'active' }
    ],
    contacts: [
      { id: 'c-bob', org_id: 'org-hvac', phone: '+19725550333', name: 'Bob Hope' }
    ],
    leads: [
      { id: 'lead-bob', org_id: 'org-hvac', contact_id: 'c-bob', status: 'new' }
    ]
  })

  const res = await processInboundSms(db, {
    fromPhone: '+19725550333',
    toPhone: '+12145550300',
    text: 'Yes, can you come by tomorrow at 2pm?'
  })

  assert.strictEqual(res.success, true)
  assert.strictEqual(res.action, 'message_stored')

  // Verify lead status transitioned from 'new' to 'contacted'
  const updatedLead = db._tables.leads[0]
  assert.strictEqual(updatedLead.status, 'contacted', 'Lead must transition to contacted')
})

test('Inbound SMS: Customer reply does NOT overwrite leads in later stages (e.g. booked or lost)', async () => {
  const db = createPhase2MockDb({
    organizations: [
      { id: 'org-hvac', name: 'Cool Air', telnyx_phone_number: '+12145550300' }
    ],
    telnyx_phone_numbers: [
      { id: 'num-3', org_id: 'org-hvac', phone_number: '+12145550300', status: 'active' }
    ],
    contacts: [
      { id: 'c-booked', org_id: 'org-hvac', phone: '+19725550444', name: 'Booked Client' }
    ],
    leads: [
      { id: 'lead-booked', org_id: 'org-hvac', contact_id: 'c-booked', status: 'booked' }
    ]
  })

  await processInboundSms(db, {
    fromPhone: '+19725550444',
    toPhone: '+12145550300',
    text: 'Looking forward to the visit.'
  })

  // Status must remain 'booked'
  assert.strictEqual(db._tables.leads[0].status, 'booked')
})

// =============================================================================
// 4. QUOTE & INVOICE TRANSACTIONAL ROLLBACK TESTS
// =============================================================================

test('Transactional Quotes: Failure to insert line items triggers full rollback with 0 orphaned quotes', async () => {
  const db = createPhase2MockDb({
    organizations: [{ id: 'org-quote-tx', name: 'Quote Pros' }]
  })

  // Trigger simulated failure during item insertion
  db.setSimulateItemError(true)

  const res = await createQuote(db, {
    orgId: 'org-quote-tx',
    contactId: 'c-101',
    title: 'AC Unit Replacement',
    items: [
      { description: 'Condenser Unit', quantity: 1, unit_price: 2500 }
    ]
  })

  assert.strictEqual(res.success, false, 'Quote creation must fail on item error')
  assert.match(res.error || '', /Simulated.*failure|line items/)

  // CRITICAL: Ensure NO orphaned quote record remains in database
  assert.strictEqual(db._tables.quotes.length, 0, 'Orphaned parent quote must be completely rolled back')
  assert.strictEqual(db._tables.quote_items.length, 0)
})

test('Transactional Invoices: Failure to insert line items triggers full rollback with 0 orphaned invoices', async () => {
  const db = createPhase2MockDb({
    organizations: [{ id: 'org-inv-tx', name: 'Invoice Pros' }]
  })

  db.setSimulateItemError(true)

  const res = await createInvoice(db, {
    orgId: 'org-inv-tx',
    contactId: 'c-202',
    title: 'Roof Shingle Repair',
    items: [
      { description: 'Architectural Shingles Bundle', quantity: 10, unit_price: 45 }
    ]
  })

  assert.strictEqual(res.success, false, 'Invoice creation must fail on item error')
  assert.match(res.error || '', /Simulated.*(failure|rollback|items)/i)

  // CRITICAL: Ensure NO orphaned invoice record remains in database
  assert.strictEqual(db._tables.invoices.length, 0, 'Orphaned parent invoice must be completely rolled back')
  assert.strictEqual(db._tables.invoice_items.length, 0)
})

// =============================================================================
// 5. TENANT ISOLATION TESTS
// =============================================================================

test('Tenant Isolation: Lead deduplication is strictly scoped per organization', async () => {
  // Same customer phone +19725550999 interacts with Tenant A and Tenant B
  const db = createPhase2MockDb({
    organizations: [
      { id: 'org-tenant-a', name: 'Tenant A Plumbing', is_missed_call_active: true, telnyx_phone_number: '+12145550001' },
      { id: 'org-tenant-b', name: 'Tenant B Electric', is_missed_call_active: true, telnyx_phone_number: '+12145550002' }
    ],
    telnyx_phone_numbers: [
      { id: 'num-a', org_id: 'org-tenant-a', phone_number: '+12145550001', status: 'active' },
      { id: 'num-b', org_id: 'org-tenant-b', phone_number: '+12145550002', status: 'active' }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 15
  })

  // Customer calls Tenant A
  await processMissedCall(db, {
    callerNumber: '+19725550999',
    calledNumber: '+12145550001',
    callOutcome
  })

  // Customer calls Tenant B
  await processMissedCall(db, {
    callerNumber: '+19725550999',
    calledNumber: '+12145550002',
    callOutcome
  })

  // Tenant A and Tenant B must each have exactly 1 separate lead
  const leadA = db._tables.leads.filter((l) => l.org_id === 'org-tenant-a')
  const leadB = db._tables.leads.filter((l) => l.org_id === 'org-tenant-b')

  assert.strictEqual(leadA.length, 1)
  assert.strictEqual(leadB.length, 1)
  assert.notStrictEqual(leadA[0].id, leadB[0].id)
  assert.notStrictEqual(leadA[0].contact_id, leadB[0].contact_id, 'Contacts must never be merged across tenants')
})
