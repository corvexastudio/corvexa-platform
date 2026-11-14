import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatCustomerName,
  formatAsYouTypeUsPhone,
  formatStandardUsAddress,
  getEmailDomainSuggestions
} from '../src/lib/booking/customer-input-formatter.ts'

test('formatCustomerName formats lowercase, uppercase, and special names into Title Case', () => {
  assert.equal(formatCustomerName('john smith'), 'John Smith')
  assert.equal(formatCustomerName('JOHN SMITH'), 'John Smith')
  assert.equal(formatCustomerName('karl marx'), 'Karl Marx')
  assert.equal(formatCustomerName('mary jane watson'), 'Mary Jane Watson')
  assert.equal(formatCustomerName("brian o'connor"), "Brian O'Connor")
  assert.equal(formatCustomerName('ronald mcdonald'), 'Ronald McDonald')
  assert.equal(formatCustomerName('anna-marie smith-jones'), 'Anna-Marie Smith-Jones')
  assert.equal(formatCustomerName('   dr. john   h. watson  '), 'Dr. John H. Watson')
  assert.equal(formatCustomerName(''), '')
})

test('formatAsYouTypeUsPhone handles incremental typing, pasting, and backspacing cleanly', () => {
  // Incremental typing
  assert.equal(formatAsYouTypeUsPhone('4'), '(4')
  assert.equal(formatAsYouTypeUsPhone('45'), '(45')
  assert.equal(formatAsYouTypeUsPhone('456'), '(456')
  assert.equal(formatAsYouTypeUsPhone('4566'), '(456) 6')
  assert.equal(formatAsYouTypeUsPhone('45667'), '(456) 67')
  assert.equal(formatAsYouTypeUsPhone('456678'), '(456) 678')
  assert.equal(formatAsYouTypeUsPhone('4566780'), '(456) 678-0')
  assert.equal(formatAsYouTypeUsPhone('4566780987'), '(456) 678-0987')

  // Pasting raw numbers
  assert.equal(formatAsYouTypeUsPhone('(456)6780987'), '(456) 678-0987')
  assert.equal(formatAsYouTypeUsPhone('+14566780987'), '(456) 678-0987')
  assert.equal(formatAsYouTypeUsPhone('456.678.0987'), '(456) 678-0987')

  // Foreign international preservation
  assert.equal(formatAsYouTypeUsPhone('+447911123456'), '+447911123456')
})

test('formatStandardUsAddress standardizes street casing and state codes while preserving details', () => {
  assert.equal(
    formatStandardUsAddress('68 noth street, austin, tx'),
    '68 Noth Street, Austin, TX'
  )
  assert.equal(
    formatStandardUsAddress('123 n main st apt 4b, austin, tx 78701'),
    '123 N Main St Apt 4B, Austin, TX 78701'
  )
  assert.equal(
    formatStandardUsAddress('456 elm ave, suite 100, miami, fl'),
    '456 Elm Ave, Suite 100, Miami, FL'
  )
  assert.equal(
    formatStandardUsAddress('789 sunset blvd, unit 12, los angeles, ca 90210'),
    '789 Sunset Blvd, Unit 12, Los Angeles, CA 90210'
  )
})

test('getEmailDomainSuggestions provides popular domains after typing @ and filters accurately', () => {
  // Before @
  assert.deepEqual(getEmailDomainSuggestions('john'), [])

  // Just typed @
  const allSuggestions = getEmailDomainSuggestions('john@')
  assert.ok(allSuggestions.includes('gmail.com'))
  assert.ok(allSuggestions.includes('outlook.com'))
  assert.ok(allSuggestions.includes('yahoo.com'))
  assert.ok(allSuggestions.includes('icloud.com'))

  // Typing domain prefix
  assert.deepEqual(getEmailDomainSuggestions('john@g'), ['gmail.com'])
  assert.deepEqual(getEmailDomainSuggestions('john@o'), ['outlook.com'])
  assert.deepEqual(getEmailDomainSuggestions('john@y'), ['yahoo.com'])
  assert.deepEqual(getEmailDomainSuggestions('john@i'), ['icloud.com'])

  // Custom domain (not in popular list)
  assert.deepEqual(getEmailDomainSuggestions('john@mycorp'), [])

  // Already completed domain (has dot)
  assert.deepEqual(getEmailDomainSuggestions('john@gmail.com'), [])
})

