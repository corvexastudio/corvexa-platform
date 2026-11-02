import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  renderSituationAwareText,
  resolveOperationMode
} from '../src/lib/notifications/situation-templates.ts'
import {
  isKnownEvent,
  getEventPolicy,
  resolveDefaultTargetUrl
} from '../src/lib/notifications/notification-policy.ts'
import { notifyOwner } from '../src/lib/notifications/notification-service.ts'
import { formatCompliantReviewMessage } from '../src/lib/reviews/review-manager.ts'

test('Phase 2 - Situation Templates: starter_pass_welcome copy', () => {
  const text = renderSituationAwareText('starter_pass_welcome', {
    targetUrl: 'https://captodesk.com/book/acme-plumbing'
  })
  assert.ok(text.includes('Welcome to CaptoDesk!'), 'Mentions welcome')
  assert.ok(text.includes('first 3 customer jobs are 100% free'), 'Highlights 3 free jobs')
  assert.ok(text.includes('https://captodesk.com/book/acme-plumbing'), 'Includes booking link')
})

test('Phase 2 - Situation Templates: starter_job_booked adapts for Solo vs Multi-Crew', () => {
  // Solo Mode
  const soloText = renderSituationAwareText('starter_job_booked', {
    operationMode: 'solo',
    customerName: 'Sarah Jenkins',
    serviceName: 'AC Tune-up',
    bookingTime: 'Tomorrow at 10:00 AM',
    jobMilestone: 1,
    targetUrl: '/client/jobs'
  })
  assert.ok(soloText.includes('[Job 1 of 3 Free]'), 'Includes milestone tag')
  assert.ok(soloText.includes('Sarah Jenkins booked AC Tune-up'), 'Includes customer and service')
  assert.ok(soloText.includes('Tap to review: /client/jobs'), 'Uses solo action call (Tap to review)')

  // Multi-Crew Mode
  const crewText = renderSituationAwareText('starter_job_booked', {
    operationMode: 'multi_crew',
    customerName: 'Sarah Jenkins',
    serviceName: 'AC Tune-up',
    bookingTime: 'Tomorrow at 10:00 AM',
    jobMilestone: 1,
    targetUrl: '/client/jobs'
  })
  assert.ok(crewText.includes('Tap to assign crew: /client/jobs'), 'Uses multi-crew action call (Tap to assign crew)')

  // Milestone 3 (Final free job)
  const finalJobText = renderSituationAwareText('starter_job_booked', {
    operationMode: 'solo',
    customerName: 'Marcus Vance',
    serviceName: 'Pipe Repair',
    bookingTime: 'Friday at 2:00 PM',
    jobMilestone: 3,
    targetUrl: '/client/jobs'
  })
  assert.ok(finalJobText.includes('[Job 3 of 3 Free] Final Free Job Booked:'), 'Celebrates final free job')
})

test('Phase 2 - Situation Templates: starter_job_completed progression across 3 jobs', () => {
  // Job 1 Completed
  const job1Text = renderSituationAwareText('starter_job_completed', {
    customerName: 'Bob Vance',
    jobRevenue: 250,
    jobMilestone: 1,
    remainingJobs: 2
  })
  assert.ok(job1Text.includes('[Job 1 of 3 Free Completed]'), 'Milestone 1 header')
  assert.ok(job1Text.includes('Paid $250 for Bob Vance'), 'Includes job revenue and customer')
  assert.ok(job1Text.includes('2 free jobs remaining'), 'Calculates 2 remaining')

  // Job 2 Completed
  const job2Text = renderSituationAwareText('starter_job_completed', {
    customerName: 'Alice Green',
    jobRevenue: 300,
    totalRevenue: 550,
    jobMilestone: 2,
    remainingJobs: 1
  })
  assert.ok(job2Text.includes('[Job 2 of 3 Free Completed]'), 'Milestone 2 header')
  assert.ok(job2Text.includes('$300 collected ($550 total on free pass)'), 'Includes cumulative revenue')
  assert.ok(job2Text.includes('1 free job left!'), '1 free job left callout')

  // Job 3 Completed (Full Pass Completed Milestone)
  const job3Text = renderSituationAwareText('starter_job_completed', {
    totalRevenue: 950,
    jobMilestone: 3,
    remainingJobs: 0,
    upgradeUrl: '/client/billing?reason=starter_limit'
  })
  assert.ok(job3Text.includes('🏆 [Free Starter Pass Completed]'), 'Trophy milestone badge')
  assert.ok(job3Text.includes('earned $950 across 3 jobs on CaptoDesk with $0 platform fees'), 'Celebrates total earned with $0 fees')
  assert.ok(job3Text.includes('Upgrade to Pro to keep automated bookings'), 'Pro upgrade call-to-action')
})

