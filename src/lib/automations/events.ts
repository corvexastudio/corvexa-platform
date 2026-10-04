import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * CaptoDesk Strongly Typed Domain Events
 */
export type DomainEventType =
  // Leads
  | 'lead.created'
  | 'lead.updated'
  // Messaging & Telephony
  | 'message.received'
  | 'call.missed'
  | 'call.completed'
  // Quotes
  | 'quote.sent'
  | 'quote.viewed'
  | 'quote.accepted'
  | 'quote.declined'
  // Bookings & Appointments
  | 'booking.created'
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'appointment.upcoming'
  // Jobs
  | 'job.completed'
  // Invoices & Billing
  | 'invoice.sent'
  | 'invoice.overdue'
  | 'invoice.paid'
  // Customer Lifecycle
  | 'customer.inactive'
  | 'review.request_due'

export interface AutomationEvent<T = Record<string, any>> {
  id: string
  eventType: DomainEventType
  orgId: string
  entityId?: string
  contactId?: string
  leadId?: string
  timestamp: string
  payload: T
  idempotencyKey?: string
}

/**
 * Creates a standard event envelope with an automated timestamp and ID
 */
export function createEventEnvelope<T = Record<string, any>>(
  eventType: DomainEventType,
  orgId: string,
  payload: T,
  options?: {
    entityId?: string
    contactId?: string
    leadId?: string
    idempotencyKey?: string
  }
): AutomationEvent<T> {
  const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  return {
    id,
    eventType,
    orgId,
    entityId: options?.entityId,
    contactId: options?.contactId,
    leadId: options?.leadId,
    timestamp: new Date().toISOString(),
    payload,
    idempotencyKey: options?.idempotencyKey || `${orgId}:${eventType}:${options?.entityId || id}`
  }
}
