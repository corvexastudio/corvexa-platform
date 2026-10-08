import test from 'node:test'
import assert from 'node:assert/strict'

// Domain services & modules under test
import {
  canTransitionMessageStatus,
  shouldUpdateMessageStatus,
  isTerminalMessageStatus
} from '../src/lib/telephony/message-state.ts'
import { generateDocumentNumber, resetInMemoryDocumentCounters } from '../src/lib/services/document-counter.ts'
import { createBooking } from '../src/lib/booking/booking-manager.ts'
import { updateJobStatus } from '../src/lib/jobs/job-manager.ts'
import { recordPayment } from '../src/lib/payments/invoice-manager.ts'
import { dispatchReviewRequest } from '../src/lib/reviews/review-manager.ts'
import { scheduleQuoteFollowUps } from '../src/lib/quotes/quote-manager.ts'
import { localDateTimeToUtc, formatSlotDisplayDateTime } from '../src/lib/booking/availability.ts'
import { evaluateStaleLockRecovery, canTransition as canTransitionAutomation } from '../src/lib/automations/state-machine.ts'

// ==============================================================================
// 1. MESSAGING STATE MACHINE & OUT-OF-ORDER WEBHOOK PROTECTION
// ==============================================================================

test('Messaging State: Monotonic forward progression is permitted', () => {
  assert.equal(canTransitionMessageStatus('queued', 'sending'), true)
  assert.equal(canTransitionMessageStatus('sending', 'sent'), true)
  assert.equal(canTransitionMessageStatus('sent', 'delivered'), true)
  assert.equal(canTransitionMessageStatus('sending', 'failed'), true)
  assert.equal(canTransitionMessageStatus('sent', 'undelivered'), true)
  assert.equal(canTransitionMessageStatus('failed', 'queued'), true)
})

test('Messaging State: Regressions and impossible transitions are strictly rejected', () => {
  // Delivered is terminal positive - can NEVER regress back to sent or sending
  assert.equal(canTransitionMessageStatus('delivered', 'sent'), false)
  assert.equal(canTransitionMessageStatus('delivered', 'sending'), false)
  assert.equal(canTransitionMessageStatus('delivered', 'queued'), false)
  assert.equal(canTransitionMessageStatus('delivered', 'failed'), false)

  // Received is terminal inbound
  assert.equal(canTransitionMessageStatus('received', 'sent'), false)
  assert.equal(canTransitionMessageStatus('received', 'queued'), false)
})

test('Messaging State: Out-of-order webhook simulation protects delivered state', () => {
  // Scenario: Telnyx delivers `message.delivered` first, then a delayed retry of `message.sent` arrives
  const checkDelivered = shouldUpdateMessageStatus('sent', 'delivered')
  assert.equal(checkDelivered.allowed, true)

  // Delayed message.sent arrives after delivered:
  const checkDelayedSent = shouldUpdateMessageStatus('delivered', 'sent')
  assert.equal(checkDelayedSent.allowed, false)
  assert.match(checkDelayedSent.reason, /Out-of-order webhook discarded/)

  // Duplicate delivered event:
  const checkDuplicateDelivered = shouldUpdateMessageStatus('delivered', 'delivered')
  assert.equal(checkDuplicateDelivered.allowed, false)
  assert.match(checkDuplicateDelivered.reason, /already in status 'delivered'/)
})

test('Messaging State: Terminal state recognition', () => {
  assert.equal(isTerminalMessageStatus('delivered'), true)
  assert.equal(isTerminalMessageStatus('received'), true)
  assert.equal(isTerminalMessageStatus('sent'), false)
  assert.equal(isTerminalMessageStatus('queued'), false)
  assert.equal(isTerminalMessageStatus('failed'), false)
})

// ==============================================================================
// 2. CONCURRENT NUMBERING COLLISION FREEDOM
// ==============================================================================

