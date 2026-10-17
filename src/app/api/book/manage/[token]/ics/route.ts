import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateIcsContent } from '@/lib/calendar/calendar-sync'

export async function GET(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: appointment, error } = await supabase
      .from('appointments')
      .select(`
        id, title, service_type, start_time, end_time, status, notes,
        contact:contacts(name, phone, address),
        organization:organizations(name, slug, timezone, owner_phone)
      `)
      .eq('manage_token', token)
      .maybeSingle()

    if (error || !appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const org = Array.isArray(appointment.organization) ? appointment.organization[0] : appointment.organization
    const contact = Array.isArray(appointment.contact) ? appointment.contact[0] : appointment.contact

    const eventTitle = appointment.title || `${org?.name || 'Service'} Appointment`
    const description = [
      `Service: ${appointment.service_type || 'Scheduled Service'}`,
      org?.name ? `Provider: ${org.name}` : '',
      contact?.name ? `Customer: ${contact.name}` : '',
      appointment.notes ? `Notes: ${appointment.notes}` : '',
      `Status: ${appointment.status.toUpperCase()}`,
    ]
      .filter(Boolean)
      .join('\n')

    const icsContent = generateIcsContent({
      title: eventTitle,
      description,
      location: contact?.address || undefined,
      startTime: appointment.start_time,
      endTime: appointment.end_time || undefined,
    })

    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="appointment-${token.substring(0, 8)}.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (err: any) {
    console.error('[ICS_EXPORT_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
