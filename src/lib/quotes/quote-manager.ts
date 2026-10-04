import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTelnyxSms } from '../telnyx.ts'
import { createEventEnvelope } from '../automations/events.ts'
import { handleAutomationEvent } from '../automations/engine.ts'
import { evaluateAndApplyStopConditions } from '../automations/stop-conditions.ts'

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
  const quoteNumber = `QT-${Date.now().toString().slice(-6)}`
  const manageToken = randomBytes(24).toString('hex')
  const manageUrl = `${appBaseUrl}/quote/${manageToken}`
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()

  // 1. Insert Quote Record
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
      notes: notes?.trim() || null
    })
    .select('*')
    .single()

  if (quoteError || !quote) {
    return { success: false, error: quoteError?.message || 'Failed to create quote' }
  }

  // 2. Insert Line Items
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

  // 4. Send Initial Quote SMS
  if (senderNumber) {
    const text = `Hi ${contact.name || 'there'}! Here is your estimate #${quote.quote_number} from ${org?.name || 'us'} for $${quote.total.toFixed(2)}. Review and accept online: ${manageUrl}`
    await sendTelnyxSms({
      to: contact.phone,
      from: senderNumber,
      text
    })
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
  await scheduleQuoteFollowUps(supabase, {
    quoteId: quote.id,
    orgId,
    orgName: org?.name || 'CaptoDesk',
    quoteNumber: quote.quote_number,
    total: quote.total,
    customerPhone: contact.phone,
    customerName: contact.name || '',
    senderNumber: senderNumber || '+15555550100',
    manageUrl
  })

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

  // 1. Follow-up 1 (2 Days Later)
  const fu1Time = new Date(nowMs + 2 * 24 * 60 * 60 * 1000).toISOString()
  const textFu1 = `Hi ${customerName || 'there'}, just following up on your estimate #${quoteNumber} from ${orgName} ($${total.toFixed(2)}). Let us know if you have any questions or review here: ${manageUrl}`

  await supabase.from('automation_runs').insert({
    org_id: orgId,
    job_id: `job_quote_fu1_${quoteId}`,
    idempotency_key: `quote_fu1_${quoteId}`,
    event_type: 'quote.sent',
    action_type: 'send_sms',
    action_params: {
      to: customerPhone,
      from: senderNumber,
      text: textFu1
    },
    status: 'scheduled',
    scheduled_at: fu1Time,
    event_payload: {
      quote_id: quoteId,
      step: 1
    }
  })

  // 2. Follow-up 2 (5 Days Later)
  const fu2Time = new Date(nowMs + 5 * 24 * 60 * 60 * 1000).toISOString()
  const textFu2 = `Hi ${customerName || 'there'}, friendly reminder that your estimate #${quoteNumber} from ${orgName} is awaiting your review. Check details or accept here: ${manageUrl}`

  await supabase.from('automation_runs').insert({
    org_id: orgId,
    job_id: `job_quote_fu2_${quoteId}`,
    idempotency_key: `quote_fu2_${quoteId}`,
    event_type: 'quote.sent',
    action_type: 'send_sms',
    action_params: {
      to: customerPhone,
      from: senderNumber,
      text: textFu2
    },
    status: 'scheduled',
    scheduled_at: fu2Time,
    event_payload: {
      quote_id: quoteId,
      step: 2
    }
  })
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

  return {
    success: true,
    quote: currentQuote,
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
  customerName?: string
): Promise<{ success: boolean; quote?: any; error?: string }> {
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

  // 1. Update Quote to 'accepted'
  const { data: updatedQuote, error: updateError } = await supabase
    .from('quotes')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', quote.id)
    .select('*')
    .single()

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

  // 3. Send SMS confirmation to customer
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
    await sendTelnyxSms({
      to: contact.phone,
      from: senderNumber,
      text: `Thank you ${contact.name || ''}! Your acceptance of estimate #${quote.quote_number} ($${quote.total.toFixed(2)}) is confirmed. We will reach out shortly to schedule your service.`
    })
  }

  // 4. Notify Owner
  await supabase.from('notifications').insert({
    org_id: quote.org_id,
    title: 'Quote Accepted!',
    message: `${contact?.name || 'Customer'} accepted estimate #${quote.quote_number} for $${quote.total.toFixed(2)}`,
    link: '/client/calendar'
  })

  return { success: true, quote: updatedQuote }
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
    link: '/client/calendar'
  })

  return { success: true, quote: updatedQuote }
}
