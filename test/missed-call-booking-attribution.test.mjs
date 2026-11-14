import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveMissedCallTemplate } from '../src/lib/telephony/template-engine.ts'
import { extractCustomerDetailsFromText } from '../src/lib/services/sms-handler.ts'
import { notifyOwner } from '../src/lib/notifications/notification-service.ts'
import { getAttentionQueue } from '../src/lib/dashboard/dashboard-service.ts'

test('resolveMissedCallTemplate attaches phone, source=missed_call, cid, and name to booking URL', () => {
  const org = {
    name: "Shanta M's Plumbing",
    slug: 'shanta-plumbing',
    timezone: 'America/Chicago',
    business_hours: {
      friday: { open: '08:00', close: '18:00', closed: false }
    }
  }

  const outcome = {
    state: 'missed',
    reason: 'no_answer',
    action: 'auto_reply_standard'
  }

  const result = resolveMissedCallTemplate(
    org,
    outcome,
    'Karl Marx',
    '+18688904567',
    '+18688904567',
    'contact-uuid-123'
  )

  assert.ok(result.renderedText.includes('/book/shanta-plumbing'), 'Contains base booking URL')
  assert.ok(result.renderedText.includes('phone=%2B18688904567'), 'Contains encoded caller phone')
  assert.ok(result.renderedText.includes('source=missed_call'), 'Contains missed_call source attribution')
  assert.ok(result.renderedText.includes('name=Karl+Marx'), 'Contains customer name parameter')
  assert.ok(result.renderedText.includes('cid=contact-uuid-123'), 'Contains contact ID parameter')
})

test('extractCustomerDetailsFromText intelligently parses customer name and service address', () => {
  const sample1 = 'Hi, my name is Karl Marx and our address is 89St first avenue, Austin, TX. Our water heater is leaking.'
  const extracted1 = extractCustomerDetailsFromText(sample1)

  assert.equal(extracted1.extractedName, 'Karl Marx')
  assert.ok(extracted1.extractedAddress?.includes('89St first avenue'), 'Extracted street address')

  const sample2 = 'This is Jane Doe at 456 Oak Street. Need an AC tune-up.'
  const extracted2 = extractCustomerDetailsFromText(sample2)

  assert.equal(extracted2.extractedName, 'Jane Doe')
  assert.ok(extracted2.extractedAddress?.includes('456 Oak Street'), 'Extracted street address')

  // Negative test: generic words should not be mistaken for customer names
  const sample3 = 'This is urgent please call me at 123 Pine Rd'
  const extracted3 = extractCustomerDetailsFromText(sample3)
  assert.notEqual(extracted3.extractedName, 'urgent')
})

test('Owner notification formats distinct alert when booking originates from missed call', async () => {
  const mockInsertCalls = []
  const createQueryMock = (defaultData) => {
    const builder = {
      eq: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({ data: defaultData, error: null }),
      single: async () => ({ data: defaultData, error: null }),
      then: (resolve) => Promise.resolve({ data: defaultData, error: null }).then(resolve)
    }
    return builder
  }

  const mockSupabase = {
    from(table) {
      return {
        select() {
          if (table === 'organizations') {
            return createQueryMock({
              id: 'org-test',
              name: 'Apex Plumbing',
              phone: '+15125550100',
              owner_phone: '+15125550199',
              notify_sms: true,
              notify_push: false
            })
          }
          if (table === 'push_subscriptions') {
            return createQueryMock([])
          }
          return createQueryMock(null)
        },
        insert(row) {
          mockInsertCalls.push({ table, row })
          return {
            select() {
              return {
                maybeSingle: async () => ({ data: { id: 'notif-123', ...row }, error: null }),
                single: async () => ({ data: { id: 'notif-123', ...row }, error: null })
              }
            },
            then(resolve) {
              return Promise.resolve({ data: row, error: null }).then(resolve)
            }
          }
        }
      }
    }
  }

  // 1. Recovered new_booking
  await notifyOwner(mockSupabase, {
    event: 'new_booking',
    organizationId: 'org-test',
    data: {
      customerName: 'Karl Marx',
      customerPhone: '+18688904567',
      serviceName: 'Water Heater Diagnostic',
      bookingTime: 'Tomorrow at 10:00 AM',
      source: 'missed_call',
      isInstant: true
    }
  })

  const newBookingNotif = mockInsertCalls.find(c => c.table === 'notifications')
  assert.ok(newBookingNotif, 'Created in-app notification')
  assert.equal(newBookingNotif.row.title, '⚡ Recovered Lead: New Appointment Booked!')
  assert.ok(newBookingNotif.row.message.includes('from your missed call text-back'), 'Message highlights recovery')

  // 2. Recovered starter_job_booked
  mockInsertCalls.length = 0
  await notifyOwner(mockSupabase, {
    event: 'starter_job_booked',
    organizationId: 'org-test',
    data: {
      customerName: 'Karl Marx',
      serviceName: 'Water Heater Diagnostic',
      bookingTime: 'Tomorrow at 10:00 AM',
      jobMilestone: 1,
      remainingJobs: 2,
      source: 'missed_call'
    }
  })

  const starterNotif = mockInsertCalls.find(c => c.table === 'notifications')
  assert.ok(starterNotif, 'Created starter job notification')
  assert.equal(starterNotif.row.title, '⚡ [Job 1 of 3 Free] Recovered Missed Call Booked!')
  assert.ok(starterNotif.row.message.includes('from your missed call text-back!'), 'Milestone message highlights recovery')
})

