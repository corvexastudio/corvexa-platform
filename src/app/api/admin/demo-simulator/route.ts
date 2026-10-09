import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { checkRateLimitAsync, RATE_LIMITS, getRateLimitHeaders, extractClientIp } from '@/lib/security/rate-limiter'
import { logAuditEvent } from '@/lib/security/audit-logger'
import { sendTelnyxSms, toE164 } from '@/lib/telnyx'

export async function POST(request: Request) {
  // SEC-02 & Requirement 7: Every admin API must independently verify authenticated and authorized role
  const tenantResult = await getTenantContext()
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { user, role, isSuperAdmin, supabase, orgId } = tenantResult

  // Only super_admin or tenant owner/admin running a sales demo can execute
  if (!isSuperAdmin && role !== 'owner' && role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Administrative demo permissions required.' },
      { status: 403 }
    )
  }

  // Distributed Rate Limiting (HIGH-05)
  const clientIp = extractClientIp(request)
  const rateLimit = await checkRateLimitAsync(`admin:demo:${user.id}:${clientIp}`, RATE_LIMITS.DEMO_SIMULATOR)
  const rateHeaders = getRateLimitHeaders(rateLimit)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded: Maximum 5 demo dispatches per minute.' },
      { status: 429, headers: rateHeaders }
    )
  }

  try {
    const { business_name, phone, message } = await request.json()

    if (!phone || !message) {
      return NextResponse.json(
        { error: 'Phone number and message are required' },
        { status: 400, headers: rateHeaders }
      )
    }

    const cleanPhone = toE164(phone)

    // Composite Destination Rate Limiting (HIGH-05)
    const destRateLimit = await checkRateLimitAsync(`sms:dest:${cleanPhone}`, { max: 5, windowMs: 60000 })
    if (!destRateLimit.allowed) {
      return NextResponse.json(
        { error: 'Destination rate limit exceeded. Too many demo messages sent to this phone number.' },
        { status: 429, headers: getRateLimitHeaders(destRateLimit) }
      )
    }
    const result = await sendTelnyxSms({
      to: cleanPhone,
      text: message
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to dispatch demo SMS' },
        { status: 500, headers: rateHeaders }
      )
    }

    // Requirement 10: Audit Logging
    await logAuditEvent(supabase, {
      org_id: orgId || null,
      event_type: 'admin.action_performed',
      description: `Sales demo SMS dispatched to ${cleanPhone}`,
      metadata: {
        actor_id: user.id,
        actor_role: role,
        action: 'demo_simulator_dispatch',
        prospect_phone: cleanPhone,
        business_name: business_name || 'Generic Prospect'
      }
    })

    return NextResponse.json(
      {
        success: true,
        delivered_to: cleanPhone,
        message_id: result.messageId
      },
      { headers: rateHeaders }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: rateHeaders })
  }
}
