import test from 'node:test'
import assert from 'node:assert/strict'
import {
  customerViewInvoice,
  recordPayment,
  createInvoice
} from '../src/lib/payments/invoice-manager.ts'
import { scheduleInvoiceReviewAutomation } from '../src/lib/reviews/review-manager.ts'

// Mock in-memory database harness matching Supabase PostgREST semantics
function createMockDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    contacts: initialState.contacts || [],
    invoices: initialState.invoices || [],
    invoice_items: initialState.invoice_items || [],
    job_photos: initialState.job_photos || [],
    automation_runs: initialState.automation_runs || [],
    compliance_logs: initialState.compliance_logs || [],
    events: initialState.events || [],
    payments: initialState.payments || []
  }

  return {
    _tables: tables,
    from: (tableName) => {
      let filters = []
      let orderCol = null
      let orderAsc = true

      const builder = {
        select: (cols) => {
          return builder
        },
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return builder
        },
        in: (col, arr) => {
          filters.push((row) => Array.isArray(arr) && arr.includes(row[col]))
          return builder
        },
        order: (col, opts = {}) => {
          orderCol = col
          orderAsc = opts.ascending !== false
          return builder
        },
        insert: (records) => {
          const toInsert = Array.isArray(records) ? records : [records]
          const inserted = toInsert.map((item, idx) => ({
            id: item.id || `gen-${Date.now()}-${idx}`,
            created_at: new Date().toISOString(),
            ...item
          }))
          if (!tables[tableName]) tables[tableName] = []
          tables[tableName].push(...inserted)

          const result = {
            data: inserted,
            error: null
          }

          return {
            ...result,
            select: () => ({
              single: async () => ({ data: inserted[0], error: null }),
              then: (resolve) => resolve({ data: inserted, error: null })
            }),
            then: (resolve) => resolve(result)
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
              updateFilters.push((row) => Array.isArray(arr) && arr.includes(row[col]))
              return updateBuilder
            },
            select: () => ({
              single: async () => {
                const tableData = tables[tableName] || []
                let updated = null
                for (const row of tableData) {
                  if (updateFilters.every((fn) => fn(row))) {
                    Object.assign(row, updates)
                    updated = row
                  }
                }
                return { data: updated, error: null }
              },
              then: (resolve) => {
                const tableData = tables[tableName] || []
                const updatedRows = []
                for (const row of tableData) {
                  if (updateFilters.every((fn) => fn(row))) {
                    Object.assign(row, updates)
                    updatedRows.push(row)
                  }
                }
                return resolve({ data: updatedRows, error: null })
              }
            }),
            then: (resolve) => {
              const tableData = tables[tableName] || []
              const updatedRows = []
              for (const row of tableData) {
                if (updateFilters.every((fn) => fn(row))) {
                  Object.assign(row, updates)
                  updatedRows.push(row)
                }
              }
              return resolve({ data: updatedRows, error: null })
            }
          }
          return updateBuilder
        },
        single: async () => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          if (filtered.length === 0) {
            return { data: null, error: new Error('Row not found') }
          }
          return { data: filtered[0], error: null }
        },
        maybeSingle: async () => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          return { data: filtered[0] || null, error: null }
        },
        then: (resolve) => {
          const tableData = tables[tableName] || []
          let filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          if (orderCol) {
            filtered.sort((a, b) => {
              if (a[orderCol] < b[orderCol]) return orderAsc ? -1 : 1
              if (a[orderCol] > b[orderCol]) return orderAsc ? 1 : -1
              return 0
            })
          }
          return resolve({ data: filtered, error: null })
        }
      }

      return builder
    }
  }
}

// --- UNIT TESTS ---

test('PHASE 5: Interactive Web Invoice Token Resolution & Proof of Work', async (t) => {
  await t.test('resolves public invoice with contact details, trade license, and job proof photos', async () => {
    const db = createMockDb({
      organizations: [
        {
          id: 'org-plumb-1',
          name: 'Apex Plumbing Co',
          owner_phone: '+15125550199',
          license_number: 'MPL-449102',
          industry: 'plumbing',
          address_street: '100 Tradesman Way',
          address_city: 'Austin',
          address_state: 'TX',
          address_postal_code: '78701',
          payment_instructions: 'Zelle: pay@apexplumb.com or check payable to Apex Plumbing Co'
        }
      ],
      contacts: [
        {
          id: 'contact-sarah',
          org_id: 'org-plumb-1',
          name: 'Sarah Connor',
          phone: '+15125550122',
          email: 'sarah@example.com',
          address_street: '4412 Oak Crest Dr',
          address_city: 'Austin',
          address_state: 'TX'
        }
      ],
      invoices: [
        {
          id: 'inv-101',
          org_id: 'org-plumb-1',
          contact_id: 'contact-sarah',
          job_id: 'job-leak-1',
          invoice_number: 'INV-1001',
          title: 'Water Heater Replacement & Valve Rebuild',
          subtotal: 1450,
          tax: 0,
          discount: 50,
          total: 1400,
          amount_paid: 0,
          amount_due: 1400,
          status: 'sent',
          due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
          manage_token: 'token-inv-abc123'
        }
      ],
      invoice_items: [
        {
          id: 'item-1',
          invoice_id: 'inv-101',
          description: '40-Gallon Gas Water Heater unit & brass ball valve',
          quantity: 1,
          unit_price: 1250,
          total: 1250
        },
        {
          id: 'item-2',
          invoice_id: 'inv-101',
          description: 'Haul-away and safe recycling of old leaking water heater',
          quantity: 1,
          unit_price: 200,
          total: 200
        }
      ],
      job_photos: [
        {
          id: 'photo-before',
          org_id: 'org-plumb-1',
          job_id: 'job-leak-1',
          photo_type: 'before',
          url: 'https://images.unsplash.com/photo-broken-valve',
          caption: 'Original corroded shut-off valve leaking into drain pan'
        },
        {
          id: 'photo-after',
          org_id: 'org-plumb-1',
          job_id: 'job-leak-1',
          photo_type: 'after',
          url: 'https://images.unsplash.com/photo-new-unit',
          caption: 'Brand new 40-gal unit with new expansion tank and brass valve'
        }
      ]
    })

    const result = await customerViewInvoice(db, 'token-inv-abc123')
    assert.equal(result.success, true)
    assert.ok(result.invoice)
    assert.equal(result.invoice.invoice_number, 'INV-1001')
    assert.equal(result.items.length, 2)
    assert.equal(result.jobPhotos.length, 2)

    // Verify proof of work photos include before and after
    const types = result.jobPhotos.map((p) => p.photo_type)
    assert.ok(types.includes('before'))
    assert.ok(types.includes('after'))

    // Verify status was transitioned from 'sent' to 'viewed' upon customer visit
    assert.equal(result.invoice.status, 'viewed')
    assert.ok(result.invoice.viewed_at)

    // Verify contractor trade license badge is returned
    assert.equal(result.org?.license_number, 'MPL-449102')
  })
})

