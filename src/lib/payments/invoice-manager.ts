import type { SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { sendTelnyxSms } from '../telnyx.ts'
import { createEventEnvelope } from '../automations/events.ts'
import { handleAutomationEvent } from '../automations/engine.ts'
import { evaluateAndApplyStopConditions } from '../automations/stop-conditions.ts'
import { createStripeCheckoutSession } from './stripe-adapter.ts'
import { verifyOutboundCompliance, logComplianceAudit } from '../compliance/compliance-engine.ts'
import { generateDocumentNumber } from '../services/document-counter.ts'
import { scheduleInvoiceReviewAutomation } from '../reviews/review-manager.ts'
import { resolveSenderPhone } from '../billing/plans.ts'

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'void'

export type PaymentMethod = 'stripe' | 'cash' | 'check' | 'card_offline' | 'other'
export type PaymentStatus = 'succeeded' | 'pending' | 'failed' | 'refunded'

export interface InvoiceItemInput {
  description: string
  quantity: number
  unit_price: number
}

export interface CreateInvoiceInput {
  orgId: string
  contactId: string
  jobId?: string
  quoteId?: string
  title: string
  description?: string
  items: InvoiceItemInput[]
  taxRate?: number       // Percentage e.g. 8.25 for 8.25%
  discountAmount?: number // Dollar discount e.g. 20.00
  dueDate?: string        // ISO string
  notes?: string
}

export interface InvoiceFinancials {
  subtotal: number
  tax: number
  discount: number
  total: number
  amountPaid: number
  amountDue: number
}

/**
 * Calculates deterministic financials with precise 2-decimal cent rounding
 */
export function calculateInvoiceFinancials(
  items: InvoiceItemInput[] = [],
  taxRate = 0,
  discountAmount = 0
): InvoiceFinancials {
  let subtotal = 0
  for (const item of items) {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unit_price) || 0
    subtotal += Math.round(qty * price * 100) / 100
  }
  subtotal = Math.round(subtotal * 100) / 100

  const safeDiscount = Math.min(subtotal, Math.max(0, Math.round(Number(discountAmount || 0) * 100) / 100))
  const taxableSubtotal = Math.max(0, subtotal - safeDiscount)
  const safeTaxRate = Math.max(0, Number(taxRate) || 0)
  const tax = Math.round(taxableSubtotal * (safeTaxRate / 100) * 100) / 100
  const total = Math.max(0, Math.round((taxableSubtotal + tax) * 100) / 100)

  return {
    subtotal,
    tax,
    discount: safeDiscount,
    total,
    amountPaid: 0,
    amountDue: total
  }
}

/**
 * Creates a new draft invoice with line items and tokenized customer manage URL
 */
