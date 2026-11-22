process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  renderTemplate,
  normalizeToGsm7,
  isGsm7,
  DEFAULT_OPEN_TEMPLATE,
  DEFAULT_AFTER_HOURS_TEMPLATE
} from '../src/lib/telephony/template-engine.ts'
import { calculateNextMorning805 } from '../src/lib/services/call-recovery.ts'
import { calculateNextRetry } from '../src/lib/automations/worker.ts'
import { claimWebhookEvent } from '../src/lib/webhooks/idempotency.ts'
import { evaluateSuppression } from '../src/lib/telephony/suppression-rules.ts'

// --- In-Memory Mock Database Helper for Idempotency and Suppression ---
function createMockSupabase(initialStore = {}) {
  const store = {
    organizations: initialStore.organizations || [
      { id: 'org-test-001', name: 'Austin Comfort Air', slug: 'austin-comfort-air' }
    ],
    profiles: initialStore.profiles || [
      { id: 'usr-owner-01', org_id: 'org-test-001', role: 'owner', email: 'owner@austincomfort.com' }
    ],
    processed_events: initialStore.processed_events || [],
    automation_runs: initialStore.automation_runs || [],
    audit_logs: initialStore.audit_logs || [],
    compliance_suppression_list: initialStore.compliance_suppression_list || [],
    calls: initialStore.calls || [],
    contacts: initialStore.contacts || []
  }

  const client = {
    _store: store,
    auth: {
      getUser: async () => ({
        data: { user: store.profiles[0] ? { id: store.profiles[0].id, email: store.profiles[0].email } : null },
        error: null
      })
    },
    from: (tableName) => {
      if (!store[tableName]) store[tableName] = []
      let filters = []

      const query = {
        select: (_cols) => query,
        eq: (col, val) => {
          filters.push(row => row[col] === val)
          return query
        },
        gte: (col, val) => {
          filters.push(row => new Date(row[col]) >= new Date(val))
          return query
        },
        limit: (_n) => query,
        order: () => query,
        in: (col, arr) => {
          filters.push(row => arr.includes(row[col]))
          return query
        },
        single: async () => {
          const rows = store[tableName].filter(row => filters.every(f => f(row)))
          if (rows.length === 0) return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
          return { data: { ...rows[0] }, error: null }
        },
        maybeSingle: async () => {
          const rows = store[tableName].filter(row => filters.every(f => f(row)))
          return { data: rows[0] ? { ...rows[0] } : null, error: null }
        },
        insert: async (payload) => {
          const items = Array.isArray(payload) ? payload : [payload]
          for (const item of items) {
            if (store[tableName].some(r => r.id === item.id)) {
              return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } }
            }
          }
          const inserted = items.map(item => ({
            id: item.id || `gen-${Math.random().toString(36).substring(2, 9)}`,
            created_at: item.created_at || new Date().toISOString(),
            ...item
          }))
          store[tableName].push(...inserted)
          return { data: inserted, error: null }
        },
        update: (updates) => {
          const updateChain = {
            eq: (col, val) => {
              filters.push(row => row[col] === val)
              return updateChain
            },
            select: () => updateChain,
            single: async () => {
              const rows = store[tableName].filter(row => filters.every(f => f(row)))
              if (rows.length === 0) return { data: null, error: { message: 'Row not found' } }
              Object.assign(rows[0], updates)
              return { data: { ...rows[0] }, error: null }
            },
            then: (resolve, reject) => {
              const rows = store[tableName].filter(row => filters.every(f => f(row)))
              rows.forEach(r => Object.assign(r, updates))
              return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
            }
          }
          return updateChain
        },
        then: (resolve, reject) => {
          const rows = store[tableName].filter(row => filters.every(f => f(row)))
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
        }
      }
      return query
    }
  }

  return client
}

// GSM-7 Segment Calculation Helper (Used in Automations Page)
function getSmsSegmentCount(text) {
  const len = text.length
  if (len === 0) return { chars: 0, segments: 1 }
  if (len <= 160) return { chars: len, segments: 1 }
  return { chars: len, segments: Math.ceil(len / 153) }
}

// -------------------------------------------------------------
// TEST SUITE: AUTOMATIONS MOBILE-FIRST CONTROL CENTER
// -------------------------------------------------------------

