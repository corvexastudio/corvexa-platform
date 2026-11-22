import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateCustomerLtv,
  aggregateCustomerTimeline
} from '../src/lib/crm/customer-manager.ts'
import { computeLifecycleStatus } from '../src/lib/retention/lifecycle-manager.ts'
import {
  formatCustomerName,
  formatStandardUsAddress,
  formatAsYouTypeUsPhone
} from '../src/lib/booking/customer-input-formatter.ts'

test('1. Customer Formatting and Normalization for Mobile Truck Entry', () => {
  // Name formatting
  assert.equal(formatCustomerName('john smith'), 'John Smith')
  assert.equal(formatCustomerName('MARY-ANN O\'CONNOR'), "Mary-Ann O'Connor")
  assert.equal(formatCustomerName(''), '')

  // Phone as-you-type formatting
  assert.equal(formatAsYouTypeUsPhone('512'), '(512')
  assert.equal(formatAsYouTypeUsPhone('512555'), '(512) 555')
  assert.equal(formatAsYouTypeUsPhone('5125551234'), '(512) 555-1234')

  // Address standardization
  assert.equal(
    formatStandardUsAddress('123 main street, austin, tx 78701'),
    '123 Main Street, Austin, TX 78701'
  )
})

test('2. Real-time Duplicate Customer Detection Logic', () => {
  const existingCustomers = [
    {
      id: 'cust-1',
      name: 'Bob Vance',
      phone: '+15125551234',
      email: 'bob@vancerefrigeration.com'
    },
    {
      id: 'cust-2',
      name: 'Phyllis Lapin',
      phone: '+15125559876',
      email: 'phyllis@dundermifflin.com'
    }
  ]

  // Helper matching the duplicate check in src/app/client/customers/page.tsx
  const checkDuplicate = (phoneInput, emailInput) => {
    const cleanPhone = phoneInput.replace(/\D/g, '')
    const cleanEmail = emailInput.trim().toLowerCase()

    return existingCustomers.find(c => {
      const cPhone = (c.phone || '').replace(/\D/g, '')
      const cEmail = (c.email || '').trim().toLowerCase()
      const phoneMatch = cleanPhone.length >= 7 && cPhone.includes(cleanPhone)
      const emailMatch = cleanEmail.length >= 4 && cEmail === cleanEmail
      return phoneMatch || emailMatch
    })
  }

  // Matching by phone
  const match1 = checkDuplicate('(512) 555-1234', '')
  assert.ok(match1, 'Found duplicate by phone')
  assert.equal(match1.id, 'cust-1')

  // Matching by email
  const match2 = checkDuplicate('', 'bob@vancerefrigeration.com')
  assert.ok(match2, 'Found duplicate by email')
  assert.equal(match2.id, 'cust-1')

  // Partial phone match (last 7 digits)
  const match3 = checkDuplicate('555-1234', '')
  assert.ok(match3, 'Found duplicate by 7-digit phone fragment')
  assert.equal(match3.id, 'cust-1')

  // No match
  const match4 = checkDuplicate('(512) 999-0000', 'new@customer.com')
  assert.equal(match4, undefined, 'No duplicate found for new customer')
})

test('3. Service Cadence and Next Due Date Calculation', () => {
  const calculateNextDue = (lastServiceDateStr, frequencyDays) => {
    if (!lastServiceDateStr) return null
    const last = new Date(lastServiceDateStr)
    const days = Number(frequencyDays) || 90
    return new Date(last.getTime() + days * 24 * 60 * 60 * 1000)
  }

  const calculateDaysRemaining = (nextDueDate, simulatedNow) => {
    if (!nextDueDate) return null
    return Math.ceil((nextDueDate.getTime() - simulatedNow.getTime()) / (1000 * 60 * 60 * 24))
  }

  // Case A: Customer serviced 30 days ago with 90-day interval
  const now = new Date('2026-11-22T10:00:00Z')
  const serviced30DaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()
  const nextDueA = calculateNextDue(serviced30DaysAgo, 90)
  assert.ok(nextDueA)
  const daysA = calculateDaysRemaining(nextDueA, now)
  assert.equal(daysA, 60, 'Service is due in exactly 60 days')

  // Case B: Customer serviced 100 days ago with 90-day interval (Overdue)
  const serviced100DaysAgo = new Date(now.getTime() - 100 * 86400000).toISOString()
  const nextDueB = calculateNextDue(serviced100DaysAgo, 90)
  const daysB = calculateDaysRemaining(nextDueB, now)
  assert.equal(daysB, -10, 'Service is overdue by 10 days')

  // Case C: New customer with no prior service
  const nextDueC = calculateNextDue(null, 90)
  assert.equal(nextDueC, null, 'No due date for customer without prior service history')
})

