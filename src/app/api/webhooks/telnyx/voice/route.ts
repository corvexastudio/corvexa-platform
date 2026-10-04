import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processMissedCall } from '@/lib/services/call-recovery'
import { verifyTelnyxSignature } from '@/lib/telnyx'
import { evaluateCallOutcome } from '@/lib/telephony/call-state-machine'
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders, extractClientIp } from '@/lib/security/rate-limiter'
import { telemetryStore } from '@/lib/observability/telemetry-store'
import { createStructuredLogger } from '@/lib/observability/logger'

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  const logger = createStructuredLogger({ request_id: requestId })

  telemetryStore.recordWebhook({
    provider: 'telnyx',
    eventType: 'voice.raw',
    stage: 'received',
    requestId
  })

  // 1. Rate limiting on webhooks
  const clientIp = extractClientIp(request)
  const rateLimit = checkRateLimit(`webhook:voice:${clientIp}`, RATE_LIMITS.WEBHOOK)
  const rateHeaders = getRateLimitHeaders(rateLimit)

  if (!rateLimit.allowed) {
    logger.warn('Telnyx Voice webhook rate limit exceeded', { clientIp })
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
  const isValidSignature = verifyTelnyxSignature(rawBody, signature, timestamp)
  if (!isValidSignature) {
    telemetryStore.recordWebhook({
      provider: 'telnyx',
      eventType: 'voice.signature_rejected',
      stage: 'rejected',
      requestId,
      error: 'Invalid signature'
    })
    logger.warn('Telnyx voice webhook rejected: invalid signature', { clientIp })
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401, headers: rateHeaders })
  }

  // 3. Supabase service role client
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  )

  let eventId: string | undefined
  let eventType = 'unknown'

  try {
    const body = JSON.parse(rawBody)
    eventType = body?.data?.event_type || 'unknown'
    const payload = body?.data?.payload
    eventId = body?.data?.id

    telemetryStore.recordWebhook({
      provider: 'telnyx',
      eventType,
      stage: 'verified',
      providerEventId: eventId,
      requestId
    })

    // 4. Atomic Idempotency Check: Claim event via processed_events table
    if (eventId) {
      const { error: insertError } = await supabase.from('processed_events').insert({
        id: eventId,
        provider: 'telnyx',
        event_type: eventType,
        provider_event_id: eventId
      })

      if (insertError) {
        if (insertError.code === '23505') {
          telemetryStore.recordWebhook({
            provider: 'telnyx',
            eventType,
            stage: 'duplicated',
            providerEventId: eventId,
            requestId
          })
          logger.info('Duplicate Telnyx voice webhook skipped', { eventId, eventType })
          return NextResponse.json({ success: true, message: 'Already processed (idempotent)' })
        }
        console.error('[IDEMPOTENCY INSERT ERROR]', insertError)
      }
    }

    // 5. Evaluate call state machine outcome
    const callOutcome = evaluateCallOutcome(eventType, payload)

    // Acknowledge intermediate call progress events (call.initiated, call.ringing, call.answered)
    if (eventType !== 'call.hangup') {
      telemetryStore.recordWebhook({
        provider: 'telnyx',
        eventType,
        stage: 'processed',
        providerEventId: eventId,
        requestId
      })
      return NextResponse.json({
        success: true,
        message: `Processed event: ${eventType} (state: ${callOutcome.state})`
      })
    }

    const callerNumber = payload?.from
    const calledNumber = payload?.to

    if (!callerNumber || !calledNumber) {
      return NextResponse.json({ success: false, error: 'Missing phone parameters' }, { status: 400 })
    }

    // 6. Process call outcome (answered calls will be logged without triggering SMS)
    const result = await processMissedCall(supabase, {
      callerNumber,
      calledNumber,
      callOutcome,
      callControlId: payload?.call_control_id,
      callLegId: payload?.call_leg_id,
      callSessionId: payload?.call_session_id
    })

    telemetryStore.recordWebhook({
      provider: 'telnyx',
      eventType,
      stage: 'processed',
      providerEventId: eventId,
      requestId
    })

    return NextResponse.json(result)
  } catch (err: any) {
    telemetryStore.recordWebhook({
      provider: 'telnyx',
      eventType,
      stage: 'failed',
      providerEventId: eventId,
      requestId,
      error: err?.message || 'Processing error'
    })
    logger.error('Telnyx voice webhook processing error', err, { eventId })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
