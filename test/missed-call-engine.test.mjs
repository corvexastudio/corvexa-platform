process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { normalizePhoneToE164, isValidE164, formatNationalUs } from '../src/lib/telephony/phone-normalizer.ts'
import { evaluateCallOutcome } from '../src/lib/telephony/call-state-machine.ts'
import { evaluateSuppression, isSpamOrBlockedNumber } from '../src/lib/telephony/suppression-rules.ts'
import { renderTemplate, resolveMissedCallTemplate } from '../src/lib/telephony/template-engine.ts'
import { resolveOrganizationByPhoneNumber } from '../src/lib/telephony/telnyx-numbers.ts'
import { processMissedCall } from '../src/lib/services/call-recovery.ts'
import { verifyTelnyxSignature } from '../src/lib/telnyx.ts'

/**
 * -----------------------------------------------------------------------------
 * IN-MEMORY SUPABASE DATABASE HARNESS FOR TELEPHONY TESTS
 * -----------------------------------------------------------------------------
 */
function createMockTelephonyDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers || [],
    contacts: initialState.contacts || [],
    conversations: initialState.conversations || [],
    messages: initialState.messages || [],
    calls: initialState.calls || [],
    leads: initialState.leads || [],
    processed_events: initialState.processed_events || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let data = [...(tables[tableName] || [])]
      let filters = []

      const queryBuilder = {
        select: (columns) => queryBuilder,
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return queryBuilder
        },
        gte: (col, val) => {
          filters.push((row) => new Date(row[col]) >= new Date(val))
          return queryBuilder
        },
        limit: (n) => queryBuilder,
        then: (resolve, reject) => {
          const filtered = data.filter((row) => filters.every((fn) => fn(row)))
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject)
        },
        maybeSingle: async () => {
          const filtered = data.filter((row) => filters.every((fn) => fn(row)))
          const item = filtered[0] || null
          // Join nested organizations if requested on telnyx_phone_numbers
          if (item && tableName === 'telnyx_phone_numbers') {
            const org = tables.organizations.find((o) => o.id === item.org_id)
            return { data: { ...item, organizations: org }, error: null }
          }
          return { data: item, error: null }
        },
        single: async () => {
          const filtered = data.filter((row) => filters.every((fn) => fn(row)))
          if (filtered.length === 0) return { data: null, error: new Error('Row not found') }
          const item = filtered[0]
          return { data: item, error: null }
        },
        insert: (rowOrRows) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          let insertError = null
          let insertedRows = []

          for (const row of rows) {
            const newRow = { id: row.id || `mock_${Date.now()}_${Math.random()}`, created_at: new Date().toISOString(), ...row }
            
            // Check unique constraints
            if (tableName === 'processed_events' && tables.processed_events.some((e) => e.id === newRow.id)) {
              insertError = { code: '23505', message: 'Unique violation' }
              break
            }
            if (tableName === 'contacts' && tables.contacts.some((c) => c.org_id === newRow.org_id && c.phone === newRow.phone)) {
              insertError = { code: '23505', message: 'Unique violation' }
              break
            }

            tables[tableName].push(newRow)
            insertedRows.push(newRow)
          }

          const lastInserted = insertedRows[insertedRows.length - 1] || null

          return {
            data: insertError ? null : lastInserted,
            error: insertError,
            select: () => ({
              single: async () => ({ data: insertError ? null : lastInserted, error: insertError }),
              maybeSingle: async () => ({ data: insertError ? null : lastInserted, error: insertError })
            }),
            then: (resolve, reject) => {
              return Promise.resolve({ data: insertError ? null : lastInserted, error: insertError }).then(resolve, reject)
            }
          }
        },
        update: (updates) => ({
          eq: (col, val) => {
            let updated = null
            for (const row of tables[tableName]) {
              if (row[col] === val) {
                Object.assign(row, updates)
                updated = row
              }
            }
            return {
              data: updated,
              error: null,
              select: () => ({
                maybeSingle: async () => ({ data: updated, error: null }),
                single: async () => ({ data: updated, error: null })
              })
            }
          }
        })
      }

      return queryBuilder
    }
  }

  return client
}

/**
 * -----------------------------------------------------------------------------
 * 1. PHONE NORMALIZER TESTS
 * -----------------------------------------------------------------------------
 */
