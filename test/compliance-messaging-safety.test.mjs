import test from 'node:test'
import assert from 'node:assert'
import {
  isOptOutKeyword,
  isOptInKeyword,
  isHelpKeyword,
  classifyMessage,
  formatCompliantOutboundText,
  isPhoneSuppressed,
  checkFrequencyCap,
  recordConsent,
  verifyOutboundCompliance,
  handleInboundComplianceKeyword,
  logComplianceAudit
} from '../src/lib/compliance/compliance-engine.ts'
import { processInboundSms } from '../src/lib/services/sms-handler.ts'
import { evaluateSuppression } from '../src/lib/telephony/suppression-rules.ts'
import { checkReviewEligibility, formatCompliantReviewMessage } from '../src/lib/reviews/review-manager.ts'
import { evaluateCustomerReactivation } from '../src/lib/retention/lifecycle-manager.ts'

/**
 * Mock database harness for Compliance & Safety tests
 */
function createMockComplianceDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    contacts: initialState.contacts || [],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers || [],
    compliance_suppression_list: initialState.compliance_suppression_list || [],
    compliance_consent_records: initialState.compliance_consent_records || [],
    compliance_audit_logs: initialState.compliance_audit_logs || [],
    conversations: initialState.conversations || [],
    messages: initialState.messages || [],
    calls: initialState.calls || [],
    review_requests: initialState.review_requests || [],
    automation_runs: initialState.automation_runs || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []

      const queryBuilder = {
        select: (columns, options) => {
          if (options && options.count === 'exact') {
            queryBuilder._countExact = true
          }
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
          return Promise.resolve({
            data: filtered,
            error: null,
            count: queryBuilder._countExact ? filtered.length : undefined
          }).then(resolve, reject)
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
        upsert: (rowOrRows, options = {}) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          if (!tables[tableName]) tables[tableName] = []

          for (const row of rows) {
            // Find existing if match on org_id + phone
            let existingIdx = -1
            if (row.org_id && row.phone) {
              existingIdx = tables[tableName].findIndex(
                r => r.org_id === row.org_id && r.phone === row.phone
              )
            }
            if (existingIdx >= 0) {
              tables[tableName][existingIdx] = {
                ...tables[tableName][existingIdx],
                ...row,
                updated_at: new Date().toISOString()
              }
            } else {
              tables[tableName].push({
                id: row.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                created_at: new Date().toISOString(),
                ...row
              })
            }
          }
          return {
            select: () => ({
              maybeSingle: async () => ({ data: rows[0], error: null }),
              then: (res) => Promise.resolve({ data: rows, error: null }).then(res)
            }),
            then: (res) => Promise.resolve({ data: rows, error: null }).then(res)
          }
        },
        update: (updates) => {
          const updateFilters = [...filters]
          const updateBuilder = {
            eq: (col, val) => {
              updateFilters.push((row) => row[col] === val)
              return updateBuilder
            },
            select: () => ({
              maybeSingle: async () => {
                const tableData = tables[tableName] || []
                let updated = null
                for (let i = 0; i < tableData.length; i++) {
                  if (updateFilters.every((fn) => fn(tableData[i]))) {
                    tableData[i] = { ...tableData[i], ...updates, updated_at: new Date().toISOString() }
                    updated = tableData[i]
                  }
                }
                return { data: updated, error: null }
              },
              single: async () => {
                const tableData = tables[tableName] || []
                let updated = null
                for (let i = 0; i < tableData.length; i++) {
                  if (updateFilters.every((fn) => fn(tableData[i]))) {
                    tableData[i] = { ...tableData[i], ...updates, updated_at: new Date().toISOString() }
                    updated = tableData[i]
                    break
                  }
                }
                return { data: updated, error: null }
              },
              then: (resolve, reject) => {
                const tableData = tables[tableName] || []
                const matched = []
                for (let i = 0; i < tableData.length; i++) {
                  if (updateFilters.every((fn) => fn(tableData[i]))) {
                    tableData[i] = { ...tableData[i], ...updates, updated_at: new Date().toISOString() }
                    matched.push(tableData[i])
                  }
                }
                return Promise.resolve({ data: matched, error: null }).then(resolve, reject)
              }
            }),
            then: (resolve, reject) => {
              const tableData = tables[tableName] || []
              for (let i = 0; i < tableData.length; i++) {
                if (updateFilters.every((fn) => fn(tableData[i]))) {
                  tableData[i] = { ...tableData[i], ...updates, updated_at: new Date().toISOString() }
                }
              }
              return Promise.resolve({ data: null, error: null }).then(resolve, reject)
            }
          }
          return updateBuilder
        },
        delete: () => {
          const deleteFilters = [...filters]
          const deleteBuilder = {
            eq: (col, val) => {
              deleteFilters.push((row) => row[col] === val)
              return deleteBuilder
            },
            then: (resolve, reject) => {
              if (tables[tableName]) {
                tables[tableName] = tables[tableName].filter(
                  (row) => !deleteFilters.every((fn) => fn(row))
                )
              }
              return Promise.resolve({ data: null, error: null }).then(resolve, reject)
            }
          }
          return deleteBuilder
        }
      }

      return queryBuilder
    }
  }

  return client
}

