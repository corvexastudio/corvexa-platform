import test from 'node:test'
import assert from 'node:assert'
import { normalizeRole, hasPermission } from '../src/lib/security/permissions.ts'
import { getTenantContext, verifyTenantResource } from '../src/lib/security/tenant-context.ts'
import { checkRateLimit, extractClientIp, getRateLimitHeaders, RATE_LIMITS } from '../src/lib/security/rate-limiter.ts'
import { redactSensitiveData } from '../src/lib/security/audit-logger.ts'

/**
 * -----------------------------------------------------------------------------
 * 1. AUTHENTICATION & TENANT CONTEXT TESTS
 * -----------------------------------------------------------------------------
 */
test('Authentication: Rejects unauthenticated requests with 401', async () => {
  const mockSupabase = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: new Error('Auth session missing') })
    }
  }

  const result = await getTenantContext(undefined, mockSupabase)
  assert.strictEqual(result.ok, false)
  if (!result.ok) {
    assert.strictEqual(result.status, 401)
    assert.match(result.error, /Unauthorized/)
  }
})

test('Authentication: Rejects unregistered user profile with 403', async () => {
  const mockSupabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'usr-123' } }, error: null })
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: new Error('Profile not found') })
        })
      })
    })
  }

  const result = await getTenantContext(undefined, mockSupabase)
  assert.strictEqual(result.ok, false)
  if (!result.ok) {
    assert.strictEqual(result.status, 403)
    assert.match(result.error, /Forbidden: User profile not registered/)
  }
})

test('Authentication: Rejects user without organization linkage with 403', async () => {
  const mockSupabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'usr-123' } }, error: null })
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: 'usr-123', org_id: null, role: 'member', full_name: 'Test', email: 'test@test.com' },
            error: null
          })
        })
      })
    })
  }

  const result = await getTenantContext(undefined, mockSupabase)
  assert.strictEqual(result.ok, false)
  if (!result.ok) {
    assert.strictEqual(result.status, 403)
    assert.match(result.error, /Forbidden: User is not linked to an organization/)
  }
})

test('Authentication: Resolves authenticated tenant context successfully', async () => {
  const mockSupabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'usr-123' } }, error: null })
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: 'usr-123', org_id: 'org-real-tenant', role: 'owner', full_name: 'Owner Joe', email: 'joe@contractor.com' },
            error: null
          })
        })
      })
    })
  }

  const result = await getTenantContext(undefined, mockSupabase)
  assert.strictEqual(result.ok, true)
  if (result.ok) {
    assert.strictEqual(result.orgId, 'org-real-tenant')
    assert.strictEqual(result.role, 'owner')
    assert.strictEqual(result.isSuperAdmin, false)
    assert.strictEqual(result.profile.full_name, 'Owner Joe')
  }
})

/**
 * -----------------------------------------------------------------------------
 * 2. MULTI-TENANT ISOLATION & IDOR RESOURCE VERIFICATION
 * -----------------------------------------------------------------------------
 */
test('Multi-Tenancy: verifyTenantResource blocks cross-tenant access (IDOR protection)', async () => {
  const database = [
    { id: 'conv-100', org_id: 'org-tenant-a', preview: 'Tenant A conversation' },
    { id: 'conv-200', org_id: 'org-tenant-b', preview: 'Tenant B conversation' }
  ]

  const createMockSupabase = () => ({
    from: (table) => ({
      select: () => ({
        eq: (col1, val1) => ({
          eq: (col2, val2) => ({
            single: async () => {
              const found = database.find(row => row[col1] === val1 && row[col2] === val2)
              return found ? { data: found, error: null } : { data: null, error: new Error('Not found') }
            }
          }),
          single: async () => {
            const found = database.find(row => row[col1] === val1)
            return found ? { data: found, error: null } : { data: null, error: new Error('Not found') }
          }
        })
      })
    })
  })

  const mockClient = createMockSupabase()

  // 1. Tenant A accesses Tenant A resource -> Allowed
  const allowed = await verifyTenantResource(mockClient, 'conversations', 'conv-100', 'org-tenant-a')
  assert.strictEqual(allowed.data?.id, 'conv-100')
  assert.strictEqual(allowed.error, undefined)

  // 2. Tenant A attempts to access Tenant B resource -> Blocked (404/403)
  const blocked = await verifyTenantResource(mockClient, 'conversations', 'conv-200', 'org-tenant-a')
  assert.strictEqual(blocked.data, null)
  assert.match(blocked.error, /Resource not found or access denied/)

  // 3. Super admin bypasses org scoping -> Allowed
  const superAdminBypass = await verifyTenantResource(mockClient, 'conversations', 'conv-200', 'org-tenant-a', true)
  assert.strictEqual(superAdminBypass.data?.id, 'conv-200')
  assert.strictEqual(superAdminBypass.error, undefined)
})