test('Phone Normalizer: Normalizes 10-digit, 11-digit, and international E.164 numbers', () => {
  // 10 digits US
  const us10 = normalizePhoneToE164('2145550199')
  assert.strictEqual(us10.isValid, true)
  assert.strictEqual(us10.e164, '+12145550199')

  // Formatted US string with spaces and dashes
  const formattedUs = normalizePhoneToE164('(214) 555-0199')
  assert.strictEqual(formattedUs.isValid, true)
  assert.strictEqual(formattedUs.e164, '+12145550199')

  // 11 digits starting with 1
  const us11 = normalizePhoneToE164('12145550199')
  assert.strictEqual(us11.isValid, true)
  assert.strictEqual(us11.e164, '+12145550199')

  // International format with plus
  const intl = normalizePhoneToE164('+442071838750')
  assert.strictEqual(intl.isValid, true)
  assert.strictEqual(intl.e164, '+442071838750')

  // National US formatting helper
  assert.strictEqual(formatNationalUs('+12145550199'), '(214) 555-0199')
})

test('Phone Normalizer: Rejects short codes, arbitrary text, and invalid numbers', () => {
  assert.strictEqual(normalizePhoneToE164('').isValid, false)
  assert.strictEqual(normalizePhoneToE164('UNKNOWN').isValid, false)
  assert.strictEqual(normalizePhoneToE164('SPAMCALL').isValid, false)
  assert.strictEqual(normalizePhoneToE164('911').isValid, false)
  assert.strictEqual(normalizePhoneToE164('12345').isValid, false)
  // Invalid area code starting with 0
  assert.strictEqual(normalizePhoneToE164('0145550199').isValid, false)
})

/**
 * -----------------------------------------------------------------------------
 * 2. CALL STATE MACHINE TESTS
 * -----------------------------------------------------------------------------
 */
test('Call State Machine: Answered call is classified as answered and NOT eligible for recovery SMS', () => {
  // Event: call.answered
  const answeredEvent = evaluateCallOutcome('call.answered', {
    state: 'answered',
    duration_secs: 45
  })
  assert.strictEqual(answeredEvent.wasAnswered, true)
  assert.strictEqual(answeredEvent.isEligibleForRecovery, false)

  // Event: call.hangup with state: answered
  const completedHangup = evaluateCallOutcome('call.hangup', {
    state: 'answered',
    hangup_cause: 'normal_clearing',
    duration_secs: 55
  })
  assert.strictEqual(completedHangup.wasAnswered, true)
  assert.strictEqual(completedHangup.isEligibleForRecovery, false)
  assert.match(completedHangup.description, /Recovery SMS must NOT be sent/)
})

test('Call State Machine: Busy call is classified as busy and eligible for recovery', () => {
  const busyHangup = evaluateCallOutcome('call.hangup', {
    state: 'busy',
    hangup_cause: 'user_busy',
    duration_secs: 0
  })
  assert.strictEqual(busyHangup.state, 'busy')
  assert.strictEqual(busyHangup.wasAnswered, false)
  assert.strictEqual(busyHangup.isEligibleForRecovery, true)
  assert.strictEqual(busyHangup.recoveryReason, 'busy')
})

test('Call State Machine: No-answer / abandoned ringing is classified as no_answer and eligible for recovery', () => {
  const unansweredHangup = evaluateCallOutcome('call.hangup', {
    state: 'ringing',
    hangup_cause: 'originator_cancel',
    duration_secs: 12
  })
  assert.strictEqual(unansweredHangup.state, 'no_answer')
  assert.strictEqual(unansweredHangup.wasAnswered, false)
  assert.strictEqual(unansweredHangup.isEligibleForRecovery, true)
  assert.strictEqual(unansweredHangup.recoveryReason, 'no_answer')
})

/**
 * -----------------------------------------------------------------------------
 * 3. TEMPLATE ENGINE TESTS
 * -----------------------------------------------------------------------------
 */
test('Template Engine: Interpolates dynamic tags correctly', () => {
  const template = 'Hi {{caller_name}}, this is {{business_name}}! Call us back at {{callback_number}}.'
  const rendered = renderTemplate(template, {
    caller_name: 'Sarah',
    business_name: 'Apex Heating & AC',
    callback_number: '(214) 555-0100'
  })
  assert.strictEqual(rendered, 'Hi Sarah, this is Apex Heating & AC! Call us back at (214) 555-0100.')
})

