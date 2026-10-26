import crypto from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export type BookingTrafficSource = 'google_maps' | 'website' | 'sms' | 'truck_qr' | 'yelp' | 'social' | 'direct' | 'other'

export interface RecordViewInput {
  orgId: string
  slug: string
  request: Request
  websiteUrl?: string | null
}

export interface AttributionSummary {
  totalViews: number
  totalBookings: number
  conversionRate: number
  viewsBySource: Record<BookingTrafficSource, number>
  bookingsBySource: Record<BookingTrafficSource, number>
  topReferrers: Array<{ domain: string; count: number }>
}

/**
 * Resolves the traffic channel from query params and HTTP Referer
 */
export function resolveTrafficSource(
  request: Request,
  websiteUrl?: string | null
): { source: BookingTrafficSource; referrerDomain: string | null; rawReferrer: string | null } {
  const url = new URL(request.url)
  const refParam = (
    url.searchParams.get('ref') ||
    url.searchParams.get('utm_source') ||
    url.searchParams.get('source') ||
    url.searchParams.get('src') ||
    ''
  ).toLowerCase().trim()

  const rawReferrer = request.headers.get('referer') || null
  let referrerDomain: string | null = null

  if (rawReferrer) {
    try {
      const parsedRef = new URL(rawReferrer)
      referrerDomain = parsedRef.hostname.replace(/^www\./, '').toLowerCase()
    } catch {
      referrerDomain = rawReferrer.split('/')[2]?.replace(/^www\./, '') || null
    }
  }

  // 1. Explicit query parameter tags take highest precedence
  if (['google_maps', 'gbp', 'gmb', 'maps', 'google_business', 'google_local'].includes(refParam)) {
    return { source: 'google_maps', referrerDomain: referrerDomain || 'maps.google.com', rawReferrer }
  }
  if (['website', 'site', 'web', 'homepage'].includes(refParam)) {
    return { source: 'website', referrerDomain, rawReferrer }
  }
  if (['sms', 'text', 'native_sms', 'phone_sms'].includes(refParam)) {
    return { source: 'sms', referrerDomain: 'native_sms', rawReferrer }
  }
  if (['truck', 'qr', 'truck_qr', 'van'].includes(refParam)) {
    return { source: 'truck_qr', referrerDomain: 'truck_qr', rawReferrer }
  }

  // 2. HTTP Referrer Inspection
  if (rawReferrer) {
    const lowerRef = rawReferrer.toLowerCase()

    // Google Maps app or web
    if (
      lowerRef.includes('maps.google.') ||
      lowerRef.includes('/maps/') ||
      lowerRef.includes('android-app://com.google.android.apps.maps') ||
      lowerRef.includes('google.com/maps')
    ) {
      return { source: 'google_maps', referrerDomain: 'maps.google.com', rawReferrer }
    }

    // Organic Google Search
    if (lowerRef.includes('google.com') || lowerRef.includes('google.ca') || lowerRef.includes('google.co')) {
      return { source: 'google_maps', referrerDomain: 'google.com', rawReferrer }
    }

    // Yelp
    if (lowerRef.includes('yelp.com')) {
      return { source: 'yelp', referrerDomain: 'yelp.com', rawReferrer }
    }

    // Social
    if (lowerRef.includes('facebook.com') || lowerRef.includes('instagram.com') || lowerRef.includes('tiktok.com') || lowerRef.includes('linkedin.com')) {
      return { source: 'social', referrerDomain, rawReferrer }
    }

    // Contractor's Own Website
    if (websiteUrl) {
      const cleanWebsite = websiteUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
      if (cleanWebsite && lowerRef.includes(cleanWebsite)) {
        return { source: 'website', referrerDomain: cleanWebsite, rawReferrer }
      }
    }

    // Any other third-party website
    const appHost = url.hostname.replace(/^www\./, '').toLowerCase()
    if (referrerDomain && referrerDomain !== appHost && !referrerDomain.includes('captodesk') && !referrerDomain.includes('corvexastudio') && !referrerDomain.includes('localhost')) {
      return { source: 'website', referrerDomain, rawReferrer }
    }
  }

  // 3. Fallback: Direct or native SMS (when clicked directly from SMS, iOS/Android do not send referrer)
  return { source: 'direct', referrerDomain: null, rawReferrer }
}

/**
 * Anonymously records a booking link page view without blocking request execution
 */
