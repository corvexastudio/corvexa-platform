import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTelnyxSms } from '../telnyx.ts'
import { logComplianceAudit, verifyOutboundCompliance } from '../compliance/compliance-engine.ts'
import { logOutboundConversationMessage } from '../services/conversation-logger.ts'
import { createEventEnvelope } from '../automations/events.ts'
import { handleAutomationEvent } from '../automations/engine.ts'
import { updateCustomerServiceDate } from '../retention/lifecycle-manager.ts'
import { scheduleJobReviewAutomation } from '../reviews/review-manager.ts'
import { renderSituationAwareText } from '../notifications/situation-templates.ts'
import { generateDocumentNumber } from '../services/document-counter.ts'
import { resolveSenderPhone } from '../billing/plans.ts'
import {
  selectBestAcceptedQuoteForJob,
  type QuoteMatchCandidate,
} from './quote-matching.ts'

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
  contactId?: string
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
 * Collects quote IDs that are already assigned to another active/completed job
 * or have already been converted into a non-void final invoice.
 */
async function buildClaimedQuoteIdSet(
  supabase: SupabaseClient,
  orgId: string,
  candidateQuotes: QuoteMatchCandidate[],
  excludeJobId?: string
): Promise<Set<string>> {
  const claimed = new Set<string>()
  const quoteIds = Array.from(new Set(candidateQuotes.map(q => q.id).filter(Boolean)))
  if (quoteIds.length === 0) return claimed

  const depositInvoiceIds = new Set(
    candidateQuotes.map(q => q.deposit_invoice_id).filter(Boolean) as string[]
  )

  try {
    const { data: linkedJobs } = await supabase
      .from('jobs')
      .select('id, quote_id, status, deleted_at')
      .eq('org_id', orgId)
      .in('quote_id', quoteIds)

    for (const lj of linkedJobs || []) {
      if (lj.deleted_at || !lj.quote_id) continue
      if (excludeJobId && lj.id === excludeJobId) continue
      if (['cancelled', 'no_show'].includes(lj.status || '')) continue
      claimed.add(lj.quote_id)
    }
  } catch {
    // Non-blocking in constrained schemas/mocks
  }

  try {
    const { data: linkedInvoices } = await supabase
      .from('invoices')
      .select('id, quote_id, job_id, status, deleted_at')
      .eq('org_id', orgId)
      .in('quote_id', quoteIds)

    for (const inv of linkedInvoices || []) {
      if (inv.deleted_at || !inv.quote_id) continue
      if (inv.status === 'void') continue
      if (excludeJobId && inv.job_id === excludeJobId) continue
      if (depositInvoiceIds.has(inv.id)) continue
      claimed.add(inv.quote_id)
    }
  } catch {
    // Non-blocking in constrained schemas/mocks
  }

  return claimed
}

/**
 * Resolves the best unclaimed accepted quote for a single job (by quote_id or contact).
 */
async function findUnclaimedAcceptedQuoteForJob(
  supabase: SupabaseClient,
  orgId: string,
  job: any
): Promise<QuoteMatchCandidate | null> {
  if (!job?.contact_id) return null
  try {
    const { data: contactQuotes } = await supabase
      .from('quotes')
      .select('id, quote_number, title, description, total, subtotal, tax, discount, status, manage_token, contact_id, lead_id, accepted_at, created_at, deposit_invoice_id')
      .eq('org_id', orgId)
      .eq('contact_id', job.contact_id)
      .eq('status', 'accepted')

    const validQuotes = (contactQuotes || []).filter((q: any) => !q.deleted_at)
    if (validQuotes.length === 0) return null

    const claimedQuoteIds = await buildClaimedQuoteIdSet(supabase, orgId, validQuotes, job.id)
    return selectBestAcceptedQuoteForJob(job, validQuotes, claimedQuoteIds)
  } catch {
    return null
  }
}

/**
 * Reliably hydrates jobs with their linked or unclaimed approved quotes and service pricing,
 * independent of PostgREST foreign-key embed availability.
 */
