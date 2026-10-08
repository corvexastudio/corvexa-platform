import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBooking } from '@/lib/booking/booking-manager'
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders, extractClientIp } from '@/lib/security/rate-limiter'

export async function POST(
  request: Request,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params

    // 1. Rate limiting on public booking submission
    const clientIp = extractClientIp(request)
    const rateLimit = checkRateLimit(`booking:submit:${clientIp}`, RATE_LIMITS.BOOKING_SUBMIT)
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
      notes
    } = body

    if (!slug || !customerName?.trim() || !customerPhone?.trim() || !startTime) {
      return NextResponse.json(
        { error: 'Missing required booking fields: name, phone, or appointment time' },
        { status: 400, headers: rateHeaders }
      )
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
