import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  deriveCustomerInvoiceSummary,
  resolveCustomerJobFinancials
} from '../src/lib/payments/customer-financials.ts'

const TOUCHED_FILES = [
  'supabase/migrations/65_historical_booking_snapshot.sql',
  'src/lib/payments/customer-financials.ts',
  'src/lib/booking/booking-manager.ts',
  'src/lib/jobs/job-manager.ts',
  'src/app/api/book/manage/[token]/route.ts',
  'src/app/book/manage/[token]/page.tsx',
  'src/app/track/[token]/page.tsx'
]

test('Invariant Audit: Absolute zero em dashes in Phase 2 files', () => {
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

test('Migration 65: historical booking snapshot column schema', () => {
  const sqlPath = path.resolve('supabase/migrations/65_historical_booking_snapshot.sql')
  assert.ok(fs.existsSync(sqlPath), 'Migration 65 file exists')
  const content = fs.readFileSync(sqlPath, 'utf8')
  assert.ok(content.includes('ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS booking_snapshot JSONB;'))
})

test('F-04 Historical Preservation: booking_snapshot saved at booking creation', () => {
  const bookingManagerPath = path.resolve('src/lib/booking/booking-manager.ts')
  const content = fs.readFileSync(bookingManagerPath, 'utf8')

  // Verify booking snapshot is created with service metadata, pricing model, estimate and add-ons
  assert.ok(content.includes('booking_snapshot: bookingSnapshot'), 'createBooking writes booking_snapshot to appointments')
  assert.ok(content.includes('id: activeService.id'), 'Snapshot includes active service id')
  assert.ok(content.includes('pricingModel: activePricing.model'), 'Snapshot records original pricing model')
  assert.ok(content.includes('addOns: authoritativeAddOns.map'), 'Snapshot records booked add-ons and unit pricing')
  assert.ok(content.includes('pricingSummary: {'), 'Snapshot records base price and total estimate')
})

test('F-04 Historical Preservation: Appointment manage API reconstructs historical service', () => {
  const manageApiPath = path.resolve('src/app/api/book/manage/[token]/route.ts')
  const content = fs.readFileSync(manageApiPath, 'utf8')

  // Verify route selects booking_snapshot
  assert.ok(content.includes('booking_snapshot'), 'Appointment query selects booking_snapshot')

  // Verify three-tier fallback: snapshot -> job line items -> catalog fallback
  assert.ok(content.includes("pricingSource: 'historical_snapshot'"), 'Uses historical snapshot when available')
  assert.ok(content.includes("pricingSource: 'historical_line_items'"), 'Reconstructs from job items for legacy appointments')
  assert.ok(content.includes("pricingSource: 'catalog_fallback'"), 'Gracefully falls back to catalog row if no historical data')

  // Verify invoice reconciliation is returned
  assert.ok(content.includes('resolveCustomerJobFinancials'), 'Calls canonical financial resolver')
  assert.ok(content.includes('invoice: invoice'), 'Returns authoritative invoice summary')
})

test('F-04 Historical Preservation: Appointment manage UI renders booked rate and add-ons', () => {
  const managePagePath = path.resolve('src/app/book/manage/[token]/page.tsx')
  const content = fs.readFileSync(managePagePath, 'utf8')

  // Add-ons breakdown
  assert.ok(content.includes('Historical Booked Add-ons Breakdown'), 'Manage page renders booked add-ons')
  assert.ok(content.includes('apt.service?.addOns'), 'Iterates over booked add-ons')
  assert.ok(content.includes('apt.service.pricingSummary'), 'Uses historical pricing summary')
  assert.ok(content.includes('Booked rate'), 'Indicates preserved booked rate when historical data is present')
})

test('Authoritative Invoices: deriveCustomerInvoiceSummary ledger derivation', () => {
  // Case 1: Issued unpaid invoice
  const unpaid = deriveCustomerInvoiceSummary(
    {
      id: 'inv-1',
      invoice_number: 'INV-1001',
      status: 'issued',
      total: 150.00,
      amount_paid: 0,
      amount_due: 150.00,
      manage_token: 'tok-1001'
    },
    []
  )
  assert.ok(unpaid)
  assert.equal(unpaid.financialStatus, 'unpaid')
  assert.equal(unpaid.total, 150)
  assert.equal(unpaid.amountDue, 150)
  assert.equal(unpaid.amountPaid, 0)
  assert.equal(unpaid.totalRefunded, 0)

  // Case 2: Partially paid invoice
  const partial = deriveCustomerInvoiceSummary(
    {
      id: 'inv-2',
      invoice_number: 'INV-1002',
      status: 'issued',
      total: 200.00,
      amount_paid: 50.00,
      amount_due: 150.00,
      manage_token: 'tok-1002'
    },
    [
      {
        invoice_id: 'inv-2',
        amount: 50.00,
        status: 'succeeded',
        stripe_receipt_url: 'https://pay.stripe.com/receipt/1'
      }
    ]
  )
  assert.ok(partial)
  assert.equal(partial.financialStatus, 'partially_paid')
  assert.equal(partial.amountPaid, 50)
  assert.equal(partial.amountDue, 150)
  assert.equal(partial.receiptUrl, 'https://pay.stripe.com/receipt/1')

  // Case 3: Fully paid invoice
  const paid = deriveCustomerInvoiceSummary(
    {
      id: 'inv-3',
      invoice_number: 'INV-1003',
      status: 'paid',
      total: 300.00,
      amount_paid: 300.00,
      amount_due: 0,
      manage_token: 'tok-1003'
    },
    [
      {
        invoice_id: 'inv-3',
        amount: 300.00,
        status: 'succeeded',
        stripe_receipt_url: 'https://pay.stripe.com/receipt/3'
      }
    ]
  )
  assert.ok(paid)
  assert.equal(paid.financialStatus, 'paid')
  assert.equal(paid.amountPaid, 300)
  assert.equal(paid.amountDue, 0)
  assert.equal(paid.receiptUrl, 'https://pay.stripe.com/receipt/3')

  // Case 4: Fully refunded invoice (Must NOT be reported as 'paid'!)
  const fullyRefunded = deriveCustomerInvoiceSummary(
    {
      id: 'inv-4',
      invoice_number: 'INV-1004',
      status: 'paid',
      total: 250.00,
      amount_paid: 250.00,
      amount_due: 0,
      manage_token: 'tok-1004'
    },
    [
      {
        invoice_id: 'inv-4',
        amount: 250.00,
        status: 'succeeded',
        refunded: true,
        amount_refunded: 250.00,
        stripe_receipt_url: 'https://pay.stripe.com/receipt/4'
      }
    ]
  )
  assert.ok(fullyRefunded)
  assert.equal(fullyRefunded.financialStatus, 'fully_refunded')
  assert.equal(fullyRefunded.totalRefunded, 250)
  assert.equal(fullyRefunded.amountDue, 0)

  // Case 5: Partially refunded invoice
  const partiallyRefunded = deriveCustomerInvoiceSummary(
    {
      id: 'inv-5',
      invoice_number: 'INV-1005',
      status: 'paid',
      total: 200.00,
      amount_paid: 200.00,
      amount_due: 0,
      manage_token: 'tok-1005'
    },
    [
      {
        invoice_id: 'inv-5',
        amount: 200.00,
        status: 'succeeded',
        amount_refunded: 50.00
      }
    ]
  )
  assert.ok(partiallyRefunded)
  assert.equal(partiallyRefunded.financialStatus, 'partially_refunded')
  assert.equal(partiallyRefunded.totalRefunded, 50)
  assert.equal(partiallyRefunded.amountPaid, 200)

  // Case 6: Voided invoice
  const voided = deriveCustomerInvoiceSummary(
    {
      id: 'inv-6',
      invoice_number: 'INV-1006',
      status: 'voided',
      total: 180.00,
      amount_paid: 0,
      amount_due: 0,
      manage_token: 'tok-1006'
    },
    []
  )
  assert.ok(voided)
  assert.equal(voided.financialStatus, 'voided')

  // Case 7: Multiple invoices for job
  const multi = deriveCustomerInvoiceSummary(
    {
      id: 'inv-7a',
      invoice_number: 'INV-1007A',
      status: 'issued',
      total: 100.00,
      amount_due: 100.00
    },
    [],
    2
  )
  assert.ok(multi)
  assert.equal(multi.hasMultipleInvoices, true)
  assert.equal(multi.multipleInvoicesCount, 2)
})

test('Authoritative Invoices: resolveCustomerJobFinancials returns null when no matching invoices', async () => {
  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            is: () => ({
              order: () => Promise.resolve({ data: [] })
            })
          })
        })
      })
    })
  }

  const res = await resolveCustomerJobFinancials(mockSupabase, {
    orgId: 'org-1',
    jobId: 'job-empty'
  })
  assert.equal(res, null)
})

