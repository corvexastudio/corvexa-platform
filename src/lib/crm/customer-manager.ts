import type { SupabaseClient } from '@supabase/supabase-js'
import { computeLifecycleStatus, type LifecycleStatus } from '../retention/lifecycle-manager.ts'
import { paginateArrayKeyset } from '../pagination/cursor.ts'

export type TimelineEventType =
  | 'call'
  | 'message'
  | 'quote'
  | 'appointment'
  | 'job'
  | 'invoice'
  | 'payment'
  | 'review_request'

export interface CustomerTimelineItem {
  id: string
  type: TimelineEventType
  timestamp: string
  title: string
  description?: string
  status?: string
  metadata?: Record<string, any>
  actionLink?: string
}

export interface Customer360Profile {
  contact: any
  leadSource?: string
  lifetimeValue: number
  lifecycleStatus: LifecycleStatus
  stats: {
    totalJobs: number
    completedJobs: number
    totalQuotes: number
    totalInvoices: number
    totalPayments: number
    totalCalls: number
  }
  timeline: CustomerTimelineItem[]
  jobs: any[]
  quotes: any[]
  invoices: any[]
  payments: any[]
  appointments: any[]
  reviewRequests: any[]
  calls: any[]
}

/**
 * Calculates customer lifetime value (LTV) from verified payments or paid invoices
 */
export function calculateCustomerLtv(payments: any[] = [], invoices: any[] = []): number {
  // 1. Primary: Sum verified succeeded payments
  const succeededPayments = payments.filter(p => p.payment_status === 'succeeded' || !p.payment_status)
  if (succeededPayments.length > 0) {
    const total = succeededPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    return Math.round(total * 100) / 100
  }

  // 2. Fallback: Sum amount_paid from invoices
  const paidInvoices = invoices.filter(i => (Number(i.amount_paid) || 0) > 0)
  const invoiceTotal = paidInvoices.reduce((sum, i) => sum + (Number(i.amount_paid) || 0), 0)
  return Math.round(invoiceTotal * 100) / 100
}

/**
 * Aggregates real events across domain tables into a unified chronological timeline
 * Note: Events are derived dynamically from authoritative tables, never duplicated.
 */