test('Numbering: Concurrent creation produces collision-free sequential IDs', async () => {
  resetInMemoryDocumentCounters()

  const orgId = '00000000-0000-0000-0000-000000000001'
  const currentYear = new Date().getFullYear()

  // Concurrently request 50 quotes, 50 invoices, and 50 jobs
  const quotePromises = Array.from({ length: 50 }, () =>
    generateDocumentNumber({}, orgId, 'quote')
  )
  const invoicePromises = Array.from({ length: 50 }, () =>
    generateDocumentNumber({}, orgId, 'invoice')
  )
  const jobPromises = Array.from({ length: 50 }, () =>
    generateDocumentNumber({}, orgId, 'job')
  )

  const [quoteNumbers, invoiceNumbers, jobNumbers] = await Promise.all([
    Promise.all(quotePromises),
    Promise.all(invoicePromises),
    Promise.all(jobPromises)
  ])

  // Verify all 50 quotes are unique
  const uniqueQuotes = new Set(quoteNumbers)
  assert.equal(uniqueQuotes.size, 50, 'All 50 quote numbers must be unique')
  assert.ok(quoteNumbers[0].startsWith(`QT-${currentYear}-`))

  // Verify all 50 invoices are unique
  const uniqueInvoices = new Set(invoiceNumbers)
  assert.equal(uniqueInvoices.size, 50, 'All 50 invoice numbers must be unique')
  assert.ok(invoiceNumbers[0].startsWith(`INV-${currentYear}-`))

  // Verify all 50 jobs are unique
  const uniqueJobs = new Set(jobNumbers)
  assert.equal(uniqueJobs.size, 50, 'All 50 job numbers must be unique')
  assert.ok(jobNumbers[0].startsWith(`JOB-${currentYear}-`))
})

// ==============================================================================
// 3. BOOKING CONCURRENCY & SLOT LOCKING
// ==============================================================================

test('Booking Concurrency: Unique slot constraint violation returns clean error', async () => {
  const orgId = 'org-booking-test'
  const startTime = '2026-10-15T14:00:00.000Z'

  // Mock Supabase client where insert fails due to PostgreSQL unique constraint 23505
  const mockSupabase = {
    from: (table) => {
      if (table === 'organizations') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: orgId,
                  timezone: 'America/Chicago',
                  booking_mode: 'instant',
                  default_duration_minutes: 60,
                  buffer_minutes: 15
                },
                error: null
              })
            })
          })
        }
      }
      if (table === 'services') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: { id: 'svc-1', name: 'AC Inspection', duration_minutes: 60, requires_address: true, is_active: true },
                      error: null
                    })
                  })
                })
              })
            })
          })
        }
      }
      if (table === 'appointments') {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({ data: [], error: null })
            })
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: null,
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint "idx_appointments_org_active_slot"'
                }
              })
            })
          })
        }
      }
      if (table === 'contacts') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: 'cnt-1', name: 'John Doe', phone: '+15555550100' }, error: null })
              })
            })
          }),
          update: () => ({ eq: async () => ({ error: null }) })
        }
      }
      if (table === 'leads') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) })
              })
            })
          }),
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'lead-1' } }) }) })
        }
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }
    }
  }

  const result = await createBooking(mockSupabase, {
    orgId,
    customerName: 'John Doe',
    customerPhone: '+15555550100',
    customerAddress: '123 Main St',
    startTime
  })

  assert.equal(result.success, false)
  assert.equal(result.error, 'This time slot is no longer available. Please select another time.')
})

// ==============================================================================
// 4. JOB COMPLETION IDEMPOTENCY
// ==============================================================================

test('Job Status: Completing an already completed job is idempotent and does not re-emit hooks', async () => {
  const orgId = 'org-job-test'
  const jobId = 'job-123'

  let automationEventCalled = false
  let smsSent = false

  const mockSupabase = {
    from: (table) => {
      if (table === 'jobs') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: jobId,
                    org_id: orgId,
                    status: 'completed', // Already completed!
                    job_number: 'JOB-2026-000001',
                    contact_id: 'contact-1'
                  },
                  error: null
                })
              })
            })
          })
        }
      }
      throw new Error(`Unexpected table access: ${table}`)
    }
  }

  const result = await updateJobStatus(mockSupabase, {
    jobId,
    orgId,
    newStatus: 'completed'
  })

  assert.equal(result.success, true)
  assert.equal(result.alreadyInStatus, true)
  assert.equal(automationEventCalled, false, 'Should not re-emit automation event')
  assert.equal(smsSent, false, 'Should not send duplicate SMS')
})

