import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTelnyxSms } from '../telnyx.ts'
import { createEventEnvelope } from '../automations/events.ts'
import { handleAutomationEvent } from '../automations/engine.ts'

export interface Crew {
  id: string
  org_id: string
  name: string
  color_code: string
  color?: string
  van_identifier?: string | null
  phone_number?: string | null
  service_area?: string | null
  crew_lead_id?: string | null
  member_ids: string[]
  is_active: boolean
  created_at?: string
  updated_at?: string
  crew_lead?: {
    id: string
    full_name?: string | null
    email?: string | null
  } | null
  members?: Array<{
    id: string
    full_name?: string | null
    email?: string | null
  }>
  active_jobs_count?: number
  today_jobs_count?: number
}

export interface CreateCrewInput {
  orgId: string
  name: string
  colorCode?: string
  phoneNumber?: string | null
  serviceArea?: string | null
  crewLeadId?: string | null
  memberIds?: string[]
}

export interface UpdateCrewInput {
  name?: string
  colorCode?: string
  phoneNumber?: string | null
  serviceArea?: string | null
  crewLeadId?: string | null
  memberIds?: string[]
  isActive?: boolean
}

export interface CrewPerformanceMetric {
  crewId: string
  crewName: string
  colorCode: string
  phoneNumber?: string | null
  serviceArea?: string | null
  totalJobs: number
  completedJobs: number
  activeJobs: number
  totalRevenue: number
  avgDurationMinutes: number
}

/**
 * Lists all crews for a tenant organization
 */
export async function listCrews(
  supabase: SupabaseClient,
  orgId: string,
  options: { includeInactive?: boolean } = {}
): Promise<Crew[]> {
  try {
    let query = supabase
      .from('crews')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })

    if (!options.includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data: crews, error } = await query

    if (error) {
      console.warn('[LIST_CREWS_WARNING]', error.message)
      return []
    }

    if (!crews || crews.length === 0) {
      return []
    }

    // Collect all profile IDs (leads and members)
    const allProfileIds = new Set<string>()
    for (const c of crews) {
      if (c.crew_lead_id) allProfileIds.add(c.crew_lead_id)
      if (Array.isArray(c.member_ids)) {
        for (const mid of c.member_ids) {
          if (mid) allProfileIds.add(mid)
        }
      }
    }

    let profileMap: Record<string, { id: string; full_name?: string | null; email?: string | null }> = {}
    if (allProfileIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', Array.from(allProfileIds))

      if (profiles) {
        for (const p of profiles) {
          profileMap[p.id] = p
        }
      }
    }

    return crews.map((c: any) => ({
      ...c,
      member_ids: Array.isArray(c.member_ids) ? c.member_ids : [],
      crew_lead: c.crew_lead_id ? profileMap[c.crew_lead_id] || null : null,
      members: Array.isArray(c.member_ids)
        ? c.member_ids.map((id: string) => profileMap[id]).filter(Boolean)
        : []
    }))
  } catch (err) {
    console.warn('[LIST_CREWS_EXCEPTION]', err)
    return []
  }
}

/**
 * Creates a new crew or van
 */
export async function createCrew(
  supabase: SupabaseClient,
  input: CreateCrewInput
): Promise<{ success: boolean; crew?: Crew; error?: string }> {
  const {
    orgId,
    name,
    colorCode = '#3B82F6',
    phoneNumber,
    serviceArea,
    crewLeadId,
    memberIds = []
  } = input

  if (!name || !name.trim()) {
    return { success: false, error: 'Crew name is required' }
  }

  const { data, error } = await supabase
    .from('crews')
    .insert({
      org_id: orgId,
      name: name.trim(),
      color_code: colorCode.trim(),
      phone_number: phoneNumber?.trim() || null,
      service_area: serviceArea?.trim() || null,
      crew_lead_id: crewLeadId || null,
      member_ids: Array.isArray(memberIds) ? memberIds : [],
      is_active: true
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, crew: data }
}

/**
 * Updates an existing crew
 */
export async function updateCrew(
  supabase: SupabaseClient,
  orgId: string,
  crewId: string,
  input: UpdateCrewInput
): Promise<{ success: boolean; crew?: Crew; error?: string }> {
  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString()
  }

  if (input.name !== undefined) updatePayload.name = input.name.trim()
  if (input.colorCode !== undefined) updatePayload.color_code = input.colorCode.trim()
  if (input.phoneNumber !== undefined) updatePayload.phone_number = input.phoneNumber?.trim() || null
  if (input.serviceArea !== undefined) updatePayload.service_area = input.serviceArea?.trim() || null
  if (input.crewLeadId !== undefined) updatePayload.crew_lead_id = input.crewLeadId || null
  if (input.memberIds !== undefined) updatePayload.member_ids = input.memberIds
  if (input.isActive !== undefined) updatePayload.is_active = input.isActive

  const { data, error } = await supabase
    .from('crews')
    .update(updatePayload)
    .eq('id', crewId)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, crew: data }
}