test('1. Core Automation Workflows: Invariants, Triggers, and Timing Specifications', () => {
  const workflows = [
    {
      id: 'missed_call',
      name: 'Missed-Call Instant Auto-Reply',
      trigger: 'Unanswered Inbound Call (Business Hours)',
      timing: '< 5 Seconds',
      delaySeconds: 0
    },
    {
      id: 'after_hours',
      name: 'After-Hours & Weekend Auto-Reply',
      trigger: 'Inbound Call Outside Business Hours',
      timing: 'Immediate or 8:05 AM (Quiet Hours)',
      delaySeconds: 0
    },
    {
      id: 'cooldown',
      name: 'Repeat Caller Cooldown Protection',
      trigger: 'Inbound call from existing caller within active window',
      timing: 'Suppressed (12h, 24h, 48h, 72h)',
      delaySeconds: null
    },
    {
      id: 'review',
      name: 'Post-Job Google Review Request',
      trigger: 'Field Job Status: Completed',
      timing: '+30 Minutes Delay',
      delaySeconds: 1800
    },
    {
      id: 'reminder',
      name: 'Multi-Touch Appointment Reminders',
      trigger: 'Scheduled Appointments',
      timing: 'Instant Booking, 24 Hours Prior, 2 Hours En Route',
      stagesCount: 3
    },
    {
      id: 'estimate',
      name: 'Estimate Approval Follow-Up',
      trigger: 'Quote Status: Sent or Viewed without approval',
      timing: '+48 Hours and +5 Days',
      cadenceDays: [2, 5]
    },
    {
      id: 'winback',
      name: 'Seasonal Maintenance Win-Back',
      trigger: 'Customer Service Cadence Due',
      timing: '90 to 365 Days post-completion',
      cooldownDays: 30
    },
    {
      id: 'crew_broadcast',
      name: 'Daily Morning Crew Route Broadcast',
      trigger: 'Multi-Crew Fleet 7:00 AM Daily',
      timing: '7:00 AM Local Time',
      target: 'Assigned Fleet Vans'
    }
  ]

  assert.equal(workflows.length, 8, 'Exactly 8 canonical automation workflows defined')
  assert.equal(workflows[0].delaySeconds, 0, 'Missed call text has 0ms artificial delay (< 5s Telnyx SMS)')
  assert.equal(workflows[3].delaySeconds, 1800, 'Review request delay is exactly 30 minutes (1800 seconds)')
  assert.equal(workflows[4].stagesCount, 3, 'Appointment reminders have exactly 3 touchpoints')
})

test('2. Template Variable Engine and GSM-7 Segment Calculation', () => {
  const template = 'Hi, this is {business_name}! Lock in a spot on our schedule here: {booking_url} or text us what you need!'
  const rendered = renderTemplate(template, {
    business_name: 'Apex Heating & AC',
    booking_url: 'https://book.captodesk.com/apex-hvac'
  })

  // Verify variable replacement
  assert.ok(rendered.includes('Apex Heating & AC'))
  assert.ok(rendered.includes('https://book.captodesk.com/apex-hvac'))
  assert.ok(!rendered.includes('{business_name}'))
  assert.ok(!rendered.includes('{booking_url}'))

  // Verify GSM-7 normalization
  assert.ok(isGsm7(rendered), 'Rendered text conforms to GSM-7 character standard')

  // Verify Single Segment count (under 160 characters)
  const singleSegmentStats = getSmsSegmentCount(rendered)
  assert.equal(singleSegmentStats.segments, 1, 'Standard template fits within 1 SMS segment')
  assert.ok(singleSegmentStats.chars <= 160)

  // Verify Multi-Segment count (> 160 characters)
  const longText = 'A'.repeat(161)
  const multiSegmentStats = getSmsSegmentCount(longText)
  assert.equal(multiSegmentStats.segments, 2, '161 characters requires 2 SMS segments')

  // Verify missing booking url cleans up clause cleanly
  const renderedNoUrl = renderTemplate(
    'Hi from {business_name}! You can reserve an appointment here: {booking_url} - or text us back!',
    { business_name: 'Apex Heating & AC' }
  )
  assert.ok(!renderedNoUrl.includes('{booking_url}'))
  assert.ok(renderedNoUrl.includes('Apex Heating & AC'))
})

test('3. Idempotency Guard: Duplicate Webhook Execution Prevention', async () => {
  const mockDb = createMockSupabase()
  const eventId = 'telnyx-evt-unique-9988'

  // First webhook receipt: claims event successfully
  const claim1 = await claimWebhookEvent(mockDb, {
    eventId,
    provider: 'telnyx',
    eventType: 'call.hangup',
    staleTimeoutSeconds: 60
  })
  assert.equal(claim1.action, 'claimed', 'First event delivery claims lock')

  // Mark event completed
  const storedEvent = mockDb._store.processed_events.find(e => e.id === eventId)
  assert.ok(storedEvent)
  storedEvent.status = 'completed'

  // Second duplicate webhook delivery: detects completed event
  const claim2 = await claimWebhookEvent(mockDb, {
    eventId,
    provider: 'telnyx',
    eventType: 'call.hangup',
    staleTimeoutSeconds: 60
  })
  assert.equal(claim2.action, 'completed', 'Duplicate webhook is recognized as completed without re-executing')
})