// -----------------------------------------------------------------------------
// TESTS
// -----------------------------------------------------------------------------

test('1. Keyword Recognition: Identifies all standard carrier compliance keywords', () => {
  // Opt-Out keywords
  const stopKeywords = ['STOP', 'stop', '  UNSUBSCRIBE  ', 'cancel', 'End', 'QUIT', 'optout', 'Opt Out']
  for (const kw of stopKeywords) {
    const res = isOptOutKeyword(kw)
    assert.strictEqual(res.isOptOut, true, `Keyword "${kw}" must be recognized as opt-out`)
  }

  // Non-stop words should NOT be recognized as opt-out
  assert.strictEqual(isOptOutKeyword('hello').isOptOut, false)
  assert.strictEqual(isOptOutKeyword('can you come tomorrow').isOptOut, false)

  // Opt-In keywords
  const startKeywords = ['START', 'unstop', 'yes', '  START  ']
  for (const kw of startKeywords) {
    const res = isOptInKeyword(kw)
    assert.strictEqual(res.isOptIn, true, `Keyword "${kw}" must be recognized as opt-in`)
  }

  // Help keywords
  assert.strictEqual(isHelpKeyword('HELP'), true)
  assert.strictEqual(isHelpKeyword('info'), true)
  assert.strictEqual(isHelpKeyword('thanks'), false)
})

