/**
 * ==============================================================================
 * CAPTODESK — P1-OPS-01: SUPER ADMIN TELNYX DID PROVISIONING TEST SUITE
 * ==============================================================================
 * Verifies:
 * 1. Provider Behavior with Mocks:
 *    - A: Successful provisioning (search -> order -> active)
 *    - B: No numbers available (clean failure, status='failed', no fake DID)
 *    - C: Provider order failure (failed state, safe error)
 *    - D: Polling / reconciliation recovery (adopts in-flight order)
 *    - E: Already active (idempotent, no second order)
 *    - F: Already provisioning (rejects concurrent second order)
 * 2. Security Tests:
 *    - Unauthenticated -> 401
 *    - Normal owner -> 403
 *    - Organization member -> 403
 *    - Super Admin -> 200 allowed
 *    - Tenant targeting & prohibition of client body manipulation
 *    - Malformed input validation (invalid area codes rejected with 400)
 *    - Non-existent organization returns 404
 *    - Churned organization returns 400
 * 3. Concurrency Tests:
 *    - 2 simultaneous requests -> exactly 1 Telnyx order placed
 *    - 5 simultaneous requests -> exactly 1 Telnyx order placed
 * 4. Audit Logging:
 *    - Structured event recorded with actor ID, org ID, action, area code, result
 *    - Secrets/tokens redacted
 * 5. Repository Integrity:
 *    - No synthetic numbers (+1999, +15555550100, Math.random) generated
 * ==============================================================================
 */

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { POST } from '../src/app/api/admin/organizations/[id]/provision-phone/route.ts';
import { TelnyxApiClient } from '../src/lib/telephony/telnyx-api-client.ts';

/**
 * Creates an in-memory mock database harness matching Supabase PostgREST client semantics
 */
