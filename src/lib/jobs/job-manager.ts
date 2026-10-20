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
  crewId?: string
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
    crewId,
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
      crew_id: crewId || null,
      job_number: jobNumber,
      title: title.trim(),
      description: description?.trim() || null,
      status: 'scheduled',
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd || null,
      notes: notes?.trim() || null,
      tracking_token: crypto.randomUUID().replace(/-/g, '')
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
    technicianName?: string
    etaMinutes?: number
  }
): Promise<{ success: boolean; job?: any; error?: string; alreadyInStatus?: boolean }> {
  const { jobId, orgId, newStatus, notifyCustomer = false, notes, technicianName, etaMinutes } = params

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
    if (technicianName?.trim()) {
      updateFields.technician_name = technicianName.trim()
    }
    if (typeof etaMinutes === 'number' && etaMinutes > 0) {
      updateFields.eta_minutes = etaMinutes
    }
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

  // 1. If en_route and notifyCustomer, send dynamic en-route text with tech name and ETA
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
      const techDisplay = technicianName?.trim() || updatedJob.technician_name || 'Your technician'
      const etaVal = typeof etaMinutes === 'number' && etaMinutes > 0 ? etaMinutes : updatedJob.eta_minutes
      const etaPart = etaVal ? ` (ETA: ~${etaVal} mins)` : ''
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.corvexastudio.com'
      const trackPart = job.tracking_token ? ` Live arrival tracker: ${baseUrl}/track/${job.tracking_token}` : ''

      await sendTelnyxSms({
        to: contact.phone,
        from: senderNumber,
        text: `Hi ${contact.name || 'there'}! ${techDisplay} from ${org?.name || 'us'} is on the way${etaPart}.${trackPart}`
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

/**
 * Retrieves public job tracking data by tracking_token for customer-facing live status page
 */
export async function customerViewJobTracking(
  supabase: SupabaseClient,
  token: string
): Promise<{
  success: boolean
  job?: any
  crew?: any
  org?: any
  contact?: any
  service?: any
  invoice?: any
  reviewUrl?: string | null
  referral?: any
  photos?: any[]
  error?: string
}> {
  if (!token || !token.trim()) {
    return { success: false, error: 'Tracking token is required' }
  }

  // 1. Fetch job with organization, contact, and service relations
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      id,
      job_number,
      title,
      description,
      status,
      scheduled_start,
      scheduled_end,
      en_route_at,
      started_at,
      completed_at,
      technician_name,
      eta_minutes,
      notes,
      tracking_token,
      org_id,
      contact_id,
      service_id,
      assigned_to,
      organizations (
        id,
        name,
        telnyx_phone_number,
        owner_phone,
        google_review_url
      ),
      contacts (
        id,
        name,
        phone,
        address
      ),
      services (
        id,
        name,
        duration_minutes,
        price
      )
    `)
    .eq('tracking_token', token.trim())
    .single()

  if (jobError || !job) {
    return { success: false, error: 'Job tracking link not found or expired' }
  }

  // 2. Lookup any associated invoice for this job or contact
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, title, total, amount_paid, amount_due, status, manage_token')
    .eq('org_id', job.org_id)
    .or(`job_id.eq.${job.id},contact_id.eq.${job.contact_id}`)
    .in('status', ['sent', 'viewed', 'partially_paid', 'paid'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 3. Review Link Resolution
  const org = (job as any).organizations
  const reviewUrl: string | null = org?.google_review_url || null

  // 4. Referral Program Resolution
  let referral: { code: string; url: string; rewardAmount: number; discountAmount: number } | null = null
  if (job.contact_id && job.org_id) {
    const { getOrCreateReferralLink } = await import('../referrals/referral-manager.ts')
    const refRes = await getOrCreateReferralLink(supabase, {
      orgId: job.org_id,
      contactId: job.contact_id,
      contactName: (job as any).contacts?.name
    })
    if (refRes.success && refRes.referral && refRes.referralUrl) {
      referral = {
        code: refRes.referral.referral_code,
        url: refRes.referralUrl,
        rewardAmount: Number(refRes.referral.reward_amount || 25),
        discountAmount: Number(refRes.referral.discount_amount || 25)
      }
    }
  }

  // 5. Job Photos Resolution (Visual proof: Before & After with authorized URLs)
  const { data: rawPhotos } = await supabase
    .from('job_photos')
    .select('id, photo_type, url, caption, created_at')
    .eq('job_id', job.id)
    .order('created_at', { ascending: true })

  let photos: any[] = []
  if (rawPhotos && rawPhotos.length > 0) {
    const { getAuthorizedPhotoUrl } = await import('./photo-manager.ts')
    photos = await Promise.all(
      rawPhotos.map(async (p: any) => ({
        ...p,
        url: await getAuthorizedPhotoUrl(supabase, p.url)
      }))
    )
  }

  // 6. Assigned Crew Resolution
  let crewInfo: { name: string; colorCode: string; phoneNumber?: string | null } | null = null
  if ((job as any).crew_id) {
    try {
      const { data: crewData } = await supabase
        .from('crews')
        .select('name, color_code, phone_number')
        .eq('id', (job as any).crew_id)
        .maybeSingle()
      if (crewData) {
        crewInfo = {
          name: crewData.name,
          colorCode: crewData.color_code || '#3B82F6',
          phoneNumber: crewData.phone_number || null
        }
      }
    } catch {
      // Non-fatal if crews table is not yet migrated
    }
  }

  return {
    success: true,
    job: {
      id: job.id,
      jobNumber: job.job_number,
      title: job.title,
      description: job.description,
      status: job.status,
      scheduledStart: job.scheduled_start,
      scheduledEnd: job.scheduled_end,
      enRouteAt: job.en_route_at,
      arrivedAt: (job as any).arrived_at || null,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      technicianName: job.technician_name,
      etaMinutes: job.eta_minutes,
      notes: job.notes,
      trackingToken: job.tracking_token
    },
    crew: crewInfo,
    org: {
      id: org?.id,
      name: org?.name || 'Service Provider',
      phone: org?.telnyx_phone_number || org?.owner_phone || null,
      logoUrl: org?.logo_url || null
    },
    contact: (job as any).contacts ? {
      name: (job as any).contacts.name,
      address: (job as any).contacts.address
    } : null,
    service: (job as any).services ? {
      name: (job as any).services.name,
      durationMinutes: (job as any).services.duration_minutes,
      price: (job as any).services.price
    } : null,
    invoice: invoice ? {
      invoiceNumber: invoice.invoice_number,
      total: Number(invoice.total),
      amountPaid: Number(invoice.amount_paid),
      amountDue: Number(invoice.amount_due),
      status: invoice.status,
      manageToken: invoice.manage_token
    } : null,
    reviewUrl,
    referral,
    photos: photos || []
  }
}

/**
 * 1-Tap Technician Field Timestamp Logger (Arrived, Started, Completed)
 */
export async function recordJobTimestamp(
  supabase: SupabaseClient,
  params: {
    orgId: string
    jobId: string
    action: 'arrived' | 'started' | 'completed'
    notes?: string
  }
): Promise<{ success: boolean; job?: any; error?: string }> {
  const { orgId, jobId, action, notes } = params
  const now = new Date().toISOString()

  // First fetch the job to verify existence and current state
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('org_id', orgId)
    .single()

  if (jobError || !job) {
    return { success: false, error: 'Job not found' }
  }

  const updateFields: Record<string, any> = {
    updated_at: now
  }

  if (notes) {
    updateFields.notes = job.notes ? `${job.notes}\n${notes}` : notes
  }

  if (action === 'arrived') {
    updateFields.arrived_at = now
    // If job was scheduled/confirmed/en_route, progress it
    if (['scheduled', 'confirmed', 'en_route'].includes(job.status)) {
      updateFields.status = 'in_progress'
    }
  } else if (action === 'started') {
    updateFields.started_at = now
    updateFields.status = 'in_progress'
  } else if (action === 'completed') {
    updateFields.completed_at = now
    return updateJobStatus(supabase, {
      orgId,
      jobId,
      newStatus: 'completed',
      notes,
      notifyCustomer: false
    })
  }

  const { data: updatedJob, error: updateError } = await supabase
    .from('jobs')
    .update(updateFields)
    .eq('id', jobId)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (updateError || !updatedJob) {
    return { success: false, error: updateError?.message || 'Failed to record timestamp' }
  }

  return { success: true, job: updatedJob }
}