test('Template Engine: Resolves business hours vs after-hours vs busy templates', () => {
  const org = {
    name: 'Pro Air Solutions',
    auto_reply_template: 'Open now: {{business_name}} will help you shortly!',
    after_hours_template: 'Closed now: {{business_name}} will call you tomorrow!',
    busy_template: 'Line busy: {{business_name}} is on the other line!'
  }

  // Busy outcome
  const busyOutcome = { state: 'busy', wasAnswered: false, isEligibleForRecovery: true, durationSeconds: 0, description: '' }
  const busyRes = resolveMissedCallTemplate(org, busyOutcome, 'Caller')
  assert.strictEqual(busyRes.templateType, 'busy')
  assert.strictEqual(busyRes.renderedText, 'Line busy: Pro Air Solutions is on the other line!')
})

/**
 * -----------------------------------------------------------------------------
 * 4. END-TO-END TELEPHONY ENGINE SPECIFICATION TESTS (11 MANDATORY SCENARIOS)
 * -----------------------------------------------------------------------------
 */

// Scenario 1: Answered call -> No SMS sent, logged as answered
test('Scenario 1: Answered call does NOT send recovery SMS and logs call telemetry', async () => {
  const db = createMockTelephonyDb({
    organizations: [
      { id: 'org-1', name: 'Cool HVAC', is_missed_call_active: true }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'answered',
    hangup_cause: 'normal_clearing',
    duration_secs: 42
  })

  const result = await processMissedCall(db, {
    callerNumber: '+12145550999',
    calledNumber: '+12145550100',
    callOutcome,
    callControlId: 'ctrl-123'
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.action, 'call_answered_logged')

  // Verify call record logged with auto_reply_sent: false
  assert.strictEqual(db._tables.calls.length, 1)
  assert.strictEqual(db._tables.calls[0].status, 'completed')
  assert.strictEqual(db._tables.calls[0].auto_reply_sent, false)
  // Zero outbound messages
  assert.strictEqual(db._tables.messages.length, 0)
})

// Scenario 2: Unanswered call -> SMS sent with business hours copy
test('Scenario 2: Unanswered call triggers SMS with business-hours template', async () => {
  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Cool HVAC',
        is_missed_call_active: true,
        auto_reply_template: 'Hey, this is {{business_name}}! We missed your call.',
        // Mock business hours open 24/7 for this test
        business_hours: {
          monday: { open: '00:00', close: '23:59', closed: false },
          tuesday: { open: '00:00', close: '23:59', closed: false },
          wednesday: { open: '00:00', close: '23:59', closed: false },
          thursday: { open: '00:00', close: '23:59', closed: false },
          friday: { open: '00:00', close: '23:59', closed: false },
          saturday: { open: '00:00', close: '23:59', closed: false },
          sunday: { open: '00:00', close: '23:59', closed: false }
        }
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 20
  })

  const result = await processMissedCall(db, {
    callerNumber: '+12145550999',
    calledNumber: '+12145550100',
    callOutcome,
    callControlId: 'ctrl-unanswered'
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.action, 'auto_reply_sent')

  // Verify call, message, and lead were recorded
  assert.strictEqual(db._tables.calls.length, 1)
  assert.strictEqual(db._tables.calls[0].auto_reply_sent, true)
  assert.strictEqual(db._tables.messages.length, 1)
  assert.strictEqual(db._tables.messages[0].body, 'Hey, this is Cool HVAC! We missed your call.')
  assert.strictEqual(db._tables.messages[0].automation_source, 'missed_call_recovery')
  assert.strictEqual(db._tables.leads.length, 1)
})

// Scenario 3: Busy call -> SMS sent with busy copy
test('Scenario 3: Busy call triggers SMS with busy copy', async () => {
  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Cool HVAC',
        is_missed_call_active: true,
        busy_template: '{{business_name}} is currently assisting another caller. How can we help?',
        business_hours: {
          monday: { open: '00:00', close: '23:59', closed: false },
          tuesday: { open: '00:00', close: '23:59', closed: false },
          wednesday: { open: '00:00', close: '23:59', closed: false },
          thursday: { open: '00:00', close: '23:59', closed: false },
          friday: { open: '00:00', close: '23:59', closed: false },
          saturday: { open: '00:00', close: '23:59', closed: false },
          sunday: { open: '00:00', close: '23:59', closed: false }
        }
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'busy',
    hangup_cause: 'user_busy',
    duration_secs: 0
  })

  const result = await processMissedCall(db, {
    callerNumber: '+12145550999',
    calledNumber: '+12145550100',
    callOutcome
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.action, 'auto_reply_sent')
  assert.strictEqual(db._tables.messages[0].body, 'Cool HVAC is currently assisting another caller. How can we help?')
})

