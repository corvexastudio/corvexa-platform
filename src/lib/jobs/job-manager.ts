import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTelnyxSms } from '../telnyx.ts'
import { createEventEnvelope } from '../automations/events.ts'
import { handleAutomationEvent } from '../automations/engine.ts'
import { updateCustomerServiceDate } from '../retention/lifecycle-manager.ts'
import { scheduleJobReviewAutomation } from '../reviews/review-manager.ts'
import { generateDocumentNumber } from '../services/document-counter.ts'

export type JobStatus =
  | 'scheduled'
  | 'confirmed'
  | 'en_route'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export interface JobItemInput {
  description: string
  quantity: number
  unit_price: number
}

export interface CreateJobInput {
  orgId: string
  contactId: string
  leadId?: string
  quoteId?: string
  appointmentId?: string
  serviceId?: string
  assignedTo?: string
  title: string
  description?: string
  scheduledStart: string // ISO string
  scheduledEnd?: string   // ISO string
  items?: JobItemInput[]
  notes?: string
}

/**
 * Creates a new field service job
 */
export async function createJob(
  supabase: SupabaseClient,
  input: CreateJobInput
): Promise<{ success: boolean; job?: any; items?: any[]; error?: string }> {
  const {
    orgId,
    contactId,
    leadId,
    quoteId,
    appointmentId,
    serviceId,
    assignedTo,
    title,
    description,
    scheduledStart,
    scheduledEnd,
    items = [],
    notes
  } = input

  if (!title || !title.trim()) {
    return { success: false, error: 'Job title is required' }
  }

  const jobNumber = await generateDocumentNumber(supabase, orgId, 'job')

  // 1. Insert Job Record
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      org_id: orgId,
      contact_id: contactId,
      lead_id: leadId || null,
      quote_id: quoteId || null,
      appointment_id: appointmentId || null,
      service_id: serviceId || null,
      assigned_to: assignedTo || null,
      job_number: jobNumber,
      title: title.trim(),
      description: description?.trim() || null,
      status: 'scheduled',
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd || null,
      notes: notes?.trim() || null
    })
    .select('*')
    .single()

  if (jobError || !job) {
    return { success: false, error: jobError?.message || 'Failed to create job' }
  }

  // 2. Insert Job Items if provided
  let insertedItems: any[] = []
  if (items.length > 0) {
    const itemsToInsert = items.map((it) => ({
      job_id: job.id,
      org_id: orgId,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total: Math.round(it.quantity * it.unit_price * 100) / 100
    }))

    const { data: itemRows } = await supabase
      .from('job_items')
      .insert(itemsToInsert)
      .select('*')

    if (itemRows) insertedItems = itemRows
  }

  return { success: true, job, items: insertedItems }
}

/**
 * Updates a job's status through its field-service lifecycle:
 * scheduled -> confirmed -> en_route -> in_progress -> completed.
 * When status is 'completed', emits the typed 'job.completed' domain event.
 */
