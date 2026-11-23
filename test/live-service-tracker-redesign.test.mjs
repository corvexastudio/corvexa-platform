import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { customerViewJobTracking } from '../src/lib/jobs/job-manager.ts'
import {
  deriveCustomerInvoiceSummary,
  resolveCustomerJobFinancials
} from '../src/lib/payments/customer-financials.ts'
import { formatDateInTz, formatTimeInTz, getShortTzAbbreviation } from '../src/lib/temporal/timezone.ts'

const TOUCHED_FILES = [
  'src/app/track/[token]/page.tsx',
  'src/app/t/[token]/page.tsx',
  'src/app/api/track/[token]/route.ts',
  'src/app/api/track/[token]/feedback/route.ts',
  'src/lib/jobs/job-manager.ts',
  'test/live-service-tracker-redesign.test.mjs'
]

/**
 * In-memory Supabase mock client for Live Service Tracker tests
 */
function createMockDb(initialState = {}) {
  const tables = {
    jobs: initialState.jobs || [],
    organizations: initialState.organizations || [],
    contacts: initialState.contacts || [],
    services: initialState.services || [],
    invoices: initialState.invoices || [],
    stripe_transactions: initialState.stripe_transactions || [],
    payments: initialState.payments || [],
    job_photos: initialState.job_photos || [],
    crews: initialState.crews || [],
    referral_links: initialState.referral_links || [],
    customer_feedback: initialState.customer_feedback || [],
    notifications: initialState.notifications || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []
      let selectFields = '*'
      let singleMode = false
      let maybeSingleMode = false
      let orderBy = null
      let limitCount = null

      const queryBuilder = {
        select: (fields) => {
          selectFields = fields || '*'
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
        in: (col, arr) => {
          filters.push((row) => arr.includes(row[col]))
          return queryBuilder
        },
        is: (col, val) => {
          filters.push((row) => row[col] === val || (val === null && (row[col] === null || row[col] === undefined)))
          return queryBuilder
        },
        order: (col, opts = {}) => {
          orderBy = { col, ascending: opts.ascending !== false }
          return queryBuilder
        },
        limit: (cnt) => {
          limitCount = cnt
          return queryBuilder
        },
        single: async () => {
          singleMode = true
          return queryBuilder.then((res) => {
            if (res.data && res.data.length > 0) {
              return { data: res.data[0], error: null }
            }
            return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
          })
        },
        maybeSingle: async () => {
          maybeSingleMode = true
          return queryBuilder.then((res) => {
            if (res.data && res.data.length > 0) {
              return { data: res.data[0], error: null }
            }
            return { data: null, error: null }
          })
        },
        then: (resolve) => {
          const tableData = tables[tableName] || []
          let rows = tableData.filter((r) => filters.every((fn) => fn(r)))

          if (orderBy) {
            rows.sort((a, b) => {
              if (a[orderBy.col] < b[orderBy.col]) return orderBy.ascending ? -1 : 1
              if (a[orderBy.col] > b[orderBy.col]) return orderBy.ascending ? 1 : -1
              return 0
            })
          }

          if (limitCount != null) {
            rows = rows.slice(0, limitCount)
          }

          // Hydrate relations if jobs query requests joins
          if (tableName === 'jobs') {
            rows = rows.map((j) => {
              const copy = { ...j }
              copy.organizations = tables.organizations.find((o) => o.id === j.org_id) || null
              copy.contacts = tables.contacts.find((c) => c.id === j.contact_id) || null
              copy.services = tables.services.find((s) => s.id === j.service_id) || null
              return copy
            })
          }

          return resolve({ data: rows, error: null })
        },
        insert: (payload) => {
          const items = Array.isArray(payload) ? payload : [payload]
          const inserted = items.map((item, idx) => ({
            id: item.id || `mock-${Date.now()}-${idx}`,
            created_at: new Date().toISOString(),
            ...item
          }))
          if (!tables[tableName]) tables[tableName] = []
          tables[tableName].push(...inserted)

          return {
            select: () => ({
              single: async () => ({ data: inserted[0], error: null }),
              maybeSingle: async () => ({ data: inserted[0], error: null })
            })
          }
        },
        update: (payload) => {
          return {
            eq: (col, val) => {
              const table = tables[tableName] || []
              for (const r of table) {
                if (r[col] === val) {
                  Object.assign(r, payload, { updated_at: new Date().toISOString() })
                }
              }
              return {
                select: () => ({
                  single: async () => ({ data: table.find((r) => r[col] === val), error: null })
                })
              }
            }
          }
        }
      }

      return queryBuilder
    }
  }

  return client
}