export function aggregateCustomerTimeline(context: {
  calls?: any[]
  messages?: any[]
  quotes?: any[]
  appointments?: any[]
  jobs?: any[]
  invoices?: any[]
  payments?: any[]
  reviewRequests?: any[]
}): CustomerTimelineItem[] {
  const items: CustomerTimelineItem[] = []

  // 1. Calls
  for (const call of context.calls || []) {
    const isCompleted = call.status === 'completed' || call.call_status === 'completed'
    const duration = call.duration_seconds ? ` (${call.duration_seconds}s)` : ''
    items.push({
      id: `call_${call.id}`,
      type: 'call',
      timestamp: call.created_at,
      title: isCompleted ? 'Call Completed' : 'Missed Call',
      description: `${call.direction === 'inbound' ? 'Inbound' : 'Outbound'} call from ${call.caller_number || 'customer'}${duration}`,
      status: call.status || call.call_status || 'completed'
    })
  }

  // 2. Messages (SMS)
  for (const msg of context.messages || []) {
    const isInbound = msg.direction === 'inbound'
    items.push({
      id: `msg_${msg.id}`,
      type: 'message',
      timestamp: msg.created_at,
      title: isInbound ? 'Customer Replied' : 'SMS Sent',
      description: msg.content || '',
      status: msg.status || 'sent'
    })
  }

  // 3. Quotes
  for (const quote of context.quotes || []) {
    if (quote.created_at) {
      items.push({
        id: `quote_created_${quote.id}`,
        type: 'quote',
        timestamp: quote.created_at,
        title: `Quote Created (${quote.quote_number || 'Quote'})`,
        description: `"${quote.title}" - Total: $${quote.total}`,
        status: quote.status
      })
    }
    if (quote.sent_at) {
      items.push({
        id: `quote_sent_${quote.id}`,
        type: 'quote',
        timestamp: quote.sent_at,
        title: `Quote Sent (${quote.quote_number})`,
        description: `Sent to customer for $${quote.total}`,
        status: 'sent'
      })
    }
    if (quote.accepted_at) {
      items.push({
        id: `quote_acc_${quote.id}`,
        type: 'quote',
        timestamp: quote.accepted_at,
        title: `Quote Accepted (${quote.quote_number})`,
        description: `Customer approved estimate of $${quote.total}`,
        status: 'accepted'
      })
    }
    if (quote.declined_at) {
      items.push({
        id: `quote_dec_${quote.id}`,
        type: 'quote',
        timestamp: quote.declined_at,
        title: `Quote Declined (${quote.quote_number})`,
        description: quote.decline_reason ? `Reason: ${quote.decline_reason}` : 'Customer declined quote',
        status: 'declined'
      })
    }
  }

  // 4. Appointments
  for (const appt of context.appointments || []) {
    if (appt.created_at) {
      const startTimeStr = appt.start_time ? new Date(appt.start_time).toLocaleString() : ''
      items.push({
        id: `appt_book_${appt.id}`,
        type: 'appointment',
        timestamp: appt.created_at,
        title: 'Appointment Booked',
        description: startTimeStr ? `Scheduled for ${startTimeStr}` : 'Service appointment scheduled',
        status: appt.status
      })
    }
  }

  // 5. Jobs
  for (const job of context.jobs || []) {
    if (job.created_at) {
      items.push({
        id: `job_sched_${job.id}`,
        type: 'job',
        timestamp: job.created_at,
        title: `Job Scheduled (${job.job_number || 'Job'})`,
        description: job.title,
        status: job.status
      })
    }
    if (job.completed_at) {
      items.push({
        id: `job_comp_${job.id}`,
        type: 'job',
        timestamp: job.completed_at,
        title: `Job Completed (${job.job_number || 'Job'})`,
        description: job.title,
        status: 'completed'
      })
    }
  }

  // 6. Invoices
  for (const inv of context.invoices || []) {
    if (inv.created_at) {
      items.push({
        id: `inv_creat_${inv.id}`,
        type: 'invoice',
        timestamp: inv.created_at,
        title: `Invoice Created (${inv.invoice_number})`,
        description: `Total: $${inv.total}`,
        status: inv.status
      })
    }
    if (inv.sent_at) {
      items.push({
        id: `inv_sent_${inv.id}`,
        type: 'invoice',
        timestamp: inv.sent_at,
        title: `Invoice Sent (${inv.invoice_number})`,
        description: `Payment link sent for $${inv.amount_due || inv.total}`,
        status: 'sent'
      })
    }
    if (inv.paid_at) {
      items.push({
        id: `inv_paid_${inv.id}`,
        type: 'invoice',
        timestamp: inv.paid_at,
        title: `Invoice Paid in Full (${inv.invoice_number})`,
        description: `$${inv.total} paid`,
        status: 'paid'
      })
    }
  }

  // 7. Payments
  for (const p of context.payments || []) {
    const timestamp = p.paid_at || p.created_at
    const methodStr = p.payment_method ? ` via ${p.payment_method.replace('_', ' ')}` : ''
    items.push({
      id: `pay_${p.id}`,
      type: 'payment',
      timestamp,
      title: `Payment Received: $${p.amount}`,
      description: `Payment received${methodStr}`,
      status: p.payment_status || 'succeeded'
    })
  }

  // 8. Review Requests
  for (const rev of context.reviewRequests || []) {
    const sentTime = rev.sent_at || rev.created_at
    items.push({
      id: `rev_sent_${rev.id}`,
      type: 'review_request',
      timestamp: sentTime,
      title: 'Review Request Sent',
      description: `Status: ${rev.delivery_status || rev.status}`,
      status: rev.status
    })
    if (rev.clicked_at) {
      items.push({
        id: `rev_click_${rev.id}`,
        type: 'review_request',
        timestamp: rev.clicked_at,
        title: 'Review Link Clicked',
        description: `Customer opened Google review page (${rev.click_count || 1} click${(rev.click_count || 1) > 1 ? 's' : ''})`,
        status: 'clicked'
      })
    }
  }

  // Sort chronologically (newest first)
  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

/**
 * Builds the complete Customer 360 profile from all domain tables
 */
export async function getCustomerProfile360(
  supabase: SupabaseClient,
  input: { orgId: string; contactId: string }
): Promise<{ success: boolean; profile?: Customer360Profile; error?: string }> {
  const { orgId, contactId } = input

  // 1. Fetch contact
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('org_id', orgId)
    .single()

  if (contactError || !contact) {
    return { success: false, error: contactError?.message || 'Customer not found' }
  }

  // 2. Concurrently fetch all customer sub-entities
  const [
    leadsRes,
    callsRes,
    quotesRes,
    apptsRes,
    jobsRes,
    invoicesRes,
    paymentsRes,
    reviewsRes,
    convRes
  ] = await Promise.all([
    supabase.from('leads').select('*').eq('contact_id', contactId).eq('org_id', orgId).order('created_at', { ascending: true }),
    supabase.from('calls').select('*').eq('contact_id', contactId).eq('org_id', orgId).order('created_at', { ascending: false }),
    supabase.from('quotes').select('*, quote_items(*)').eq('contact_id', contactId).eq('org_id', orgId).order('created_at', { ascending: false }),
    supabase.from('appointments').select('*, services(*)').eq('contact_id', contactId).eq('org_id', orgId).order('created_at', { ascending: false }),
    supabase.from('jobs').select('*, job_items(*)').eq('contact_id', contactId).eq('org_id', orgId).order('created_at', { ascending: false }),
    supabase.from('invoices').select('*, invoice_items(*)').eq('contact_id', contactId).eq('org_id', orgId).order('created_at', { ascending: false }),
    supabase.from('payments').select('*').eq('contact_id', contactId).eq('org_id', orgId).order('created_at', { ascending: false }),
    supabase.from('review_requests').select('*').eq('contact_id', contactId).eq('org_id', orgId).order('created_at', { ascending: false }),
    supabase.from('conversations').select('id').eq('contact_id', contactId).eq('org_id', orgId)
  ])

  // Fetch messages for customer conversations
  let messages: any[] = []
  const convIds = (convRes.data || []).map((c: any) => c.id)
  if (convIds.length > 0) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
    messages = msgs || []
  }

  const jobs = jobsRes.data || []
  const quotes = quotesRes.data || []
  const appointments = apptsRes.data || []
  const invoices = invoicesRes.data || []
  const payments = paymentsRes.data || []
  const reviewRequests = reviewsRes.data || []
  const calls = callsRes.data || []
  const leads = leadsRes.data || []

  // 3. Compute Lifetime Value (LTV)
  const lifetimeValue = calculateCustomerLtv(payments, invoices)

  // 4. Compute Current Lifecycle Status
  const lifecycleStatus = computeLifecycleStatus(contact.last_service_date, contact.service_frequency_days || 90)

  // 5. Aggregate Chronological Timeline
  const timeline = aggregateCustomerTimeline({
    calls,
    messages,
    quotes,
    appointments,
    jobs,
    invoices,
    payments,
    reviewRequests
  })

  const leadSource = leads.length > 0 ? leads[0].source : 'direct'

  const profile: Customer360Profile = {
    contact,
    leadSource,
    lifetimeValue,
    lifecycleStatus,
    stats: {
      totalJobs: jobs.length,
      completedJobs: jobs.filter((j: any) => j.status === 'completed').length,
      totalQuotes: quotes.length,
      totalInvoices: invoices.length,
      totalPayments: payments.length,
      totalCalls: calls.length
    },
    timeline,
    jobs,
    quotes,
    invoices,
    payments,
    appointments,
    reviewRequests,
    calls
  }

  return { success: true, profile }
}

