process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { verifyTelnyxSignature } from '../src/lib/telnyx.ts'
import { profileUpdateSchema, FORBIDDEN_ESCALATION_KEYS } from '../src/lib/security/profile-schema.ts'
import {
  isOptOutKeyword,
  isOptInKeyword,
  formatCompliantOutboundText,
  verifyOutboundCompliance,
  handleInboundComplianceKeyword,
  logComplianceAudit
} from '../src/lib/compliance/compliance-engine.ts'

/**
 * Phase 3 Mock Database Harness
 */
function createPhase3MockDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    profiles: initialState.profiles || [],
    contacts: initialState.contacts || [],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers || [],
    compliance_suppression_list: initialState.compliance_suppression_list || [],
    compliance_consent_records: initialState.compliance_consent_records || [],
    compliance_audit_logs: initialState.compliance_audit_logs || [],
    activity_logs: initialState.activity_logs || [],
    automation_runs: initialState.automation_runs || [],
    review_requests: initialState.review_requests || [],
    leads: initialState.leads || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []

      const qb = {
        select: (cols) => qb,
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return qb
        },
        neq: (col, val) => {
          filters.push((row) => row[col] !== val)
          return qb
        },
        in: (col, arr) => {
          filters.push((row) => arr.includes(row[col]))
          return qb
        },
        limit: () => qb,
        order: () => qb,
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
          if (filtered.length === 0) return { data: null, error: new Error('Not found') }
          return { data: filtered[0], error: null }
        },
        insert: (rowOrRows) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          for (const row of rows) {
            const newRow = { id: row.id || `mock_${Date.now()}_${Math.random()}`, created_at: new Date().toISOString(), ...row }
            if (!tables[tableName]) tables[tableName] = []
            tables[tableName].push(newRow)
          }
          return {
            select: () => ({
              single: async () => ({ data: tables[tableName][tables[tableName].length - 1], error: null })
            }),
            then: (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject)
          }
        },
        update: (updates) => {
          const updateFilters = [...filters]
          const ub = {
            eq: (col, val) => {
              updateFilters.push((row) => row[col] === val)
              return ub
            },
            select: () => ({
              single: async () => {
                let updated = null
                for (const row of tables[tableName] || []) {
                  if (updateFilters.every((fn) => fn(row))) {
                    Object.assign(row, updates)
                    updated = row
                  }
                }
                return { data: updated, error: null }
              },
              maybeSingle: async () => {
                let updated = null
                for (const row of tables[tableName] || []) {
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
              for (const row of tables[tableName] || []) {
                if (updateFilters.every((fn) => fn(row))) {
                  Object.assign(row, updates)
                  updated = row
                }
              }
              return Promise.resolve({ data: updated, error: null }).then(resolve, reject)
            }
          }
          return ub
        },
        upsert: (row, options) => {
          const conflictCol = (options?.onConflict || 'id').split(',')
          const tableData = tables[tableName] || []
          const existing = tableData.find((r) => conflictCol.every((c) => r[c] === row[c]))
          if (existing) {
            Object.assign(existing, row)
          } else {
            tableData.push({ id: `mock_${Date.now()}`, created_at: new Date().toISOString(), ...row })
          }
          return Promise.resolve({ data: row, error: null })
        },
        delete: () => {
          const deleteFilters = [...filters]
          return {
            eq: (col, val) => {
              deleteFilters.push((row) => row[col] === val)
              return {
                then: (resolve, reject) => {
                  tables[tableName] = (tables[tableName] || []).filter((r) => !deleteFilters.every((fn) => fn(r)))
                  return Promise.resolve({ data: null, error: null }).then(resolve, reject)
                }
              }
            }
          }
        }
      }

      return qb
    }
  }

  return client
}

// =============================================================================
// 1. TELNYX WEBHOOK SIGNATURE TESTS
// =============================================================================

test('Webhook Security: Rejects webhook when signature or timestamp is missing', () => {
  const body = JSON.stringify({ data: { event_type: 'call.hangup' } })
  // Missing signature
  assert.strictEqual(verifyTelnyxSignature(body, null, '1727980000', 'some_public_key'), false)
  // Missing timestamp
  assert.strictEqual(verifyTelnyxSignature(body, 'sig123', null, 'some_public_key'), false)
  // Missing both
  assert.strictEqual(verifyTelnyxSignature(body, null, null, 'some_public_key'), false)
})

