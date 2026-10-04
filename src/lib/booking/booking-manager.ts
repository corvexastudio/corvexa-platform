import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateAvailableSlots,
  formatSlotDisplayTime,
  doesIntervalOverlap,
  type OrganizationBookingConfig,
  type ServiceItem,
  type ExistingAppointment
} from './availability.ts'
import { normalizePhoneToE164 } from '../telephony/phone-normalizer.ts'
import { sendTelnyxSms } from '../telnyx.ts'
import { createEventEnvelope } from '../automations/events.ts'
import { handleAutomationEvent } from '../automations/engine.ts'
import { evaluateAndApplyStopConditions } from '../automations/stop-conditions.ts'

export interface CreateBookingInput {
  orgId: string
  serviceId?: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  customerAddress?: string
  startTime: string // ISO string
  notes?: string
  source?: 'booking_page' | 'inbox' | 'manual' | 'phone' | 'missed_call'
  appBaseUrl?: string
}

export interface BookingResult {
  success: boolean
  appointment?: any
  manageToken?: string
  manageUrl?: string
  status?: string
  error?: string
}

/**
 * Creates a new booking atomically.
 * Verifies slot availability, upserts contact, creates lead, sets booking state,
 * dispatches confirmation SMS, and schedules pre-appointment reminders.
 */
