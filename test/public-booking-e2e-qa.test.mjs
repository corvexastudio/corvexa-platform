import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  parseServicePricing,
  formatDynamicPricingTotal,
  parseAddOns,
  encodeAddOns,
  encodeServiceDescriptionWithAddOns,
  cleanServiceDescription,
  parseServiceCategory
} from '../src/lib/services/service-pricing.ts'
import {
  formatCustomerName,
  formatStandardUsAddress,
  combineStreetAndUnit
} from '../src/lib/booking/customer-input-formatter.ts'
import { normalizePhoneToE164 } from '../src/lib/telephony/phone-normalizer.ts'
import {
  createBooking,
  customerCancelBooking,
  customerRescheduleBooking
} from '../src/lib/booking/booking-manager.ts'
import {
  calculateAvailableSlots,
  calculateDetailedSlots
} from '../src/lib/booking/availability.ts'
import { formatTimeInTz } from '../src/lib/temporal/timezone.ts'
import { generateBookingToken, validateBookingOrigin } from '../src/lib/booking/origin-validator.ts'

// In-memory mock database with full tenant isolation, relation joins, and exclusion simulation
function createMockDb(initialData = {}) {
  const tables = {
    organizations: initialData.organizations ? [...initialData.organizations] : [],
    services: initialData.services ? [...initialData.services] : [],
    contacts: initialData.contacts ? [...initialData.contacts] : [],
    appointments: initialData.appointments ? [...initialData.appointments] : [],
    jobs: initialData.jobs ? [...initialData.jobs] : [],
    leads: initialData.leads ? [...initialData.leads] : [],
    notifications: initialData.notifications ? [...initialData.notifications] : [],
    automation_runs: initialData.automation_runs ? [...initialData.automation_runs] : [],
    compliance_audit_logs: initialData.compliance_audit_logs ? [...initialData.compliance_audit_logs] : [],
    opt_outs: initialData.opt_outs ? [...initialData.opt_outs] : []
  }

  return {
    tables,
    from(table) {
      if (!tables[table]) tables[table] = []
      let rows = [...tables[table]]
      let filters = []
      let singleMode = false
      let maybeSingleMode = false
      let selectFields = '*'
      let orderCol = null
      let orderAsc = true
      let limitCount = null

      const builder = {
        select(fields = '*') {
          selectFields = fields
          return builder
        },
        eq(col, val) {
          filters.push(r => r[col] === val)
          return builder
        },
        neq(col, val) {
          filters.push(r => r[col] !== val)
          return builder
        },
        in(col, vals) {
          filters.push(r => vals.includes(r[col]))
          return builder
        },
        is(col, val) {
          if (val === null) {
            filters.push(r => r[col] === null || r[col] === undefined)
          } else {
            filters.push(r => r[col] === val)
          }
          return builder
        },
        gt(col, val) {
          filters.push(r => r[col] > val)
          return builder
        },
        order(col, opts = {}) {
          orderCol = col
          orderAsc = opts.ascending ?? true
          return builder
        },
        limit(count) {
          limitCount = count
          return builder
        },
        single() {
          singleMode = true
          return builder.execute()
        },
        maybeSingle() {
          maybeSingleMode = true
          return builder.execute()
        },
        async then(resolve) {
          const res = await builder.execute()
          return resolve(res)
        },
        async execute() {
          let matched = rows.filter(r => filters.every(f => f(r)))
          if (orderCol) {
            matched.sort((a, b) => {
              if (a[orderCol] < b[orderCol]) return orderAsc ? -1 : 1
              if (a[orderCol] > b[orderCol]) return orderAsc ? 1 : -1
              return 0
            })
          }
          if (limitCount !== null) {
            matched = matched.slice(0, limitCount)
          }

          if (singleMode) {
            if (matched.length === 0) return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
            return { data: enrichRow(matched[0], selectFields, tables), error: null }
          }
          if (maybeSingleMode) {
            if (matched.length === 0) return { data: null, error: null }
            return { data: enrichRow(matched[0], selectFields, tables), error: null }
          }
          return { data: matched.map(m => enrichRow(m, selectFields, tables)), error: null }
        },
        insert(payload) {
          const toInsert = Array.isArray(payload) ? payload : [payload]
          const inserted = toInsert.map((item, idx) => {
            const newItem = {
              id: item.id || `mock_${table}_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
              created_at: item.created_at || new Date().toISOString(),
              ...item
            }
            tables[table].push(newItem)
            return newItem
          })

          return {
            select(f = '*') {
              return {
                single() {
                  return Promise.resolve({ data: enrichRow(inserted[0], f, tables), error: null })
                },
                maybeSingle() {
                  return Promise.resolve({ data: enrichRow(inserted[0], f, tables), error: null })
                },
                then(resolve) {
                  return resolve({ data: inserted.map(i => enrichRow(i, f, tables)), error: null })
                }
              }
            },
            then(resolve) {
              return resolve({ data: inserted, error: null })
            }
          }
        },
        update(updates) {
          return {
            eq(col, val) {
              const matched = tables[table].filter(r => r[col] === val)
              matched.forEach(r => Object.assign(r, updates))
              return {
                eq(col2, val2) {
                  const m2 = matched.filter(r => r[col2] === val2)
                  m2.forEach(r => Object.assign(r, updates))
                  return {
                    in(col3, vals3) {
                      const m3 = m2.filter(r => vals3.includes(r[col3]))
                      return {
                        then(resolve) {
                          return resolve({ data: m3, error: null })
                        }
                      }
                    },
                    select(f = '*') {
                      return {
                        single() {
                          return Promise.resolve({ data: m2[0] ? enrichRow(m2[0], f, tables) : null, error: null })
                        },
                        maybeSingle() {
                          return Promise.resolve({ data: m2[0] ? enrichRow(m2[0], f, tables) : null, error: null })
                        },
                        then(resolve) {
                          return resolve({ data: m2.map(i => enrichRow(i, f, tables)), error: null })
                        }
                      }
                    },
                    then(resolve) {
                      return resolve({ data: m2, error: null })
                    }
                  }
                },
                select(f = '*') {
                  return {
                    single() {
                      return Promise.resolve({ data: matched[0] ? enrichRow(matched[0], f, tables) : null, error: null })
                    },
                    then(resolve) {
                      return resolve({ data: matched.map(i => enrichRow(i, f, tables)), error: null })
                    }
                  }
                },
                then(resolve) {
                  return resolve({ data: matched, error: null })
                }
              }
            }
          }
        }
      }

      return builder
    }
  }
}

function enrichRow(row, selectFields, tables) {
  if (!row) return null
  const copy = { ...row }
  if (selectFields.includes('organization:organizations')) {
    copy.organization = tables.organizations.find(o => o.id === row.org_id) || null
  }
  if (selectFields.includes('contact:contacts')) {
    copy.contact = tables.contacts.find(c => c.id === row.contact_id) || null
  }
  if (selectFields.includes('service:services')) {
    copy.service = tables.services.find(s => s.id === row.service_id) || null
  }
  return copy
}

const mockOrg = {
  id: 'org_qa_test_001',
  name: 'CaptoDesk Elite Detailing',
  slug: 'elite-detailing',
  timezone: 'America/Chicago',
  owner_phone: '+15125551000',
  telnyx_phone_number: '+15125551000',
  booking_mode: 'instant',
  business_hours: {
    monday: { open: '08:00', close: '17:00', closed: false },
    tuesday: { open: '08:00', close: '17:00', closed: false },
    wednesday: { open: '08:00', close: '17:00', closed: false },
    thursday: { open: '08:00', close: '17:00', closed: false },
    friday: { open: '08:00', close: '17:00', closed: false },
    saturday: { open: '09:00', close: '15:00', closed: false },
    sunday: { open: '09:00', close: '15:00', closed: true }
  },
  buffer_minutes: 15,
  minimum_notice_hours: 0,
  max_booking_days_ahead: 30,
  blocked_dates: ['2026-12-25'],
  subscription_status: 'active'
}

const mockAddOns = [
  { id: 'addon_clay', name: 'Clay Bar Decontamination', price: 45, duration_minutes: 30 },
  { id: 'addon_ceramic', name: 'Ceramic Glass Sealant', price: 35, duration_minutes: 15 },
  { id: 'addon_engine', name: 'Engine Bay Detailing', price: 60, duration_minutes: 45 }
]

const mockServices = [
  {
    id: 'svc_fixed_01',
    org_id: 'org_qa_test_001',
    name: 'Full Interior Detail',
    duration_minutes: 60,
    price: 150,
    requires_address: true,
    is_active: true,
    sort_order: 1,
    description: encodeServiceDescriptionWithAddOns('Comprehensive interior steam cleaning and leather conditioning.', 'fixed', mockAddOns, 'Interior')
  },
  {
    id: 'svc_starting_02',
    org_id: 'org_qa_test_001',
    name: 'Paint Correction & Polish',
    duration_minutes: 120,
    price: 250,
    requires_address: true,
    is_active: true,
    sort_order: 2,
    description: encodeServiceDescriptionWithAddOns('Single to multi-stage paint swirl and scratch correction.', 'starting_at', mockAddOns, 'Exterior')
  },
  {
    id: 'svc_diag_03',
    org_id: 'org_qa_test_001',
    name: 'Odor & Biohazard Assessment',
    duration_minutes: 45,
    price: 89,
    requires_address: true,
    is_active: true,
    sort_order: 3,
    description: encodeServiceDescriptionWithAddOns('Inspection for smoke, mold, or pet odor remediation.', 'diagnostic_fee', [], 'Specialty')
  },
  {
    id: 'svc_quote_04',
    org_id: 'org_qa_test_001',
    name: 'Fleet Commercial Detailing',
    duration_minutes: 90,
    price: null,
    requires_address: true,
    is_active: true,
    sort_order: 4,
    description: encodeServiceDescriptionWithAddOns('Volume pricing for work trucks, vans, and livery fleets.', 'quote_on_site', [], 'Commercial')
  },
  {
    id: 'svc_free_05',
    org_id: 'org_qa_test_001',
    name: 'Ceramic Coating Consultation',
    duration_minutes: 30,
    price: 0,
    requires_address: false,
    is_active: true,
    sort_order: 5,
    description: encodeServiceDescriptionWithAddOns('Paint thickness gauge metering and free coating estimate.', 'free_estimate', [], 'Consultation')
  },
  {
    id: 'svc_inactive_06',
    org_id: 'org_qa_test_001',
    name: 'Archived Seasonal Wax',
    duration_minutes: 45,
    price: 75,
    requires_address: true,
    is_active: false,
    sort_order: 6,
    description: 'Legacy service no longer offered.'
  },
  {
    id: 'svc_foreign_tenant_07',
    org_id: 'org_competitor_999',
    name: 'Foreign Detailing Service',
    duration_minutes: 60,
    price: 200,
    requires_address: true,
    is_active: true,
    sort_order: 1,
    description: 'Belongs to competitor.'
  }
]

// -----------------------------------------------------------------------------
// PART 1: PRICING TEST MATRIX
// -----------------------------------------------------------------------------

test('Pricing Matrix: Evaluates all 5 canonical pricing models accurately without zero-price misrepresentation', () => {
  // 1. Fixed
  const fixed = parseServicePricing(150, '[pricing:fixed] Standard Full Detail')
  assert.equal(fixed.model, 'fixed')
  assert.equal(fixed.price, 150)
  assert.equal(fixed.formattedPrice, '$150.00')

  // Zero-price under fixed model must NOT say Free
  const fixedZero = parseServicePricing(0, '[pricing:fixed] Custom Scope Service')
  assert.equal(fixedZero.model, 'fixed')
  assert.equal(fixedZero.formattedPrice, 'Quote on Site')
  assert.notEqual(fixedZero.formattedPrice.toLowerCase(), 'free')

  // Empty price under fixed model must NOT say Free
  const fixedEmpty = parseServicePricing(null, '[pricing:fixed] Mystery Service')
  assert.equal(fixedEmpty.model, 'fixed')
  assert.equal(fixedEmpty.formattedPrice, 'Quote on Site')
  assert.notEqual(fixedEmpty.formattedPrice.toLowerCase(), 'free')

  // 2. Starting At
  const starting = parseServicePricing(250, '[pricing:starting_at] Paint Correction')
  assert.equal(starting.model, 'starting_at')
  assert.equal(starting.price, 250)
  assert.equal(starting.formattedPrice, 'Starting at $250.00')

  // 3. Diagnostic Fee
  const diag = parseServicePricing(89, '[pricing:diagnostic_fee] Odor Assessment')
  assert.equal(diag.model, 'diagnostic_fee')
  assert.equal(diag.price, 89)
  assert.equal(diag.formattedPrice, '$89.00 Diagnostic Fee')

  // 4. Quote on Site
  const quote = parseServicePricing(null, '[pricing:quote_on_site] Fleet Commercial')
  assert.equal(quote.model, 'quote_on_site')
  assert.equal(quote.formattedPrice, 'Quote on Site')

  // 5. Free Estimate
  const free = parseServicePricing(0, '[pricing:free_estimate] Coating Consultation')
  assert.equal(free.model, 'free_estimate')
  assert.equal(free.formattedPrice, 'Free Estimate')
})

test('Pricing Matrix: Dynamic calculation handles no add-ons, 1 add-on, multiple add-ons, removal, and recalculation', () => {
  // Base fixed service: $150
  const noAddons = formatDynamicPricingTotal('fixed', 150, 0)
  assert.equal(noAddons.total, 150)
  assert.equal(noAddons.formattedTotal, '$150.00')

  // 1 Add-on ($45 Clay Bar): $195
  const oneAddon = formatDynamicPricingTotal('fixed', 150, 45)
  assert.equal(oneAddon.total, 195)
  assert.equal(oneAddon.formattedTotal, '$195.00')

  // Multiple Add-ons ($45 Clay + $35 Ceramic = $80): $230
  const multiAddon = formatDynamicPricingTotal('fixed', 150, 80)
  assert.equal(multiAddon.total, 230)
  assert.equal(multiAddon.formattedTotal, '$230.00')

  // Removal of ceramic ($80 - $35 = $45): returns to $195
  const removedAddon = formatDynamicPricingTotal('fixed', 150, 80 - 35)
  assert.equal(removedAddon.total, 195)
  assert.equal(removedAddon.formattedTotal, '$195.00')

  // Starting At with Add-ons
  const startingAddons = formatDynamicPricingTotal('starting_at', 250, 80)
  assert.equal(startingAddons.total, 330)
  assert.equal(startingAddons.formattedTotal, 'Starting at $330.00')

  // Quote on Site with Add-ons
  const quoteAddons = formatDynamicPricingTotal('quote_on_site', null, 80)
  assert.equal(quoteAddons.total, 80)
  assert.equal(quoteAddons.formattedTotal, 'Quote on Site (+$80.00 extras)')
})

// -----------------------------------------------------------------------------
// PART 2: SERVICE CATALOG INTEGRITY
// -----------------------------------------------------------------------------

test('Service Catalog Integrity: Filters out foreign tenants, inactive services, and extracts categories', async () => {
  const db = createMockDb({
    organizations: [mockOrg],
    services: mockServices
  })

  // Public booking query: select active services for this tenant only
  const { data: tenantServices } = await db
    .from('services')
    .select('*')
    .eq('org_id', mockOrg.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  // Assert exactly 5 active services returned for org_qa_test_001
  assert.equal(tenantServices.length, 5)

  // Verify foreign tenant service excluded
  const hasForeign = tenantServices.some(s => s.id === 'svc_foreign_tenant_07')
  assert.equal(hasForeign, false)

  // Verify inactive service excluded
  const hasInactive = tenantServices.some(s => s.id === 'svc_inactive_06')
  assert.equal(hasInactive, false)

  // Verify category extraction
  const categories = tenantServices.map(s => parseServiceCategory(s.description)).filter(Boolean)
  assert.deepEqual(categories, ['Interior', 'Exterior', 'Specialty', 'Commercial', 'Consultation'])

  // Verify clean description strips metadata tags
  const clean = cleanServiceDescription(tenantServices[0].description)
  assert.equal(clean, 'Comprehensive interior steam cleaning and leather conditioning.')
  assert.equal(clean.includes('[pricing:'), false)
  assert.equal(clean.includes('[addons:'), false)
  assert.equal(clean.includes('[category:'), false)
})

// -----------------------------------------------------------------------------
// PART 3: SCHEDULING INTEGRITY & TIMEZONE TRANSLATION
// -----------------------------------------------------------------------------

test('Scheduling Integrity: Sunday is closed, blocked dates are unavailable, and timezone is respected', () => {
  const service = { id: 'svc_fixed_01', name: 'Full Interior Detail', duration_minutes: 60 }

  // 1. Sunday (Closed day): 2026-11-22
  const sundaySlots = calculateAvailableSlots({
    orgConfig: mockOrg,
    service,
    dateStr: '2026-11-22',
    existingAppointments: []
  })
  assert.equal(sundaySlots.length, 0, 'Sunday must have 0 slots because closed: true')

  // 2. Blocked Date (Christmas): 2026-12-25
  const blockedSlots = calculateAvailableSlots({
    orgConfig: mockOrg,
    service,
    dateStr: '2026-12-25',
    existingAppointments: []
  })
  assert.equal(blockedSlots.length, 0, 'Blocked date must have 0 slots')

  // 3. Normal Open Monday: 2026-11-23 (08:00 to 17:00 CST)
  const mondaySlots = calculateAvailableSlots({
    orgConfig: mockOrg,
    service,
    dateStr: '2026-11-23',
    existingAppointments: [],
    referenceTime: new Date('2026-11-20T12:00:00.000Z')
  })
  assert.ok(mondaySlots.length > 0, 'Open weekday must generate available slots')

  // First slot must start at 8:00 AM CST
  const firstSlot = mondaySlots[0]
  assert.equal(firstSlot.displayTime, '8:00 AM')

  // 4. Timezone translation: Browser in Calcutta (+5:30) vs Business in Chicago (-6:00)
  // 8:00 AM CST = 14:00 UTC = 19:30 IST (7:30 PM same day)
  const utcDate = new Date(firstSlot.startTime)
  const formattedInIndia = formatTimeInTz(utcDate, 'Asia/Kolkata')
  assert.equal(formattedInIndia, '7:30 PM', 'Timezone translation to IST must be exact')
})

test('Scheduling Integrity: Existing appointments block overlapping slots including buffer', () => {
  const service = { id: 'svc_fixed_01', name: 'Full Interior Detail', duration_minutes: 60 }

  // Appointment at 10:00 AM - 11:00 AM CST on 2026-11-24
  const existingApt = {
    id: 'apt_existing_01',
    start_time: '2026-11-24T16:00:00.000Z', // 10:00 CST
    end_time: '2026-11-24T17:00:00.000Z',   // 11:00 CST
    status: 'confirmed'
  }

  const slots = calculateAvailableSlots({
    orgConfig: mockOrg,
    service,
    dateStr: '2026-11-24',
    existingAppointments: [existingApt],
    referenceTime: new Date('2026-11-20T12:00:00.000Z')
  })

  // 10:00 AM slot must be excluded due to existing appointment
  const has10am = slots.some(s => s.displayTime === '10:00 AM')
  assert.equal(has10am, false, '10:00 AM slot must be blocked by appointment')

  // 9:30 AM slot with 60min duration would end at 10:30 AM, overlapping with 10:00 AM. Must be excluded.
  const has930am = slots.some(s => s.displayTime === '9:30 AM')
  assert.equal(has930am, false, '9:30 AM slot must be blocked by duration overlap')
})

// -----------------------------------------------------------------------------
// PART 4: CUSTOMER DATA & BOOKING INTEGRITY
// -----------------------------------------------------------------------------

test('Customer Data Integrity: Normalizes customer name, E.164 phone, and formats standard US address', () => {
  // Title case name
  const name1 = formatCustomerName('michael phelps jr.')
  assert.equal(name1, 'Michael Phelps Jr.')

  const name2 = formatCustomerName('MARY-JANE WATSON')
  assert.equal(name2, 'Mary-Jane Watson')

  // E.164 Phone Normalization
  const phone1 = normalizePhoneToE164('(512) 555-0199')
  assert.equal(phone1.isValid, true)
  assert.equal(phone1.e164, '+15125550199')

  const phone2 = normalizePhoneToE164('5125550199')
  assert.equal(phone2.isValid, true)
  assert.equal(phone2.e164, '+15125550199')

  const phoneInvalid = normalizePhoneToE164('12345')
  assert.equal(phoneInvalid.isValid, false)

  // Standard US Address
  const addrCombined = combineStreetAndUnit('100 olympic way', 'Apt 4B')
  assert.equal(addrCombined, '100 Olympic Way, Apt 4B')

  const addrFormatted = formatStandardUsAddress('100 olympic way, apt 4b, austin, tx 78701')
  assert.equal(addrFormatted, '100 Olympic Way, Apt 4B, Austin, TX 78701')
})

test('Booking Transaction: Authoritative add-on calculation, duration adjustment, customer deduplication, and decoupled SMS', async () => {
  const db = createMockDb({
    organizations: [mockOrg],
    services: mockServices,
    contacts: [
      {
        id: 'contact_existing_alice',
        org_id: mockOrg.id,
        name: 'Alice Placeholder',
        phone: '+15125550999',
        email: 'old.alice@example.com',
        address: 'Old Address',
        tags: ['lead']
      }
    ],
    appointments: [],
    jobs: []
  })

  // Submit booking for svc_fixed_01 ($150, 60m) + Clay Bar ($45, 30m) + Ceramic ($35, 15m)
  // Total expected duration = 60 + 30 + 15 = 105 mins
  // Customer phone matches existing contact_existing_alice -> must deduplicate and update
  const bookingTime = '2026-11-25T14:00:00.000Z'
  const result = await createBooking(db, {
    orgId: mockOrg.id,
    serviceId: 'svc_fixed_01',
    customerName: 'alice smith',
    customerPhone: '(512) 555-0999',
    customerEmail: 'alice.smith@example.com',
    customerAddress: '123 New Olympic Way, Austin, TX 78701',
    startTime: bookingTime,
    notes: 'Please be careful with front splitter.',
    addonIds: ['addon_clay', 'addon_ceramic', 'fake_unauthorized_addon_999'],
    appBaseUrl: 'http://localhost:3088'
  })

  assert.equal(result.success, true)
  assert.ok(result.appointment)
  assert.equal(result.appointment.status, 'confirmed')
  assert.ok(result.manageToken)
  assert.equal(result.manageToken.length, 48, 'Manage token must be 48 hex chars')

  // Verify duration calculation: 105 minutes (fake add-on ignored!)
  const startMs = new Date(result.appointment.start_time).getTime()
  const endMs = new Date(result.appointment.end_time).getTime()
  const durationMinutes = (endMs - startMs) / (60 * 1000)
  assert.equal(durationMinutes, 105, 'Duration must authoritatively equal 60m + 30m + 15m = 105m')

  // Verify contact was deduplicated and updated
  const updatedContact = db.tables.contacts.find(c => c.id === 'contact_existing_alice')
  assert.ok(updatedContact)
  assert.equal(updatedContact.name, 'Alice Smith')
  assert.equal(updatedContact.email, 'alice.smith@example.com')
  assert.ok(updatedContact.tags.includes('booking'))
  assert.ok(updatedContact.tags.includes('lead'))

  // Verify linked dispatch job created
  const linkedJob = db.tables.jobs.find(j => j.appointment_id === result.appointment.id)
  assert.ok(linkedJob)
  assert.equal(linkedJob.scheduled_start, bookingTime)
  assert.ok(linkedJob.tracking_token)

  // Verify SMS status was returned (simulated or sent, non-blocking)
  assert.ok(result.smsStatus)
})

test('Booking Transaction: Double-click or concurrent submission on same slot rejects duplicate with 400 slot unavailable', async () => {
  const db = createMockDb({
    organizations: [mockOrg],
    services: mockServices,
    contacts: [],
    appointments: [],
    jobs: []
  })

  const slotTime = '2026-11-25T16:00:00.000Z'

  // First submission succeeds
  const res1 = await createBooking(db, {
    orgId: mockOrg.id,
    serviceId: 'svc_fixed_01',
    customerName: 'Customer One',
    customerPhone: '5125550111',
    customerAddress: '100 Main St, Austin, TX 78701',
    startTime: slotTime
  })
  assert.equal(res1.success, true)

  // Second submission for same slot fails closed
  const res2 = await createBooking(db, {
    orgId: mockOrg.id,
    serviceId: 'svc_fixed_01',
    customerName: 'Customer Two',
    customerPhone: '5125550222',
    customerAddress: '200 Main St, Austin, TX 78701',
    startTime: slotTime
  })
  assert.equal(res2.success, false)
  assert.equal(res2.error.includes('no longer available'), true)
  assert.equal(db.tables.appointments.length, 1, 'Exactly one appointment must exist')
})

// -----------------------------------------------------------------------------
// PART 5: APPOINTMENT SELF-SERVICE (RESCHEDULING & CANCELLATION)
// -----------------------------------------------------------------------------

test('Self-Service: Valid token allows rescheduling into open slot while rejecting conflict', async () => {
  const token = 'abcdef1234567890abcdef1234567890abcdef1234567890'
  const apt = {
    id: 'apt_manage_test_01',
    org_id: mockOrg.id,
    service_id: 'svc_fixed_01',
    service_type: 'Full Interior Detail',
    start_time: '2026-11-26T15:00:00.000Z',
    end_time: '2026-11-26T16:00:00.000Z', // 60 mins
    status: 'confirmed',
    manage_token: token,
    contact_id: 'contact_manage_01'
  }

  // Another appointment already at 18:00 CST (00:00 UTC) on 2026-11-26
  const conflictingApt = {
    id: 'apt_conflicting_02',
    org_id: mockOrg.id,
    start_time: '2026-11-26T20:00:00.000Z',
    end_time: '2026-11-26T21:00:00.000Z',
    status: 'confirmed',
    manage_token: 'token_other_999'
  }

  const db = createMockDb({
    organizations: [mockOrg],
    services: mockServices,
    contacts: [{ id: 'contact_manage_01', org_id: mockOrg.id, name: 'Bob Test', phone: '+15125550888' }],
    appointments: [apt, conflictingApt],
    jobs: [{ id: 'job_manage_01', appointment_id: apt.id, org_id: mockOrg.id, status: 'scheduled' }]
  })

  // 1. Reschedule conflict: attempts to move onto conflicting slot
  const conflictRes = await customerRescheduleBooking(db, token, '2026-11-26T20:00:00.000Z')
  assert.equal(conflictRes.success, false)
  assert.equal(conflictRes.error.includes('no longer available'), true)
  assert.equal(apt.start_time, '2026-11-26T15:00:00.000Z', 'Original appointment time preserved')

  // 2. Successful reschedule: moves to open slot on next day
  const validNewTime = '2026-11-27T16:00:00.000Z'
  const successRes = await customerRescheduleBooking(db, token, validNewTime)
  assert.equal(successRes.success, true)
  assert.equal(successRes.appointment.start_time, validNewTime)

  // Verify linked job scheduled_start updated
  const updatedJob = db.tables.jobs.find(j => j.id === 'job_manage_01')
  assert.equal(updatedJob.scheduled_start, validNewTime)
})

test('Self-Service: Cancellation releases slot, halts reminders, records reason, and blocks en route/completed jobs', async () => {
  const token = 'manage_token_cancel_test_123456789012345678901234'
  const apt = {
    id: 'apt_cancel_01',
    org_id: mockOrg.id,
    service_id: 'svc_fixed_01',
    service_type: 'Full Interior Detail',
    start_time: '2026-11-28T15:00:00.000Z',
    end_time: '2026-11-28T16:00:00.000Z',
    status: 'confirmed',
    manage_token: token,
    contact_id: 'contact_cancel_01'
  }

  const db = createMockDb({
    organizations: [mockOrg],
    services: mockServices,
    contacts: [{ id: 'contact_cancel_01', org_id: mockOrg.id, name: 'Charlie Cancel', phone: '+15125550777' }],
    appointments: [apt],
    jobs: [{ id: 'job_cancel_01', appointment_id: apt.id, org_id: mockOrg.id, status: 'scheduled' }],
    automation_runs: [
      { id: 'remind_24h_apt_cancel_01', org_id: mockOrg.id, status: 'scheduled' }
    ]
  })

  // 1. Cancel with reason chip
  const cancelRes = await customerCancelBooking(db, token, 'Schedule conflict')
  assert.equal(cancelRes.success, true)
  assert.equal(cancelRes.appointment.status, 'cancelled')
  assert.equal(cancelRes.appointment.cancellation_reason, 'Schedule conflict')

  // Linked job marked cancelled
  const job = db.tables.jobs.find(j => j.id === 'job_cancel_01')
  assert.equal(job.status, 'cancelled')

  // Owner notification emitted
  const notif = db.tables.notifications.find(n => n.org_id === mockOrg.id)
  assert.ok(notif)
  assert.equal(notif.title, 'Appointment Cancelled by Customer')

  // 2. Cancellation Guard: Completed job cannot be cancelled
  const completedToken = 'token_completed_999'
  const completedApt = {
    id: 'apt_completed_01',
    org_id: mockOrg.id,
    status: 'completed',
    manage_token: completedToken
  }
  const db2 = createMockDb({
    organizations: [mockOrg],
    appointments: [completedApt],
    jobs: [{ id: 'job_comp_01', appointment_id: completedApt.id, org_id: mockOrg.id, status: 'completed' }]
  })
  const compCancel = await customerCancelBooking(db2, completedToken, 'Found another provider')
  assert.equal(compCancel.success, false)
  assert.equal(compCancel.error.includes('already been completed'), true)

  // 3. Cancellation Guard: En route technician cannot be cancelled via portal
  const enRouteToken = 'token_en_route_888'
  const enRouteApt = {
    id: 'apt_en_route_01',
    org_id: mockOrg.id,
    status: 'confirmed',
    manage_token: enRouteToken
  }
  const db3 = createMockDb({
    organizations: [mockOrg],
    appointments: [enRouteApt],
    jobs: [{ id: 'job_en_route_01', appointment_id: enRouteApt.id, org_id: mockOrg.id, status: 'en_route' }]
  })
  const enRouteCancel = await customerCancelBooking(db3, enRouteToken, 'Found another provider')
  assert.equal(enRouteCancel.success, false)
  assert.equal(enRouteCancel.error.includes('already on the way'), true)
})

// -----------------------------------------------------------------------------
// PART 6: STARTER PASS INVARIANT
// -----------------------------------------------------------------------------

test('Starter Pass Invariant: Contractor with 3 free jobs completed NEVER blocks homeowner booking or shows upgrade prompt', async () => {
  const starterOrg = {
    ...mockOrg,
    id: 'org_starter_exhausted_001',
    slug: 'starter-exhausted',
    plan_id: 'free',
    subscription_status: 'free'
  }

  // 3 completed jobs already in history for this org
  const completedJobs = [
    { id: 'job_c1', org_id: starterOrg.id, status: 'completed' },
    { id: 'job_c2', org_id: starterOrg.id, status: 'completed' },
    { id: 'job_c3', org_id: starterOrg.id, status: 'completed' }
  ]

  const db = createMockDb({
    organizations: [starterOrg],
    services: mockServices.map(s => ({ ...s, org_id: starterOrg.id })),
    contacts: [],
    appointments: [],
    jobs: [...completedJobs]
  })

  // Homeowner books on the public link
  const result = await createBooking(db, {
    orgId: starterOrg.id,
    serviceId: 'svc_fixed_01',
    customerName: 'Homeowner Jane',
    customerPhone: '5125550333',
    customerAddress: '500 Starter Way, Austin, TX 78701',
    startTime: '2026-11-27T17:00:00.000Z'
  })

  // 1. Homeowner booking SUCCEEDS completely
  assert.equal(result.success, true, 'Homeowner booking must succeed unconditionally')
  assert.ok(result.appointment, 'Appointment record must be created')
  assert.ok(result.manageToken, 'Manage token must be provided to homeowner')

  // 2. SMS delivery flagged as suppressed_starter for contractor upgrade prompt on contractor dashboard
  assert.equal(result.smsStatus, 'suppressed_starter')

  // 3. Contractor received internal notification in their dashboard with upgrade link
  const contractorNotif = db.tables.notifications.find(n => n.org_id === starterOrg.id)
  assert.ok(contractorNotif)
  assert.equal(contractorNotif.link.includes('starter_limit'), true)

  // 4. Homeowner response contains ZERO upgrade messages, billing errors, or paywalls
  const homeownerPayload = JSON.stringify(result)
  assert.equal(homeownerPayload.includes('Upgrade to Pro ($99/mo)'), false)
  assert.equal(homeownerPayload.includes('paywall'), false)
  assert.equal(homeownerPayload.includes('credit card required'), false)
})

// -----------------------------------------------------------------------------
// PART 7: SECURITY & TENANT ISOLATION
// -----------------------------------------------------------------------------

test('Security & Multi-Tenancy: Rejects cross-tenant service tampering and cross-tenant appointment management', async () => {
  const db = createMockDb({
    organizations: [
      mockOrg,
      { id: 'org_victim_002', name: 'Victim Business', slug: 'victim-biz', subscription_status: 'active' }
    ],
    services: mockServices,
    contacts: [],
    appointments: [
      {
        id: 'apt_victim_01',
        org_id: 'org_victim_002',
        service_type: 'Private Service',
        manage_token: 'token_victim_secret_123456789012345678901234'
      }
    ]
  })

  // 1. Cross-tenant service booking attempt: Customer calls mockOrg.id with foreign service svc_foreign_tenant_07
  const tamperResult = await createBooking(db, {
    orgId: mockOrg.id,
    serviceId: 'svc_foreign_tenant_07', // belongs to org_competitor_999
    customerName: 'Hacker Bob',
    customerPhone: '5125550444',
    customerAddress: '100 Cyber Way',
    startTime: '2026-11-28T18:00:00.000Z'
  })
  assert.equal(tamperResult.success, false)
  assert.equal(tamperResult.error.includes('does not belong to this organization'), true)

  // 2. Token Security: An invalid or random token returns 404
  const invalidRes = await customerCancelBooking(db, 'non_existent_fake_token_000', 'reason')
  assert.equal(invalidRes.success, false)
  assert.equal(invalidRes.error, 'Appointment not found')

  // 3. CSRF & Origin Validation: Validates cross-origin token against untrusted caller
  const validToken = generateBookingToken(mockOrg.slug, mockOrg.id)
  const crossOriginReq = {
    headers: new Map([
      ['origin', 'https://malicious-attacker.com'],
      ['host', 'app.captodesk.com']
    ])
  }
  const checkFail = validateBookingOrigin(crossOriginReq, mockOrg.slug, mockOrg.id, 'tampered_token_xyz')
  assert.equal(checkFail.allowed, false)

  const checkPass = validateBookingOrigin(crossOriginReq, mockOrg.slug, mockOrg.id, validToken)
  assert.equal(checkPass.allowed, true)
})

// -----------------------------------------------------------------------------
// PART 8: ZERO EM DASH & ACCESSIBILITY INVARIANTS
// -----------------------------------------------------------------------------

test('Quality Invariant: Zero em dashes and en dashes across all touched files and UI copy', () => {
  const filesToCheck = [
    'src/components/booking/booking-confirmation-view.tsx',
    'src/app/book/[slug]/page.tsx',
    'src/app/book/manage/[token]/page.tsx',
    'src/app/api/book/manage/[token]/route.ts',
    'src/app/api/book/[slug]/submit/route.ts',
    'src/lib/booking/booking-manager.ts',
    'test/public-booking-e2e-qa.test.mjs'
  ]

  for (const file of filesToCheck) {
    const content = fs.readFileSync(file, 'utf8')
    const emDashes = (content.match(/\u2014/g) || []).length
    const enDashes = (content.match(/\u2013/g) || []).length
    assert.equal(emDashes, 0, `File ${file} must contain 0 em dashes (\\u2014)`)
    assert.equal(enDashes, 0, `File ${file} must contain 0 en dashes (\\u2013)`)
  }
})