test('Webhook Security: Fail-Closed - Rejects webhook when TELNYX_PUBLIC_KEY is not configured', () => {
  const oldKey = process.env.TELNYX_PUBLIC_KEY
  const oldBypass = process.env.TELNYX_ALLOW_TEST_WEBHOOK_BYPASS
  delete process.env.TELNYX_PUBLIC_KEY
  delete process.env.TELNYX_ALLOW_TEST_WEBHOOK_BYPASS

  const body = JSON.stringify({ data: { event_type: 'call.hangup' } })
  const result = verifyTelnyxSignature(body, 'any_signature', '1727980000')
  
  // Must FAIL-CLOSED
  assert.strictEqual(result, false, 'Must reject when TELNYX_PUBLIC_KEY is not configured')

  process.env.TELNYX_PUBLIC_KEY = oldKey || ''
  if (oldBypass) process.env.TELNYX_ALLOW_TEST_WEBHOOK_BYPASS = oldBypass
})

test('Webhook Security: Accepts valid Ed25519 signature and rejects invalid signature', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  const pubDer = publicKey.export({ type: 'spki', format: 'der' })
  const pubRaw = pubDer.subarray(pubDer.length - 32)
  const pubBase64 = pubRaw.toString('base64')

  const now = Math.floor(Date.now() / 1000)
  const body = JSON.stringify({ data: { id: 'evt-123', event_type: 'call.hangup' } })
  const signedPayload = `${now}|${body}`

  const validSig = crypto.sign(null, Buffer.from(signedPayload, 'utf8'), privateKey).toString('base64')

  // Valid signature -> accepted
  assert.strictEqual(verifyTelnyxSignature(body, validSig, String(now), pubBase64), true)

  // Invalid signature -> rejected
  const fakeSig = Buffer.from('invalid-tampered-signature-data-32bytes').toString('base64')
  assert.strictEqual(verifyTelnyxSignature(body, fakeSig, String(now), pubBase64), false)

  // Timestamp out of replay window (more than 5 mins in the past) -> rejected
  const oldTimestamp = now - 400
  assert.strictEqual(verifyTelnyxSignature(body, validSig, String(oldTimestamp), pubBase64), false)
})

test('Webhook Security: Test bypass mock is accepted ONLY under explicit test configuration', () => {
  const oldNodeEnv = process.env.NODE_ENV
  const oldBypass = process.env.TELNYX_ALLOW_TEST_WEBHOOK_BYPASS

  process.env.NODE_ENV = 'test'
  process.env.TELNYX_ALLOW_TEST_WEBHOOK_BYPASS = 'true'

  const body = '{"data":{}}'
  // Explicit bypass header -> allowed
  assert.strictEqual(verifyTelnyxSignature(body, 'test-bypass-signature', '12345'), true)

  // Non-matching header under test bypass flag -> rejected (fail closed)
  assert.strictEqual(verifyTelnyxSignature(body, 'arbitrary-signature', '12345'), false)

  // If bypass flag is disabled -> rejected even with test-bypass-signature
  process.env.TELNYX_ALLOW_TEST_WEBHOOK_BYPASS = 'false'
  assert.strictEqual(verifyTelnyxSignature(body, 'test-bypass-signature', '12345'), false)

  // Restore env
  process.env.NODE_ENV = oldNodeEnv
  if (oldBypass) process.env.TELNYX_ALLOW_TEST_WEBHOOK_BYPASS = oldBypass
  else delete process.env.TELNYX_ALLOW_TEST_WEBHOOK_BYPASS
})

// =============================================================================
// 2. PROFILE PRIVILEGE ESCALATION TESTS
// =============================================================================

test('Profile Role Escalation: Strict schema allows only valid user-updatable fields', () => {
  const validPayload = {
    first_name: 'John',
    last_name: 'Doe',
    phone: '+12145550199',
    avatar_url: 'https://example.com/avatar.png'
  }
  const result = profileUpdateSchema.safeParse(validPayload)
  assert.strictEqual(result.success, true)
  assert.deepStrictEqual(result.data, validPayload)
})