test('2. Inbound STOP: Upserts suppression list, updates contact, and logs audit', async () => {
  const orgId = 'org-plumbing-compliance'
  const callerPhone = '+15552345678'
  const twilioNumber = '+15559876543'

  const db = createMockComplianceDb({
    organizations: [
      { id: orgId, name: 'Precision Plumbing', telnyx_phone_number: twilioNumber }
    ],
    telnyx_phone_numbers: [
      { phone_number: twilioNumber, org_id: orgId, status: 'active' }
    ],
    contacts: [
      { id: 'contact-1', org_id: orgId, phone: callerPhone, opt_out: false, marketing_opt_in: true }
    ]
  })

  const result = await processInboundSms(db, {
    fromPhone: callerPhone,
    toPhone: twilioNumber,
    text: 'STOP'
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.action, 'opt_out_processed')

  // Verify suppression list entry
  const suppressionRow = db._tables.compliance_suppression_list.find(
    r => r.org_id === orgId && r.phone === callerPhone
  )
  assert.ok(suppressionRow, 'Suppression record must exist')
  assert.strictEqual(suppressionRow.reason, 'stop_keyword')

  // Verify contact was updated
  const contact = db._tables.contacts.find(c => c.id === 'contact-1')
  assert.strictEqual(contact.opt_out, true)
  assert.strictEqual(contact.marketing_opt_in, false)

  // Verify audit log
  const auditRow = db._tables.compliance_audit_logs.find(
    a => a.org_id === orgId && a.phone === callerPhone && a.action === 'opt_out'
  )
  assert.ok(auditRow, 'Compliance audit log must be recorded')
})

test('3. Inbound START/UNSTOP: Deletes from suppression list, updates contact opt_in, records consent', async () => {
  const orgId = 'org-electric-compliance'
  const callerPhone = '+15553334444'
  const orgNumber = '+15551112222'

  const db = createMockComplianceDb({
    organizations: [
      { id: orgId, name: 'Apex Electric', telnyx_phone_number: orgNumber }
    ],
    telnyx_phone_numbers: [
      { phone_number: orgNumber, org_id: orgId, status: 'active' }
    ],
    contacts: [
      { id: 'contact-2', org_id: orgId, phone: callerPhone, opt_out: true, marketing_opt_in: false }
    ],
    compliance_suppression_list: [
      { id: 'supp-1', org_id: orgId, phone: callerPhone, reason: 'stop_keyword' }
    ]
  })

  const result = await processInboundSms(db, {
    fromPhone: callerPhone,
    toPhone: orgNumber,
    text: 'UNSTOP'
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.action, 'opt_in_processed')

  // Verify removed from suppression list
  const suppRow = db._tables.compliance_suppression_list.find(
    r => r.org_id === orgId && r.phone === callerPhone
  )
  assert.strictEqual(suppRow, undefined, 'Must be removed from suppression list')

  // Verify contact updated
  const contact = db._tables.contacts.find(c => c.id === 'contact-2')
  assert.strictEqual(contact.opt_out, false)
  assert.strictEqual(contact.transactional_opt_in, true)

  // Verify consent record
  const consentRow = db._tables.compliance_consent_records.find(
    cr => cr.org_id === orgId && cr.phone === callerPhone
  )
  assert.ok(consentRow, 'Consent record must be created')
  assert.strictEqual(consentRow.status, 'granted')
})

test('4. Inbound HELP: Sends compliant business support info without modifying opt status', async () => {
  const orgId = 'org-hvac-help'
  const callerPhone = '+15554443333'
  const orgNumber = '+15558887777'

  const db = createMockComplianceDb({
    organizations: [
      { id: orgId, name: 'CoolAir HVAC', telnyx_phone_number: orgNumber }
    ],
    telnyx_phone_numbers: [
      { phone_number: orgNumber, org_id: orgId, status: 'active' }
    ],
    contacts: [
      { id: 'contact-3', org_id: orgId, phone: callerPhone, opt_out: false }
    ]
  })

  const result = await processInboundSms(db, {
    fromPhone: callerPhone,
    toPhone: orgNumber,
    text: 'HELP'
  })

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.action, 'help_processed')

  // Verify contact opt_out remains false
  const contact = db._tables.contacts.find(c => c.id === 'contact-3')
  assert.strictEqual(contact.opt_out, false)

  // Verify audit log
  const auditRow = db._tables.compliance_audit_logs.find(
    a => a.org_id === orgId && a.action === 'help_requested'
  )
  assert.ok(auditRow, 'Help request audit log must be recorded')
})

test('5. Outbound Pre-Flight: Instantly blocks suppressed numbers across all pipelines', async () => {
  const orgId = 'org-suppress-check'
  const suppressedPhone = '+15559990000'

  const db = createMockComplianceDb({
    organizations: [{ id: orgId, name: 'Safety First' }],
    compliance_suppression_list: [
      { id: 'supp-1', org_id: orgId, phone: suppressedPhone, reason: 'carrier_complaint' }
    ]
  })

  const check = await verifyOutboundCompliance(db, {
    orgId,
    toPhone: suppressedPhone,
    body: 'Your service appointment is tomorrow at 10 AM',
    messageType: 'transactional'
  })

  assert.strictEqual(check.allowed, false)
  assert.strictEqual(check.suppressionReason, 'suppression_list_active')

  // Verify suppression check in Review Manager
  const reviewEligibility = await checkReviewEligibility(db, {
    orgId,
    contactId: 'any-id'
  })
  assert.strictEqual(reviewEligibility.eligible, false)
})

test('6. Message Classification: Distinguishes transactional from marketing flows', () => {
  // Transactional
  assert.strictEqual(classifyMessage('missed_call_recovery'), 'transactional')
  assert.strictEqual(classifyMessage('booking_confirmation'), 'transactional')
  assert.strictEqual(classifyMessage('booking_reminder'), 'transactional')
  assert.strictEqual(classifyMessage('quote_sent'), 'transactional')
  assert.strictEqual(classifyMessage('invoice_sent'), 'transactional')

  // Marketing
  assert.strictEqual(classifyMessage('quote_follow_up'), 'marketing')
  assert.strictEqual(classifyMessage('review_request'), 'marketing')
  assert.strictEqual(classifyMessage('customer_reactivation'), 'marketing')
  assert.strictEqual(classifyMessage('reactivation'), 'marketing')
})

test('7. Business Identification & Opt-Out Language Formatter', () => {
  const bizName = 'Premier Roofing'

  // Transactional: must contain business name
  const text1 = 'Your appointment is booked for 2 PM.'
  const formatted1 = formatCompliantOutboundText({
    businessName: bizName,
    text: text1,
    messageType: 'transactional'
  })
  assert.ok(formatted1.startsWith('Premier Roofing:'))
  assert.ok(!formatted1.includes('Reply STOP to cancel')) // Not required for transactional

  // If business name already included in greeting, don't duplicate
  const text2 = 'Hi this is Premier Roofing following up on your inquiry.'
  const formatted2 = formatCompliantOutboundText({
    businessName: bizName,
    text: text2,
    messageType: 'transactional'
  })
  assert.strictEqual(formatted2, text2)

  // Marketing: MUST contain business name AND Reply STOP
  const text3 = 'We would appreciate your Google review: https://captodesk.com/r/xyz'
  const formatted3 = formatCompliantOutboundText({
    businessName: bizName,
    text: text3,
    messageType: 'marketing'
  })
  assert.ok(formatted3.includes('Premier Roofing'))
  assert.ok(formatted3.includes('Reply STOP to cancel.'))
})

test('8. Frequency Capping: Blocks messages exceeding daily limit', async () => {
  const orgId = 'org-freq-test'
  const recipientPhone = '+15557778888'

  const db = createMockComplianceDb({
    organizations: [{ id: orgId, name: 'Active Contractor', max_daily_sms_per_recipient: 3 }],
    compliance_audit_logs: [
      { id: 'log-1', org_id: orgId, phone: recipientPhone, action: 'message_sent', created_at: new Date().toISOString() },
      { id: 'log-2', org_id: orgId, phone: recipientPhone, action: 'message_sent', created_at: new Date().toISOString() },
      { id: 'log-3', org_id: orgId, phone: recipientPhone, action: 'message_sent', created_at: new Date().toISOString() }
    ]
  })

  // 4th message should be blocked by frequency cap
  const check = await verifyOutboundCompliance(db, {
    orgId,
    toPhone: recipientPhone,
    body: 'Another automated message',
    messageType: 'transactional'
  })

  assert.strictEqual(check.allowed, false)
  assert.strictEqual(check.suppressionReason, 'frequency_cap_exceeded')
})

test('9. Customer Communication Preferences: Blocks when preferred channel is email or marketing consent missing', async () => {
  const orgId = 'org-prefs-test'
  const emailOnlyPhone = '+15554441111'
  const noMarketingPhone = '+15554442222'

  const db = createMockComplianceDb({
    organizations: [{ id: orgId, name: 'Preference Pro' }],
    contacts: [
      { id: 'c-email', org_id: orgId, phone: emailOnlyPhone, preferred_channel: 'email', opt_out: false },
      { id: 'c-nomarketing', org_id: orgId, phone: noMarketingPhone, preferred_channel: 'sms', marketing_opt_in: false, opt_out: false }
    ]
  })

  // Should block SMS if channel preference is email
  const checkEmail = await verifyOutboundCompliance(db, {
    orgId,
    toPhone: emailOnlyPhone,
    contactId: 'c-email',
    body: 'Appointment confirmation',
    messageType: 'transactional'
  })
  assert.strictEqual(checkEmail.allowed, false)
  assert.strictEqual(checkEmail.suppressionReason, 'channel_preference_email')

  // Should block marketing message if marketing_opt_in is false
  const checkMarketing = await verifyOutboundCompliance(db, {
    orgId,
    toPhone: noMarketingPhone,
    contactId: 'c-nomarketing',
    body: 'Reactivation special offer',
    messageType: 'marketing'
  })
  assert.strictEqual(checkMarketing.allowed, false)
  assert.strictEqual(checkMarketing.suppressionReason, 'no_marketing_consent')
})

test('10. Telephony Suppression Rules: evaluateSuppression respects carrier suppression list', async () => {
  const orgId = 'org-voice-test'
  const suppressedCaller = '+15559871111'
  const calledNumber = '+15559872222'

  const db = createMockComplianceDb({
    organizations: [{ id: orgId, name: 'Voice Org', is_missed_call_active: true }],
    compliance_suppression_list: [
      { id: 'supp-v1', org_id: orgId, phone: suppressedCaller, reason: 'stop_keyword' }
    ]
  })

  const result = await evaluateSuppression({
    supabase: db,
    orgId,
    callerNumber: suppressedCaller,
    calledNumber,
    contactOptOut: false,
    durationSeconds: 15,
    isMissedCallActive: true
  })

  assert.strictEqual(result.shouldSend, false)
  assert.strictEqual(result.suppressionReason, 'suppressed_opt_out')
})
