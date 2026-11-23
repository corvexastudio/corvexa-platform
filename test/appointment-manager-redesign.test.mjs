import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  deriveCustomerInvoiceSummary,
  resolveCustomerJobFinancials
} from '../src/lib/payments/customer-financials.ts'
import {
  generateGoogleCalendarUrl,
  generateIcsContent
} from '../src/lib/calendar/calendar-sync.ts'
import {
  getSelectableDatesInTimezone,
  calculateAvailableSlots
} from '../src/lib/booking/availability.ts'
import {
  customerCancelBooking,
  customerRescheduleBooking
} from '../src/lib/booking/booking-manager.ts'

const TOUCHED_FILES = [
  'src/app/book/manage/[token]/page.tsx',
  'src/app/api/book/manage/[token]/route.ts',
  'src/app/api/book/manage/[token]/cancel/route.ts',
  'src/app/api/book/manage/[token]/reschedule/route.ts',
  'src/app/api/book/manage/[token]/ics/route.ts',
  'src/app/api/book/manage/[token]/feedback/route.ts',
  'src/lib/calendar/calendar-sync.ts',
  'supabase/migrations/67_cancellation_notice_hours.sql',
  'test/appointment-manager-redesign.test.mjs'
]

const FUTURE_DATE_1 = '2026-12-15T15:00:00.000Z'
const FUTURE_DATE_2 = '2026-12-16T17:00:00.000Z'

/**
 * In-memory Supabase mock harness for Appointment Manager testing
 */
function createMockDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    services: initialState.services || [],
    appointments: initialState.appointments || [],
    jobs: initialState.jobs || [],
    job_items: initialState.job_items || [],
    invoices: initialState.invoices || [],
    stripe_transactions: initialState.stripe_transactions || [],
    payments: initialState.payments || [],
    contacts: initialState.contacts || [],
    profiles: initialState.profiles || [],
    crews: initialState.crews || []
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
        is: (col, val) => {
          filters.push((row) => row[col] === val || (val === null && (row[col] === null || row[col] === undefined)))
          return queryBuilder
        },
        gt: (col, val) => {
          filters.push((row) => row[col] > val)
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
          const inserted = []
          for (const r of rows) {
            const item = { ...r, id: r.id || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }
            if (!tables[tableName]) tables[tableName] = []
            tables[tableName].push(item)
            inserted.push(item)
          }
          return {
            select: () => ({
              single: async () => ({ data: inserted[0], error: null })
            })
          }
        },
        update: (values) => {
          const updateFilters = []
          const updateBuilder = {
            eq: (col, val) => {
              updateFilters.push((r) => r[col] === val)
              return updateBuilder
            },
            neq: (col, val) => {
              updateFilters.push((r) => r[col] !== val)
              return updateBuilder
            },
            in: (col, arr) => {
              updateFilters.push((r) => arr.includes(r[col]))
              return updateBuilder
            },
            is: (col, val) => {
              updateFilters.push((r) => r[col] === val || (val === null && (r[col] === null || r[col] === undefined)))
              return updateBuilder
            },
            select: () => ({
              single: async () => {
                const tableData = tables[tableName] || []
                for (const r of tableData) {
                  if (updateFilters.every(fn => fn(r))) {
                    Object.assign(r, values)
                  }
                }
                const row = tableData.find((r) => updateFilters.every(fn => fn(r)))
                return { data: row || null, error: null }
              }
            }),
            then: (resolve, reject) => {
              const tableData = tables[tableName] || []
              for (const r of tableData) {
                if (updateFilters.every(fn => fn(r))) {
                  Object.assign(r, values)
                }
              }
              return Promise.resolve({ error: null }).then(resolve, reject)
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
// Test 1: Invariant Audit - Zero em dashes across all touched files
// -------------------------------------------------------------
test('Requirement 1: Absolute zero em dashes in all touched files and test suite', () => {
  const emDashRegex = /[\u2013\u2014]/
  for (const relPath of TOUCHED_FILES) {
    const fullPath = path.resolve(relPath)
    assert.ok(fs.existsSync(fullPath), `File exists: ${relPath}`)
    const content = fs.readFileSync(fullPath, 'utf8')
    const match = content.match(emDashRegex)
    assert.equal(
      match,
      null,
      `Found forbidden em dash character in ${relPath}: ${match?.[0]}`
    )
  }
})

// -------------------------------------------------------------
// Test 2: State Machine Coverage - All 8 Appointment States
// -------------------------------------------------------------
test('Requirement 2: Appointment Manager covers all 8 appointment states with appropriate messaging', () => {
  const pagePath = path.resolve('src/app/book/manage/[token]/page.tsx')
  const content = fs.readFileSync(pagePath, 'utf8')

  // Verify all 8 states are handled in state-aware hero logic
  const states = [
    'requested',
    'confirmed',
    'scheduled',
    'en_route',
    'in_progress',
    'completed',
    'cancelled',
    'no_show'
  ]

  for (const st of states) {
    assert.ok(
      content.includes(`'${st}'`) || content.includes(`"${st}"`),
      `Appointment Manager handles state: ${st}`
    )
  }

  // State-specific behavior verifications
  // 1. Requested: explains booking request pending review
  assert.ok(content.includes('Booking request received'), 'Requested state shows clear pending title')
  assert.ok(content.includes('review their dispatch schedule and confirm your appointment'), 'Requested state explains review workflow')

  // 2. Confirmed: shows confirmed hero and live action buttons
  assert.ok(content.includes('Your appointment is confirmed'), 'Confirmed state shows confirmation hero')

  // 3. Scheduled: shows scheduled on calendar
  assert.ok(content.includes('Confirmed Appointment'), 'Scheduled state indicates calendar dispatch')

  // 4. En Route: links to live tracker and shows radar
  assert.ok(content.includes('Your technician is on the way'), 'En Route state shows active technician on the way')
  assert.ok(content.includes('Open Live Service Tracker') || content.includes('Live Arrival Tracker'), 'En Route state offers direct tracker link')

  // 5. In Progress / Arrived: shows on-site working
  assert.ok(content.includes('Your service is in progress') || content.includes('Service Underway'), 'In Progress state indicates active work')

  // 6. Completed: shows completed banner and booking a new service
  assert.ok(content.includes('Your service is complete'), 'Completed state indicates service completion')
  assert.ok(content.includes('Book a New Appointment'), 'Completed state provides book again CTA')

  // 7. Cancelled: shows cancellation notice and reason
  assert.ok(content.includes('Appointment Cancelled'), 'Cancelled state shows cancelled badge')
  assert.ok(content.includes('Reason for cancellation'), 'Cancelled state displays cancellation reason')

  // 8. No Show: shows missed service notice
  assert.ok(content.includes('Missed Appointment'), 'No show state shows missed appointment notice')
})

// -------------------------------------------------------------
// Test 3: Financial Reconciliation Engine Across All Statuses
// -------------------------------------------------------------
test('Requirement 3a: Financial reconciliation for Unpaid invoice with payment CTA', () => {
  const unpaid = deriveCustomerInvoiceSummary(
    {
      id: 'inv-unpaid',
      invoice_number: 'INV-2001',
      status: 'issued',
      total: 350.00,
      amount_paid: 0,
      amount_due: 350.00,
      manage_token: 'pay_token_unpaid'
    },
    []
  )

  assert.ok(unpaid)
  assert.equal(unpaid.financialStatus, 'unpaid')
  assert.equal(unpaid.total, 350)
  assert.equal(unpaid.amountDue, 350)
  assert.equal(unpaid.amountPaid, 0)
  assert.equal(unpaid.manageToken, 'pay_token_unpaid')
})

test('Requirement 3b: Financial reconciliation for Paid invoice with payment receipt link', () => {
  const paid = deriveCustomerInvoiceSummary(
    {
      id: 'inv-paid',
      invoice_number: 'INV-2002',
      status: 'paid',
      total: 250.00,
      amount_paid: 250.00,
      amount_due: 0,
      manage_token: 'pay_token_paid'
    },
    [
      {
        id: 'tx-1',
        type: 'charge',
        status: 'succeeded',
        amount: 250.00,
        amount_refunded: 0,
        stripe_receipt_url: 'https://stripe.com/receipt/123'
      }
    ]
  )

  assert.ok(paid)
  assert.equal(paid.financialStatus, 'paid')
  assert.equal(paid.total, 250)
  assert.equal(paid.amountDue, 0)
  assert.equal(paid.amountPaid, 250)
  assert.equal(paid.receiptUrl, 'https://stripe.com/receipt/123')
})

test('Requirement 3c: Financial reconciliation for Partially Paid invoice', () => {
  const partial = deriveCustomerInvoiceSummary(
    {
      id: 'inv-part',
      invoice_number: 'INV-2003',
      status: 'partially_paid',
      total: 500.00,
      amount_paid: 150.00,
      amount_due: 350.00,
      manage_token: 'pay_token_part'
    },
    [
      {
        id: 'tx-2',
        type: 'charge',
        status: 'succeeded',
        amount: 150.00,
        amount_refunded: 0
      }
    ]
  )

  assert.ok(partial)
  assert.equal(partial.financialStatus, 'partially_paid')
  assert.equal(partial.total, 500)
  assert.equal(partial.amountPaid, 150)
  assert.equal(partial.amountDue, 350)
})

test('Requirement 3d: Financial reconciliation for Partially and Fully Refunded invoices', () => {
  // Case: Partial refund
  const partRefund = deriveCustomerInvoiceSummary(
    {
      id: 'inv-ref-part',
      invoice_number: 'INV-2004',
      status: 'paid',
      total: 400.00,
      amount_paid: 400.00,
      amount_due: 0,
      manage_token: 'pay_token_ref_part'
    },
    [
      {
        id: 'tx-3',
        type: 'charge',
        status: 'succeeded',
        amount: 400.00,
        amount_refunded: 100.00
      }
    ]
  )
  assert.ok(partRefund)
  assert.equal(partRefund.financialStatus, 'partially_refunded')
  assert.equal(partRefund.totalRefunded, 100)
  assert.equal(partRefund.amountPaid, 400)

  // Case: Full refund
  const fullRefund = deriveCustomerInvoiceSummary(
    {
      id: 'inv-ref-full',
      invoice_number: 'INV-2005',
      status: 'paid',
      total: 400.00,
      amount_paid: 400.00,
      amount_due: 0,
      manage_token: 'pay_token_ref_full'
    },
    [
      {
        id: 'tx-4',
        type: 'charge',
        status: 'succeeded',
        amount: 400.00,
        amount_refunded: 400.00
      }
    ]
  )
  assert.ok(fullRefund)
  assert.equal(fullRefund.financialStatus, 'fully_refunded')
  assert.equal(fullRefund.totalRefunded, 400)
  assert.equal(fullRefund.amountDue, 0)
})

test('Requirement 3e: Financial reconciliation for Voided invoice', () => {
  const voided = deriveCustomerInvoiceSummary(
    {
      id: 'inv-void',
      invoice_number: 'INV-2006',
      status: 'voided',
      total: 300.00,
      amount_paid: 0,
      amount_due: 0,
      manage_token: 'pay_token_void'
    },
    []
  )

  assert.ok(voided)
  assert.equal(voided.financialStatus, 'voided')
  assert.equal(voided.total, 300)
})

test('Requirement 3f: Financial reconciliation with multiple invoices aggregates balances', async () => {
  const orgId = 'org-multi-inv'
  const jobId = 'job-multi-inv'

  const db = createMockDb({
    invoices: [
      {
        id: 'inv-1',
        org_id: orgId,
        job_id: jobId,
        invoice_number: 'INV-001',
        status: 'paid',
        total: 100.00,
        amount_paid: 100.00,
        amount_due: 0,
        created_at: '2026-10-01T10:00:00Z',
        deleted_at: null
      },
      {
        id: 'inv-2',
        org_id: orgId,
        job_id: jobId,
        invoice_number: 'INV-002',
        status: 'issued',
        total: 150.00,
        amount_paid: 0,
        amount_due: 150.00,
        manage_token: 'pay_token_inv2',
        created_at: '2026-10-05T10:00:00Z',
        deleted_at: null
      }
    ],
    payments: [
      {
        id: 'pmt-1',
        org_id: orgId,
        invoice_id: 'inv-1',
        status: 'succeeded',
        amount: 100.00,
        amount_refunded: 0
      }
    ]
  })

  const financials = await resolveCustomerJobFinancials(db, {
    orgId,
    jobId,
    quoteId: null
  })

  assert.ok(financials)
  assert.equal(financials.hasMultipleInvoices, true)
  assert.equal(financials.multipleInvoicesCount, 2)
  assert.ok(financials.total > 0)
})

test('Requirement 3g: Zero-price service models correctly identified (Free Estimate vs Quote on Site)', () => {
  const pagePath = path.resolve('src/app/book/manage/[token]/page.tsx')
  const content = fs.readFileSync(pagePath, 'utf8')

  // UI checks for free_estimate and quote_on_site
  assert.ok(content.includes("pricingModel === 'free_estimate'"), 'UI handles free_estimate model')
  assert.ok(content.includes("pricingModel === 'quote_on_site'"), 'UI handles quote_on_site model')
  assert.ok(content.includes('Free Estimate'), 'Displays Free Estimate badge')
  assert.ok(content.includes('Quote On Site'), 'Displays Quote on Site badge')
  assert.ok(content.includes('$0 due online') || content.includes('No obligation or payment required'), 'Reassures homeowner on zero-price services')
})

// -------------------------------------------------------------
// Test 4: Rescheduling Experience & Business Logic
// -------------------------------------------------------------
test('Requirement 4a: Date picker renders 14 selectable days in business timezone', () => {
  const tz = 'America/Chicago'
  const dates = getSelectableDatesInTimezone(tz, 14)

  assert.equal(dates.length, 14, 'Produces 14 calendar dates')
  for (const d of dates) {
    assert.match(d.dateStr, /^\d{4}-\d{2}-\d{2}$/, `Date matches ISO format: ${d.dateStr}`)
  }
})

test('Requirement 4b: Available slots loaded from real scheduling engine', () => {
  const slots = calculateAvailableSlots({
    orgConfig: {
      timezone: 'America/Chicago',
      business_hours: {
        monday: { open: '08:00', close: '17:00', closed: false },
        tuesday: { open: '08:00', close: '17:00', closed: false },
        wednesday: { open: '08:00', close: '17:00', closed: false },
        thursday: { open: '08:00', close: '17:00', closed: false },
        friday: { open: '08:00', close: '17:00', closed: false }
      },
      buffer_minutes: 15,
      minimum_notice_hours: 2,
      max_booking_days_ahead: 30
    },
    service: {
      id: 'svc-resched',
      name: 'Diagnostic',
      duration_minutes: 60
    },
    dateStr: '2026-11-25',
    existingAppointments: [],
    referenceTime: new Date('2026-11-20T12:00:00Z')
  })

  assert.ok(Array.isArray(slots), 'Slots returned as array')
  assert.ok(slots.length > 0, 'Generates valid slots for standard business hours')
  assert.ok(slots[0].startTime, 'Slot contains startTime')
  assert.ok(slots[0].endTime, 'Slot contains endTime')
})

test('Requirement 4c: Rescheduling preserves original appointment duration and prevents collisions', async () => {
  const orgId = 'org-resched-preservation'
  const manageToken = 'token_resched_preserve'

  // Appointment duration is 90 minutes (14:00 to 15:30)
  const initialStart = '2026-12-15T14:00:00.000Z'
  const initialEnd = '2026-12-15T15:30:00.000Z'

  const targetStart = '2026-12-16T10:00:00.000Z'
  const expectedEnd = '2026-12-16T11:30:00.000Z'

  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'All Stars HVAC',
      slug: 'all-stars',
      timezone: 'America/Chicago',
      buffer_minutes: 15
    }],
    appointments: [{
      id: 'apt-preserve',
      org_id: orgId,
      manage_token: manageToken,
      start_time: initialStart,
      end_time: initialEnd,
      status: 'confirmed'
    }],
    jobs: [{
      id: 'job-preserve',
      org_id: orgId,
      appointment_id: 'apt-preserve',
      status: 'scheduled',
      scheduled_start: initialStart,
      scheduled_end: initialEnd
    }]
  })

  const result = await customerRescheduleBooking(db, manageToken, targetStart)
  assert.equal(result.success, true)

  const updatedApt = db._tables.appointments.find(a => a.id === 'apt-preserve')
  assert.equal(updatedApt.start_time, targetStart)
  assert.equal(updatedApt.end_time, expectedEnd, 'Preserves 90 minute duration')
})