/**
 * Deactivates or deletes a crew
 */
export async function deleteCrew(
  supabase: SupabaseClient,
  orgId: string,
  crewId: string
): Promise<{ success: boolean; error?: string }> {
  // Soft deactivate so historical job references stay intact
  const { error } = await supabase
    .from('crews')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', crewId)
    .eq('org_id', orgId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Checks for crew scheduling conflicts (overlap with existing jobs/appointments)
 */
export async function checkCrewConflict(
  supabase: SupabaseClient,
  params: {
    orgId: string
    crewId: string
    startTime: string
    endTime?: string | null
    excludeJobId?: string
    excludeAppointmentId?: string
  }
): Promise<{ hasConflict: boolean; conflictType?: 'job' | 'appointment'; conflictingTitle?: string }> {
  const { orgId, crewId, startTime, endTime, excludeJobId, excludeAppointmentId } = params
  if (!crewId) return { hasConflict: false }

  const startMs = new Date(startTime).getTime()
  // Default duration: 60 minutes if endTime missing
  const endMs = endTime ? new Date(endTime).getTime() : startMs + 60 * 60 * 1000

  // 1. Check overlapping jobs for this crew
  let jobQuery = supabase
    .from('jobs')
    .select('id, job_number, title, scheduled_start, scheduled_end, status')
    .eq('org_id', orgId)
    .eq('crew_id', crewId)
    .in('status', ['scheduled', 'confirmed', 'en_route', 'in_progress'])
    .is('deleted_at', null)

  if (excludeJobId) {
    jobQuery = jobQuery.neq('id', excludeJobId)
  }

  const { data: jobs } = await jobQuery
  if (jobs && jobs.length > 0) {
    for (const j of jobs) {
      const jStart = new Date(j.scheduled_start).getTime()
      const jEnd = j.scheduled_end ? new Date(j.scheduled_end).getTime() : jStart + 60 * 60 * 1000
      if (startMs < jEnd && endMs > jStart) {
        return {
          hasConflict: true,
          conflictType: 'job',
          conflictingTitle: `Job #${j.job_number || ''} ${j.title || ''}`.trim()
        }
      }
    }
  }

  // 2. Check overlapping appointments for this crew
  let aptQuery = supabase
    .from('appointments')
    .select('id, title, start_time, end_time, status')
    .eq('org_id', orgId)
    .eq('crew_id', crewId)
    .in('status', ['requested', 'confirmed', 'scheduled'])

  if (excludeAppointmentId) {
    aptQuery = aptQuery.neq('id', excludeAppointmentId)
  }

  const { data: apts } = await aptQuery
  if (apts && apts.length > 0) {
    for (const a of apts) {
      const aStart = new Date(a.start_time).getTime()
      const aEnd = a.end_time ? new Date(a.end_time).getTime() : aStart + 60 * 60 * 1000
      if (startMs < aEnd && endMs > aStart) {
        return {
          hasConflict: true,
          conflictType: 'appointment',
          conflictingTitle: a.title || 'Scheduled Appointment'
        }
      }
    }
  }

  return { hasConflict: false }
}

/**
 * 1-Tap Reassignment of a Job to a new Crew with optional SMS dispatch
 */
export async function reassignJobCrew(
  supabase: SupabaseClient,
  params: {
    orgId: string
    jobId: string
    crewId?: string | null
    notifyCrew?: boolean
    notifyCustomer?: boolean
  }
): Promise<{ success: boolean; job?: any; conflictWarning?: string; error?: string }> {
  const { orgId, jobId, crewId, notifyCrew = true, notifyCustomer = false } = params

  // 1. Fetch current job
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      id, job_number, title, description, scheduled_start, scheduled_end,
      tracking_token, contact_id,
      contact:contacts(id, name, phone, address),
      crew:crews!crew_id(id, name, color_code, phone_number)
    `)
    .eq('id', jobId)
    .eq('org_id', orgId)
    .single()

  if (jobError || !job) {
    return { success: false, error: 'Job not found' }
  }

  // 2. Conflict check if reassigning to a real crew
  let conflictWarning: string | undefined
  if (crewId) {
    const conflict = await checkCrewConflict(supabase, {
      orgId,
      crewId,
      startTime: job.scheduled_start,
      endTime: job.scheduled_end,
      excludeJobId: jobId
    })
    if (conflict.hasConflict) {
      conflictWarning = `Assigned crew has overlapping booking: ${conflict.conflictingTitle}`
    }
  }

  // 3. Update job with new crew_id
  const { data: updatedJob, error: updateError } = await supabase
    .from('jobs')
    .update({
      crew_id: crewId || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId)
    .eq('org_id', orgId)
    .select(`
      *,
      contact:contacts(id, name, phone, address),
      crew:crews!crew_id(id, name, color_code, phone_number)
    `)
    .single()

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // 4. Fetch Organization details for SMS sender
  const { data: org } = await supabase
    .from('organizations')
    .select('name, telnyx_phone_number, owner_phone')
    .eq('id', orgId)
    .single()

  const senderNumber = org?.telnyx_phone_number || org?.owner_phone

  const jobContact = (Array.isArray(job.contact) ? job.contact[0] : job.contact) as { name?: string; phone?: string; address?: string } | null
  const prevCrew = (Array.isArray(job.crew) ? job.crew[0] : job.crew) as { id?: string; name?: string } | null
  const updatedCrew = (Array.isArray(updatedJob.crew) ? updatedJob.crew[0] : updatedJob.crew) as { id?: string; name?: string } | null

  // 5. Notify Crew via SMS if configured
  if (notifyCrew && crewId && senderNumber) {
    const { data: targetCrew } = await supabase
      .from('crews')
      .select('name, phone_number, crew_lead_id')
      .eq('id', crewId)
      .single()

    let crewRecipientPhone = targetCrew?.phone_number

    // Fall back to crew lead's phone if crew phone not set
    if (!crewRecipientPhone && targetCrew?.crew_lead_id) {
      const { data: lead } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('id', targetCrew.crew_lead_id)
        .single()
      if (lead?.phone) crewRecipientPhone = lead.phone
    }

    if (crewRecipientPhone) {
      const formattedDate = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(job.scheduled_start))

      const text = `Dispatch Alert (${org?.name || 'CaptoDesk'}): Job #${job.job_number || ''} "${job.title}" has been assigned to your route for ${formattedDate}. Location: ${jobContact?.address || 'See app'}.`

      await sendTelnyxSms({
        to: crewRecipientPhone,
        from: senderNumber,
        text
      }).catch(err => console.warn('[CREW_REASSIGN_SMS_FAILED]', err))
    }
  }

  // 6. Notify Customer if requested
  if (notifyCustomer && jobContact?.phone && senderNumber) {
    const crewName = updatedCrew?.name || 'our service team'
    const trackingUrl = job.tracking_token
      ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.corvexastudio.com'}/track/${job.tracking_token}`
      : ''

    const text = `Hi ${jobContact.name || 'there'}! ${crewName} from ${org?.name || 'our team'} has been assigned to your scheduled service.${trackingUrl ? ` Track live updates: ${trackingUrl}` : ''}`

    await sendTelnyxSms({
      to: jobContact.phone,
      from: senderNumber,
      text
    }).catch(err => console.warn('[CUSTOMER_REASSIGN_SMS_FAILED]', err))
  }

  // 7. Emit Domain Automation Event
  await handleAutomationEvent(
    supabase,
    createEventEnvelope('job.reassigned', orgId, {
      job_id: job.id,
      job_number: job.job_number,
      previous_crew_id: prevCrew?.id || null,
      new_crew_id: crewId || null,
      contact_id: job.contact_id
    }, {
      entityId: job.id,
      contactId: job.contact_id
    })
  ).catch(err => console.warn('[REASSIGN_AUTOMATION_EVENT_FAILED]', err))

  return { success: true, job: updatedJob, conflictWarning }
}

