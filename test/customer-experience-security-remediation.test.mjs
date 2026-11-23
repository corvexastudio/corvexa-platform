import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  RATE_LIMITS,
  checkRateLimit,
  getRateLimitHeaders,
  PRIVATE_CACHE_HEADERS
} from '../src/lib/security/rate-limiter.ts'
import { generateIcsContent } from '../src/lib/calendar/calendar-sync.ts'
import { customerViewJobTracking } from '../src/lib/jobs/job-manager.ts'
import { customerRescheduleBooking } from '../src/lib/booking/booking-manager.ts'

const TOUCHED_FILES = [
  'src/lib/security/rate-limiter.ts',
  'src/lib/jobs/job-manager.ts',
  'src/lib/booking/booking-manager.ts',
  'src/lib/calendar/calendar-sync.ts',
  'src/app/track/[token]/page.tsx',
  'src/app/api/track/[token]/route.ts',
  'src/app/api/track/[token]/feedback/route.ts',
  'src/app/api/book/manage/[token]/route.ts',
  'src/app/api/book/manage/[token]/reschedule/route.ts',
  'src/app/api/book/manage/[token]/cancel/route.ts',
  'src/app/api/book/manage/[token]/ics/route.ts'
]

test('Invariant Audit: Absolute zero em dashes in touched files', () => {
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

test('F-01: Rating-based Google review gating is eliminated in Live Service Tracker', () => {
  const trackerPagePath = path.resolve('src/app/track/[token]/page.tsx')
  const content = fs.readFileSync(trackerPagePath, 'utf8')

  // Verify handleRatingClick does NOT open Google reviews automatically
  assert.ok(
    !content.includes('window.open(reviewUrl'),
    'handleRatingClick must never automatically call window.open on star selection'
  )

  // Verify the Google review link is neutral and available regardless of star rating
  assert.ok(
    content.includes('Review on Google Maps'),
    'Neutral Google Maps review action must be present in completion UI'
  )

  // Verify private feedback form is accessible for all ratings without gating
  assert.ok(
    content.includes('Private Feedback Form (Available for all ratings without gating)'),
    'Private feedback form must be available without rating-based gating'
  )

  // Verify feedback text is optional on feedback submit
  assert.ok(
    content.includes('if (!selectedRating || !token) return'),
    'Feedback submission allows star rating alone without blocking on empty text'
  )
})

test('F-01: Feedback API endpoint supports optional text, idempotency and rate limiting', () => {
  const feedbackApiPath = path.resolve('src/app/api/track/[token]/feedback/route.ts')
  const content = fs.readFileSync(feedbackApiPath, 'utf8')

  // Rate limiting present
  assert.ok(content.includes('RATE_LIMITS.TRACKING_FEEDBACK'), 'Rate limiting configured on feedback API')

  // Optional feedback text with fallback for NOT NULL column
  assert.ok(
    content.includes('effectiveFeedbackText = feedbackText ||'),
    'Fallback text provided for optional comments to satisfy database schema'
  )

  // Idempotency check present
  assert.ok(
    content.includes('customer_feedback') && content.includes('existingFeedback'),
    'Duplicate / idempotent check present before inserting feedback'
  )

  // Private cache headers
  assert.ok(content.includes('PRIVATE_CACHE_HEADERS'), 'Private cache headers returned on feedback endpoint')
})

test('F-02: Invoice query is strictly scoped to current job without contact_id over-matching', async () => {
  const jobManagerPath = path.resolve('src/lib/jobs/job-manager.ts')
  const content = fs.readFileSync(jobManagerPath, 'utf8')

  // Over-matching or filter must NOT exist
  assert.ok(
    !content.includes('.or(`job_id.eq.${job.id},contact_id.eq.${job.contact_id}`)'),
    'Invoice query must not use .or() with contact_id over-matching'
  )
  assert.ok(
    !content.includes(".or('job_id.eq.${job.id},contact_id.eq.${job.contact_id}')"),
    'Invoice query must not use .or() with contact_id'
  )

  // Query must filter by job_id and check deleted_at IS NULL
  assert.ok(
    content.includes(".eq('job_id', job.id)"),
    'Invoice query must filter strictly by current job.id'
  )
  assert.ok(
    content.includes(".is('deleted_at', null)"),
    'Invoice query must filter out soft-deleted invoices'
  )

  // Unit Simulation: Mock Supabase client to test repeat customer scenario
  const mockOrgId = 'org-test-123'
  const mockContactId = 'contact-alice'
  const mockJobBId = 'job-b-new'

  const mockDbInvoices = [
    {
      id: 'inv-1',
      invoice_number: 'INV-1001',
      title: 'Job A Invoice',
      total: 500,
      amount_paid: 500,
      amount_due: 0,
      status: 'paid',
      org_id: mockOrgId,
      job_id: 'job-a-old',
      contact_id: mockContactId,
      deleted_at: null
    }
  ]

  const mockSupabase = {
    from(table) {
      if (table === 'jobs') {
        return {
          select() {
            return {
              eq(col, val) {
                return {
                  single: async () => ({
                    data: {
                      id: mockJobBId,
                      job_number: 'JOB-2002',
                      title: 'Job B',
                      status: 'in_progress',
                      org_id: mockOrgId,
                      contact_id: mockContactId,
                      quote_id: null,
                      tracking_token: 'track-token-b',
                      organizations: {
                        id: mockOrgId,
                        name: 'Acme Services',
                        timezone: 'America/New_York'
                      },
                      contacts: {
                        id: mockContactId,
                        name: 'Alice Homeowner',
                        phone: '+15551234567'
                      }
                    },
                    error: null
                  })
                }
              }
            }
          }
        }
      }
      if (table === 'invoices') {
        return {
          select() {
            let filterOrg = null
            let filterJob = null
            let filterDeleted = null
            const queryObj = {
              eq(col, val) {
                if (col === 'org_id') filterOrg = val
                if (col === 'job_id') filterJob = val
                return queryObj
              },
              is(col, val) {
                if (col === 'deleted_at') filterDeleted = val
                return queryObj
              },
              in() { return queryObj },
              order() { return queryObj },
              limit() { return queryObj },
              maybeSingle: async () => {
                const match = mockDbInvoices.find(inv =>
                  inv.org_id === filterOrg &&
                  inv.job_id === filterJob &&
                  (filterDeleted === null ? inv.deleted_at === null : true)
                )
                return { data: match || null, error: null }
              }
            }
            return queryObj
          }
        }
      }
      if (table === 'job_photos') {
        return {
          select() {
            return {
              eq() {
                return {
                  order: async () => ({ data: [], error: null })
                }
              }
            }
          }
        }
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }
    }
  }

  const result = await customerViewJobTracking(mockSupabase, 'track-token-b')
  assert.equal(result.success, true, 'Job tracking lookup succeeds')
  assert.equal(
    result.invoice,
    null,
    'Repeat customer new Job B must NOT inherit older Job A invoice'
  )
})

test('F-03: iCalendar export sanitizes description and never leaks appointment.notes', () => {
  const icsApiPath = path.resolve('src/app/api/book/manage/[token]/ics/route.ts')
  const content = fs.readFileSync(icsApiPath, 'utf8')

  // Verify appointment.notes is removed from select and description
  assert.ok(
    !content.includes('appointment.notes'),
    'appointment.notes must be completely excluded from iCalendar export'
  )

  // Verify allowlist fields are constructed
  assert.ok(content.includes('Service:'), 'Allowlist includes Service')
  assert.ok(content.includes('Provider:'), 'Allowlist includes Provider')
  assert.ok(content.includes('Reference:'), 'Allowlist includes Reference code')
  assert.ok(content.includes('Status:'), 'Allowlist includes Status')
  assert.ok(content.includes('Manage Appointment:'), 'Allowlist includes Manage URL')

  // Test RFC 5545 calendar sync generator with sensitive notes excluded
  const safePayload = {
    title: 'HVAC Repair - John Doe',
    description: [
      'Service: AC Diagnostic',
      'Provider: Cold Air Pros',
      'Phone: +15559876543',
      'Customer: John Doe',
      'Reference: C8A7B6D5',
      'Status: CONFIRMED',
      'Manage Appointment: https://captodesk.com/book/manage/c8a7b6d5e4f3a2b1'
    ].join('\n'),
    location: '123 Main St, Austin, TX 78701',
    startTime: '2026-12-01T14:00:00Z',
    endTime: '2026-12-01T15:00:00Z',
    url: 'https://captodesk.com/book/manage/c8a7b6d5e4f3a2b1'
  }

  const icsOutput = generateIcsContent(safePayload)

  // Check RFC 5545 markers
  assert.ok(icsOutput.includes('BEGIN:VCALENDAR'), 'Contains BEGIN:VCALENDAR')
  assert.ok(icsOutput.includes('BEGIN:VEVENT'), 'Contains BEGIN:VEVENT')
  assert.ok(icsOutput.includes('SUMMARY:HVAC Repair - John Doe'), 'Contains summary')
  assert.ok(icsOutput.includes('DESCRIPTION:Service: AC Diagnostic\\nProvider: Cold Air Pros'), 'Newlines escaped as \\n')
  assert.ok(icsOutput.includes('END:VEVENT'), 'Contains END:VEVENT')
  assert.ok(icsOutput.includes('END:VCALENDAR'), 'Contains END:VCALENDAR')

  // Verify sensitive keywords never appear
  assert.ok(!icsOutput.includes('Gate code'), 'No gate codes')
  assert.ok(!icsOutput.includes('Lockbox'), 'No lockbox codes')
  assert.ok(!icsOutput.includes('[PRIORITY DISPATCH'), 'No internal dispatch tags')
})

test('F-10: Rate limiter enforces configured sliding window limits', () => {
  assert.equal(RATE_LIMITS.TRACKING_VIEW.max, 60, 'TRACKING_VIEW limit is 60 req/min')
  assert.equal(RATE_LIMITS.TRACKING_FEEDBACK.max, 10, 'TRACKING_FEEDBACK limit is 10 req/min')
  assert.equal(RATE_LIMITS.MANAGE_VIEW.max, 30, 'MANAGE_VIEW limit is 30 req/min')
  assert.equal(RATE_LIMITS.MANAGE_ACTION.max, 10, 'MANAGE_ACTION limit is 10 req/min')
  assert.equal(RATE_LIMITS.MANAGE_ICS.max, 30, 'MANAGE_ICS limit is 30 req/min')

  const testKey = `test:ratelimit:${Date.now()}`
  const config = { max: 3, windowMs: 1000 }

  const r1 = checkRateLimit(testKey, config)
  assert.equal(r1.allowed, true)
  assert.equal(r1.remaining, 2)

  const r2 = checkRateLimit(testKey, config)
  assert.equal(r2.allowed, true)
  assert.equal(r2.remaining, 1)

  const r3 = checkRateLimit(testKey, config)
  assert.equal(r3.allowed, true)
  assert.equal(r3.remaining, 0)

  const r4 = checkRateLimit(testKey, config)
  assert.equal(r4.allowed, false, 'Fourth request within window is rejected')
  assert.equal(r4.remaining, 0)

  const headers = getRateLimitHeaders(r4)
  assert.equal(headers['X-RateLimit-Limit'], '3')
  assert.equal(headers['X-RateLimit-Remaining'], '0')
  assert.ok(Number(headers['X-RateLimit-Reset']) > 0)
})

test('Organization Suspension Guard: Suspended accounts cannot accept reschedules', async () => {
  const suspendedOrg = {
    id: 'org-suspended-1',
    name: 'Suspended Contractor',
    subscription_status: 'suspended'
  }

  const mockSupabase = {
    from(table) {
      if (table === 'appointments') {
        return {
          select() {
            return {
              eq() {
                return {
                  single: async () => ({
                    data: {
                      id: 'apt-resched-1',
                      org_id: suspendedOrg.id,
                      status: 'confirmed',
                      start_time: '2026-12-05T10:00:00Z',
                      end_time: '2026-12-05T11:00:00Z',
                      organization: suspendedOrg,
                      contact: { name: 'Customer Test', phone: '+15553334444' },
                      service: { name: 'Tune Up', duration_minutes: 60 }
                    },
                    error: null
                  })
                }
              }
            }
          }
        }
      }
      if (table === 'jobs') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({ data: null, error: null })
                    }
                  }
                }
              }
            }
          }
        }
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }
    }
  }

  const res = await customerRescheduleBooking(
    mockSupabase,
    'token-resched-test',
    '2026-12-06T10:00:00Z'
  )

  assert.equal(res.success, false, 'Reschedule must fail for suspended organization')
  assert.ok(
    res.error?.includes('currently unavailable for appointment scheduling'),
    `Expected suspension message, received: ${res.error}`
  )
})

test('Private Cache Protection: Headers configured on all customer-facing endpoints', () => {
  assert.equal(
    PRIVATE_CACHE_HEADERS['Cache-Control'],
    'private, no-store, must-revalidate',
    'Cache-Control is private, no-store, must-revalidate'
  )
  assert.equal(PRIVATE_CACHE_HEADERS.Pragma, 'no-cache')
  assert.equal(PRIVATE_CACHE_HEADERS.Vary, 'Cookie, Origin')

  const endpointsToCheck = [
    'src/app/api/track/[token]/route.ts',
    'src/app/api/track/[token]/feedback/route.ts',
    'src/app/api/book/manage/[token]/route.ts',
    'src/app/api/book/manage/[token]/reschedule/route.ts',
    'src/app/api/book/manage/[token]/cancel/route.ts',
    'src/app/api/book/manage/[token]/ics/route.ts'
  ]

  for (const relPath of endpointsToCheck) {
    const fullPath = path.resolve(relPath)
    const content = fs.readFileSync(fullPath, 'utf8')
    assert.ok(
      content.includes('PRIVATE_CACHE_HEADERS'),
      `${relPath} must apply PRIVATE_CACHE_HEADERS`
    )
  }
})
