/**
 * ==============================================================================
 * CAPTODESK — REAL POSTGRESQL MIGRATION 31 & HISTORICAL SERVICE DATA SAFETY TEST
 * P1-OPS-04: PREVENT HISTORICAL SERVICE DATA LOSS & NON-DESTRUCTIVE MIGRATION
 * ==============================================================================
 * Verifies against a genuine PostgreSQL 18+ instance:
 * 1. Migration 31 does NOT delete duplicate service records (0 deletes).
 * 2. Section 10 Fixture:
 *    - Org A:
 *      - Service 1: 'General Plumbing', active, no references -> safely deactivated
 *      - Service 2: 'General Plumbing', active, referenced by appointment -> preserved active
 *      - Service 3: 'General Plumbing', inactive, referenced by job -> preserved inactive
 *    - Org B:
 *      - Service 4: 'General Plumbing', active -> preserved active (tenant boundary)
 * 3. Exact service counts before (4) and after (4) migration are identical.
 * 4. Referential integrity: Foreign key references remain strictly non-NULL.
 * 5. Foreign Key RESTRICT: Deleting referenced service is rejected with 23503.
 * 6. Deleting unreferenced service succeeds.
 * 7. Active Uniqueness: Inserting duplicate active service is rejected with 23505.
 * 8. Inactive Coexistence: Inactive service with same name can be inserted without collision.
 * 9. Migration Idempotency: Re-running Migration 31 and Migration 35 succeeds cleanly.
 * ==============================================================================
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const TEST_PORT = 54336;
const DATA_DIR = path.resolve('./.tmp_pg_service_safety_data');
const DB_NAME = 'captodesk_service_safety_test';

let pgServer;
let pool;

const ORG_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ORG_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CONTACT_A_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const SVC_1_ID = '11111111-1111-1111-1111-111111111111';
const SVC_2_ID = '22222222-2222-2222-2222-222222222222';
const SVC_3_ID = '33333333-3333-3333-3333-333333333333';
const SVC_4_ID = '44444444-4444-4444-4444-444444444444';

const APT_HIST_ID = 'a1111111-1111-1111-1111-111111111111';
const JOB_HIST_ID = 'd1111111-1111-1111-1111-111111111111';

before(async () => {
  // 1. Initialize and start disposable PostgreSQL server
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

  // 3. Connect pool
  pool = new pg.Pool({
    host: 'localhost',
    port: TEST_PORT,
    user: 'postgres',
    password: 'password',
    database: DB_NAME,
    max: 5,
  });

  // 4. Create base tables matching pre-migration-31 state
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
      description TEXT,
      duration_minutes INT NOT NULL DEFAULT 60,
      price NUMERIC(10,2),
      requires_address BOOLEAN DEFAULT true,
      is_active BOOLEAN DEFAULT true,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
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
      status TEXT DEFAULT 'scheduled',
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
      service_id UUID REFERENCES services(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'in_progress',
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE quotes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // 5. Seed Section 10 Migration Fixture:
  // Org A & Org B
  await pool.query(`
    INSERT INTO organizations (id, name, slug) VALUES 
      ('${ORG_A_ID}', 'Org A Contracting', 'org-a'),
      ('${ORG_B_ID}', 'Org B Plumbing', 'org-b');

    INSERT INTO contacts (id, org_id, name) VALUES 
      ('${CONTACT_A_ID}', '${ORG_A_ID}', 'Customer John');
  `);

  // Org A:
  // Service 1: "General Plumbing", active, no references, created T1
  // Service 2: "General Plumbing", active, referenced by appointment, created T2
  // Service 3: "General Plumbing", inactive, referenced by job, created T0
  // Org B:
  // Service 4: "General Plumbing", active
  await pool.query(`
    INSERT INTO services (id, org_id, name, is_active, created_at, updated_at) VALUES
      ('${SVC_3_ID}', '${ORG_A_ID}', 'General Plumbing', false, now() - INTERVAL '10 days', now() - INTERVAL '10 days'),
      ('${SVC_1_ID}', '${ORG_A_ID}', 'General Plumbing', true, now() - INTERVAL '5 days', now() - INTERVAL '5 days'),
      ('${SVC_2_ID}', '${ORG_A_ID}', 'General Plumbing', true, now() - INTERVAL '2 days', now() - INTERVAL '2 days'),
      ('${SVC_4_ID}', '${ORG_B_ID}', 'General Plumbing', true, now() - INTERVAL '1 day', now() - INTERVAL '1 day');

    -- Historical appointment references Service 2
    INSERT INTO appointments (id, org_id, contact_id, service_id, title, start_time, end_time, status) VALUES
      ('${APT_HIST_ID}', '${ORG_A_ID}', '${CONTACT_A_ID}', '${SVC_2_ID}', 'Plumbing Repair', now() - INTERVAL '1 day', now() - INTERVAL '23 hours', 'completed');

    -- Historical job references Service 3
    INSERT INTO jobs (id, org_id, contact_id, service_id, title, status) VALUES
      ('${JOB_HIST_ID}', '${ORG_A_ID}', '${CONTACT_A_ID}', '${SVC_3_ID}', 'Past Job', 'completed');
  `);
});

after(async () => {
  if (pool) {
    await pool.end();
  }
  if (pgServer) {
    await pgServer.stop().catch(console.error);
  }
});

// ==============================================================================
// TEST CASES
// ==============================================================================

test('TEST 1: Pre-migration state confirms Section 10 fixture integrity', async () => {
  const { rows } = await pool.query(`SELECT count(*)::int as count FROM services;`);
  assert.strictEqual(rows[0].count, 4, 'Pre-migration fixture must have exactly 4 services');

  const apt = (await pool.query(`SELECT service_id FROM appointments WHERE id = '${APT_HIST_ID}'`)).rows[0];
  assert.strictEqual(apt.service_id, SVC_2_ID);

  const job = (await pool.query(`SELECT service_id FROM jobs WHERE id = '${JOB_HIST_ID}'`)).rows[0];
  assert.strictEqual(job.service_id, SVC_3_ID);
});

test('TEST 2: Execute Migration 31 on real PostgreSQL: ZERO rows deleted', async () => {
  const migration31Sql = fs.readFileSync('supabase/migrations/31_default_service_catalog_idempotency.sql', 'utf8');
  await pool.query(migration31Sql);

  const { rows } = await pool.query(`SELECT count(*)::int as count FROM services;`);
  assert.strictEqual(rows[0].count, 4, 'Migration 31 must NEVER delete services (count before = 4, count after = 4)');
});

test('TEST 3: Section 10 Fixture Reconciliation: Deterministic canonical active preservation', async () => {
  // Service 2 (has appointment reference) must remain canonical active!
  const svc2 = (await pool.query(`SELECT is_active FROM services WHERE id = '${SVC_2_ID}'`)).rows[0];
  assert.strictEqual(svc2.is_active, true, 'Service 2 with active references must remain active');

  // Service 1 (redundant active duplicate with 0 references) must be safely deactivated!
  const svc1 = (await pool.query(`SELECT is_active FROM services WHERE id = '${SVC_1_ID}'`)).rows[0];
  assert.strictEqual(svc1.is_active, false, 'Service 1 redundant duplicate must be marked is_active = false');

  // Service 3 (inactive historical service) must remain intact and inactive!
  const svc3 = (await pool.query(`SELECT is_active FROM services WHERE id = '${SVC_3_ID}'`)).rows[0];
  assert.strictEqual(svc3.is_active, false, 'Service 3 inactive historical service must remain preserved');

  // Org B Service 4 must remain untouched and active!
  const svc4 = (await pool.query(`SELECT is_active, org_id FROM services WHERE id = '${SVC_4_ID}'`)).rows[0];
  assert.strictEqual(svc4.is_active, true, 'Org B Service 4 must remain active');
  assert.strictEqual(svc4.org_id, ORG_B_ID, 'Org B service must remain strictly isolated');
});

test('TEST 4: Referential Integrity: Historical appointments and jobs retain original service UUIDs', async () => {
  const apt = (await pool.query(`SELECT service_id FROM appointments WHERE id = '${APT_HIST_ID}'`)).rows[0];
  assert.strictEqual(apt.service_id, SVC_2_ID, 'Appointment service_id must remain strictly intact');
  assert.notStrictEqual(apt.service_id, null, 'Appointment service_id must not be NULL');

  const job = (await pool.query(`SELECT service_id FROM jobs WHERE id = '${JOB_HIST_ID}'`)).rows[0];
  assert.strictEqual(job.service_id, SVC_3_ID, 'Job service_id must remain strictly intact');
  assert.notStrictEqual(job.service_id, null, 'Job service_id must not be NULL');
});

test('TEST 5: Foreign Key RESTRICT: Real PostgreSQL blocks physical deletion of referenced service', async () => {
  // Attempting to physically DELETE Service 2 (referenced by appointment) must be REJECTED by PostgreSQL!
  await assert.rejects(
    async () => {
      await pool.query(`DELETE FROM services WHERE id = '${SVC_2_ID}'`);
    },
    (err) => {
      assert.ok(['23001', '23503'].includes(err.code), `Must raise PostgreSQL 23001 or 23503, got ${err.code}`);
      assert.match(err.message, /violates .* foreign key constraint/i);
      return true;
    }
  );

  // Attempting to physically DELETE Service 3 (referenced by job) must also be REJECTED!
  await assert.rejects(
    async () => {
      await pool.query(`DELETE FROM services WHERE id = '${SVC_3_ID}'`);
    },
    (err) => {
      assert.ok(['23001', '23503'].includes(err.code), `Must raise PostgreSQL 23001 or 23503, got ${err.code}`);
      return true;
    }
  );
});

test('TEST 6: Foreign Key RESTRICT: Real PostgreSQL allows physical deletion of unreferenced service', async () => {
  // Service 1 is now inactive and has 0 references -> physical deletion is allowed by RESTRICT
  const res = await pool.query(`DELETE FROM services WHERE id = '${SVC_1_ID}'`);
  assert.strictEqual(res.rowCount, 1, 'Unreferenced service can be physically deleted if desired');
});

test('TEST 7: Active Uniqueness: Real PostgreSQL rejects inserting second active service with same name (23505)', async () => {
  // Org A already has active "General Plumbing" (Service 2).
  // Attempting to insert another active "General Plumbing" for Org A must be REJECTED by unique index!
  await assert.rejects(
    async () => {
      await pool.query(`
        INSERT INTO services (org_id, name, is_active)
        VALUES ('${ORG_A_ID}', 'general plumbing', true);
      `);
    },
    (err) => {
      assert.strictEqual(err.code, '23505', 'Must raise PostgreSQL 23505 unique_violation');
      assert.match(err.message, /uq_services_org_id_active_name/i);
      return true;
    }
  );
});

test('TEST 8: Inactive Coexistence: Real PostgreSQL allows inserting inactive service with same name', async () => {
  // Inserting an INACTIVE service with the same name for Org A is ALLOWED!
  const res = await pool.query(`
    INSERT INTO services (org_id, name, is_active)
    VALUES ('${ORG_A_ID}', 'General Plumbing', false)
    RETURNING id;
  `);
  assert.strictEqual(res.rowCount, 1, 'Inactive duplicate service must be permitted to coexist');
});

test('TEST 9: Idempotency: Re-running Migration 31 and Migration 35 succeeds with zero errors', async () => {
  // Re-run Migration 31
  const migration31Sql = fs.readFileSync('supabase/migrations/31_default_service_catalog_idempotency.sql', 'utf8');
  await pool.query(migration31Sql);

  // Run Migration 35
  const migration35Sql = fs.readFileSync('supabase/migrations/35_historical_service_data_safety.sql', 'utf8');
  await pool.query(migration35Sql);

  // Verify constraints and indexes are intact
  const indexCheck = await pool.query(`
    SELECT indexname FROM pg_indexes 
    WHERE tablename = 'services' AND indexname = 'uq_services_org_id_active_name';
  `);
  assert.strictEqual(indexCheck.rows.length, 1);
});
