import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateEnvironment,
  extractSupabaseUrlProjectRef,
  extractJwtProjectRef,
  getEnvironmentTier
} from '../src/lib/config/env.ts'
import { createAdminClient } from '../src/lib/supabase/admin.ts'

// Helper to create a fake valid JWT with specific claims
function makeFakeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.mockSignature`
}

test('1. Supabase URL / service-role project mismatch detection in validateEnvironment', () => {
  const mismatchEnv = {
    APP_ENV: 'production',
    NODE_ENV: 'production',
    NEXT_PUBLIC_APP_URL: 'https://app.corvexastudio.com',
    NEXT_PUBLIC_SUPABASE_URL: 'https://vlztovqaummczupslymr.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_valid',
    SUPABASE_SERVICE_ROLE_KEY: makeFakeJwt({ iss: 'supabase', ref: 'ttshyxmudazpnwkpvqcb', role: 'service_role' }),
    TELNYX_API_KEY: 'KEY12345678901234567890',
    CRON_SECRET: '32_byte_secure_hex_token_for_cron_job'
  }

  const result = validateEnvironment(mismatchEnv)
  assert.strictEqual(result.ok, false, 'Environment with mismatched Supabase project references must fail')
  assert.strictEqual(result.config.isSupabaseProjectAligned, false)
  assert.ok(
    result.errors.some(e => e.includes('SUPABASE_SERVICE_ROLE_KEY project mismatch')),
    'Must report explicit error about mismatched Supabase project references'
  )
})

test('2. Matching Supabase URL and service-role project references pass validation', () => {
  const matchedEnv = {
    APP_ENV: 'production',
    NODE_ENV: 'production',
    NEXT_PUBLIC_APP_URL: 'https://app.corvexastudio.com',
    NEXT_PUBLIC_SUPABASE_URL: 'https://vlztovqaummczupslymr.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_valid',
    SUPABASE_SERVICE_ROLE_KEY: makeFakeJwt({ iss: 'supabase', ref: 'vlztovqaummczupslymr', role: 'service_role' }),
    TELNYX_API_KEY: 'KEY12345678901234567890',
    TELNYX_PUBLIC_KEY: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA',
    CRON_SECRET: '32_byte_secure_hex_token_for_cron_job'
  }

  const result = validateEnvironment(matchedEnv)
  assert.strictEqual(result.config.isSupabaseProjectAligned, true)
  assert.strictEqual(result.errors.filter(e => e.includes('project mismatch')).length, 0)
})

test('3. createAdminClient throws security fatal error on cross-project credential mismatch', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://vlztovqaummczupslymr.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = makeFakeJwt({ iss: 'supabase', ref: 'ttshyxmudazpnwkpvqcb', role: 'service_role' })

    assert.throws(
      () => createAdminClient(),
      /\[SECURITY FATAL\] SUPABASE_SERVICE_ROLE_KEY project mismatch/,
      'createAdminClient must throw immediately on mismatched project references'
    )
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey
  }
})

test('4. Missing required secrets are detected in production environment', () => {
  const missingSecretsEnv = {
    APP_ENV: 'production',
    NODE_ENV: 'production',
    NEXT_PUBLIC_APP_URL: 'https://app.corvexastudio.com',
    NEXT_PUBLIC_SUPABASE_URL: 'https://vlztovqaummczupslymr.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    TELNYX_API_KEY: ''
  }

  const result = validateEnvironment(missingSecretsEnv)
  assert.strictEqual(result.ok, false)
  assert.ok(result.errors.some(e => e.includes('SUPABASE_ANON_KEY')))
  assert.ok(result.errors.some(e => e.includes('SUPABASE_SERVICE_ROLE_KEY')))
  assert.ok(result.errors.some(e => e.includes('TELNYX_API_KEY')))
})

test('5. Deferred Telnyx configuration does not crash local/development environment', () => {
  const devEnv = {
    APP_ENV: 'development',
    NODE_ENV: 'development',
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-token',
    TELNYX_API_KEY: '' // Intentionally omitted
  }

  const result = validateEnvironment(devEnv)
  assert.strictEqual(result.ok, true, 'Development environment must not fail when Telnyx is deferred')
  assert.strictEqual(result.config.hasTelnyxApiKey, false)
  assert.ok(result.warnings.some(w => w.includes('simulated telephony mode')))
})

test('6. Deferred Stripe SaaS billing does not block manual billing foundation', () => {
  const manualBillingEnv = {
    APP_ENV: 'production',
    NODE_ENV: 'production',
    NEXT_PUBLIC_APP_URL: 'https://app.corvexastudio.com',
    NEXT_PUBLIC_SUPABASE_URL: 'https://vlztovqaummczupslymr.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-token',
    SUPABASE_SERVICE_ROLE_KEY: makeFakeJwt({ ref: 'vlztovqaummczupslymr' }),
    TELNYX_API_KEY: 'KEY12345678901234567890',
    STRIPE_SECRET_KEY: '', // Deferred SaaS billing
    CRON_SECRET: 'valid_cron_secret_32_bytes_long_123456'
  }

  const result = validateEnvironment(manualBillingEnv)
  assert.strictEqual(result.config.saasBillingMode, 'manual_paypal')
  assert.strictEqual(result.config.hasStripeSecretKey, false)
  // Missing stripe is a warning (for homeowner checkout simulation), not a fatal blocker for SaaS manual billing
  assert.ok(result.warnings.some(w => w.includes('STRIPE_SECRET_KEY is not configured')))
})

test('7. extractSupabaseUrlProjectRef and extractJwtProjectRef handle various formats cleanly', () => {
  assert.strictEqual(extractSupabaseUrlProjectRef('https://vlztovqaummczupslymr.supabase.co'), 'vlztovqaummczupslymr')
  assert.strictEqual(extractSupabaseUrlProjectRef('https://XYZ123.supabase.co/'), 'xyz123')
  assert.strictEqual(extractSupabaseUrlProjectRef('http://localhost:54321'), null)
  assert.strictEqual(extractSupabaseUrlProjectRef(''), null)

  const jwt = makeFakeJwt({ ref: 'myprojectref', role: 'service_role' })
  assert.strictEqual(extractJwtProjectRef(jwt), 'myprojectref')
  assert.strictEqual(extractJwtProjectRef('invalid-token'), null)
  assert.strictEqual(extractJwtProjectRef(''), null)
})