export async function createInvoice(
  supabase: SupabaseClient,
  input: CreateInvoiceInput
): Promise<{ success: boolean; invoice?: any; items?: any[]; error?: string }> {
  const {
    orgId,
    contactId,
    jobId,
    quoteId,
    title,
    description,
    items = [],
    taxRate = 0,
    discountAmount = 0,
    dueDate,
    notes
  } = input

  const financials = calculateInvoiceFinancials(items, taxRate, discountAmount)
  const invoiceNumber = await generateDocumentNumber(supabase, orgId, 'invoice')
  const manageToken = randomBytes(24).toString('hex')
  const resolvedDueDate = dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Transactional creation via PostgreSQL RPC if supported
  const clientWithRpc = supabase as unknown as {
    rpc?: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
  }

  const invoiceItemsPayload = items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: Math.round(Number(item.quantity || 1) * Number(item.unit_price || 0) * 100) / 100
  }))

  if (typeof clientWithRpc?.rpc === 'function') {
    try {
      const { data: rpcData, error: rpcError } = await clientWithRpc.rpc('create_invoice_with_items', {
        p_org_id: orgId,
        p_contact_id: contactId,
        p_job_id: jobId || null,
        p_quote_id: quoteId || null,
        p_invoice_number: invoiceNumber,
        p_title: title,
        p_description: description,
        p_subtotal: financials.subtotal,
        p_tax: financials.tax,
        p_discount: financials.discount,
        p_total: financials.total,
        p_due_date: resolvedDueDate,
        p_manage_token: manageToken,
        p_notes: notes || null,
        p_items: invoiceItemsPayload
      })

      if (!rpcError && rpcData && typeof rpcData === 'object') {
        const parsed = rpcData as { invoice: any; items: any[] }
        if (parsed.invoice) {
          return {
            success: true,
            invoice: parsed.invoice,
            items: parsed.items || []
          }
        }
      } else if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('not found')) {
        return { success: false, error: rpcError.message }
      }
    } catch {
      // Fall through to query transaction rollback
    }
  }

  // 2. Query execution with rollback guarantee (all-or-nothing):
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      org_id: orgId,
      contact_id: contactId,
      job_id: jobId || null,
      quote_id: quoteId || null,
      invoice_number: invoiceNumber,
      title,
      description,
      subtotal: financials.subtotal,
      tax: financials.tax,
      discount: financials.discount,
      total: financials.total,
      amount_paid: 0.00,
      amount_due: financials.total,
      status: 'draft',
      due_date: resolvedDueDate,
      manage_token: manageToken,
      notes
    })
    .select('*')
    .single()

  if (invoiceError || !invoice) {
    return { success: false, error: invoiceError?.message || 'Failed to create invoice' }
  }

  const invoiceItemsToInsert = items.map((item) => ({
    invoice_id: invoice.id,
    org_id: orgId,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: Math.round(Number(item.quantity || 1) * Number(item.unit_price || 0) * 100) / 100
  }))

  let insertedItems: any[] = []
  if (invoiceItemsToInsert.length > 0) {
    const { data: itemData, error: itemError } = await supabase
      .from('invoice_items')
      .insert(invoiceItemsToInsert)
      .select('*')

    if (itemError) {
      // Atomic rollback: clean up orphaned parent invoice
      await supabase.from('invoices').delete().eq('id', invoice.id)
      return { success: false, error: `Failed to insert invoice items: ${itemError.message}` }
    } else {
      insertedItems = itemData || []
    }
  }

  return {
    success: true,
    invoice,
    items: insertedItems
  }
}

/**
 * Updates a draft invoice with new line items, financial totals, and due date
 */
export async function updateInvoice(
  supabase: SupabaseClient,
  input: {
    invoiceId: string
    orgId: string
    title?: string
    description?: string
    items?: InvoiceItemInput[]
    taxRate?: number
    discountAmount?: number
    dueDate?: string
    notes?: string
  }
): Promise<{ success: boolean; invoice?: any; items?: any[]; error?: string }> {
  const { invoiceId, orgId, title, description, items, taxRate = 0, discountAmount = 0, dueDate, notes } = input

  const { data: existing, error: findError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('org_id', orgId)
    .single()

  if (findError || !existing) {
    return { success: false, error: 'Invoice not found' }
  }

  if (existing.status !== 'draft') {
    return { success: false, error: 'Only draft invoices can be edited' }
  }

  const resolvedItems = items || []
  const financials = calculateInvoiceFinancials(resolvedItems, taxRate, discountAmount)

  const updatePayload: Record<string, any> = {
    subtotal: financials.subtotal,
    tax: financials.tax,
    discount: financials.discount,
    total: financials.total,
    amount_due: Math.max(0, financials.total - (Number(existing.amount_paid) || 0)),
    updated_at: new Date().toISOString()
  }

  if (title) updatePayload.title = title
  if (description !== undefined) updatePayload.description = description
  if (dueDate) updatePayload.due_date = dueDate
  if (notes !== undefined) updatePayload.notes = notes

  const { data: updatedInvoice, error: updateError } = await supabase
    .from('invoices')
    .update(updatePayload)
    .eq('id', invoiceId)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (updateError || !updatedInvoice) {
    return { success: false, error: updateError?.message || 'Failed to update invoice' }
  }

  // Update line items in invoice_items table
  if (items && items.length > 0) {
    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId).eq('org_id', orgId)

    const invoiceItemsToInsert = items.map((item) => ({
      invoice_id: invoiceId,
      org_id: orgId,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: Math.round(Number(item.quantity || 1) * Number(item.unit_price || 0) * 100) / 100
    }))

    const { data: newItems } = await supabase
      .from('invoice_items')
      .insert(invoiceItemsToInsert)
      .select('*')

    return { success: true, invoice: updatedInvoice, items: newItems || [] }
  }

  return { success: true, invoice: updatedInvoice, items: [] }
}

/**
 * Bridges a completed job into a draft invoice
 */
