import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params

    if (!token) {
      return NextResponse.json({ error: 'Missing management token' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: apt, error } = await supabase
      .from('appointments')
      .select(`
        id, title, service_type, start_time, end_time, status, source, cancellation_reason, confirmed_at, notes,
        organization:organizations(id, name, slug, owner_phone, telnyx_phone_number, timezone),
        contact:contacts(id, name, phone, email, address),
        service:services(id, name, duration_minutes, price)
      `)
      .eq('manage_token', token)
      .maybeSingle()

    if (error || !apt) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const org = Array.isArray(apt.organization) ? apt.organization[0] : apt.organization
    const contact = Array.isArray(apt.contact) ? apt.contact[0] : apt.contact
    const service = Array.isArray(apt.service) ? apt.service[0] : apt.service

    // Query linked job for real-time technician tracking & status sync
    let trackingInfo: {
      token: string
      url: string
      jobNumber?: string | null
      jobStatus: string
      etaMinutes?: number | null
      enRouteAt?: string | null
      arrivedAt?: string | null
      startedAt?: string | null
      completedAt?: string | null
    } | null = null

    const { data: linkedJob } = await supabase
      .from('jobs')
      .select('id, job_number, status, tracking_token, en_route_at, arrived_at, started_at, completed_at, eta_minutes')
      .eq('appointment_id', apt.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .maybeSingle()

    if (linkedJob) {
      let trackingToken = linkedJob.tracking_token
      if (!trackingToken) {
        trackingToken = crypto.randomUUID().replace(/-/g, '')
        await supabase
          .from('jobs')
          .update({ tracking_token: trackingToken })
          .eq('id', linkedJob.id)
      }

      trackingInfo = {
        token: trackingToken,
        url: `/t/${trackingToken}`,
        jobNumber: linkedJob.job_number,
        jobStatus: linkedJob.status || apt.status,
        etaMinutes: linkedJob.eta_minutes,
        enRouteAt: linkedJob.en_route_at,
        arrivedAt: linkedJob.arrived_at,
        startedAt: linkedJob.started_at,
        completedAt: linkedJob.completed_at
      }
    }

    return NextResponse.json({
      appointment: {
        id: apt.id,
        title: apt.title,
        serviceType: apt.service_type,
        startTime: apt.start_time,
        endTime: apt.end_time,
        status: apt.status,
        cancellationReason: apt.cancellation_reason,
        confirmedAt: apt.confirmed_at,
        notes: apt.notes,
        business: {
          name: org?.name,
          slug: org?.slug,
          phone: org?.telnyx_phone_number || org?.owner_phone,
          timezone: org?.timezone || 'America/Chicago'
        },
        customer: {
          name: contact?.name,
          phone: contact?.phone,
          email: contact?.email,
          address: contact?.address
        },
        service: service ? {
          name: service.name,
          durationMinutes: service.duration_minutes,
          price: service.price
        } : null,
        tracking: trackingInfo
      }
    })
  } catch (err: any) {
    console.error('[BOOKING_GET_MANAGE_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
