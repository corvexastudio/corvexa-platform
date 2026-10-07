import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: Request,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params

    if (!slug) {
      return NextResponse.json({ error: 'Missing business slug' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Fetch Organization by Slug
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug, owner_phone, telnyx_phone_number, business_hours, timezone, booking_mode, default_duration_minutes, buffer_minutes, minimum_notice_hours, max_booking_days_ahead, blocked_dates')
      .eq('slug', slug)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // 2. Fetch Active Services
    const { data: services } = await supabase
      .from('services')
      .select('id, name, description, duration_minutes, price, requires_address, is_active, sort_order')
      .eq('org_id', org.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    // Provide default fallback service if none configured
    const activeServices = services && services.length > 0 ? services : [
      {
        id: 'default-service',
        name: 'Standard Consultation & Inspection',
        description: 'Comprehensive on-site inspection and quote.',
        duration_minutes: org.default_duration_minutes || 60,
        price: null,
        requires_address: true,
        is_active: true
      }
    ]

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
        max_booking_days_ahead: org.max_booking_days_ahead ?? 30
      },
      services: activeServices
    })
  } catch (err: any) {
    console.error('[BOOKING_GET_ORG_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