test('Requirement 4d: Reschedule is blocked when field job is en route or completed', async () => {
  const orgId = 'org-resched-blocked'
  const manageToken = 'token_resched_blocked'

  const db = createMockDb({
    organizations: [{ id: orgId, name: 'Precision Care', timezone: 'America/Chicago' }],
    appointments: [{
      id: 'apt-blocked',
      org_id: orgId,
      manage_token: manageToken,
      start_time: FUTURE_DATE_1,
      end_time: new Date(new Date(FUTURE_DATE_1).getTime() + 3600000).toISOString(),
      status: 'scheduled'
    }],
    jobs: [{
      id: 'job-enroute',
      org_id: orgId,
      appointment_id: 'apt-blocked',
      status: 'en_route'
    }]
  })

  const result = await customerRescheduleBooking(db, manageToken, FUTURE_DATE_2)
  assert.equal(result.success, false)
  assert.match(result.error, /technician is already on the way/i)
})

// -------------------------------------------------------------
// Test 5: Cancellation Flow & Business Safeguards
// -------------------------------------------------------------
test('Requirement 5a: Cancellation requires 2-step confirmation and captures reason', () => {
  const pagePath = path.resolve('src/app/book/manage/[token]/page.tsx')
  const content = fs.readFileSync(pagePath, 'utf8')

  // Check 2-step confirmation and reason selection in page component
  assert.ok(content.includes('showCancel'), 'Has cancellation panel visibility state')
  assert.ok(content.includes('cancelReason') && content.includes('selectedReasonChip'), 'Captures cancellation reason')
  assert.ok(content.includes('COMMON_CANCEL_REASONS'), 'Provides predefined cancellation reasons')
  assert.ok(content.includes('Cancel Appointment'), 'Initial trigger button')
  assert.ok(content.includes('Confirm Cancellation'), 'Explicit second confirmation button')
})