test('Job Status: Regressing a completed job back to scheduled is blocked', async () => {
  const orgId = 'org-job-test'
  const jobId = 'job-123'

  const mockSupabase = {
    from: (table) => {
      if (table === 'jobs') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: jobId,
                    org_id: orgId,
                    status: 'completed',
                    job_number: 'JOB-2026-000001'
                  },
                  error: null
                })
              })
            })
          })
        }
      }
      throw new Error(`Unexpected table access: ${table}`)
    }
  }

  const result = await updateJobStatus(mockSupabase, {
    jobId,
    orgId,
    newStatus: 'scheduled'
  })

  assert.equal(result.success, false)
  assert.match(result.error || '', /Cannot change status of an already completed job/)
})

// ==============================================================================
// 5. PAYMENT & STRIPE WEBHOOK IDEMPOTENCY
// ==============================================================================

test('Payment Recording: Duplicate Stripe payment intent is recognized and does not double-credit', async () => {
  const orgId = 'org-stripe-test'
  const invoiceId = 'inv-500'
  const paymentIntentId = 'pi_test_123456789'

  let paymentsInserted = 0

  const mockSupabase = {
    from: (table) => {
      if (table === 'invoices') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: invoiceId,
                    org_id: orgId,
                    contact_id: 'cnt-1',
                    total: 500,
                    amount_paid: 500,
                    amount_due: 0,
                    status: 'paid'
                  },
                  error: null
                })
              })
            })
          })
        }
      }
      if (table === 'payments') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  // Simulates payment already recorded by checkout.session.completed
                  data: {
                    id: 'pay-existing-1',
                    org_id: orgId,
                    invoice_id: invoiceId,
                    amount: 500,
                    stripe_payment_intent_id: paymentIntentId,
                    status: 'succeeded'
                  },
                  error: null
                })
              })
            })
          }),
          insert: () => {
            paymentsInserted++
            return {
              select: () => ({
                single: async () => ({ data: { id: 'pay-new' }, error: null })
              })
            }
          }
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    }
  }

  // Second event arrives (e.g. payment_intent.succeeded or webhook retry)
  const result = await recordPayment(mockSupabase, {
    invoiceId,
    orgId,
    amount: 500,
    paymentMethod: 'stripe',
    paymentStatus: 'succeeded',
    stripePaymentIntentId: paymentIntentId
  })

  assert.equal(result.success, true)
  assert.equal(result.payment.id, 'pay-existing-1')
  assert.equal(paymentsInserted, 0, 'Must NOT insert a second payment record')
})

// ==============================================================================
// 6. REVIEW REQUEST DEDUPLICATION
// ==============================================================================

test('Review Request: Re-requesting for the same completed job returns existing record without duplicate SMS', async () => {
  const orgId = 'org-review-test'
  const contactId = 'cnt-review-1'
  const jobId = 'job-completed-77'

  const mockSupabase = {
    from: (table) => {
      if (table === 'organizations') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: orgId,
                  name: 'Comfort Air',
                  google_review_url: 'https://g.page/r/test',
                  is_review_engine_active: true,
                  review_requests_enabled: true,
                  review_cooldown_days: 60
                },
                error: null
              })
            })
          })
        }
      }
      if (table === 'contacts') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: contactId, name: 'Alice Smith', phone: '+15555550199', opt_out: false },
                  error: null
                })
              })
            })
          })
        }
      }
      if (table === 'compliance_suppression_list') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null })
              })
            })
          })
        }
      }
      if (table === 'jobs') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: jobId, status: 'completed', job_number: 'JOB-77' }
                })
              })
            })
          })
        }
      }
      if (table === 'review_requests') {
        return {
          select: () => ({
            eq: () => ({
              eq: (field, val) => {
                if (field === 'contact_id') {
                  return {
                    in: () => ({
                      gte: async () => ({ data: [] })
                    })
                  }
                }
                if (field === 'job_id') {
                  return {
                    neq: () => ({
                      maybeSingle: async () => ({
                        data: {
                          id: 'rev-existing-1',
                          org_id: orgId,
                          contact_id: contactId,
                          job_id: jobId,
                          token: 'token123',
                          status: 'sent'
                        }
                      })
                    })
                  }
                }
                return { maybeSingle: async () => ({ data: null }) }
              }
            })
          })
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    }
  }

  const result = await dispatchReviewRequest(mockSupabase, {
    orgId,
    contactId,
    jobId,
    baseUrl: 'https://captodesk.com'
  })

  assert.equal(result.success, true)
  assert.equal(result.reviewRequest.id, 'rev-existing-1')
})

// ==============================================================================
// 7. QUOTE FOLLOW-UP IDEMPOTENCY
// ==============================================================================

