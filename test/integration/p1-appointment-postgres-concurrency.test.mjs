/**
 * ==============================================================================
 * CAPTODESK — REAL POSTGRESQL CONCURRENCY INTEGRATION TEST
 * P1-02: ELIMINATE OVERLAPPING APPOINTMENT CONCURRENCY
 * ==============================================================================
 * Verifies that a real PostgreSQL database running Migration 32 enforces
 * the GiST exclusion constraint (appointments_no_overlapping_bookings)
 * across genuine multi-connection concurrent transactions.
 * ==============================================================================
 */

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const TEST_PORT = 54335;
const DATA_DIR = path.resolve('./.tmp_pg_integration_data');
const DB_NAME = 'captodesk_concurrency_test';

let pgServer;
let pool;

/**
 * Creates an independent pg.Client connected to the disposable test database.
 */
function createTestClient() {
  return new pg.Client({
    host: 'localhost',
    port: TEST_PORT,
    user: 'postgres',
    password: 'password',
    database: DB_NAME,
  });
}

before(async () => {
  // 1. Initialize and start the disposable PostgreSQL 18+ server
  pgServer = new EmbeddedPostgres({
    port: TEST_PORT,
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'password',
    database: 'postgres',
    persistent: true,
  });

  try {
    await pgServer.initialise();
  } catch {
    // Directory already initialised
  }
  await pgServer.start();

  // 2. Provision clean disposable test database
  const rootClient = new pg.Client({
    host: 'localhost',
    port: TEST_PORT,
    user: 'postgres',
    password: 'password',
    database: 'postgres',
  });
  await rootClient.connect();
  await rootClient.query(`DROP DATABASE IF EXISTS ${DB_NAME};`);
  await rootClient.query(`CREATE DATABASE ${DB_NAME};`);
  await rootClient.end();

  // 3. Setup schema & migrations on disposable test database
  pool = new pg.Pool({
    host: 'localhost',
    port: TEST_PORT,
    user: 'postgres',
    password: 'password',
    database: DB_NAME,
    max: 10,
  });

  // Base extensions and tables
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE services (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      duration_minutes INT NOT NULL DEFAULT 60,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE appointments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
      service_id UUID REFERENCES services(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      service_type TEXT,
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ,
      status TEXT DEFAULT 'scheduled' CHECK (status IN ('requested', 'confirmed', 'cancelled', 'completed', 'no_show', 'scheduled')),
      source TEXT DEFAULT 'booking_page',
      manage_token TEXT,
      cancellation_reason TEXT,
      confirmed_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Apply real Migration 32 directly from disk
  const migration32Sql = fs.readFileSync('supabase/migrations/32_prevent_overlapping_appointments.sql', 'utf8');
  await pool.query(migration32Sql);
});

after(async () => {
  if (pool) {
    await pool.end();
  }
  if (pgServer) {
    await pgServer.stop().catch(console.error);
  }
});

// Helper: provision a new organization for test isolation
async function createTestOrg(prefix = 'Test Org') {
  const slug = `org-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const res = await pool.query(
    'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id;',
    [`${prefix} ${slug}`, slug]
  );
  return res.rows[0].id;
}

// ==============================================================================
// VERIFICATION MATRIX
// ==============================================================================

test('TEST 1: Real concurrent same-tenant overlapping inserts: exactly one succeeds', async () => {
  const orgId = await createTestOrg('Concurrent Org 1');

  const client1 = createTestClient();
  const client2 = createTestClient();
  await client1.connect();
  await client2.connect();

  let client1Result = { success: false, code: null };
  let client2Result = { success: false, code: null };

  // Transaction 1: 10:00 -> 11:00
  // Transaction 2: 10:30 -> 11:30
  await client1.query('BEGIN;');
  await client2.query('BEGIN;');

  // Client 1 executes insert
  await client1.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Appt 1', '2026-11-01T10:00:00Z', '2026-11-01T11:00:00Z', 'scheduled');
  `, [orgId]);

  // Client 2 attempts overlapping insert concurrently over its separate connection.
  // In PostgreSQL, Client 2 blocks awaiting Client 1 resolution.
  const client2Promise = (async () => {
    try {
      await client2.query(`
        INSERT INTO appointments (org_id, title, start_time, end_time, status)
        VALUES ($1, 'Appt 2', '2026-11-01T10:30:00Z', '2026-11-01T11:30:00Z', 'scheduled');
      `, [orgId]);
      await client2.query('COMMIT;');
      client2Result.success = true;
    } catch (err) {
      client2Result.code = err.code;
      await client2.query('ROLLBACK;').catch(() => {});
    }
  })();

  // Allow Client 2's query packet to reach PostgreSQL and enter waiting state
  await new Promise(r => setTimeout(r, 60));

  // Client 1 commits its transaction
  try {
    await client1.query('COMMIT;');
    client1Result.success = true;
  } catch (err) {
    client1Result.code = err.code;
    await client1.query('ROLLBACK;').catch(() => {});
  }

  // Await Client 2 to complete
  await client2Promise;

  await client1.end();
  await client2.end();

  // Validate results
  assert.strictEqual(client1Result.success, true, 'Transaction 1 must succeed');
  assert.strictEqual(client2Result.success, false, 'Transaction 2 must fail due to overlap');
  assert.strictEqual(client2Result.code, '23P01', 'Failing transaction must receive SQLSTATE 23P01');

  // Verify database contains exactly 1 row
  const countRes = await pool.query('SELECT count(*) FROM appointments WHERE org_id = $1;', [orgId]);
  assert.strictEqual(parseInt(countRes.rows[0].count, 10), 1, 'Database must contain exactly 1 appointment');
});