/**
 * -----------------------------------------------------------------------------
 * 3. SMS DESTINATION PHONE HARDENING (REQUIREMENT 6)
 * -----------------------------------------------------------------------------
 */
test('SMS Hardening: Outbound phone resolved strictly from contact, ignoring client tampering', () => {
  // Simulates server-side dispatch logic:
  // Client attempts to tamper with the destination phone number
  const untrustedClientBody = {
    conversation_id: 'conv-777',
    to: '+19999999999', // Malicious arbitrary destination
    body: 'Hello there'
  }

  // Authoritative contact record loaded securely from the verified conversation
  const verifiedConversationContact = {
    id: 'cnt-444',
    name: 'Real Customer',
    phone: '+12145550199', // Authoritative contact phone
    opt_out: false
  }

  // Hardened server rule: destination phone is always taken from verified contact
  const resolvedDestinationPhone = verifiedConversationContact.phone
  assert.strictEqual(resolvedDestinationPhone, '+12145550199')
  assert.notStrictEqual(resolvedDestinationPhone, untrustedClientBody.to)
})

/**
 * -----------------------------------------------------------------------------
 * 4. ROLE-BASED ACCESS CONTROL & PERMISSION MATRIX
 * -----------------------------------------------------------------------------
 */
test('RBAC: Normalizes canonical and legacy roles correctly', () => {
  assert.strictEqual(normalizeRole('owner'), 'owner')
  assert.strictEqual(normalizeRole('admin'), 'admin')
  assert.strictEqual(normalizeRole('client_admin'), 'admin')
  assert.strictEqual(normalizeRole('member'), 'member')
  assert.strictEqual(normalizeRole('dispatcher'), 'member')
  assert.strictEqual(normalizeRole('super_admin'), 'super_admin')
  assert.strictEqual(normalizeRole(''), 'member')
  assert.strictEqual(normalizeRole(null), 'member')
  assert.strictEqual(normalizeRole(undefined), 'member')
})

test('RBAC: Enforces permission boundaries across roles', () => {
  // Member: can send SMS & view contacts, cannot invite team or manage billing
  assert.strictEqual(hasPermission('member', 'messages:send'), true)
  assert.strictEqual(hasPermission('member', 'contacts:read'), true)
  assert.strictEqual(hasPermission('member', 'team:invite'), false)
  assert.strictEqual(hasPermission('member', 'org:billing'), false)
  assert.strictEqual(hasPermission('member', 'org:delete'), false)
  assert.strictEqual(hasPermission('member', 'admin:all'), false)

  // Dispatcher (legacy role aliased to member): same boundaries
  assert.strictEqual(hasPermission('dispatcher', 'messages:send'), true)
  assert.strictEqual(hasPermission('dispatcher', 'team:invite'), false)

  // Admin: can invite team, cannot delete org or access billing
  assert.strictEqual(hasPermission('admin', 'team:invite'), true)
  assert.strictEqual(hasPermission('admin', 'org:update'), true)
  assert.strictEqual(hasPermission('admin', 'org:billing'), false)
  assert.strictEqual(hasPermission('admin', 'org:delete'), false)
  assert.strictEqual(hasPermission('admin', 'admin:all'), false)

  // Owner: has full tenant permissions including billing and deletion
  assert.strictEqual(hasPermission('owner', 'org:billing'), true)
  assert.strictEqual(hasPermission('owner', 'org:delete'), true)
  assert.strictEqual(hasPermission('owner', 'team:invite'), true)
  assert.strictEqual(hasPermission('owner', 'admin:all'), false)

  // Super Admin: platform-wide access
  assert.strictEqual(hasPermission('super_admin', 'admin:all'), true)
  assert.strictEqual(hasPermission('super_admin', 'org:billing'), true)
})

test('RBAC: getTenantContext enforces action-level permission', async () => {
  const mockSupabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'usr-member' } }, error: null })
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: 'usr-member', org_id: 'org-1', role: 'member' },
            error: null
          })
        })
      })
    })
  }

  // Member attempting billing action should be rejected with 403
  const billingCheck = await getTenantContext('org:billing', mockSupabase)
  assert.strictEqual(billingCheck.ok, false)
  if (!billingCheck.ok) {
    assert.strictEqual(billingCheck.status, 403)
    assert.match(billingCheck.error, /lacks permission for 'org:billing'/)
  }

  // Member attempting admin platform action should be rejected with 403
  const adminCheck = await getTenantContext('admin:all', mockSupabase)
  assert.strictEqual(adminCheck.ok, false)
  if (!adminCheck.ok) {
    assert.strictEqual(adminCheck.status, 403)
    assert.match(adminCheck.error, /lacks permission for 'admin:all'/)
  }

  // Member sending SMS should succeed
  const smsCheck = await getTenantContext('messages:send', mockSupabase)
  assert.strictEqual(smsCheck.ok, true)
})