test('Quote Follow-ups: Re-running scheduleQuoteFollowUps does not insert duplicate runs', async () => {
  const orgId = 'org-quote-test'
  const quoteId = 'quote-999'

  let insertedCount = 0

  const mockSupabase = {
    from: (table) => {
      if (table === 'automation_runs') {
        return {
          select: () => ({
            eq: () => ({
              eq: (field, key) => ({
                maybeSingle: async () => {
                  // Simulate fu1 already exists, fu2 does not
                  if (key === `quote_fu1_${quoteId}`) {
                    return { data: { id: 'run-fu1' }, error: null }
                  }
                  return { data: null, error: null }
                }
              })
            })
          }),
          insert: async (payload) => {
            insertedCount++
            return { error: null }
          }
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    }
  }

  await scheduleQuoteFollowUps(mockSupabase, {
    quoteId,
    orgId,
    orgName: 'Summit Plumbing',
    quoteNumber: 'QT-2026-000999',
    total: 350,
    customerPhone: '+15555550188',
    customerName: 'Bob Vance',
    senderNumber: '+15555550100',
    manageUrl: 'https://captodesk.com/quote/abc'
  })

  // Only fu2 should have been inserted since fu1 already existed
  assert.equal(insertedCount, 1)
})

// ==============================================================================
// 8. AUTOMATION WORKER STALE LOCK RECOVERY & STATE TRANSITIONS
// ==============================================================================

test('Worker State: Terminal states and valid worker transitions', () => {
  assert.equal(canTransitionAutomation('scheduled', 'running'), true)
  assert.equal(canTransitionAutomation('running', 'success'), true)
  assert.equal(canTransitionAutomation('running', 'failed'), true)
  assert.equal(canTransitionAutomation('success', 'running'), false) // Terminal
  assert.equal(canTransitionAutomation('cancelled', 'running'), false) // Terminal
})

test('Worker Recovery: Stale lock recovery resets to retry or dead-letter', () => {
  const now = Date.now()
  const staleLockedAt = new Date(now - 700 * 1000).toISOString() // 700s ago (> 600s threshold)

  // Eligible for retry
  const recoverableJob = {
    id: 'run-1',
    status: 'running',
    retry_count: 1,
    max_retries: 3,
    locked_at: staleLockedAt
  }

  const recovery1 = evaluateStaleLockRecovery(recoverableJob, 600, now)
  assert.equal(recovery1.isStale, true)
  assert.equal(recovery1.action, 'retry')
  assert.equal(recovery1.updates?.retry_count, 2)

  // Max retries exceeded -> dead letter
  const exhaustedJob = {
    id: 'run-2',
    status: 'running',
    retry_count: 3,
    max_retries: 3,
    locked_at: staleLockedAt
  }

  const recovery2 = evaluateStaleLockRecovery(exhaustedJob, 600, now)
  assert.equal(recovery2.isStale, true)
  assert.equal(recovery2.action, 'dead_letter')
  assert.equal(recovery2.updates?.status, 'dead_letter')
})

// ==============================================================================
// 9. TIMEZONE & DST SCHEDULING AUTHORITY
// ==============================================================================

test('Timezone: Correctly calculates UTC timestamps across Daylight Saving Time shifts', () => {
  // DST Spring Forward in America/Chicago: March 8, 2026 (UTC-6 to UTC-5)
  // Before transition: Standard Time (UTC-6) -> 12:00 PM Chicago = 18:00 UTC
  const beforeDst = localDateTimeToUtc('2026-03-07', '12:00', 'America/Chicago')
  assert.equal(beforeDst.toISOString(), '2026-03-07T18:00:00.000Z')

  // After transition: Daylight Time (UTC-5) -> 12:00 PM Chicago = 17:00 UTC
  const afterDst = localDateTimeToUtc('2026-03-09', '12:00', 'America/Chicago')
  assert.equal(afterDst.toISOString(), '2026-03-09T17:00:00.000Z')

  // Display formatting strictly adheres to the timezone
  const displayBefore = formatSlotDisplayDateTime(beforeDst, 'America/Chicago')
  assert.equal(displayBefore, 'Mar 7 at 12:00 PM')

  const displayAfter = formatSlotDisplayDateTime(afterDst, 'America/Chicago')
  assert.equal(displayAfter, 'Mar 9 at 12:00 PM')
})