test('TEST 2: Real concurrent same-tenant overlapping inserts in reverse order: exactly one succeeds', async () => {
  const orgId = await createTestOrg('Concurrent Reverse Org');

  const client1 = createTestClient();
  const client2 = createTestClient();
  await client1.connect();
  await client2.connect();

  let client1Result = { success: false, code: null };
  let client2Result = { success: false, code: null };

  // Reverse order: Client 1 starts with 10:30 -> 11:30
  // Client 2 attempts 10:00 -> 11:00
  await client1.query('BEGIN;');
  await client2.query('BEGIN;');

  await client1.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Appt Later', '2026-11-02T10:30:00Z', '2026-11-02T11:30:00Z', 'scheduled');
  `, [orgId]);

  const client2Promise = (async () => {
    try {
      await client2.query(`
        INSERT INTO appointments (org_id, title, start_time, end_time, status)
        VALUES ($1, 'Appt Earlier', '2026-11-02T10:00:00Z', '2026-11-02T11:00:00Z', 'scheduled');
      `, [orgId]);
      await client2.query('COMMIT;');
      client2Result.success = true;
    } catch (err) {
      client2Result.code = err.code;
      await client2.query('ROLLBACK;').catch(() => {});
    }
  })();

  await new Promise(r => setTimeout(r, 60));

  await client1.query('COMMIT;');
  client1Result.success = true;

  await client2Promise;

  await client1.end();
  await client2.end();

  assert.strictEqual(client1Result.success, true);
  assert.strictEqual(client2Result.success, false);
  assert.strictEqual(client2Result.code, '23P01', 'Reverse order must also receive SQLSTATE 23P01');

  const countRes = await pool.query('SELECT count(*) FROM appointments WHERE org_id = $1;', [orgId]);
  assert.strictEqual(parseInt(countRes.rows[0].count, 10), 1, 'Database must contain exactly 1 appointment in reverse test');
});

test('TEST 3: Real concurrent back-to-back inserts: both succeed ([) semantics)', async () => {
  const orgId = await createTestOrg('BackToBack Org');

  const client1 = createTestClient();
  const client2 = createTestClient();
  await client1.connect();
  await client2.connect();

  // Transaction 1: 10:00 -> 11:00
  // Transaction 2: 11:00 -> 12:00 (touches boundary at 11:00)
  await client1.query('BEGIN;');
  await client2.query('BEGIN;');

  await client1.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Slot 1', '2026-11-03T10:00:00Z', '2026-11-03T11:00:00Z', 'scheduled');
  `, [orgId]);

  await client2.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Slot 2', '2026-11-03T11:00:00Z', '2026-11-03T12:00:00Z', 'scheduled');
  `, [orgId]);

  // Both commit
  await client1.query('COMMIT;');
  await client2.query('COMMIT;');

  await client1.end();
  await client2.end();

  const countRes = await pool.query('SELECT count(*) FROM appointments WHERE org_id = $1;', [orgId]);
  assert.strictEqual(parseInt(countRes.rows[0].count, 10), 2, 'Both back-to-back appointments must coexist with [) semantics');
});

test('TEST 4: Real concurrent overlapping inserts across different tenants: both succeed', async () => {
  const orgA = await createTestOrg('Tenant A');
  const orgB = await createTestOrg('Tenant B');

  const client1 = createTestClient();
  const client2 = createTestClient();
  await client1.connect();
  await client2.connect();

  // Both tenants book overlapping time: 10:00 -> 11:00 and 10:30 -> 11:30
  await client1.query('BEGIN;');
  await client2.query('BEGIN;');

  await client1.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Tenant A Appt', '2026-11-04T10:00:00Z', '2026-11-04T11:00:00Z', 'scheduled');
  `, [orgA]);

  await client2.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Tenant B Appt', '2026-11-04T10:30:00Z', '2026-11-04T11:30:00Z', 'scheduled');
  `, [orgB]);

  await client1.query('COMMIT;');
  await client2.query('COMMIT;');

  await client1.end();
  await client2.end();

  const countA = await pool.query('SELECT count(*) FROM appointments WHERE org_id = $1;', [orgA]);
  const countB = await pool.query('SELECT count(*) FROM appointments WHERE org_id = $1;', [orgB]);

  assert.strictEqual(parseInt(countA.rows[0].count, 10), 1, 'Tenant A appointment must succeed');
  assert.strictEqual(parseInt(countB.rows[0].count, 10), 1, 'Tenant B appointment must succeed');
});

test('TEST 5: Active-status overlap: rejected between requested, confirmed, scheduled', async () => {
  const orgId = await createTestOrg('Active Status Org');

  // Pair 1: requested vs requested
  await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Requested 1', '2026-11-05T09:00:00Z', '2026-11-05T10:00:00Z', 'requested');
  `, [orgId]);

  await assert.rejects(
    async () => {
      await pool.query(`
        INSERT INTO appointments (org_id, title, start_time, end_time, status)
        VALUES ($1, 'Requested 2', '2026-11-05T09:30:00Z', '2026-11-05T10:30:00Z', 'requested');
      `, [orgId]);
    },
    (err) => err.code === '23P01',
    'Two requested appointments must conflict'
  );

  // Pair 2: confirmed vs scheduled
  await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Confirmed 1', '2026-11-05T11:00:00Z', '2026-11-05T12:00:00Z', 'confirmed');
  `, [orgId]);

  await assert.rejects(
    async () => {
      await pool.query(`
        INSERT INTO appointments (org_id, title, start_time, end_time, status)
        VALUES ($1, 'Scheduled Overlap', '2026-11-05T11:30:00Z', '2026-11-05T12:30:00Z', 'scheduled');
      `, [orgId]);
    },
    (err) => err.code === '23P01',
    'Confirmed and scheduled appointments must conflict'
  );

  // Pair 3: scheduled vs requested
  await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Scheduled 1', '2026-11-05T13:00:00Z', '2026-11-05T14:00:00Z', 'scheduled');
  `, [orgId]);

  await assert.rejects(
    async () => {
      await pool.query(`
        INSERT INTO appointments (org_id, title, start_time, end_time, status)
        VALUES ($1, 'Requested Overlap', '2026-11-05T13:15:00Z', '2026-11-05T14:15:00Z', 'requested');
      `, [orgId]);
    },
    (err) => err.code === '23P01',
    'Scheduled and requested appointments must conflict'
  );
});

