import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBooking } from '@/lib/booking/booking-manager'
import { checkRateLimitAsync, RATE_LIMITS, getRateLimitHeaders, extractClientIp } from '@/lib/security/rate-limiter'
import { validateBookingOrigin } from '@/lib/booking/origin-validator'
import { formatCustomerName, formatStandardUsAddress, combineStreetAndUnit } from '@/lib/booking/customer-input-formatter'

export async function POST(
  request: Request,
  props: { params: Promise<{ slug: string }> }
) {
  let rateHeaders: Record<string, string> | undefined
  try {
    const { slug } = await props.params

    // 1. Distributed Rate limiting on public booking submission (HIGH-05)
    const clientIp = extractClientIp(request)
    const rateLimit = await checkRateLimitAsync(`booking:slug:${slug}:${clientIp}`, RATE_LIMITS.BOOKING_SUBMIT)
    rateHeaders = getRateLimitHeaders(rateLimit)

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
      customerUnit,
      startTime,
      notes,
      photos,
      bookingToken,
      referralCode,
      source,
      smsConsent,
      isPriority,
      priorityFee,
      selectedAddOns,
      addonIds,
      howHeard,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      landingPage,
      referrer,
      attributionTimestamp,
      attribution
    } = body

    const attributionData = attribution && typeof attribution === 'object'
      ? attribution
      : (utmSource || utmCampaign)
      ? {
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_content: utmContent,
          utm_term: utmTerm,
          landing_page: landingPage,
          referrer,
          first_touch_at: attributionTimestamp
        }
      : undefined

    const extraMetadataLines: string[] = []
    if (isPriority) {
      extraMetadataLines.push(`[PRIORITY DISPATCH: YES${priorityFee ? ` (+$${priorityFee})` : ''}]`)
    }
    if (Array.isArray(selectedAddOns) && selectedAddOns.length > 0) {
      const addOnSummary = selectedAddOns.map((a: any) => `${a.name}${a.price ? ` (+$${a.price})` : ''}`).join(', ')
      extraMetadataLines.push(`[ADD-ONS: ${addOnSummary}]`)
    }
    if (howHeard) {
      extraMetadataLines.push(`[SOURCE ATTRIBUTION: ${howHeard}]`)
    }

    const mergedCustomerNotes = [notes?.trim(), ...extraMetadataLines].filter(Boolean).join('\n')

    const cookieRef = (request as any).cookies?.get?.('capto_ref')?.value
    const effectiveReferralCode = (referralCode || cookieRef || '').trim() || undefined

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
      .select('id, name, subscription_status')
      .eq('slug', slug)
      .single()

    if (orgError || !org) {
      console.warn('[BOOKING_SUBMIT_ORG_NOT_FOUND]', { slug, error: orgError?.message })
      return NextResponse.json({ error: 'Business not found' }, { status: 404, headers: rateHeaders })
    }

    // Canonical suspension check: suspended, canceled, or churned accounts cannot accept bookings
    const subStatus = (org.subscription_status || '').trim().toLowerCase()
    if (['suspended', 'canceled', 'cancelled', 'churned'].includes(subStatus)) {
      return NextResponse.json(
        { error: 'This business is currently not accepting online bookings.' },
        { status: 403, headers: rateHeaders }
      )
    }

    // 3. Origin & CSRF Validation (ADD-03)
    let approvedDomains: string[] = []
    try {
      const { data: domainRows } = await supabase
        .from('contractor_embed_domains')
        .select('domain')
        .eq('org_id', org.id)
        .eq('is_verified', true)
      if (domainRows) {
        approvedDomains = domainRows.map(d => d.domain)
      }
    } catch {}

    const providedToken = bookingToken || request.headers.get('x-booking-token')
    const originCheck = validateBookingOrigin(request, slug, org.id, providedToken, approvedDomains)
    if (!originCheck.allowed) {
      return NextResponse.json(
        { error: originCheck.reason || 'Forbidden: Cross-origin booking submission rejected' },
        { status: 403, headers: rateHeaders }
      )
    }

    // 3.5 Isolated Preview Mode (Phase 4): Never create real appointments, send SMS, or bill in preview
    const isPreview = Boolean(body.preview) || new URL(request.url).searchParams.get('preview') === 'true'
    if (isPreview) {
      return NextResponse.json({
        success: true,
        preview: true,
        id: 'preview-appointment-id',
        message: 'Preview mode: Booking simulated successfully. No real appointment, customer, or SMS was created.',
        appointment: {
          id: 'preview-appointment-id',
          status: 'confirmed',
          startTime,
          customerName,
          customerPhone
        }
      }, { status: 200, headers: rateHeaders })
    }

    // 4. Create booking atomically
    const formattedAddress = customerAddress
      ? combineStreetAndUnit(customerAddress, customerUnit)
      : undefined

    const rawAddonIds = Array.isArray(addonIds)
      ? addonIds
      : Array.isArray(selectedAddOns)
      ? selectedAddOns.map((a: any) => (typeof a === 'string' ? a : a?.id)).filter(Boolean)
      : []

    const appBaseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com'
    const result = await createBooking(supabase, {
      orgId: org.id,
      serviceId,
      customerName: formatCustomerName(customerName),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail?.trim() || undefined,
      customerAddress: formattedAddress,
      startTime,
      notes: mergedCustomerNotes || undefined,
      photos: Array.isArray(photos) ? photos.filter((p: any) => typeof p === 'string' && p.trim()) : undefined,
      selectedAddOns: Array.isArray(selectedAddOns) ? selectedAddOns : undefined,
      addonIds: rawAddonIds,
      isPriority: Boolean(isPriority),
      priorityFee: priorityFee ? Number(priorityFee) : undefined,
      source: source || 'booking_page',
      smsConsent: typeof smsConsent === 'boolean' ? smsConsent : true,
      referralCode: effectiveReferralCode,
      attribution: attributionData,
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
      trackingToken: (result as any).trackingToken || null,
      trackingUrl: (result as any).trackingUrl || null,
      status: result.status,
      smsStatus: result.smsStatus || 'sent',
      smsError: result.smsError || null
    }, { headers: rateHeaders })
  } catch (err: any) {
    console.error('[BOOKING_SUBMIT_ERROR]', err)
    if (
      err?.code === '23P01' ||
      err?.code === '23505' ||
      err?.message?.toLowerCase().includes('exclusion') ||
      err?.message?.toLowerCase().includes('overlap') ||
      err?.message?.toLowerCase().includes('duplicate') ||
      err?.message?.toLowerCase().includes('slot') ||
      err?.message?.includes('appointments_no_overlapping_bookings') ||
      err?.message?.includes('idx_appointments_org_active_slot')
    ) {
      return NextResponse.json(
        { error: 'This time slot is no longer available. Please select another time.' },
        { status: 400, headers: rateHeaders }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