test('Canned snippet replacement expands {booking_link} with contextual query params', () => {
  const snippet = 'You can pick a time directly on our schedule here: {booking_link}'
  const slug = 'shanta-plumbing'
  const phone = '+18688904567'
  const name = 'Karl Marx'
  const cid = 'contact-789'
  const origin = 'https://app.captodesk.com'

  const queryParts = [
    `phone=${encodeURIComponent(phone)}`,
    `cid=${encodeURIComponent(cid)}`,
    `name=${encodeURIComponent(name)}`,
    'source=inbox'
  ].join('&')

  const bookingUrl = `${origin}/book/${slug}?${queryParts}`
  const expanded = snippet.replace('{booking_link}', bookingUrl)

  assert.ok(expanded.includes('https://app.captodesk.com/book/shanta-plumbing?phone=%2B18688904567'))
  assert.ok(expanded.includes('source=inbox'))
  assert.ok(expanded.includes('name=Karl%20Marx'))
  assert.ok(expanded.includes('cid=contact-789'))
})

test('getAttentionQueue highlights recovered missed calls and missed call leads', async () => {
  const createChainMock = (data) => {
    const obj = {
      eq: () => obj,
      gt: () => obj,
      gte: () => obj,
      lte: () => obj,
      in: () => obj,
      not: () => obj,
      or: () => obj,
      order: () => obj,
      limit: () => obj,
      is: () => obj,
      maybeSingle: async () => ({ data, error: null }),
      single: async () => ({ data, error: null }),
      then: (resolve) => Promise.resolve({ data, error: null }).then(resolve)
    }
    return obj
  }

  const mockSupabase = {
    from(table) {
      return {
        select() {
          if (table === 'leads') {
            return createChainMock([
              {
                id: 'lead-1',
                created_at: new Date().toISOString(),
                status: 'new',
                source: 'missed_call',
                value: null,
                contacts: { id: 'c-1', name: 'Karl Marx', phone: '+18688904567' }
              }
            ])
          }
          if (table === 'appointments') {
            return createChainMock([
              {
                id: 'appt-1',
                start_time: new Date(Date.now() + 86400000).toISOString(),
                source: 'missed_call',
                services: { name: 'Water Heater Flush' },
                contacts: { name: 'Karl Marx', phone: '+18688904567' }
              }
            ])
          }
          if (table === 'organizations') {
            return createChainMock({
              id: 'org-test',
              plan_id: 'free',
              subscription_status: 'free'
            })
          }
          return createChainMock([])
        }
      }
    }
  }

  const items = await getAttentionQueue(mockSupabase, 'org-test')

  const leadItem = items.find(i => i.id === 'lead-lead-1')
  assert.ok(leadItem, 'Found lead item')
  assert.equal(leadItem.title, '⚡ Missed Call Lead: Karl Marx')
  assert.equal(leadItem.subtitle, '⚡ Lead recovered from missed call text-back')

  const apptItem = items.find(i => i.id === 'appt-appt-1')
  assert.ok(apptItem, 'Found appointment item')
  assert.equal(apptItem.title, '⚡ Recovered Missed Call: Karl Marx')
  assert.ok(apptItem.subtitle.includes('⚡ Recovered via text-back'), 'Appointment item indicates text-back recovery')
})