export async function hydrateJobsWithQuotes(
  supabase: SupabaseClient,
  orgId: string,
  jobs: any[]
): Promise<void> {
  if (!Array.isArray(jobs) || jobs.length === 0) return

  try {
    // 1. Ensure service.price is populated when service_id exists
    const missingPriceServiceIds = Array.from(
      new Set(
        jobs
          .filter(j => j.service_id && (j.service?.price === undefined || j.service?.price === null))
          .map(j => j.service_id)
      )
    )
    if (missingPriceServiceIds.length > 0) {
      const { data: svcRows } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price')
        .eq('org_id', orgId)
        .in('id', missingPriceServiceIds)

      const svcMap = new Map<string, any>((svcRows || []).map((s: any) => [s.id, s]))
      for (const j of jobs) {
        const svc = svcMap.get(j.service_id)
        if (svc) {
          j.service = { ...(j.service || {}), ...svc }
        }
      }
    }

    // 2. Gather candidate quotes (direct quote_ids + accepted quotes for these customers)
    const directQuoteIds = Array.from(new Set(jobs.map(j => j.quote_id).filter(Boolean)))
    const contactIds = Array.from(
      new Set(
        jobs
          .filter(j => j.contact_id && (!j.quote || j.quote.status !== 'accepted'))
          .map(j => j.contact_id)
      )
    )

    const quoteMap = new Map<string, QuoteMatchCandidate>()

    if (directQuoteIds.length > 0) {
      const { data: directRows } = await supabase
        .from('quotes')
        .select('id, quote_number, title, description, total, subtotal, tax, discount, status, manage_token, contact_id, lead_id, accepted_at, created_at, deposit_invoice_id, deleted_at')
        .eq('org_id', orgId)
        .in('id', directQuoteIds)

      for (const q of directRows || []) {
        if (!q.deleted_at) quoteMap.set(q.id, q)
      }
    }

    if (contactIds.length > 0) {
      const { data: acceptedRows } = await supabase
        .from('quotes')
        .select('id, quote_number, title, description, total, subtotal, tax, discount, status, manage_token, contact_id, lead_id, accepted_at, created_at, deposit_invoice_id, deleted_at')
        .eq('org_id', orgId)
        .eq('status', 'accepted')
        .in('contact_id', contactIds)

      for (const q of acceptedRows || []) {
        if (!q.deleted_at) quoteMap.set(q.id, q)
      }
    }

    const candidateQuotes = Array.from(quoteMap.values())
    if (candidateQuotes.length === 0) return

    const claimedQuoteIds = await buildClaimedQuoteIdSet(supabase, orgId, candidateQuotes)

    // Pass A: Hydrate jobs that already have an explicit quote_id
    for (const j of jobs) {
      if (j.quote_id && quoteMap.has(j.quote_id)) {
        j.quote = quoteMap.get(j.quote_id)
        claimedQuoteIds.add(j.quote_id)
      }
    }

    // Pass B: Match unclaimed accepted quotes to active (or completed-uninvoiced) jobs
    const activeStatuses = new Set(['scheduled', 'confirmed', 'en_route', 'in_progress'])
    const eligibleJobs = jobs
      .filter(j => {
        if (j.quote && j.quote.status === 'accepted') return false
        if (activeStatuses.has(j.status)) return true
        return j.status === 'completed' && !(Array.isArray(j.invoices) && j.invoices.length > 0)
      })
      .sort((a, b) => {
        const aActive = activeStatuses.has(a.status) ? 0 : 1
        const bActive = activeStatuses.has(b.status) ? 0 : 1
        if (aActive !== bActive) return aActive - bActive
        return (Date.parse(b.created_at || b.scheduled_start || '') || 0) -
          (Date.parse(a.created_at || a.scheduled_start || '') || 0)
      })

    for (const j of eligibleJobs) {
      const match = selectBestAcceptedQuoteForJob(j, candidateQuotes, claimedQuoteIds)
      if (match) {
        j.quote = match
        claimedQuoteIds.add(match.id)
      }
    }
  } catch (err) {
    console.warn('[HYDRATE_JOBS_QUOTES_WARNING]', err)
  }
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
    finalAmount?: number
    items?: Array<{ description: string; quantity: number; unit_price: number }>
    dueDate?: string
    quoteId?: string
  }
): Promise<{ success: boolean; job?: any; invoice?: any; error?: string; alreadyInStatus?: boolean; upgradeRequired?: boolean; code?: string; checkoutUrl?: string }> {
  const { jobId, orgId, newStatus, notifyCustomer = false, notes, technicianName, etaMinutes, finalAmount, items: paramItems, dueDate: paramDueDate, quoteId: paramQuoteId } = params

  const { data: job, error: findError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('org_id', orgId)
    .single()

  if (findError || !job) {
    return { success: false, error: 'Job not found' }
  }

  // Idempotency check: If job is already in the target status and no additional parameters are provided, return cleanly
  if (job.status === newStatus && !notes && !technicianName && !etaMinutes) {
    return { success: true, job, alreadyInStatus: true }
  }

  // P0 Guard: If already completed and target is completed, update notes only and do not re-emit completion side effects
  if (job.status === 'completed' && newStatus === 'completed') {
    if (notes) {
      await supabase
        .from('jobs')
        .update({
          notes: job.notes ? `${job.notes}\n${notes}` : notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)
        .eq('org_id', orgId)
    }
    return { success: true, job, alreadyInStatus: true }
  }

  // Terminal lifecycle guard: completed and cancelled jobs cannot regress
  if (job.status === 'completed' && newStatus !== 'completed') {
    return { success: false, error: 'Cannot change status of an already completed job' }
  }
  if (job.status === 'cancelled' && newStatus !== 'cancelled') {
    return { success: false, error: 'Cannot change status of a cancelled job' }
  }

  // Finish-Line Sunk Cost Paywall Guard (Starter Pass: Job #4+)
  // Advancing status to active/dispatched/completed states requires Pro once 3 free jobs are completed
  if (['en_route', 'in_progress', 'completed'].includes(newStatus)) {
    const { isPracticeJob } = await import('./practice-job.ts')
    if (!isPracticeJob(job) && job.status !== 'completed') {
      const { SubscriptionService } = await import('../billing/subscription-service.ts')
      const entitlement = await SubscriptionService.getEntitlement(supabase, orgId).catch(() => null)
      const isPaidPro = entitlement?.isEntitled && ['solo', 'multi_crew', 'fleet', 'captodesk_standard'].includes(entitlement?.planId || '')

      if (!isPaidPro) {
        const starterUsage = await SubscriptionService.getFreeTierJobUsage(supabase, orgId).catch(() => null)
        if (starterUsage?.isLimitReached) {
          return {
            success: false,
            upgradeRequired: true,
            code: 'STARTER_LIMIT_REACHED',
            error: "You've completed your 3 free starter jobs. Upgrade to Pro ($99/mo) to dispatch crew and manage additional jobs.",
            checkoutUrl: '/client/billing?reason=starter_limit',
            job
          }
        }
      }
    }
  }

  const nowIso = new Date().toISOString()
  const updateFields: Record<string, any> = {
    status: newStatus,
    updated_at: nowIso
  }

  // Ensure tracking_token exists so tracking link always works
  if (!job.tracking_token) {
    updateFields.tracking_token = crypto.randomUUID().replace(/-/g, '')
  }

  if (notes) {
    updateFields.notes = job.notes ? `${job.notes}\n${notes}` : notes
  }

  if (newStatus === 'en_route') {
    updateFields.en_route_at = nowIso
    if (technicianName?.trim()) {
      updateFields.technician_name = technicianName.trim()
    }
    if (typeof etaMinutes === 'number' && etaMinutes > 0) {
      updateFields.eta_minutes = etaMinutes
    }
  } else if (newStatus === 'in_progress') {
    updateFields.started_at = nowIso
  } else if (newStatus === 'completed') {
    updateFields.completed_at = nowIso
  }

  let updatedJob: any = null
  let { data: resJob, error: updateError } = await supabase
    .from('jobs')
    .update(updateFields)
    .eq('id', jobId)
    .eq('org_id', orgId)
    .select('*')
    .maybeSingle()

  if (updateError) {
    console.warn('[UPDATE_JOB_STATUS_RETRY] Primary update encountered warning:', updateError.message)
    // If update failed due to optional schema columns (e.g. technician_name, eta_minutes),
    // retry with core fields only so the status update NEVER gets blocked
    const fallbackFields: Record<string, any> = {
      status: newStatus,
      updated_at: nowIso
    }
    if (updateFields.tracking_token) {
      fallbackFields.tracking_token = updateFields.tracking_token
    }
    if (notes) {
      fallbackFields.notes = job.notes ? `${job.notes}\n${notes}` : notes
    }
    const { data: fallbackJob, error: fallbackError } = await supabase
      .from('jobs')
      .update(fallbackFields)
      .eq('id', jobId)
      .eq('org_id', orgId)
      .select('*')
      .maybeSingle()

    let fallbackRecovered = false
    if (
      (updateError?.code === '23514' || updateError?.message?.includes('jobs_status_check')) &&
      (newStatus === 'en_route' || newStatus === 'confirmed' || newStatus === 'no_show')
    ) {
      console.warn('[UPDATE_JOB_STATUS_CONSTRAINT_FALLBACK] Database jobs_status_check rejected', newStatus, '- falling back to in_progress with status metadata while migration 49 applies.')
      const safeDbStatus = newStatus === 'no_show' ? 'cancelled' : 'in_progress'
      const statusNote = `[Status: ${newStatus}${technicianName ? ` | Tech: ${technicianName}` : ''}${etaMinutes ? ` | ETA: ${etaMinutes}m` : ''}]`
      const constraintRecoveryFields: Record<string, any> = {
        status: safeDbStatus,
        updated_at: nowIso,
        notes: job.notes ? `${job.notes}\n${statusNote}` : statusNote
      }
      if (updateFields.tracking_token) {
        constraintRecoveryFields.tracking_token = updateFields.tracking_token
      }
      const { data: recoveryJob, error: recoveryErr } = await supabase
        .from('jobs')
        .update(constraintRecoveryFields)
        .eq('id', jobId)
        .eq('org_id', orgId)
        .select('*')
        .maybeSingle()

      if (recoveryJob && !recoveryErr) {
        updatedJob = {
          ...recoveryJob,
          status: newStatus,
          technician_name: technicianName || recoveryJob.technician_name,
          eta_minutes: etaMinutes || recoveryJob.eta_minutes
        }
        fallbackRecovered = true
      }
    }

    if (!fallbackRecovered) {
      if (fallbackError || !fallbackJob) {
        console.error('[UPDATE_JOB_STATUS_FAILED]', fallbackError || updateError)
        return { success: false, error: fallbackError?.message || updateError?.message || 'Failed to update job status' }
      }
      updatedJob = fallbackJob
    }
  } else {
    updatedJob = resJob
  }

  if (!updatedJob) {
    return { success: false, error: 'Failed to update job status: job not found' }
  }

  // 1. If en_route and notifyCustomer, send dynamic en-route text with tech name and ETA
  if (newStatus === 'en_route' && notifyCustomer) {
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('name, telnyx_phone_number, phone_provisioning_status, plan_id, subscription_status, owner_phone, operation_mode')
        .eq('id', orgId)
        .maybeSingle()

      const { data: contact } = await supabase
        .from('contacts')
        .select('name, phone')
        .eq('id', job.contact_id)
        .maybeSingle()

      const senderNumber = resolveSenderPhone(org)
      if (senderNumber && contact?.phone) {
        const techDisplay = technicianName?.trim() || updatedJob.technician_name || 'Your technician'
        const etaVal = typeof etaMinutes === 'number' && etaMinutes > 0 ? etaMinutes : updatedJob.eta_minutes
        const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://captodesk.com').replace(/\/$/, '')
        const trackingToken = updatedJob.tracking_token || job.tracking_token
        const trackingUrl = trackingToken ? `${baseUrl}/t/${trackingToken}` : undefined
        const opMode = org?.operation_mode === 'multi_crew' ? 'multi_crew' : 'solo'
        const text = renderSituationAwareText('customer_en_route', {
          operationMode: opMode,
          customerName: contact.name || 'there',
          businessName: org?.name || 'us',
          technicianName: techDisplay,
          etaMinutes: etaVal,
          trackingUrl
        })

        const compliance = await verifyOutboundCompliance(supabase, {
          orgId,
          toPhone: contact.phone,
          fromPhone: senderNumber,
          flowType: 'job_en_route',
          messageType: 'transactional',
          body: text,
          contactId: job.contact_id
        })

        if (compliance.allowed) {
          const smsRes = await sendTelnyxSms({
            to: contact.phone,
            from: senderNumber,
            text: compliance.formattedText
          })

          if (smsRes.success) {
            await logComplianceAudit(supabase, {
              orgId,
              phone: contact.phone,
              contactId: job.contact_id,
              action: 'message_sent',
              messageType: 'transactional',
              reason: 'job_en_route'
            })
          }

          if (job.contact_id) {
            await logOutboundConversationMessage(supabase, {
              orgId,
              contactId: job.contact_id,
              body: compliance.formattedText,
              deliveryStatus: smsRes.success ? 'sent' : 'failed',
              telnyxMessageId: smsRes.messageId || null,
              automationSource: 'job_en_route',
              failureReason: smsRes.error || null
            })
          }
        } else {
          console.warn(`[EN_ROUTE_SMS_SUPPRESSED] Compliance check suppressed SMS: ${compliance.suppressionReason}`)
        }
      }
    } catch (smsErr) {
      console.warn('[EN_ROUTE_SMS_WARNING] SMS delivery failed or was skipped:', smsErr)
    }
  }

  // 2. Synchronize linked appointment if one exists
  if (job.appointment_id) {
    try {
      if (newStatus === 'completed') {
        await supabase
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', job.appointment_id)
          .eq('org_id', orgId)
      } else if (newStatus === 'cancelled') {
        await supabase
          .from('appointments')
          .update({ status: 'cancelled', cancellation_reason: 'Job cancelled' })
          .eq('id', job.appointment_id)
          .eq('org_id', orgId)
      } else if (newStatus === 'no_show') {
        await supabase
          .from('appointments')
          .update({ status: 'no_show', cancellation_reason: 'Customer no-show' })
          .eq('id', job.appointment_id)
          .eq('org_id', orgId)
      } else if (newStatus === 'en_route' || newStatus === 'in_progress' || newStatus === 'confirmed') {
        await supabase
          .from('appointments')
          .update({ status: 'confirmed', confirmed_at: nowIso })
          .eq('id', job.appointment_id)
          .eq('org_id', orgId)
      }
    } catch (apptErr) {
      console.warn('[SYNC_APPOINTMENT_WARNING]', apptErr)
    }
  }

  // 3. When completed: Update customer service date, auto-generate draft invoice, schedule review request, and emit domain event
  let draftInvoice: any = null
  if (newStatus === 'completed') {
    try {
      // 3a. Auto-generate draft invoice if none exists for this job
      let existingInvQuery: any = supabase
        .from('invoices')
        .select('*')
        .eq('org_id', orgId)
        .eq('job_id', jobId)

      if (typeof existingInvQuery?.is === 'function') {
        existingInvQuery = existingInvQuery.is('deleted_at', null)
      }

      const { data: rawExistingInv } = await existingInvQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const existingInv = (rawExistingInv && !rawExistingInv.deleted_at) ? rawExistingInv : null

      if (existingInv) {
        draftInvoice = existingInv
      } else if (job.contact_id) {
        let invoiceItems: Array<{ description: string; quantity: number; unit_price: number }> = []
        let invoiceTaxRate = 0
        let invoiceDiscountAmount = 0

        // Resolve linked quote or auto-discover unclaimed accepted quote for this customer
        let resolvedQuoteId: string | null = paramQuoteId || job.quote_id || null
        if (!resolvedQuoteId && (!paramItems || paramItems.length === 0)) {
          const matchedQuote = await findUnclaimedAcceptedQuoteForJob(supabase, orgId, job)
          if (matchedQuote?.id) {
            resolvedQuoteId = matchedQuote.id
          }
        }

        // Persist newly resolved quote linkage onto the job record for audit continuity
        if (resolvedQuoteId && !job.quote_id) {
          try {
            await supabase
              .from('jobs')
              .update({ quote_id: resolvedQuoteId })
              .eq('id', job.id)
              .eq('org_id', orgId)
            updatedJob.quote_id = resolvedQuoteId
          } catch {
            // Non-blocking in older schemas
          }
        }

        const loadQuoteBreakdown = async (qId: string, expectedTotal?: number) => {
          const { data: quoteItems } = await supabase
            .from('quote_items')
            .select('*')
            .eq('quote_id', qId)

          const { data: q } = await supabase
            .from('quotes')
            .select('title, total, subtotal, tax, discount, items')
            .eq('id', qId)
            .maybeSingle()

          let resolvedItems: Array<{ description: string; quantity: number; unit_price: number }> = []
          if (quoteItems && quoteItems.length > 0) {
            resolvedItems = quoteItems.map((it: any) => ({
              description: it.description,
              quantity: Number(it.quantity) || 1,
              unit_price: Number(it.unit_price) || 0
            }))
          } else if (q && Array.isArray(q.items) && q.items.length > 0) {
            resolvedItems = q.items.map((it: any) => ({
              description: it.description || q.title || job.title,
              quantity: Number(it.quantity) || 1,
              unit_price: Number(it.unit_price ?? it.total) || Number(q.total)
            }))
          } else if (q && Number(q.total) > 0) {
            resolvedItems = [{
              description: q.title || job.title || 'Completed Field Service',
              quantity: 1,
              unit_price: Number(q.total)
            }]
          }

          if (resolvedItems.length === 0 || !q) {
            return { items: resolvedItems, taxRate: 0, discountAmount: 0, title: q?.title || null }
          }

          const itemsSum = resolvedItems.reduce(
            (s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1),
            0
          )
          const quoteTotal = Number(q.total) || itemsSum
          const qDiscount = Number(q.discount) || 0
          const qTax = Number(q.tax) || 0
          const qSubtotal = Number(q.subtotal) || itemsSum
          const taxable = Math.max(0, qSubtotal - qDiscount)
          const qTaxRate = qTax > 0 && taxable > 0 ? Math.round((qTax / taxable) * 10000) / 100 : 0

          if (typeof expectedTotal === 'number' && expectedTotal > 0) {
            // Preserve rich itemized lines only if they reproduce the exact finalAmount; otherwise respect manual edit
            if (Math.abs(itemsSum - expectedTotal) < 0.01) {
              return { items: resolvedItems, taxRate: 0, discountAmount: 0, title: q.title || null }
            }
            if (Math.abs(quoteTotal - expectedTotal) < 0.01) {
              const estTax = Math.round(Math.max(0, itemsSum - Math.min(itemsSum, qDiscount)) * (qTaxRate / 100) * 100) / 100
              const estTotal = Math.round((itemsSum - Math.min(itemsSum, qDiscount) + estTax) * 100) / 100
              if (Math.abs(estTotal - expectedTotal) < 0.01) {
                return { items: resolvedItems, taxRate: qTaxRate, discountAmount: qDiscount, title: q.title || null }
              }
            }
            return {
              items: [{
                description: q.title || job.title || 'Completed Field Service',
                quantity: 1,
                unit_price: expectedTotal
              }],
              taxRate: 0,
              discountAmount: 0,
              title: q.title || null
            }
          }

          if (Math.abs(itemsSum - quoteTotal) >= 0.01 && (qTax > 0 || qDiscount > 0)) {
            return { items: resolvedItems, taxRate: qTaxRate, discountAmount: qDiscount, title: q.title || null }
          }

          return { items: resolvedItems, taxRate: 0, discountAmount: 0, title: q.title || null }
        }

        // 1. Explicit items passed from Completion Dialog
        if (paramItems && paramItems.length > 0) {
          invoiceItems = paramItems.map(it => ({
            description: it.description || 'Completed Field Service',
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0
          }))
        } else if (typeof finalAmount === 'number' && finalAmount > 0) {
          // 2. Explicit final total entered/confirmed on completion (preserving quote items when total matches)
          if (resolvedQuoteId) {
            const breakdown = await loadQuoteBreakdown(resolvedQuoteId, finalAmount)
            if (breakdown.items.length > 0) {
              invoiceItems = breakdown.items
              invoiceTaxRate = breakdown.taxRate
              invoiceDiscountAmount = breakdown.discountAmount
            }
          }
          if (invoiceItems.length === 0) {
            invoiceItems = [
              {
                description: job.title || 'Completed Field Service',
                quantity: 1,
                unit_price: finalAmount
              }
            ]
          }
        } else {
          // 3. Line items from job_items table
          const { data: jobItems } = await supabase
            .from('job_items')
            .select('*')
            .eq('job_id', jobId)
            .eq('org_id', orgId)

          if (jobItems && jobItems.length > 0) {
            invoiceItems = jobItems.map((it: any) => ({
              description: it.description,
              quantity: Number(it.quantity) || 1,
              unit_price: Number(it.unit_price) || 0
            }))
          } else if (resolvedQuoteId) {
            // 4. Fallback to linked or auto-matched approved quote
            const breakdown = await loadQuoteBreakdown(resolvedQuoteId)
            invoiceItems = breakdown.items
            invoiceTaxRate = breakdown.taxRate
            invoiceDiscountAmount = breakdown.discountAmount
          }

          // 5. If still no items, check service catalog price
          if (invoiceItems.length === 0 && job.service_id) {
            try {
              const { data: svc } = await supabase
                .from('services')
                .select('price, name')
                .eq('id', job.service_id)
                .maybeSingle()
              if (svc && typeof svc.price === 'number' && svc.price > 0) {
                invoiceItems = [
                  {
                    description: svc.name || job.title || 'Completed Field Service',
                    quantity: 1,
                    unit_price: svc.price
                  }
                ]
              }
            } catch {
              // Non-blocking fallback
            }
          }
        }

        // CRITICAL INVARIANT: Never auto-create a $0.00 invoice!
        // Only generate an invoice if billable total is greater than zero.
        const totalBillable = invoiceItems.reduce(
          (sum, it) => sum + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1),
          0
        )

        if (totalBillable > 0) {
          const { createInvoice } = await import('../payments/invoice-manager.ts')
          // Safe default due date: Net 14 Days from completion (never immediate past due)
          const resolvedDueDate = paramDueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
          const invRes = await createInvoice(supabase, {
            orgId,
            contactId: job.contact_id,
            jobId: job.id,
            quoteId: resolvedQuoteId || undefined,
            title: `Invoice for Job #${job.job_number}`,
            description: job.description || `Field service invoice for ${job.title}`,
            items: invoiceItems,
            taxRate: invoiceTaxRate,
            discountAmount: invoiceDiscountAmount,
            dueDate: resolvedDueDate
          })

          if (invRes.success && invRes.invoice) {
            draftInvoice = invRes.invoice
            await supabase.from('notifications').insert({
              org_id: orgId,
              title: 'Draft Invoice Ready',
              message: `Job #${job.job_number} completed. Draft Invoice #${invRes.invoice.invoice_number} ($${invRes.invoice.total}) is ready for review.`,
              link: '/client/invoices'
            })
          }
        } else {
          console.info(`[JOB_COMPLETED] Job #${job.job_number} completed without fixed price. Waiting for owner to finalize invoice amount.`)
        }
      }
    } catch (invErr) {
      console.warn('[AUTO_INVOICE_GENERATION_WARNING] Failed to generate draft invoice:', invErr)
    }

    try {
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
          completed_at: nowIso
        }, {
          entityId: job.id,
          contactId: job.contact_id,
          leadId: job.lead_id || undefined
        })
      )
    } catch (automationErr) {
      console.warn('[JOB_COMPLETED_AUTOMATION_WARNING]', automationErr)
    }

    // Starter Pass Milestone Notification (Situation-Aware & Dopamine Milestones)
    try {
      const { isPracticeJob } = await import('./practice-job.ts')
      if (!isPracticeJob(job)) {
        const { SubscriptionService } = await import('../billing/subscription-service.ts')
        const entitlement = await SubscriptionService.getEntitlement(supabase, orgId).catch(() => null)
        
        if (!entitlement || entitlement.planId === 'free' || entitlement.status === 'starter_limit_reached') {
          const starterUsage = await SubscriptionService.getFreeTierJobUsage(supabase, orgId)
          const jobRev = Number(draftInvoice?.total ?? draftInvoice?.total_amount ?? draftInvoice?.amount ?? 0)
          const milestone = Math.min(3, starterUsage.completedJobsCount)
          const remaining = Math.max(0, 3 - starterUsage.completedJobsCount)
          const cumulativeRevenue = starterUsage.totalRevenueEarned + (draftInvoice?.status === 'paid' ? 0 : jobRev)

          let customerName = 'Customer'
          if (job.contact_id) {
            const { data: c } = await supabase.from('contacts').select('name').eq('id', job.contact_id).maybeSingle()
            if (c?.name) customerName = c.name
          }

          const { notifyOwner } = await import('../notifications/notification-service.ts')
          await notifyOwner(supabase, {
            event: 'starter_job_completed',
            organizationId: orgId,
            data: {
              customerName,
              jobRevenue: jobRev,
              totalRevenue: cumulativeRevenue,
              jobMilestone: milestone,
              remainingJobs: remaining,
              jobId: job.id,
              upgradeUrl: '/client/billing?reason=starter_limit'
            }
          }).catch(() => {})
        }
      }
    } catch (milestoneErr) {
      console.warn('[STARTER_PASS_COMPLETION_ALERT_WARNING]', milestoneErr)
    }
  }

  return { success: true, job: updatedJob, invoice: draftInvoice }
}

