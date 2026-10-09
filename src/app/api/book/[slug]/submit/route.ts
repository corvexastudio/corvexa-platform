import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBooking } from '@/lib/booking/booking-manager'
import { checkRateLimitAsync, RATE_LIMITS, getRateLimitHeaders, extractClientIp } from '@/lib/security/rate-limiter'
import { validateBookingOrigin } from '@/lib/booking/origin-validator'

export async function POST(
  request: Request,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params

    // 1. Distributed Rate limiting on public booking submission (HIGH-05)
    const clientIp = extractClientIp(request)
    const rateLimit = await checkRateLimitAsync(`booking:slug:${slug}:${clientIp}`, RATE_LIMITS.BOOKING_SUBMIT)
    const rateHeaders = getRateLimitHeaders(rateLimit)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many booking requests. Please wait a minute and try again.' },
        { status: 429, headers: rateHeaders }
      )
    }

    const body = await request.json().catch(() => ({}))
    const {
      serviceId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      startTime,
      notes,
      bookingToken
    } = body

    if (!slug || !customerName?.trim() || !customerPhone?.trim() || !startTime) {
      return NextResponse.json(
        { error: 'Missing required booking fields: name, phone, or appointment time' },
        { status: 400, headers: rateHeaders }
      )
    }

    // Phone-level rate limit to prevent slot squatting / spam
    const phoneRateLimit = await checkRateLimitAsync(`booking:phone:${customerPhone.trim()}`, { max: 5, windowMs: 60000 })
    if (!phoneRateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many bookings attempted with this phone number. Please wait a few minutes.' },
        { status: 429, headers: getRateLimitHeaders(phoneRateLimit) }
      )
    }

    let supabase
    try {
      supabase = createAdminClient()
    } catch (adminErr: any) {
      console.error('[BOOKING_SUBMIT_FATAL_CONFIG]', adminErr?.message)
      return NextResponse.json(
        { error: 'Booking service temporarily unavailable. Database credentials must be configured.' },
        { status: 503, headers: rateHeaders }
      )
    }

    // 2. Resolve organization by slug
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('slug', slug)
      .single()

    if (orgError || !org) {
      console.warn('[BOOKING_SUBMIT_ORG_NOT_FOUND]', { slug, error: orgError?.message })
      return NextResponse.json({ error: 'Business not found' }, { status: 404, headers: rateHeaders })
    }

    // 3. Origin & CSRF Validation (ADD-03)
    const providedToken = bookingToken || request.headers.get('x-booking-token')
    const originCheck = validateBookingOrigin(request, slug, org.id, providedToken)
    if (!originCheck.allowed) {
      return NextResponse.json(
        { error: originCheck.reason || 'Forbidden: Cross-origin booking submission rejected' },
        { status: 403, headers: rateHeaders }
      )
    }

    // 3. Create booking atomically
    const appBaseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com'
    const result = await createBooking(supabase, {
      orgId: org.id,
      serviceId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail?.trim() || undefined,
      customerAddress: customerAddress?.trim() || undefined,
      startTime,
      notes: notes?.trim() || undefined,
      source: 'booking_page',
      appBaseUrl
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Booking failed' }, { status: 400, headers: rateHeaders })
    }

    return NextResponse.json({
      success: true,
      appointment: result.appointment,
      manageToken: result.manageToken,
      manageUrl: result.manageUrl,
      status: result.status
    }, { headers: rateHeaders })
  } catch (err: any) {
    console.error('[BOOKING_SUBMIT_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