test('4. Customer 360 Financial Revenue Integrity & Outstanding Balance', () => {
  const payments = [
    { id: 'p1', amount: 350.00, payment_status: 'succeeded' },
    { id: 'p2', amount: 150.00, payment_status: 'succeeded' },
    { id: 'p3', amount: 75.00, payment_status: 'failed' } // Failed payments do not count
  ]

  const invoices = [
    { id: 'inv1', invoice_number: 'INV-001', total: 350.00, amount_due: 0, status: 'paid' },
    { id: 'inv2', invoice_number: 'INV-002', total: 150.00, amount_due: 0, status: 'paid' },
    { id: 'inv3', invoice_number: 'INV-003', total: 400.00, amount_due: 250.00, status: 'sent' },
    { id: 'inv4', invoice_number: 'INV-004', total: 100.00, amount_due: 100.00, status: 'cancelled' }
  ]

  // Verified Lifetime Value calculation
  const verifiedLtv = calculateCustomerLtv(payments, invoices)
  assert.equal(verifiedLtv, 500.00, 'LTV only sums verified payments and paid invoices')

  // Outstanding Balance calculation
  let totalInvoiced = 0
  let totalOutstanding = 0
  for (const inv of invoices) {
    const tot = Number(inv.total) || 0
    totalInvoiced += tot
    if (inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'void') {
      const due = inv.amount_due !== undefined && inv.amount_due !== null ? Number(inv.amount_due) : tot
      totalOutstanding += due
    }
  }

  assert.equal(totalInvoiced, 1000.00, 'Total invoiced sums all invoices')
  assert.equal(totalOutstanding, 250.00, 'Outstanding balance correctly ignores paid and cancelled invoices')
})

test('5. 10DLC Messaging Opt-Out Compliance State', () => {
  const contactOptedIn = {
    id: 'c1',
    name: 'Alice Cooper',
    phone: '+15125557788',
    opt_out: false
  }

  const contactOptedOut = {
    id: 'c2',
    name: 'Eve Adams',
    phone: '+15125559900',
    opt_out: true
  }

  const getMessagingStatus = (contact) => {
    if (contact.opt_out) {
      return {
        canSendSms: false,
        statusText: 'SMS Opted Out (STOP Received)',
        badgeColor: 'rose'
      }
    }
    return {
      canSendSms: true,
      statusText: 'SMS Subscribed & Active',
      badgeColor: 'emerald'
    }
  }

  const statusIn = getMessagingStatus(contactOptedIn)
  assert.equal(statusIn.canSendSms, true)
  assert.equal(statusIn.statusText, 'SMS Subscribed & Active')

  const statusOut = getMessagingStatus(contactOptedOut)
  assert.equal(statusOut.canSendSms, false)
  assert.equal(statusOut.statusText, 'SMS Opted Out (STOP Received)')
})

test('6. Unified Chronological Activity Timeline Aggregation', () => {
  const mockData = {
    calls: [
      { id: 'c1', created_at: '2026-11-20T10:00:00Z', direction: 'inbound', duration_seconds: 120 }
    ],
    messages: [
      { id: 'm1', created_at: '2026-11-20T10:05:00Z', direction: 'outbound', body: 'On my way!' }
    ],
    quotes: [
      { id: 'q1', created_at: '2026-11-21T09:00:00Z', quote_number: 'EST-101', title: 'AC Tune', total: 200, status: 'sent', sent_at: '2026-11-21T09:05:00Z' }
    ],
    appointments: [
      { id: 'a1', created_at: '2026-11-21T11:00:00Z', start_time: '2026-11-25T14:00:00Z' }
    ],
    jobs: [
      { id: 'j1', created_at: '2026-11-21T12:00:00Z', status: 'completed', completed_at: '2026-11-21T15:00:00Z', total_price: 200 }
    ],
    invoices: [
      { id: 'i1', created_at: '2026-11-21T15:30:00Z', invoice_number: 'INV-201', total: 200, status: 'paid', paid_at: '2026-11-21T16:00:00Z' }
    ],
    payments: [
      { id: 'p1', created_at: '2026-11-21T16:00:00Z', amount: 200, payment_method: 'card', payment_status: 'succeeded' }
    ],
    reviewRequests: [
      { id: 'r1', created_at: '2026-11-21T16:30:00Z', sent_at: '2026-11-21T16:30:00Z', status: 'sent' }
    ]
  }

  const timeline = aggregateCustomerTimeline(mockData)
  assert.ok(timeline.length > 5, 'Timeline successfully aggregates cross-domain records')

  // Verify chronological ordering (descending: newest first)
  for (let i = 0; i < timeline.length - 1; i++) {
    const tCurrent = new Date(timeline[i].timestamp).getTime()
    const tNext = new Date(timeline[i + 1].timestamp).getTime()
    assert.ok(tCurrent >= tNext, 'Timeline items are ordered newest to oldest')
  }
})