export async function createBooking(
  supabase: SupabaseClient,
  input: CreateBookingInput
): Promise<BookingResult> {
  const {
    orgId,
    serviceId,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    startTime,
    notes,
    source = 'booking_page',
    appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com'
  } = input

  // 1. Validate customer phone
  const normalizedPhone = normalizePhoneToE164(customerPhone)
  if (!normalizedPhone.isValid || !normalizedPhone.e164) {
    return { success: false, error: 'Invalid phone number format' }
  }

  // 2. Fetch organization config
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single()

  if (orgError || !org) {
    return { success: false, error: 'Organization not found' }
  }

  const timezone = org.timezone || 'America/Chicago'
  const bufferMinutes = org.buffer_minutes ?? 15
  const bufferMs = bufferMinutes * 60 * 1000

  // 3. Resolve Service (or default service)
  let service: ServiceItem | null = null
  if (serviceId) {
    const { data: svc } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (svc) service = svc
  }

  if (!service) {
    // Check for any active service or fallback default
    const { data: defaultSvc } = await supabase
      .from('services')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (defaultSvc) {
      service = defaultSvc
    }
  }

  const activeService: ServiceItem = service || {
    id: 'default-service',
    name: 'Standard Consultation / Service Call',
    duration_minutes: org.default_duration_minutes || 60,
    requires_address: true,
    is_active: true
  }

  if (activeService.requires_address && !customerAddress?.trim()) {
    return { success: false, error: 'Service address is required for this service' }
  }

  const durationMinutes = activeService.duration_minutes || 60
  const durationMs = durationMinutes * 60 * 1000
  const slotStartMs = new Date(startTime).getTime()
  const slotEndMs = slotStartMs + durationMs
  const endTime = new Date(slotEndMs).toISOString()

  // 4. Overlap Check against active appointments
  const { data: existingAppts } = await supabase
    .from('appointments')
    .select('id, start_time, end_time, status')
    .eq('org_id', orgId)
    .in('status', ['requested', 'confirmed', 'scheduled'])

  if (existingAppts && existingAppts.length > 0) {
    for (const apt of existingAppts) {
      const aptStart = new Date(apt.start_time).getTime()
      const aptEnd = apt.end_time ? new Date(apt.end_time).getTime() : aptStart + durationMs
      if (doesIntervalOverlap(slotStartMs, slotEndMs, aptStart, aptEnd, bufferMs)) {
        return { success: false, error: 'This time slot is no longer available. Please select another time.' }
      }
    }
  }

  // 5. Upsert Contact
  let contactId: string | null = null
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, name, email, address, tags')
    .eq('org_id', orgId)
    .eq('phone', normalizedPhone.e164)
    .maybeSingle()

  if (existingContact) {
    contactId = existingContact.id
    const currentTags: string[] = existingContact.tags || []
    const updatedTags = Array.from(new Set([...currentTags, 'booking', 'lead']))
    await supabase
      .from('contacts')
      .update({
        name: customerName || existingContact.name,
        email: customerEmail || existingContact.email,
        address: customerAddress || existingContact.address,
        tags: updatedTags,
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId)
  } else {
    const { data: newContact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        org_id: orgId,
        name: customerName,
        phone: normalizedPhone.e164,
        email: customerEmail || null,
        address: customerAddress || null,
        tags: ['lead', 'booking']
      })
      .select('id')
      .single()

    if (contactError || !newContact) {
      return { success: false, error: 'Failed to create customer contact' }
    }
    contactId = newContact.id
  }

  // 6. Create or link Lead
  let leadId: string | null = null
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id')
    .eq('org_id', orgId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingLead) {
    leadId = existingLead.id
    await supabase
      .from('leads')
      .update({
        status: 'booked',
        service_needed: activeService.name,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
  } else {
    const { data: newLead } = await supabase
      .from('leads')
      .insert({
        org_id: orgId,
        contact_id: contactId,
        source,
        status: 'booked',
        service_needed: activeService.name
      })
      .select('id')
      .single()
    if (newLead) leadId = newLead.id
  }

  // 7. Determine Initial State & Generate Secure Manage Token
  const isInstant = org.booking_mode !== 'request'
  const initialStatus = isInstant ? 'confirmed' : 'requested'
  const manageToken = randomBytes(24).toString('hex')
  const manageUrl = `${appBaseUrl}/book/manage/${manageToken}`

  // 8. Insert Appointment
  const appointmentPayload: Record<string, any> = {
    org_id: orgId,
    contact_id: contactId,
    service_id: activeService.id.startsWith('default') ? null : activeService.id,
    title: `${activeService.name} - ${customerName}`,
    service_type: activeService.name,
    start_time: startTime,
    end_time: endTime,
    status: initialStatus,
    source,
    manage_token: manageToken,
    notes: notes || null,
    confirmed_at: isInstant ? new Date().toISOString() : null
  }

  const { data: appointment, error: aptError } = await supabase
    .from('appointments')
    .insert(appointmentPayload)
    .select('*')
    .single()

  if (aptError || !appointment) {
    return { success: false, error: 'Failed to save appointment record' }
  }

  const slotStartDate = new Date(startTime)
  const displayTime = `${slotStartDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${formatSlotDisplayTime(slotStartDate, timezone)}`

  // 9. Dispatch Domain Event to Automation Engine
  const eventType = isInstant ? 'booking.confirmed' : 'booking.created'
  const eventEnvelope = createEventEnvelope(eventType, orgId, {
    appointment_id: appointment.id,
    contact_id: contactId,
    lead_id: leadId,
    service_name: activeService.name,
    start_time: startTime,
    end_time: endTime,
    status: initialStatus,
    customer_name: customerName,
    customer_phone: normalizedPhone.e164
  }, {
    entityId: appointment.id,
    contactId: contactId || undefined,
    leadId: leadId || undefined
  })

  await handleAutomationEvent(supabase, eventEnvelope)

  // 10. Dispatch Confirmation SMS via Telnyx
  const senderNumber = org.telnyx_phone_number || org.owner_phone
  let confirmationText = ''
  if (isInstant) {
    confirmationText = `Hi ${customerName}! Your appointment with ${org.name} for ${activeService.name} is confirmed for ${displayTime}. Manage or reschedule: ${manageUrl}`
  } else {
    confirmationText = `Hi ${customerName}! We received your booking request for ${activeService.name} with ${org.name} on ${displayTime}. We will confirm shortly. Manage: ${manageUrl}`
  }

  if (senderNumber) {
    await sendTelnyxSms({
      to: normalizedPhone.e164,
      from: senderNumber,
      text: confirmationText
    })
  }

  // 11. Schedule Pre-Appointment Reminders (24h & 2h before) if Confirmed
  if (isInstant) {
    await scheduleAppointmentReminders(supabase, {
      appointmentId: appointment.id,
      orgId,
      orgName: org.name,
      senderNumber: senderNumber || '+15555550100',
      customerPhone: normalizedPhone.e164,
      serviceName: activeService.name,
      startTime,
      displayTime,
      manageUrl
    })
  }

  // 12. Create in-app notification for business owner
  await supabase.from('notifications').insert({
    org_id: orgId,
    title: isInstant ? 'New Appointment Booked' : 'New Booking Request',
    message: `${customerName} booked ${activeService.name} for ${displayTime}`,
    link: '/client/calendar'
  })

  return {
    success: true,
    appointment,
    manageToken,
    manageUrl,
    status: initialStatus
  }
}

/**
 * Schedules 24-hour and 2-hour pre-appointment reminders as automation runs.
 */
export async function scheduleAppointmentReminders(
  supabase: SupabaseClient,
  details: {
    appointmentId: string
    orgId: string
    orgName: string
    senderNumber: string
    customerPhone: string
    serviceName: string
    startTime: string
    displayTime: string
    manageUrl: string
  }
) {
  const {
    appointmentId,
    orgId,
    orgName,
    senderNumber,
    customerPhone,
    serviceName,
    startTime,
    displayTime,
    manageUrl
  } = details

  const startMs = new Date(startTime).getTime()
  const nowMs = Date.now()

  // 1. 24h Reminder
  const reminder24hMs = startMs - 24 * 60 * 60 * 1000
  if (reminder24hMs > nowMs) {
    const text24h = `Reminder: Your appointment with ${orgName} for ${serviceName} is tomorrow at ${displayTime}. Need to change? Manage: ${manageUrl}`
    await supabase.from('automation_runs').insert({
      org_id: orgId,
      job_id: `job_remind_24h_${appointmentId}`,
      idempotency_key: `remind_24h_${appointmentId}`,
      event_type: 'appointment.upcoming',
      action_type: 'send_sms',
      action_params: {
        to: customerPhone,
        from: senderNumber,
        text: text24h
      },
      status: 'scheduled',
      scheduled_at: new Date(reminder24hMs).toISOString(),
      event_payload: {
        appointment_id: appointmentId,
        reminder_type: '24h'
      }
    })
  }

  // 2. 2h Reminder
  const reminder2hMs = startMs - 2 * 60 * 60 * 1000
  if (reminder2hMs > nowMs) {
    const text2h = `Reminder: Your appointment with ${orgName} is in 2 hours (${displayTime}). Manage: ${manageUrl}`
    await supabase.from('automation_runs').insert({
      org_id: orgId,
      job_id: `job_remind_2h_${appointmentId}`,
      idempotency_key: `remind_2h_${appointmentId}`,
      event_type: 'appointment.upcoming',
      action_type: 'send_sms',
      action_params: {
        to: customerPhone,
        from: senderNumber,
        text: text2h
      },
      status: 'scheduled',
      scheduled_at: new Date(reminder2hMs).toISOString(),
      event_payload: {
        appointment_id: appointmentId,
        reminder_type: '2h'
      }
    })
  }
}

/**
 * Customer self-service cancel via secure tokenized link.
 * Atomically marks appointment as cancelled and invalidates scheduled reminders.
 */
export async function customerCancelBooking(
  supabase: SupabaseClient,
  manageToken: string,
  reason?: string
): Promise<{ success: boolean; appointment?: any; error?: string }> {
  const { data: apt, error } = await supabase
    .from('appointments')
    .select('*, organization:organizations(name, slug, telnyx_phone_number, owner_phone), contact:contacts(phone, name)')
    .eq('manage_token', manageToken)
    .single()

  if (error || !apt) {
    return { success: false, error: 'Appointment not found' }
  }

  if (apt.status === 'cancelled') {
    return { success: true, appointment: apt }
  }

  // 1. Update appointment status
  const { data: updatedApt, error: updateError } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      cancellation_reason: reason || 'Cancelled by customer',
      updated_at: new Date().toISOString()
    })
    .eq('id', apt.id)
    .select('*')
    .single()

  if (updateError || !updatedApt) {
    return { success: false, error: 'Failed to cancel appointment' }
  }

  // 2. Halt all scheduled reminder runs for this appointment
  await evaluateAndApplyStopConditions(
    supabase,
    createEventEnvelope('booking.cancelled', apt.org_id, {
      appointment_id: apt.id,
      contact_id: apt.contact_id,
      reason
    }, { entityId: apt.id, contactId: apt.contact_id })
  )

  // 3. Send cancellation SMS to customer
  let org = apt.organization
  if (!org) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', apt.org_id)
      .maybeSingle()
    org = orgData
  }

  let contact = apt.contact
  if (!contact && apt.contact_id) {
    const { data: contactData } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', apt.contact_id)
      .maybeSingle()
    contact = contactData
  }

  const senderNumber = org?.telnyx_phone_number || org?.owner_phone
  if (senderNumber && contact?.phone) {
    const rebookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com'}/book/${org?.slug || ''}`
    await sendTelnyxSms({
      to: contact.phone,
      from: senderNumber,
      text: `Your appointment with ${org?.name || 'us'} has been cancelled. To reschedule or book a new time, visit: ${rebookUrl}`
    })
  }

  return { success: true, appointment: updatedApt }
}