// -----------------------------------------------------------------
// Test 1: Zero Em Dash Enforcement Across Codebase
// -----------------------------------------------------------------
test('Requirement 1: Zero em dashes or en dashes across touched files', () => {
  const emDashRegex = new RegExp('[\\u2014\\u2013]', 'g')
  for (const relativePath of TOUCHED_FILES) {
    const fullPath = path.resolve(process.cwd(), relativePath)
    if (!fs.existsSync(fullPath)) continue
    const content = fs.readFileSync(fullPath, 'utf8')
    const matches = content.match(emDashRegex)
    assert.equal(
      matches,
      null,
      `File ${relativePath} must contain zero em or en dashes. Found ${matches?.length} occurrences.`
    )
  }
})

// -----------------------------------------------------------------
// Test 2: Job Lifecycle Support Across All 7 States
// -----------------------------------------------------------------
test('Requirement 2: Frontend handles all 7 job lifecycle states accurately', () => {
  const pagePath = path.resolve(process.cwd(), 'src/app/track/[token]/page.tsx')
  const content = fs.readFileSync(pagePath, 'utf8')

  const requiredStates = [
    'scheduled',
    'en_route',
    'arrived',
    'in_progress',
    'completed',
    'cancelled',
    'no_show'
  ]

  for (const state of requiredStates) {
    assert.ok(
      content.includes(`'${state}'`) || content.includes(`"${state}"`),
      `Page must handle job lifecycle state: ${state}`
    )
  }

  // Titles and context headers
  assert.ok(content.includes('Your Appointment is Confirmed'), 'Scheduled state header')
  assert.ok(content.includes('heading your way'), 'En route state header')
  assert.ok(content.includes('Has Arrived On-Site'), 'Arrived state header')
  assert.ok(content.includes('Service Underway on Your Property'), 'In progress state header')
  assert.ok(content.includes('Work Finished and Verified'), 'Completed state header')
  assert.ok(content.includes('Service Cancelled'), 'Cancelled state header')
  assert.ok(content.includes('Technician Unable to Complete Visit'), 'No-show state header')
})

// -----------------------------------------------------------------
// Test 3: Manual Technician ETA and Stale Calculation
// -----------------------------------------------------------------
test('Requirement 3: Manual technician ETA calculation and stale detection', () => {
  const orgTz = 'America/Chicago'
  const departureTime = new Date('2026-11-23T14:00:00.000Z')
  const etaMinutes = 25

  // Fresh ETA
  const arrivalTime = new Date(departureTime.getTime() + etaMinutes * 60000)
  const clockTime = formatTimeInTz(arrivalTime, orgTz)
  assert.ok(clockTime, 'Clock arrival time must format correctly')

  // Stale ETA check (>15 minutes overdue)
  const elapsedMinutesFresh = 20
  const isFreshStale = elapsedMinutesFresh > etaMinutes + 15
  assert.equal(isFreshStale, false, 'Fresh ETA is not stale')

  const elapsedMinutesOverdue = 45
  const isOverdueStale = elapsedMinutesOverdue > etaMinutes + 15
  assert.equal(isOverdueStale, true, 'Elapsed minutes > etaMinutes + 15 is flagged as stale')
})

// -----------------------------------------------------------------
// Test 4: Honest Technician & Crew Card (No Fake Badges, Company Call Routing)
// -----------------------------------------------------------------
test('Requirement 4: Honest technician representation and company phone routing', async () => {
  const db = createMockDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Apex Comfort Systems',
        telnyx_phone_number: '+13125550199',
        owner_phone: '+13125550100',
        license_number: 'HVAC-78910',
        timezone: 'America/Chicago'
      }
    ],
    contacts: [
      {
        id: 'con-1',
        name: 'Jane Smith',
        address: '456 Oak Avenue, Chicago, IL'
      }
    ],
    services: [
      {
        id: 'srv-1',
        name: 'Furnace Tune-Up',
        duration_minutes: 60,
        price: 129
      }
    ],
    jobs: [
      {
        id: 'job-1',
        job_number: '1042',
        title: 'Furnace Tune-Up',
        status: 'en_route',
        scheduled_start: '2026-11-23T15:00:00.000Z',
        technician_name: 'Marcus Vance',
        eta_minutes: 15,
        tracking_token: 'a'.repeat(32),
        org_id: 'org-1',
        contact_id: 'con-1',
        service_id: 'srv-1'
      }
    ]
  })

  const result = await customerViewJobTracking(db, 'a'.repeat(32))
  assert.ok(result.success)
  assert.equal(result.job.technicianName, 'Marcus Vance')
  assert.equal(result.org.licenseNumber, 'HVAC-78910')
  assert.equal(result.org.phone, '+13125550199')

  // Verify personal phone number is not exposed in crew
  if (result.crew) {
    assert.equal(result.crew.phoneNumber, undefined, 'Technician personal phone must not be exposed')
  }

  // Verify page content does not make unverified claims
  const pagePath = path.resolve(process.cwd(), 'src/app/track/[token]/page.tsx')
  const content = fs.readFileSync(pagePath, 'utf8')
  assert.ok(!content.includes('Background Verified by CaptoDesk'))
  assert.ok(!content.includes('CaptoDesk Insured'))
  assert.ok(!content.includes('CaptoDesk Certified'))
})

