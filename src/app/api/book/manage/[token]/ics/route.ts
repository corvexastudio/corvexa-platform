import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateIcsContent } from '@/lib/calendar/calendar-sync'
import {
  checkRateLimitAsync,
  RATE_LIMITS,
  getRateLimitHeaders,
  extractClientIp,
  PRIVATE_CACHE_HEADERS
} from '@/lib/security/rate-limiter'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  let rateHeaders: Record<string, string> | undefined
  try {
    const { token } = await props.params
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // IP-based rate limiting on iCalendar exports (30 req/min)
    const clientIp = extractClientIp(request)
    const rateLimit = await checkRateLimitAsync(`manage:ics:${clientIp}`, RATE_LIMITS.MANAGE_ICS)
    rateHeaders = getRateLimitHeaders(rateLimit)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        {
          status: 429,
          headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
        }
      )
    }

    const supabase = createAdminClient()

    const { data: appointment, error } = await supabase
      .from('appointments')
      .select(`
        id, title, service_type, start_time, end_time, status,
        contact:contacts(name, phone, address),
        organization:organizations(name, slug, timezone, owner_phone, telnyx_phone_number)
      `)
      .eq('manage_token', token)
      .maybeSingle()

    if (error || !appointment) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        {
          status: 404,
          headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
        }
      )
    }

    const org = Array.isArray(appointment.organization) ? appointment.organization[0] : appointment.organization
    const contact = Array.isArray(appointment.contact) ? appointment.contact[0] : appointment.contact

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com'
    const manageUrl = `${appBaseUrl}/book/manage/${token}`

    const eventTitle = appointment.title || `${org?.name || 'Service'} Appointment`
    const businessPhone = org?.telnyx_phone_number || org?.owner_phone || ''

    // F-03 Safe customer-facing allowlist: Exclude raw internal appointment intake notes (gate codes, private notes)
    const description = [
      `Service: ${appointment.service_type || 'Scheduled Service'}`,
      org?.name ? `Provider: ${org.name}` : '',
      businessPhone ? `Phone: ${businessPhone}` : '',
      contact?.name ? `Customer: ${contact.name}` : '',
      `Reference: ${token.substring(0, 8).toUpperCase()}`,
      `Status: ${(appointment.status || 'CONFIRMED').toUpperCase()}`,
      `Manage Appointment: ${manageUrl}`
    ]
      .filter(Boolean)
      .join('\n')

    const icsContent = generateIcsContent({
      title: eventTitle,
      description,
      location: contact?.address || undefined,
      startTime: appointment.start_time,
      endTime: appointment.end_time || undefined,
      url: manageUrl
    })

    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="appointment-${token.substring(0, 8)}.ics"`,
        ...PRIVATE_CACHE_HEADERS,
        ...rateHeaders
      }
    })
  } catch (err: any) {
    console.error('[ICS_EXPORT_ERROR]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: { ...PRIVATE_CACHE_HEADERS, ...(rateHeaders || {}) }
      }
    )
  }
}