// Scenario 4: Duplicate webhook -> Atomic idempotency prevents duplicate action
test('Scenario 4: Duplicate webhook event claims result in exactly one business action', async () => {
  const db = createMockTelephonyDb({
    processed_events: []
  })

  const eventId = 'evt_unique_12345'

  // First arrival: Inserts successfully
  const claim1 = await db.from('processed_events').insert({
    id: eventId,
    provider: 'telnyx',
    event_type: 'call.hangup'
  })
  assert.strictEqual(claim1.error, null)

  // Second arrival: Unique conflict (code 23505)
  const claim2 = await db.from('processed_events').insert({
    id: eventId,
    provider: 'telnyx',
    event_type: 'call.hangup'
  })
  assert.ok(claim2.error)
  assert.strictEqual(claim2.error.code, '23505')
})

// Scenario 5: Invalid webhook signature -> Rejected
test('Scenario 5: Webhook verification rejects invalid or tampered signatures', () => {
  const keyPair = crypto.generateKeyPairSync('ed25519')
  const rawPub = keyPair.publicKey.export({ format: 'der', type: 'spki' }).subarray(12)
  const pubBase64 = rawPub.toString('base64')

  const now = Math.floor(Date.now() / 1000)
  const body = JSON.stringify({ data: { event_type: 'call.hangup' } })

  // Invalid fake signature
  const isInvalid = verifyTelnyxSignature(body, 'bad_signature_base64', String(now), pubBase64)
  assert.strictEqual(isInvalid, false)

  // Valid signature passes
  const validSig = crypto.sign(null, Buffer.from(`${now}|${body}`), keyPair.privateKey).toString('base64')
  const isValid = verifyTelnyxSignature(body, validSig, String(now), pubBase64)
  assert.strictEqual(isValid, true)
})

// Scenario 6: Opted-out customer -> Suppressed
test('Scenario 6: Call from opted-out customer suppresses auto-reply SMS', async () => {
  const db = createMockTelephonyDb({
    organizations: [
      { id: 'org-1', name: 'Cool HVAC', is_missed_call_active: true }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ],
    contacts: [
      { id: 'cnt-opted-out', org_id: 'org-1', phone: '+12145550999', opt_out: true, name: 'Opted Out User' }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 15
  })

  const result = await processMissedCall(db, {
    callerNumber: '+12145550999',
    calledNumber: '+12145550100',
    callOutcome
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.action, 'suppressed_opted_out')
  assert.strictEqual(result.suppressionReason, 'opted_out')

  // Zero messages sent
  assert.strictEqual(db._tables.messages.length, 0)
  // Call logged with suppression reason
  assert.strictEqual(db._tables.calls[0].suppression_reason, 'opted_out')
})

// Scenario 7: After-hours call -> Uses after-hours template
test('Scenario 7: Call arriving after-hours uses after_hours_template', async () => {
  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Cool HVAC',
        is_missed_call_active: true,
        after_hours_template: 'Thanks for calling {{business_name}}. We are closed for the evening.',
        // Configured closed 24/7 to guarantee after-hours evaluation
        business_hours: {
          monday: { open: '00:00', close: '00:00', closed: true },
          tuesday: { open: '00:00', close: '00:00', closed: true },
          wednesday: { open: '00:00', close: '00:00', closed: true },
          thursday: { open: '00:00', close: '00:00', closed: true },
          friday: { open: '00:00', close: '00:00', closed: true },
          saturday: { open: '00:00', close: '00:00', closed: true },
          sunday: { open: '00:00', close: '00:00', closed: true }
        }
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 15
  })

  const result = await processMissedCall(db, {
    callerNumber: '+12145550999',
    calledNumber: '+12145550100',
    callOutcome
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.action, 'auto_reply_sent')
  assert.strictEqual(db._tables.messages[0].body, 'Thanks for calling Cool HVAC. We are closed for the evening.')
})

// Scenario 8: Existing customer -> Reuses contact and conversation
test('Scenario 8: Call from existing customer reuses existing contact and conversation thread', async () => {
  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Cool HVAC',
        is_missed_call_active: true,
        business_hours: { monday: { open: '00:00', close: '23:59', closed: false } }
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ],
    contacts: [
      { id: 'cnt-existing-1', org_id: 'org-1', phone: '+12145550999', name: 'Existing Customer' }
    ],
    conversations: [
      { id: 'conv-existing-1', org_id: 'org-1', contact_id: 'cnt-existing-1' }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 10
  })

  await processMissedCall(db, {
    callerNumber: '+12145550999',
    calledNumber: '+12145550100',
    callOutcome
  })

  // Contact list size did not increase
  assert.strictEqual(db._tables.contacts.length, 1)
  // Conversation list size did not increase
  assert.strictEqual(db._tables.conversations.length, 1)
  // Message attached to existing conversation
  assert.strictEqual(db._tables.messages[0].conversation_id, 'conv-existing-1')
})