test('Authoritative Invoices: Rendered in Appointment Manager (/book/manage/[token])', () => {
  const managePagePath = path.resolve('src/app/book/manage/[token]/page.tsx')
  const content = fs.readFileSync(managePagePath, 'utf8')

  assert.ok(content.includes('AUTHORITATIVE FINAL INVOICE & PAYMENT CARD'), 'Authoritative invoice card rendered')
  assert.ok(content.includes("apt.invoice.financialStatus === 'paid'"), 'Handles paid state with receipt')
  assert.ok(content.includes("apt.invoice.financialStatus === 'fully_refunded'"), 'Handles fully refunded state')
  assert.ok(content.includes("apt.invoice.financialStatus === 'partially_refunded'"), 'Handles partially refunded state')
  assert.ok(content.includes("apt.invoice.financialStatus === 'voided'"), 'Handles voided state')
  assert.ok(content.includes('Pay Balance'), 'Provides payment link when balance is due')
})

test('F-06 Job State & Cancellation: Cancelled and no-show do not fall back to stage 0 (Scheduled)', () => {
  const trackerPagePath = path.resolve('src/app/track/[token]/page.tsx')
  const content = fs.readFileSync(trackerPagePath, 'utf8')

  // Verify dedicated cancellation card exists
  assert.ok(content.includes('Appointment Cancelled'), 'Dedicated cancellation UI is present')
  assert.ok(content.includes('isCancelled ? ('), 'Renders dedicated cancellation section instead of 5-stage stepper')

  // Verify dedicated missed visit card exists
  assert.ok(content.includes('Missed Service Visit'), 'Dedicated missed visit UI is present')
  assert.ok(content.includes('isNoShow ? ('), 'Renders dedicated missed visit section instead of 5-stage stepper')

  // Verify getStageIndex does not classify cancelled or no-show as stage 0
  assert.ok(
    content.includes("const isCancelled = job.status === 'cancelled'"),
    'Explicit isCancelled flag derived from status'
  )
  assert.ok(
    content.includes("const isNoShow = job.status === 'no_show'"),
    'Explicit isNoShow flag derived from status'
  )
})

