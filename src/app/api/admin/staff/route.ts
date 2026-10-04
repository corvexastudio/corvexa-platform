import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { logAuditEvent } from '@/lib/security/audit-logger'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('admin:all')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { supabase } = tenantResult
  const url = new URL(request.url)
  const roleFilter = url.searchParams.get('role') || undefined
  const search = url.searchParams.get('search')?.toLowerCase() || undefined

  try {
    let query = supabase
      .from('profiles')
      .select('id, full_name, email, role, org_id, created_at, organizations(name, slug)')
      .order('created_at', { ascending: false })

    if (roleFilter && roleFilter !== 'all') {
      query = query.eq('role', roleFilter)
    }

    const { data: profiles, error } = await query
    if (error) throw error

    let staff = profiles || []
    if (search) {
      staff = staff.filter(
        (p: any) =>
          p.email?.toLowerCase().includes(search) ||
          p.full_name?.toLowerCase().includes(search) ||
          (p.organizations as any)?.name?.toLowerCase().includes(search)
      )
    }

    return NextResponse.json({
      success: true,
      count: staff.length,
      staff
    })
  } catch (err: any) {
    console.error('[Admin Staff API Error]', err)
    return NextResponse.json({ error: err.message || 'Failed to list staff' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('admin:all')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { user, role, supabase } = tenantResult

  try {
    const { userId, newRole } = await request.json()

    if (!userId || !newRole) {
      return NextResponse.json({ error: 'userId and newRole are required' }, { status: 400 })
    }

    const validRoles = ['super_admin', 'owner', 'admin', 'member']
    if (!validRoles.includes(newRole)) {
      return NextResponse.json(
        { error: `Invalid role. Allowed roles: ${validRoles.join(', ')}` },
        { status: 400 }
      )
    }

    // Safety: prevent super admin from accidentally demoting themselves
    if (userId === user.id && newRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot demote your own super administrator account.' },
        { status: 400 }
      )
    }

    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, org_id')
      .eq('id', userId)
      .single()

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const previousRole = targetProfile.role

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (updateError) throw updateError

    // Audit log role delegation
    await logAuditEvent(supabase, {
      org_id: targetProfile.org_id,
      event_type: 'admin.action_performed',
      description: `User '${targetProfile.email || userId}' role updated from '${previousRole}' to '${newRole}'`,
      metadata: {
        actor_id: user.id,
        actor_role: role,
        target_user_id: userId,
        previous_role: previousRole,
        new_role: newRole
      }
    })

    return NextResponse.json({
      success: true,
      userId,
      newRole,
      previousRole,
      message: `User '${targetProfile.email || targetProfile.full_name}' successfully updated to '${newRole}'.`
    })
  } catch (err: any) {
    console.error('[Admin Role Update Error]', err)
    return NextResponse.json({ error: err.message || 'Failed to update user role' }, { status: 500 })
  }
}
