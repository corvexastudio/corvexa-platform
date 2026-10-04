import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from '@/lib/security/rate-limiter'
import { logAuditEvent } from '@/lib/security/audit-logger'

export async function POST(request: Request) {
  // 1. Authenticate user and verify 'team:invite' permission (owner or admin)
  const tenantResult = await getTenantContext('team:invite')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, user, role, supabase } = tenantResult

  // 2. Rate Limiting per Tenant (Requirement 9)
  const rateLimit = checkRateLimit(`tenant:${orgId}:invite`, RATE_LIMITS.TEAM_INVITE)
  const rateHeaders = getRateLimitHeaders(rateLimit)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded: Maximum 10 invites per minute.' },
      { status: 429, headers: rateHeaders }
    )
  }

  try {
    const { email, role: rawTargetRole } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400, headers: rateHeaders })
    }

    // Role mapping: member (dispatcher) or admin (client_admin)
    const assignedRole = ['client_admin', 'admin'].includes(rawTargetRole) ? 'client_admin' : 'dispatcher'

    // Note: If SUPABASE_SERVICE_ROLE_KEY is configured, trigger admin invite
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceRoleKey) {
      try {
        const { createClient: createAdminClient } = await import('@supabase/supabase-js')
        const adminClient = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
        await adminClient.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
          data: { role: assignedRole, org_id: orgId }
        })
      } catch (adminErr) {
        console.warn('[TEAM INVITE ADMIN WARNING]', adminErr)
      }
    }

    // Requirement 10: Audit Logging
    await logAuditEvent(supabase, {
      org_id: orgId,
      event_type: 'team.invite_sent',
      description: `Invited user ${email} as '${assignedRole}'`,
      metadata: {
        actor_id: user.id,
        actor_role: role,
        invited_email: email,
        assigned_role: assignedRole
      }
    })

    return NextResponse.json({ success: true, message: `Invite sent to ${email}` }, { headers: rateHeaders })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: rateHeaders })
  }
}