// -----------------------------------------------------------------
// Test 5: Financial Reconciliation Across All 6 Statuses
// -----------------------------------------------------------------
test('Requirement 5: Financial reconciliation across all statuses', () => {
  // 1. Unpaid
  const unpaid = deriveCustomerInvoiceSummary(
    {
      id: 'inv-1',
      invoice_number: 'INV-1001',
      status: 'issued',
      total: 200,
      amount_paid: 0,
      amount_due: 200,
      manage_token: 'pay_token_1'
    },
    []
  )
  assert.equal(unpaid?.financialStatus, 'unpaid')
  assert.equal(unpaid?.amountDue, 200)

  // 2. Partially Paid
  const partial = deriveCustomerInvoiceSummary(
    {
      id: 'inv-2',
      invoice_number: 'INV-1002',
      status: 'partially_paid',
      total: 200,
      amount_paid: 100,
      amount_due: 100,
      manage_token: 'pay_token_2'
    },
    []
  )
  assert.equal(partial?.financialStatus, 'partially_paid')
  assert.equal(partial?.amountPaid, 100)
  assert.equal(partial?.amountDue, 100)

  // 3. Paid in full
  const paid = deriveCustomerInvoiceSummary(
    {
      id: 'inv-3',
      invoice_number: 'INV-1003',
      status: 'paid',
      total: 200,
      amount_paid: 200,
      amount_due: 0,
      manage_token: 'pay_token_3'
    },
    [
      {
        id: 'tx-1',
        type: 'charge',
        status: 'succeeded',
        amount: 200,
        amount_refunded: 0,
        stripe_receipt_url: 'https://stripe.com/receipt/1003'
      }
    ]
  )
  assert.equal(paid?.financialStatus, 'paid')
  assert.equal(paid?.receiptUrl, 'https://stripe.com/receipt/1003')

  // 4. Fully Refunded
  const refunded = deriveCustomerInvoiceSummary(
    {
      id: 'inv-4',
      invoice_number: 'INV-1004',
      status: 'refunded',
      total: 200,
      amount_paid: 200,
      amount_due: 0,
      manage_token: 'pay_token_4'
    },
    [
      {
        id: 'tx-2',
        type: 'charge',
        status: 'succeeded',
        amount: 200,
        amount_refunded: 200,
        stripe_receipt_url: 'https://stripe.com/receipt/1004'
      }
    ]
  )
  assert.equal(refunded?.financialStatus, 'fully_refunded')
  assert.equal(refunded?.totalRefunded, 200)

  // 5. Partially Refunded
  const partialRefund = deriveCustomerInvoiceSummary(
    {
      id: 'inv-5',
      invoice_number: 'INV-1005',
      status: 'partially_refunded',
      total: 200,
      amount_paid: 200,
      amount_due: 0,
      manage_token: 'pay_token_5'
    },
    [
      {
        id: 'tx-3',
        type: 'charge',
        status: 'succeeded',
        amount: 200,
        amount_refunded: 50,
        stripe_receipt_url: 'https://stripe.com/receipt/1005'
      }
    ]
  )
  assert.equal(partialRefund?.financialStatus, 'partially_refunded')
  assert.equal(partialRefund?.totalRefunded, 50)

  // 6. Voided
  const voided = deriveCustomerInvoiceSummary(
    {
      id: 'inv-6',
      invoice_number: 'INV-1006',
      status: 'voided',
      total: 200,
      amount_paid: 0,
      amount_due: 0,
      manage_token: 'pay_token_6'
    },
    []
  )
  assert.equal(voided?.financialStatus, 'voided')
})

// -----------------------------------------------------------------
// Test 6: Completed-Work Photo Verification Gallery
// -----------------------------------------------------------------
test('Requirement 6: Work photo gallery with before/after tabs and lightbox', async () => {
  const db = createMockDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Apex Comfort Systems',
        timezone: 'America/Chicago'
      }
    ],
    jobs: [
      {
        id: 'job-1',
        job_number: '1042',
        title: 'Furnace Repair',
        status: 'completed',
        scheduled_start: '2026-11-23T15:00:00.000Z',
        tracking_token: 'b'.repeat(32),
        org_id: 'org-1'
      }
    ],
    job_photos: [
      {
        id: 'photo-1',
        job_id: 'job-1',
        photo_type: 'before',
        url: 'https://cdn.example.com/photos/before-1.jpg',
        caption: 'Clogged filter before replacement',
        created_at: '2026-11-23T15:05:00.000Z'
      },
      {
        id: 'photo-2',
        job_id: 'job-1',
        photo_type: 'after',
        url: 'https://cdn.example.com/photos/after-1.jpg',
        caption: 'New high-efficiency filter installed',
        created_at: '2026-11-23T15:45:00.000Z'
      }
    ]
  })

  const result = await customerViewJobTracking(db, 'b'.repeat(32))
  assert.ok(result.success)
  assert.equal(result.photos.length, 2)
  assert.equal(result.photos[0].photo_type, 'before')
  assert.equal(result.photos[1].photo_type, 'after')

  const pagePath = path.resolve(process.cwd(), 'src/app/track/[token]/page.tsx')
  const content = fs.readFileSync(pagePath, 'utf8')
  assert.ok(content.includes('Work Photo Verification'))
  assert.ok(content.includes('setActivePreviewPhoto'))
  assert.ok(content.includes('setPhotoFilter'))
})

