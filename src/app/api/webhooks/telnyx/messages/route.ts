import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processInboundSms } from '@/lib/services/sms-handler'
import { verifyTelnyxSignature } from '@/lib/telnyx'
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders, extractClientIp } from '@/lib/security/rate-limiter'
import { telemetryStore } from '@/lib/observability/telemetry-store'
import { createStructuredLogger } from '@/lib/observability/logger'

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  const logger = createStructuredLogger({ request_id: requestId })
  
  telemetryStore.recordWebhook({
    provider: 'telnyx',
    eventType: 'message.raw',
    stage: 'received',
    requestId
  })

  // 1. Rate limiting on webhooks
  const clientIp = extractClientIp(request)
  const rateLimit = checkRateLimit(`webhook:sms:${clientIp}`, RATE_LIMITS.WEBHOOK)
  const rateHeaders = getRateLimitHeaders(rateLimit)

  if (!rateLimit.allowed) {
    logger.warn('Telnyx SMS webhook rate limit exceeded', { clientIp })
    return NextResponse.json(
      { error: 'Webhook rate limit exceeded.' },
      { status: 429, headers: rateHeaders }
    )
  }

  // 2. Read raw text for Ed25519 signature verification before parsing JSON
  const rawBody = await request.text()
  const signature = request.headers.get('telnyx-signature-ed25519')
  const timestamp = request.headers.get('telnyx-timestamp')

  // SEC-03: Verify webhook cryptographic signature
  if (!signature || !timestamp) {
    telemetryStore.recordWebhook({
      provider: 'telnyx',
      eventType: 'message.signature_missing',
      stage: 'rejected',
      requestId,
      error: 'Missing signature headers'
    })
    logger.warn('Telnyx message webhook rejected: missing signature or timestamp', { clientIp })
    return NextResponse.json({ error: 'Missing Telnyx webhook signature or timestamp' }, { status: 401, headers: rateHeaders })
  }

  const isValidSignature = verifyTelnyxSignature(rawBody, signature, timestamp)
  if (!isValidSignature) {
    telemetryStore.recordWebhook({
      provider: 'telnyx',
      eventType: 'message.signature_rejected',
      stage: 'rejected',
      requestId,
      error: 'Invalid signature'
    })
    logger.warn('Telnyx message webhook rejected: invalid signature', { clientIp })
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401, headers: rateHeaders })
  }

  // Parse and validate JSON payload structure
  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    logger.warn('Telnyx message webhook rejected: malformed JSON', { clientIp })
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400, headers: rateHeaders })
  }

  if (!body || typeof body !== 'object' || !body.data || typeof body.data !== 'object') {
    logger.warn('Telnyx message webhook rejected: invalid structure', { clientIp })
    return NextResponse.json({ error: 'Invalid Telnyx payload structure' }, { status: 400, headers: rateHeaders })
  }

  // 3. Supabase service role client
  const supabase = createAdminClient()

  let eventId: string | undefined
  let eventType = 'unknown'

  try {
    eventType = body.data.event_type || 'unknown'
    const payload = body.data.payload
    eventId = body.data.id

    telemetryStore.recordWebhook({
      provider: 'telnyx',
      eventType,
      stage: 'verified',
      providerEventId: eventId,
      requestId
    })

    // 4. Atomic Idempotency guard: Claim event ID
    if (eventId) {
      const { error: insertError } = await supabase.from('processed_events').insert({
        id: eventId,
        provider: 'telnyx',
        event_type: eventType,
        provider_event_id: eventId
      })

      if (insertError) {
        if (
          insertError.code === '23505' ||
          insertError.message?.toLowerCase().includes('unique') ||
          insertError.message?.toLowerCase().includes('duplicate')
        ) {
          telemetryStore.recordWebhook({
            provider: 'telnyx',
            eventType,
            stage: 'duplicated',
            providerEventId: eventId,
            requestId
          })
          logger.info('Duplicate Telnyx message webhook skipped', { eventId, eventType })
          return NextResponse.json({ success: true, message: 'Already processed (idempotent)' }, { status: 200 })
        }
        console.error('[TELNYX MESSAGE IDEMPOTENCY ERROR]', insertError)
        return NextResponse.json({ error: 'Database idempotency error' }, { status: 500 })
      }
    }

    // 5. Handle Delivery Status Callbacks (queued, sent, delivered, failed, undelivered)
    const deliveryStatusEvents = new Set([
      'message.sent',
      'message.delivered',
      'message.failed',
      'message.undelivered'
    ])

    if (deliveryStatusEvents.has(eventType)) {
      const telnyxMessageId = payload?.id
      if (!telnyxMessageId) {
        return NextResponse.json({ success: false, error: 'Missing message ID' }, { status: 400 })
      }

      let newStatus: 'sent' | 'delivered' | 'failed' | 'undelivered' = 'sent'
      if (eventType === 'message.delivered') newStatus = 'delivered'
      else if (eventType === 'message.failed') newStatus = 'failed'
      else if (eventType === 'message.undelivered') newStatus = 'undelivered'

      const failureReason =
        payload?.errors?.[0]?.detail ||
        payload?.to?.[0]?.status ||
        (newStatus === 'failed' || newStatus === 'undelivered' ? 'Carrier delivery failure' : null)

      const { data: updatedMsg, error: updateError } = await supabase
        .from('messages')
        .update({
          delivery_status: newStatus,
          failure_reason: failureReason
        })
        .eq('telnyx_message_id', telnyxMessageId)
        .select('id, org_id')
        .maybeSingle()

        if (newStatus === 'sent' || newStatus === 'delivered' || newStatus === 'failed') {
          telemetryStore.recordMessaging(newStatus)
        }

        telemetryStore.recordWebhook({
          provider: 'telnyx',
          eventType,
          stage: 'processed',
          providerEventId: eventId,
          requestId
        })

        logger.info('Telnyx delivery status updated', {
          telnyxMessageId,
          status: newStatus,
          org_id: updatedMsg?.org_id
        })

        return NextResponse.json({
          success: true,
          action: 'delivery_status_updated',
          status: newStatus,
          messageId: telnyxMessageId
        })
      }

      // 6. Handle Inbound SMS (message.received)
      if (eventType === 'message.received') {
        const fromPhone = payload?.from?.phone_number
        const toPhone = payload?.to?.[0]?.phone_number || payload?.to
        const text = payload?.text || ''

        if (!fromPhone || !toPhone) {
          return NextResponse.json({ success: false, error: 'Missing phone parameters' }, { status: 400 })
        }

        const result = await processInboundSms(supabase, {
          fromPhone,
          toPhone,
          text,
          telnyxMessageId: payload?.id
        })

        telemetryStore.recordWebhook({
          provider: 'telnyx',
          eventType,
          stage: 'processed',
          providerEventId: eventId,
          requestId
        })

        return NextResponse.json(result)
      }

      // Acknowledge other event types safely
      telemetryStore.recordWebhook({
        provider: 'telnyx',
        eventType,
        stage: 'processed',
        providerEventId: eventId,
        requestId
      })
      return NextResponse.json({ success: true, message: `Ignored event: ${eventType}` })
    } catch (err: any) {
      telemetryStore.recordWebhook({
        provider: 'telnyx',
        eventType,
        stage: 'failed',
        providerEventId: eventId,
        requestId,
        error: err?.message || 'Processing error'
      })
      logger.error('Telnyx message webhook processing error', err, { eventId })
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
