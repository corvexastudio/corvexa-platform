import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateAvailableSlots } from '@/lib/booking/availability'

export async function GET(
  request: Request,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params
    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date') // YYYY-MM-DD
    const serviceId = searchParams.get('serviceId')

    if (!slug || !dateStr) {
      return NextResponse.json({ error: 'Missing required parameters: slug and date' }, { status: 400 })
    }

    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: 'Invalid date format. Expected YYYY-MM-DD' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Fetch organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug, timezone, business_hours, buffer_minutes, minimum_notice_hours, max_booking_days_ahead, blocked_dates, default_duration_minutes')
      .eq('slug', slug)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // 2. Fetch service
    let serviceDuration = org.default_duration_minutes || 60
    let serviceName = 'Service Call'
    let serviceIdResolved = serviceId || 'default'

    if (serviceId && !serviceId.startsWith('default')) {
      const { data: svc } = await supabase
        .from('services')
        .select('id, name, duration_minutes')
        .eq('id', serviceId)
        .eq('org_id', org.id)
        .maybeSingle()

      if (svc) {
        serviceDuration = svc.duration_minutes
        serviceName = svc.name
        serviceIdResolved = svc.id
      }
    }

    // 3. Query existing active appointments for this org on/near that date
    // Query window: 1 day before to 1 day after to handle all timezone edge boundaries
    const dateObj = new Date(dateStr)
    const windowStart = new Date(dateObj.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const windowEnd = new Date(dateObj.getTime() + 48 * 60 * 60 * 1000).toISOString()

    const { data: appts } = await supabase
      .from('appointments')
      .select('id, start_time, end_time, status')
      .eq('org_id', org.id)
      .gte('start_time', windowStart)
      .lte('start_time', windowEnd)
      .in('status', ['requested', 'confirmed', 'scheduled'])

    // 4. Calculate available slots using availability engine
    const availableSlots = calculateAvailableSlots({
      orgConfig: {
        timezone: org.timezone || 'America/Chicago',
        business_hours: org.business_hours || {},
        buffer_minutes: org.buffer_minutes ?? 15,
        minimum_notice_hours: org.minimum_notice_hours ?? 2,
        max_booking_days_ahead: org.max_booking_days_ahead ?? 30,
        blocked_dates: org.blocked_dates || []
      },
      service: {
        id: serviceIdResolved,
        name: serviceName,
        duration_minutes: serviceDuration
      },
      dateStr,
      existingAppointments: appts || [],
      referenceTime: new Date()
    })

    return NextResponse.json({
      date: dateStr,
      timezone: org.timezone || 'America/Chicago',
      slotsCount: availableSlots.length,
      slots: availableSlots
    })
  } catch (err: any) {
    console.error('[BOOKING_GET_SLOTS_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
