import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../lib/security/tenant-context.ts'

export interface ServiceIdRouteDependencies {
  customSupabase?: any
}

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
  deps?: ServiceIdRouteDependencies
) {
  const tenantResult = await getTenantContext('appointments:read', deps?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const { id } = await props.params

  if (!id) {
    return NextResponse.json({ error: 'Service ID is required' }, { status: 400 })
  }

  const { data: service, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error || !service) {
    return NextResponse.json({ error: 'Service not found or access denied' }, { status: 404 })
  }

  return NextResponse.json({ service })
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> },
  deps?: ServiceIdRouteDependencies
) {
  // Service catalog mutation requires tenant management permission (owner or admin)
  const tenantResult = await getTenantContext('org:update', deps?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const { id } = await props.params

  if (!id) {
    return NextResponse.json({ error: 'Service ID is required' }, { status: 400 })
  }

  // 1. Verify existence and tenant boundary (IDOR protection)
  const { data: existingService, error: fetchErr } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (fetchErr || !existingService) {
    return NextResponse.json({ error: 'Service not found or access denied' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    // Validate Name if provided
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json({ error: 'Service name cannot be empty' }, { status: 400 })
      }
      const trimmedName = body.name.trim()
      if (trimmedName.length > 100) {
        return NextResponse.json({ error: 'Service name cannot exceed 100 characters' }, { status: 400 })
      }

      updates.name = trimmedName
    }

    // Validate Duration if provided
    if (body.duration_minutes !== undefined) {
      const parsedDuration = Number(body.duration_minutes)
      if (!Number.isInteger(parsedDuration) || parsedDuration <= 0 || parsedDuration > 1440) {
        return NextResponse.json({ error: 'Duration must be a positive integer in minutes (max 1440)' }, { status: 400 })
      }
      updates.duration_minutes = parsedDuration
    }

    // Validate Price if provided
    if (body.price !== undefined) {
      if (body.price === null || body.price === '') {
        updates.price = null
      } else {
        const parsedPrice = Number(body.price)
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          return NextResponse.json({ error: 'Price must be a valid non-negative number' }, { status: 400 })
        }
        updates.price = Math.round(parsedPrice * 100) / 100
      }
    }

    // Validate Description
    if (body.description !== undefined) {
      updates.description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null
    }

    // Validate Requires Address
    if (body.requires_address !== undefined) {
      if (typeof body.requires_address !== 'boolean') {
        return NextResponse.json({ error: 'requires_address must be a boolean' }, { status: 400 })
      }
      updates.requires_address = body.requires_address
    }

    // Validate Active status
    if (body.is_active !== undefined) {
      if (typeof body.is_active !== 'boolean') {
        return NextResponse.json({ error: 'is_active must be a boolean' }, { status: 400 })
      }
      updates.is_active = body.is_active
    }

    // Validate Sort Order
    if (body.sort_order !== undefined) {
      const parsedOrder = Number(body.sort_order)
      if (!isNaN(parsedOrder)) {
        updates.sort_order = Math.floor(parsedOrder)
      }
    }

    const targetName = updates.name || existingService.name
    const targetIsActive = updates.is_active !== undefined ? updates.is_active : existingService.is_active

    // Check duplicate ACTIVE name within tenant excluding current service
    if (targetIsActive && (updates.name || updates.is_active !== undefined)) {
      const { data: dup } = await supabase
        .from('services')
        .select('id')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .ilike('name', targetName)
        .neq('id', id)
        .maybeSingle()

      if (dup) {
        return NextResponse.json(
          { error: 'A service with this name already exists' },
          { status: 409 }
        )
      }
    }

    const { data: updatedService, error: updateErr } = await supabase
      .from('services')
      .update(updates)
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*')
      .single()

    if (updateErr) {
      if (
        updateErr.code === '23505' ||
        updateErr.message?.toLowerCase().includes('unique') ||
        updateErr.message?.toLowerCase().includes('duplicate') ||
        updateErr.message?.includes('uq_services_org_id_name') ||
        updateErr.message?.includes('uq_services_org_id_active_name')
      ) {
        return NextResponse.json(
          { error: 'A service with this name already exists' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: updateErr.message }, { status: 400 })
    }

    return NextResponse.json({ service: updatedService })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> },
  deps?: ServiceIdRouteDependencies
) {
  // Service catalog mutation requires tenant management permission (owner or admin)
  const tenantResult = await getTenantContext('org:update', deps?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const { id } = await props.params

  if (!id) {
    return NextResponse.json({ error: 'Service ID is required' }, { status: 400 })
  }

  // 1. Verify existence and tenant boundary (IDOR protection)
  const { data: service, error: svcErr } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (svcErr || !service) {
    return NextResponse.json({ error: 'Service not found or access denied' }, { status: 404 })
  }

  try {
    // 2. Historical safety check: inspect foreign references
    const [aptRes, jobRes] = await Promise.all([
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('service_id', id),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('service_id', id)
    ])

    const hasHistory = (aptRes.count || 0) > 0 || (jobRes.count || 0) > 0

    if (hasHistory) {
      // Historical references exist: Soft-deactivate to preserve historical integrity
      const { data: deactivated, error: deactErr } = await supabase
        .from('services')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('org_id', orgId)
        .select('*')
        .single()

      if (deactErr) {
        return NextResponse.json({ error: deactErr.message }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        deactivated: true,
        service: deactivated,
        message: 'Service has existing appointment or job history and has been deactivated to preserve records.'
      })
    }

    // No historical references: Safe to hard delete
    const { error: delErr } = await supabase
      .from('services')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId)

    if (delErr) {
      if (
        delErr.code === '23503' ||
        delErr.code === '23001' ||
        delErr.message?.toLowerCase().includes('violates foreign key') ||
        delErr.message?.toLowerCase().includes('restrict')
      ) {
        // Fallback safety: If DB blocked deletion via RESTRICT, soft-deactivate instead
        const { data: deactivated } = await supabase
          .from('services')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('org_id', orgId)
          .select('*')
          .single()

        return NextResponse.json({
          success: true,
          deactivated: true,
          service: deactivated,
          message: 'Service has existing appointment or job history and has been deactivated to preserve records.'
        })
      }
      return NextResponse.json({ error: delErr.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      deleted: true,
      message: 'Service deleted successfully.'
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
