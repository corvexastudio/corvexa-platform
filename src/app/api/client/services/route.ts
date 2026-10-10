import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../lib/security/tenant-context.ts'

export interface ServiceRouteDependencies {
  customSupabase?: any
}

export async function GET(
  request?: Request,
  contextOrDeps?: any,
  deps?: ServiceRouteDependencies
) {
  const actualDeps: ServiceRouteDependencies | undefined =
    deps || (contextOrDeps && typeof contextOrDeps === 'object' && 'customSupabase' in contextOrDeps ? contextOrDeps : undefined)
  const tenantResult = await getTenantContext('appointments:read', actualDeps?.customSupabase)
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

export async function POST(
  request: Request,
  contextOrDeps?: any,
  deps?: ServiceRouteDependencies
) {
  // Service catalog mutation requires tenant management permission (owner or admin)
  const actualDeps: ServiceRouteDependencies | undefined =
    deps || (contextOrDeps && typeof contextOrDeps === 'object' && 'customSupabase' in contextOrDeps ? contextOrDeps : undefined)
  const tenantResult = await getTenantContext('org:update', actualDeps?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const body = await request.json()
    const { name, description, duration_minutes, price, requires_address, is_active, sort_order } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Service name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()
    if (trimmedName.length > 100) {
      return NextResponse.json({ error: 'Service name cannot exceed 100 characters' }, { status: 400 })
    }

    // Validate duration
    let parsedDuration = 60
    if (duration_minutes !== undefined && duration_minutes !== null && duration_minutes !== '') {
      const parsed = Number(duration_minutes)
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 1440) {
        return NextResponse.json({ error: 'Duration must be a positive integer in minutes (max 1440)' }, { status: 400 })
      }
      parsedDuration = parsed
    }

    // Validate price
    let parsedPrice: number | null = null
    if (price !== undefined && price !== null && price !== '') {
      const parsed = Number(price)
      if (isNaN(parsed) || parsed < 0) {
        return NextResponse.json({ error: 'Price must be a valid non-negative number' }, { status: 400 })
      }
      parsedPrice = Math.round(parsed * 100) / 100
    }

    // Check duplicate ACTIVE service name within organization (case-insensitive)
    if (is_active !== false) {
      const { data: existingDup } = await supabase
        .from('services')
        .select('id, name')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .ilike('name', trimmedName)
        .maybeSingle()

      if (existingDup) {
        return NextResponse.json(
          { error: 'A service with this name already exists' },
          { status: 409 }
        )
      }
    }

    const { data: newService, error } = await supabase
      .from('services')
      .insert({
        org_id: orgId,
        name: trimmedName,
        description: typeof description === 'string' && description.trim() ? description.trim() : null,
        duration_minutes: parsedDuration,
        price: parsedPrice,
        requires_address: requires_address !== false,
        is_active: is_active !== false,
        sort_order: typeof sort_order === 'number' ? Math.floor(sort_order) : 0
      })
      .select('*')
      .single()

    if (error) {
      if (
        error.code === '23505' ||
        error.message?.toLowerCase().includes('unique') ||
        error.message?.toLowerCase().includes('duplicate') ||
        error.message?.includes('uq_services_org_id_name') ||
        error.message?.includes('uq_services_org_id_active_name')
      ) {
        return NextResponse.json(
          { error: 'A service with this name already exists' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ service: newService }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  contextOrDeps?: any,
  deps?: ServiceRouteDependencies
) {
  const actualDeps: ServiceRouteDependencies | undefined =
    deps || (contextOrDeps && typeof contextOrDeps === 'object' && 'customSupabase' in contextOrDeps ? contextOrDeps : undefined)
  const tenantResult = await getTenantContext('appointments:manage', actualDeps?.customSupabase)
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