test('Phase 2 - Situation Templates: starter_job_gated alerts contractor of waiting revenue', () => {
  const gatedText = renderSituationAwareText('starter_job_gated', {
    customerName: 'Emily Stone',
    serviceName: 'Water Heater Replacement',
    jobRevenue: 850,
    upgradeUrl: '/client/billing?reason=starter_limit'
  })
  assert.ok(gatedText.includes('🚨 New Job Waiting: Emily Stone booked Water Heater Replacement ($850 est. revenue)!'), 'Signals real waiting revenue')
  assert.ok(gatedText.includes("You've used your 3 free jobs. Upgrade to Pro to unlock this job and dispatch immediately"), 'Clear upgrade incentive')
})

test('Phase 2 - Situation Templates: Customer-facing situation-aware texts', () => {
  // Booking confirmation
  const soloConf = renderSituationAwareText('customer_booking_confirmation', {
    operationMode: 'solo',
    customerName: 'John',
    businessName: 'Rapid Electric',
    serviceName: 'Panel Upgrade',
    bookingTime: 'Monday at 9am',
    manageUrl: 'https://book.captodesk.com/manage/xyz'
  })
  assert.ok(soloConf.includes('Hi John! Your appointment with Rapid Electric for Panel Upgrade is confirmed for Monday at 9am.'))

  const crewConf = renderSituationAwareText('customer_booking_confirmation', {
    operationMode: 'multi_crew',
    customerName: 'John',
    businessName: 'Rapid Electric',
    serviceName: 'Panel Upgrade',
    bookingTime: 'Monday at 9am',
    manageUrl: 'https://book.captodesk.com/manage/xyz'
  })
  assert.ok(crewConf.includes('Our crew looks forward to serving you'))

  // En Route
  const soloRoute = renderSituationAwareText('customer_en_route', {
    operationMode: 'solo',
    customerName: 'John',
    businessName: 'Rapid Electric',
    technicianName: 'Mike',
    etaMinutes: 15
  })
  assert.strictEqual(soloRoute, 'Hi John, Mike from Rapid Electric is en route to your location. ETA ~15 mins.')

  const crewRoute = renderSituationAwareText('customer_en_route', {
    operationMode: 'multi_crew',
    customerName: 'John',
    businessName: 'Rapid Electric',
    technicianName: 'Dave',
    etaMinutes: 20
  })
  assert.strictEqual(crewRoute, 'Hi John, your technician Dave from Rapid Electric is en route to your location. ETA ~20 mins.')

  // Review Request
  const soloReview = renderSituationAwareText('customer_review_request', {
    operationMode: 'solo',
    customerName: 'John',
    businessName: 'Rapid Electric',
    technicianName: 'Mike',
    reviewUrl: 'https://captodesk.com/r/abc'
  })
  assert.ok(soloReview.includes('Could you take 30 seconds to leave Mike a quick Google review? It helps my small business tremendously: https://captodesk.com/r/abc'))

  const crewReview = renderSituationAwareText('customer_review_request', {
    operationMode: 'multi_crew',
    customerName: 'John',
    businessName: 'Rapid Electric',
    reviewUrl: 'https://captodesk.com/r/abc'
  })
  assert.ok(crewReview.includes('How did our crew do? Please take 30 seconds to leave us a Google review: https://captodesk.com/r/abc'))
})

