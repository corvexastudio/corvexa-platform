import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { checkRateLimitAsync, getRateLimitHeaders, extractClientIp } from '@/lib/security/rate-limiter'
import { logAuditEvent } from '@/lib/security/audit-logger'
import { resetDemoTenantData, SYNTHETIC_DEMO_ORG_ID } from '@/lib/demo/demo-reset-service'

export const dynamic = 'force-dynamic'

/**
 * 1-Click Demo Tenant Data Eraser / Clean Slate Endpoint
 * 
 * SECURITY INVARIANTS:
 * 1. Hardcoded target: strictly wipes SYNTHETIC_DEMO_ORG_ID ('26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7').
 * 2. Never accepts or allows any dynamic org_id parameter.
 * 3. Requires super_admin OR demo tenant owner/admin privileges.
 * 4. Rate-limited to prevent abuse.
 * 5. Audit logged.
 */
export async function POST(request: Request) {
  const tenantResult = await getTenantContext()
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { user, role, isSuperAdmin, supabase, orgId } = tenantResult

  // Allow either platform super admin or demo tenant owner/admin
  const isAuthorized = isSuperAdmin || (orgId === SYNTHETIC_DEMO_ORG_ID && (role === 'owner' || role === 'admin'))
  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Forbidden: Super Admin or Demo Tenant Owner privileges required.' },
      { status: 403 }
    )
  }

  // Rate Limiting (max 6 resets per minute)
  const clientIp = extractClientIp(request)
  const rateLimit = await checkRateLimitAsync(`admin:demo:reset:${user.id}:${clientIp}`, { max: 6, windowMs: 60000 })
  const rateHeaders = getRateLimitHeaders(rateLimit)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded: Please wait a moment before resetting the demo tenant again.' },
      { status: 429, headers: rateHeaders }
    )
  }

  try {
    const result = await resetDemoTenantData()

    // Audit Log the reset
    try {
      await logAuditEvent(supabase, {
        org_id: SYNTHETIC_DEMO_ORG_ID,
        event_type: 'admin.action_performed',
        description: 'CaptoDesk Demo Tenant wiped and reset to pristine day-one baseline',
        metadata: {
          actor_id: user.id,
          actor_email: user.email,
          actor_role: role,
          is_super_admin: isSuperAdmin,
          cleared_tables_count: result.clearedTables.length,
          seeded_services_count: result.seededServicesCount,
          seeded_jobs_count: result.seededJobsCount
        }
      })
    } catch (auditErr) {
      console.warn('[DEMO RESET AUDIT WARNING]', auditErr)
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        cleared_tables: result.clearedTables,
        seeded_services_count: result.seededServicesCount,
        seeded_jobs_count: result.seededJobsCount,
        timestamp: new Date().toISOString()
      },
      { headers: rateHeaders }
    )
  } catch (err: any) {
    console.error('[DEMO RESET FATAL ERROR]', err)
    return NextResponse.json(
      { error: err.message || 'Failed to reset demo tenant' },
      { status: 500, headers: rateHeaders }
    )
  }
}
