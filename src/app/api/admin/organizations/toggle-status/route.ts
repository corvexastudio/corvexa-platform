import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../lib/security/tenant-context.ts'
import { logAuditEvent } from '../../../../../lib/security/audit-logger.ts'

export const dynamic = 'force-dynamic'

export interface ToggleStatusRouteContext {
  params?: Promise<Record<string, string | string[] | undefined>>
  customSupabase?: any
}

export type ToggleStatusDependencies = ToggleStatusRouteContext

export async function POST(request: Request, context?: ToggleStatusRouteContext) {
  // P1-BILLING: Strictly restricted to Super Admin ('admin:all').
  // Tenant owners/admins can NEVER toggle or grant subscription status.
  const tenantResult = await getTenantContext('admin:all', context?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { user, role, supabase } = tenantResult

  try {
    const { org_id, status } = await request.json()

    if (!org_id || !status) {
      return NextResponse.json({ error: 'org_id and status are required' }, { status: 400 })
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

    // Synchronize saas_subscriptions table if record exists
    try {
      const { data: sub } = await supabase
        .from('saas_subscriptions')
        .select('id, status')
        .eq('org_id', org_id)
        .maybeSingle()

      if (sub) {
        const subStatusMap: Record<string, string> = {
          trial: 'pending',
          active: 'active',
          past_due: 'past_due',
          suspended: 'canceled',
          canceled: 'canceled',
          churned: 'canceled'
        }
        const targetSubStatus = subStatusMap[status] || status
        await supabase
          .from('saas_subscriptions')
          .update({
            status: targetSubStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', sub.id)
      }
    } catch {
      // Non-fatal if saas_subscriptions record is absent
    }

    // Audit Logging
    await logAuditEvent(supabase, {
      org_id,
      event_type: 'billing.status_toggled',
      description: `Tenant subscription status updated to '${status}' by super admin`,
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