test('F-08 Trust & Tracking: Fabricated geofence radar copy is completely removed', () => {
  const trackerPagePath = path.resolve('src/app/track/[token]/page.tsx')
  const content = fs.readFileSync(trackerPagePath, 'utf8')

  // Verify fabricated copy is absent
  assert.ok(
    !content.includes('Live Geofence Active'),
    'Tracker must not claim fake Live Geofence Active'
  )
  assert.ok(
    !content.includes('Vehicle is within'),
    'Tracker must not fabricate proximity radar vehicle mileage'
  )

  // Verify stale ETA handling
  assert.ok(
    content.includes('Arrival pending'),
    'Stale ETA gracefully falls back to Arrival pending'
  )
})

test('F-09 Trust & Technician: Unsupported verification claims are removed', () => {
  const trackerPagePath = path.resolve('src/app/track/[token]/page.tsx')
  const content = fs.readFileSync(trackerPagePath, 'utf8')

  // Removed fabricated badges
  assert.ok(
    !content.includes('Identity Verified'),
    'Removed unverified Identity Verified badge'
  )
  assert.ok(
    !content.includes('Insured and background verified'),
    'Removed fabricated background verified claim'
  )
  assert.ok(
    !content.includes('State Certified Trade License'),
    'Neutralized trade license display'
  )

  // Neutral technician fallback
  assert.ok(
    content.includes('Assigned Service Professional'),
    'Neutral fallback when technician is unassigned'
  )
})

test('F-07 Trust & Referral: Neutral recommendation language replaces fake monetary claims', () => {
  const trackerPagePath = path.resolve('src/app/track/[token]/page.tsx')
  const content = fs.readFileSync(trackerPagePath, 'utf8')

  // Removed fake hardcoded monetary promises
  assert.ok(
    !content.includes('Give $25, Get $25'),
    'Removed unsupported $25 reward promises'
  )

  // Neutral recommendation copy
  assert.ok(
    content.includes('Refer a Neighbor - Recommend'),
    'Neutral recommendation title'
  )
})

test('F-11 Performance: Polling stops on terminal state and pauses on hidden tab', () => {
  const trackerPagePath = path.resolve('src/app/track/[token]/page.tsx')
  const content = fs.readFileSync(trackerPagePath, 'utf8')

  // Terminal state check
  assert.ok(
    content.includes("['completed', 'cancelled', 'no_show'].includes(data.job.status)"),
    'Terminal states check includes completed, cancelled, and no_show'
  )

  // Visibility change listener
  assert.ok(
    content.includes("document.addEventListener('visibilitychange', handleVisibilityChange)"),
    'Pauses polling when browser tab is hidden'
  )

  // Overlapping request guard
  assert.ok(
    content.includes('inFlightRef.current'),
    'Prevents overlapping in-flight polling requests'
  )
})
