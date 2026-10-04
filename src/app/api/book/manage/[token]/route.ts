import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params

    if (!token) {
      return NextResponse.json({ error: 'Missing management token' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

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
        } : null
      }
    })
  } catch (err: any) {
    console.error('[BOOKING_GET_MANAGE_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