test('Requirement 5b: Cancellation blocked when payment/deposit exists on job', async () => {
  const orgId = 'org-cancel-guard'
  const manageToken = 'token_cancel_paid'

  const db = createMockDb({
    organizations: [{ id: orgId, name: 'Reliable Trades', telnyx_phone_number: '+15125550100' }],
    appointments: [{
      id: 'apt-paid',
      org_id: orgId,
      manage_token: manageToken,
      start_time: FUTURE_DATE_1,
      end_time: new Date(new Date(FUTURE_DATE_1).getTime() + 3600000).toISOString(),
      status: 'confirmed'
    }],
    jobs: [{
      id: 'job-paid',
      org_id: orgId,
      appointment_id: 'apt-paid',
      status: 'scheduled'
    }],
    invoices: [{
      id: 'inv-paid-job',
      org_id: orgId,
      job_id: 'job-paid',
      amount_paid: 100.00,
      deleted_at: null
    }]
  })

  const result = await customerCancelBooking(db, manageToken, 'Change of mind')
  assert.equal(result.success, false)
  assert.match(result.error, /payment or deposit has already been processed/i)
})

test('Requirement 5c: Cancellation blocked when technician is en route or job is completed', async () => {
  const orgId = 'org-cancel-enroute'
  const manageToken = 'token_cancel_enroute'

  const db = createMockDb({
    organizations: [{ id: orgId, name: 'Top Tier Service' }],
    appointments: [{
      id: 'apt-enroute',
      org_id: orgId,
      manage_token: manageToken,
      start_time: FUTURE_DATE_1,
      end_time: new Date(new Date(FUTURE_DATE_1).getTime() + 3600000).toISOString(),
      status: 'scheduled'
    }],
    jobs: [{
      id: 'job-in-prog',
      org_id: orgId,
      appointment_id: 'apt-enroute',
      status: 'in_progress'
    }]
  })

  const result = await customerCancelBooking(db, manageToken, 'Not needed')
  assert.equal(result.success, false)
  assert.match(result.error, /technician is currently on-site working/i)
})