function createMockSupabase(initialData = {}, currentUser = null) {
  const store = {
    organizations: initialData.organizations
      ? JSON.parse(JSON.stringify(initialData.organizations))
      : [],
    telnyx_phone_numbers: initialData.telnyx_phone_numbers
      ? JSON.parse(JSON.stringify(initialData.telnyx_phone_numbers))
      : [],
    profiles: initialData.profiles
      ? JSON.parse(JSON.stringify(initialData.profiles))
      : [],
    activity_logs: initialData.activity_logs
      ? JSON.parse(JSON.stringify(initialData.activity_logs))
      : []
  };

  return {
    _tables: store,
    auth: {
      async getUser() {
        return { data: { user: currentUser } };
      }
    },
    from(tableName) {
      if (!store[tableName]) store[tableName] = [];
      const table = store[tableName];
      let filters = [];
      let pendingUpdates = null;

      const builder = {
        select(fields = '*') {
          return builder;
        },
        eq(col, val) {
          filters.push((row) => row[col] === val);
          return builder;
        },
        neq(col, val) {
          filters.push((row) => row[col] !== val);
          return builder;
        },
        in(col, vals) {
          filters.push((row) => vals.includes(row[col]));
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        update(updates) {
          pendingUpdates = updates;
          return builder;
        },
        async maybeSingle() {
          if (pendingUpdates) {
            const matched = table.filter((r) => filters.every((f) => f(r)));
            for (const row of matched) {
              Object.assign(row, pendingUpdates);
            }
            return { data: matched[0] || null, error: null };
          }
          const filtered = table.filter((r) => filters.every((f) => f(r)));
          return { data: filtered[0] || null, error: null };
        },
        async single() {
          const res = await builder.maybeSingle();
          if (!res.data) return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
          return res;
        },
        then(resolve, reject) {
          try {
            if (pendingUpdates) {
              const matched = table.filter((r) => filters.every((f) => f(r)));
              for (const row of matched) {
                Object.assign(row, pendingUpdates);
              }
              resolve({ data: matched, error: null });
            } else {
              const filtered = table.filter((r) => filters.every((f) => f(r)));
              resolve({ data: filtered, error: null });
            }
          } catch (err) {
            reject(err);
          }
        },
        insert(payload) {
          const records = Array.isArray(payload) ? payload : [payload];
          const inserted = records.map((r) => ({
            id: r.id || `row_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            ...r
          }));
          table.push(...inserted);
          const resultRow = Array.isArray(payload) ? inserted : inserted[0];
          return {
            data: resultRow,
            error: null,
            select() {
              return {
                maybeSingle: async () => ({ data: inserted[0], error: null }),
                single: async () => ({ data: inserted[0], error: null })
              };
            },
            then(resolve) {
              resolve({ data: resultRow, error: null });
            }
          };
        },
        upsert(record, opts = {}) {
          const onConflict = opts.onConflict || 'id';
          const conflictCol = onConflict.split(',')[0].trim();
          const existingIdx = table.findIndex((r) => r[conflictCol] === record[conflictCol]);
          let target;
          if (existingIdx >= 0) {
            Object.assign(table[existingIdx], record);
            target = table[existingIdx];
          } else {
            const newRow = { id: record.id || `row_${Date.now()}`, ...record };
            table.push(newRow);
            target = newRow;
          }
          return {
            data: target,
            error: null,
            select() {
              return {
                maybeSingle: async () => ({ data: target, error: null }),
                single: async () => ({ data: target, error: null })
              };
            },
            then(resolve) {
              resolve({ data: target, error: null });
            }
          };
        }
      };

      return builder;
    }
  };
}

/**
 * Creates a mock Telnyx API client for deterministic behavior without external calls
 */
function createMockTelnyxClient(opts = {}) {
  let orderCount = 0;
  const searchAvailableNumbers = opts.searchAvailableNumbers || (async () => {
    await new Promise((r) => setTimeout(r, 15));
    return [
      {
        phoneNumber: opts.mockNumber || '+12145550199',
        recordType: 'available_phone_number',
        features: ['sms', 'voice'],
        locality: 'Dallas',
        region: 'TX'
      }
    ];
  });

  const createNumberOrder = opts.createNumberOrder || (async (params) => {
    orderCount++;
    if (opts.shouldOrderFail) {
      throw new Error('Carrier rejected order submission');
    }
    return {
      orderId: opts.mockOrderId || `order_test_${orderCount}`,
      status: opts.orderStatus || 'success',
      customerReference: params.customerReference,
      phoneNumbers: [
        {
          id: `num_id_${orderCount}`,
          phoneNumber: params.phoneNumber,
          status: opts.orderStatus || 'success'
        }
      ],
      createdAt: new Date().toISOString()
    };
  });

  const getNumberOrder = opts.getNumberOrder || (async (orderId) => ({
    orderId,
    status: opts.orderStatus || 'success',
    phoneNumbers: [{ id: 'num_rec_1', phoneNumber: opts.mockNumber || '+12145550199', status: 'success' }],
    createdAt: new Date().toISOString()
  }));

  const findExistingNumberOrderByCustomerReference = opts.findExistingNumberOrderByCustomerReference || (async () => null);

  const pollNumberOrderUntilSettled = opts.pollNumberOrderUntilSettled || (async (orderId) => ({
    orderId,
    status: opts.orderStatus || 'success',
    phoneNumbers: [{ id: 'num_polled_1', phoneNumber: opts.mockNumber || '+12145550199', status: 'success' }],
    createdAt: new Date().toISOString()
  }));

  return {
    getOrderCount: () => orderCount,
    searchAvailableNumbers,
    createNumberOrder,
    getNumberOrder,
    findExistingNumberOrderByCustomerReference,
    pollNumberOrderUntilSettled
  };
}

const SUPER_ADMIN_USER = {
  id: 'usr_super_admin',
  email: 'admin@captodesk.com'
};

const OWNER_USER = {
  id: 'usr_owner_1',
  email: 'owner@acme.com'
};

const MEMBER_USER = {
  id: 'usr_member_1',
  email: 'worker@acme.com'
};

function setupTestEnvironment() {
  process.env.NODE_ENV = 'test';
  process.env.APP_ENV = 'test';
  process.env.SUPER_ADMIN_EMAILS = 'admin@captodesk.com';
  process.env.TELNYX_API_KEY = 'KEY01_MOCK_TEST_KEY';
}

setupTestEnvironment();

// ==============================================================================
// 1. PROVIDER BEHAVIOR TESTS (SECTION 9)
// ==============================================================================

test('A. Successful provisioning: search -> order -> active in database', async () => {
  const orgId = 'org_success_1';
  const mockClient = createMockTelnyxClient({
    mockNumber: '+12145550188',
    orderStatus: 'success'
  });

  const supabase = createMockSupabase({
    organizations: [
      { id: orgId, name: 'Acme Plumbing', slug: 'acme-plumbing', phone_provisioning_status: 'pending_number' }
    ],
    profiles: [
      { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin', org_id: orgId }
    ]
  }, SUPER_ADMIN_USER);

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ areaCode: '214' })
  });

  const res = await POST(req, { params: Promise.resolve({ id: orgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.status, 'active');
  assert.strictEqual(data.phoneNumber, '+12145550188');

  // Verify database record
  const orgRow = supabase._tables.organizations.find((o) => o.id === orgId);
  assert.strictEqual(orgRow.phone_provisioning_status, 'active');
  assert.strictEqual(orgRow.telnyx_phone_number, '+12145550188');

  const phoneRow = supabase._tables.telnyx_phone_numbers.find((p) => p.org_id === orgId);
  assert.ok(phoneRow);
  assert.strictEqual(phoneRow.phone_number, '+12145550188');
  assert.strictEqual(phoneRow.status, 'active');
  assert.strictEqual(phoneRow.verification_status, 'verified');
});

test('B. No numbers available: clean failure, status=failed, no fake DID', async () => {
  const orgId = 'org_no_numbers_1';
  const mockClient = createMockTelnyxClient({
    searchAvailableNumbers: async () => [] // Empty search
  });

  const supabase = createMockSupabase({
    organizations: [
      { id: orgId, name: 'Dry Well Co', slug: 'dry-well', phone_provisioning_status: 'pending_number' }
    ],
    profiles: [
      { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin', org_id: orgId }
    ]
  }, SUPER_ADMIN_USER);

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ areaCode: '999' })
  });

  const res = await POST(req, { params: Promise.resolve({ id: orgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  });

  assert.strictEqual(res.status, 422);
  const data = await res.json();
  assert.strictEqual(data.success, false);
  assert.strictEqual(data.status, 'failed');
  assert.match(data.error, /No available Telnyx phone numbers/);

  // Assert NO synthetic phone number written
  const orgRow = supabase._tables.organizations.find((o) => o.id === orgId);
  assert.strictEqual(orgRow.phone_provisioning_status, 'failed');
  assert.strictEqual(Boolean(orgRow.telnyx_phone_number), false);
  assert.strictEqual(supabase._tables.telnyx_phone_numbers.length, 0);
});

test('C. Provider order failure: failed state and safe error', async () => {
  const orgId = 'org_order_err_1';
  const mockClient = createMockTelnyxClient({
    shouldOrderFail: true
  });

  const supabase = createMockSupabase({
    organizations: [
      { id: orgId, name: 'Faulty Wire Electrical', slug: 'faulty-wire', phone_provisioning_status: 'pending_number' }
    ],
    profiles: [
      { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin', org_id: orgId }
    ]
  }, SUPER_ADMIN_USER);

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  });

  const res = await POST(req, { params: Promise.resolve({ id: orgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  });

  assert.strictEqual(res.status, 422);
  const data = await res.json();
  assert.strictEqual(data.success, false);
  assert.strictEqual(data.status, 'failed');
  assert.match(data.error, /Carrier rejected order submission/);

  const orgRow = supabase._tables.organizations.find((o) => o.id === orgId);
  assert.strictEqual(orgRow.phone_provisioning_status, 'failed');
  assert.strictEqual(Boolean(orgRow.telnyx_phone_number), false);
});

test('D. Polling/reconciliation recovery: adopts existing provider order', async () => {
  const orgId = 'org_reconcile_1';
  const existingOrderId = 'ord_existing_in_flight_123';
  const reconciledNumber = '+15125550133';

  const mockClient = createMockTelnyxClient({
    mockNumber: reconciledNumber,
    getNumberOrder: async (orderId) => {
      assert.strictEqual(orderId, existingOrderId);
      return {
        orderId,
        status: 'success',
        phoneNumbers: [{ id: 'num_reconciled', phoneNumber: reconciledNumber, status: 'success' }]
      };
    }
  });

  const supabase = createMockSupabase({
    organizations: [
      {
        id: orgId,
        name: 'Reconciled HVAC',
        slug: 'reconciled-hvac',
        phone_provisioning_status: 'provisioning',
        telnyx_order_id: existingOrderId
      }
    ],
    profiles: [
      { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin', org_id: orgId }
    ]
  }, SUPER_ADMIN_USER);

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  });

  const res = await POST(req, { params: Promise.resolve({ id: orgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.status, 'active');
  assert.strictEqual(data.phoneNumber, reconciledNumber);
  assert.strictEqual(mockClient.getOrderCount(), 0); // Proves NO duplicate order was placed!
});

test('E. Already active: returns existing active DID without placing second order', async () => {
  const orgId = 'org_already_active_1';
  const existingActiveDID = '+12145550999';

  const mockClient = createMockTelnyxClient();

  const supabase = createMockSupabase({
    organizations: [
      {
        id: orgId,
        name: 'Already Active Lawn',
        slug: 'active-lawn',
        telnyx_phone_number: existingActiveDID,
        phone_provisioning_status: 'active'
      }
    ],
    telnyx_phone_numbers: [
      {
        id: 'phone_rec_active',
        org_id: orgId,
        phone_number: existingActiveDID,
        status: 'active',
        verification_status: 'verified'
      }
    ],
    profiles: [
      { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin', org_id: orgId }
    ]
  }, SUPER_ADMIN_USER);

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  });

  const res = await POST(req, { params: Promise.resolve({ id: orgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.status, 'already_assigned');
  assert.strictEqual(data.phoneNumber, existingActiveDID);
  assert.strictEqual(mockClient.getOrderCount(), 0); // ZERO new orders!
});

test('F. Already provisioning: returns in-progress status without duplicate order', async () => {
  const orgId = 'org_already_provisioning_1';
  const mockClient = createMockTelnyxClient();

  const supabase = createMockSupabase({
    organizations: [
      {
        id: orgId,
        name: 'In-Flight Garage',
        slug: 'inflight-garage',
        phone_provisioning_status: 'provisioning',
        telnyx_order_id: null
      }
    ],
    profiles: [
      { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin', org_id: orgId }
    ]
  }, SUPER_ADMIN_USER);

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  });

  const res = await POST(req, { params: Promise.resolve({ id: orgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  });

  // Returns 409 conflict or provisioning status
  assert.strictEqual(res.status, 409);
  const data = await res.json();
  assert.strictEqual(data.status, 'provisioning');
  assert.strictEqual(data.success, false);
  assert.strictEqual(mockClient.getOrderCount(), 0);
});

// ==============================================================================
// 2. SECURITY & AUTHORIZATION TESTS (SECTION 10)
// ==============================================================================

test('Security 1: Unauthenticated request is denied with 401', async () => {
  const orgId = 'org_sec_anon';
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Anon Org' }],
    profiles: []
  }, null); // null user

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  });

  const res = await POST(req, { params: Promise.resolve({ id: orgId }) }, {
    customSupabase: supabase
  });

  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /Unauthorized/);
});

test('Security 2: Normal owner role is denied with 403', async () => {
  const orgId = 'org_sec_owner';
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Owner Org' }],
    profiles: [
      { id: OWNER_USER.id, email: OWNER_USER.email, role: 'owner', org_id: orgId }
    ]
  }, OWNER_USER);

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  });

  const res = await POST(req, { params: Promise.resolve({ id: orgId }) }, {
    customSupabase: supabase
  });

  assert.strictEqual(res.status, 403);
  const data = await res.json();
  assert.match(data.error, /Forbidden/);
});

test('Security 3: Organization member role is denied with 403', async () => {
  const orgId = 'org_sec_member';
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Member Org' }],
    profiles: [
      { id: MEMBER_USER.id, email: MEMBER_USER.email, role: 'member', org_id: orgId }
    ]
  }, MEMBER_USER);

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  });

  const res = await POST(req, { params: Promise.resolve({ id: orgId }) }, {
    customSupabase: supabase
  });

  assert.strictEqual(res.status, 403);
  const data = await res.json();
  assert.match(data.error, /Forbidden/);
});

test('Security 4: Super Admin role is allowed with 200', async () => {
  const orgId = 'org_sec_super';
  const mockClient = createMockTelnyxClient();

  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Super Admin Target Org', phone_provisioning_status: 'pending_number' }],
    profiles: [
      { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin', org_id: orgId }
    ]
  }, SUPER_ADMIN_USER);

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  });

  const res = await POST(req, { params: Promise.resolve({ id: orgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.status, 'active');
});

test('Security 5: Request body cannot tamper with target orgId or provider status', async () => {
  const targetOrgId = 'org_legit_target';
  const maliciousOrgId = 'org_victim_tamper';

  const supabase = createMockSupabase({
    organizations: [
      { id: targetOrgId, name: 'Target Org', phone_provisioning_status: 'pending_number' },
      { id: maliciousOrgId, name: 'Victim Org', phone_provisioning_status: 'pending_number' }
    ],
    profiles: [
      { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin', org_id: targetOrgId }
    ]
  }, SUPER_ADMIN_USER);

  // Attempt to pass malicious orgId in body
  const req = new Request(`http://localhost:3000/api/admin/organizations/${targetOrgId}/provision-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId: maliciousOrgId })
  });

  const res = await POST(req, { params: Promise.resolve({ id: targetOrgId }) }, {
    customSupabase: supabase
  });

  assert.strictEqual(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /Prohibited parameter 'orgId'/);
});

test('Security 6: Malformed or invalid area codes are rejected with 400', async () => {
  const orgId = 'org_val_1';
  const supabase = createMockSupabase({
    organizations: [{ id: orgId, name: 'Val Org', phone_provisioning_status: 'pending_number' }],
    profiles: [
      { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin', org_id: orgId }
    ]
  }, SUPER_ADMIN_USER);

  const invalidCodes = ['12', '123', 'abcd', '9999', '012', '199'];
  for (const code of invalidCodes) {
    const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaCode: code })
    });

    const res = await POST(req, { params: Promise.resolve({ id: orgId }) }, {
      customSupabase: supabase
    });

    assert.strictEqual(res.status, 400, `Expected 400 for code: ${code}`);
    const data = await res.json();
    assert.match(data.error, /Invalid area code/);
  }
});

test('Security 7: Non-existent organization returns 404', async () => {
  const orgId = 'org_non_existent';
  const supabase = createMockSupabase({
    organizations: [],
    profiles: [
      { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin', org_id: 'some_org' }
    ]
  }, SUPER_ADMIN_USER);

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  });

  const res = await POST(req, { params: Promise.resolve({ id: orgId }) }, {
    customSupabase: supabase
  });

  assert.strictEqual(res.status, 404);
  const data = await res.json();
  assert.match(data.error, /Organization not found/);
});

test('Security 8: Churned organization is ineligible for provisioning (400)', async () => {
  const orgId = 'org_churned_1';
  const supabase = createMockSupabase({
    organizations: [
      { id: orgId, name: 'Dead Tenant', subscription_status: 'churned' }
    ],
    profiles: [
      { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin', org_id: orgId }
    ]
  }, SUPER_ADMIN_USER);

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST'
  });

  const res = await POST(req, { params: Promise.resolve({ id: orgId }) }, {
    customSupabase: supabase
  });

  assert.strictEqual(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /churned and not eligible/);
});