/**
 * Bridges an Accepted Quote directly into a Scheduled Field Service Job
 */
export async function convertQuoteToJob(
  supabase: SupabaseClient,
  params: {
    quoteId: string
    orgId: string
    scheduledStart?: string
    scheduledEnd?: string
    assignedTo?: string
  }
): Promise<{ success: boolean; job?: any; invoice?: any; error?: string }> {
  const { quoteId, orgId, scheduledStart, scheduledEnd, assignedTo } = params

  // 1. Idempotency: Check if quote is already linked to an active/existing job
  let existingJobQuery: any = supabase
    .from('jobs')
    .select('*')
    .eq('org_id', orgId)
    .eq('quote_id', quoteId)

  if (typeof existingJobQuery?.is === 'function') {
    existingJobQuery = existingJobQuery.is('deleted_at', null)
  }

  const { data: rawExistingJob } = await existingJobQuery
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const existingJob = (rawExistingJob && !rawExistingJob.deleted_at) ? rawExistingJob : null

  if (existingJob) {
    return { success: true, job: existingJob }
  }

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

  // Check if open appointment exists for this customer
  const { data: openAppt } = await supabase
    .from('appointments')
    .select('id, start_time, end_time')
    .eq('org_id', orgId)
    .eq('contact_id', quote.contact_id)
    .in('status', ['requested', 'scheduled', 'confirmed'])
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle()

  const finalStart = scheduledStart || openAppt?.start_time || new Date().toISOString()
  const finalEnd = scheduledEnd || openAppt?.end_time || undefined

  const jobResult = await createJob(supabase, {
    orgId,
    contactId: quote.contact_id,
    leadId: quote.lead_id,
    quoteId: quote.id,
    appointmentId: openAppt?.id || undefined,
    assignedTo,
    title: quote.title || `Service for Quote #${quote.quote_number}`,
    description: quote.description,
    scheduledStart: finalStart,
    scheduledEnd: finalEnd,
    items: jobItems,
    notes: quote.notes
  })

  if (jobResult.success && openAppt?.id) {
    await supabase
      .from('appointments')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      })
      .eq('id', openAppt.id)
      .eq('org_id', orgId)
  }

  return jobResult
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
  let { data: job, error: jobError } = await supabase
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
      arrived_at,
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
        google_review_url,
        license_number,
        tracking_mode,
        tracking_geofence_miles,
        timezone
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

  // Graceful fallback if newer organization columns are not yet in remote schema
  if (jobError && (jobError.code === '42703' || jobError.message?.toLowerCase().includes('does not exist'))) {
    const baseRes = await supabase
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
        arrived_at,
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
          google_review_url,
          timezone
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
    job = baseRes.data as any
    jobError = baseRes.error as any
  }

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
      logoUrl: org?.logo_url || null,
      licenseNumber: org?.license_number || null,
      trackingMode: org?.tracking_mode || 'milestone',
      trackingGeofenceMiles: org?.tracking_geofence_miles ? Number(org.tracking_geofence_miles) : 5,
      timezone: org?.timezone || 'America/Chicago'
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
): Promise<{ success: boolean; job?: any; invoice?: any; error?: string; upgradeRequired?: boolean; code?: string; checkoutUrl?: string }> {
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

  // P0 Guard: Cannot restart or record timestamps on completed or cancelled jobs
  if (['completed', 'cancelled'].includes(job.status) && action !== 'completed') {
    return { success: false, error: `Cannot record timestamp or restart an already ${job.status} job.` }
  }

  // Finish-Line Sunk Cost Paywall Guard (Starter Pass: Job #4+)
  // Advancing status to active/dispatched/completed states requires Pro once 3 free jobs are completed
  const { isPracticeJob } = await import('./practice-job.ts')
  if (!isPracticeJob(job) && job.status !== 'completed') {
    const { SubscriptionService } = await import('../billing/subscription-service.ts')
    const entitlement = await SubscriptionService.getEntitlement(supabase, orgId).catch(() => null)
    const isPaidPro = entitlement?.isEntitled && ['solo', 'multi_crew', 'fleet', 'captodesk_standard'].includes(entitlement?.planId || '')

    if (!isPaidPro) {
      const starterUsage = await SubscriptionService.getFreeTierJobUsage(supabase, orgId).catch(() => null)
      if (starterUsage?.isLimitReached) {
        return {
          success: false,
          upgradeRequired: true,
          code: 'STARTER_LIMIT_REACHED',
          error: "You've completed your 3 free starter jobs. Upgrade to Pro ($99/mo) to dispatch crew and manage additional jobs.",
          checkoutUrl: '/client/billing?reason=starter_limit',
          job
        }
      }
    }
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

