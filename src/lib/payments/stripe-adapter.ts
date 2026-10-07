import Stripe from 'stripe'

export interface CreateCheckoutSessionInput {
  invoiceId: string
  invoiceNumber: string
  orgId: string
  contactId: string
  customerEmail?: string
  customerName?: string
  amountDue: number // In dollars (e.g. 150.00)
  currency?: string
  title: string
  manageToken: string
  baseUrl: string
  items?: Array<{
    description: string
    quantity: number
    unit_price: number
    total: number
  }>
}

export interface CheckoutSessionResult {
  sessionId: string
  checkoutUrl: string
  paymentLinkId?: string
}

let stripeClientInstance: Stripe | null = null

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return null
  }
  if (!stripeClientInstance) {
    stripeClientInstance = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia' as any,
      typescript: true,
    })
  }
  return stripeClientInstance
}

/**
 * Creates a Stripe Checkout Session or returns a simulated link in dev/test mode
 */
export async function createStripeCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<CheckoutSessionResult> {
  const stripe = getStripeClient()
  const {
    invoiceId,
    invoiceNumber,
    orgId,
    contactId,
    customerEmail,
    amountDue,
    currency = 'usd',
    title,
    manageToken,
    baseUrl,
    items = []
  } = input

  const safeBaseUrl = baseUrl.replace(/\/$/, '')
  const successUrl = `${safeBaseUrl}/invoice/${manageToken}?status=paid&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${safeBaseUrl}/invoice/${manageToken}?status=cancelled`

  // 1. Simulation fallback when no API key is provided
  if (!stripe) {
    console.info(`[STRIPE SIMULATED MODE] Generating mock checkout session for invoice ${invoiceNumber} ($${amountDue})`)
    const mockSessionId = `cs_sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    return {
      sessionId: mockSessionId,
      checkoutUrl: `${safeBaseUrl}/invoice/${manageToken}?simulated_checkout=true&session_id=${mockSessionId}`,
      paymentLinkId: `plink_sim_${Date.now()}`
    }
  }

  // 2. Real Stripe Checkout Session
  const amountInCents = Math.max(50, Math.round(amountDue * 100))

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: customerEmail || undefined,
    client_reference_id: invoiceId,
    metadata: {
      invoice_id: invoiceId,
      org_id: orgId,
      contact_id: contactId,
      invoice_number: invoiceNumber,
      manage_token: manageToken
    },
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: `${title} (${invoiceNumber})`,
            description: items.length > 0
              ? items.map(i => `${i.description} (x${i.quantity})`).join(', ')
              : `Invoice ${invoiceNumber}`,
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  return {
    sessionId: session.id,
    checkoutUrl: session.url || successUrl,
    paymentLinkId: session.payment_link ? String(session.payment_link) : undefined
  }
}

/**
 * Cryptographically verifies incoming Stripe webhook signature or validates simulated events
 */
export function verifyStripeWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null,
  webhookSecret?: string | null
): { isValid: boolean; event?: Stripe.Event; error?: string } {
  if (!signatureHeader) {
    return { isValid: false, error: 'Missing stripe-signature header' }
  }

  const effectiveSecret = webhookSecret || process.env.STRIPE_WEBHOOK_SECRET

  if (effectiveSecret && signatureHeader) {
    const stripe = getStripeClient()
    if (!stripe) {
      return { isValid: false, error: 'Stripe client is not initialized' }
    }
    try {
      const event = stripe.webhooks.constructEvent(rawBody, signatureHeader, effectiveSecret)
      return { isValid: true, event }
    } catch (err: any) {
      return { isValid: false, error: err.message }
    }
  }

  // SEC-04: Fail-Closed Protection - In production, missing webhook secret must reject the webhook
  if (process.env.NODE_ENV === 'production') {
    return {
      isValid: false,
      error: 'STRIPE_WEBHOOK_SECRET is not configured in production environment (fail-closed)'
    }
  }

  // Simulated fallback in testing/dev
  try {
    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
    const parsed = JSON.parse(bodyStr)
    if (parsed && parsed.type) {
      return { isValid: true, event: parsed as Stripe.Event }
    }
    return { isValid: false, error: 'Invalid webhook payload structure' }
  } catch (err: any) {
    return { isValid: false, error: `JSON parse error: ${err.message}` }
  }
}