export async function convertJobToInvoice(
  supabase: SupabaseClient,
  input: { jobId: string; orgId: string; dueDate?: string; taxRate?: number; discountAmount?: number }
): Promise<{ success: boolean; invoice?: any; items?: any[]; error?: string }> {
  const { jobId, orgId, dueDate, taxRate = 0, discountAmount = 0 } = input

  // Guard against duplicate invoices for the same job
  let existingInvQuery: any = supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('job_id', jobId)
    .eq('org_id', orgId)

  if (typeof existingInvQuery?.is === 'function') {
    existingInvQuery = existingInvQuery.is('deleted_at', null)
  }

  const { data: existingInv } = await existingInvQuery.order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existingInv && !existingInv.deleted_at) {
    return { success: true, invoice: existingInv, items: existingInv.invoice_items || [] }
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*, job_items(*)')
    .eq('id', jobId)
    .eq('org_id', orgId)
    .single()

  if (jobError || !job) {
    return { success: false, error: jobError?.message || 'Job not found' }
  }

  const items: InvoiceItemInput[] = (job.job_items || []).map((ji: any) => ({
    description: ji.description,
    quantity: ji.quantity,
    unit_price: ji.unit_price
  }))

  return createInvoice(supabase, {
    orgId,
    contactId: job.contact_id,
    jobId: job.id,
    quoteId: job.quote_id || undefined,
    title: `Invoice for ${job.title}`,
    description: job.description,
    items: items.length > 0 ? items : [{ description: job.title, quantity: 1, unit_price: 0 }],
    taxRate,
    discountAmount,
    dueDate
  })
}

/**
 * Bridges an accepted quote into a draft invoice
 */
export async function convertQuoteToInvoice(
  supabase: SupabaseClient,
  input: { quoteId: string; orgId: string; dueDate?: string }
): Promise<{ success: boolean; invoice?: any; items?: any[]; error?: string }> {
  const { quoteId, orgId, dueDate } = input

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('*, quote_items(*)')
    .eq('id', quoteId)
    .eq('org_id', orgId)
    .single()

  if (quoteError || !quote) {
    return { success: false, error: quoteError?.message || 'Quote not found' }
  }

  if (quote.status !== 'accepted') {
    return { success: false, error: `Quote must be accepted before converting to invoice (current status: ${quote.status})` }
  }

  // Guard against duplicate invoices for the same quote
  let existingInvQuery: any = supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('quote_id', quoteId)
    .eq('org_id', orgId)

  if (typeof existingInvQuery?.is === 'function') {
    existingInvQuery = existingInvQuery.is('deleted_at', null)
  }

  const { data: existingInv } = await existingInvQuery.order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existingInv && !existingInv.deleted_at) {
    return { success: true, invoice: existingInv, items: existingInv.invoice_items || [] }
  }

  const items: InvoiceItemInput[] = (quote.quote_items || []).map((qi: any) => ({
    description: qi.description,
    quantity: qi.quantity,
    unit_price: qi.unit_price
  }))

  return createInvoice(supabase, {
    orgId,
    contactId: quote.contact_id,
    quoteId: quote.id,
    title: `Invoice: ${quote.title}`,
    description: quote.description,
    items,
    discountAmount: quote.discount,
    dueDate
  })
}

/**
 * Sends invoice to customer via Telnyx SMS and generates Stripe payment link
 */
