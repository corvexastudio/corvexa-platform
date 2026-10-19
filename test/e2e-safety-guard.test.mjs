import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractProjectRef,
  validateE2EEnvironment,
  assertE2ETestSafety,
  KNOWN_PRODUCTION_PROJECT_REF,
  SYNTHETIC_DEMO_ORG_ID,
  SYNTHETIC_DEMO_ORG_NAME,
  PROTECTED_OWNER_ORG_ID
} from './e2e/safety-guard.mjs';

import {
  validateResetEnvironment,
  validateResetTarget,
  buildCleanupQuery,
  DEMO_RESET_CLEANUP_TABLES,
  FORBIDDEN_GLOBAL_TABLES
} from '../scripts/reset-demo-tenant.mjs';

import { sendTelnyxSms } from '../src/lib/telnyx.ts';
import { createStripeCheckoutSession } from '../src/lib/payments/stripe-adapter.ts';
import { TelnyxApiClient } from '../src/lib/telephony/telnyx-api-client.ts';

test('E2E Safety Guard — Project Reference Extraction', () => {
  // Standard Supabase domain
  assert.strictEqual(
    extractProjectRef('https://vlztovqaummczupslymr.supabase.co'),
    'vlztovqaummczupslymr'
  );

  // Staging / dedicated test project ref
  assert.strictEqual(
    extractProjectRef('https://captodesk-dedicated-test-8921.supabase.co'),
    'captodesk-dedicated-test-8921'
  );

  // Local Supabase instances
  assert.strictEqual(extractProjectRef('http://localhost:54321'), 'local-supabase');
  assert.strictEqual(extractProjectRef('http://127.0.0.1:54321'), 'local-supabase');

  // Null, empty, or unparseable inputs
  assert.strictEqual(extractProjectRef(null), null);
  assert.strictEqual(extractProjectRef(''), null);
  assert.strictEqual(extractProjectRef('not-a-valid-url'), null);
});

test('E2E Safety Guard — Case 1: Refuses execution when E2E_SUPABASE_PROJECT_REF is missing', () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://vlztovqaummczupslymr.supabase.co'
  };

  const result = validateE2EEnvironment(env);
  assert.strictEqual(result.safe, false);
  assert.match(result.error, /E2E_SUPABASE_PROJECT_REF is not configured/);
  assert.match(result.error, /refuse to execute without an explicit, verified project target/);
});

test('E2E Safety Guard — Case 2: Refuses execution when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
  const env = {
    E2E_SUPABASE_PROJECT_REF: 'captodesk-staging-123'
  };

  const result = validateE2EEnvironment(env);
  assert.strictEqual(result.safe, false);
  assert.match(result.error, /NEXT_PUBLIC_SUPABASE_URL is missing or undefined/);
});

test('E2E Safety Guard — Case 3: Refuses execution on URL/Project reference mismatch', () => {
  const env = {
    E2E_SUPABASE_PROJECT_REF: 'captodesk-staging-target',
    NEXT_PUBLIC_SUPABASE_URL: 'https://some-other-project.supabase.co'
  };

  const result = validateE2EEnvironment(env);
  assert.strictEqual(result.safe, false);
  assert.match(result.error, /Project reference mismatch/);
  assert.match(result.error, /resolves to project 'some-other-project'/);
  assert.match(result.error, /configured as 'captodesk-staging-target'/);
});