test('Phase 2 - Operation Mode: resolveOperationMode detects mode properly', () => {
  assert.strictEqual(resolveOperationMode({ operation_mode: 'multi_crew' }), 'multi_crew')
  assert.strictEqual(resolveOperationMode({ operation_mode: 'solo' }), 'solo')
  assert.strictEqual(resolveOperationMode({ operationMode: 'multi_crew' }), 'multi_crew')
  assert.strictEqual(resolveOperationMode({ operationMode: 'fleet' }), 'multi_crew')
  assert.strictEqual(resolveOperationMode({ crew_count: 3 }), 'multi_crew')
  assert.strictEqual(resolveOperationMode({ crews: [1, 2] }), 'multi_crew')
  assert.strictEqual(resolveOperationMode(null), 'solo')
  assert.strictEqual(resolveOperationMode({}), 'solo')
})

test('Phase 2 - Notification Policy: Controlled catalog and routing for Starter Pass', () => {
  assert.ok(isKnownEvent('starter_pass_welcome'))
  assert.ok(isKnownEvent('starter_job_booked'))
  assert.ok(isKnownEvent('starter_job_completed'))
  assert.ok(isKnownEvent('starter_job_gated'))

  const bookedPolicy = getEventPolicy('starter_job_booked')
  assert.strictEqual(bookedPolicy.priority, 'critical')
  assert.ok(bookedPolicy.channels.includes('in_app'))
  assert.ok(bookedPolicy.channels.includes('sms'))
  assert.ok(bookedPolicy.channels.includes('push'))

  assert.strictEqual(resolveDefaultTargetUrl('starter_pass_welcome'), '/client/settings')
  assert.strictEqual(resolveDefaultTargetUrl('starter_job_booked'), '/client/jobs')
  assert.strictEqual(resolveDefaultTargetUrl('starter_job_completed'), '/client/invoices')
  assert.strictEqual(resolveDefaultTargetUrl('starter_job_gated'), '/client/billing')
})

test('Phase 2 - Notification Service: In-app record dispatch with situation-aware copy', async () => {
  const insertedRows = []
  const mockSupabase = {
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (table === 'organizations') {
              return { data: { id: 'org-test-1', name: 'Apex Plumbing', operation_mode: 'solo' } }
            }
            return { data: null }
          },
          eq: () => ({
            maybeSingle: async () => ({ data: null })
          })
        })
      }),
      insert: (row) => ({
        select: () => ({
          maybeSingle: async () => {
            insertedRows.push({ table, ...row })
            return { data: { id: 'notif-123' }, error: null }
          }
        }),
        then: (resolve) => resolve({ data: null, error: null })
      })
    })
  }

  const result = await notifyOwner(mockSupabase, {
    event: 'starter_job_booked',
    organizationId: 'org-test-1',
    data: {
      customerName: 'Laura Palmer',
      serviceName: 'Drain Clearing',
      bookingTime: 'Today at 3:00 PM',
      jobMilestone: 2,
      remainingJobs: 1
    }
  })

  assert.strictEqual(result.attempted, true)
  assert.strictEqual(result.event, 'starter_job_booked')
  const inAppRecord = insertedRows.find(r => r.table === 'notifications')
  assert.ok(inAppRecord, 'Created in-app notification record')
  assert.ok(inAppRecord.title.includes('[Job 2 of 3 Free] New Booking'))
  assert.ok(inAppRecord.message.includes('Laura Palmer booked Drain Clearing'))
  assert.ok(inAppRecord.message.includes('Tap to review: /client/jobs'))
})

test('Phase 2 - Review Manager: formatCompliantReviewMessage situation awareness', () => {
  // Default legacy behavior
  const defaultText = formatCompliantReviewMessage('Apex Plumbing', 'https://google.com/review')
  assert.strictEqual(defaultText, "Thanks for choosing Apex Plumbing. We'd really appreciate your feedback. You can leave us a Google review here: https://google.com/review")

  // Situation-aware Solo
  const soloText = formatCompliantReviewMessage('Apex Plumbing', 'https://google.com/review', {
    operationMode: 'solo',
    customerName: 'Alice',
    technicianName: 'Bob'
  })
  assert.ok(soloText.includes('Could you take 30 seconds to leave Bob a quick Google review? It helps my small business tremendously: https://google.com/review'))

  // Situation-aware Multi-Crew
  const crewText = formatCompliantReviewMessage('Apex Plumbing', 'https://google.com/review', {
    operationMode: 'multi_crew',
    customerName: 'Alice'
  })
  assert.ok(crewText.includes('How did our crew do? Please take 30 seconds to leave us a Google review: https://google.com/review'))
})
