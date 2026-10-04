import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'

export async function GET() {
  const tenantResult = await getTenantContext('appointments:read')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  // 1. Fetch organization booking configuration
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, timezone, booking_mode, default_duration_minutes, buffer_minutes, minimum_notice_hours, max_booking_days_ahead, blocked_dates, business_hours')
    .eq('id', orgId)
    .single()

  // 2. Fetch services
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true })

  return NextResponse.json({
    config: org,
    services: services || []
  })
}

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('appointments:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const body = await request.json()
    const { name, description, duration_minutes, price, requires_address, is_active } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Service name is required' }, { status: 400 })
    }

    const { data: newService, error } = await supabase
      .from('services')
      .insert({
        org_id: orgId,
        name: name.trim(),
        description: description?.trim() || null,
        duration_minutes: duration_minutes ? parseInt(duration_minutes, 10) : 60,
        price: price ? parseFloat(price) : null,
        requires_address: requires_address !== false,
        is_active: is_active !== false
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ service: newService })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const tenantResult = await getTenantContext('appointments:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const body = await request.json()
    const {
      booking_mode,
      default_duration_minutes,
      buffer_minutes,
      minimum_notice_hours,
      max_booking_days_ahead,
      blocked_dates,
      business_hours
    } = body

    const updateFields: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    if (booking_mode && ['instant', 'request'].includes(booking_mode)) {
      updateFields.booking_mode = booking_mode
    }
    if (default_duration_minutes !== undefined) {
      updateFields.default_duration_minutes = parseInt(default_duration_minutes, 10)
    }
    if (buffer_minutes !== undefined) {
      updateFields.buffer_minutes = parseInt(buffer_minutes, 10)
    }
    if (minimum_notice_hours !== undefined) {
      updateFields.minimum_notice_hours = parseInt(minimum_notice_hours, 10)
    }
    if (max_booking_days_ahead !== undefined) {
      updateFields.max_booking_days_ahead = parseInt(max_booking_days_ahead, 10)
    }
    if (Array.isArray(blocked_dates)) {
      updateFields.blocked_dates = blocked_dates
    }
    if (business_hours && typeof business_hours === 'object') {
      updateFields.business_hours = business_hours
    }

    const { data: updatedOrg, error } = await supabase
      .from('organizations')
      .update(updateFields)
      .eq('id', orgId)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ config: updatedOrg })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
