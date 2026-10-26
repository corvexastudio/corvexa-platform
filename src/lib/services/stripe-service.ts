import {
  createStripeCheckoutSession,
  verifyStripeWebhookSignature,
  getStripeClient,
  type CreateCheckoutSessionInput,
  type CheckoutSessionResult
} from '../payments/stripe-adapter.ts'

/**
 * StripeService
 * 
 * Domain service & provider adapter isolating all Stripe payment checkout,
 * webhook signature verification, and customer billing sessions.
 */
export class StripeService {
  /**
   * Checks whether Stripe credentials are configured.
   */
  static isConfigured(): boolean {
    return !!process.env.STRIPE_SECRET_KEY
  }

  /**
   * Returns active Stripe client instance if configured.
   */
  static getClient() {
    return getStripeClient()
  }

  /**
   * Generates a hosted Stripe Checkout Session for an invoice.
   */
  static async createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CheckoutSessionResult> {
    return createStripeCheckoutSession(input)
  }

  /**
   * Cryptographically verifies an incoming Stripe webhook signature.
   */
  static verifyWebhookSignature(
    rawBody: string | Buffer,
    signatureHeader: string | null,
    secret?: string | null
  ) {
    return verifyStripeWebhookSignature(rawBody, signatureHeader, secret)
  }

  /**
   * Constructs and verifies a webhook event object from payload and signature.
   */
  static constructWebhookEvent(
    rawBody: string | Buffer,
    signatureHeader: string | null,
    secret?: string | null
  ) {
    return verifyStripeWebhookSignature(rawBody, signatureHeader, secret)
  }

  /**
   * Safely updates an existing Stripe subscription to a new plan using proration.
   * Avoids double-billing by modifying subscription items in place with `proration_behavior: 'create_prorations'`.
   */
  static async updateSubscriptionPlan(input: {
    stripeSubscriptionId: string
    newPriceId?: string
    targetPlanId: 'solo' | 'fleet' | 'multi_crew'
    customStripeClient?: any
  }): Promise<{
    success: boolean
    subscriptionId: string
    planId: string
    prorationBehavior: string
    status: string
    simulated?: boolean
    error?: string
  }> {
    const { stripeSubscriptionId, targetPlanId, customStripeClient } = input
    const client = customStripeClient || getStripeClient()

    const effectivePriceId = input.newPriceId || (
      targetPlanId === 'solo'
        ? (process.env.STRIPE_PRICE_SOLO || 'price_captodesk_solo_99')
        : (process.env.STRIPE_PRICE_FLEET || process.env.STRIPE_PRICE_MULTI_CREW || 'price_captodesk_fleet_199')
    )

    if (!client) {
      // Offline / Test / Simulated mode
      return {
        success: true,
        subscriptionId: stripeSubscriptionId,
        planId: targetPlanId,
        prorationBehavior: 'create_prorations',
        status: 'active',
        simulated: true
      }
    }

    try {
      const currentSub = await client.subscriptions.retrieve(stripeSubscriptionId)
      const itemId = currentSub.items?.data?.[0]?.id

      if (!itemId) {
        throw new Error(`No active subscription item found on Stripe subscription ${stripeSubscriptionId}`)
      }

      const updatedSub = await client.subscriptions.update(stripeSubscriptionId, {
        items: [
          {
            id: itemId,
            price: effectivePriceId
          }
        ],
        proration_behavior: 'create_prorations',
        metadata: {
          plan_id: targetPlanId,
          updated_at: new Date().toISOString()
        }
      })

      return {
        success: true,
        subscriptionId: updatedSub.id,
        planId: targetPlanId,
        prorationBehavior: 'create_prorations',
        status: updatedSub.status
      }
    } catch (err: any) {
      return {
        success: false,
        subscriptionId: stripeSubscriptionId,
        planId: targetPlanId,
        prorationBehavior: 'create_prorations',
        status: 'failed',
        error: err.message || 'Stripe subscription update failed'
      }
    }
  }

  /**
   * Generates a hosted Stripe Checkout Session for a new SaaS subscription.
   */
  static async createSaaSCheckoutSession(input: {
    orgId: string
    orgSlug: string
    customerEmail?: string
    planId: 'solo' | 'fleet' | 'multi_crew'
    baseUrl: string
    customStripeClient?: any
  }): Promise<{
    sessionId: string
    checkoutUrl: string
    simulated?: boolean
  }> {
    const { orgId, orgSlug, customerEmail, planId, baseUrl, customStripeClient } = input
    const client = customStripeClient || getStripeClient()

    const priceAmount = planId === 'solo' ? 9900 : 19900
    const planName = planId === 'solo' ? 'CaptoDesk Solo Operator Pro ($99/mo)' : 'CaptoDesk Team & Fleet Pro ($199/mo)'

    if (!client) {
      const simulatedSessionId = `cs_sim_${crypto.randomUUID().substring(0, 16)}`
      return {
        sessionId: simulatedSessionId,
        checkoutUrl: `${baseUrl}/client/billing?session_id=${simulatedSessionId}&upgraded=true&tier=${planId}`,
        simulated: true
      }
    }

    const session = await client.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: customerEmail || undefined,
      client_reference_id: orgId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: planName,
              description: 'AI Missed Call Recovery, SMS Automation, Public Booking & Mobile Field Portal'
            },
            unit_amount: priceAmount,
            recurring: { interval: 'month' }
          },
          quantity: 1
        }
      ],
      metadata: {
        org_id: orgId,
        org_slug: orgSlug,
        plan_id: planId
      },
      success_url: `${baseUrl}/client/billing?session_id={CHECKOUT_SESSION_ID}&upgraded=true&tier=${planId}`,
      cancel_url: `${baseUrl}/client/billing?canceled=true`
    })

    return {
      sessionId: session.id,
      checkoutUrl: session.url || `${baseUrl}/client/billing`
    }
  }
}