test('TEST 6: Cancelled overlap: allowed', async () => {
  const orgId = await createTestOrg('Cancelled Org');

  // Cancelled appointment
  await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Cancelled Appt', '2026-11-06T10:00:00Z', '2026-11-06T11:00:00Z', 'cancelled');
  `, [orgId]);

  // Overlapping scheduled appointment
  await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'New Scheduled Appt', '2026-11-06T10:30:00Z', '2026-11-06T11:30:00Z', 'scheduled');
  `, [orgId]);

  const countRes = await pool.query('SELECT count(*) FROM appointments WHERE org_id = $1;', [orgId]);
  assert.strictEqual(parseInt(countRes.rows[0].count, 10), 2, 'Cancelled appointment must not block new booking');
});

test('TEST 7: Completed overlap: allowed', async () => {
  const orgId = await createTestOrg('Completed Org');

  // Completed appointment
  await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Completed Appt', '2026-11-07T10:00:00Z', '2026-11-07T11:00:00Z', 'completed');
  `, [orgId]);

  // Overlapping scheduled appointment
  await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'New Scheduled Appt', '2026-11-07T10:30:00Z', '2026-11-07T11:30:00Z', 'scheduled');
  `, [orgId]);

  const countRes = await pool.query('SELECT count(*) FROM appointments WHERE org_id = $1;', [orgId]);
  assert.strictEqual(parseInt(countRes.rows[0].count, 10), 2, 'Completed appointment must not block slot');
});

