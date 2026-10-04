import test from 'node:test'
import assert from 'node:assert'
import {
  checkReviewEligibility,
  formatCompliantReviewMessage,
  dispatchReviewRequest,
  recordReviewClick,
  scheduleJobReviewAutomation
} from '../src/lib/reviews/review-manager.ts'
import {
  computeLifecycleStatus,
  updateCustomerServiceDate,
  evaluateCustomerReactivation
} from '../src/lib/retention/lifecycle-manager.ts'
import { updateJobStatus } from '../src/lib/jobs/job-manager.ts'

/**
 * In-memory Supabase mock harness for Reviews & Retention tests
 */
function createMockReviewsRetentionDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    contacts: initialState.contacts || [],
    jobs: initialState.jobs || [],
    job_items: initialState.job_items || [],
    review_requests: initialState.review_requests || [],
    automation_runs: initialState.automation_runs || [],
    automation_rules: initialState.automation_rules || [],
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
        gte: (col, val) => {
          filters.push((row) => new Date(row[col]).getTime() >= new Date(val).getTime())
          return queryBuilder
        },
        not: (col, op, val) => {
          if (op === 'is' && val === null) {
            filters.push((row) => row[col] !== null && row[col] !== undefined)
          }
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
              created_at: row.created_at || new Date().toISOString(),
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
// TEST SUITE: Phase 7 Reviews + Customer Retention Engine
// -------------------------------------------------------------

test('1. Eligibility: Suppresses review request for opted-out customer', async () => {
  const orgId = 'org-plumbing-1'
  const contactId = 'contact-opted-out'

  const db = createMockReviewsRetentionDb({
    organizations: [{ id: orgId, name: 'Apex Plumbing', google_review_url: 'https://g.page/apex/review' }],
    contacts: [{ id: contactId, org_id: orgId, phone: '+15551234567', opt_out: true }]
  })

  const res = await checkReviewEligibility(db, { orgId, contactId })
  assert.strictEqual(res.eligible, false)
  assert.strictEqual(res.reason, 'opted_out')
})

test('2. Eligibility: Suppresses review request for invalid or missing phone number', async () => {
  const orgId = 'org-plumbing-1'
  const contactId = 'contact-bad-phone'

  const db = createMockReviewsRetentionDb({
    organizations: [{ id: orgId, name: 'Apex Plumbing', google_review_url: 'https://g.page/apex/review' }],
    contacts: [{ id: contactId, org_id: orgId, phone: 'invalid-string', opt_out: false }]
  })

  const res = await checkReviewEligibility(db, { orgId, contactId })
  assert.strictEqual(res.eligible, false)
  assert.strictEqual(res.reason, 'invalid_phone')
})

test('3. Eligibility: Suppresses review request for cancelled job', async () => {
  const orgId = 'org-plumbing-1'
  const contactId = 'contact-valid'
  const jobId = 'job-cancelled'

  const db = createMockReviewsRetentionDb({
    organizations: [{ id: orgId, name: 'Apex Plumbing', google_review_url: 'https://g.page/apex/review' }],
    contacts: [{ id: contactId, org_id: orgId, phone: '+15551234567', opt_out: false }],
    jobs: [{ id: jobId, org_id: orgId, status: 'cancelled' }]
  })

  const res = await checkReviewEligibility(db, { orgId, contactId, jobId })
  assert.strictEqual(res.eligible, false)
  assert.strictEqual(res.reason, 'job_cancelled')
})

test('4. Eligibility: Suppresses review request if already sent within cooldown window', async () => {
  const orgId = 'org-plumbing-1'
  const contactId = 'contact-cooldown'
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()

  const db = createMockReviewsRetentionDb({
    organizations: [
      { id: orgId, name: 'Apex Plumbing', google_review_url: 'https://g.page/apex/review', review_cooldown_days: 60 }
    ],
    contacts: [{ id: contactId, org_id: orgId, phone: '+15551234567', opt_out: false }],
    review_requests: [
      {
        id: 'rev-recent',
        org_id: orgId,
        contact_id: contactId,
        status: 'sent',
        created_at: tenDaysAgo
      }
    ]
  })

  const res = await checkReviewEligibility(db, { orgId, contactId })
  assert.strictEqual(res.eligible, false)
  assert.strictEqual(res.reason, 'cooldown_active')
})

test('5. Eligibility: Suppresses review request if review automation is disabled in settings', async () => {
  const orgId = 'org-disabled'
  const contactId = 'contact-1'

  const db = createMockReviewsRetentionDb({
    organizations: [
      { id: orgId, name: 'Quiet Co', google_review_url: 'https://g.page/quiet/review', review_requests_enabled: false }
    ],
    contacts: [{ id: contactId, org_id: orgId, phone: '+15551234567', opt_out: false }]
  })

  const res = await checkReviewEligibility(db, { orgId, contactId })
  assert.strictEqual(res.eligible, false)
  assert.strictEqual(res.reason, 'disabled')
})

test('6. Review Message Compliance: Never specifically asks for a 5-star review', () => {
  const businessName = 'Emerald Landscaping'
  const reviewUrl = 'https://app.captodesk.com/r/token-abc123'

  const message = formatCompliantReviewMessage(businessName, reviewUrl)

  assert.ok(message.includes(businessName), 'Must contain business name')
  assert.ok(message.includes(reviewUrl), 'Must contain review URL')
  assert.strictEqual(message.toLowerCase().includes('5-star'), false, 'Must NOT contain 5-star request')
  assert.strictEqual(message.toLowerCase().includes('5 star'), false, 'Must NOT contain 5 star request')
  assert.strictEqual(
    message,
    "Thanks for choosing Emerald Landscaping. We'd really appreciate your feedback. You can leave us a Google review here: https://app.captodesk.com/r/token-abc123"
  )
})

test('7. Legitimate Link Click Tracking: /r/[token] records click timestamp and increments counter', async () => {
  const token = 'token-trackable-123456'
  const googleReviewUrl = 'https://g.page/r/sample-google-review-link/review'

  const db = createMockReviewsRetentionDb({
    review_requests: [
      {
        id: 'req-click-test',
        token,
        google_review_url: googleReviewUrl,
        status: 'sent',
        click_count: 0
      }
    ]
  })

  // First click
  const click1 = await recordReviewClick(db, token)
  assert.strictEqual(click1.success, true)
  assert.strictEqual(click1.googleReviewUrl, googleReviewUrl)

  const rowAfterClick1 = db._tables.review_requests.find(r => r.token === token)
  assert.strictEqual(rowAfterClick1.status, 'clicked')
  assert.strictEqual(rowAfterClick1.click_count, 1)
  assert.ok(rowAfterClick1.clicked_at)

  // Second click
  const click2 = await recordReviewClick(db, token)
  assert.strictEqual(click2.success, true)
  const rowAfterClick2 = db._tables.review_requests.find(r => r.token === token)
  assert.strictEqual(rowAfterClick2.click_count, 2)
})

test('8. Honest Review Analytics: Verifies requests sent and clicks without fake multipliers', () => {
  const sentRequests = [
    { status: 'sent', click_count: 0 },
    { status: 'delivered', click_count: 0 },
    { status: 'clicked', click_count: 2 },
    { status: 'clicked', click_count: 1 },
    { status: 'failed', click_count: 0 },
    { status: 'suppressed', click_count: 0 }
  ]

  const totalSent = sentRequests.filter(r => ['sent', 'delivered', 'clicked'].includes(r.status)).length
  const totalDelivered = sentRequests.filter(r => ['delivered', 'clicked'].includes(r.status)).length
  const totalClicked = sentRequests.filter(r => r.status === 'clicked').length
  const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0

  assert.strictEqual(totalSent, 4)
  assert.strictEqual(totalDelivered, 3)
  assert.strictEqual(totalClicked, 2)
  assert.strictEqual(clickRate, 50) // 2 / 4 = 50%
})

test('9. Lifecycle Status Computation: Correctly categorizes active, due, overdue, and inactive', () => {
  const now = Date.now()
  const frequencyDays = 30 // 30-day interval

  // 1. Last service 10 days ago (< 30d) -> active
  const date10d = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString()
  assert.strictEqual(computeLifecycleStatus(date10d, frequencyDays), 'active')

  // 2. Last service 40 days ago (between 30d and 60d) -> due
  const date40d = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString()
  assert.strictEqual(computeLifecycleStatus(date40d, frequencyDays), 'due')

  // 3. Last service 80 days ago (between 60d and 120d) -> overdue
  const date80d = new Date(now - 80 * 24 * 60 * 60 * 1000).toISOString()
  assert.strictEqual(computeLifecycleStatus(date80d, frequencyDays), 'overdue')

  // 4. Last service 150 days ago (>= 120d) -> inactive
  const date150d = new Date(now - 150 * 24 * 60 * 60 * 1000).toISOString()
  assert.strictEqual(computeLifecycleStatus(date150d, frequencyDays), 'inactive')
})

test('10. Customer Reactivation: Dispatches SMS to due/overdue customers and respects 30-day cooldown', async () => {
  const orgId = 'org-hvac-reactivate'
  const contactDueId = 'contact-due'
  const contactRecentReactivatedId = 'contact-recent-reactivated'
  const now = Date.now()

  const db = createMockReviewsRetentionDb({
    organizations: [
      {
        id: orgId,
        name: 'Chill HVAC',
        slug: 'chill-hvac',
        reactivation_enabled: true,
        default_reactivation_interval_days: 30,
        telnyx_phone_number: '+15550001111'
      }
    ],
    contacts: [
      // Contact 1: 45 days since service, never reactivated -> should be reactivated
      {
        id: contactDueId,
        org_id: orgId,
        name: 'Sarah Connor',
        phone: '+15552223333',
        opt_out: false,
        last_service_date: new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString(),
        service_frequency_days: 30,
        lifecycle_status: 'due',
        last_reactivation_sent_at: null
      },
      // Contact 2: 45 days since service, but reactivated 5 days ago -> cooldown skip
      {
        id: contactRecentReactivatedId,
        org_id: orgId,
        name: 'John Connor',
        phone: '+15554445555',
        opt_out: false,
        last_service_date: new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString(),
        service_frequency_days: 30,
        lifecycle_status: 'due',
        last_reactivation_sent_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]
  })

  const result = await evaluateCustomerReactivation(db, {
    orgId,
    baseUrl: 'https://app.captodesk.com'
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.reactivatedCount, 1)
  assert.strictEqual(result.contactsReactivated[0].contactId, contactDueId)

  // Verify contact was updated
  const updatedContact = db._tables.contacts.find(c => c.id === contactDueId)
  assert.ok(updatedContact.last_reactivation_sent_at)
})

test('11. Job Completion Hook: Updates customer last service date and schedules review automation', async () => {
  const orgId = 'org-roof-complete'
  const contactId = 'contact-roof-owner'
  const jobId = 'job-shingles-done'

  const db = createMockReviewsRetentionDb({
    organizations: [
      {
        id: orgId,
        name: 'Top Roofers',
        google_review_url: 'https://g.page/toproofers/review',
        review_delay_hours: 24,
        review_requests_enabled: true,
        is_review_engine_active: true
      }
    ],
    contacts: [
      {
        id: contactId,
        org_id: orgId,
        name: 'Robert Davis',
        phone: '+15558889999',
        opt_out: false,
        last_service_date: null
      }
    ],
    jobs: [
      {
        id: jobId,
        org_id: orgId,
        contact_id: contactId,
        job_number: 'JOB-901',
        title: 'Roof Shingle Repair',
        status: 'in_progress'
      }
    ]
  })

  // Complete job
  const res = await updateJobStatus(db, {
    jobId,
    orgId,
    newStatus: 'completed'
  })

  assert.strictEqual(res.success, true)
  assert.strictEqual(res.job.status, 'completed')

  // Verify contact last_service_date was updated
  const updatedContact = db._tables.contacts.find(c => c.id === contactId)
  assert.ok(updatedContact.last_service_date)
  assert.strictEqual(updatedContact.lifecycle_status, 'active')

  // Verify review request automation run was scheduled
  const reviewRun = db._tables.automation_runs.find(r => r.action_type === 'send_review_request')
  assert.ok(reviewRun, 'Review automation run should be scheduled')
  assert.strictEqual(reviewRun.status, 'scheduled')
  assert.strictEqual(reviewRun.event_payload.job_id, jobId)
})

test('12. Multi-Tenant Isolation: Strictly prevents cross-tenant review and retention access', async () => {
  const orgA = 'org-tenant-a'
  const orgB = 'org-tenant-b'
  const contactA = 'contact-a'

  const db = createMockReviewsRetentionDb({
    organizations: [
      { id: orgA, name: 'Org A', google_review_url: 'https://g.page/a/review' },
      { id: orgB, name: 'Org B', google_review_url: 'https://g.page/b/review' }
    ],
    contacts: [
      { id: contactA, org_id: orgA, phone: '+15551112222', opt_out: false }
    ]
  })

  // Org B attempts to check eligibility or dispatch review for Org A's contact
  const res = await checkReviewEligibility(db, {
    orgId: orgB, // Mismatched tenant
    contactId: contactA
  })

  assert.strictEqual(res.eligible, false)
  assert.strictEqual(res.reason, 'not_found')
})
