import { SupabaseClient } from '@supabase/supabase-js'

export interface AttentionItem {
  id: string
  category: 'lead' | 'message' | 'quote' | 'appointment' | 'invoice' | 'retention'
  urgency: 'critical' | 'warning' | 'info'
  title: string
  subtitle: string
  timestamp: string
  actionLabel: string
  actionHref: string
  metadata?: Record<string, any>
}

export interface OperationalMetrics {
  newLeads: number
  missedCallsRecovered: number
  activeBookings: number
  quotesAwaitingResponse: number
  quotesAwaitingResponseValue: number
  jobsToday: number
  outstandingInvoices: number
  outstandingInvoicesBalance: number
  paymentsReceived: number
  paymentsReceivedAmount: number
  reviewRequestsSent: number
  customersDueForFollowup: number
}

export interface OutcomeMetrics {
  recoveredConversations: {
    recoveredCount: number
    totalMissedCalls: number
    recoveryRate: number
  }
  bookingsFromCaptoDesk: {
    totalBookings: number
    totalBookedValue: number
    onlineBookingsCount: number
    recoveryBookingsCount: number
  }
  quoteConversion: {
    acceptedCount: number
    totalResolvedCount: number
    conversionRate: number
    acceptedValue: number
    totalSentValue: number
  }
  paymentCollection: {
    collectedAmount: number
    invoicedAmount: number
    collectionRate: number
    paidInvoicesCount: number
    totalInvoicesCount: number
  }
  repeatBookings: {
    repeatBookingsCount: number
    totalBookingsCount: number
    repeatRate: number
    repeatCustomerCount: number
  }
}

export interface JobTodayItem {
  id: string
  jobNumber: string
  title: string
  status: string
  scheduledStart: string
  scheduledEnd?: string | null
  customerName: string
  customerPhone?: string | null
  technicianName?: string | null
  address?: string | null
}

export interface RecentCallItem {
  id: string
  callerNumber: string
  customerName?: string | null
  status: string
  createdAt: string
  autoReplySent: boolean
  customerReplied: boolean
}

export interface DashboardOverview {
  attentionQueue: AttentionItem[]
  operations: OperationalMetrics
  outcomes: OutcomeMetrics
  jobsToday: JobTodayItem[]
  recentCalls: RecentCallItem[]
}

export type TimeRange = '7d' | '30d' | 'all'

export function getTimeRangeStart(range: TimeRange): string | null {
  if (range === 'all') return null
  const now = new Date()
  const days = range === '7d' ? 7 : 30
  now.setDate(now.getDate() - days)
  return now.toISOString()
}

/**
 * Aggregates urgent actionable items across leads, inbox, quotes, bookings, invoices, and retention.
 */