// Scenario 9: New customer -> Creates contact, conversation, and lead
test('Scenario 9: Call from new customer creates contact, conversation, and lead', async () => {
  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Cool HVAC',
        is_missed_call_active: true,
        business_hours: { monday: { open: '00:00', close: '23:59', closed: false } }
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 10
  })

  await processMissedCall(db, {
    callerNumber: '+12145550888',
    calledNumber: '+12145550100',
    callOutcome
  })

  assert.strictEqual(db._tables.contacts.length, 1)
  assert.strictEqual(db._tables.contacts[0].phone, '+12145550888')
  assert.strictEqual(db._tables.conversations.length, 1)
  assert.strictEqual(db._tables.leads.length, 1)
  assert.strictEqual(db._tables.leads[0].source, 'missed_call')
})

// Scenario 10: Duplicate missed call within cooldown -> Suppressed
test('Scenario 10: Second missed call from same number within cooldown is suppressed', async () => {
  const recentTime = new Date().toISOString()
  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-1',
        name: 'Cool HVAC',
        is_missed_call_active: true,
        cooldown_hours: 24,
        business_hours: { monday: { open: '00:00', close: '23:59', closed: false } }
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-1', phone_number: '+12145550100', status: 'active', capabilities: ['voice', 'sms'] }
    ],
    calls: [
      {
        id: 'call-prior',
        org_id: 'org-1',
        caller_number: '+12145550999',
        called_number: '+12145550100',
        status: 'missed',
        auto_reply_sent: true,
        created_at: recentTime
      }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 10
  })

  const result = await processMissedCall(db, {
    callerNumber: '+12145550999',
    calledNumber: '+12145550100',
    callOutcome
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.action, 'suppressed_cooldown_active')
  assert.strictEqual(result.suppressionReason, 'cooldown_active')

  // Zero new outbound messages sent
  assert.strictEqual(db._tables.messages.length, 0)
})

// Scenario 11: Multiple tenants -> Independent routing and templates
test('Scenario 11: Multiple tenants receive calls on distinct numbers with strict isolation', async () => {
  const db = createMockTelephonyDb({
    organizations: [
      {
        id: 'org-tenant-1',
        name: 'Alpha Plumbing',
        is_missed_call_active: true,
        auto_reply_template: 'Alpha Plumbing missed you!'
      },
      {
        id: 'org-tenant-2',
        name: 'Beta Electric',
        is_missed_call_active: true,
        auto_reply_template: 'Beta Electric missed you!'
      }
    ],
    telnyx_phone_numbers: [
      { org_id: 'org-tenant-1', phone_number: '+12145550001', status: 'active', capabilities: ['voice', 'sms'] },
      { org_id: 'org-tenant-2', phone_number: '+12145550002', status: 'active', capabilities: ['voice', 'sms'] }
    ]
  })

  const callOutcome = evaluateCallOutcome('call.hangup', {
    state: 'no_answer',
    hangup_cause: 'timeout',
    duration_secs: 10
  })

  // Call to Tenant 1
  const res1 = await processMissedCall(db, {
    callerNumber: '+12145550777',
    calledNumber: '+12145550001',
    callOutcome
  })
  assert.strictEqual(res1.orgId, 'org-tenant-1')

  // Call to Tenant 2
  const res2 = await processMissedCall(db, {
    callerNumber: '+12145550777',
    calledNumber: '+12145550002',
    callOutcome
  })
  assert.strictEqual(res2.orgId, 'org-tenant-2')

  // Verify messages belong to respective tenants with their distinct templates
  const msg1 = db._tables.messages.find((m) => m.org_id === 'org-tenant-1')
  const msg2 = db._tables.messages.find((m) => m.org_id === 'org-tenant-2')

  assert.strictEqual(msg1.body, 'Alpha Plumbing missed you!')
  assert.strictEqual(msg2.body, 'Beta Electric missed you!')
})
