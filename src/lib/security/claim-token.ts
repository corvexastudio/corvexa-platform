import crypto from 'node:crypto'

export interface ClaimTokenPayload {
  userId: string
  email: string
  orgId: string
  exp: number // timestamp in ms
}

/**
 * Derives a secure HMAC key for signing 1-tap claim tokens
 */
function getSigningKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.CRON_SECRET ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'captodesk-claim-link-signing-secret-key-32-chars'
  )
}

/**
 * Base64 URL-safe encoding
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Base64 URL-safe decoding
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return Buffer.from(base64, 'base64').toString('utf8')
}

/**
 * Generates a signed, URL-safe 1-tap claim token valid for 30 days
 */
export function createClaimToken(payload: {
  userId: string
  email: string
  orgId: string
  validityDays?: number
}): string {
  const validityDays = payload.validityDays ?? 30
  const exp = Date.now() + validityDays * 24 * 60 * 60 * 1000

  const data: ClaimTokenPayload = {
    userId: payload.userId,
    email: payload.email,
    orgId: payload.orgId,
    exp
  }

  const encodedData = base64UrlEncode(JSON.stringify(data))
  const signature = crypto
    .createHmac('sha256', getSigningKey())
    .update(encodedData)
    .digest('base64url')

  return `${encodedData}.${signature}`
}

/**
 * Verifies and decodes a 1-tap claim token
 */
export function verifyClaimToken(token: string | null | undefined): ClaimTokenPayload | null {
  if (!token || typeof token !== 'string') return null

  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [encodedData, signature] = parts

  // Constant-time signature verification
  const expectedSig = crypto
    .createHmac('sha256', getSigningKey())
    .update(encodedData)
    .digest('base64url')

  const sigBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSig)

  if (sigBuffer.length !== expectedBuffer.length) {
    return null
  }

  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null
  }

  try {
    const rawJson = base64UrlDecode(encodedData)
    const payload = JSON.parse(rawJson) as ClaimTokenPayload

    if (!payload.userId || !payload.email || !payload.orgId || !payload.exp) {
      return null
    }

    // Check expiration
    if (Date.now() > payload.exp) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
