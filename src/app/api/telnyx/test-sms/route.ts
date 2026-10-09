import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from '@/lib/security/rate-limiter'
import { normalizePhoneToE164 } from '@/lib/telephony/phone-normalizer'
import { verifyOutboundCompliance, logComplianceAudit } from '@/lib/compliance/compliance-engine'
import { sendTelnyxSms } from '@/lib/telnyx'
import { logAuditEvent } from '@/lib/security/audit-logger'

/**
 * Settings Test SMS Endpoint:
 * Dispatches the tenant's configured missed-call SMS template directly to the owner/operator's number.
 * CRITICAL SAFETY RULES:
 *  - Must NOT create a review request
 *  - Must NOT create a lead
 *  - Must NOT create a customer
 *  - Must NOT trigger review automation
 */
export async function POST(request: Request) {
  const tenantResult = await getTenantContext('messages:send')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, user, role, supabase } = tenantResult

  // 1. Rate Limiting on Test SMS (Max 5 per minute per tenant)
  const rateLimit = checkRateLimit(`tenant:${orgId}:test_sms`, { max: 5, windowMs: 60000 })
  const rateHeaders = getRateLimitHeaders(rateLimit)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Test SMS rate limit exceeded. Please wait a minute before sending another test.' },
      { status: 429, headers: rateHeaders }
    )
  }

  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // Body may be empty if testing default owner_phone
    }

    // 2. Fetch Organization Settings
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, owner_phone, telnyx_phone_number, auto_reply_template')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization configuration not found.' }, { status: 404, headers: rateHeaders })
    }

    // 3. Resolve Target Test Phone Number (Strictly bound to organization's registered owner_phone)
    const rawTargetPhone = org.owner_phone
    if (!rawTargetPhone) {
      return NextResponse.json(
        { error: 'Please enter your mobile phone number in Settings to receive the test SMS.' },
        { status: 400, headers: rateHeaders }
      )
    }

    const normTarget = normalizePhoneToE164(rawTargetPhone)
    if (!normTarget.isValid || !normTarget.e164) {
      return NextResponse.json(
        { error: 'Invalid recipient phone number format. Please enter a valid US phone number.' },
        { status: 400, headers: rateHeaders }
      )
    }

    // 4. Resolve Outbound Sender Phone Number
    let senderNumber = org.telnyx_phone_number
    if (!senderNumber) {
      const { data: numRow } = await supabase
        .from('telnyx_phone_numbers')
        .select('phone_number')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
      senderNumber = numRow?.phone_number
    }

    if (!senderNumber) {
      return NextResponse.json(
        { error: 'No active Telnyx number assigned to your organization. Complete forwarding setup first.' },
        { status: 400, headers: rateHeaders }
      )
    }

    // 5. Render Missed-Call Template Text
    const template = org.auto_reply_template || 'Sorry we missed your call! How can we help you today?'
    const rawTestBody = `[CaptoDesk Test] ${template}`

    // 6. Pre-flight Outbound Compliance Check
    const compliance = await verifyOutboundCompliance(supabase, {
      orgId,
      toPhone: normTarget.e164,
      fromPhone: senderNumber,
      flowType: 'test_sms',
      messageType: 'transactional',
      body: rawTestBody,
      ignoreFrequencyCap: true // Manual operator test message bypasses daily frequency cap
    })

    if (!compliance.allowed) {
      return NextResponse.json(
        { error: `Test SMS suppressed by compliance policy: ${compliance.suppressionReason}` },
        { status: 400, headers: rateHeaders }
      )
    }

    // 7. Dispatch SMS (Explicitly isolated from reviews, leads, and customer tables)
    const smsResult = await sendTelnyxSms({
      to: normTarget.e164,
      from: senderNumber,
      text: compliance.formattedText
    })

    if (!smsResult.success) {
      return NextResponse.json(
        { error: smsResult.error || 'Telnyx failed to deliver test SMS.' },
        { status: 502, headers: rateHeaders }
      )
    }

    // 8. Audit Logging
    await logComplianceAudit(supabase, {
      orgId,
      phone: normTarget.e164,
      action: 'message_sent',
      messageType: 'transactional',
      reason: 'settings_test_sms',
      metadata: { actor_id: user.id, actor_role: role }
    })

    await logAuditEvent(supabase, {
      org_id: orgId,
      event_type: 'telephony.test_sms_sent',
      description: `Dispatched test missed-call SMS to ${normTarget.e164}`,
      metadata: {
        actor_id: user.id,
        recipient: normTarget.e164,
        sender: senderNumber,
        message_id: smsResult.messageId
      }
    })

    return NextResponse.json(
      {
        success: true,
        messageId: smsResult.messageId,
        recipient: normTarget.e164,
        message: `Test text successfully dispatched to ${normTarget.e164}`
      },
      { headers: rateHeaders }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500, headers: rateHeaders })
  }
}