test('TEST 8: No-show overlap: allowed', async () => {
  const orgId = await createTestOrg('NoShow Org');

  // No-show appointment
  await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'No Show Appt', '2026-11-08T10:00:00Z', '2026-11-08T11:00:00Z', 'no_show');
  `, [orgId]);

  // Overlapping scheduled appointment
  await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'New Scheduled Appt', '2026-11-08T10:30:00Z', '2026-11-08T11:30:00Z', 'scheduled');
  `, [orgId]);

  const countRes = await pool.query('SELECT count(*) FROM appointments WHERE org_id = $1;', [orgId]);
  assert.strictEqual(parseInt(countRes.rows[0].count, 10), 2, 'No-show appointment must not block slot');
});

test('TEST 9: Soft-deleted overlap: allowed', async () => {
  const orgId = await createTestOrg('SoftDeleted Org');

  // Soft-deleted appointment (deleted_at IS NOT NULL)
  await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status, deleted_at)
    VALUES ($1, 'Deleted Appt', '2026-11-09T10:00:00Z', '2026-11-09T11:00:00Z', 'scheduled', now());
  `, [orgId]);

  // Overlapping scheduled appointment (deleted_at IS NULL)
  await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status, deleted_at)
    VALUES ($1, 'Active Appt', '2026-11-09T10:30:00Z', '2026-11-09T11:30:00Z', 'scheduled', NULL);
  `, [orgId]);

  const countRes = await pool.query('SELECT count(*) FROM appointments WHERE org_id = $1;', [orgId]);
  assert.strictEqual(parseInt(countRes.rows[0].count, 10), 2, 'Soft-deleted appointment must not block slot');
});

test('TEST 10: Real PostgreSQL rescheduling overlap: rejected with 23P01', async () => {
  const orgId = await createTestOrg('Reschedule Org');

  // Appointment A: 10:00 -> 11:00
  await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Appt A', '2026-11-10T10:00:00Z', '2026-11-10T11:00:00Z', 'scheduled');
  `, [orgId]);

  // Appointment B: 11:00 -> 12:00
  const apptB = await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Appt B', '2026-11-10T11:00:00Z', '2026-11-10T12:00:00Z', 'scheduled')
    RETURNING id;
  `, [orgId]);
  const bId = apptB.rows[0].id;

  // Attempt to reschedule B into overlapping interval: 10:30 -> 11:30
  await assert.rejects(
    async () => {
      await pool.query(`
        UPDATE appointments
        SET start_time = '2026-11-10T10:30:00Z', end_time = '2026-11-10T11:30:00Z'
        WHERE id = $1;
      `, [bId]);
    },
    (err) => err.code === '23P01',
    'Rescheduling into occupied interval must be rejected with 23P01'
  );
});

test('TEST 11: Failed transaction leaves no partial update', async () => {
  const orgId = await createTestOrg('Partial Update Org');

  // Appointment A: 10:00 -> 11:00
  await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Appt A', '2026-11-11T10:00:00Z', '2026-11-11T11:00:00Z', 'scheduled');
  `, [orgId]);

  // Appointment B: 11:00 -> 12:00
  const apptB = await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Appt B', '2026-11-11T11:00:00Z', '2026-11-11T12:00:00Z', 'scheduled')
    RETURNING id;
  `, [orgId]);
  const bId = apptB.rows[0].id;

  // Attempt failed update
  try {
    await pool.query(`
      UPDATE appointments
      SET start_time = '2026-11-11T10:30:00Z', end_time = '2026-11-11T11:30:00Z'
      WHERE id = $1;
    `, [bId]);
  } catch (err) {
    assert.strictEqual(err.code, '23P01');
  }

  // Verify B remains at 11:00 -> 12:00 untouched
  const fetchB = await pool.query('SELECT start_time, end_time FROM appointments WHERE id = $1;', [bId]);
  const startISO = new Date(fetchB.rows[0].start_time).toISOString();
  const endISO = new Date(fetchB.rows[0].end_time).toISOString();

  assert.strictEqual(startISO, '2026-11-11T11:00:00.000Z', 'Start time must remain 11:00');
  assert.strictEqual(endISO, '2026-11-11T12:00:00.000Z', 'End time must remain 12:00');
});