test('E2E Safety Guard — Case 4: Refuses execution when E2E target equals production (default production ref)', () => {
  const env = {
    E2E_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`
  };

  const result = validateE2EEnvironment(env);
  assert.strictEqual(result.safe, false);
  assert.match(result.error, /CRITICAL: Configured E2E target project/);
  assert.match(result.error, /matches the PRODUCTION project reference/);
});

test('E2E Safety Guard — Case 5: Refuses execution when E2E target equals explicit production override', () => {
  const env = {
    PRODUCTION_SUPABASE_PROJECT_REF: 'my-custom-prod-ref',
    E2E_SUPABASE_PROJECT_REF: 'my-custom-prod-ref',
    NEXT_PUBLIC_SUPABASE_URL: 'https://my-custom-prod-ref.supabase.co'
  };

  const result = validateE2EEnvironment(env);
  assert.strictEqual(result.safe, false);
  assert.match(result.error, /CRITICAL/);
  assert.match(result.error, /matches the PRODUCTION project reference/);
});

test('E2E Safety Guard — Case 6: Refuses execution if URL points to production even with different E2E_SUPABASE_PROJECT_REF', () => {
  const env = {
    PRODUCTION_SUPABASE_PROJECT_REF: 'my-prod-ref',
    E2E_SUPABASE_PROJECT_REF: 'some-other-ref',
    NEXT_PUBLIC_SUPABASE_URL: 'https://my-prod-ref.supabase.co'
  };

  const result = validateE2EEnvironment(env);
  assert.strictEqual(result.safe, false);
  // Fails on mismatch first (which safely rejects before reaching DB)
  assert.strictEqual(result.safe, false);
});

test('E2E Safety Guard — Case 7: Successfully passes for verified distinct non-production target', () => {
  const env = {
    PRODUCTION_SUPABASE_PROJECT_REF: 'vlztovqaummczupslymr',
    E2E_SUPABASE_PROJECT_REF: 'captodesk-e2e-staging-1029',
    NEXT_PUBLIC_SUPABASE_URL: 'https://captodesk-e2e-staging-1029.supabase.co',
    TELNYX_MOCK_DISPATCH: 'true',
    STRIPE_MOCK_DISPATCH: 'true'
  };

  const result = validateE2EEnvironment(env);
  assert.strictEqual(result.safe, true);
  assert.strictEqual(result.projectRef, 'captodesk-e2e-staging-1029');
  assert.strictEqual(result.productionRef, 'vlztovqaummczupslymr');
  assert.strictEqual(result.error, undefined);
});

test('E2E Safety Guard — Case 8: Successfully passes for verified local Supabase instance', () => {
  const env = {
    PRODUCTION_SUPABASE_PROJECT_REF: 'vlztovqaummczupslymr',
    E2E_SUPABASE_PROJECT_REF: 'local-supabase',
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    TELNYX_MOCK_DISPATCH: 'true',
    STRIPE_MOCK_DISPATCH: 'true'
  };

  const result = validateE2EEnvironment(env);
  assert.strictEqual(result.safe, true);
  assert.strictEqual(result.projectRef, 'local-supabase');
});

test('E2E Safety Guard — Case 9: assertE2ETestSafety throws descriptive error when exitOnError: false', () => {
  const unsafeEnv = {
    E2E_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`
  };

  assert.throws(
    () => {
      assertE2ETestSafety(unsafeEnv, { exitOnError: false });
    },
    (err) => {
      return (
        err instanceof Error &&
        err.message.includes('matches the PRODUCTION project reference')
      );
    }
  );
});

test('E2E Safety Guard — Case 10: Zero secret leakage in diagnostic messages', () => {
  const envWithSecrets = {
    E2E_SUPABASE_PROJECT_REF: 'secret-test',
    NEXT_PUBLIC_SUPABASE_URL: 'https://other.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.super_secret_token_12345',
    TELNYX_API_KEY: 'KEY01823901823091283091238',
    STRIPE_SECRET_KEY: 'sk_live_981273981273918237'
  };

  const result = validateE2EEnvironment(envWithSecrets);
  assert.strictEqual(result.safe, false);
  const errMsg = result.error || '';

  // Confirm no secret strings are present
  assert.strictEqual(errMsg.includes('super_secret_token_12345'), false);
  assert.strictEqual(errMsg.includes('KEY01823901823091283091238'), false);
  assert.strictEqual(errMsg.includes('sk_live_981273981273918237'), false);
  assert.strictEqual(errMsg.includes('eyJhbGciOiJIUzI1Ni'), false);
});

