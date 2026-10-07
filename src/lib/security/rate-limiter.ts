/**
 * CaptoDesk Sliding-Window Edge & Server Rate Limiter
 * Guards sensitive endpoints against brute force, denial-of-service, and SMS toll fraud.
 */

interface RateLimitRecord {
  timestamps: number[]
}

const rateLimitStore = new Map<string, RateLimitRecord>()

// Periodic garbage collection every 5 minutes
if (typeof setInterval !== 'undefined') {
  const cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitStore.entries()) {
      record.timestamps = record.timestamps.filter(t => now - t < 300000)
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key)
      }
    }
  }, 300000)
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer && typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref()
  }
}

export interface RateLimitConfig {
  max: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  totalLimit: number
}

/**
 * Standard Rate Limit Profiles
 */
export const RATE_LIMITS = {
  SMS_SEND: { max: 30, windowMs: 60 * 1000 },          // 30 SMS/min per tenant
  DEMO_SIMULATOR: { max: 5, windowMs: 60 * 1000 },     // 5 demos/min per IP/admin
  REVIEWS_SEND: { max: 20, windowMs: 60 * 1000 },      // 20 reviews/min per tenant
  WEBHOOK: { max: 120, windowMs: 60 * 1000 },          // 120 webhooks/min per provider IP
  ONBOARDING: { max: 10, windowMs: 60 * 1000 },        // 10 signups/min per IP
  TEAM_INVITE: { max: 10, windowMs: 60 * 1000 },       // 10 invites/min per tenant
  BOOKING_SUBMIT: { max: 10, windowMs: 60 * 1000 },    // 10 booking requests/min per IP
  DEFAULT_API: { max: 100, windowMs: 60 * 1000 }       // 100 req/min general limit
}

/**
 * Checks sliding-window rate limit for a given identifier key
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const windowStart = now - config.windowMs

  // Memory exhaustion protection: evict stale entries if store size grows large
  if (rateLimitStore.size > 20000) {
    for (const [k, rec] of rateLimitStore.entries()) {
      rec.timestamps = rec.timestamps.filter(t => t > windowStart)
      if (rec.timestamps.length === 0) {
        rateLimitStore.delete(k)
      }
    }
  }

  let record = rateLimitStore.get(key)
  if (!record) {
    record = { timestamps: [] }
    rateLimitStore.set(key, record)
  }

  // Filter timestamps within current sliding window
  record.timestamps = record.timestamps.filter(t => t > windowStart)

  const currentCount = record.timestamps.length
  const allowed = currentCount < config.max

  if (allowed) {
    record.timestamps.push(now)
  }

  const remaining = Math.max(0, config.max - record.timestamps.length)
  const oldestTimestamp = record.timestamps[0] || now
  const resetTime = Math.ceil((oldestTimestamp + config.windowMs) / 1000)

  return {
    allowed,
    remaining,
    resetTime,
    totalLimit: config.max
  }
}

/**
 * Safely validates an IP string format (IPv4 or IPv6)
 */
function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  if (ipv4Regex.test(ip)) return true
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){1,7}:?([0-9a-fA-F]{1,4})?$/
  return ipv6Regex.test(ip) || ip === '::1'
}

/**
 * Extracts client IP address safely from standard proxy headers.
 * Prioritizes trusted provider headers (Cloudflare, Nginx, Vercel) over untrusted X-Forwarded-For.
 */
export function extractClientIp(request: Request): string {
  const headers = request.headers

  // 1. Cloudflare edge header (authenticated at CDN boundary)
  const cfConnectingIp = headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    const trimmed = cfConnectingIp.trim()
    if (isValidIp(trimmed)) return trimmed
  }

  // 2. Direct upstream proxy header (Nginx / HAProxy / Load Balancer)
  const realIp = headers.get('x-real-ip')
  if (realIp) {
    const trimmed = realIp.trim()
    if (isValidIp(trimmed)) return trimmed
  }

  // 3. Vercel edge IP header
  const vercelIp = headers.get('x-vercel-forwarded-for')
  if (vercelIp) {
    const ips = vercelIp.split(',').map(ip => ip.trim())
    const valid = ips.find(isValidIp)
    if (valid) return valid
  }

  // 4. Standard X-Forwarded-For header
  const xForwardedFor = headers.get('x-forwarded-for')
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim())
    const valid = ips.find(isValidIp)
    if (valid) return valid
    if (ips[0] && ips[0].length < 45) return ips[0]
  }

  return '127.0.0.1'
}

/**
 * Formats standard HTTP rate-limiting headers
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.totalLimit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetTime)
  }
}