export async function sendInvoice(
  supabase: SupabaseClient,
  input: { invoiceId: string; orgId: string; baseUrl: string }
): Promise<{ success: boolean; invoice?: any; checkoutUrl?: string; error?: string; upgradeRequired?: boolean; code?: string }> {
  const { invoiceId, orgId, baseUrl } = input

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*, contacts(*), invoice_items(*)')
    .eq('id', invoiceId)
    .eq('org_id', orgId)
    .single()

  if (invoiceError || !invoice) {
    return { success: false, error: invoiceError?.message || 'Invoice not found' }
  }

  // P0 Financial Guard: Block sending deleted, voided, or already paid invoices
  if (invoice.deleted_at) {
    return { success: false, error: 'Cannot send a deleted invoice' }
  }

  if (invoice.status === 'void') {
    return { success: false, error: 'Cannot send a voided invoice' }
  }

  if (invoice.status === 'paid') {
    return { success: false, error: 'This invoice is already paid in full' }
  }

  // Finish-Line Sunk Cost Paywall Guard (Starter Pass: Job #4+)
  // Contractor can draft and view, but sending live invoice & collecting card payment gates at the finish line
  try {
    const { SubscriptionService } = await import('../billing/subscription-service.ts')
    const entitlement = await SubscriptionService.getEntitlement(supabase, orgId).catch(() => null)
    const isPaidPro = entitlement?.isEntitled && ['solo', 'multi_crew', 'fleet', 'captodesk_standard'].includes(entitlement?.planId || '')

    if (!isPaidPro) {
      const starterUsage = await SubscriptionService.getFreeTierJobUsage(supabase, orgId).catch(() => null)
      if (starterUsage?.isLimitReached) {
        let isHistoricalJob = false
        if (invoice.job_id) {
          const { data: linkedJob } = await supabase
            .from('jobs')
            .select('id, title, notes, job_number, status')
            .eq('id', invoice.job_id)
            .eq('org_id', orgId)
            .maybeSingle()

          if (linkedJob) {
            const { isPracticeJob } = await import('../jobs/practice-job.ts')
            if (isPracticeJob(linkedJob) || linkedJob.status === 'completed') {
              isHistoricalJob = true
            }
          }
        }

        if (!isHistoricalJob) {
          return {
            success: false,
            upgradeRequired: true,
            code: 'STARTER_LIMIT_REACHED',
            error: "You've completed your 3 free starter jobs. Upgrade to Pro ($99/mo) to send live customer invoices and collect card payments.",
            checkoutUrl: '/client/billing?reason=starter_limit',
            invoice
          }
        }
      }
    }
  } catch (entitlementErr) {
    console.warn('[INVOICE_SEND_ENTITLEMENT_CHECK_WARNING]', entitlementErr)
  }

  let contact = invoice.contacts
  if (!contact && invoice.contact_id) {
    const { data: c } = await supabase.from('contacts').select('*').eq('id', invoice.contact_id).single()
    contact = c
  }

  let org: any = null
  const { data: o } = await supabase.from('organizations').select('*').eq('id', orgId).single()
  org = o

  // 1. Generate Stripe Checkout Session / Payment Link
  const stripeResult = await createStripeCheckoutSession({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    orgId: invoice.org_id,
    contactId: invoice.contact_id,
    customerEmail: contact?.email || undefined,
    customerName: contact?.name || undefined,
    amountDue: Number(invoice.amount_due) || Number(invoice.total),
    title: invoice.title,
    manageToken: invoice.manage_token,
    baseUrl,
    items: invoice.invoice_items || []
  })

  // 2. Update invoice status
  const now = new Date().toISOString()
  const { data: updatedInvoice, error: updateError } = await supabase
    .from('invoices')
    .update({
      status: 'sent',
      sent_at: now,
      stripe_checkout_session_id: stripeResult.sessionId,
      stripe_payment_link_url: stripeResult.checkoutUrl,
      updated_at: now
    })
    .eq('id', invoice.id)
    .select('*')
    .single()

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // 3. Dispatch SMS with tokenized invoice link
  const safeBaseUrl = baseUrl.replace(/\/$/, '')
  const customerInvoiceUrl = `${safeBaseUrl}/invoice/${invoice.manage_token}`
  const businessName = org?.name || 'our team'
  const smsBody = `Hi ${contact?.name || 'there'}! Here is your invoice ${invoice.invoice_number} from ${businessName} for $${invoice.amount_due || invoice.total}. Pay securely online here: ${customerInvoiceUrl}`

  if (contact?.phone) {
    const senderPhone = resolveSenderPhone(org)
    const compliance = await verifyOutboundCompliance(supabase, {
      orgId,
      toPhone: contact.phone,
      fromPhone: senderPhone,
      flowType: 'invoice_sent',
      messageType: 'transactional',
      body: smsBody,
      contactId: contact.id
    })

    if (compliance.allowed) {
      await sendTelnyxSms({
        to: contact.phone,
        from: senderPhone,
        text: compliance.formattedText
      })

      await logComplianceAudit(supabase, {
        orgId,
        phone: contact.phone,
        contactId: contact.id,
        action: 'message_sent',
        messageType: 'transactional',
        reason: 'invoice_sent'
      })
    }
  }

  // 4. Schedule Day 3 & Day 7 Overdue Reminders
  await scheduleInvoiceOverdueReminders(supabase, {
    invoice: updatedInvoice,
    contact,
    org,
    customerInvoiceUrl
  })

  // 5. Emit typed domain event
  const event = createEventEnvelope('invoice.sent', orgId, {
    invoice_id: invoice.id,
    contact_id: invoice.contact_id,
    total: invoice.total,
    amount_due: invoice.amount_due,
    due_date: invoice.due_date
  }, {
    entityId: invoice.id,
    contactId: invoice.contact_id
  })
  await handleAutomationEvent(supabase, event)

  return {
    success: true,
    invoice: updatedInvoice,
    checkoutUrl: stripeResult.checkoutUrl
  }
}