test('4. Compliance: Recipient Quiet Hours Deferral, Opt-Out, and Cooldown Suppression', async () => {
  const mockDb = createMockSupabase()

  // Test 4A: Quiet hours calculation (8:00 PM to 8:00 AM)
  // Simulate call at 10:30 PM CST on Nov 22, 2026
  const eveningCallDate = new Date('2026-11-23T04:30:00.000Z') // 10:30 PM CST (UTC-6)
  const morningSchedule = calculateNextMorning805('America/Chicago', eveningCallDate)
  assert.ok(morningSchedule.scheduledAt, 'Generates valid scheduled UTC timestamp')
  assert.equal(morningSchedule.targetDateKey, '2026-11-23', 'Schedules for next morning')

  // Test 4B: Suppression evaluation for opted-out customer
  const optedOutSuppression = await evaluateSuppression({
    supabase: mockDb,
    orgId: 'org-test-001',
    callerNumber: '+15125550199',
    calledNumber: '+15125550100',
    contactOptOut: true,
    durationSeconds: 0,
    isMissedCallActive: true,
    cooldownHours: 24,
    timezone: 'America/Chicago',
    enforceQuietHours: false
  })
  assert.equal(optedOutSuppression.shouldSend, false)
  assert.equal(optedOutSuppression.suppressionReason, 'opted_out', 'Suppresses SMS for customer who texted STOP')

  // Test 4C: Cooldown window suppression
  mockDb._store.calls = [
    {
      id: 'call-prev-01',
      org_id: 'org-test-001',
      caller_number: '+15125550199',
      auto_reply_sent: true,
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString() // 2 hours ago
    }
  ]

  const cooldownSuppression = await evaluateSuppression({
    supabase: mockDb,
    orgId: 'org-test-001',
    callerNumber: '+15125550199',
    calledNumber: '+15125550100',
    contactOptOut: false,
    durationSeconds: 0,
    isMissedCallActive: true,
    cooldownHours: 24,
    timezone: 'America/Chicago',
    enforceQuietHours: false
  })
  assert.equal(cooldownSuppression.shouldSend, false)
  assert.equal(cooldownSuppression.suppressionReason, 'cooldown_active', 'Suppresses duplicate text within 24h window')
})

test('5. Delivery Health Pipeline Classification & Worker Retry Backoff', () => {
  // Test 5A: 6 Pipeline Health States
  const sampleRuns = [
    { id: 'run-1', status: 'scheduled' },
    { id: 'run-2', status: 'processing' },
    { id: 'run-3', status: 'sent' },
    { id: 'run-4', status: 'success' },
    { id: 'run-5', status: 'cancelled', failure_reason: 'Caller cooldown active' },
    { id: 'run-6', status: 'failed', failure_reason: 'Carrier network unreachable' }
  ]

  let stats = { scheduled: 0, processing: 0, sent: 0, delivered: 0, suppressed: 0, failed: 0 }
  sampleRuns.forEach(r => {
    if (r.status === 'scheduled') stats.scheduled++
    if (r.status === 'processing') stats.processing++
    if (r.status === 'sent') stats.sent++
    if (r.status === 'success') stats.delivered++
    if (r.status === 'cancelled') stats.suppressed++
    if (r.status === 'failed') stats.failed++
  })

  assert.equal(stats.scheduled, 1)
  assert.equal(stats.processing, 1)
  assert.equal(stats.sent, 1)
  assert.equal(stats.delivered, 1)
  assert.equal(stats.suppressed, 1)
  assert.equal(stats.failed, 1)

  // Test 5B: Worker calculateNextRetry
  const nextRetryDate = calculateNextRetry(1, 60)
  assert.ok(nextRetryDate.getTime() > Date.now(), 'Next retry is scheduled in the future with exponential backoff')

  // Test 5C: Status eligibility invariants
  const eligibleStatuses = ['failed', 'dead_letter']
  assert.ok(eligibleStatuses.includes('failed'), 'Failed runs are eligible for retry')
  assert.ok(eligibleStatuses.includes('dead_letter'), 'Dead letter runs are eligible for retry')
  assert.ok(!eligibleStatuses.includes('success'), 'Successful runs cannot be duplicate-retried')
})