test('E2E Safety Guard — Case 11: Dedicated Demo Tenant Mode allows execution against CaptoDesk project', () => {
  const env = {
    E2E_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`,
    E2E_ALLOW_DEMO_TENANT: 'true',
    E2E_DEMO_ORG_ID: SYNTHETIC_DEMO_ORG_ID,
    TELNYX_MOCK_DISPATCH: 'true',
    STRIPE_MOCK_DISPATCH: 'true'
  };

  const result = validateE2EEnvironment(env);
  assert.strictEqual(result.safe, true);
  assert.strictEqual(result.mode, 'dedicated_demo_tenant');
  assert.strictEqual(result.projectRef, KNOWN_PRODUCTION_PROJECT_REF);
  assert.strictEqual(result.demoOrgId, SYNTHETIC_DEMO_ORG_ID);
});

test('E2E Safety Guard — Case 12: Refuses execution against CaptoDesk project if E2E_ALLOW_DEMO_TENANT is not true', () => {
  const env = {
    E2E_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`,
    E2E_ALLOW_DEMO_TENANT: 'false',
    TELNYX_MOCK_DISPATCH: 'true',
    STRIPE_MOCK_DISPATCH: 'true'
  };

  const result = validateE2EEnvironment(env);
  assert.strictEqual(result.safe, false);
  assert.match(result.error, /explicitly set E2E_ALLOW_DEMO_TENANT="true"/);
});

test('E2E Safety Guard — Case 13: Refuses execution when E2E_DEMO_ORG_ID is set to a non-demo org ID', () => {
  const env = {
    E2E_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`,
    E2E_ALLOW_DEMO_TENANT: 'true',
    E2E_DEMO_ORG_ID: PROTECTED_OWNER_ORG_ID, // Attempting to target protected owner tenant!
    TELNYX_MOCK_DISPATCH: 'true',
    STRIPE_MOCK_DISPATCH: 'true'
  };

  const result = validateE2EEnvironment(env);
  assert.strictEqual(result.safe, false);
  assert.match(result.error, /Tenant scope violation/);
  assert.match(result.error, /does not match the approved synthetic demo organization/);
});

test('E2E Safety Guard — Case 14: Refuses execution when CLI argument attempts arbitrary organization override', () => {
  const env = {
    E2E_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`,
    E2E_ALLOW_DEMO_TENANT: 'true',
    TELNYX_MOCK_DISPATCH: 'true',
    STRIPE_MOCK_DISPATCH: 'true'
  };

  const unsafeArgv = ['node', 'run-authenticated-e2e.mjs', `--org=${PROTECTED_OWNER_ORG_ID}`];
  const result = validateE2EEnvironment(env, { argv: unsafeArgv });
  assert.strictEqual(result.safe, false);
  assert.match(result.error, /Unchecked CLI argument violation/);
  assert.match(result.error, /strictly locked to the approved synthetic demo organization/);
});