/**
 * Searches, filters, and sorts customers with live computed LTV and activity timestamps
 */
export async function searchAndFilterCustomers(
  supabase: SupabaseClient,
  filters: {
    orgId: string
    query?: string
    status?: 'all' | 'active' | 'due' | 'overdue' | 'inactive'
    tag?: string
    sortBy?: 'last_activity' | 'name' | 'ltv' | 'last_service'
    limit?: number
    cursor?: string
  }
): Promise<{
  success: boolean
  customers: any[]
  totalCount: number
  nextCursor?: string | null
  hasMore?: boolean
  error?: string
}> {
  const { orgId, query, status = 'all', tag, sortBy = 'last_activity', limit, cursor } = filters

  // 1. Fetch contacts for this tenant
  const { data: contacts, error: contactError } = await supabase
    .from('contacts')
    .select('*')
    .eq('org_id', orgId)

  if (contactError) {
    return { success: false, customers: [], totalCount: 0, error: contactError.message }
  }

  let filtered = contacts || []

  // Filter by lifecycle status (supports both stored column and dynamic computation)
  if (status && status !== 'all') {
    filtered = filtered.filter(c => {
      const currentStatus = c.lifecycle_status || computeLifecycleStatus(c.last_service_date, c.service_frequency_days || 90)
      return currentStatus === status
    })
  }

  // 2. Apply in-memory text & tag search
  if (query && query.trim()) {
    const q = query.toLowerCase().trim()
    filtered = filtered.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    )
  }

  if (tag && tag.trim()) {
    const t = tag.trim()
    filtered = filtered.filter(c => Array.isArray(c.tags) && c.tags.includes(t))
  }

  const totalMatching = filtered.length

  // Pre-sort contacts for cursor slicing
  if (sortBy === 'name') {
    filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  } else if (sortBy === 'last_service') {
    filtered.sort((a, b) => {
      const aTime = a.last_service_date ? new Date(a.last_service_date).getTime() : 0
      const bTime = b.last_service_date ? new Date(b.last_service_date).getTime() : 0
      return bTime - aTime
    })
  } else {
    // Default chronological / last activity
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  // 3. Slice batch for keyset pagination
  let batchContacts = filtered
  let nextCursor: string | null = null
  let hasMore = false

  if (limit && sortBy !== 'ltv') {
    const paginated = paginateArrayKeyset(filtered, {
      limit,
      cursor,
      sortField: sortBy === 'name' ? 'name' : 'created_at'
    })
    batchContacts = paginated.items
    nextCursor = paginated.nextCursor
    hasMore = paginated.hasMore
  }

  // 4. Fetch child payments and invoices ONLY for batch contacts (ELIMINATES N+1!)
  const contactIds = batchContacts.map(c => c.id).filter(Boolean)
  let paymentsData: any[] = []
  let invoicesData: any[] = []

  if (contactIds.length > 0) {
    const [paymentsRes, invoicesRes] = await Promise.all([
      supabase.from('payments').select('contact_id, amount, payment_status').in('contact_id', contactIds),
      supabase.from('invoices').select('contact_id, total, amount_paid, status, created_at').in('contact_id', contactIds)
    ])
    paymentsData = paymentsRes.data || []
    invoicesData = invoicesRes.data || []
  }

  const paymentsByContact: Record<string, any[]> = {}
  for (const p of paymentsData) {
    if (!paymentsByContact[p.contact_id]) paymentsByContact[p.contact_id] = []
    paymentsByContact[p.contact_id].push(p)
  }

  const invoicesByContact: Record<string, any[]> = {}
  for (const inv of invoicesData) {
    if (!invoicesByContact[inv.contact_id]) invoicesByContact[inv.contact_id] = []
    invoicesByContact[inv.contact_id].push(inv)
  }

  // 5. Map batch contacts with computed LTV and latest activity
  let list = batchContacts.map(c => {
    const cPayments = paymentsByContact[c.id] || []
    const cInvoices = invoicesByContact[c.id] || []
    const ltv = calculateCustomerLtv(cPayments, cInvoices)
    const lifecycle = computeLifecycleStatus(c.last_service_date, c.service_frequency_days || 90)

    const dates: number[] = []
    if (c.created_at) {
      const t = new Date(c.created_at).getTime()
      if (!isNaN(t)) dates.push(t)
    }
    if (c.updated_at) {
      const t = new Date(c.updated_at).getTime()
      if (!isNaN(t)) dates.push(t)
    }
    if (c.last_service_date) {
      const t = new Date(c.last_service_date).getTime()
      if (!isNaN(t)) dates.push(t)
    }
    if (c.last_reactivation_sent_at) {
      const t = new Date(c.last_reactivation_sent_at).getTime()
      if (!isNaN(t)) dates.push(t)
    }
    for (const inv of cInvoices) {
      if (inv.created_at) {
        const t = new Date(inv.created_at).getTime()
        if (!isNaN(t)) dates.push(t)
      }
    }

    const lastActivity = dates.length > 0
      ? new Date(Math.max(...dates)).toISOString()
      : (c.created_at || new Date().toISOString())

    return {
      ...c,
      lifetime_value: ltv,
      lifecycle_status: lifecycle,
      last_activity: lastActivity
    }
  })

  // Final sort for LTV or last_activity if requested
  if (sortBy === 'ltv') {
    list.sort((a, b) => b.lifetime_value - a.lifetime_value)
    if (limit) {
      hasMore = list.length > limit
      list = list.slice(0, limit)
    }
  } else if (sortBy === 'last_activity' && !limit) {
    list.sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime())
  }

  return {
    success: true,
    customers: list,
    totalCount: totalMatching,
    nextCursor,
    hasMore
  }
}