test('createBooking integrates customer name formatting, address standardization, and sms opt-in consent', async () => {
  const { createBooking } = await import('../src/lib/booking/booking-manager.ts')

  const insertedRecords = []
  const updatedRecords = []

  const createMockChain = (data) => {
    const builder = {
      eq: () => builder,
      is: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({ data, error: null }),
      single: async () => ({ data, error: null }),
      then: (resolve) => Promise.resolve({ data, error: null }).then(resolve)
    }
    return builder
  }

  const mockSupabase = {
    from(table) {
      return {
        select() {
          if (table === 'organizations') {
            return createMockChain({
              id: 'org-test',
              name: 'Austin Plumbing Pro',
              booking_mode: 'instant',
              timezone: 'America/Chicago',
              business_hours: { monday: { open: '08:00', close: '18:00', closed: false } },
              services: [{ id: 'srv-1', name: 'Leak Repair', duration_minutes: 60, price: 150 }]
            })
          }
          if (table === 'services') {
            return createMockChain({
              id: 'srv-1',
              org_id: 'org-test',
              name: 'Leak Repair',
              duration_minutes: 60,
              price: 150,
              is_active: true
            })
          }
          if (table === 'contacts') {
            return createMockChain(null) // New contact
          }
          if (table === 'appointments') {
            return createMockChain([])
          }
          if (table === 'jobs') {
            return createMockChain([])
          }
          if (table === 'leads') {
            return createMockChain(null)
          }
          return createMockChain([])
        },
        insert(row) {
          insertedRecords.push({ table, row })
          return {
            select() {
              return {
                single: async () => ({ data: { id: `${table}-id-123`, ...row }, error: null }),
                maybeSingle: async () => ({ data: { id: `${table}-id-123`, ...row }, error: null })
              }
            },
            then(resolve) {
              return Promise.resolve({ data: row, error: null }).then(resolve)
            }
          }
        },
        update(row) {
          updatedRecords.push({ table, row })
          return {
            eq: () => ({
              then: (resolve) => Promise.resolve({ data: row, error: null }).then(resolve)
            })
          }
        }
      }
    }
  }

  // 1. Submit with smsConsent = true
  const result1 = await createBooking(mockSupabase, {
    orgId: 'org-test',
    serviceId: 'srv-1',
    customerName: 'karl marx',
    customerPhone: '+18688904567',
    customerEmail: 'karl@example.com',
    customerAddress: '68 noth street, austin, tx',
    startTime: '2026-11-16T14:00:00Z',
    smsConsent: true
  })

  assert.equal(result1.success, true, `Booking 1 failed: ${result1.error}`)

  const contactInsert = insertedRecords.find(r => r.table === 'contacts')
  assert.ok(contactInsert, 'Contact was created')
  assert.equal(contactInsert.row.name, 'Karl Marx', 'Customer name formatted to Title Case')
  assert.equal(contactInsert.row.address, '68 Noth Street, Austin, TX', 'Customer address standardized')

  const consentInsert = insertedRecords.find(r => r.table === 'compliance_consent_records')
  assert.ok(consentInsert, 'Consent record created')
  assert.equal(consentInsert.row.consent_type, 'transactional')
  assert.ok(consentInsert.row.proof_text.includes('SMS opt-in checkbox selected'))

  // 2. Submit with smsConsent = false (customer unchecked box)
  insertedRecords.length = 0
  const result2 = await createBooking(mockSupabase, {
    orgId: 'org-test',
    serviceId: 'srv-1',
    customerName: 'mary jane',
    customerPhone: '+18688904568',
    customerEmail: 'mary@example.com',
    customerAddress: '456 oak ave, dallas, tx',
    startTime: '2026-11-16T16:00:00Z',
    smsConsent: false
  })

  assert.equal(result2.success, true)
  const consentRecord = insertedRecords.find(r => r.table === 'compliance_consent_records')
  assert.equal(consentRecord, undefined, 'Consent record is not created when opted out')
  const auditRecord = insertedRecords.find(r => r.table === 'compliance_audit_logs' && r.row.action === 'opt_out')
  assert.ok(auditRecord, 'Compliance audit logged for customer opt out')
  assert.equal(auditRecord.row.reason, 'customer_sms_opt_out')
})
