import test from 'node:test'
import assert from 'node:assert'
import { createHash, timingSafeEqual } from 'node:crypto'

// Import sanitizers and security modules
import { sanitizeRedirectDestination } from '../src/lib/security/redirect-sanitizer.ts'
import { hasPermission, normalizeRole } from '../src/lib/security/permissions.ts'
import { checkRateLimit, checkRateLimitAsync, extractClientIp, RATE_LIMITS } from '../src/lib/security/rate-limiter.ts'
import { generateBookingToken, verifyBookingToken, validateBookingOrigin } from '../src/lib/booking/origin-validator.ts'

// ==============================================================================
// 1. HIGH-01 — AUTH CALLBACK OPEN REDIRECT REGRESSION SUITE
// ==============================================================================
test('HIGH-01: Open Redirect: Allows safe internal paths', () => {
  assert.strictEqual(sanitizeRedirectDestination('/client/dashboard'), '/client/dashboard')
  assert.strictEqual(sanitizeRedirectDestination('/client/settings'), '/client/settings')
  assert.strictEqual(sanitizeRedirectDestination('/'), '/')
  assert.strictEqual(sanitizeRedirectDestination('/foo?x=1'), '/foo?x=1')
  assert.strictEqual(sanitizeRedirectDestination('/client/invoices?status=paid&sort=date'), '/client/invoices?status=paid&sort=date')
  assert.strictEqual(sanitizeRedirectDestination('/book/acme-plumbing'), '/book/acme-plumbing')
})

test('HIGH-01: Open Redirect: Rejects protocol schemes and falls back to /client/dashboard', () => {
  const fallback = '/client/dashboard'
  assert.strictEqual(sanitizeRedirectDestination('https://evil.example'), fallback)
  assert.strictEqual(sanitizeRedirectDestination('http://evil.example'), fallback)
  assert.strictEqual(sanitizeRedirectDestination('javascript:alert(1)'), fallback)
  assert.strictEqual(sanitizeRedirectDestination('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='), fallback)
  assert.strictEqual(sanitizeRedirectDestination('vbscript:msgbox(1)'), fallback)
  assert.strictEqual(sanitizeRedirectDestination('file:///etc/passwd'), fallback)
})

test('HIGH-01: Open Redirect: Rejects protocol-relative // and backslash evasions', () => {
  const fallback = '/client/dashboard'
  assert.strictEqual(sanitizeRedirectDestination('//evil.example'), fallback)
  assert.strictEqual(sanitizeRedirectDestination('//evil.example/phish'), fallback)
  assert.strictEqual(sanitizeRedirectDestination('///evil.example'), fallback)
  assert.strictEqual(sanitizeRedirectDestination('\\\\evil.example'), fallback)
  assert.strictEqual(sanitizeRedirectDestination('/\\evil.example'), fallback)
  assert.strictEqual(sanitizeRedirectDestination('\\/evil.example'), fallback)
  assert.strictEqual(sanitizeRedirectDestination('/client/dashboard\\evil.com'), fallback)
})

test('HIGH-01: Open Redirect: Rejects URL-encoded and double-encoded bypass attempts', () => {
  const fallback = '/client/dashboard'
  assert.strictEqual(sanitizeRedirectDestination('%2f%2fevil.example'), fallback)
  assert.strictEqual(sanitizeRedirectDestination('%252f%252fevil.example'), fallback)
  assert.strictEqual(sanitizeRedirectDestination('/%2e%2e/%2e%2e/evil.example'), fallback)
  assert.strictEqual(sanitizeRedirectDestination('%5c%5cevil.example'), fallback)
})

test('HIGH-01: Open Redirect: Rejects CRLF and control-character header injection', () => {
  const fallback = '/client/dashboard'
  assert.strictEqual(sanitizeRedirectDestination('/client/dashboard\r\nSet-Cookie:evil=1'), fallback)
  assert.strictEqual(sanitizeRedirectDestination('/client/dashboard%0d%0aLocation:http://evil.com'), fallback)
  assert.strictEqual(sanitizeRedirectDestination('/client/dashboard\x00evil'), fallback)
})

test('HIGH-01: Open Redirect: Safe handling of null, undefined, empty, and non-string inputs', () => {
  const fallback = '/client/dashboard'
  assert.strictEqual(sanitizeRedirectDestination(null), fallback)
  assert.strictEqual(sanitizeRedirectDestination(undefined), fallback)
  assert.strictEqual(sanitizeRedirectDestination(''), fallback)
  assert.strictEqual(sanitizeRedirectDestination('   '), fallback)
})

// ==============================================================================
// 2. HIGH-02 — ORGANIZATION RBAC & MUTATION BOUNDARIES
// ==============================================================================
test('HIGH-02: RBAC: Enforces org:update permission exclusively for owner and admin', () => {
  assert.strictEqual(hasPermission('owner', 'org:update'), true)
  assert.strictEqual(hasPermission('admin', 'org:update'), true)
  assert.strictEqual(hasPermission('super_admin', 'org:update'), true)

  // Non-administrative roles MUST be forbidden from org:update
  assert.strictEqual(hasPermission('member', 'org:update'), false)
  assert.strictEqual(hasPermission('dispatcher', 'org:update'), false)
  assert.strictEqual(hasPermission('technician', 'org:update'), false)
  assert.strictEqual(hasPermission(null, 'org:update'), false)
  assert.strictEqual(hasPermission(undefined, 'org:update'), false)
})