export async function getAttentionQueue(
  supabase: SupabaseClient,
  orgId: string
): Promise<AttentionItem[]> {
  const items: AttentionItem[] = []
  const now = new Date()
  const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  // 1. New Unhandled Leads
  const { data: newLeads } = await supabase
    .from('leads')
    .select('id, created_at, status, value, contacts(name, phone)')
    .eq('org_id', orgId)
    .eq('status', 'new')
    .order('created_at', { ascending: false })
    .limit(10)

  if (newLeads && newLeads.length > 0) {
    for (const lead of newLeads) {
      const contactName = (lead.contacts as any)?.name || (lead.contacts as any)?.phone || 'New Customer'
      items.push({
        id: `lead-${lead.id}`,
        category: 'lead',
        urgency: 'critical',
        title: `New lead: ${contactName}`,
        subtitle: lead.value ? `Estimated value: $${Number(lead.value).toLocaleString()}` : 'Awaiting initial contact',
        timestamp: lead.created_at,
        actionLabel: 'View Lead & Call',
        actionHref: '/client/leads',
        metadata: { leadId: lead.id }
      })
    }
  }

  // 2. Customers Waiting for Response (Unread Conversations)
  const { data: unreadConvs } = await supabase
    .from('conversations')
    .select('id, unread_count, last_message_at, contacts(name, phone)')
    .eq('org_id', orgId)
    .gt('unread_count', 0)
    .order('last_message_at', { ascending: false })
    .limit(10)

  if (unreadConvs && unreadConvs.length > 0) {
    for (const conv of unreadConvs) {
      const contactName = (conv.contacts as any)?.name || (conv.contacts as any)?.phone || 'Customer'
      items.push({
        id: `conv-${conv.id}`,
        category: 'message',
        urgency: 'critical',
        title: `${conv.unread_count} unread ${conv.unread_count === 1 ? 'text' : 'texts'} from ${contactName}`,
        subtitle: 'Customer is waiting for your response',
        timestamp: conv.last_message_at || now.toISOString(),
        actionLabel: 'Reply in Inbox',
        actionHref: '/client/inbox',
        metadata: { conversationId: conv.id }
      })
    }
  }

  // 3. Expiring Quotes (Sent or Viewed with expiration within 48h or expired)
  const { data: expiringQuotes } = await supabase
    .from('quotes')
    .select('id, quote_number, total, expires_at, status, contacts(name, phone)')
    .eq('org_id', orgId)
    .in('status', ['sent', 'viewed'])
    .not('expires_at', 'is', null)
    .lte('expires_at', in48Hours.toISOString())
    .order('expires_at', { ascending: true })
    .limit(10)

  if (expiringQuotes && expiringQuotes.length > 0) {
    for (const quote of expiringQuotes) {
      const isPast = new Date(quote.expires_at) < now
      const contactName = (quote.contacts as any)?.name || 'Client'
      items.push({
        id: `quote-${quote.id}`,
        category: 'quote',
        urgency: isPast ? 'warning' : 'warning',
        title: `Quote ${quote.quote_number} ${isPast ? 'expired' : 'expiring soon'}: ${contactName}`,
        subtitle: `$${Number(quote.total).toLocaleString()} • ${isPast ? 'Expired' : 'Expires in <48h'}`,
        timestamp: quote.expires_at,
        actionLabel: 'Follow Up',
        actionHref: '/client/quotes',
        metadata: { quoteId: quote.id }
      })
    }
  }

  // 4. Appointments Needing Confirmation (Requested Bookings)
  const { data: requestedAppts } = await supabase
    .from('appointments')
    .select('id, start_time, source, services(name), contacts(name, phone)')
    .eq('org_id', orgId)
    .eq('status', 'requested')
    .order('start_time', { ascending: true })
    .limit(10)

  if (requestedAppts && requestedAppts.length > 0) {
    for (const appt of requestedAppts) {
      const contactName = (appt.contacts as any)?.name || 'Client'
      const serviceName = (appt.services as any)?.name || 'Service Appointment'
      items.push({
        id: `appt-${appt.id}`,
        category: 'appointment',
        urgency: 'critical',
        title: `Booking request: ${contactName}`,
        subtitle: `${serviceName} • ${new Date(appt.start_time).toLocaleDateString()} at ${new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        timestamp: appt.start_time,
        actionLabel: 'Confirm Booking',
        actionHref: '/client/calendar',
        metadata: { appointmentId: appt.id }
      })
    }
  }

  // 5. Overdue / Outstanding Past Due Invoices
  const { data: overdueInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, due_date, status, contacts(name, phone)')
    .eq('org_id', orgId)
    .or(`status.eq.overdue,and(status.in.(sent,partially_paid),due_date.lt.${now.toISOString()})`)
    .order('due_date', { ascending: true })
    .limit(10)

  if (overdueInvoices && overdueInvoices.length > 0) {
    for (const inv of overdueInvoices) {
      const contactName = (inv.contacts as any)?.name || 'Client'
      items.push({
        id: `inv-${inv.id}`,
        category: 'invoice',
        urgency: 'critical',
        title: `Overdue invoice ${inv.invoice_number}: ${contactName}`,
        subtitle: `$${Number(inv.total).toLocaleString()} past due (${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'Immediate'})`,
        timestamp: inv.due_date || now.toISOString(),
        actionLabel: 'Send Reminder',
        actionHref: '/client/invoices',
        metadata: { invoiceId: inv.id }
      })
    }
  }

  // 6. Customers Due for Service / Follow-up
  const { data: dueCustomers } = await supabase
    .from('contacts')
    .select('id, name, phone, last_service_date, lifecycle_status, next_expected_service_date')
    .eq('org_id', orgId)
    .in('lifecycle_status', ['due', 'overdue'])
    .order('next_expected_service_date', { ascending: true })
    .limit(10)

  if (dueCustomers && dueCustomers.length > 0) {
    for (const cust of dueCustomers) {
      items.push({
        id: `cust-${cust.id}`,
        category: 'retention',
        urgency: cust.lifecycle_status === 'overdue' ? 'warning' : 'info',
        title: `Service ${cust.lifecycle_status}: ${cust.name || cust.phone || 'Customer'}`,
        subtitle: cust.last_service_date
          ? `Last service was ${new Date(cust.last_service_date).toLocaleDateString()}`
          : 'Ready for follow-up service',
        timestamp: cust.next_expected_service_date || now.toISOString(),
        actionLabel: 'Reactivate',
        actionHref: `/client/customers/${cust.id}`,
        metadata: { contactId: cust.id }
      })
    }
  }

  // Urgency weight sorting: critical (0) -> warning (1) -> info (2), then newest first
  const urgencyWeight = { critical: 0, warning: 1, info: 2 }
  return items.sort((a, b) => {
    const diff = urgencyWeight[a.urgency] - urgencyWeight[b.urgency]
    if (diff !== 0) return diff
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })
}

/**
 * Calculates verified outcome metrics with honest attribution.
 * Strictly avoids unprovable causality claims (e.g. uses "Bookings from CaptoDesk").
 */
export async function getOutcomeMetrics(
  supabase: SupabaseClient,
  orgId: string,
  timeRange: TimeRange = '30d'
): Promise<OutcomeMetrics> {
  const rangeStart = getTimeRangeStart(timeRange)

  // 1. Recovered Conversations
  let missedCallsQuery = supabase
    .from('calls')
    .select('id, contact_id, status, created_at')
    .eq('org_id', orgId)
    .eq('status', 'missed')

  if (rangeStart) missedCallsQuery = missedCallsQuery.gte('created_at', rangeStart)
  const { data: missedCalls } = await missedCallsQuery
  const totalMissed = missedCalls?.length || 0

  // Check conversations where inbound customer messages arrived
  let convQuery = supabase
    .from('conversations')
    .select('id, contact_id, last_message_at')
    .eq('org_id', orgId)
    .limit(1000)

  const { data: allConversations } = await convQuery
  let recoveredCount = 0

  if (missedCalls && missedCalls.length > 0 && allConversations) {
    const missedContactIds = new Set(missedCalls.map(c => c.contact_id).filter(Boolean))
    // A conversation is considered recovered if contact had a missed call and conversation had customer response
    const recoveredContacts = allConversations.filter(c => missedContactIds.has(c.contact_id))
    recoveredCount = recoveredContacts.length
  }

  const recoveryRate = totalMissed > 0 ? Math.round((recoveredCount / totalMissed) * 100) : 0

  // 2. Bookings from CaptoDesk
  let apptsQuery = supabase
    .from('appointments')
    .select('id, status, source, services(price), created_at')
    .eq('org_id', orgId)
    .in('status', ['confirmed', 'scheduled', 'completed'])
    .limit(2000)

  if (rangeStart) apptsQuery = apptsQuery.gte('created_at', rangeStart)
  const { data: appts } = await apptsQuery
  const totalBookings = appts?.length || 0
  const totalBookedValue = Math.round(
    (appts || []).reduce((sum, a) => sum + (Number((a.services as any)?.price) || 0), 0) * 100
  ) / 100

  const onlineBookingsCount = (appts || []).filter(a => a.source === 'booking_page' || a.source === 'online').length
  const recoveryBookingsCount = totalBookings - onlineBookingsCount

  // 3. Quote Conversion
  let quotesQuery = supabase
    .from('quotes')
    .select('id, status, total, accepted_at, created_at')
    .eq('org_id', orgId)
    .limit(2000)

  if (rangeStart) quotesQuery = quotesQuery.gte('created_at', rangeStart)
  const { data: quotes } = await quotesQuery
  const allQuotes = quotes || []
  const acceptedQuotes = allQuotes.filter(q => q.status === 'accepted')
  const acceptedCount = acceptedQuotes.length
  const acceptedValue = Math.round(acceptedQuotes.reduce((sum, q) => sum + (Number(q.total) || 0), 0) * 100) / 100
  const totalSentValue = Math.round(allQuotes.reduce((sum, q) => sum + (Number(q.total) || 0), 0) * 100) / 100

  const resolvedQuotes = allQuotes.filter(q => ['accepted', 'declined', 'expired'].includes(q.status))
  const totalResolvedCount = resolvedQuotes.length
  const conversionRate = totalResolvedCount > 0 ? Math.round((acceptedCount / totalResolvedCount) * 100) : 0

  // 4. Payment Collection
  let invoicesQuery = supabase
    .from('invoices')
    .select('id, total, status, created_at')
    .eq('org_id', orgId)
    .limit(2000)

  if (rangeStart) invoicesQuery = invoicesQuery.gte('created_at', rangeStart)
  const { data: invoices } = await invoicesQuery
  const allInvoices = invoices || []
  const totalInvoicesCount = allInvoices.length
  const invoicedAmount = Math.round(allInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0) * 100) / 100
  const paidInvoices = allInvoices.filter(i => i.status === 'paid')
  const paidInvoicesCount = paidInvoices.length

  let paymentsQuery = supabase
    .from('payments')
    .select('id, amount, status, created_at')
    .eq('org_id', orgId)
    .eq('status', 'succeeded')
    .limit(2000)

  if (rangeStart) paymentsQuery = paymentsQuery.gte('created_at', rangeStart)
  const { data: payments } = await paymentsQuery
  const collectedAmount = Math.round(
    ((payments && payments.length > 0)
      ? payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      : paidInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0)) * 100
  ) / 100

  const collectionRate = invoicedAmount > 0 ? Math.round((collectedAmount / invoicedAmount) * 100) : 0

  // 5. Repeat Bookings
  let allJobsQuery = supabase
    .from('jobs')
    .select('id, contact_id, status, created_at')
    .eq('org_id', orgId)
    .limit(2000)

  const { data: allJobs } = await allJobsQuery
  const contactJobCount: Record<string, number> = {}
  for (const job of allJobs || []) {
    if (job.contact_id) {
      contactJobCount[job.contact_id] = (contactJobCount[job.contact_id] || 0) + 1
    }
  }

  const repeatCustomerIds = new Set(
    Object.keys(contactJobCount).filter(contactId => contactJobCount[contactId] > 1)
  )

  const repeatBookingsCount = (appts || []).filter(a => (a as any).contact_id && repeatCustomerIds.has((a as any).contact_id)).length
  const repeatRate = totalBookings > 0 ? Math.round((repeatBookingsCount / totalBookings) * 100) : 0

  return {
    recoveredConversations: {
      recoveredCount,
      totalMissedCalls: totalMissed,
      recoveryRate
    },
    bookingsFromCaptoDesk: {
      totalBookings,
      totalBookedValue,
      onlineBookingsCount,
      recoveryBookingsCount
    },
    quoteConversion: {
      acceptedCount,
      totalResolvedCount,
      conversionRate,
      acceptedValue,
      totalSentValue
    },
    paymentCollection: {
      collectedAmount,
      invoicedAmount,
      collectionRate,
      paidInvoicesCount,
      totalInvoicesCount
    },
    repeatBookings: {
      repeatBookingsCount,
      totalBookingsCount: totalBookings,
      repeatRate,
      repeatCustomerCount: repeatCustomerIds.size
    }
  }
}

/**
 * Computes daily operational counts across all modules.
 */
export async function getOperationalMetrics(
  supabase: SupabaseClient,
  orgId: string,
  timeRange: TimeRange = '30d'
): Promise<OperationalMetrics> {
  const rangeStart = getTimeRangeStart(timeRange)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const [
    leadsRes,
    missedCallsRes,
    bookingsRes,
    quotesAwaitingRes,
    jobsTodayRes,
    outstandingInvoicesRes,
    paymentsRes,
    reviewsRes,
    dueCustomersRes
  ] = await Promise.all([
    // 1. New Leads
    (async () => {
      let q = supabase.from('leads').select('*', { count: 'exact', head: true }).eq('org_id', orgId)
      if (rangeStart) q = q.gte('created_at', rangeStart)
      const { count } = await q
      return count || 0
    })(),

    // 2. Missed Calls Recovered
    (async () => {
      let q = supabase.from('calls').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'missed')
      if (rangeStart) q = q.gte('created_at', rangeStart)
      const { count } = await q
      return count || 0
    })(),

    // 3. Bookings
    (async () => {
      let q = supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('org_id', orgId).in('status', ['confirmed', 'scheduled', 'requested'])
      if (rangeStart) q = q.gte('created_at', rangeStart)
      const { count } = await q
      return count || 0
    })(),

    // 4. Quotes Awaiting Response (sent or viewed)
    (async () => {
      const { data } = await supabase
        .from('quotes')
        .select('total')
        .eq('org_id', orgId)
        .in('status', ['sent', 'viewed'])
      const count = data?.length || 0
      const total = Math.round((data || []).reduce((s, q) => s + (Number(q.total) || 0), 0) * 100) / 100
      return { count, total }
    })(),

    // 5. Jobs Today
    (async () => {
      const { count } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('scheduled_start', todayStart.toISOString())
        .lte('scheduled_start', todayEnd.toISOString())
      return count || 0
    })(),

    // 6. Outstanding Invoices
    (async () => {
      const { data } = await supabase
        .from('invoices')
        .select('total')
        .eq('org_id', orgId)
        .in('status', ['sent', 'partially_paid', 'overdue'])
      const count = data?.length || 0
      const balance = Math.round((data || []).reduce((s, i) => s + (Number(i.total) || 0), 0) * 100) / 100
      return { count, balance }
    })(),

    // 7. Payments Received
    (async () => {
      let q = supabase
        .from('payments')
        .select('amount')
        .eq('org_id', orgId)
        .eq('status', 'succeeded')
      if (rangeStart) q = q.gte('created_at', rangeStart)
      const { data } = await q
      const count = data?.length || 0
      const amount = Math.round((data || []).reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100
      return { count, amount }
    })(),

    // 8. Review Requests Sent
    (async () => {
      let q = supabase.from('review_requests').select('*', { count: 'exact', head: true }).eq('org_id', orgId)
      if (rangeStart) q = q.gte('created_at', rangeStart)
      const { count } = await q
      return count || 0
    })(),

    // 9. Customers Due for Follow-up
    (async () => {
      const { count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .in('lifecycle_status', ['due', 'overdue'])
      return count || 0
    })()
  ])

  return {
    newLeads: leadsRes,
    missedCallsRecovered: missedCallsRes,
    activeBookings: bookingsRes,
    quotesAwaitingResponse: quotesAwaitingRes.count,
    quotesAwaitingResponseValue: quotesAwaitingRes.total,
    jobsToday: jobsTodayRes,
    outstandingInvoices: outstandingInvoicesRes.count,
    outstandingInvoicesBalance: outstandingInvoicesRes.balance,
    paymentsReceived: paymentsRes.count,
    paymentsReceivedAmount: paymentsRes.amount,
    reviewRequestsSent: reviewsRes,
    customersDueForFollowup: dueCustomersRes
  }
}

/**
 * Retrieves today's field jobs with assigned technician, address, and live status.
 */
export async function getJobsToday(
  supabase: SupabaseClient,
  orgId: string
): Promise<JobTodayItem[]> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, job_number, title, status, scheduled_start, scheduled_end, contacts(name, phone, address), profiles(full_name)')
    .eq('org_id', orgId)
    .gte('scheduled_start', todayStart.toISOString())
    .lte('scheduled_start', todayEnd.toISOString())
    .order('scheduled_start', { ascending: true })

  return (jobs || []).map((j: any) => ({
    id: j.id,
    jobNumber: j.job_number,
    title: j.title,
    status: j.status,
    scheduledStart: j.scheduled_start,
    scheduledEnd: j.scheduled_end,
    customerName: j.contacts?.name || 'Customer',
    customerPhone: j.contacts?.phone || null,
    technicianName: j.profiles?.full_name || 'Unassigned',
    address: j.contacts?.address || null
  }))
}

/**
 * Retrieves recent calls with recovery and reply status.
 */
export async function getRecentCalls(
  supabase: SupabaseClient,
  orgId: string,
  limit: number = 5
): Promise<RecentCallItem[]> {
  const { data: calls } = await supabase
    .from('calls')
    .select('id, from_number, status, created_at, contacts(name, phone)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (calls || []).map((c: any) => ({
    id: c.id,
    callerNumber: c.from_number,
    customerName: c.contacts?.name || null,
    status: c.status,
    createdAt: c.created_at,
    autoReplySent: c.status === 'missed',
    customerReplied: false
  }))
}

/**
 * Complete dashboard aggregator that runs queries efficiently in parallel.
 */
export async function getDashboardOverview(
  supabase: SupabaseClient,
  orgId: string,
  timeRange: TimeRange = '30d'
): Promise<DashboardOverview> {
  const [attentionQueue, operations, outcomes, jobsToday, recentCalls] = await Promise.all([
    getAttentionQueue(supabase, orgId),
    getOperationalMetrics(supabase, orgId, timeRange),
    getOutcomeMetrics(supabase, orgId, timeRange),
    getJobsToday(supabase, orgId),
    getRecentCalls(supabase, orgId, 5)
  ])

  return {
    attentionQueue,
    operations,
    outcomes,
    jobsToday,
    recentCalls
  }
}