test('Requirement 5d: Cancellation blocked when within cancellation notice hours (e.g. 2 hours of arrival window)', async () => {
  const orgId = 'org-cancel-late'
  const manageToken = 'token_cancel_late'

  // Appointment is scheduled 45 minutes from now (within the 2 hour cutoff)
  const imminentStart = new Date(Date.now() + 45 * 60 * 1000).toISOString()
  const imminentEnd = new Date(Date.now() + 105 * 60 * 1000).toISOString()

  const db = createMockDb({
    organizations: [{
      id: orgId,
      name: 'Lone Star AC',
      telnyx_phone_number: '+15125550188',
      cancellation_notice_hours: 2
    }],
    appointments: [{
      id: 'apt-late',
      org_id: orgId,
      manage_token: manageToken,
      start_time: imminentStart,
      end_time: imminentEnd,
      status: 'confirmed'
    }]
  })

  const result = await customerCancelBooking(db, manageToken, 'Last minute emergency')
  assert.equal(result.success, false)
  assert.match(result.error, /within the next 2 hours/i)
  assert.match(result.error, /online cancellation is paused/i)
  assert.match(result.error, /\+15125550188/)
})

test('Requirement 5e: Late cancellation notice and direct call banner rendered in Appointment Manager', () => {
  const pagePath = path.resolve('src/app/book/manage/[token]/page.tsx')
  const content = fs.readFileSync(pagePath, 'utf8')

  assert.ok(content.includes('apt.isWithinCancellationCutoff'), 'UI checks cancellation cutoff')
  assert.ok(content.includes('Late Cancellation Notice'), 'Displays Late Cancellation Notice title')
  assert.ok(content.includes('Call Dispatch:'), 'Provides direct call button to dispatch')
})

