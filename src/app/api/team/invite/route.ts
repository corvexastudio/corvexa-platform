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

    const normalizedEmail = email.trim().toLowerCase()

    // Role mapping: dispatcher (default) or client_admin
    const assignedRole = ['client_admin', 'admin'].includes(rawTargetRole) ? 'client_admin' : 'dispatcher'

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    let inviteStatus: 'INVITE_SENT' | 'INVITE_CREATED_BUT_EMAIL_PENDING' | 'INVITE_FAILED' = 'INVITE_FAILED'
    let statusMessage = ''
    let inviteLink: string | undefined = undefined

    if (!serviceRoleKey) {
      // Email delivery service role is not configured
      inviteStatus = 'INVITE_CREATED_BUT_EMAIL_PENDING'
      statusMessage = "Invitation created, but email delivery isn't configured."
    } else {
      try {
        const { createClient: createAdminClient } = await import('@supabase/supabase-js')
        const adminClient = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)

        // Attempt authoritative email invitation dispatch
        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
          normalizedEmail,
          { data: { role: assignedRole, org_id: orgId } }
        )

        if (inviteError) {
          console.warn('[TEAM INVITE EMAIL WARNING]', inviteError.message)
          
          // Fallback: Generate secure one-time invitation link if email SMTP was unavailable
          try {
            const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
              type: 'invite',
              email: normalizedEmail,
              options: {
                data: { role: assignedRole, org_id: orgId }
              }
            })

            if (!linkError && linkData?.properties?.action_link) {
              inviteStatus = 'INVITE_CREATED_BUT_EMAIL_PENDING'
              statusMessage = "Invitation created, but email delivery isn't configured."
              inviteLink = linkData.properties.action_link
            } else {
              inviteStatus = 'INVITE_FAILED'
              statusMessage = inviteError.message || 'Failed to dispatch invitation'
            }
          } catch {
            inviteStatus = 'INVITE_FAILED'
            statusMessage = inviteError.message || 'Failed to dispatch invitation'
          }
        } else if (inviteData?.user) {
          inviteStatus = 'INVITE_SENT'
          statusMessage = `Invitation email sent to ${normalizedEmail}`
        } else {
          inviteStatus = 'INVITE_CREATED_BUT_EMAIL_PENDING'
          statusMessage = "Invitation created, but email delivery isn't configured."
        }
      } catch (err: any) {
        inviteStatus = 'INVITE_FAILED'
        statusMessage = err?.message || 'Failed to generate invitation'
      }
    }

    // Audit Logging with precise state
    await logAuditEvent(supabase, {
      org_id: orgId,
      event_type: inviteStatus === 'INVITE_SENT' 
        ? 'team.invite_sent' 
        : inviteStatus === 'INVITE_CREATED_BUT_EMAIL_PENDING' 
          ? 'team.invite_created_email_pending' 
          : 'team.invite_failed',
      description: `Team invite for ${normalizedEmail} as '${assignedRole}': ${inviteStatus}`,
      metadata: {
        actor_id: user.id,
        actor_role: role,
        invited_email: normalizedEmail,
        assigned_role: assignedRole,
        invite_status: inviteStatus,
        has_invite_link: Boolean(inviteLink)
      }
    })

    if (inviteStatus === 'INVITE_FAILED') {
      return NextResponse.json(
        {
          success: false,
          status: 'INVITE_FAILED',
          error: statusMessage,
          message: statusMessage
        },
        { status: 400, headers: rateHeaders }
      )
    }

    return NextResponse.json(
      {
        success: true,
        status: inviteStatus,
        message: statusMessage,
        inviteLink,
        email: normalizedEmail,
        role: assignedRole
      },
      { status: 200, headers: rateHeaders }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message, status: 'INVITE_FAILED' }, { status: 500, headers: rateHeaders })
  }
}
