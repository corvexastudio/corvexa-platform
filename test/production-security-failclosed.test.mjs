import test from 'node:test'
import assert from 'node:assert'
import { createAdminClient } from '../src/lib/supabase/admin.ts'
import { sendTelnyxSms } from '../src/lib/telnyx.ts'
import { getTenantContext } from '../src/lib/security/tenant-context.ts'
import { claimDueAutomationJobs } from '../src/lib/automations/worker.ts'
import { verifyStripeWebhookSignature, createStripeCheckoutSession } from '../src/lib/payments/stripe-adapter.ts'
import { extractClientIp } from '../src/lib/security/rate-limiter.ts'

test('Fail-Closed 1. Supabase Admin Client: Prohibits fallback to anon key and throws in production', () => {
  const originalEnv = { ...process.env }
  try {
    process.env.NODE_ENV = 'production'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-public-key-here'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    assert.throws(
      () => createAdminClient(),
      /SUPABASE_SERVICE_ROLE_KEY is required for privileged database operations/,
      'Must throw fatal error and never downgrade to anon key in production'
    )
  } finally {
    process.env = originalEnv
  }
})

test('Fail-Closed 2. Telnyx SMS: Rejects simulated success in production when API key is missing', async () => {
  const originalEnv = { ...process.env }
  try {
    process.env.NODE_ENV = 'production'
    delete process.env.TELNYX_API_KEY
    process.env.TELNYX_PHONE_NUMBER = '+15551234567'

    const result = await sendTelnyxSms({
      to: '+15559876543',
      text: 'Production alert message'
    })

    assert.strictEqual(result.success, false, 'SMS send must fail in production without API key')
    assert.strictEqual(result.messageId, undefined, 'Must NEVER return mock messageId in production')
    assert.ok(result.error?.includes('production environment'), 'Must return explicit production configuration error')
  } finally {
    process.env = originalEnv
  }
})

test('Fail-Closed 3. Super-Admin Allowlist: Missing or empty allowlist in production demotes super_admin to owner', async () => {
  const originalEnv = { ...process.env }
  try {
    process.env.NODE_ENV = 'production'
    delete process.env.SUPER_ADMIN_EMAILS

    // Mock client where user profile claims role: 'super_admin'
    const mockClient = {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'usr-attacker', email: 'attacker@evil.com' } },
          error: null
        })
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { id: 'usr-attacker', email: 'attacker@evil.com', role: 'super_admin', org_id: 'org-victim' },
              error: null
            })
          })
        })
      })
    }

    // Attacker attempts platform-wide admin action
    const result = await getTenantContext('admin:all', mockClient)
    assert.strictEqual(result.ok, false, 'Super admin platform access must be denied')
    assert.strictEqual(result.status, 403)
    assert.ok(result.error?.includes("lacks permission for 'admin:all'"))
  } finally {
    process.env = originalEnv
  }
})

test('Fail-Closed 4. Super-Admin Allowlist: Configured allowlist only permits listed emails', async () => {
  const originalEnv = { ...process.env }
  try {
    process.env.NODE_ENV = 'production'
    process.env.SUPER_ADMIN_EMAILS = 'authorized@company.com,founder@company.com'

    // Case A: Unlisted email claiming super_admin is rejected from platform actions
    const unlistedClient = {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'usr-unlisted', email: 'other@company.com' } },
          error: null
        })
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { id: 'usr-unlisted', email: 'other@company.com', role: 'super_admin', org_id: 'org-1' },
              error: null
            })
          })
        })
      })
    }
    const unlistedResult = await getTenantContext('admin:all', unlistedClient)
    assert.strictEqual(unlistedResult.ok, false)

    // Case B: Listed email claiming super_admin is granted platform actions
    const authorizedClient = {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'usr-auth', email: 'authorized@company.com' } },
          error: null
        })
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { id: 'usr-auth', email: 'authorized@company.com', role: 'super_admin' },
              error: null
            })
          })
        })
      })
    }
    const authorizedResult = await getTenantContext('admin:all', authorizedClient)
    assert.strictEqual(authorizedResult.ok, true)
    assert.strictEqual(authorizedResult.isSuperAdmin, true)
  } finally {
    process.env = originalEnv
  }
})

test('Fail-Closed 5. Automation Worker: RPC failure in production refuses non-atomic query fallback', async () => {
  const originalEnv = { ...process.env }
  try {
    process.env.NODE_ENV = 'production'

    let selectCalled = false
    const mockSupabase = {
      rpc: async () => ({
        data: null,
        error: { message: 'Database connection limit exceeded' }
      }),
      from: () => {
        selectCalled = true
        return {
          select: () => ({
            in: () => ({
              lte: () => ({
                order: () => ({
                  limit: async () => ({ data: [{ id: 'stolen-job-1' }] })
                })
              })
            })
          })
        }
      }
    }

    const claimed = await claimDueAutomationJobs(mockSupabase, 'worker-prod-1', 10)
    assert.deepStrictEqual(claimed, [], 'Must return empty array on RPC failure in production')
    assert.strictEqual(selectCalled, false, 'Must NEVER invoke non-atomic select fallback in production')
  } finally {
    process.env = originalEnv
  }
})

test('Fail-Closed 6. Stripe Webhook: Rejects unverified events in production when secret is missing', () => {
  const originalEnv = { ...process.env }
  try {
    process.env.NODE_ENV = 'production'
    delete process.env.STRIPE_WEBHOOK_SECRET

    const result = verifyStripeWebhookSignature(
      JSON.stringify({ type: 'payment_intent.succeeded', id: 'evt_fake' }),
      'sig_forged_header',
      null
    )

    assert.strictEqual(result.isValid, false, 'Must reject webhook in production when secret is absent')
    assert.ok(result.error?.includes('STRIPE_WEBHOOK_SECRET is not configured'))
  } finally {
    process.env = originalEnv
  }
})

test('Fail-Closed 7. Rate Limiter IP Extraction: Cloudflare edge header takes precedence over spoofed X-Forwarded-For', () => {
  const spoofedRequest = new Request('https://app.corvexastudio.com/api/login', {
    headers: {
      'cf-connecting-ip': '198.51.100.77',
      'x-forwarded-for': '203.0.113.1, 10.0.0.1' // Attacker attempting IP spoofing
    }
  })

  const extracted = extractClientIp(spoofedRequest)
  assert.strictEqual(extracted, '198.51.100.77', 'Must prioritize trusted Cloudflare edge header over spoofable client header')
})

test('Fail-Closed 8. Stripe Checkout: Missing STRIPE_SECRET_KEY in production rejects simulated checkout creation', async () => {
  const originalEnv = { ...process.env }
  try {
    process.env.NODE_ENV = 'production'
    delete process.env.STRIPE_SECRET_KEY

    await assert.rejects(
      async () => {
        await createStripeCheckoutSession({
          invoiceId: 'inv-123',
          invoiceNumber: 'INV-001',
          orgId: 'org-1',
          contactId: 'cnt-1',
          amountDue: 150,
          title: 'Roof Repair',
          manageToken: 'token-xyz',
          baseUrl: 'https://example.com'
        })
      },
      /STRIPE_SECRET_KEY is not configured in production environment/,
      'Must throw fatal error and never return mock checkout link in production'
    )
  } finally {
    process.env = originalEnv
  }
})