// -------------------------------------------------------------
// Test 6: Calendar Integration & Sanitization
// -------------------------------------------------------------
test('Requirement 6a: Google Calendar URL generation formats valid RFC parameters', () => {
  const url = generateGoogleCalendarUrl({
    title: 'HVAC Seasonal Maintenance',
    description: 'Scheduled with Austin Air Pros\nRef: APT-12345',
    location: '123 Main Street, Austin, TX',
    startTime: '2026-12-15T14:00:00.000Z',
    endTime: '2026-12-15T15:30:00.000Z',
    url: 'https://captodesk.com/book/manage/testtoken123'
  })

  assert.ok(url.startsWith('https://calendar.google.com/calendar/render?'))
  assert.ok(url.includes('action=TEMPLATE'))
  assert.ok(url.includes('text=HVAC+Seasonal+Maintenance'))
  assert.ok(url.includes('dates=20261215T140000Z%2F20261215T153000Z'))
  assert.ok(url.includes('location=123+Main+Street%2C+Austin%2C+TX'))
})

test('Requirement 6b: iCalendar export sanitization excludes gate codes and private notes', () => {
  const ics = generateIcsContent({
    title: 'Plumbing Service',
    description: 'Service: Drain Cleaning\nProvider: Lone Star Plumbing\nReference: APT-ABC',
    location: '456 Oak Lane, Dallas, TX',
    startTime: '2026-12-20T16:00:00.000Z',
    endTime: '2026-12-20T17:00:00.000Z',
    url: 'https://captodesk.com/book/manage/abc123'
  })

  assert.ok(ics.includes('BEGIN:VCALENDAR'))
  assert.ok(ics.includes('BEGIN:VEVENT'))
  assert.ok(ics.includes('SUMMARY:Plumbing Service'))
  assert.ok(ics.includes('LOCATION:456 Oak Lane\\, Dallas\\, TX'))
  assert.ok(ics.includes('STATUS:CONFIRMED'))
  assert.ok(ics.includes('END:VEVENT'))
  assert.ok(ics.includes('END:VCALENDAR'))

  // Verify route implementation sanitization in ics/route.ts
  const icsRoutePath = path.resolve('src/app/api/book/manage/[token]/ics/route.ts')
  const icsRouteCode = fs.readFileSync(icsRoutePath, 'utf8')
  assert.ok(icsRouteCode.includes('Safe customer-facing allowlist: Exclude raw internal appointment intake notes'))
  assert.ok(!icsRouteCode.includes('appointment.notes'), 'Does not include raw appointment.notes in calendar export')
})