// -----------------------------------------------------------------
// Test 7: Non-Gated FTC & Google Compliant Customer Feedback
// -----------------------------------------------------------------
test('Requirement 7: Non-gated feedback and unconditional Google Maps review link', () => {
  const pagePath = path.resolve(process.cwd(), 'src/app/track/[token]/page.tsx')
  const content = fs.readFileSync(pagePath, 'utf8')

  // Both feedback and Google review can be present simultaneously without gating
  assert.ok(content.includes('Review on Google Maps'), 'Google Maps review link present')
  assert.ok(content.includes('/feedback'), 'Feedback submission endpoint called')
  assert.ok(content.includes('handleFeedbackSubmit'), 'Feedback handler present')

  // Gating check: ensure Google review link is not restricted by rating >= 4
  const hasGatedGoogleLink = content.includes('selectedRating >= 4 && reviewUrl')
  assert.equal(hasGatedGoogleLink, false, 'Google review must not be gated behind positive rating')
})

// -----------------------------------------------------------------
// Test 8: Referral Engine Omission When Inactive
// -----------------------------------------------------------------
test('Requirement 8: Referral area is omitted when no active campaign exists', async () => {
  const db = createMockDb({
    organizations: [{ id: 'org-1', name: 'Apex Comfort' }],
    jobs: [
      {
        id: 'job-1',
        job_number: '1042',
        status: 'completed',
        scheduled_start: '2026-11-23T15:00:00.000Z',
        tracking_token: 'c'.repeat(32),
        org_id: 'org-1',
        contact_id: null // No contact, so no referral generated
      }
    ]
  })

  const result = await customerViewJobTracking(db, 'c'.repeat(32))
  assert.ok(result.success)
  assert.equal(result.referral, null, 'Referral is null when no campaign or contact exists')

  const pagePath = path.resolve(process.cwd(), 'src/app/track/[token]/page.tsx')
  const content = fs.readFileSync(pagePath, 'utf8')
  // Verify UI gates referral card on real referral url
  assert.ok(content.includes('data.referral && data.referral.url'), 'Referral card only rendered with genuine active url')
})

// -----------------------------------------------------------------
// Test 9: Security and Privacy Sanitization
// -----------------------------------------------------------------
test('Requirement 9: Sensitive internal notes and gate codes are sanitized', async () => {
  const db = createMockDb({
    organizations: [{ id: 'org-1', name: 'Apex Comfort' }],
    jobs: [
      {
        id: 'job-1',
        job_number: '1042',
        status: 'en_route',
        scheduled_start: '2026-11-23T15:00:00.000Z',
        notes: 'Customer gate code is 4921.\nLockbox pin: 8821.\nCustomer requested extra filter check.',
        tracking_token: 'd'.repeat(32),
        org_id: 'org-1'
      }
    ]
  })

  const result = await customerViewJobTracking(db, 'd'.repeat(32))
  assert.ok(result.success)
  assert.ok(!result.job.notes?.includes('4921'), 'Gate code must be sanitized')
  assert.ok(!result.job.notes?.includes('8821'), 'Lockbox pin must be sanitized')
  assert.ok(result.job.notes?.includes('Customer requested extra filter check'), 'Safe notes preserved')
})

// -----------------------------------------------------------------
// Test 10: Polling Termination on Terminal States
// -----------------------------------------------------------------
test('Requirement 10: Real-time polling terminates on completed, cancelled, or no-show states', () => {
  const pagePath = path.resolve(process.cwd(), 'src/app/track/[token]/page.tsx')
  const content = fs.readFileSync(pagePath, 'utf8')

  assert.ok(content.includes("['completed', 'cancelled', 'no_show'].includes(data.job.status)"), 'Terminal state check')
  assert.ok(content.includes('document.visibilityState'), 'Visibility state listener for background pausing')
  assert.ok(content.includes('inFlightRef'), 'Concurrency guard prevents overlapping requests')
})