/**
 * Customer self-service reschedule via secure tokenized link.
 */
export async function customerRescheduleBooking(
  supabase: SupabaseClient,
  manageToken: string,
  newStartTime: string
): Promise<{ success: boolean; appointment?: any; error?: string }> {
  const { data: apt, error } = await supabase
    .from('appointments')
    .select('*, organization:organizations(*), contact:contacts(*), service:services(*)')
    .eq('manage_token', manageToken)
    .single()

  if (error || !apt) {
    return { success: false, error: 'Appointment not found' }
  }

  let org = apt.organization
  if (!org) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', apt.org_id)
      .maybeSingle()
    org = orgData
  }

  let contact = apt.contact
  if (!contact && apt.contact_id) {
    const { data: contactData } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', apt.contact_id)
      .maybeSingle()
    contact = contactData
  }

  let service = apt.service
  if (!service && apt.service_id) {
    const { data: svcData } = await supabase
      .from('services')
      .select('*')
      .eq('id', apt.service_id)
      .maybeSingle()
    service = svcData
  }
  if (!service) {
    service = {
      name: apt.service_type || 'Service Call',
      duration_minutes: 60
    }
  }

  const durationMs = (service.duration_minutes || 60) * 60 * 1000
  const bufferMs = (org?.buffer_minutes ?? 15) * 60 * 1000
  const newStartMs = new Date(newStartTime).getTime()
  const newEndMs = newStartMs + durationMs
  const newEndTime = new Date(newEndMs).toISOString()

  // 1. Overlap Check against OTHER active appointments
  const { data: otherAppts } = await supabase
    .from('appointments')
    .select('id, start_time, end_time, status')
    .eq('org_id', apt.org_id)
    .neq('id', apt.id)
    .in('status', ['requested', 'confirmed', 'scheduled'])

  if (otherAppts && otherAppts.length > 0) {
    for (const other of otherAppts) {
      const oStart = new Date(other.start_time).getTime()
      const oEnd = other.end_time ? new Date(other.end_time).getTime() : oStart + durationMs
      if (doesIntervalOverlap(newStartMs, newEndMs, oStart, oEnd, bufferMs)) {
        return { success: false, error: 'This time slot is no longer available. Please select another time.' }
      }
    }
  }

  // 2. Invalidate old scheduled reminder runs
  await evaluateAndApplyStopConditions(
    supabase,
    createEventEnvelope('booking.cancelled', apt.org_id, {
      appointment_id: apt.id,
      contact_id: apt.contact_id,
      reason: 'Rescheduled'
    }, { entityId: apt.id, contactId: apt.contact_id })
  )

  // 3. Update appointment
  const { data: updatedApt, error: updateError } = await supabase
    .from('appointments')
    .update({
      start_time: newStartTime,
      end_time: newEndTime,
      status: 'confirmed',
      cancellation_reason: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', apt.id)
    .select('*')
    .single()

  if (updateError || !updatedApt) {
    return { success: false, error: 'Failed to update appointment' }
  }

  const timezone = org?.timezone || 'America/Chicago'
  const slotStartDate = new Date(newStartTime)
  const displayTime = `${slotStartDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${formatSlotDisplayTime(slotStartDate, timezone)}`
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com'
  const manageUrl = `${appBaseUrl}/book/manage/${manageToken}`

  // 4. Schedule new reminders
  const senderNumber = org?.telnyx_phone_number || org?.owner_phone || '+15555550100'
  if (contact?.phone) {
    await scheduleAppointmentReminders(supabase, {
      appointmentId: apt.id,
      orgId: apt.org_id,
      orgName: org?.name || 'CaptoDesk',
      senderNumber,
      customerPhone: contact.phone,
      serviceName: service.name,
      startTime: newStartTime,
      displayTime,
      manageUrl
    })

    // 5. Send reschedule SMS
    await sendTelnyxSms({
      to: contact.phone,
      from: senderNumber,
      text: `Your appointment with ${org?.name || 'us'} has been rescheduled to ${displayTime}. Manage: ${manageUrl}`
    })
  }

  return { success: true, appointment: updatedApt }
}

/**
 * Owner updates booking status (e.g. approve request, cancel, mark completed, no show).
 */
export async function ownerUpdateBookingStatus(
  supabase: SupabaseClient,
  params: {
    appointmentId: string
    orgId: string
    newStatus: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
    reason?: string
  }
): Promise<{ success: boolean; appointment?: any; error?: string }> {
  const { appointmentId, orgId, newStatus, reason } = params

  const { data: apt, error: findError } = await supabase
    .from('appointments')
    .select('*, organization:organizations(*), contact:contacts(*)')
    .eq('id', appointmentId)
    .eq('org_id', orgId)
    .single()

  if (findError || !apt) {
    return { success: false, error: 'Appointment not found' }
  }

  const updateFields: Record<string, any> = {
    status: newStatus,
    updated_at: new Date().toISOString()
  }

  if (newStatus === 'confirmed' && !apt.confirmed_at) {
    updateFields.confirmed_at = new Date().toISOString()
  }
  if (newStatus === 'cancelled') {
    updateFields.cancellation_reason = reason || 'Cancelled by business owner'
  }

  const { data: updatedApt, error: updateError } = await supabase
    .from('appointments')
    .update(updateFields)
    .eq('id', appointmentId)
    .select('*')
    .single()

  if (updateError || !updatedApt) {
    return { success: false, error: 'Failed to update booking status' }
  }

  let org = apt.organization
  if (!org) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', apt.org_id)
      .maybeSingle()
    org = orgData
  }

  let contact = apt.contact
  if (!contact && apt.contact_id) {
    const { data: contactData } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', apt.contact_id)
      .maybeSingle()
    contact = contactData
  }

  const senderNumber = org?.telnyx_phone_number || org?.owner_phone
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com'
  const manageUrl = `${appBaseUrl}/book/manage/${apt.manage_token}`

  if (newStatus === 'confirmed' && contact?.phone && senderNumber) {
    const slotStartDate = new Date(apt.start_time)
    const timezone = org?.timezone || 'America/Chicago'
    const displayTime = `${slotStartDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${formatSlotDisplayTime(slotStartDate, timezone)}`

    // Send confirmation SMS
    await sendTelnyxSms({
      to: contact.phone,
      from: senderNumber,
      text: `Great news ${contact.name || ''}! Your appointment with ${org?.name || 'us'} is confirmed for ${displayTime}. Manage: ${manageUrl}`
    })

    // Schedule reminders
    await scheduleAppointmentReminders(supabase, {
      appointmentId: apt.id,
      orgId,
      orgName: org?.name || 'CaptoDesk',
      senderNumber,
      customerPhone: contact.phone,
      serviceName: apt.service_type || 'Service Call',
      startTime: apt.start_time,
      displayTime,
      manageUrl
    })
  } else if (newStatus === 'cancelled') {
    // Invalidate reminders
    await evaluateAndApplyStopConditions(
      supabase,
      createEventEnvelope('booking.cancelled', orgId, {
        appointment_id: apt.id,
        contact_id: apt.contact_id,
        reason
      }, { entityId: apt.id, contactId: apt.contact_id })
    )

    if (contact?.phone && senderNumber) {
      await sendTelnyxSms({
        to: contact.phone,
        from: senderNumber,
        text: `Your appointment with ${org?.name || 'us'} has been cancelled (${reason || 'business schedule update'}).`
      })
    }
  }

  return { success: true, appointment: updatedApt }
}
