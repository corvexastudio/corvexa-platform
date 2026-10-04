import type { SupabaseClient } from '@supabase/supabase-js'
import type { AutomationEvent } from './events.ts'

export type StopConditionType =
  | 'customer_replied'
  | 'customer_booked'
  | 'lead_lost'
  | 'appointment_cancelled'
  | 'quote_accepted'
  | 'quote_declined'
  | 'invoice_paid'
  | 'manual_stop'

export interface StopConditionCheckResult {
  triggered: boolean
  stopCondition?: StopConditionType
  cancelledRunIds: string[]
}

/**
 * Evaluates whether an incoming event satisfies any stop conditions for scheduled automation runs,
 * and cancels matching pending jobs to prevent unwanted follow-ups.
 */
export async function evaluateAndApplyStopConditions(
  supabase: SupabaseClient,
  event: AutomationEvent
): Promise<StopConditionCheckResult> {
  const cancelledRunIds: string[] = []

  let matchedCondition: StopConditionType | null = null

  // 1. Identify which stop condition this event represents
  if (event.eventType === 'message.received') {
    matchedCondition = 'customer_replied'
  } else if (
    event.eventType === 'booking.created' ||
    event.eventType === 'booking.confirmed' ||
    event.eventType === 'appointment.upcoming'
  ) {
    matchedCondition = 'customer_booked'
  } else if (event.eventType === 'booking.cancelled') {
    matchedCondition = 'appointment_cancelled'
  } else if (event.eventType === 'quote.accepted') {
    matchedCondition = 'quote_accepted'
  } else if (event.eventType === 'quote.declined') {
    matchedCondition = 'quote_declined'
  } else if (event.eventType === 'invoice.paid') {
    matchedCondition = 'invoice_paid'
  } else if (event.eventType === 'lead.updated' && event.payload?.status === 'lost') {
    matchedCondition = 'lead_lost'
  }

  if (!matchedCondition) {
    return { triggered: false, cancelledRunIds: [] }
  }

  // 2. Query pending or scheduled runs for this tenant
  let query = supabase
    .from('automation_runs')
    .select('id, org_id, rule_id, status, event_payload')
    .eq('org_id', event.orgId)
    .in('status', ['pending', 'scheduled'])

  const { data: activeRuns, error } = await query

  if (error || !activeRuns || activeRuns.length === 0) {
    return { triggered: false, cancelledRunIds: [] }
  }

  // 3. Filter runs that pertain to this specific contact, lead, appointment, quote, or invoice
  const targetContactId = event.contactId || event.payload?.contact_id
  const targetLeadId = event.leadId || event.entityId
  const targetAppointmentId = event.payload?.appointment_id || (event.eventType.startsWith('booking.') ? event.entityId : undefined)
  const targetQuoteId = event.payload?.quote_id || (event.eventType.startsWith('quote.') ? event.entityId : undefined)
  const targetInvoiceId = event.payload?.invoice_id || (event.eventType.startsWith('invoice.') ? event.entityId : undefined)

  for (const run of activeRuns) {
    const runPayload = run.event_payload || {}
    const runContactId = runPayload.contact_id || runPayload.contactId
    const runLeadId = runPayload.lead_id || runPayload.leadId || runPayload.entityId
    const runAppointmentId = runPayload.appointment_id || runPayload.appointmentId
    const runQuoteId = runPayload.quote_id || runPayload.quoteId
    const runInvoiceId = runPayload.invoice_id || runPayload.invoiceId

    const matchesContact = targetContactId && runContactId === targetContactId
    const matchesLead = targetLeadId && runLeadId === targetLeadId
    const matchesAppointment = targetAppointmentId && runAppointmentId === targetAppointmentId
    const matchesQuote = targetQuoteId && runQuoteId === targetQuoteId
    const matchesInvoice = targetInvoiceId && runInvoiceId && targetInvoiceId === runInvoiceId

    if (matchesContact || matchesLead || matchesAppointment || matchesQuote || matchesInvoice) {
      // Cancel the run atomically
      const cancellationReason = `Stop condition met: ${matchedCondition} (Event: ${event.eventType})`
      
      const { error: updateError } = await supabase
        .from('automation_runs')
        .update({
          status: 'cancelled',
          failure_reason: cancellationReason,
          completed_at: new Date().toISOString()
        })
        .eq('id', run.id)

      if (!updateError) {
        cancelledRunIds.push(run.id)
      }
    }
  }

  return {
    triggered: cancelledRunIds.length > 0,
    stopCondition: matchedCondition,
    cancelledRunIds
  }
}

/**
 * Manually cancels an individual automation run by ID
 */
export async function manualCancelAutomationRun(
  supabase: SupabaseClient,
  runId: string,
  reason: string = 'Owner manually stopped automation'
): Promise<boolean> {
  const { error } = await supabase
    .from('automation_runs')
    .update({
      status: 'cancelled',
      failure_reason: `Manual cancellation: ${reason}`,
      completed_at: new Date().toISOString()
    })
    .eq('id', runId)
    .in('status', ['pending', 'scheduled'])

  return !error
}