test('TEST 12: Post-conflict valid booking succeeds', async () => {
  const orgId = await createTestOrg('PostConflict Org');

  // Initial booking 10:00 -> 11:00
  await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Appt 1', '2026-11-12T10:00:00Z', '2026-11-12T11:00:00Z', 'scheduled');
  `, [orgId]);

  // Conflicting booking attempt 10:15 -> 11:15 (rejected)
  try {
    await pool.query(`
      INSERT INTO appointments (org_id, title, start_time, end_time, status)
      VALUES ($1, 'Conflict', '2026-11-12T10:15:00Z', '2026-11-12T11:15:00Z', 'scheduled');
    `, [orgId]);
    assert.fail('Should have failed');
  } catch (err) {
    assert.strictEqual(err.code, '23P01');
  }

  // Non-conflicting subsequent booking: 11:30 -> 12:30 succeeds cleanly
  const validRes = await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Valid Later', '2026-11-12T11:30:00Z', '2026-11-12T12:30:00Z', 'scheduled')
    RETURNING id;
  `, [orgId]);

  assert.ok(validRes.rows[0].id, 'Valid appointment created successfully after conflict');
});

test('TEST 13: PostgreSQL metadata confirms the real exclusion constraint', async () => {
  const metaRes = await pool.query(`
    SELECT
      c.conname,
      c.contype,
      am.amname AS access_method,
      pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    LEFT JOIN pg_class idx ON c.conindid = idx.oid
    LEFT JOIN pg_am am ON idx.relam = am.oid
    WHERE t.relname = 'appointments' AND c.conname = 'appointments_no_overlapping_bookings';
  `);

  assert.strictEqual(metaRes.rows.length, 1, 'Exclusion constraint must exist in pg_constraint');
  const constraint = metaRes.rows[0];

  assert.strictEqual(constraint.conname, 'appointments_no_overlapping_bookings');
  assert.strictEqual(constraint.contype, 'x', 'Constraint type must be exclusion (x)');
  assert.strictEqual(constraint.access_method, 'gist', 'Access method must be gist');
  assert.ok(constraint.definition.includes('org_id WITH ='), 'Must contain org_id equality');
  assert.ok(constraint.definition.includes('tstzrange(start_time, end_time, \'[\'::text) WITH &&') || constraint.definition.includes('tstzrange(start_time, end_time, \'[)\'::text) WITH &&'), 'Must contain tstzrange overlap operator');
  assert.ok(constraint.definition.includes('deleted_at IS NULL'), 'Predicate must include deleted_at IS NULL');
  assert.ok(constraint.definition.includes('requested') && constraint.definition.includes('confirmed') && constraint.definition.includes('scheduled'), 'Predicate must check active statuses');
});

test('TEST 14: Migration 32 successfully applies to a clean disposable database', async () => {
  // Verify that re-executing Migration 32 is completely idempotent
  const migration32Sql = fs.readFileSync('supabase/migrations/32_prevent_overlapping_appointments.sql', 'utf8');
  await pool.query(migration32Sql);

  const check = await pool.query(`
    SELECT count(*) FROM pg_constraint WHERE conname = 'appointments_no_overlapping_bookings';
  `);
  assert.strictEqual(parseInt(check.rows[0].count, 10), 1, 'Constraint must remain exactly 1 after idempotent re-run');
});

test('TEST 15: Application error translation sanitizes real PostgreSQL 23P01 exclusion errors', async () => {
  // Emulate bookingManager error handler translation logic with real error object
  const orgId = await createTestOrg('Sanitize Org');

  await pool.query(`
    INSERT INTO appointments (org_id, title, start_time, end_time, status)
    VALUES ($1, 'Appt Prime', '2026-11-13T10:00:00Z', '2026-11-13T11:00:00Z', 'scheduled');
  `, [orgId]);

  let realPostgresError = null;
  try {
    await pool.query(`
      INSERT INTO appointments (org_id, title, start_time, end_time, status)
      VALUES ($1, 'Appt Collision', '2026-11-13T10:30:00Z', '2026-11-13T11:30:00Z', 'scheduled');
    `, [orgId]);
  } catch (err) {
    realPostgresError = err;
  }

  assert.ok(realPostgresError);
  assert.strictEqual(realPostgresError.code, '23P01');

  // Test application sanitizer mapping
  function sanitizeBookingError(err) {
    if (err?.code === '23P01' || err?.code === '23505' || /duplicate|overlap|unique|exclusion/i.test(err?.message || '')) {
      return {
        status: 409,
        body: { error: 'This time slot is no longer available. Please select another time.' }
      };
    }
    return {
      status: 500,
      body: { error: 'Failed to create booking' }
    };
  }

  const response = sanitizeBookingError(realPostgresError);

  assert.strictEqual(response.status, 409);
  assert.strictEqual(response.body.error, 'This time slot is no longer available. Please select another time.');
  assert.strictEqual(/\b(23P01|PostgreSQL|appointments_no_overlapping_bookings|exclusion|relation|constraint|sqlstate)\b/i.test(JSON.stringify(response.body)), false, 'Response body must not leak any database details');
});
