import { createHmac, timingSafeEqual } from 'node:crypto'

const CSRF_SECRET =
  process.env.BOOKING_CSRF_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  process.env.CRON_SECRET ||
  'captodesk-booking-csrf-secret-key-32chars'

/**
 * Generates an unforgeable, time-bounded (2 hours) booking CSRF token (ADD-03).
 */
export function generateBookingToken(slug: string, orgId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + 7200 // 2 hours validity
  const payload = `${slug}:${orgId}:${expiresAt}`
  const signature = createHmac('sha256', CSRF_SECRET).update(payload).digest('hex')
  return `${payload}.${signature}`
}

/**
 * Verifies an unforgeable booking CSRF token.
 */
export function verifyBookingToken(
  token: string | null | undefined,
  slug: string,
  orgId?: string
): boolean {
  if (!token || typeof token !== 'string') return false
  const parts = token.split('.')
  if (parts.length !== 2) return false

  const [payload, signature] = parts
  const payloadParts = payload.split(':')
  if (payloadParts.length !== 3) return false

  const [tokenSlug, tokenOrgId, tokenExpires] = payloadParts
  if (tokenSlug !== slug) return false
  if (orgId && tokenOrgId !== orgId) return false

  const expiresAt = parseInt(tokenExpires, 10)
  if (isNaN(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false // Token expired
  }

  const expectedSig = createHmac('sha256', CSRF_SECRET).update(payload).digest('hex')
  try {
    const bufSig = Buffer.from(signature, 'utf8')
    const bufExpected = Buffer.from(expectedSig, 'utf8')
    if (bufSig.length !== bufExpected.length) return false
    return timingSafeEqual(bufSig, bufExpected)
  } catch {
    return false
  }
}

/**
 * Validates request origin / CSRF for public booking endpoint (ADD-03).
 * Seamlessly supports:
 * - Hosted booking pages (same-origin / same-site)
 * - Legitimate third-party website embeds using booking token
 * - Rejects unauthorized cross-origin CSRF attempts
 */
export function validateBookingOrigin(
  request: Request,
  slug: string,
  orgId: string,
  providedToken?: string | null
): { allowed: boolean; reason?: string } {
  const origin = request.headers.get('origin')
  const secFetchSite = request.headers.get('sec-fetch-site')
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host')

  // 1. Browser Sec-Fetch-Site same-origin header
  if (secFetchSite === 'same-origin' || secFetchSite === 'none') {
    return { allowed: true }
  }

  // 2. Validate Origin header if present
  if (origin) {
    try {
      const originUrl = new URL(origin)
      const originHost = originUrl.host.toLowerCase()

      // Same-origin check against current request host
      if (host && (originHost === host.toLowerCase() || originHost.split(':')[0] === host.toLowerCase().split(':')[0])) {
        return { allowed: true }
      }

      // Localhost / development / test check
      if (['localhost', '127.0.0.1'].includes(originUrl.hostname)) {
        return { allowed: true }
      }

      // Check against configured production APP_URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL
      if (appUrl) {
        try {
          const appHost = new URL(appUrl).host.toLowerCase()
          if (originHost === appHost) return { allowed: true }
        } catch {
          // Ignore parse error
        }
      }

      // Cross-origin request: verify unforgeable booking CSRF token for embeds
      if (providedToken && verifyBookingToken(providedToken, slug, orgId)) {
        return { allowed: true }
      }

      return {
        allowed: false,
        reason: `Cross-origin booking submission from '${origin}' rejected: untrusted origin without valid booking token.`
      }
    } catch {
      return { allowed: false, reason: 'Malformed Origin header' }
    }
  }

  // 3. Fallback: Non-browser callers (API tests, CLI) without Origin header
  return { allowed: true }
}