export async function updateJobStatus(
  supabase: SupabaseClient,
  params: {
    jobId: string
    orgId: string
    newStatus: JobStatus
    notifyCustomer?: boolean
    notes?: string
  }
): Promise<{ success: boolean; job?: any; error?: string; alreadyInStatus?: boolean }> {
  const { jobId, orgId, newStatus, notifyCustomer = false, notes } = params

  const { data: job, error: findError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('org_id', orgId)
    .single()

  if (findError || !job) {
    return { success: false, error: 'Job not found' }
  }

  // Idempotency guard: If job is already in the target status, return cleanly without duplicating hooks or SMS
  if (job.status === newStatus) {
    return { success: true, job, alreadyInStatus: true }
  }

  // Terminal lifecycle guard: completed and cancelled jobs cannot regress
  if (job.status === 'completed') {
    return { success: false, error: 'Cannot change status of an already completed job' }
  }
  if (job.status === 'cancelled') {
    return { success: false, error: 'Cannot change status of a cancelled job' }
  }

  const updateFields: Record<string, any> = {
    status: newStatus,
    updated_at: new Date().toISOString()
  }

  if (notes) {
    updateFields.notes = job.notes ? `${job.notes}\n${notes}` : notes
  }

  if (newStatus === 'en_route') {
    updateFields.en_route_at = new Date().toISOString()
  } else if (newStatus === 'in_progress') {
    updateFields.started_at = new Date().toISOString()
  } else if (newStatus === 'completed') {
    updateFields.completed_at = new Date().toISOString()
  }

  const { data: updatedJob, error: updateError } = await supabase
    .from('jobs')
    .update(updateFields)
    .eq('id', jobId)
    .select('*')
    .single()

  if (updateError || !updatedJob) {
    return { success: false, error: 'Failed to update job status' }
  }

  // 1. If en_route and notifyCustomer, send en-route text
  if (newStatus === 'en_route' && notifyCustomer) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name, telnyx_phone_number, owner_phone')
      .eq('id', orgId)
      .single()

    const { data: contact } = await supabase
      .from('contacts')
      .select('name, phone')
      .eq('id', job.contact_id)
      .single()

    const senderNumber = org?.telnyx_phone_number || org?.owner_phone
    if (senderNumber && contact?.phone) {
      await sendTelnyxSms({
        to: contact.phone,
        from: senderNumber,
        text: `Hi ${contact.name || 'there'}! Your technician from ${org?.name || 'us'} is en route to your service location.`
      })
    }
  }

  // 2. When completed: Update customer service date, schedule review request, and EMIT job.completed Domain Event
  if (newStatus === 'completed') {
    if (job.contact_id) {
      await updateCustomerServiceDate(supabase, {
        contactId: job.contact_id,
        orgId,
        serviceDate: new Date()
      })
      await scheduleJobReviewAutomation(supabase, {
        orgId,
        jobId: job.id,
        contactId: job.contact_id
      })
    }

    await handleAutomationEvent(
      supabase,
      createEventEnvelope('job.completed', orgId, {
        job_id: job.id,
        job_number: job.job_number,
        contact_id: job.contact_id,
        lead_id: job.lead_id,
        quote_id: job.quote_id,
        appointment_id: job.appointment_id,
        completed_at: new Date().toISOString()
      }, {
        entityId: job.id,
        contactId: job.contact_id,
        leadId: job.lead_id || undefined
      })
    )
  }

  return { success: true, job: updatedJob }
}

/**
 * Bridges an Accepted Quote directly into a Scheduled Field Service Job
 */
export async function convertQuoteToJob(
  supabase: SupabaseClient,
  params: {
    quoteId: string
    orgId: string
    scheduledStart: string
    scheduledEnd?: string
    assignedTo?: string
  }
): Promise<{ success: boolean; job?: any; error?: string }> {
  const { quoteId, orgId, scheduledStart, scheduledEnd, assignedTo } = params

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('org_id', orgId)
    .single()

  if (quoteError || !quote) {
    return { success: false, error: 'Quote not found' }
  }

  const { data: quoteItems } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', quoteId)

  const jobItems: JobItemInput[] = (quoteItems || []).map((it: any) => ({
    description: it.description,
    quantity: it.quantity,
    unit_price: it.unit_price
  }))

  return createJob(supabase, {
    orgId,
    contactId: quote.contact_id,
    leadId: quote.lead_id,
    quoteId: quote.id,
    assignedTo,
    title: quote.title || `Service for Quote #${quote.quote_number}`,
    description: quote.description,
    scheduledStart,
    scheduledEnd,
    items: jobItems,
    notes: quote.notes
  })
}

/**
 * Safely soft-deletes a job without deleting customer history, appointments, or quotes.
 */
export async function softDeleteJob(
  supabase: SupabaseClient,
  input: { orgId: string; jobId: string }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('jobs')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', input.jobId)
    .eq('org_id', input.orgId)

  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

/**
 * Restores a soft-deleted job.
 */
export async function restoreJob(
  supabase: SupabaseClient,
  input: { orgId: string; jobId: string }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('jobs')
    .update({
      deleted_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.jobId)
    .eq('org_id', input.orgId)

  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