/**
 * 1-Tap Reassignment of an Appointment to a new Crew
 */
export async function reassignAppointmentCrew(
  supabase: SupabaseClient,
  params: {
    orgId: string
    appointmentId: string
    crewId?: string | null
    notifyCrew?: boolean
  }
): Promise<{ success: boolean; appointment?: any; conflictWarning?: string; error?: string }> {
  const { orgId, appointmentId, crewId, notifyCrew = true } = params

  const { data: apt, error: aptError } = await supabase
    .from('appointments')
    .select(`
      id, title, start_time, end_time, contact_id,
      contact:contacts(id, name, phone, address)
    `)
    .eq('id', appointmentId)
    .eq('org_id', orgId)
    .single()

  if (aptError || !apt) {
    return { success: false, error: 'Appointment not found' }
  }

  let conflictWarning: string | undefined
  if (crewId) {
    const conflict = await checkCrewConflict(supabase, {
      orgId,
      crewId,
      startTime: apt.start_time,
      endTime: apt.end_time,
      excludeAppointmentId: appointmentId
    })
    if (conflict.hasConflict) {
      conflictWarning = `Assigned crew has overlapping booking: ${conflict.conflictingTitle}`
    }
  }

  const { data: updatedApt, error: updateError } = await supabase
    .from('appointments')
    .update({
      crew_id: crewId || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', appointmentId)
    .eq('org_id', orgId)
    .select(`
      *,
      contact:contacts(id, name, phone, address),
      crew:crews!crew_id(id, name, color_code, phone_number)
    `)
    .single()

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  return { success: true, appointment: updatedApt, conflictWarning }
}

/**
 * Calculates per-crew performance metrics (job count, revenue, avg time on site)
 */
export async function getCrewPerformanceMetrics(
  supabase: SupabaseClient,
  orgId: string,
  timeframeDays = 30
): Promise<CrewPerformanceMetric[]> {
  const crews = await listCrews(supabase, orgId, { includeInactive: false })
  if (crews.length === 0) return []

  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - timeframeDays)
  const sinceIso = sinceDate.toISOString()

  // Fetch all jobs in timeframe for this org
  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      id, crew_id, status, scheduled_start, arrived_at, started_at, completed_at,
      items:job_items(quantity, unit_price)
    `)
    .eq('org_id', orgId)
    .gte('scheduled_start', sinceIso)
    .is('deleted_at', null)

  const metricsMap: Record<string, CrewPerformanceMetric> = {}
  for (const c of crews) {
    metricsMap[c.id] = {
      crewId: c.id,
      crewName: c.name,
      colorCode: c.color_code,
      phoneNumber: c.phone_number,
      serviceArea: c.service_area,
      totalJobs: 0,
      completedJobs: 0,
      activeJobs: 0,
      totalRevenue: 0,
      avgDurationMinutes: 0
    }
  }

  const durationSums: Record<string, { totalMinutes: number; count: number }> = {}

  if (jobs) {
    for (const j of jobs) {
      if (!j.crew_id || !metricsMap[j.crew_id]) continue
      const m = metricsMap[j.crew_id]
      m.totalJobs += 1

      if (j.status === 'completed') {
        m.completedJobs += 1

        // Sum revenue from job items
        if (Array.isArray(j.items)) {
          const jobSum = j.items.reduce(
            (acc: number, it: any) => acc + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
            0
          )
          m.totalRevenue += jobSum
        }

        // Time on site calculation
        if (j.started_at && j.completed_at) {
          const diffMinutes = Math.max(
            1,
            Math.round((new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 60000)
          )
          if (!durationSums[j.crew_id]) durationSums[j.crew_id] = { totalMinutes: 0, count: 0 }
          durationSums[j.crew_id].totalMinutes += diffMinutes
          durationSums[j.crew_id].count += 1
        }
      } else if (['scheduled', 'confirmed', 'en_route', 'in_progress'].includes(j.status)) {
        m.activeJobs += 1
      }
    }
  }

  for (const [crewId, dur] of Object.entries(durationSums)) {
    if (metricsMap[crewId] && dur.count > 0) {
      metricsMap[crewId].avgDurationMinutes = Math.round(dur.totalMinutes / dur.count)
    }
  }

  return Object.values(metricsMap)
}

/**
 * Morning 7:00 AM Daily Route Broadcast SMS
 * Sends each active crew their daily itinerary
 */
export async function sendDailyCrewScheduleBroadcast(
  supabase: SupabaseClient,
  params: {
    orgId: string
    targetCrewId?: string
    dateStr?: string // "YYYY-MM-DD"
  }
): Promise<{ totalSent: number; details: Array<{ crewName: string; phone: string; jobCount: number; success: boolean }> }> {
  const { orgId, targetCrewId, dateStr } = params

  const { data: org } = await supabase
    .from('organizations')
    .select('name, telnyx_phone_number, owner_phone, timezone')
    .eq('id', orgId)
    .single()

  const senderNumber = org?.telnyx_phone_number || org?.owner_phone
  if (!senderNumber) {
    return { totalSent: 0, details: [] }
  }

  const orgTimezone = org?.timezone || 'America/Chicago'
  const targetDate = dateStr || new Intl.DateTimeFormat('en-CA', { timeZone: orgTimezone }).format(new Date())

  // Date range for target day
  const startOfDay = new Date(`${targetDate}T00:00:00.000Z`).toISOString()
  const endOfDay = new Date(`${targetDate}T23:59:59.999Z`).toISOString()

  let crews = await listCrews(supabase, orgId, { includeInactive: false })
  if (targetCrewId) {
    crews = crews.filter(c => c.id === targetCrewId)
  }

  const details: Array<{ crewName: string; phone: string; jobCount: number; success: boolean }> = []
  let totalSent = 0

  for (const crew of crews) {
    // Resolve destination phone
    let destPhone = crew.phone_number
    if (!destPhone && crew.crew_lead_id) {
      const { data: lead } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', crew.crew_lead_id)
        .single()
      if (lead?.phone) destPhone = lead.phone
    }

    if (!destPhone) continue

    // Query today's jobs for this crew
    const { data: jobs } = await supabase
      .from('jobs')
      .select(`
        id, job_number, title, scheduled_start,
        contact:contacts(name, phone, address)
      `)
      .eq('org_id', orgId)
      .eq('crew_id', crew.id)
      .gte('scheduled_start', startOfDay)
      .lte('scheduled_start', endOfDay)
      .is('deleted_at', null)
      .order('scheduled_start', { ascending: true })

    if (!jobs || jobs.length === 0) continue

    // Format daily route schedule text
    const lines = jobs.map((j: any, idx: number) => {
      const timeStr = new Intl.DateTimeFormat('en-US', {
        timeZone: orgTimezone,
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(j.scheduled_start))
      const addr = j.contact?.address ? ` (${j.contact.address.split(',')[0]})` : ''
      return `${idx + 1}. ${timeStr} - #${j.job_number || ''} ${j.title}${addr}`
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.corvexastudio.com'
    const smsBody = `Good morning ${crew.name}! You have ${jobs.length} job${jobs.length > 1 ? 's' : ''} scheduled today:\n${lines.join('\n')}\nOpen field dispatch: ${appUrl}/client/field`

    try {
      await sendTelnyxSms({
        to: destPhone,
        from: senderNumber,
        text: smsBody
      })
      totalSent += 1
      details.push({
        crewName: crew.name,
        phone: destPhone,
        jobCount: jobs.length,
        success: true
      })
    } catch (sendErr) {
      console.warn(`[DAILY_ROUTE_BROADCAST_FAILED] Crew: ${crew.name}`, sendErr)
      details.push({
        crewName: crew.name,
        phone: destPhone,
        jobCount: jobs.length,
        success: false
      })
    }
  }

  // Update organization broadcast record
  await supabase
    .from('organizations')
    .update({ last_daily_crew_schedule_sent_at: new Date().toISOString() })
    .eq('id', orgId)

  return { totalSent, details }
}
