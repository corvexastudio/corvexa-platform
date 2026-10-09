import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processMissedCall } from '@/lib/services/call-recovery'
import { verifyTelnyxSignature } from '@/lib/telnyx'
import { evaluateCallOutcome } from '@/lib/telephony/call-state-machine'
import { checkRateLimitAsync, RATE_LIMITS, getRateLimitHeaders, extractClientIp } from '@/lib/security/rate-limiter'
import { telemetryStore } from '@/lib/observability/telemetry-store'
import { createStructuredLogger } from '@/lib/observability/logger'
import {
  claimWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
  waitForConcurrentWebhookCompletion
} from '@/lib/webhooks/idempotency'

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  const logger = createStructuredLogger({ request_id: requestId })

  telemetryStore.recordWebhook({
    provider: 'telnyx',
    eventType: 'voice.raw',
    stage: 'received',
    requestId
  })

  // 1. Distributed Rate limiting on webhooks (HIGH-05)
  const clientIp = extractClientIp(request)
  const rateLimit = await checkRateLimitAsync(`webhook:voice:${clientIp}`, RATE_LIMITS.WEBHOOK)
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
  if (!signature || !timestamp) {
    telemetryStore.recordWebhook({
      provider: 'telnyx',
      eventType: 'voice.signature_missing',
      stage: 'rejected',
      requestId,
      error: 'Missing signature headers'
    })
    logger.warn('Telnyx voice webhook rejected: missing signature or timestamp', { clientIp })
    return NextResponse.json({ error: 'Missing Telnyx webhook signature or timestamp' }, { status: 401, headers: rateHeaders })
  }

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

  // Parse and validate JSON payload structure
  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    logger.warn('Telnyx voice webhook rejected: malformed JSON', { clientIp })
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400, headers: rateHeaders })
  }

  if (!body || typeof body !== 'object' || !body.data || typeof body.data !== 'object') {
    logger.warn('Telnyx voice webhook rejected: invalid structure', { clientIp })
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

    if (!eventId) {
      return NextResponse.json({ error: 'Missing Telnyx event ID' }, { status: 400 })
    }

    telemetryStore.recordWebhook({
      provider: 'telnyx',
      eventType,
      stage: 'verified',
      providerEventId: eventId,
      requestId
    })

    // 4. Atomic Database-Enforced Idempotency Claim (HIGH-INFRA-01)
    const claim = await claimWebhookEvent(supabase, {
      eventId,
      provider: 'telnyx',
      eventType,
      staleTimeoutSeconds: 60
    })

    if (claim.action === 'completed') {
      telemetryStore.recordWebhook({
        provider: 'telnyx',
        eventType,
        stage: 'duplicated',
        providerEventId: eventId,
        requestId
      })
      logger.info('Duplicate completed Telnyx voice webhook skipped', { eventId, eventType, attempt: claim.attemptCount })
      return NextResponse.json({ success: true, message: 'Already processed (idempotent)' }, { status: 200 })
    }

    if (claim.action === 'concurrent_active') {
      logger.warn('Concurrent Telnyx voice webhook execution detected; awaiting resolution', { eventId, eventType })
      const didComplete = await waitForConcurrentWebhookCompletion(supabase, eventId, 1500, 300)
      if (didComplete) {
        telemetryStore.recordWebhook({
          provider: 'telnyx',
          eventType,
          stage: 'duplicated',
          providerEventId: eventId,
          requestId
        })
        logger.info('Concurrent Telnyx voice webhook resolved to completed', { eventId, eventType })
        return NextResponse.json({ success: true, message: 'Already processed (idempotent)' }, { status: 200 })
      }

      logger.warn('Concurrent Telnyx voice webhook still active; requesting provider retry', { eventId, eventType })
      return NextResponse.json(
        { error: 'Concurrent webhook processing in progress. Retry requested.' },
        { status: 429 }
      )
    }

    logger.info(`Telnyx voice webhook claimed for execution (${claim.action})`, {
      eventId,
      eventType,
      attempt: claim.attemptCount
    })

    // 5. Evaluate call state machine outcome
    const callOutcome = evaluateCallOutcome(eventType, payload)

    // Acknowledge intermediate call progress events (call.initiated, call.ringing, call.answered)
    if (eventType !== 'call.hangup') {
      await completeWebhookEvent(supabase, eventId, {
        state: callOutcome.state,
        intermediate: true
      })
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

    if (!result.success) {
      throw new Error(`Failed to process call: ${result.error || result.action}`)
    }

    // Mark Event Completed AFTER successful call processing
    await completeWebhookEvent(supabase, eventId, {
      action: result.action,
      call_id: result.callId
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
    if (eventId) {
      // Release lock / mark failed so provider retry can re-enter safely (HIGH-INFRA-01)
      try {
        await failWebhookEvent(supabase, eventId, err?.message || String(err))
      } catch (failErr) {
        console.error('[TELNYX VOICE FAIL EVENT LOG ERROR]', failErr)
      }
    }

    telemetryStore.recordWebhook({
      provider: 'telnyx',
      eventType,
      stage: 'failed',
      providerEventId: eventId,
      requestId,
      error: err?.message || 'Processing error'
    })
    logger.error('Telnyx voice webhook processing error', err, { eventId })
    return NextResponse.json({ error: err.message || 'Webhook processing failed' }, { status: 500 })
  }
}