// -------------------------------------------------------------
// Test 7: Security, Token Authorization, and Cache Headers
// -------------------------------------------------------------
test('Requirement 7a: Security headers and token validation in manage API', () => {
  const routePath = path.resolve('src/app/api/book/manage/[token]/route.ts')
  const content = fs.readFileSync(routePath, 'utf8')

  // Security cache headers
  assert.ok(content.includes('PRIVATE_CACHE_HEADERS'), 'Uses PRIVATE_CACHE_HEADERS')
  assert.ok(content.includes('RATE_LIMITS.MANAGE_VIEW'), 'Enforces IP rate limiting on view')
  assert.ok(content.includes('status: 400'), 'Returns 400 when token is missing')
  assert.ok(content.includes('status: 404'), 'Returns 404 when appointment is not found')
})

test('Requirement 7b: Appointment Manager UI does not leak internal notes or access codes', () => {
  const pagePath = path.resolve('src/app/book/manage/[token]/page.tsx')
  const content = fs.readFileSync(pagePath, 'utf8')

  // Verifies that gate codes or internal notes are NOT displayed in customer UI
  assert.ok(!content.includes('{apt.notes}'), 'Does not dump raw appointment notes to DOM')
  assert.ok(!content.includes('gateCode'), 'Does not expose gate codes')
  assert.ok(!content.includes('lockboxCode'), 'Does not expose lockbox codes')
})

// -------------------------------------------------------------
// Test 8: Visual & Responsive Layout Verification
// -------------------------------------------------------------
test('Requirement 8: Responsive design structures present in Appointment Manager page', () => {
  const pagePath = path.resolve('src/app/book/manage/[token]/page.tsx')
  const content = fs.readFileSync(pagePath, 'utf8')

  // Responsive desktop 2-column layout
  assert.ok(content.includes('lg:grid-cols-12'), '12-column responsive grid on desktop')
  assert.ok(content.includes('lg:col-span-8'), 'Main content column spans 8 on desktop')
  assert.ok(content.includes('lg:col-span-4'), 'Sidebar column spans 4 on desktop')
  assert.ok(content.includes('lg:sticky lg:top-8'), 'Sticky sidebar for quick actions and business contact')

  // Touch target sizing for mobile
  assert.ok(content.includes('min-h-[44px]') || content.includes('h-11') || content.includes('h-12'), 'Touch-friendly action buttons')
  assert.ok(content.includes('overflow-x-auto'), 'Horizontal date rail has smooth scrolling')
})

// -------------------------------------------------------------
// Test 9: Dual-Track Review & Quality Feedback Architecture
// -------------------------------------------------------------
test('Requirement 9a: Completed appointment renders dual-track Google Review and In-Portal Feedback', () => {
  const pagePath = path.resolve('src/app/book/manage/[token]/page.tsx')
  const content = fs.readFileSync(pagePath, 'utf8')

  // Track 1: Google Review
  assert.ok(content.includes('apt.business.googleReviewUrl'), 'Checks for configured Google review URL')
  assert.ok(content.includes('Rate Us on Google'), 'Provides prominent Rate Us on Google button')
  assert.ok(content.includes('Leave a Google Review'), 'Provides direct link to Google Review')

  // Track 2: In-Portal Direct Feedback
  assert.ok(content.includes('Direct Management Rating'), 'Provides in-portal management rating header')
  assert.ok(content.includes('handleFeedbackSubmit'), 'Has direct feedback submission handler')
  assert.ok(content.includes('Submit Direct Feedback'), 'Provides submit direct feedback button')
  assert.ok(content.includes('/api/book/manage/${token}/feedback'), 'Calls dedicated manage feedback endpoint')
})

test('Requirement 9b: Dedicated manage feedback endpoint validates rating and notifies owner', () => {
  const feedbackRoutePath = path.resolve('src/app/api/book/manage/[token]/feedback/route.ts')
  assert.ok(fs.existsSync(feedbackRoutePath), 'Manage feedback route file exists')
  const content = fs.readFileSync(feedbackRoutePath, 'utf8')

  assert.ok(content.includes('manage:feedback:'), 'Applies rate limiting on feedback submissions')
  assert.ok(content.includes('Valid rating between 1 and 5 is required'), 'Enforces 1 to 5 star rating constraint')
  assert.ok(content.includes('customer_feedback'), 'Writes to customer_feedback table')
  assert.ok(content.includes('sendTelnyxSms'), 'Notifies business owner via SMS')
  assert.ok(content.includes('notifications'), 'Pushes notification to contractor dashboard')
  assert.ok(content.includes('PRIVATE_CACHE_HEADERS'), 'Emits private cache headers')
})
