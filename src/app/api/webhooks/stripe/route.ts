import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyStripeWebhookSignature } from '@/lib/payments/stripe-adapter'
import { recordPayment } from '@/lib/payments/invoice-manager'
import { telemetryStore } from '@/lib/observability/telemetry-store'
import { createStructuredLogger } from '@/lib/observability/logger'
import {
  claimWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
  waitForConcurrentWebhookCompletion
} from '@/lib/webhooks/idempotency'

export const dynamic = 'force-dynamic'

function getServiceSupabase() {
  return createAdminClient()
}

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  const logger = createStructuredLogger({ request_id: requestId })

  telemetryStore.recordWebhook({
    provider: 'stripe',
    eventType: 'stripe.raw',
    stage: 'received',
    requestId
  })

  let eventId: string | undefined
  let eventType = 'unknown'

  try {
    const rawBody = await request.text()
    const signature = request.headers.get('stripe-signature')
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || null

    // 1. Cryptographic Signature Verification
    const verification = verifyStripeWebhookSignature(rawBody, signature, webhookSecret)
    if (!verification.isValid || !verification.event) {
      telemetryStore.recordWebhook({
        provider: 'stripe',
        eventType: 'stripe.signature_rejected',
        stage: 'rejected',
        requestId,
        error: verification.error || 'Invalid signature'
      })
      logger.warn('Stripe webhook rejected: invalid signature', { error: verification.error })
      return NextResponse.json({ error: verification.error || 'Invalid signature' }, { status: 400 })
    }

    const event = verification.event
    eventId = event.id
    eventType = event.type
    const supabase = getServiceSupabase()

    telemetryStore.recordWebhook({
      provider: 'stripe',
      eventType,
      stage: 'verified',
      providerEventId: eventId,
      requestId
    })

    // 2. Atomic Database-Enforced Idempotency Claim (HIGH-INFRA-01)
    const claim = await claimWebhookEvent(supabase, {
      eventId: event.id,
      provider: 'stripe',
      eventType: event.type,
      staleTimeoutSeconds: 60
    })

    if (claim.action === 'completed') {
      telemetryStore.recordWebhook({
        provider: 'stripe',
        eventType,
        stage: 'duplicated',
        providerEventId: eventId,
        requestId
      })
      logger.info('Duplicate completed Stripe webhook skipped', { eventId, eventType, attempt: claim.attemptCount })
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
    }

    if (claim.action === 'concurrent_active') {
      logger.warn('Concurrent Stripe webhook execution detected; awaiting resolution', { eventId, eventType })
      const didComplete = await waitForConcurrentWebhookCompletion(supabase, event.id, 1500, 300)
      if (didComplete) {
        telemetryStore.recordWebhook({
          provider: 'stripe',
          eventType,
          stage: 'duplicated',
          providerEventId: eventId,
          requestId
        })
        logger.info('Concurrent Stripe webhook resolved to completed', { eventId, eventType })
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
      }

      logger.warn('Concurrent Stripe webhook still active; requesting provider retry', { eventId, eventType })
      return NextResponse.json(
        { error: 'Concurrent webhook processing in progress. Retry requested.' },
        { status: 429 }
      )
    }

    logger.info(`Stripe webhook claimed for execution (${claim.action})`, {
      eventId,
      eventType,
      attempt: claim.attemptCount
    })

    // 3. Process Authoritative Payment Events
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any
      const invoiceId = session.metadata?.invoice_id || session.client_reference_id
      const orgId = session.metadata?.org_id
      const amountTotal = (Number(session.amount_total) || 0) / 100

      if (invoiceId && orgId) {
        const result = await recordPayment(supabase, {
          invoiceId,
          orgId,
          amount: amountTotal,
          paymentMethod: 'stripe',
          paymentStatus: 'succeeded',
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: session.payment_intent ? String(session.payment_intent) : undefined,
          referenceNote: `Stripe Checkout: ${session.customer_details?.email || session.id}`
        })
        if (!result.success) {
          throw new Error(`Failed to record checkout payment: ${result.error}`)
        }
      }
    } else if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as any
      const invoiceId = paymentIntent.metadata?.invoice_id
      const orgId = paymentIntent.metadata?.org_id
      const amount = (Number(paymentIntent.amount) || 0) / 100

      if (invoiceId && orgId) {
        const result = await recordPayment(supabase, {
          invoiceId,
          orgId,
          amount,
          paymentMethod: 'stripe',
          paymentStatus: 'succeeded',
          stripePaymentIntentId: paymentIntent.id,
          referenceNote: `Stripe PaymentIntent: ${paymentIntent.id}`
        })
        if (!result.success) {
          throw new Error(`Failed to record payment intent: ${result.error}`)
        }
      }
    } else if (event.type === 'invoice.payment_succeeded') {
      const stripeInvoice = event.data.object as any
      const invoiceId = stripeInvoice.metadata?.invoice_id
      const orgId = stripeInvoice.metadata?.org_id
      const amount = (Number(stripeInvoice.amount_paid) || 0) / 100

      if (invoiceId && orgId) {
        const result = await recordPayment(supabase, {
          invoiceId,
          orgId,
          amount,
          paymentMethod: 'stripe',
          paymentStatus: 'succeeded',
          stripePaymentIntentId: stripeInvoice.payment_intent ? String(stripeInvoice.payment_intent) : undefined,
          referenceNote: `Stripe Invoice: ${stripeInvoice.id}`
        })
        if (!result.success) {
          throw new Error(`Failed to record invoice payment: ${result.error}`)
        }
      }
    }

    // 4. Mark Event Completed AFTER successful business processing
    await completeWebhookEvent(supabase, event.id, {
      processed_at: new Date().toISOString()
    })

    telemetryStore.recordWebhook({
      provider: 'stripe',
      eventType,
      stage: 'processed',
      providerEventId: eventId,
      requestId
    })

    logger.info('Stripe webhook processed successfully', { eventId, eventType, attempt: claim.attemptCount })
    return NextResponse.json({ received: true })
  } catch (err: any) {
    if (eventId) {
      // Release lock / mark failed so provider retry can re-enter safely (HIGH-INFRA-01)
      try {
        const supabase = getServiceSupabase()
        await failWebhookEvent(supabase, eventId, err?.message || String(err))
      } catch (failErr) {
        console.error('[STRIPE FAIL EVENT LOG ERROR]', failErr)
      }
    }

    telemetryStore.recordWebhook({
      provider: 'stripe',
      eventType,
      stage: 'failed',
      providerEventId: eventId,
      requestId,
      error: err?.message || 'Processing error'
    })
    logger.error('Stripe webhook processing error', err, { eventId })
    return NextResponse.json({ error: err.message || 'Webhook processing failed' }, { status: 500 })
  }
}
