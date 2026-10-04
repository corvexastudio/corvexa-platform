import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from '@/lib/security/rate-limiter'
import { logAuditEvent } from '@/lib/security/audit-logger'
import { sendTelnyxSms, toE164 } from '@/lib/telnyx'

export async function POST(request: Request) {
  // 1. Authenticate user and resolve organization server-side (Requirement 1 & 2)
  const tenantResult = await getTenantContext('messages:send')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, user, role, isSuperAdmin, supabase } = tenantResult

  // 2. Rate Limiting per Tenant (Requirement 9)
  const rateLimit = checkRateLimit(`tenant:${orgId}:sms`, RATE_LIMITS.SMS_SEND)
  const rateHeaders = getRateLimitHeaders(rateLimit)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded: Maximum 30 messages per minute.' },
      { status: 429, headers: rateHeaders }
    )
  }

  try {
    const body = await request.json()
    const { conversation_id, message, to: clientTo } = body

    if (!conversation_id || !message || !message.trim()) {
      return NextResponse.json(
        { error: 'Missing required parameters: conversation_id and message are required' },
        { status: 400, headers: rateHeaders }
      )
    }

    // 3. Load conversation strictly scoped to organization (Requirement 3 & 6)
    // Never trust client-supplied organization_id or conversation_id
    let query = supabase
      .from('conversations')
      .select(`
        id,
        org_id,
        contact_id,
        contacts (
          id,
          phone,
          name,
          opt_out
        ),
        organizations (
          id,
          name,
          telnyx_phone_number
        )
      `)
      .eq('id', conversation_id)

    if (!isSuperAdmin) {
      query = query.eq('org_id', orgId)
    }

    const { data: conv, error: convError } = await query.single()

    if (convError || !conv) {
      console.warn(`[SECURITY WARNING] User ${user.id} attempted to access conversation ${conversation_id} outside org ${orgId}`)
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404, headers: rateHeaders }
      )
    }

    const contact: any = conv.contacts
    const org: any = conv.organizations

    if (!contact || !contact.phone) {
      return NextResponse.json(
        { error: 'Associated contact phone not found' },
        { status: 400, headers: rateHeaders }
      )
    }

    // 4. TCPA Opt-out Enforcement
    if (contact.opt_out) {
      return NextResponse.json(
        { error: 'Cannot send message: Contact has unsubscribed/opted out of SMS communications' },
        { status: 403, headers: rateHeaders }
      )
    }

    const senderNumber = org?.telnyx_phone_number
    if (!senderNumber) {
      return NextResponse.json(
        { error: 'No outbound telephony number configured for this organization' },
        { status: 400, headers: rateHeaders }
      )
    }

    // 5. REQUIREMENT 6: Never trust arbitrary client-supplied 'to'.
    // The recipient phone number is resolved strictly from the verified contact record!
    const verifiedRecipient = toE164(contact.phone)

    if (clientTo && toE164(clientTo) !== verifiedRecipient) {
      console.warn(
        `[SECURITY WARNING] Mismatched destination phone: client supplied '${clientTo}', but conversation contact is '${verifiedRecipient}'. Enforcing contact record.`
      )
    }

    // 6. Dispatch SMS via Telnyx
    const result = await sendTelnyxSms({
      to: verifiedRecipient,
      from: senderNumber,
      text: message.trim()
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to dispatch SMS' },
        { status: 500, headers: rateHeaders }
      )
    }

    // 7. Store outbound message in database
    const { data: newMsg, error: msgError } = await supabase
      .from('messages')
      .insert({
        org_id: conv.org_id,
        conversation_id: conv.id,
        direction: 'outbound',
        sender_type: 'owner',
        body: message.trim(),
        delivery_status: 'sent',
        telnyx_message_id: result.messageId
      })
      .select('*')
      .single()

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500, headers: rateHeaders })
    }

    // 8. Update conversation preview
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: message.trim()
      })
      .eq('id', conv.id)

    // 9. Requirement 10: Audit Logging
    await logAuditEvent(supabase, {
      org_id: conv.org_id,
      event_type: 'sms.outbound_dispatched',
      description: `Manual SMS sent to contact ${contact.name || contact.phone}`,
      metadata: {
        actor_id: user.id,
        actor_role: role,
        conversation_id: conv.id,
        telnyx_message_id: result.messageId,
        destination_phone: verifiedRecipient
      }
    })

    return NextResponse.json({ success: true, message: newMsg }, { headers: rateHeaders })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: rateHeaders })
  }
}
