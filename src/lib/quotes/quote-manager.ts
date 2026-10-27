import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTelnyxSms } from '../telnyx.ts'
import { createEventEnvelope } from '../automations/events.ts'
import { handleAutomationEvent } from '../automations/engine.ts'
import { evaluateAndApplyStopConditions } from '../automations/stop-conditions.ts'
import {
  verifyOutboundCompliance,
  formatCompliantOutboundText,
  recordConsent,
  logComplianceAudit
} from '../compliance/compliance-engine.ts'
import { generateDocumentNumber } from '../services/document-counter.ts'

export interface QuoteLineItemInput {
  description: string
  quantity: number
  unit_price: number
}

export interface CreateQuoteInput {
  orgId: string
  contactId: string
  leadId?: string
  title: string
  description?: string
  items: QuoteLineItemInput[]
  taxRate?: number // e.g. 0.0825
  discount?: number
  expiresInDays?: number // default: 14 days
  notes?: string
  requiresDeposit?: boolean
  depositType?: 'percentage' | 'fixed'
  depositValue?: number
}

export interface QuoteResult {
  success: boolean
  quote?: any
  items?: any[]
  manageToken?: string
  manageUrl?: string
  error?: string
}

/**
 * Calculates subtotal, tax, and grand total from line items
 */
export function calculateQuoteFinancials(
  items: QuoteLineItemInput[],
  options: { taxRate?: number; discount?: number } = {}
) {
  const lineItems = items.map((item) => {
    const qty = Number(item.quantity) || 1
    const price = Number(item.unit_price) || 0
    const total = Math.round(qty * price * 100) / 100
    return {
      description: item.description.trim(),
      quantity: qty,
      unit_price: price,
      total
    }
  })

  const subtotal = lineItems.reduce((acc, it) => acc + it.total, 0)
  const discount = Math.max(0, Number(options.discount) || 0)
  const taxableAmount = Math.max(0, subtotal - discount)
  const taxRate = Number(options.taxRate) || 0
  const tax = Math.round(taxableAmount * taxRate * 100) / 100
  const grandTotal = Math.max(0, Math.round((subtotal - discount + tax) * 100) / 100)

  return {
    lineItems,
    subtotal: Math.round(subtotal * 100) / 100,
    tax,
    discount,
    total: grandTotal
  }
}

/**
 * Creates a new quote and its associated line items
 */
