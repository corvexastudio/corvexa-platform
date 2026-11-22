import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateAvailableSlots, calculateDetailedSlots } from '@/lib/booking/availability'
import { parseBookingSettings } from '@/lib/booking/booking-settings'
import { parseAddOns } from '@/lib/services/service-pricing'

export async function GET(
  request: Request,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params
    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date') // YYYY-MM-DD
    const serviceId = searchParams.get('serviceId')
    const addonIdsParam = searchParams.get('addonIds')
    const manageToken = searchParams.get('manageToken')

    if (!slug || !dateStr) {
      return NextResponse.json({ error: 'Missing required parameters: slug and date' }, { status: 400 })
    }

    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: 'Invalid date format. Expected YYYY-MM-DD' }, { status: 400 })
    }

    let supabase
    try {
      supabase = createAdminClient()
    } catch {
      const { createClient } = await import('@supabase/supabase-js')
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vlztovqaummczupslymr.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        { auth: { persistSession: false } }
      )
    }

    // 1. Fetch organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug, timezone, business_hours, buffer_minutes, minimum_notice_hours, max_booking_days_ahead, blocked_dates, default_duration_minutes, subscription_status')
      .eq('slug', slug)
      .single()

    if (orgError || !org) {
      console.warn('[BOOKING_SLOTS_ORG_NOT_FOUND]', { slug, error: orgError?.message })
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Canonical suspension check: suspended, canceled, or churned accounts cannot accept bookings
    const subStatus = (org.subscription_status || '').trim().toLowerCase()
    if (['suspended', 'canceled', 'cancelled', 'churned'].includes(subStatus)) {
      return NextResponse.json(
        { error: 'This business is currently unavailable for online booking.' },
        { status: 403 }
      )
    }

    // 2. Fetch service & resolve authoritative duration
    let serviceDuration = org.default_duration_minutes || 60
    let serviceName = 'Service Call'
    let serviceIdResolved = serviceId || 'default'
    let excludeAppointmentId: string | null = null

    // Check if rescheduling via valid manageToken to preserve historical appointment duration
    let historicalDurationResolved = false
    if (manageToken) {
      const { data: manageApt } = await supabase
        .from('appointments')
        .select('id, start_time, end_time, service_id, org_id')
        .eq('manage_token', manageToken)
        .eq('org_id', org.id)
        .maybeSingle()

      if (manageApt) {
        excludeAppointmentId = manageApt.id
        if (manageApt.start_time && manageApt.end_time) {
          const diffMinutes = Math.round(
            (new Date(manageApt.end_time).getTime() - new Date(manageApt.start_time).getTime()) / (60 * 1000)
          )
          if (diffMinutes > 0 && !isNaN(diffMinutes)) {
            serviceDuration = diffMinutes
            historicalDurationResolved = true
          }
        }
      }
    }

    if (!historicalDurationResolved && serviceId && !serviceId.startsWith('default')) {
      const { data: svc } = await supabase
        .from('services')
        .select('id, name, duration_minutes, is_active, org_id, description')
        .eq('id', serviceId)
        .maybeSingle()

      if (!svc || svc.org_id !== org.id) {
        return NextResponse.json(
          { error: 'The selected service does not belong to this organization' },
          { status: 400 }
        )
      }

      if (!svc.is_active) {
        return NextResponse.json(
          { error: 'The selected service is currently inactive and cannot be booked' },
          { status: 400 }
        )
      }

      serviceDuration = svc.duration_minutes
      serviceName = svc.name
      serviceIdResolved = svc.id

      // Authoritative add-on duration calculation: parse configured add-ons server-side
      if (addonIdsParam && svc.description) {
        const requestedAddonIds = addonIdsParam.split(',').map(s => s.trim()).filter(Boolean)
        if (requestedAddonIds.length > 0) {
          const configuredAddons = parseAddOns(svc.description)
          const matchedAddons = configuredAddons.filter(a => requestedAddonIds.includes(a.id))
          const extraDuration = matchedAddons.reduce((sum, a) => sum + (Number(a.duration_minutes) || 0), 0)
          serviceDuration += extraDuration
        }
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

    // Also fetch standalone jobs scheduled directly from dashboard without an appointment
    // to prevent public double-booking against manually scheduled contractor jobs
    const { data: standaloneJobs } = await supabase
      .from('jobs')
      .select('id, scheduled_start, scheduled_end, status')
      .eq('org_id', org.id)
      .is('appointment_id', null)
      .is('deleted_at', null)
      .in('status', ['scheduled', 'confirmed', 'en_route', 'in_progress'])
      .gte('scheduled_start', windowStart)
      .lte('scheduled_start', windowEnd)

    const activeAppts = (appts || []).filter(a => !excludeAppointmentId || a.id !== excludeAppointmentId)
    const allBusySlots: Array<{ id: string; start_time: string; end_time: string | null; status: any }> = [
      ...activeAppts
    ]

    if (standaloneJobs && standaloneJobs.length > 0) {
      for (const sj of standaloneJobs) {
        if (sj.scheduled_start) {
          allBusySlots.push({
            id: sj.id,
            start_time: sj.scheduled_start,
            end_time: sj.scheduled_end || null,
            status: 'scheduled'
          })
        }
      }
    }

    const isPriority = searchParams.get('isPriority') === 'true'
    const requestedInternal = searchParams.get('internal') === 'true' || searchParams.get('isOwner') === 'true'

    // SEC-06 & DATA-03: Decouple isPriority from isInternal to prevent past slot exposure.
    // Strictly require authenticated staff session before enabling internal owner override.
    let isInternal = false
    if (requestedInternal) {
      try {
        const { createClient } = await import('@/lib/supabase/server')
        const userClient = await createClient()
        const { data: authData } = await userClient.auth.getUser()
        if (authData?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('org_id, role')
            .eq('id', authData.user.id)
            .maybeSingle()
          if (profile && profile.org_id === org.id && ['owner', 'admin', 'dispatcher', 'super_admin'].includes(profile.role)) {
            isInternal = true
          }
        }
      } catch {
        isInternal = false
      }
    }
    const bookingSettings = parseBookingSettings(org)
    const slotStepMinutes = bookingSettings.slot_interval_minutes || 30

    // 4. Calculate available & booked slots using availability engine
    const detailed = calculateDetailedSlots({
      orgConfig: {
        timezone: org.timezone || 'America/Chicago',
        business_hours: org.business_hours || {},
        buffer_minutes: org.buffer_minutes ?? 15,
        minimum_notice_hours: isPriority ? 1 : (org.minimum_notice_hours ?? 2),
        max_booking_days_ahead: org.max_booking_days_ahead ?? 30,
        blocked_dates: org.blocked_dates || []
      },
      service: {
        id: serviceIdResolved,
        name: serviceName,
        duration_minutes: serviceDuration
      },
      dateStr,
      existingAppointments: allBusySlots,
      referenceTime: new Date(),
      stepMinutes: slotStepMinutes,
      isInternal
    })

    return NextResponse.json({
      date: dateStr,
      timezone: org.timezone || 'America/Chicago',
      slotsCount: detailed.availableSlots.length,
      slots: detailed.availableSlots,
      allSlots: detailed.allSlots,
      dayStatus: detailed.dayStatus,
      totalSlots: detailed.totalSlots,
      bookedSlotsCount: detailed.bookedSlotsCount
    })
  } catch (err: any) {
    console.error('[BOOKING_GET_SLOTS_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