/**
 * Schedules automated overdue follow-up SMS reminders in automation_runs
 */
async function scheduleInvoiceOverdueReminders(
  supabase: SupabaseClient,
  context: { invoice: any; contact: any; org: any; customerInvoiceUrl: string }
): Promise<void> {
  const { invoice, contact, org, customerInvoiceUrl } = context
  if (!contact?.phone) return

  const dueDateMs = new Date(invoice.due_date).getTime()
  const day3Ms = dueDateMs + 3 * 24 * 60 * 60 * 1000
  const day7Ms = dueDateMs + 7 * 24 * 60 * 60 * 1000

  const businessName = org?.name || 'our team'
  const overdue3Text = `Friendly reminder from ${businessName}: Invoice ${invoice.invoice_number} for $${invoice.amount_due} was due on ${new Date(invoice.due_date).toLocaleDateString()}. Please view and pay securely: ${customerInvoiceUrl}`
  const overdue7Text = `Final notice from ${businessName}: Invoice ${invoice.invoice_number} is past due ($${invoice.amount_due}). Please resolve your balance here: ${customerInvoiceUrl}`

  const runsToInsert = [
    {
      org_id: invoice.org_id,
      rule_id: '00000000-0000-0000-0000-000000000003', // System invoice overdue 3d
      job_id: `job_overdue_3d_${invoice.id}`,
      idempotency_key: `overdue_3d_${invoice.id}`,
      event_type: 'invoice.overdue',
      event_payload: {
        invoice_id: invoice.id,
        contact_id: contact.id,
        phone: contact.phone,
        message: overdue3Text,
        day: 3
      },
      action_type: 'send_sms',
      action_params: { to: contact.phone, text: overdue3Text },
      status: 'scheduled',
      scheduled_at: new Date(day3Ms).toISOString()
    },
    {
      org_id: invoice.org_id,
      rule_id: '00000000-0000-0000-0000-000000000007', // System invoice overdue 7d
      job_id: `job_overdue_7d_${invoice.id}`,
      idempotency_key: `overdue_7d_${invoice.id}`,
      event_type: 'invoice.overdue',
      event_payload: {
        invoice_id: invoice.id,
        contact_id: contact.id,
        phone: contact.phone,
        message: overdue7Text,
        day: 7
      },
      action_type: 'send_sms',
      action_params: { to: contact.phone, text: overdue7Text },
      status: 'scheduled',
      scheduled_at: new Date(day7Ms).toISOString()
    }
  ]

  await supabase.from('automation_runs').insert(runsToInsert)
}

/**
 * Records a payment against an invoice (from Stripe webhook or owner manual entry)
 */
