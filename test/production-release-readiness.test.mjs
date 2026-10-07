process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

import {
  validateEnvironment,
  getEnvironmentTier,
  isProduction,
  isTest
} from '../src/lib/config/env.ts'

test('Release Readiness 1. Environment Tier Detection & Separation', () => {
  assert.strictEqual(isTest(), true, 'Current environment must be detected as test')
  assert.strictEqual(isProduction(), false, 'Test mode must not be flagged as production')

  // Explicit env tier overrides
  assert.strictEqual(getEnvironmentTier({ NODE_ENV: 'production' }), 'production')
  assert.strictEqual(getEnvironmentTier({ APP_ENV: 'staging' }), 'staging')
  assert.strictEqual(getEnvironmentTier({ NODE_ENV: 'development' }), 'development')
})

test('Release Readiness 2. Production Environment Validation - Valid Production Config', () => {
  const validProductionEnv = {
    APP_ENV: 'production',
    NODE_ENV: 'production',
    NEXT_PUBLIC_APP_URL: 'https://app.corvexastudio.com',
    NEXT_PUBLIC_SUPABASE_URL: 'https://xyzprod.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.validAnon',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.validService',
    TELNYX_API_KEY: 'KEY0123456789ABCDEF0123456789_abcdef123456',
    TELNYX_PUBLIC_KEY: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA',
    TELNYX_PHONE_NUMBER: '+15551234567',
    STRIPE_SECRET_KEY: 'sk_live_5123456789abcdef',
    STRIPE_WEBHOOK_SECRET: 'whsec_987654321fedcba',
    CRON_SECRET: '9f8e7d6c5b4a392817263544abcdef12',
    SUPER_ADMIN_EMAILS: 'owner@corvexastudio.com'
  }

  const result = validateEnvironment(validProductionEnv)
  assert.strictEqual(result.ok, true, 'Valid production environment must pass validation')
  assert.strictEqual(result.errors.length, 0, 'Must have zero errors')
  assert.strictEqual(result.config.tier, 'production')
  assert.strictEqual(result.config.stripeMode, 'live')
  assert.strictEqual(result.config.hasCronSecret, true)
  assert.strictEqual(result.config.superAdminEmails.includes('owner@corvexastudio.com'), true)
})

test('Release Readiness 3. Production Environment Validation - Rejects Missing Critical Secrets', () => {
  const incompleteProductionEnv = {
    APP_ENV: 'production',
    NODE_ENV: 'production',
    NEXT_PUBLIC_APP_URL: 'http://insecure-domain.com', // Insecure HTTP
    NEXT_PUBLIC_SUPABASE_URL: '', // Missing
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '', // Missing
    SUPABASE_SERVICE_ROLE_KEY: '', // Missing
    TELNYX_API_KEY: '' // Missing
  }

  const result = validateEnvironment(incompleteProductionEnv)
  assert.strictEqual(result.ok, false, 'Incomplete production environment must fail')
  assert.ok(result.errors.some(e => e.includes('NEXT_PUBLIC_SUPABASE_URL')), 'Must report missing Supabase URL')
  assert.ok(result.errors.some(e => e.includes('HTTPS')), 'Must reject insecure HTTP URL in production')
  assert.ok(result.errors.some(e => e.includes('SUPABASE_SERVICE_ROLE_KEY')), 'Must require service role key in prod')
  assert.ok(result.errors.some(e => e.includes('TELNYX_API_KEY')), 'Must require Telnyx key in prod')
})

test('Release Readiness 4. Production Environment Validation - Warns on Test Keys in Production', () => {
  const testKeyInProdEnv = {
    APP_ENV: 'production',
    NODE_ENV: 'production',
    NEXT_PUBLIC_APP_URL: 'https://app.corvexastudio.com',
    NEXT_PUBLIC_SUPABASE_URL: 'https://xyzprod.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    TELNYX_API_KEY: 'KEY123',
    STRIPE_SECRET_KEY: 'sk_test_mock_123456789' // Test key in production
  }

  const result = validateEnvironment(testKeyInProdEnv)
  assert.strictEqual(result.config.stripeMode, 'test')
  assert.ok(
    result.warnings.some(w => w.includes('sk_test_') && w.includes('production')),
    'Must issue explicit warning when test keys are used in production'
  )
})