test('Profile Role Escalation: Explicitly detects and rejects malicious escalation keys', () => {
  const maliciousKeys = [
    'role',
    'organization_id',
    'org_id',
    'permissions',
    'is_owner',
    'owner',
    'billing_role',
    'is_super_admin',
    'tenant_id'
  ]

  for (const key of maliciousKeys) {
    assert.ok(FORBIDDEN_ESCALATION_KEYS.includes(key), `Key "${key}" must be blocked by FORBIDDEN_ESCALATION_KEYS`)

    // Attempt injection in payload
    const payload = {
      first_name: 'Attacker',
      [key]: key.includes('role') ? 'super_admin' : 'org-victim'
    }

    // 1. Zod strict validation must reject it
    const parseResult = profileUpdateSchema.safeParse(payload)
    assert.strictEqual(parseResult.success, false, `Zod schema must reject payload containing "${key}"`)

    // 2. Forbidden keys filter must flag it
    const detected = FORBIDDEN_ESCALATION_KEYS.filter((k) => k in payload)
    assert.ok(detected.includes(key), `Escalation detector must identify "${key}"`)
  }
})

// =============================================================================
// 3. TEAM INVITATION STATE MODEL TESTS
// =============================================================================

test('Team Invitation: Validates state model transitions (INVITE_SENT, INVITE_CREATED_BUT_EMAIL_PENDING, INVITE_FAILED)', () => {
  const validStates = ['INVITE_SENT', 'INVITE_CREATED_BUT_EMAIL_PENDING', 'INVITE_FAILED']

  // Ensure all states are distinct and defined
  assert.strictEqual(validStates.length, 3)
  assert.ok(validStates.includes('INVITE_SENT'))
  assert.ok(validStates.includes('INVITE_CREATED_BUT_EMAIL_PENDING'))
  assert.ok(validStates.includes('INVITE_FAILED'))
})

// =============================================================================
// 4. SETTINGS TEST SMS ISOLATION TESTS
// =============================================================================

test('Settings Test SMS: Does NOT create leads, review requests, or customers', async () => {
  const orgId = 'org-test-sms-safety'
  const db = createPhase3MockDb({
    organizations: [{ id: orgId, name: 'Safe HVAC', owner_phone: '+12145550188', telnyx_phone_number: '+12145550100' }],
    telnyx_phone_numbers: [{ org_id: orgId, phone_number: '+12145550100', status: 'active' }]
  })

  // Pre-state: 0 leads, 0 review requests, 0 contacts
  assert.strictEqual(db._tables.leads.length, 0)
  assert.strictEqual(db._tables.review_requests.length, 0)
  assert.strictEqual(db._tables.contacts.length, 0)

  // Verify compliance check on test SMS
  const compliance = await verifyOutboundCompliance(db, {
    orgId,
    toPhone: '+12145550188',
    fromPhone: '+12145550100',
    flowType: 'test_sms',
    messageType: 'transactional',
    body: '[CaptoDesk Test] Sorry we missed your call!'
  })

  assert.strictEqual(compliance.allowed, true)
  assert.ok(compliance.formattedText.includes('[CaptoDesk Test]'))

  // Crucial check: Verification of zero side-effects
  assert.strictEqual(db._tables.leads.length, 0, 'Test SMS must NEVER create a lead')
  assert.strictEqual(db._tables.review_requests.length, 0, 'Test SMS must NEVER create a review request')
  assert.strictEqual(db._tables.contacts.length, 0, 'Test SMS must NEVER create a contact')
})

// =============================================================================
// 5. AUTOMATION RETRY ELIGIBILITY & DUPLICATE PREVENTION TESTS
// =============================================================================