test('E2E Safety Guard — Case 15: Refuses execution when environment variables attempt arbitrary organization override', () => {
  const env = {
    E2E_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`,
    E2E_ALLOW_DEMO_TENANT: 'true',
    TARGET_ORG_ID: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    TELNYX_MOCK_DISPATCH: 'true',
    STRIPE_MOCK_DISPATCH: 'true'
  };

  const result = validateE2EEnvironment(env);
  assert.strictEqual(result.safe, false);
  assert.match(result.error, /Tenant scope violation/);
});

test('E2E Safety Guard — Case 16: Refuses execution if TELNYX_MOCK_DISPATCH is missing, false, empty, or disabled', () => {
  // Explicitly false
  const falseEnv = {
    E2E_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`,
    E2E_ALLOW_DEMO_TENANT: 'true',
    TELNYX_MOCK_DISPATCH: 'false',
    STRIPE_MOCK_DISPATCH: 'true'
  };
  assert.strictEqual(validateE2EEnvironment(falseEnv).safe, false);
  assert.match(validateE2EEnvironment(falseEnv).error, /TELNYX_MOCK_DISPATCH must be explicitly set to "true"/);

  // Missing
  const missingEnv = {
    E2E_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`,
    E2E_ALLOW_DEMO_TENANT: 'true',
    STRIPE_MOCK_DISPATCH: 'true'
  };
  assert.strictEqual(validateE2EEnvironment(missingEnv).safe, false);
  assert.match(validateE2EEnvironment(missingEnv).error, /TELNYX_MOCK_DISPATCH must be explicitly set to "true"/);

  // Empty string
  const emptyEnv = {
    E2E_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`,
    E2E_ALLOW_DEMO_TENANT: 'true',
    TELNYX_MOCK_DISPATCH: '',
    STRIPE_MOCK_DISPATCH: 'true'
  };
  assert.strictEqual(validateE2EEnvironment(emptyEnv).safe, false);

  // Malformed / not strictly 'true'
  const malformedEnv = {
    E2E_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`,
    E2E_ALLOW_DEMO_TENANT: 'true',
    TELNYX_MOCK_DISPATCH: '1',
    STRIPE_MOCK_DISPATCH: 'true'
  };
  assert.strictEqual(validateE2EEnvironment(malformedEnv).safe, false);
});

test('E2E Safety Guard — Case 17: Refuses execution if STRIPE_MOCK_DISPATCH is missing, false, empty, or disabled', () => {
  // Explicitly false
  const falseEnv = {
    E2E_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`,
    E2E_ALLOW_DEMO_TENANT: 'true',
    TELNYX_MOCK_DISPATCH: 'true',
    STRIPE_MOCK_DISPATCH: 'false'
  };
  assert.strictEqual(validateE2EEnvironment(falseEnv).safe, false);
  assert.match(validateE2EEnvironment(falseEnv).error, /STRIPE_MOCK_DISPATCH must be explicitly set to "true"/);

  // Missing
  const missingEnv = {
    E2E_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`,
    E2E_ALLOW_DEMO_TENANT: 'true',
    TELNYX_MOCK_DISPATCH: 'true'
  };
  assert.strictEqual(validateE2EEnvironment(missingEnv).safe, false);
  assert.match(validateE2EEnvironment(missingEnv).error, /STRIPE_MOCK_DISPATCH must be explicitly set to "true"/);

  // Empty string
  const emptyEnv = {
    E2E_SUPABASE_PROJECT_REF: KNOWN_PRODUCTION_PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`,
    E2E_ALLOW_DEMO_TENANT: 'true',
    TELNYX_MOCK_DISPATCH: 'true',
    STRIPE_MOCK_DISPATCH: ''
  };
  assert.strictEqual(validateE2EEnvironment(emptyEnv).safe, false);
});

test('E2E Safety Guard — Case 18: Refuses execution if secondary SUPABASE_URL contradicts target', () => {
  const env = {
    E2E_SUPABASE_PROJECT_REF: 'captodesk-stage-ref',
    NEXT_PUBLIC_SUPABASE_URL: 'https://captodesk-stage-ref.supabase.co',
    SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`
  };

  const result = validateE2EEnvironment(env);
  assert.strictEqual(result.safe, false);
  assert.match(result.error, /Contradictory backend URL/);
});

// ── Demo Reset Tooling Invariant Tests ─────────────────────────────────────────

test('Demo Reset Guard — Case 19: validateResetEnvironment rejects missing URL or missing service key', () => {
  // Missing URL
  const noUrl = validateResetEnvironment({ SUPABASE_SERVICE_ROLE_KEY: 'test-key' });
  assert.strictEqual(noUrl.valid, false);
  assert.match(noUrl.error, /Missing NEXT_PUBLIC_SUPABASE_URL/);

  // Missing Service Key
  const noKey = validateResetEnvironment({ NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co` });
  assert.strictEqual(noKey.valid, false);
  assert.match(noKey.error, /Missing SUPABASE_SERVICE_ROLE_KEY/);
});

test('Demo Reset Guard — Case 20: validateResetEnvironment rejects non-production / foreign project reference', () => {
  const foreignEnv = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://unauthorized-foreign-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'dummy-service-key'
  };

  const result = validateResetEnvironment(foreignEnv);
  assert.strictEqual(result.valid, false);
  assert.match(result.error, /Target project mismatch/);
});