test('PHASE 5: Automated 15-Minute Google Review Trigger', async (t) => {
  await t.test('enqueues review automation run 15 minutes after invoice payment in full', async () => {
    const db = createMockDb({
      organizations: [
        {
          id: 'org-rev-1',
          name: 'Cool Breeze HVAC',
          is_review_engine_active: true,
          review_requests_enabled: true,
          google_review_url: 'https://g.page/r/cool-breeze-hvac/review'
        }
      ],
      automation_runs: []
    })

    const result = await scheduleInvoiceReviewAutomation(db, {
      orgId: 'org-rev-1',
      invoiceId: 'inv-hvac-99',
      contactId: 'contact-dave',
      delayMinutes: 15
    })

    assert.equal(result.scheduled, true)
    assert.ok(result.scheduledAt)

    const runs = db._tables.automation_runs
    assert.equal(runs.length, 1)
    const run = runs[0]
    assert.equal(run.org_id, 'org-rev-1')
    assert.equal(run.event_type, 'invoice.paid')
    assert.equal(run.action_type, 'send_review_request')
    assert.equal(run.status, 'scheduled')
    assert.equal(run.event_payload.invoice_id, 'inv-hvac-99')

    // Verify scheduled time is roughly 15 minutes in the future (within 2-second tolerance)
    const scheduledMs = new Date(run.scheduled_at).getTime()
    const expectedMs = Date.now() + 15 * 60 * 1000
    assert.ok(Math.abs(scheduledMs - expectedMs) < 3000)
  })

  await t.test('suppresses review automation if organization has no Google review URL configured', async () => {
    const db = createMockDb({
      organizations: [
        {
          id: 'org-no-google',
          name: 'Silent Plumbing',
          is_review_engine_active: true,
          review_requests_enabled: true,
          google_review_url: null
        }
      ],
      automation_runs: []
    })

    const result = await scheduleInvoiceReviewAutomation(db, {
      orgId: 'org-no-google',
      invoiceId: 'inv-plumb-20',
      contactId: 'contact-alice'
    })

    assert.equal(result.scheduled, false)
    assert.equal(result.reason, 'reviews_disabled_or_no_url')
    assert.equal(db._tables.automation_runs.length, 0)
  })
})

test('PHASE 5: Offline Payment Recording & Transactional Receipt Generation', async (t) => {
  await t.test('recording full offline payment marks invoice paid and triggers receipt generation', async () => {
    const db = createMockDb({
      organizations: [
        {
          id: 'org-pay-1',
          name: 'High Volt Electric',
          owner_phone: '+15125550188',
          is_review_engine_active: true,
          review_requests_enabled: true,
          google_review_url: 'https://g.page/r/high-volt/review'
        }
      ],
      contacts: [
        {
          id: 'contact-mike',
          org_id: 'org-pay-1',
          name: 'Mike Vance',
          phone: '+15125550344'
        }
      ],
      invoices: [
        {
          id: 'inv-volt-1',
          org_id: 'org-pay-1',
          contact_id: 'contact-mike',
          invoice_number: 'INV-2045',
          title: 'EV Charger Installation',
          subtotal: 850,
          total: 850,
          amount_paid: 0,
          amount_due: 850,
          status: 'sent',
          due_date: new Date().toISOString(),
          manage_token: 'token-volt-receipt'
        }
      ],
      automation_runs: [],
      payments: []
    })

    const result = await recordPayment(db, {
      invoiceId: 'inv-volt-1',
      orgId: 'org-pay-1',
      amount: 850,
      paymentMethod: 'cash',
      referenceNote: 'Cash received on site by electrician'
    })

    assert.equal(result.success, true)
    assert.equal(result.invoice.status, 'paid')
    assert.equal(result.invoice.amount_paid, 850)
    assert.equal(result.invoice.amount_due, 0)
    assert.ok(result.invoice.paid_at)

    // Verify Google Review Automation was scheduled
    const reviewRuns = db._tables.automation_runs.filter(
      (r) => r.action_type === 'send_review_request'
    )
    assert.equal(reviewRuns.length, 1)
  })
})