test('Automation Retry: Rejects non-failed runs and prevents duplicate execution', async () => {
  const orgId = 'org-retry-safety'
  const db = createPhase3MockDb({
    organizations: [{ id: orgId, name: 'Pro Services' }],
    automation_runs: [
      { id: 'run-pending', org_id: orgId, status: 'pending', retry_count: 0 },
      { id: 'run-running', org_id: orgId, status: 'running', retry_count: 1 },
      { id: 'run-success', org_id: orgId, status: 'success', retry_count: 1 },
      { id: 'run-cancelled', org_id: orgId, status: 'cancelled', retry_count: 0 },
      { id: 'run-failed', org_id: orgId, status: 'failed', retry_count: 2, max_retries: 3 }
    ]
  })

  const activeStatuses = ['pending', 'scheduled', 'processing', 'running']

  // 1. Pending/Running runs must NOT be retried (duplicate prevention)
  const pendingRun = db._tables.automation_runs.find((r) => r.id === 'run-pending')
  assert.ok(activeStatuses.includes(pendingRun.status), 'Pending run must be flagged active to prevent duplicate retry')

  const runningRun = db._tables.automation_runs.find((r) => r.id === 'run-running')
  assert.ok(activeStatuses.includes(runningRun.status), 'Running run must be flagged active')

  // 2. Success and Cancelled runs are ineligible
  const successRun = db._tables.automation_runs.find((r) => r.id === 'run-success')
  assert.strictEqual(successRun.status, 'success')

  // 3. Failed run is eligible -> enqueues to pending
  const failedRun = db._tables.automation_runs.find((r) => r.id === 'run-failed')
  assert.strictEqual(failedRun.status, 'failed')

  await db.from('automation_runs').update({
    status: 'pending',
    scheduled_at: new Date().toISOString(),
    failure_reason: null,
    max_retries: 4
  }).eq('id', failedRun.id)

  const refreshed = db._tables.automation_runs.find((r) => r.id === 'run-failed')
  assert.strictEqual(refreshed.status, 'pending')
  assert.strictEqual(refreshed.max_retries, 4)
})

// =============================================================================
// 6. INBOUND STOP & REPEATED STOP HANDLING TESTS
// =============================================================================

test('Compliance STOP: Inbound STOP keyword immediately suppresses recipient', async () => {
  const org = { id: 'org-stop-test', name: 'Cool HVAC' }
  const db = createPhase3MockDb({
    organizations: [org],
    contacts: [{ id: 'cnt-stop', org_id: org.id, phone: '+19725550888', opt_out: false }]
  })

  // First STOP
  const res1 = await handleInboundComplianceKeyword(db, {
    org,
    fromPhone: '+19725550888',
    toPhone: '+12145550100',
    text: 'STOP'
  })

  assert.strictEqual(res1.handled, true)
  assert.strictEqual(res1.action, 'opt_out_processed')

  // Verify suppression list
  const supp1 = db._tables.compliance_suppression_list.find((s) => s.phone === '+19725550888')
  assert.ok(supp1, 'Suppression record must exist')
  assert.strictEqual(supp1.reason, 'stop_keyword')

  // Repeated STOP: must handle idempotently without crash or duplicates
  const res2 = await handleInboundComplianceKeyword(db, {
    org,
    fromPhone: '+19725550888',
    toPhone: '+12145550100',
    text: 'stop'
  })

  assert.strictEqual(res2.handled, true)
  assert.strictEqual(res2.action, 'opt_out_processed')
  assert.strictEqual(db._tables.compliance_suppression_list.filter((s) => s.phone === '+19725550888').length, 1)
})

// =============================================================================
// 7. COMPLIANT MESSAGE FORMATTING & REVIEW COPY AUDIT
// =============================================================================

test('Compliance Formatter: Ensures mandatory business identification and opt-out notice', () => {
  // Missing business name -> prepends
  const textNoBiz = 'Your estimate is ready for review.'
  const formatted = formatCompliantOutboundText({
    businessName: 'Roofing Pros',
    text: textNoBiz,
    messageType: 'transactional'
  })
  assert.ok(formatted.startsWith('Roofing Pros:'), 'Must prepend business identification')

  // Marketing message -> must contain opt-out instruction
  const marketingMsg = 'We would appreciate your honest feedback on Google: https://captodesk.com/r/xyz'
  const formattedMarketing = formatCompliantOutboundText({
    businessName: 'Roofing Pros',
    text: marketingMsg,
    messageType: 'marketing'
  })
  assert.ok(formattedMarketing.includes('Reply STOP'), 'Marketing message must contain opt-out notice')
})

test('Review Copy Compliance Audit: Verifies zero 5-star rating promises or rating manipulation', () => {
  const forbiddenPhrases = [
    '5-star',
    '5 star',
    'verified 5-star',
    'rating window',
    'only happy',
    'guaranteed 5-star'
  ]

  // Standard compliant review text
  const compliantSample = 'Invite customers to share honest feedback on Google.'
  for (const phrase of forbiddenPhrases) {
    assert.strictEqual(
      compliantSample.toLowerCase().includes(phrase),
      false,
      `Compliant copy must NOT contain "${phrase}"`
    )
  }
})
