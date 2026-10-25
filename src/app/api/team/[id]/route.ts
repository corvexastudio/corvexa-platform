import { NextResponse } from 'next/server.js'
import { getTenantContext, invalidateProfileCache } from '../../../../lib/security/tenant-context.ts'
import { logAuditEvent } from '../../../../lib/security/audit-logger.ts'

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }>; customSupabase?: any }
) {
  const tenantResult = await getTenantContext('team:manage', props?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, user, role: callerRole, supabase } = tenantResult

  try {
    const { id } = await props.params
    if (!id) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 })
    }

    // 1. Prevent self-modification
    if (id === user.id) {
      return NextResponse.json({ error: 'You cannot modify your own profile row' }, { status: 400 })
    }

    // 2. Fetch target profile
    const { data: targetProfile, error: targetErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (targetErr || !targetProfile || targetProfile.org_id !== orgId) {
      return NextResponse.json({ error: 'Team member not found in your organization' }, { status: 404 })
    }

    // 3. Prevent non-owners from modifying owner or super_admin
    if (['owner', 'super_admin'].includes(targetProfile.role) && callerRole !== 'owner' && callerRole !== 'super_admin') {
      return NextResponse.json({ error: 'Admins cannot modify organization owners' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { role: rawTargetRole, fullName } = body

    const updatePayload: Record<string, any> = {}

    if (rawTargetRole) {
      const normalizedTargetRole = rawTargetRole.toLowerCase().trim()

      // Privilege escalation guards
      if (normalizedTargetRole === 'super_admin' && callerRole !== 'super_admin') {
        return NextResponse.json({ error: 'Unauthorized role assignment' }, { status: 403 })
      }

      if (normalizedTargetRole === 'owner' && callerRole !== 'owner' && callerRole !== 'super_admin') {
        return NextResponse.json({ error: 'Only organization owners can assign the owner role' }, { status: 403 })
      }

      const validRoles = ['admin', 'client_admin', 'dispatcher', 'technician', 'member', 'owner']
      if (!validRoles.includes(normalizedTargetRole)) {
        return NextResponse.json({ error: `Invalid role: ${rawTargetRole}` }, { status: 400 })
      }

      updatePayload.role = normalizedTargetRole === 'admin' ? 'client_admin' : normalizedTargetRole
    }

    if (typeof fullName === 'string' && fullName.trim()) {
      updatePayload.full_name = fullName.trim()
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: updatedProfile, error: updateErr } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*')
      .single()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    invalidateProfileCache(id)

    await logAuditEvent(supabase, {
      org_id: orgId,
      event_type: 'user.profile_updated',
      description: `Staff member ${targetProfile.email || id} role changed from ${targetProfile.role} to ${updatePayload.role || targetProfile.role}`,
      metadata: { actor_id: user.id, target_user_id: id, old_role: targetProfile.role, updates: updatePayload }
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      member: updatedProfile,
      message: 'Team member updated successfully'
    })
  } catch (err: any) {
    console.error('[TEAM_MEMBER_PATCH_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }>; customSupabase?: any }
) {
  const tenantResult = await getTenantContext('team:remove', props?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, user, role: callerRole, supabase } = tenantResult

  try {
    const { id } = await props.params
    if (!id) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 })
    }

    // 1. Prevent self-deletion
    if (id === user.id) {
      return NextResponse.json({ error: 'You cannot remove your own account from the organization' }, { status: 400 })
    }

    // 2. Fetch target profile
    const { data: targetProfile, error: targetErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (targetErr || !targetProfile || targetProfile.org_id !== orgId) {
      return NextResponse.json({ error: 'Team member not found in your organization' }, { status: 404 })
    }

    // 3. Prevent non-owners from removing owner or super_admin
    if (['owner', 'super_admin'].includes(targetProfile.role) && callerRole !== 'owner' && callerRole !== 'super_admin') {
      return NextResponse.json({ error: 'Admins cannot remove organization owners' }, { status: 403 })
    }

    // 4. Revoke organization association
    const { error: removeErr } = await supabase
      .from('profiles')
      .update({ org_id: null, role: 'member' })
      .eq('id', id)
      .eq('org_id', orgId)

    if (removeErr) {
      return NextResponse.json({ error: removeErr.message }, { status: 500 })
    }

    // 5. Clean up active crew assignments and unassign scheduled field jobs
    try {
      await supabase
        .from('crew_members')
        .delete()
        .eq('profile_id', id)
    } catch {
      // Non-fatal
    }

    try {
      await supabase
        .from('jobs')
        .update({ assigned_to: null })
        .eq('assigned_to', id)
        .eq('org_id', orgId)
        .in('status', ['scheduled', 'confirmed'])
    } catch {
      // Non-fatal
    }

    invalidateProfileCache(id)

    await logAuditEvent(supabase, {
      org_id: orgId,
      event_type: 'team.member_removed',
      description: `Staff member ${targetProfile.email || id} removed from organization`,
      metadata: { actor_id: user.id, target_user_id: id, email: targetProfile.email }
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      message: 'Team member removed from organization'
    })
  } catch (err: any) {
    console.error('[TEAM_MEMBER_DELETE_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