export async function recordBookingPageView(
  supabase: SupabaseClient,
  input: RecordViewInput
): Promise<void> {
  try {
    const { orgId, request, websiteUrl } = input
    const { source, referrerDomain, rawReferrer } = resolveTrafficSource(request, websiteUrl)

    const userAgent = request.headers.get('user-agent') || ''
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || ''
    const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16) : null

    // Try inserting into dedicated booking_link_views table
    const { error } = await supabase.from('booking_link_views').insert({
      org_id: orgId,
      source,
      referrer: rawReferrer ? rawReferrer.substring(0, 500) : null,
      referrer_domain: referrerDomain,
      user_agent: userAgent ? userAgent.substring(0, 250) : null,
      ip_hash: ipHash
    })

    if (error && (error.code === 'PGRST205' || error.message?.includes('does not exist'))) {
      // Non-blocking fallback: Record in activity_logs
      await supabase.from('activity_logs').insert({
        org_id: orgId,
        event_type: 'booking.page_view',
        description: `Booking link visited from ${source}`,
        metadata: {
          source,
          referrer_domain: referrerDomain,
          user_agent: userAgent ? userAgent.substring(0, 150) : null
        }
      })
    }
  } catch (err: any) {
    // Non-blocking telemetry
    console.warn('[ATTRIBUTION TRACKING WARN]', err?.message)
  }
}

/**
 * Aggregates views, bookings, and placement attribution for a single organization
 */
export async function getOrganizationAttributionSummary(
  supabase: SupabaseClient,
  orgId: string
): Promise<AttributionSummary> {
  const sources: Record<BookingTrafficSource, number> = {
    google_maps: 0,
    website: 0,
    sms: 0,
    truck_qr: 0,
    yelp: 0,
    social: 0,
    direct: 0,
    other: 0
  }

  const bookingSources: Record<BookingTrafficSource, number> = {
    google_maps: 0,
    website: 0,
    sms: 0,
    truck_qr: 0,
    yelp: 0,
    social: 0,
    direct: 0,
    other: 0
  }

  const referrersMap: Record<string, number> = {}

  let totalViews = 0

  // 1. Fetch views from booking_link_views
  const { data: views, error: viewsErr } = await supabase
    .from('booking_link_views')
    .select('source, referrer_domain')
    .eq('org_id', orgId)

  if (!viewsErr && views && views.length > 0) {
    totalViews = views.length
    for (const v of views) {
      const src = (v.source || 'other') as BookingTrafficSource
      sources[src] = (sources[src] || 0) + 1

      if (v.referrer_domain) {
        referrersMap[v.referrer_domain] = (referrersMap[v.referrer_domain] || 0) + 1
      }
    }
  } else {
    // Fallback: Query activity_logs for booking.page_view
    const { data: actViews } = await supabase
      .from('activity_logs')
      .select('metadata')
      .eq('org_id', orgId)
      .eq('event_type', 'booking.page_view')

    if (actViews && actViews.length > 0) {
      totalViews = actViews.length
      for (const a of actViews) {
        const meta = a.metadata || {}
        const src = (meta.source || 'other') as BookingTrafficSource
        sources[src] = (sources[src] || 0) + 1
        if (meta.referrer_domain) {
          referrersMap[meta.referrer_domain] = (referrersMap[meta.referrer_domain] || 0) + 1
        }
      }
    }
  }

  // 2. Fetch bookings from appointments
  const { data: appts } = await supabase
    .from('appointments')
    .select('source, notes')
    .eq('org_id', orgId)

  let totalBookings = 0
  if (appts && appts.length > 0) {
    const bookingAppts = appts.filter(a => a.source === 'booking_page' || a.source === 'online')
    totalBookings = bookingAppts.length

    for (const a of bookingAppts) {
      const notes = (a.notes || '').toLowerCase()
      let matchedSource: BookingTrafficSource = 'direct'
      if (notes.includes('ref:google_maps') || notes.includes('source:google_maps') || notes.includes('gbp')) {
        matchedSource = 'google_maps'
      } else if (notes.includes('ref:website') || notes.includes('source:website')) {
        matchedSource = 'website'
      } else if (notes.includes('ref:sms') || notes.includes('source:sms')) {
        matchedSource = 'sms'
      }
      bookingSources[matchedSource] = (bookingSources[matchedSource] || 0) + 1
    }
  }

  const conversionRate = totalViews > 0 ? Math.round((totalBookings / totalViews) * 1000) / 10 : 0

  const topReferrers = Object.entries(referrersMap)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    totalViews,
    totalBookings,
    conversionRate,
    viewsBySource: sources,
    bookingsBySource: bookingSources,
    topReferrers
  }
}