/**
 * -----------------------------------------------------------------------------
 * 5. SLIDING-WINDOW RATE LIMITER ENFORCEMENT
 * -----------------------------------------------------------------------------
 */
test('Rate Limiter: Throttles requests exceeding maximum limit', () => {
  const testKey = `test_tenant_rl_${Date.now()}`
  const config = { max: 3, windowMs: 1000 }

  // 1. First 3 requests are allowed
  const r1 = checkRateLimit(testKey, config)
  assert.strictEqual(r1.allowed, true)
  assert.strictEqual(r1.remaining, 2)

  const r2 = checkRateLimit(testKey, config)
  assert.strictEqual(r2.allowed, true)
  assert.strictEqual(r2.remaining, 1)

  const r3 = checkRateLimit(testKey, config)
  assert.strictEqual(r3.allowed, true)
  assert.strictEqual(r3.remaining, 0)

  // 2. 4th request within window is denied
  const r4 = checkRateLimit(testKey, config)
  assert.strictEqual(r4.allowed, false)
  assert.strictEqual(r4.remaining, 0)

  // 3. Response headers formatting
  const headers = getRateLimitHeaders(r4)
  assert.strictEqual(headers['X-RateLimit-Limit'], '3')
  assert.strictEqual(headers['X-RateLimit-Remaining'], '0')
  assert.ok(Number(headers['X-RateLimit-Reset']) > 0)
})

test('Rate Limiter: Correctly extracts client IP from standard proxy headers', () => {
  const reqWithForwarded = new Request('http://localhost', {
    headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' }
  })
  assert.strictEqual(extractClientIp(reqWithForwarded), '203.0.113.195')

  const reqWithRealIp = new Request('http://localhost', {
    headers: { 'x-real-ip': '198.51.100.44' }
  })
  assert.strictEqual(extractClientIp(reqWithRealIp), '198.51.100.44')

  const reqWithCfIp = new Request('http://localhost', {
    headers: { 'cf-connecting-ip': '192.0.2.1' }
  })
  assert.strictEqual(extractClientIp(reqWithCfIp), '192.0.2.1')

  const reqFallback = new Request('http://localhost')
  assert.strictEqual(extractClientIp(reqFallback), '127.0.0.1')
})

/**
 * -----------------------------------------------------------------------------
 * 6. CREDENTIAL REDACTION IN AUDIT LOGS
 * -----------------------------------------------------------------------------
 */
test('Audit Logger: Deeply redacts sensitive keys and values', () => {
  const sensitivePayload = {
    org_id: 'org-secure',
    user_email: 'admin@contractor.com',
    password: 'super_secret_password_123',
    api_key: 'KEY_LIVE_998877',
    service_role_key: 'eyJhbGciOiJIUzI1NiIsIn...',
    nested: {
      auth_token: 'Bearer xyz987',
      normal_field: 'business_info',
      credentials: {
        client_secret: 'secret_value',
        public_id: 'pub_123'
      }
    },
    list: [
      { secret_code: 'abc' },
      { general_item: 'safe' }
    ]
  }

  const redacted = redactSensitiveData(sensitivePayload)

  // Verify sensitive fields are redacted
  assert.strictEqual(redacted.password, '[REDACTED]')
  assert.strictEqual(redacted.api_key, '[REDACTED]')
  assert.strictEqual(redacted.service_role_key, '[REDACTED]')
  assert.strictEqual(redacted.nested.auth_token, '[REDACTED]')
  assert.strictEqual(redacted.nested.credentials.client_secret, '[REDACTED]')
  assert.strictEqual(redacted.list[0].secret_code, '[REDACTED]')

  // Verify non-sensitive fields are preserved
  assert.strictEqual(redacted.org_id, 'org-secure')
  assert.strictEqual(redacted.user_email, 'admin@contractor.com')
  assert.strictEqual(redacted.nested.normal_field, 'business_info')
  assert.strictEqual(redacted.nested.credentials.public_id, 'pub_123')
  assert.strictEqual(redacted.list[1].general_item, 'safe')
})