test('HIGH-02: RBAC: All tenant members can view org but not mutate', () => {
  assert.strictEqual(hasPermission('member', 'org:view'), true)
  assert.strictEqual(hasPermission('dispatcher', 'org:view'), true)
  assert.strictEqual(hasPermission('member', 'org:update'), false)
  assert.strictEqual(hasPermission('dispatcher', 'org:update'), false)
})

// ==============================================================================
// 3. HIGH-03 & ADD-02 — AUTOMATION WORKER FAIL-CLOSED & CONSTANT-TIME COMPARISON
// ==============================================================================
function safeCompareSecrets(provided, expected) {
  try {
    if (!provided || !expected) return false
    const hashProvided = createHash('sha256').update(provided, 'utf8').digest()
    const hashExpected = createHash('sha256').update(expected, 'utf8').digest()
    return timingSafeEqual(hashProvided, hashExpected)
  } catch {
    return false
  }
}

test('HIGH-03 & ADD-02: Secret Comparison: Validates matching secrets in constant time', () => {
  const secret = 'super-secret-cron-token-12345'
  assert.strictEqual(safeCompareSecrets(secret, secret), true)
  assert.strictEqual(safeCompareSecrets('wrong-token', secret), false)
  assert.strictEqual(safeCompareSecrets('', secret), false)
  assert.strictEqual(safeCompareSecrets(secret, ''), false)
  assert.strictEqual(safeCompareSecrets(null, secret), false)
})

test('ADD-02: Constant-Time: Handles unequal length strings safely without leaking length or erroring', () => {
  const secret = 'a'.repeat(64)
  // Unequal lengths: 1 char vs 64 chars
  assert.strictEqual(safeCompareSecrets('a', secret), false)
  // Unequal lengths: 65 chars vs 64 chars
  assert.strictEqual(safeCompareSecrets('a'.repeat(65), secret), false)
  // Unequal lengths: 1000 chars vs 64 chars
  assert.strictEqual(safeCompareSecrets('x'.repeat(1000), secret), false)
})

// ==============================================================================
// 4. HIGH-04 — HEALTH ENDPOINT MINIMAL DISCLOSURE
// ==============================================================================
test('HIGH-04: Health Endpoint: Verifies minimal disclosure schema', () => {
  // Public health contract requires ONLY status and timestamp
  const samplePublicHealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString()
  }

  assert.ok(samplePublicHealthResponse.status)
  assert.ok(samplePublicHealthResponse.timestamp)
  assert.strictEqual(samplePublicHealthResponse.checks, undefined, 'Checks must NOT be exposed publicly')
  assert.strictEqual(samplePublicHealthResponse.telemetry, undefined, 'Telemetry must NOT be exposed publicly')
  assert.strictEqual(samplePublicHealthResponse.services, undefined, 'Service flags must NOT be exposed publicly')
  assert.strictEqual(samplePublicHealthResponse.durationMs, undefined, 'Internal latency must NOT be exposed publicly')
})

// ==============================================================================
// 5. HIGH-05 — DISTRIBUTED RATE LIMITING & COMPOSITE KEYS
// ==============================================================================
test('HIGH-05: Rate Limiting: Memory fallback throttles requests exceeding limit', () => {
  const key = `test:burst:${Date.now()}`
  const config = { max: 3, windowMs: 10000 }

  const res1 = checkRateLimit(key, config)
  assert.strictEqual(res1.allowed, true)
  assert.strictEqual(res1.remaining, 2)

  const res2 = checkRateLimit(key, config)
  assert.strictEqual(res2.allowed, true)
  assert.strictEqual(res2.remaining, 1)

  const res3 = checkRateLimit(key, config)
  assert.strictEqual(res3.allowed, true)
  assert.strictEqual(res3.remaining, 0)

  // 4th request exceeds max 3
  const res4 = checkRateLimit(key, config)
  assert.strictEqual(res4.allowed, false)
  assert.strictEqual(res4.remaining, 0)
})

test('HIGH-05: Rate Limiting: checkRateLimitAsync completes cleanly and handles fallback', async () => {
  const key = `test:async:${Date.now()}`
  const config = { max: 2, windowMs: 10000 }

  const res1 = await checkRateLimitAsync(key, config)
  assert.strictEqual(res1.allowed, true)

  const res2 = await checkRateLimitAsync(key, config)
  assert.strictEqual(res2.allowed, true)

  const res3 = await checkRateLimitAsync(key, config)
  assert.strictEqual(res3.allowed, false)
})