export async function createQuote(
  supabase: SupabaseClient,
  input: CreateQuoteInput,
  appBaseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com'
): Promise<QuoteResult> {
  const { orgId, contactId, leadId, title, description, items, taxRate, discount, expiresInDays = 14, notes } = input

  if (!items || items.length === 0) {
    return { success: false, error: 'Quote must include at least one line item' }
  }

  const financials = calculateQuoteFinancials(items, { taxRate, discount })
  const quoteNumber = await generateDocumentNumber(supabase, orgId, 'quote')
  const manageToken = randomBytes(24).toString('hex')
  const manageUrl = `${appBaseUrl}/quote/${manageToken}`
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()

  let depositAmount = 0
  if (input.requiresDeposit) {
    const val = Number(input.depositValue) || 0
    if (input.depositType === 'percentage') {
      const pct = Math.min(100, Math.max(1, val || 20))
      depositAmount = Math.round(((financials.total * pct) / 100) * 100) / 100
    } else {
      depositAmount = Math.min(financials.total, Math.max(1, val))
    }
  }

  // 1. Transactional creation via PostgreSQL RPC if supported
  const clientWithRpc = supabase as unknown as {
    rpc?: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
  }

  const itemsPayload = financials.lineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: item.total
  }))

  if (typeof clientWithRpc?.rpc === 'function') {
    try {
      const { data: rpcData, error: rpcError } = await clientWithRpc.rpc('create_quote_with_items', {
        p_org_id: orgId,
        p_contact_id: contactId,
        p_lead_id: leadId || null,
        p_quote_number: quoteNumber,
        p_title: title.trim(),
        p_description: description?.trim() || null,
        p_subtotal: financials.subtotal,
        p_tax: financials.tax,
        p_discount: financials.discount,
        p_total: financials.total,
        p_expires_at: expiresAt,
        p_manage_token: manageToken,
        p_notes: notes?.trim() || null,
        p_items: itemsPayload
      })

      if (!rpcError && rpcData && typeof rpcData === 'object') {
        const parsed = rpcData as { quote: any; items: any[] }
        if (parsed.quote) {
          return {
            success: true,
            quote: parsed.quote,
            items: parsed.items || [],
            manageToken,
            manageUrl
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
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      org_id: orgId,
      contact_id: contactId,
      lead_id: leadId || null,
      quote_number: quoteNumber,
      title: title.trim(),
      description: description?.trim() || null,
      subtotal: financials.subtotal,
      tax: financials.tax,
      discount: financials.discount,
      total: financials.total,
      status: 'draft',
      expires_at: expiresAt,
      manage_token: manageToken,
      requires_deposit: !!input.requiresDeposit,
      deposit_type: input.depositType || (input.requiresDeposit ? 'percentage' : null),
      deposit_value: Number(input.depositValue) || 0,
      deposit_amount: depositAmount,
      deposit_paid: false,
      notes: notes?.trim() || null
    })
    .select('*')
    .single()

  if (quoteError || !quote) {
    return { success: false, error: quoteError?.message || 'Failed to create quote' }
  }

  const itemsToInsert = financials.lineItems.map((item) => ({
    quote_id: quote.id,
    org_id: orgId,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: item.total
  }))

  const { data: insertedItems, error: itemsError } = await supabase
    .from('quote_items')
    .insert(itemsToInsert)
    .select('*')

  if (itemsError) {
    // Atomic rollback: clean up orphaned parent quote immediately
    await supabase.from('quotes').delete().eq('id', quote.id)
    return { success: false, error: itemsError.message }
  }

  return {
    success: true,
    quote,
    items: insertedItems || [],
    manageToken,
    manageUrl
  }
}

/**
 * Dispatches a quote via SMS and schedules automated follow-ups (2-day and 5-day)
 */
export async function sendQuote(
  supabase: SupabaseClient,
  quoteId: string,
  orgId: string,
  appBaseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com'
): Promise<{ success: boolean; quote?: any; error?: string }> {
  // 1. Fetch Quote
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('org_id', orgId)
    .single()

  if (quoteError || !quote) {
    return { success: false, error: 'Quote not found' }
  }

  // 2. Fetch Organization & Contact
  const { data: org } = await supabase
    .from('organizations')
    .select('name, telnyx_phone_number, owner_phone')
    .eq('id', orgId)
    .single()

  const { data: contact } = await supabase
    .from('contacts')
    .select('name, phone')
    .eq('id', quote.contact_id)
    .single()

  if (!contact?.phone) {
    return { success: false, error: 'Customer phone number not available' }
  }

  const senderNumber = org?.telnyx_phone_number || org?.owner_phone
  const manageUrl = `${appBaseUrl}/quote/${quote.manage_token}`

  // 3. Update Quote to 'sent'
  const { data: updatedQuote, error: updateError } = await supabase
    .from('quotes')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', quote.id)
    .select('*')
    .single()

  if (updateError || !updatedQuote) {
    return { success: false, error: 'Failed to update quote status' }
  }

  // 4. Record Consent & Send Initial Quote SMS
  await recordConsent(supabase, {
    orgId,
    phone: contact.phone,
    contactId: quote.contact_id,
    consentType: 'transactional',
    source: 'quote_request',
    proofText: `Generated estimate #${quote.quote_number}`
  })

  if (senderNumber) {
    const rawText = `Hi ${contact.name || 'there'}! Here is your estimate #${quote.quote_number} from ${org?.name || 'us'} for $${quote.total.toFixed(2)}. Review and accept online: ${manageUrl}`
    const compliance = await verifyOutboundCompliance(supabase, {
      orgId,
      toPhone: contact.phone,
      fromPhone: senderNumber,
      flowType: 'quote_sent',
      messageType: 'transactional',
      body: rawText,
      contactId: quote.contact_id
    })

    if (compliance.allowed) {
      await sendTelnyxSms({
        to: contact.phone,
        from: senderNumber,
        text: compliance.formattedText
      })

      await logComplianceAudit(supabase, {
        orgId,
        phone: contact.phone,
        contactId: quote.contact_id,
        action: 'message_sent',
        messageType: 'transactional',
        reason: 'quote_sent'
      })
    }
  }

  // 5. Emit quote.sent Domain Event
  await handleAutomationEvent(
    supabase,
    createEventEnvelope('quote.sent', orgId, {
      quote_id: quote.id,
      quote_number: quote.quote_number,
      total: quote.total,
      contact_id: quote.contact_id,
      lead_id: quote.lead_id
    }, {
      entityId: quote.id,
      contactId: quote.contact_id,
      leadId: quote.lead_id || undefined
    })
  )

  // 6. Schedule Automated Follow-Up Sequences (2-Day & 5-Day)
  if (senderNumber) {
    await scheduleQuoteFollowUps(supabase, {
      quoteId: quote.id,
      orgId,
      orgName: org?.name || 'CaptoDesk',
      quoteNumber: quote.quote_number,
      total: quote.total,
      customerPhone: contact.phone,
      customerName: contact.name || '',
      senderNumber,
      manageUrl
    })
  }

  return { success: true, quote: updatedQuote }
}

/**
 * Schedules 2-day and 5-day automated follow-up sequences for sent quotes
 */
export async function scheduleQuoteFollowUps(
  supabase: SupabaseClient,
  details: {
    quoteId: string
    orgId: string
    orgName: string
    quoteNumber: string
    total: number
    customerPhone: string
    customerName: string
    senderNumber: string
    manageUrl: string
  }
) {
  const { quoteId, orgId, orgName, quoteNumber, total, customerPhone, customerName, senderNumber, manageUrl } = details
  const nowMs = Date.now()

  // 1. Follow-up 1 (2 Days Later - Marketing)
  const fu1Key = `quote_fu1_${quoteId}`
  const { data: existingFu1 } = await supabase
    .from('automation_runs')
    .select('id')
    .eq('org_id', orgId)
    .eq('idempotency_key', fu1Key)
    .maybeSingle()

  if (!existingFu1) {
    const fu1Time = new Date(nowMs + 2 * 24 * 60 * 60 * 1000).toISOString()
    const rawTextFu1 = `Hi ${customerName || 'there'}, just following up on your estimate #${quoteNumber} from ${orgName} ($${total.toFixed(2)}). Let us know if you have any questions or review here: ${manageUrl}`
    const textFu1 = formatCompliantOutboundText({
      businessName: orgName,
      text: rawTextFu1,
      messageType: 'marketing'
    })

    await supabase.from('automation_runs').insert({
      org_id: orgId,
      job_id: `job_${fu1Key}`,
      idempotency_key: fu1Key,
      event_type: 'quote.sent',
      action_type: 'send_sms',
      action_params: {
        to: customerPhone,
        from: senderNumber,
        text: textFu1,
        flowType: 'quote_follow_up',
        messageType: 'marketing'
      },
      status: 'scheduled',
      scheduled_at: fu1Time,
      event_payload: {
        quote_id: quoteId,
        step: 1
      }
    })
  }

  // 2. Follow-up 2 (5 Days Later - Marketing)
  const fu2Key = `quote_fu2_${quoteId}`
  const { data: existingFu2 } = await supabase
    .from('automation_runs')
    .select('id')
    .eq('org_id', orgId)
    .eq('idempotency_key', fu2Key)
    .maybeSingle()

  if (!existingFu2) {
    const fu2Time = new Date(nowMs + 5 * 24 * 60 * 60 * 1000).toISOString()
    const rawTextFu2 = `Hi ${customerName || 'there'}, friendly reminder that your estimate #${quoteNumber} from ${orgName} is awaiting your review. Check details or accept here: ${manageUrl}`
    const textFu2 = formatCompliantOutboundText({
      businessName: orgName,
      text: rawTextFu2,
      messageType: 'marketing'
    })

    await supabase.from('automation_runs').insert({
      org_id: orgId,
      job_id: `job_${fu2Key}`,
      idempotency_key: fu2Key,
      event_type: 'quote.sent',
      action_type: 'send_sms',
      action_params: {
        to: customerPhone,
        from: senderNumber,
        text: textFu2,
        flowType: 'quote_follow_up',
        messageType: 'marketing'
      },
      status: 'scheduled',
      scheduled_at: fu2Time,
      event_payload: {
        quote_id: quoteId,
        step: 2
      }
    })
  }
}

/**
 * Customer views quote via tokenized public link.
 * Updates status to 'viewed' if previously 'sent' and emits quote.viewed event.
 */
export async function customerViewQuote(
  supabase: SupabaseClient,
  manageToken: string
): Promise<{ success: boolean; quote?: any; items?: any[]; organization?: any; contact?: any; error?: string }> {
  const { data: quote, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('manage_token', manageToken)
    .maybeSingle()

  if (error || !quote) {
    return { success: false, error: 'Quote not found' }
  }

  // Load Line Items
  const { data: items } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', quote.id)

  // Load Organization
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, owner_phone, telnyx_phone_number, timezone')
    .eq('id', quote.org_id)
    .single()

  // Load Contact
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, name, phone, email, address')
    .eq('id', quote.contact_id)
    .single()

  // If status is 'sent', transition to 'viewed'
  let currentQuote = quote
  if (quote.status === 'sent') {
    const { data: updated } = await supabase
      .from('quotes')
      .update({
        status: 'viewed',
        viewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', quote.id)
      .select('*')
      .single()

    if (updated) {
      currentQuote = updated
      // Emit quote.viewed
      await handleAutomationEvent(
        supabase,
        createEventEnvelope('quote.viewed', quote.org_id, {
          quote_id: quote.id,
          quote_number: quote.quote_number,
          contact_id: quote.contact_id
        }, {
          entityId: quote.id,
          contactId: quote.contact_id
        })
      )
    }
  }

  let depositInvoiceToken: string | null = null
  if (currentQuote.deposit_invoice_id) {
    const { data: depInv } = await supabase
      .from('invoices')
      .select('manage_token')
      .eq('id', currentQuote.deposit_invoice_id)
      .maybeSingle()
    if (depInv?.manage_token) {
      depositInvoiceToken = depInv.manage_token
    }
  }

  return {
    success: true,
    quote: {
      ...currentQuote,
      deposit_invoice_token: depositInvoiceToken
    },
    items: items || [],
    organization: org,
    contact
  }
}

/**
 * Customer accepts quote.
 * Updates status to 'accepted', halts all pending follow-up runs, and sends SMS confirmation.
 */
export async function customerAcceptQuote(
  supabase: SupabaseClient,
  manageToken: string,
  customerName?: string,
  signatureData?: string,
  clientIp?: string
): Promise<{
  success: boolean
  quote?: any
  job?: any
  error?: string
  requiresDeposit?: boolean
  depositAmount?: number
  depositInvoiceUrl?: string
}> {
  const { data: quote, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('manage_token', manageToken)
    .maybeSingle()

  if (error || !quote) {
    return { success: false, error: 'Quote not found' }
  }

  if (quote.status === 'accepted') {
    return { success: true, quote }
  }

  if (quote.status === 'declined' || quote.status === 'expired') {
    return { success: false, error: `Quote is already ${quote.status}` }
  }

  // 1. Update Quote to 'accepted' with electronic signature metadata
  const updatePayload: Record<string, any> = {
    status: 'accepted',
    accepted_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  if (customerName) updatePayload.signed_by = customerName.trim()
  if (signatureData) updatePayload.signature_data = signatureData.trim()
  if (clientIp) updatePayload.signed_ip = clientIp.trim()

  let { data: updatedQuote, error: updateError } = await supabase
    .from('quotes')
    .update(updatePayload)
    .eq('id', quote.id)
    .select('*')
    .single()

  // Graceful fallback if signature columns do not exist in older remote schema
  if (updateError && (updateError.code === '42703' || updateError.message?.toLowerCase().includes('does not exist'))) {
    const fallbackRes = await supabase
      .from('quotes')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', quote.id)
      .select('*')
      .single()
    updatedQuote = fallbackRes.data
    updateError = fallbackRes.error
  }

  if (updateError || !updatedQuote) {
    return { success: false, error: 'Failed to accept quote' }
  }

  // 2. Halt all scheduled follow-ups via stop condition
  await evaluateAndApplyStopConditions(
    supabase,
    createEventEnvelope('quote.accepted', quote.org_id, {
      quote_id: quote.id,
      contact_id: quote.contact_id,
      lead_id: quote.lead_id,
      accepted_by: customerName
    }, {
      entityId: quote.id,
      contactId: quote.contact_id,
      leadId: quote.lead_id || undefined
    })
  )

  // 3. Upfront Deposit Generation & Resolution
  let depositInvoiceUrl: string | undefined
  if (quote.requires_deposit && Number(quote.deposit_amount) > 0) {
    let depositInvoiceId = quote.deposit_invoice_id
    let depositManageToken: string | undefined

    if (depositInvoiceId) {
      const { data: existingInv } = await supabase
        .from('invoices')
        .select('id, manage_token')
        .eq('id', depositInvoiceId)
        .maybeSingle()
      if (existingInv) {
        depositManageToken = existingInv.manage_token
      }
    }

    if (!depositManageToken) {
      const { createInvoice } = await import('../payments/invoice-manager.ts')
      const invRes = await createInvoice(supabase, {
        orgId: quote.org_id,
        contactId: quote.contact_id,
        quoteId: quote.id,
        title: `Upfront Deposit for Estimate #${quote.quote_number}`,
        description: `Initial deposit payment for estimate #${quote.quote_number}`,
        items: [
          {
            description: `Initial Service Deposit (${quote.deposit_type === 'percentage' ? `${quote.deposit_value}%` : `$${quote.deposit_value}`})`,
            quantity: 1,
            unit_price: Number(quote.deposit_amount)
          }
        ],
        dueDate: new Date().toISOString()
      })

      if (invRes.success && invRes.invoice) {
        depositInvoiceId = invRes.invoice.id
        depositManageToken = invRes.invoice.manage_token
        await supabase
          .from('quotes')
          .update({ deposit_invoice_id: depositInvoiceId })
          .eq('id', quote.id)
      }
    }

    if (depositManageToken) {
      depositInvoiceUrl = `/invoice/${depositManageToken}`
    }
  }

  // 4. Send SMS confirmation to customer
  const { data: org } = await supabase
    .from('organizations')
    .select('name, telnyx_phone_number, owner_phone')
    .eq('id', quote.org_id)
    .single()

  const { data: contact } = await supabase
    .from('contacts')
    .select('name, phone')
    .eq('id', quote.contact_id)
    .single()

  const senderNumber = org?.telnyx_phone_number || org?.owner_phone
  if (senderNumber && contact?.phone) {
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://captodesk.com').replace(/\/$/, '')
    const depositPrompt = depositInvoiceUrl
      ? ` Please secure your scheduled slot by completing your deposit of $${Number(quote.deposit_amount).toFixed(2)}: ${baseUrl}${depositInvoiceUrl}`
      : ' We will reach out shortly to confirm your scheduled service.'
    const rawText = `Thank you ${contact.name || ''}! Your acceptance of estimate #${quote.quote_number} ($${quote.total.toFixed(2)}) is confirmed.${depositPrompt}`
    const compliance = await verifyOutboundCompliance(supabase, {
      orgId: quote.org_id,
      toPhone: contact.phone,
      fromPhone: senderNumber,
      flowType: 'quote_accepted',
      messageType: 'transactional',
      body: rawText,
      contactId: quote.contact_id
    })

    if (compliance.allowed) {
      await sendTelnyxSms({
        to: contact.phone,
        from: senderNumber,
        text: compliance.formattedText
      })
    }
  }

  // 5. Notify Owner
  const depositNotifPart = quote.requires_deposit && Number(quote.deposit_amount) > 0
    ? ` (Deposit Required: $${Number(quote.deposit_amount).toFixed(2)})`
    : ''

  await supabase.from('notifications').insert({
    org_id: quote.org_id,
    title: 'Quote Accepted!',
    message: `${contact?.name || 'Customer'} accepted estimate #${quote.quote_number} for $${quote.total.toFixed(2)}${depositNotifPart}`,
    link: '/client/quotes'
  })

  // 6. Quote-to-Job Continuity: Check for active job or auto-create field execution record
  let linkedJob: any = null
  try {
    const activeStatuses = ['scheduled', 'confirmed', 'en_route', 'in_progress']

    // 6a. Check if active job already explicitly references this quote
    let quoteJobQuery: any = supabase
      .from('jobs')
      .select('*')
      .eq('org_id', quote.org_id)
      .eq('quote_id', quote.id)

    if (typeof quoteJobQuery?.is === 'function') {
      quoteJobQuery = quoteJobQuery.is('deleted_at', null)
    }

    const { data: rawQuoteJob } = await quoteJobQuery
      .in('status', activeStatuses)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const existingQuoteJob = (rawQuoteJob && !rawQuoteJob.deleted_at) ? rawQuoteJob : null

    if (existingQuoteJob) {
      linkedJob = existingQuoteJob
    } else {
      // 6b. Check if an active open job exists for this lead (if lead exists)
      let candidateJob: any = null
      if (quote.lead_id) {
        let leadJobQuery: any = supabase
          .from('jobs')
          .select('*')
          .eq('org_id', quote.org_id)
          .eq('lead_id', quote.lead_id)

        if (typeof leadJobQuery?.is === 'function') {
          leadJobQuery = leadJobQuery.is('deleted_at', null)
        }

        const { data: rawLeadJob } = await leadJobQuery
          .in('status', activeStatuses)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (rawLeadJob && !rawLeadJob.deleted_at) candidateJob = rawLeadJob
      }

      // 6c. Check if an active open job exists for this contact without an assigned quote
      if (!candidateJob && quote.contact_id) {
        let contactJobQuery: any = supabase
          .from('jobs')
          .select('*')
          .eq('org_id', quote.org_id)
          .eq('contact_id', quote.contact_id)

        if (typeof contactJobQuery?.is === 'function') {
          contactJobQuery = contactJobQuery.is('quote_id', null).is('deleted_at', null)
        }

        const { data: rawContactJob } = await contactJobQuery
          .in('status', activeStatuses)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (rawContactJob && !rawContactJob.quote_id && !rawContactJob.deleted_at) {
          candidateJob = rawContactJob
        }
      }

      if (candidateJob) {
        // Update existing open job with quote reference and acceptance note
        const acceptanceNote = `Accepted Estimate #${quote.quote_number} ($${Number(quote.total).toFixed(2)})`
        const mergedNotes = candidateJob.notes ? `${candidateJob.notes}\n${acceptanceNote}` : acceptanceNote
        const { data: updatedExistingJob } = await supabase
          .from('jobs')
          .update({
            quote_id: quote.id,
            notes: mergedNotes,
            updated_at: new Date().toISOString()
          })
          .eq('id', candidateJob.id)
          .select('*')
          .maybeSingle()

        linkedJob = updatedExistingJob || candidateJob
      } else {
        // 6d. No active job exists: Automatically create a linked job from the accepted quote
        // Check if an open appointment exists for this contact to sync schedule & appointment_id
        const { data: openAppt } = await supabase
          .from('appointments')
          .select('id, start_time, end_time')
          .eq('org_id', quote.org_id)
          .eq('contact_id', quote.contact_id)
          .in('status', ['requested', 'scheduled', 'confirmed'])
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle()

        // Fetch quote line items
        const { data: quoteItems } = await supabase
          .from('quote_items')
          .select('*')
          .eq('quote_id', quote.id)

        const jobItems = (quoteItems || []).map((it: any) => ({
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price
        }))

        const { createJob } = await import('../jobs/job-manager.ts')
        const jobResult = await createJob(supabase, {
          orgId: quote.org_id,
          contactId: quote.contact_id,
          leadId: quote.lead_id || undefined,
          quoteId: quote.id,
          appointmentId: openAppt?.id || undefined,
          title: quote.title || `Service for Quote #${quote.quote_number}`,
          description: quote.description || undefined,
          scheduledStart: openAppt?.start_time || new Date().toISOString(),
          scheduledEnd: openAppt?.end_time || undefined,
          items: jobItems,
          notes: (quote.notes ? `${quote.notes}\n` : '') + `Auto-created from accepted Estimate #${quote.quote_number} ($${Number(quote.total).toFixed(2)})`
        })

        if (jobResult.success && jobResult.job) {
          linkedJob = jobResult.job

          // If linked to an open appointment, synchronize appointment to confirmed
          if (openAppt?.id) {
            await supabase
              .from('appointments')
              .update({
                status: 'confirmed',
                confirmed_at: new Date().toISOString()
              })
              .eq('id', openAppt.id)
              .eq('org_id', quote.org_id)
          }
        }
      }
    }
  } catch (jobLinkErr) {
    console.warn('[QUOTE_TO_JOB_CONTINUITY_WARNING] Failed to link or create job:', jobLinkErr)
  }

  return {
    success: true,
    quote: updatedQuote,
    job: linkedJob,
    requiresDeposit: !!quote.requires_deposit,
    depositAmount: quote.deposit_amount,
    depositInvoiceUrl
  }
}

/**
 * Customer declines quote.
 * Updates status to 'declined', records reason, and halts all scheduled follow-up jobs.
 */
export async function customerDeclineQuote(
  supabase: SupabaseClient,
  manageToken: string,
  reason?: string
): Promise<{ success: boolean; quote?: any; error?: string }> {
  const { data: quote, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('manage_token', manageToken)
    .maybeSingle()

  if (error || !quote) {
    return { success: false, error: 'Quote not found' }
  }

  const { data: updatedQuote, error: updateError } = await supabase
    .from('quotes')
    .update({
      status: 'declined',
      declined_at: new Date().toISOString(),
      decline_reason: reason || 'Declined by customer',
      updated_at: new Date().toISOString()
    })
    .eq('id', quote.id)
    .select('*')
    .single()

  if (updateError || !updatedQuote) {
    return { success: false, error: 'Failed to decline quote' }
  }

  // Halt all scheduled follow-ups
  await evaluateAndApplyStopConditions(
    supabase,
    createEventEnvelope('quote.declined', quote.org_id, {
      quote_id: quote.id,
      contact_id: quote.contact_id,
      reason
    }, {
      entityId: quote.id,
      contactId: quote.contact_id
    })
  )

  // Notify Owner
  await supabase.from('notifications').insert({
    org_id: quote.org_id,
    title: 'Quote Declined',
    message: `Estimate #${quote.quote_number} was declined${reason ? `: ${reason}` : ''}`,
    link: '/client/quotes'
  })

  return { success: true, quote: updatedQuote }
}

/**
 * Safely soft-deletes a quote without destroying financial records or line items.
 */
export async function softDeleteQuote(
  supabase: SupabaseClient,
  input: { orgId: string; quoteId: string }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('quotes')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', input.quoteId)
    .eq('org_id', input.orgId)

  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

/**
 * Restores a soft-deleted quote.
 */
export async function restoreQuote(
  supabase: SupabaseClient,
  input: { orgId: string; quoteId: string }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('quotes')
    .update({
      deleted_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.quoteId)
    .eq('org_id', input.orgId)

  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