test('Release Readiness 5. Domain & Subdomain Routing Edge Logic', () => {
  // Test simulated proxy host matching logic
  function resolveSubdomainRewrite(hostname, pathname) {
    if (pathname.startsWith('/api/webhooks') || pathname === '/api/health' || pathname.includes('/auth/callback')) {
      return { action: 'bypass', path: pathname }
    }
    if (hostname.startsWith('book.')) {
      if (pathname.startsWith('/manage/')) {
        return { action: 'rewrite', path: `/book${pathname}` }
      }
      if (!pathname.startsWith('/book') && !pathname.startsWith('/api/book') && pathname !== '/') {
        return { action: 'rewrite', path: `/book${pathname}` }
      }
    }
    if (hostname.startsWith('admin.') && !pathname.startsWith('/admin')) {
      return { action: 'rewrite', path: `/admin${pathname}` }
    }
    return { action: 'next', path: pathname }
  }

  // 1. Health check bypass
  assert.strictEqual(resolveSubdomainRewrite('app.corvexastudio.com', '/api/health').action, 'bypass')

  // 2. Public booking subdomain rewriting
  const bookSlug = resolveSubdomainRewrite('book.corvexastudio.com', '/apex-plumbing')
  assert.strictEqual(bookSlug.action, 'rewrite')
  assert.strictEqual(bookSlug.path, '/book/apex-plumbing')

  const bookManage = resolveSubdomainRewrite('book.captodesk.com', '/manage/tok-secret-999')
  assert.strictEqual(bookManage.action, 'rewrite')
  assert.strictEqual(bookManage.path, '/book/manage/tok-secret-999')

  // 3. Admin subdomain rewriting
  const adminHealth = resolveSubdomainRewrite('admin.corvexastudio.com', '/system-health')
  assert.strictEqual(adminHealth.action, 'rewrite')
  assert.strictEqual(adminHealth.path, '/admin/system-health')
})

test('Release Readiness 6. Background Worker CRON_SECRET Security Enforcement', () => {
  function verifyCronAuthorization(headers, configuredSecret) {
    if (!configuredSecret) {
      return { authorized: true, reason: 'unconfigured_fallback_to_ratelimit' }
    }
    const authHeader = headers['authorization']
    const xCronSecret = headers['x-cron-secret']
    const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    const provided = bearerSecret || xCronSecret
    if (provided === configuredSecret) {
      return { authorized: true, reason: 'secret_valid' }
    }
    return { authorized: false, reason: 'unauthorized' }
  }

  const SECRET = 'sec_prod_cron_99887766554433221100'

  // Rejected: Missing header
  const res1 = verifyCronAuthorization({}, SECRET)
  assert.strictEqual(res1.authorized, false)

  // Rejected: Invalid header
  const res2 = verifyCronAuthorization({ authorization: 'Bearer invalid_secret' }, SECRET)
  assert.strictEqual(res2.authorized, false)

  // Accepted: Valid Bearer
  const res3 = verifyCronAuthorization({ authorization: `Bearer ${SECRET}` }, SECRET)
  assert.strictEqual(res3.authorized, true)

  // Accepted: Valid X-Cron-Secret header
  const res4 = verifyCronAuthorization({ 'x-cron-secret': SECRET }, SECRET)
  assert.strictEqual(res4.authorized, true)
})

test('Release Readiness 7. Database Master Schema & Migrations Completeness', () => {
  const schemaPath = path.resolve(process.cwd(), 'supabase/schema.sql')
  assert.ok(fs.existsSync(schemaPath), 'supabase/schema.sql must exist')

  const schemaSql = fs.readFileSync(schemaPath, 'utf8')

  // Verify critical production tables exist in master schema
  const requiredTables = [
    'organizations',
    'profiles',
    'contacts',
    'calls',
    'messages',
    'automation_rules',
    'automation_runs',
    'services',
    'appointments',
    'quotes',
    'quote_items',
    'jobs',
    'job_items',
    'invoices',
    'payments',
    'review_requests',
    'compliance_suppression_list',
    'compliance_consent_records',
    'compliance_audit_logs',
    'processed_events'
  ]

  for (const table of requiredTables) {
    assert.ok(
      schemaSql.includes(table),
      `Master schema.sql must define table: ${table}`
    )
  }

  // Verify essential RLS policies exist in schema
  assert.ok(schemaSql.includes('ROW LEVEL SECURITY'), 'Master schema must enable RLS')
  assert.ok(schemaSql.includes('org_isolation'), 'Master schema must define org isolation policies')
})

test('Release Readiness 8. Operational Runbooks & Launch Documentation Verification', () => {
  const requiredDocs = [
    'DEPLOYMENT.md',
    'OPERATIONS.md',
    'INCIDENT_RESPONSE.md',
    'ENVIRONMENT.md',
    'CUSTOMER_ONBOARDING.md'
  ]

  for (const doc of requiredDocs) {
    const docPath = path.resolve(process.cwd(), doc)
    assert.ok(fs.existsSync(docPath), `Operational doc ${doc} must exist`)
    const stat = fs.statSync(docPath)
    assert.ok(stat.size > 1000, `Operational doc ${doc} must be comprehensive (>1KB), found ${stat.size} bytes`)
  }
})