// ==============================================================================
// 3. CONCURRENCY TESTS (SECTION 11)
// ==============================================================================

test('Concurrency 1: Two simultaneous requests result in exactly ONE Telnyx order', async () => {
  const orgId = 'org_concurrent_2';
  const mockClient = createMockTelnyxClient();

  const supabase = createMockSupabase({
    organizations: [
      { id: orgId, name: 'Double Tap Roofing', phone_provisioning_status: 'pending_number' }
    ],
    profiles: [
      { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin', org_id: orgId }
    ]
  }, SUPER_ADMIN_USER);

  const createReq = () => new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ areaCode: '214' })
  });

  // Fire 2 concurrent requests
  const [res1, res2] = await Promise.all([
    POST(createReq(), { params: Promise.resolve({ id: orgId }) }, { apiClient: mockClient, customSupabase: supabase }),
    POST(createReq(), { params: Promise.resolve({ id: orgId }) }, { apiClient: mockClient, customSupabase: supabase })
  ]);

  // Prove exactly ONE Telnyx order was submitted
  assert.strictEqual(mockClient.getOrderCount(), 1, 'Exactly one order must be placed on Telnyx');

  // Both should terminate with safe status
  const statuses = [res1.status, res2.status];
  assert.ok(statuses.includes(200), 'At least one request succeeded with 200');
});

