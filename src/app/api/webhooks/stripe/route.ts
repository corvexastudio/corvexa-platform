import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyStripeWebhookSignature } from '@/lib/payments/stripe-adapter'
import { recordPayment } from '@/lib/payments/invoice-manager'
import { telemetryStore } from '@/lib/observability/telemetry-store'
import { createStructuredLogger } from '@/lib/observability/logger'

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

    // 2. Atomic Database-Enforced Idempotency: Claim event ID
    const { error: insertError } = await supabase.from('processed_events').insert({
      id: event.id,
      provider: 'stripe',
      event_type: event.type,
      provider_event_id: event.id
    })

    if (insertError) {
      if (
        insertError.code === '23505' ||
        insertError.message?.toLowerCase().includes('unique') ||
        insertError.message?.toLowerCase().includes('duplicate')
      ) {
        telemetryStore.recordWebhook({
          provider: 'stripe',
          eventType,
          stage: 'duplicated',
          providerEventId: eventId,
          requestId
        })
        logger.info('Duplicate Stripe webhook skipped', { eventId, eventType })
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
      }

      console.error('[STRIPE IDEMPOTENCY INSERT ERROR]', insertError)
      return NextResponse.json({ error: 'Database idempotency error' }, { status: 500 })
    }

    // 3. Process Authoritative Payment Events
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any
      const invoiceId = session.metadata?.invoice_id || session.client_reference_id
      const orgId = session.metadata?.org_id
      const amountTotal = (Number(session.amount_total) || 0) / 100

      if (invoiceId && orgId) {
        await recordPayment(supabase, {
          invoiceId,
          orgId,
          amount: amountTotal,
          paymentMethod: 'stripe',
          paymentStatus: 'succeeded',
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: session.payment_intent ? String(session.payment_intent) : undefined,
          referenceNote: `Stripe Checkout: ${session.customer_details?.email || session.id}`
        })
      }
    } else if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as any
      const invoiceId = paymentIntent.metadata?.invoice_id
      const orgId = paymentIntent.metadata?.org_id
      const amount = (Number(paymentIntent.amount) || 0) / 100

      if (invoiceId && orgId) {
        await recordPayment(supabase, {
          invoiceId,
          orgId,
          amount,
          paymentMethod: 'stripe',
          paymentStatus: 'succeeded',
          stripePaymentIntentId: paymentIntent.id,
          referenceNote: `Stripe PaymentIntent: ${paymentIntent.id}`
        })
      }
    }

    telemetryStore.recordWebhook({
      provider: 'stripe',
      eventType,
      stage: 'processed',
      providerEventId: eventId,
      requestId
    })

    logger.info('Stripe webhook processed successfully', { eventId, eventType })
    return NextResponse.json({ received: true })
  } catch (err: any) {
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