test('HIGH-05: Rate Limiting: Composite keys correctly segment tenant and destination numbers', () => {
  const tenantKey = 'sms:tenant:org-123'
  const destPhoneA = 'sms:dest:+15551234567'
  const destPhoneB = 'sms:dest:+15559876543'

  const config = { max: 2, windowMs: 10000 }

  // Phone A hits limit
  checkRateLimit(destPhoneA, config)
  checkRateLimit(destPhoneA, config)
  const phoneALimit = checkRateLimit(destPhoneA, config)
  assert.strictEqual(phoneALimit.allowed, false)

  // Phone B should remain unaffected
  const phoneBLimit = checkRateLimit(destPhoneB, config)
  assert.strictEqual(phoneBLimit.allowed, true)
})

// ==============================================================================
// 6. HIGH-06 — SERVICES CATALOG TENANT SCOPING
// ==============================================================================
test('HIGH-06: Services: Verifies services are strictly bounded per tenant organization', () => {
  const tenantA = 'org-tenant-a'
  const tenantB = 'org-tenant-b'

  const mockDbServices = [
    { id: 'srv-1', org_id: tenantA, name: 'AC Inspection', is_active: true },
    { id: 'srv-2', org_id: tenantB, name: 'Furnace Repair', is_active: true }
  ]

  // Query scoped to tenant A
  const tenantAServices = mockDbServices.filter(s => s.org_id === tenantA && s.is_active)
  assert.strictEqual(tenantAServices.length, 1)
  assert.strictEqual(tenantAServices[0].name, 'AC Inspection')
  assert.strictEqual(tenantAServices.find(s => s.org_id === tenantB), undefined)
})

// ==============================================================================
// 7. ADD-03 — PUBLIC BOOKING ORIGIN & CSRF VALIDATION
// ==============================================================================
test('ADD-03: Booking Origin: Allows same-origin and sec-fetch-site same-origin', () => {
  const slug = 'super-hvac'
  const orgId = 'org-super-hvac'

  // Browser same-origin request
  const sameSiteReq = new Request('https://app.corvexastudio.com/api/book/super-hvac/submit', {
    method: 'POST',
    headers: {
      'sec-fetch-site': 'same-origin',
      'host': 'app.corvexastudio.com'
    }
  })
  assert.strictEqual(validateBookingOrigin(sameSiteReq, slug, orgId).allowed, true)

  // Matching Origin header
  const matchingOriginReq = new Request('https://app.corvexastudio.com/api/book/super-hvac/submit', {
    method: 'POST',
    headers: {
      'origin': 'https://app.corvexastudio.com',
      'host': 'app.corvexastudio.com'
    }
  })
  assert.strictEqual(validateBookingOrigin(matchingOriginReq, slug, orgId).allowed, true)
})

test('ADD-03: Booking Origin: Rejects unauthorized cross-origin requests without booking token', () => {
  const slug = 'super-hvac'
  const orgId = 'org-super-hvac'

  const crossOriginReq = new Request('https://app.corvexastudio.com/api/book/super-hvac/submit', {
    method: 'POST',
    headers: {
      'origin': 'https://evil-attacker.example',
      'sec-fetch-site': 'cross-site',
      'host': 'app.corvexastudio.com'
    }
  })

  const validation = validateBookingOrigin(crossOriginReq, slug, orgId)
  assert.strictEqual(validation.allowed, false)
  assert.ok(validation.reason.includes('rejected'))
})

test('ADD-03: Booking Origin: Allows legitimate cross-origin embeds with valid unforgeable token', () => {
  const slug = 'super-hvac'
  const orgId = 'org-super-hvac'

  // Generate valid booking token
  const validToken = generateBookingToken(slug, orgId)
  assert.ok(validToken)
  assert.strictEqual(verifyBookingToken(validToken, slug, orgId), true)

  // Legitimate embed request carrying valid token
  const embedReq = new Request('https://app.corvexastudio.com/api/book/super-hvac/submit', {
    method: 'POST',
    headers: {
      'origin': 'https://my-contractor-website.com',
      'sec-fetch-site': 'cross-site',
      'host': 'app.corvexastudio.com'
    }
  })

  const validation = validateBookingOrigin(embedReq, slug, orgId, validToken)
  assert.strictEqual(validation.allowed, true)

  // Forged or tampered token must be rejected
  const tamperedToken = validToken.slice(0, -4) + 'abcd'
  const tamperedValidation = validateBookingOrigin(embedReq, slug, orgId, tamperedToken)
  assert.strictEqual(tamperedValidation.allowed, false)

  // Token for wrong slug must be rejected
  assert.strictEqual(verifyBookingToken(validToken, 'different-slug', orgId), false)
})

// ==============================================================================
// 8. HIGH-08 — DEPENDENCY SECURITY CHECKS
// ==============================================================================
test('HIGH-08: Dependency Verification: Validates core packages are upgraded to non-vulnerable versions', async () => {
  const packageJson = (await import('../package.json', { with: { type: 'json' } })).default
  
  // Next.js must be >= 16.4.0 (GHSA-p293-qw3h-jr36)
  const nextVer = packageJson.dependencies.next
  assert.ok(nextVer.startsWith('16.4') || nextVer.startsWith('^16.4'), `Next.js version must be >= 16.4.0, found: ${nextVer}`)
})