test('Concurrency 2: Five simultaneous requests result in exactly ONE Telnyx order', async () => {
  const orgId = 'org_concurrent_5';
  const mockClient = createMockTelnyxClient();

  const supabase = createMockSupabase({
    organizations: [
      { id: orgId, name: 'Thundering Herd Plumbing', phone_provisioning_status: 'pending_number' }
    ],
    profiles: [
      { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin', org_id: orgId }
    ]
  }, SUPER_ADMIN_USER);

  const createReq = () => new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ areaCode: '512' })
  });

  // Fire 5 simultaneous requests
  const requests = Array.from({ length: 5 }, () =>
    POST(createReq(), { params: Promise.resolve({ id: orgId }) }, { apiClient: mockClient, customSupabase: supabase })
  );

  const responses = await Promise.all(requests);

  // INVARIANT: Exactly 1 order created on Telnyx
  assert.strictEqual(mockClient.getOrderCount(), 1, 'Only one order must be placed on Telnyx across 5 concurrent requests');

  const statusCodes = responses.map((r) => r.status);
  assert.ok(statusCodes.includes(200), 'One request acquired the lock and completed');
});

// ==============================================================================
// 4. AUDIT LOGGING TESTS (SECTION 8)
// ==============================================================================

test('Audit Logging: Operation records structured audit log without leaking credentials', async () => {
  const orgId = 'org_audit_log_1';
  const mockClient = createMockTelnyxClient();

  const supabase = createMockSupabase({
    organizations: [
      { id: orgId, name: 'Audit Test Corp', phone_provisioning_status: 'pending_number' }
    ],
    profiles: [
      { id: SUPER_ADMIN_USER.id, email: SUPER_ADMIN_USER.email, role: 'super_admin', org_id: orgId }
    ]
  }, SUPER_ADMIN_USER);

  const req = new Request(`http://localhost:3000/api/admin/organizations/${orgId}/provision-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ areaCode: '415' })
  });

  await POST(req, { params: Promise.resolve({ id: orgId }) }, {
    apiClient: mockClient,
    customSupabase: supabase
  });

  const logs = supabase._tables.activity_logs;
  assert.ok(logs.length >= 1, 'Audit log event must be inserted');

  const log = logs[0];
  assert.strictEqual(log.event_type, 'admin.action_performed');
  assert.strictEqual(log.metadata.admin_user_id, SUPER_ADMIN_USER.id);
  assert.strictEqual(log.metadata.target_org_id, orgId);
  assert.strictEqual(log.metadata.requested_area_code, '415');
  assert.strictEqual(log.metadata.provisioning_result, 'active');

  // Verify NO sensitive tokens or credentials in log
  const logStr = JSON.stringify(log);
  assert.strictEqual(logStr.includes(process.env.TELNYX_API_KEY), false, 'API key must never be logged');
  assert.strictEqual(logStr.includes('Bearer'), false, 'Auth token must never be logged');
});

// ==============================================================================
// 5. REPOSITORY SCAN & SYNTHETIC NUMBER ELIMINATION (SECTION 15)
// ==============================================================================

test('Static & Runtime: Zero synthetic +1999 or +15555550100 numbers in provisioning flow', () => {
  const routeFile = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/admin/organizations/[id]/provision-phone/route.ts'),
    'utf-8'
  );

  assert.strictEqual(routeFile.includes('+1999'), false, 'Route must never contain +1999');
  assert.strictEqual(routeFile.includes('+15555550100'), false, 'Route must never contain +15555550100');
  assert.strictEqual(routeFile.includes('Math.random'), false, 'Route must never fabricate numbers with Math.random');
});