export async function recordPayment(
  supabase: SupabaseClient,
  input: {
    invoiceId: string
    orgId: string
    amount: number
    paymentMethod: PaymentMethod
    paymentStatus?: PaymentStatus
    stripePaymentIntentId?: string
    stripeCheckoutSessionId?: string
    stripeReceiptUrl?: string
    referenceNote?: string
  }
): Promise<{ success: boolean; invoice?: any; payment?: any; error?: string }> {
  const {
    invoiceId,
    orgId,
    amount,
    paymentMethod,
    paymentStatus = 'succeeded',
    stripePaymentIntentId,
    stripeCheckoutSessionId,
    stripeReceiptUrl,
    referenceNote
  } = input

  if (!amount || Number(amount) <= 0) {
    return { success: false, error: 'Payment amount must be greater than zero' }
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*, contacts(*)')
    .eq('id', invoiceId)
    .eq('org_id', orgId)
    .single()

  if (invoiceError || !invoice) {
    return { success: false, error: invoiceError?.message || 'Invoice not found' }
  }

  // P0 Financial Guard: Block sending deleted, voided, or already paid invoices
  if (invoice.deleted_at) {
    return { success: false, error: 'Cannot send a deleted invoice' }
  }

  if (invoice.status === 'void') {
    return { success: false, error: 'Cannot send a voided invoice' }
  }

  if (invoice.status === 'paid') {
    return { success: false, error: 'This invoice is already paid in full' }
  }

  // 0. Idempotency check: Guard against duplicate Stripe webhook processing
  if (stripePaymentIntentId) {
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('org_id', orgId)
      .eq('stripe_payment_intent_id', stripePaymentIntentId)
      .maybeSingle()

    if (existingPayment) {
      return { success: true, invoice, payment: existingPayment }
    }
  } else if (stripeCheckoutSessionId) {
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('org_id', orgId)
      .eq('stripe_checkout_session_id', stripeCheckoutSessionId)
      .maybeSingle()

    if (existingPayment) {
      return { success: true, invoice, payment: existingPayment }
    }
  }

  // 1. Insert payment record
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      org_id: orgId,
      invoice_id: invoiceId,
      contact_id: invoice.contact_id,
      amount,
      currency: 'usd',
      payment_method: paymentMethod,
      status: paymentStatus,
      stripe_payment_intent_id: stripePaymentIntentId || null,
      stripe_checkout_session_id: stripeCheckoutSessionId || null,
      stripe_receipt_url: stripeReceiptUrl || null,
      reference_note: referenceNote || null
    })
    .select('*')
    .single()

  if (paymentError) {
    if (
      paymentError.code === '23505' ||
      paymentError.message?.toLowerCase().includes('unique') ||
      paymentError.message?.toLowerCase().includes('duplicate')
    ) {
      // Conflict resolution: Another thread or webhook inserted the payment concurrently
      const query = supabase.from('payments').select('*').eq('org_id', orgId)
      const { data: existingPayment } = stripePaymentIntentId
        ? await query.eq('stripe_payment_intent_id', stripePaymentIntentId).maybeSingle()
        : stripeCheckoutSessionId
        ? await query.eq('stripe_checkout_session_id', stripeCheckoutSessionId).maybeSingle()
        : await query.eq('invoice_id', invoiceId).maybeSingle()

      if (existingPayment) {
        return { success: true, invoice, payment: existingPayment }
      }
    }
    return { success: false, error: paymentError.message }
  }

  // 2. If succeeded, update invoice amount_paid, amount_due, and status
  let updatedInvoice = invoice
  if (paymentStatus === 'succeeded') {
    const currentPaid = Number(invoice.amount_paid) || 0
    const newAmountPaid = Math.round((currentPaid + amount) * 100) / 100
    const newAmountDue = Math.max(0, Math.round((Number(invoice.total) - newAmountPaid) * 100) / 100)
    const isPaidInFull = newAmountDue <= 0
    const newStatus: InvoiceStatus = isPaidInFull ? 'paid' : 'partially_paid'
    const now = new Date().toISOString()

    const { data: upd, error: updError } = await supabase
      .from('invoices')
      .update({
        amount_paid: newAmountPaid,
        amount_due: newAmountDue,
        status: newStatus,
        paid_at: isPaidInFull ? now : invoice.paid_at,
        updated_at: now
      })
      .eq('id', invoice.id)
      .select('*')
      .single()

    if (updError) {
      return { success: false, error: updError.message }
    }
    updatedInvoice = upd

    // 3. If paid in full, cancel all scheduled overdue reminders and emit invoice.paid
    if (isPaidInFull) {
      const paidEvent = createEventEnvelope('invoice.paid', orgId, {
        invoice_id: invoice.id,
        contact_id: invoice.contact_id,
        amount_paid: newAmountPaid,
        payment_method: paymentMethod,
        receipt_url: stripeReceiptUrl
      }, {
        entityId: invoice.id,
        contactId: invoice.contact_id
      })

      // Halt pending overdue automation runs atomically
      await evaluateAndApplyStopConditions(supabase, paidEvent)

      // Emit domain event for any listening services
      await handleAutomationEvent(supabase, paidEvent)

      // Automated 5-Star Google Review Trigger (15 minutes after full payment)
      await scheduleInvoiceReviewAutomation(supabase, {
        orgId: invoice.org_id,
        invoiceId: invoice.id,
        contactId: invoice.contact_id,
        delayMinutes: 15
      }).catch((err) => console.error('[INVOICE_REVIEW_AUTOMATION_ERROR]', err))

      // Instant Transactional Receipt SMS with link to official receipt
      let contact = invoice.contacts
      if (!contact && invoice.contact_id) {
        const { data: c } = await supabase.from('contacts').select('*').eq('id', invoice.contact_id).single()
        contact = c
      }

      if (contact?.phone) {
        const { data: org } = await supabase
          .from('organizations')
          .select('id, name, telnyx_phone_number, owner_phone')
          .eq('id', invoice.org_id)
          .maybeSingle()
        const senderPhone = resolveSenderPhone(org)

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.captodesk.com'
        const receiptUrl = invoice.manage_token ? `${baseUrl}/invoice/${invoice.manage_token}` : ''
        const rawReceiptText = receiptUrl
          ? `Thank you for your payment! Invoice ${invoice.invoice_number} ($${amount}) has been paid in full. View receipt: ${receiptUrl}`
          : `Thank you for your payment! Invoice ${invoice.invoice_number} ($${amount}) has been marked paid in full.`

        const compliance = await verifyOutboundCompliance(supabase, {
          orgId: invoice.org_id,
          toPhone: contact.phone,
          fromPhone: senderPhone,
          flowType: 'invoice_paid',
          messageType: 'transactional',
          body: rawReceiptText,
          contactId: contact.id
        })

        if (compliance.allowed) {
          await sendTelnyxSms({
            to: contact.phone,
            from: senderPhone,
            text: compliance.formattedText
          })
        }
      }
    }
  }

  return {
    success: true,
    invoice: updatedInvoice,
    payment
  }
}

