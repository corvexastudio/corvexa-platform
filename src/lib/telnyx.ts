import crypto from 'crypto'

/**
 * Telnyx Telephony & Messaging Client Helper
 * Handles REST API dispatches and E.164 phone formatting.
 */

export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (phone.startsWith('+')) return phone
  return `+1${digits}`
}

export async function sendTelnyxSms({
  to,
  text,
  from,
}: {
  to: string
  text: string
  from?: string
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.TELNYX_API_KEY
  const defaultFrom = process.env.TELNYX_PHONE_NUMBER || from

  if (!apiKey) {
    console.warn('[TELNYX SIMULATED MODE] No TELNYX_API_KEY found in environment. Simulating SMS send.')
    return { success: true, messageId: `mock_${Date.now()}` }
  }

  const sender = from || defaultFrom
  if (!sender) {
    return { success: false, error: 'No sender Telnyx phone number configured' }
  }

  const recipient = toE164(to)
  const formattedSender = toE164(sender)

  try {
    const res = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: formattedSender,
        to: recipient,
        text: text,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[TELNYX ERROR]', data)
      const errorMsg = data.errors?.[0]?.detail || 'Telnyx API error'
      return { success: false, error: errorMsg }
    }

    return {
      success: true,
      messageId: data.data?.id,
    }
  } catch (err: any) {
    console.error('[TELNYX NETWORK ERROR]', err)
    return { success: false, error: err.message }
  }
}

/**
 * Verify inbound webhook signature from Telnyx using Ed25519
 * Telnyx sends:
 *  - telnyx-signature-ed25519: Base64-encoded signature
 *  - telnyx-timestamp: Unix timestamp in seconds
 * Signed payload is: `${timestamp}|${rawBody}`
 */
export function verifyTelnyxSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  publicKeyOverride?: string
): boolean {
  // Explicit test environment mock: permitted ONLY in strict test mode with explicit bypass flag
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.TELNYX_ALLOW_TEST_WEBHOOK_BYPASS === 'true' &&
    signatureHeader === 'test-bypass-signature'
  ) {
    return true
  }

  const publicKey = publicKeyOverride || process.env.TELNYX_PUBLIC_KEY

  // SEC-03: Fail-Closed Protection - Never allow unverified production, staging, or dev webhooks
  if (!publicKey) {
    console.error('[TELNYX SECURITY ERROR] TELNYX_PUBLIC_KEY is not configured. Rejecting webhook (fail-closed).')
    return false
  }

  if (!signatureHeader || !timestampHeader) {
    console.warn('[TELNYX SECURITY WARNING] Missing signature or timestamp headers.')
    return false
  }

  try {
    const timestamp = parseInt(timestampHeader, 10)
    if (isNaN(timestamp)) return false

    const now = Math.floor(Date.now() / 1000)
    // 5-minute replay window tolerance (300 seconds)
    if (Math.abs(now - timestamp) > 300) {
      console.warn(`[TELNYX SECURITY WARNING] Webhook timestamp outside replay window (${now} vs ${timestamp})`)
      return false
    }

    const payload = `${timestamp}|${rawBody}`
    const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex')
    const rawKeyBuffer = Buffer.from(publicKey.trim(), 'base64')
    
    // In Node.js, crypto.createPublicKey supports Ed25519 SPKI DER format
    const key = crypto.createPublicKey({
      key: Buffer.concat([spkiHeader, rawKeyBuffer]),
      format: 'der',
      type: 'spki'
    })

    return crypto.verify(
      null,
      Buffer.from(payload, 'utf8'),
      key,
      Buffer.from(signatureHeader.trim(), 'base64')
    )
  } catch (err) {
    console.error('[TELNYX SIGNATURE VERIFICATION EXCEPTION]', err)
    return false
  }
}
