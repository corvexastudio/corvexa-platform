import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateBookingToken } from '@/lib/booking/origin-validator'
import { recordBookingPageView } from '@/lib/booking/attribution'

export async function GET(
  request: Request,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params

    if (!slug) {
      return NextResponse.json({ error: 'Missing business slug' }, { status: 400 })
    }

    let supabase
    try {
      supabase = createAdminClient()
    } catch (adminErr: any) {
      console.error('[BOOKING_GET_FATAL_CONFIG]', adminErr?.message)
      return NextResponse.json(
        { error: 'Booking service temporarily unavailable. Database credentials must be configured.' },
        { status: 503 }
      )
    }

    // 1. Fetch Organization by Slug
    let org: any = null
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug, owner_phone, telnyx_phone_number, business_hours, timezone, booking_mode, default_duration_minutes, buffer_minutes, minimum_notice_hours, max_booking_days_ahead, blocked_dates, industry, logo_url')
      .eq('slug', slug)
      .single()

    if (orgError) {
      // Fallback query if logo_url is not yet in schema cache
      const fallback = await supabase
        .from('organizations')
        .select('id, name, slug, owner_phone, telnyx_phone_number, business_hours, timezone, booking_mode, default_duration_minutes, buffer_minutes, minimum_notice_hours, max_booking_days_ahead, blocked_dates, industry')
        .eq('slug', slug)
        .single()
      org = fallback.data
    } else {
      org = orgData
    }

    if (!org) {
      console.warn('[BOOKING_GET_ORG_NOT_FOUND]', { slug, error: orgError?.message })
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Record page view with traffic source attribution asynchronously (non-blocking)
    recordBookingPageView(supabase, {
      orgId: org.id,
      slug: org.slug,
      request
    }).catch(() => {})

    // 2. Fetch Active Services
    const { data: services } = await supabase
      .from('services')
      .select('id, name, description, duration_minutes, price, requires_address, is_active, sort_order')
      .eq('org_id', org.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    const activeServices = services || []

    // 3. Resolve Customer Prefill if phone, name, or contactId (cid) is passed
    const requestUrl = new URL(request.url)
    const phoneParam = requestUrl.searchParams.get('phone')
    const nameParam = requestUrl.searchParams.get('name')
    const sourceParam = requestUrl.searchParams.get('source')
    const cidParam = requestUrl.searchParams.get('cid')

    let prefill: {
      name?: string
      phone?: string
      email?: string
      address?: string
      notes?: string
      serviceNeeded?: string
      source?: string
    } | null = null

    if (phoneParam || cidParam) {
      const { normalizePhoneToE164 } = await import('@/lib/telephony/phone-normalizer')
      let contactQuery = supabase
        .from('contacts')
        .select('id, name, phone, email, address, notes')
        .eq('org_id', org.id)

      if (cidParam) {
        contactQuery = contactQuery.eq('id', cidParam)
      } else if (phoneParam) {
        const norm = normalizePhoneToE164(phoneParam)
        if (norm.isValid && norm.e164) {
          contactQuery = contactQuery.eq('phone', norm.e164)
        } else {
          contactQuery = contactQuery.eq('phone', phoneParam.trim())
        }
      }

      const { data: matchedContact } = await contactQuery.maybeSingle()

      if (matchedContact) {
        // Fetch most recent lead for service or notes
        const { data: lead } = await supabase
          .from('leads')
          .select('id, service_needed, notes, source')
          .eq('org_id', org.id)
          .eq('contact_id', matchedContact.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // Fetch latest inbound customer SMS text if notes is empty
        let latestText = lead?.notes || matchedContact.notes || ''
        if (!latestText) {
          const { data: conv } = await supabase
            .from('conversations')
            .select('id')
            .eq('org_id', org.id)
            .eq('contact_id', matchedContact.id)
            .maybeSingle()

          if (conv?.id) {
            const { data: latestMsg } = await supabase
              .from('messages')
              .select('body')
              .eq('conversation_id', conv.id)
              .eq('direction', 'inbound')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (latestMsg?.body) {
              latestText = latestMsg.body
            }
          }
        }

        const isGenericName = !matchedContact.name || matchedContact.name === 'Caller' || matchedContact.name === 'New Caller'

        prefill = {
          name: (!isGenericName ? matchedContact.name : (nameParam || '')) || '',
          phone: matchedContact.phone || phoneParam || '',
          email: matchedContact.email || '',
          address: matchedContact.address || '',
          notes: latestText || '',
          serviceNeeded: lead?.service_needed || '',
          source: sourceParam || lead?.source || 'missed_call'
        }
      } else if (phoneParam) {
        prefill = {
          name: nameParam || '',
          phone: phoneParam,
          email: '',
          address: '',
          notes: '',
          source: sourceParam || 'missed_call'
        }
      }
    }

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        phone: org.telnyx_phone_number || org.owner_phone,
        timezone: org.timezone || 'America/Chicago',
        booking_mode: org.booking_mode || 'instant',
        business_hours: org.business_hours,
        blocked_dates: org.blocked_dates || [],
        minimum_notice_hours: org.minimum_notice_hours ?? 2,
        max_booking_days_ahead: org.max_booking_days_ahead ?? 30,
        industry: org.industry || 'general',
        logo_url: org.logo_url || null
      },
      services: activeServices,
      prefill,
      bookingToken: generateBookingToken(org.slug, org.id)
    })
  } catch (err: any) {
    console.error('[BOOKING_GET_ORG_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
