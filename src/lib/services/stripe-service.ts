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
}