/**
 * Retrieves invoice by public manage_token and marks as viewed upon first customer visit
 */
export async function customerViewInvoice(
  supabase: SupabaseClient,
  manageToken: string
): Promise<{ success: boolean; invoice?: any; items?: any[]; org?: any; jobPhotos?: any[]; error?: string }> {
  if (!manageToken || typeof manageToken !== 'string') {
    return { success: false, error: 'Invoice token is required' }
  }

  // 1. Safe query attempting relational embeds with schema-validated columns
  let { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select(`
      *,
      invoice_items(*),
      contacts(id, name, phone, email, address),
      organizations(id, name, owner_phone, timezone, external_payment_url, payment_instructions, industry, logo_url, address_street, address_city, address_state, address_postal_code)
    `)
    .eq('manage_token', manageToken.trim())
    .maybeSingle()

  // 2. Resilient fallback: If relational embed failed or returned null, query invoices table directly
  if (invoiceError || !invoice) {
    const { data: rawInvoice, error: rawError } = await supabase
      .from('invoices')
      .select('*')
      .eq('manage_token', manageToken.trim())
      .maybeSingle()

    if (rawError || !rawInvoice) {
      console.error('[customerViewInvoice] Failed to find invoice by token:', invoiceError || rawError)
      return { success: false, error: 'Invoice not found' }
    }
    invoice = rawInvoice
  }

  // 3. Organization resolution with fallback
  let org = invoice.organizations
  if (!org && invoice.org_id) {
    const { data: o, error: oErr } = await supabase
      .from('organizations')
      .select('id, name, owner_phone, timezone, external_payment_url, payment_instructions, industry, logo_url, address_street, address_city, address_state, address_postal_code')
      .eq('id', invoice.org_id)
      .maybeSingle()

    if (oErr || !o) {
      const { data: fallbackOrg } = await supabase
        .from('organizations')
        .select('id, name, owner_phone, timezone')
        .eq('id', invoice.org_id)
        .maybeSingle()
      org = fallbackOrg || null
    } else {
      org = o
    }
  }

  // 4. Contact resolution with fallback & address compatibility
  let contact = invoice.contacts
  if (!contact && invoice.contact_id) {
    const { data: fetchedContact } = await supabase
      .from('contacts')
      .select('id, name, phone, email, address')
      .eq('id', invoice.contact_id)
      .maybeSingle()
    if (fetchedContact) {
      contact = fetchedContact
    }
  }

  if (contact) {
    // Normalization: provide both address and address_street for UI backwards compatibility
    if (contact.address && !contact.address_street) {
      contact.address_street = contact.address
    }
    invoice.contacts = contact
  }

  // 5. Invoice items resolution with fallback
  let items = invoice.invoice_items
  if (!items || items.length === 0) {
    const { data: fetchedItems } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
    if (fetchedItems && fetchedItems.length > 0) {
      items = fetchedItems
    } else if (Array.isArray(invoice.items) && invoice.items.length > 0) {
      items = invoice.items
    } else {
      items = []
    }
  }

  // Update status to viewed if currently sent
  if (invoice.status === 'sent') {
    const now = new Date().toISOString()
    await supabase
      .from('invoices')
      .update({ status: 'viewed', viewed_at: now, updated_at: now })
      .eq('id', invoice.id)
    invoice.status = 'viewed'
    invoice.viewed_at = now
  }

  // Fetch job photos (Before & After proof of work) if linked to a job
  let jobPhotos: any[] = []
  if (invoice.job_id) {
    try {
      const { data: photos } = await supabase
        .from('job_photos')
        .select('*')
        .eq('job_id', invoice.job_id)
        .order('created_at', { ascending: true })
      jobPhotos = photos || []
    } catch {
      // Non-fatal if job_photos table is omitted in older schemas
    }
  }

  return {
    success: true,
    invoice,
    items,
    org,
    jobPhotos
  }
}

/**
 * Voids an invoice and halts any scheduled reminders
 */
export async function voidInvoice(
  supabase: SupabaseClient,
  input: { invoiceId: string; orgId: string; reason?: string }
): Promise<{ success: boolean; invoice?: any; error?: string }> {
  const { invoiceId, orgId, reason } = input

  // P0 Guard: Verify invoice exists and has not received payments
  const { data: existing, error: findError } = await supabase
    .from('invoices')
    .select('id, status, amount_paid')
    .eq('id', invoiceId)
    .eq('org_id', orgId)
    .single()

  if (findError || !existing) {
    return { success: false, error: 'Invoice not found' }
  }

  if (existing.status === 'paid' || Number(existing.amount_paid) > 0) {
    return {
      success: false,
      error: 'Cannot void an invoice that has received payments. Issue a refund or credit memo instead.'
    }
  }

  if (existing.status === 'void') {
    return { success: false, error: 'Invoice is already voided' }
  }

  const now = new Date().toISOString()
  const { data: invoice, error: updateError } = await supabase
    .from('invoices')
    .update({
      status: 'void',
      notes: reason ? `Voided: ${reason}` : 'Voided',
      updated_at: now
    })
    .eq('id', invoiceId)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (updateError || !invoice) {
    return { success: false, error: updateError?.message || 'Invoice not found' }
  }

  // Cancel any pending automation runs
  await supabase
    .from('automation_runs')
    .update({ status: 'cancelled' })
    .eq('org_id', orgId)
    .in('status', ['pending', 'scheduled'])
    .like('job_id', `%_${invoiceId}`)

  return { success: true, invoice }
}

/**
 * Safely soft-deletes an invoice without destroying financial audit logs or payments.
 */
export async function softDeleteInvoice(
  supabase: SupabaseClient,
  input: { orgId: string; invoiceId: string }
): Promise<{ success: boolean; error?: string }> {
  // P0 Guard: Invoices with recorded payments cannot be soft-deleted (violates financial auditability)
  const { data: existing, error: findError } = await supabase
    .from('invoices')
    .select('id, status, amount_paid')
    .eq('id', input.invoiceId)
    .eq('org_id', input.orgId)
    .single()

  if (findError || !existing) {
    return { success: false, error: 'Invoice not found' }
  }

  if (existing.status === 'paid' || Number(existing.amount_paid) > 0) {
    return {
      success: false,
      error: 'Cannot delete an invoice that has received payments. Paid invoices must be preserved for tax and audit compliance.'
    }
  }

  const { error } = await supabase
    .from('invoices')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', input.invoiceId)
    .eq('org_id', input.orgId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Cancel pending automation reminders upon deletion so customer does not get overdue SMS
  await supabase
    .from('automation_runs')
    .update({ status: 'cancelled' })
    .eq('org_id', input.orgId)
    .in('status', ['pending', 'scheduled'])
    .like('job_id', `%_${input.invoiceId}`)

  return { success: true }
}

/**
 * Restores a soft-deleted invoice.
 */
export async function restoreInvoice(
  supabase: SupabaseClient,
  input: { orgId: string; invoiceId: string }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('invoices')
    .update({
      deleted_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.invoiceId)
    .eq('org_id', input.orgId)

  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

