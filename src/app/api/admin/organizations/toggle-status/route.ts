import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { logAuditEvent } from '@/lib/security/audit-logger'

export async function POST(request: Request) {
  // Requirement 7: Every admin API must independently verify authenticated AND authorized admin role
  const tenantResult = await getTenantContext()
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { user, role, isSuperAdmin, supabase, orgId: userOrgId } = tenantResult

  try {
    const { org_id, status } = await request.json()

    if (!org_id || !status) {
      return NextResponse.json({ error: 'org_id and status are required' }, { status: 400 })
    }

    // Only super_admin or the specific owner of the organization can update status
    if (!isSuperAdmin && (role !== 'owner' || userOrgId !== org_id)) {
      return NextResponse.json({ error: 'Forbidden: Super administrator or organization owner required' }, { status: 403 })
    }

    const validStatuses = ['trial', 'active', 'past_due', 'suspended', 'canceled', 'churned']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid subscription status. Allowed: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('organizations')
      .update({ subscription_status: status })
      .eq('id', org_id)

    if (error) throw error

    // Requirement 10: Audit Logging
    await logAuditEvent(supabase, {
      org_id,
      event_type: 'billing.status_toggled',
      description: `Tenant subscription status updated to '${status}'`,
      metadata: {
        actor_id: user.id,
        actor_role: role,
        target_org_id: org_id,
        new_status: status
      }
    })

    return NextResponse.json({ success: true, status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