test('Demo Reset Guard — Case 21: validateResetEnvironment rejects CLI or env tenant override', () => {
  const validEnv = {
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: 'dummy-service-key'
  };

  // Malicious CLI override
  const cliOverride = validateResetEnvironment(validEnv, ['--target', PROTECTED_OWNER_ORG_ID]);
  assert.strictEqual(cliOverride.valid, false);
  assert.match(cliOverride.error, /Forbidden CLI override/);

  // Malicious Env override
  const envOverride = validateResetEnvironment({ ...validEnv, TARGET_ORG_ID: PROTECTED_OWNER_ORG_ID }, []);
  assert.strictEqual(envOverride.valid, false);
  assert.match(envOverride.error, /Tenant scope violation/);
});

test('Demo Reset Guard — Case 22: validateResetTarget rejects null, missing, or mismatched org record', () => {
  // Null org record
  const nullOrg = validateResetTarget(null, SYNTHETIC_DEMO_ORG_ID);
  assert.strictEqual(nullOrg.valid, false);
  assert.match(nullOrg.error, /not found in database/);

  // Wrong ID in DB record
  const wrongId = validateResetTarget({ id: 'wrong-uuid', name: SYNTHETIC_DEMO_ORG_NAME }, SYNTHETIC_DEMO_ORG_ID);
  assert.strictEqual(wrongId.valid, false);
  assert.match(wrongId.error, /Organization ID mismatch/);

  // Wrong Name in DB record
  const wrongName = validateResetTarget({ id: SYNTHETIC_DEMO_ORG_ID, name: 'Malicious Tenant Name' }, SYNTHETIC_DEMO_ORG_ID);
  assert.strictEqual(wrongName.valid, false);
  assert.match(wrongName.error, /Organization name mismatch/);
});

test('Demo Reset Guard — Case 23: validateResetTarget strictly rejects protected owner organization', () => {
  // Attempt to target protected owner tenant ID
  const ownerTarget = validateResetTarget(
    { id: PROTECTED_OWNER_ORG_ID, name: "Shanta M's Business" },
    PROTECTED_OWNER_ORG_ID
  );
  assert.strictEqual(ownerTarget.valid, false);
  assert.match(ownerTarget.error, /CRITICAL: Target matches PROTECTED OWNER organization/);
});

test('Demo Reset Guard — Case 24: buildCleanupQuery scopes 100% of tables to org_id and forbids global tables', () => {
  // Check all 18 tables
  assert.strictEqual(DEMO_RESET_CLEANUP_TABLES.length, 18);

  for (const table of DEMO_RESET_CLEANUP_TABLES) {
    const query = buildCleanupQuery(table, SYNTHETIC_DEMO_ORG_ID);
    assert.strictEqual(query.table, table);
    assert.strictEqual(query.filterColumn, 'org_id');
    assert.strictEqual(query.filterValue, SYNTHETIC_DEMO_ORG_ID);
  }

  // Verify global tables are strictly rejected
  for (const globalTable of FORBIDDEN_GLOBAL_TABLES) {
    assert.throws(
      () => buildCleanupQuery(globalTable, SYNTHETIC_DEMO_ORG_ID),
      /is a global\/shared table and cannot be wiped/
    );
  }

  // Verify non-demo target org is strictly rejected
  assert.throws(
    () => buildCleanupQuery('jobs', PROTECTED_OWNER_ORG_ID),
    /Target org .* is not the approved demo tenant/
  );
});

// ── External Mock Gap Regression Tests ────────────────────────────────────────

test('External Mock Guard — Case 25: sendTelnyxSms fails closed in demo mode when TELNYX_MOCK_DISPATCH is not true', async () => {
  const originalEnv = { ...process.env };
  try {
    process.env.E2E_ALLOW_DEMO_TENANT = 'true';
    delete process.env.TELNYX_MOCK_DISPATCH;

    // Missing flag
    const resMissing = await sendTelnyxSms({ to: '+15551234567', text: 'Demo test' });
    assert.strictEqual(resMissing.success, false);
    assert.match(resMissing.error, /TELNYX_MOCK_DISPATCH must be "true"/);

    // Explicitly false
    process.env.TELNYX_MOCK_DISPATCH = 'false';
    const resFalse = await sendTelnyxSms({ to: '+15551234567', text: 'Demo test' });
    assert.strictEqual(resFalse.success, false);
    assert.match(resFalse.error, /TELNYX_MOCK_DISPATCH must be "true"/);

    // Strictly 'true' returns mock response with zero external dispatch
    process.env.TELNYX_MOCK_DISPATCH = 'true';
    const resTrue = await sendTelnyxSms({ to: '+15551234567', text: 'Demo test' });
    assert.strictEqual(resTrue.success, true);
    assert.match(resTrue.messageId, /^mock_telnyx_/);
  } finally {
    process.env = originalEnv;
  }
});

test('External Mock Guard — Case 26: createStripeCheckoutSession fails closed in demo mode when STRIPE_MOCK_DISPATCH is not true', async () => {
  const originalEnv = { ...process.env };
  try {
    process.env.E2E_ALLOW_DEMO_TENANT = 'true';
    delete process.env.STRIPE_MOCK_DISPATCH;

    // Missing flag throws fail-closed error
    await assert.rejects(
      async () => {
        await createStripeCheckoutSession({
          invoiceId: 'inv-demo',
          invoiceNumber: 'INV-DEMO-001',
          orgId: SYNTHETIC_DEMO_ORG_ID,
          contactId: 'cnt-demo',
          amountDue: 250,
          title: 'Lawn Aeration',
          manageToken: 'tok-demo',
          baseUrl: 'http://localhost:3088'
        });
      },
      /STRIPE_MOCK_DISPATCH must be "true"/
    );

    // Strictly 'true' returns mock session without network requests
    process.env.STRIPE_MOCK_DISPATCH = 'true';
    const resTrue = await createStripeCheckoutSession({
      invoiceId: 'inv-demo',
      invoiceNumber: 'INV-DEMO-001',
      orgId: SYNTHETIC_DEMO_ORG_ID,
      contactId: 'cnt-demo',
      amountDue: 250,
      title: 'Lawn Aeration',
      manageToken: 'tok-demo',
      baseUrl: 'http://localhost:3088'
    });
    assert.match(resTrue.sessionId, /^cs_sim_/);
    assert.match(resTrue.checkoutUrl, /simulated_checkout=true/);
  } finally {
    process.env = originalEnv;
  }
});

test('External Mock Guard — Case 27: TelnyxApiClient fails closed in demo mode for number order and search', async () => {
  const originalEnv = { ...process.env };
  try {
    process.env.E2E_ALLOW_DEMO_TENANT = 'true';
    delete process.env.TELNYX_MOCK_DISPATCH;

    const client = new TelnyxApiClient({ apiKey: 'mock-key-for-test' });

    // Missing mock dispatch throws fail-closed error
    await assert.rejects(
      async () => {
        await client.createNumberOrder({ phoneNumber: '+15125550199', customerReference: 'org_test' });
      },
      /TELNYX_MOCK_DISPATCH must be "true"/
    );

    await assert.rejects(
      async () => {
        await client.searchAvailableNumbers();
      },
      /TELNYX_MOCK_DISPATCH must be "true"/
    );

    // With TELNYX_MOCK_DISPATCH === 'true', returns mock numbers and mock orders with 0 external API calls
    process.env.TELNYX_MOCK_DISPATCH = 'true';
    const orderRes = await client.createNumberOrder({ phoneNumber: '+15125550199', customerReference: 'org_test' });
    assert.strictEqual(orderRes.status, 'success');
    assert.match(orderRes.orderId, /^mock_order_/);

    const searchRes = await client.searchAvailableNumbers();
    assert.strictEqual(searchRes.length, 1);
    assert.strictEqual(searchRes[0].phoneNumber, '+15125550199');
  } finally {
    process.env = originalEnv;
  }
});

