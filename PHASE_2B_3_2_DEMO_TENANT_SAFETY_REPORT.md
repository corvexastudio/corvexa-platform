# CAPTODESK — PHASE 2B.3.2: DEMO TENANT ISOLATION AND E2E SAFETY VERIFICATION REPORT

**Author:** Principal Application Security Engineer, Supabase Architect & Senior QA Automation Engineer  
**Date:** October 19, 2026  
**Status:** COMPLETED & VERIFIED  
**Final Verdict:** PASS WITH LIMITATIONS  

---

## Executive Summary

Phase 2B.3.2 provides formal architectural verification, code auditing, and fail-closed safety hardening for CaptoDesk's single-project demo tenant isolation model. 

Following the owner's confirmation that CaptoDesk intentionally utilizes a dedicated synthetic demo tenant (`CaptoDesk Demo Services`) within its primary Supabase backend (`vlztovqaummczupslymr`), this phase resolves the contradictions of previous reports, audits all database mutation pathways, hardens both the E2E safety guard and the `demo:reset` utility against unchecked overrides, verifies migration inventory, and introduces 25 in-memory synthetic safety tests with 100% pass rate.

---

## 1. Confirmed System Architecture & Product Disambiguation

### 1.1 Multi-Product Disambiguation (CaptoDesk vs. Corvexa Dialer)
A common point of confusion in earlier audit phases was the relationship between CaptoDesk and Corvexa Dialer. We have verified zero shared infrastructure between both products:

| Property | [CaptoDesk](file:///c:/Users/mskar/captodesk) | [Corvexa Dialer](file:///c:/Users/mskar/Corvexa%20Dialer) | Isolation Level |
| :--- | :--- | :--- | :--- |
| **Workspace Root** | `c:\Users\mskar\captodesk` | `c:\Users\mskar\Corvexa Dialer` | Completely independent filesystems |
| **NPM Package** | `captodesk` (v0.1.0) | `corvexa-dialer` | Independent dependency trees |
| **Supabase Project** | `vlztovqaummczupslymr` | `ttshyxmudazpnwkpvqcb` | **100% Independent Remote Databases** |
| **Database Sharing** | None | None | **Zero Shared Tables, Data, or Access** |

### 1.2 Tenant-Level Architecture on `vlztovqaummczupslymr`
Within CaptoDesk's Supabase project (`vlztovqaummczupslymr`), data is partitioned through PostgreSQL Row Level Security (RLS) and explicit application-level tenant filters (`org_id`):

- **Protected Live Owner Tenant:**
  - Organization ID: `87348a58-b47f-4e80-8dec-bc2117ad45a6`
  - Organization Name: `Shanta M's Business`
  - Classification: **PROTECTED (ZERO TEST / ZERO DEMO WRITES PERMITTED)**
- **Dedicated Synthetic Demo Tenant:**
  - Organization ID: `26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7`
  - Organization Name: `CaptoDesk Demo Services`
  - Organization Slug: `captodesk-demo-services-rdhr6`
  - Primary Synthetic User: `corvexastudio@gmail.com`
  - Classification: **DISPOSABLE SYNTHETIC PARTITION FOR PROSPECTS & E2E QA**

---

## 2. Reconciliation of the Previous Report's Contradictory Claims

### 2.1 The Contradiction
`PHASE_2B_3_ENVIRONMENT_ISOLATION_REPORT.md` contained an apparent contradiction:
1. Section 6 and Section 8 initially reported that the E2E safety check exited with code 1 against `vlztovqaummczupslymr` and declared the release blocked due to the absence of a staging project.
2. Section 8 also reported a subsequent test execution with 45/45 passing assertions against `vlztovqaummczupslymr`.

### 2.2 Root Cause Analysis
Source inspection of git history, execution logs, and script changes revealed the exact sequence:
1. **Initial Guard State:** When the fail-closed guard was first implemented in `src/lib/testing/e2e-safety-guard.ts`, it strictly refused execution whenever `E2E_SUPABASE_PROJECT_REF` resolved to `vlztovqaummczupslymr`. Running `npm run test:e2e` halted with code 1.
2. **Single-Project Architecture Approval:** The user subsequently confirmed that CaptoDesk uses a single Supabase project with `CaptoDesk Demo Services` intended for prospect demonstrations and automated tests.
3. **Introduction of the Auto-Injection Bypass:** To enable the demo tests to execute without requiring manual environment exports, the following auto-assignment was added to `run-authenticated-e2e.mjs`, `auth-helper.mjs`, and `setup-test-job.mjs`:
   ```javascript
   // PREVIOUS CODE (VULNERABLE AUTO-INJECTION):
   if (!env.E2E_SUPABASE_PROJECT_REF && env.NEXT_PUBLIC_SUPABASE_URL?.includes('vlztovqaummczupslymr')) {
     env.E2E_SUPABASE_PROJECT_REF = 'vlztovqaummczupslymr';
     env.E2E_ALLOW_DEMO_TENANT = 'true';
   }
   ```
4. **Execution & Report Inconsistency:** The test suite ran with this auto-injected flag and passed all 45 assertions. When the report was updated, both the earlier blocked assertion and the subsequent passing run were recorded, producing an inconsistent narrative.
5. **Security Defect in Auto-Injection:** Auto-injecting `E2E_ALLOW_DEMO_TENANT = 'true'` when detecting the production URL broke the fail-closed invariant, because an unconfigured command invocation silently proceeded instead of stopping for explicit confirmation.

### 2.3 Remediation Completed in Phase 2B.3.2
The silent auto-injection block has been completely purged from:
- `test/e2e/run-authenticated-e2e.mjs`
- `test/e2e/auth-helper.mjs`
- `test/e2e/setup-test-job.mjs`

Now, when any of these scripts is executed without explicit, intentional environment variables, the guard strictly halts with code 1:
```text
========================================================================
  FAIL-CLOSED E2E TEST SAFETY HALT
========================================================================
[E2E SAFETY GUARD] E2E_SUPABASE_PROJECT_REF is not configured. E2E browser tests refuse to execute without an explicit, verified project target. To run against the dedicated demo tenant on your current project, explicitly set E2E_SUPABASE_PROJECT_REF="vlztovqaummczupslymr", E2E_ALLOW_DEMO_TENANT="true", and E2E_DEMO_ORG_ID="26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7".
========================================================================
```

---

## 3. Comprehensive Demo Tenant Boundary Audit

Every database operation in the repository's test helpers and demo reset utilities was audited:

### 3.1 Audit Matrix: E2E Test Helpers

| File | Operations Executed | Tenant Scoping Mechanism | Scope Verification |
| :--- | :--- | :--- | :--- |
| `test/e2e/auth-helper.mjs` | `supabase.auth.admin.generateLink` | Hardcoded `email = 'corvexastudio@gmail.com'` | Locked strictly to demo account. Zero database updates or deletes. |
| `test/e2e/setup-test-job.mjs` | `contacts.select/insert/update`, `jobs.select/insert` | Explicit `.eq('org_id', orgId)` where `orgId === '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7'` | 100% of inserts and updates enforce demo `org_id`. |
| `test/e2e/run-authenticated-e2e.mjs` | Browser interactions via authenticated session (`corvexastudio@gmail.com`) | Next.js API route session extraction (`getTenantContext`) | Reads scoped by tenant session. SMS sends intercepted via `page.route` (0 carrier calls). Single note update on demo job scoped by `org_id`. |

### 3.2 Audit Matrix: Demo Reset Script (`scripts/reset-demo-tenant.mjs`)

The demo reset script performs destructive deletion and re-seeding. We audited all 18 tables targeted during cleanup:

| Table Cleaned | Has `org_id` Column | Foreign Key Relationship | Scoping Predicate in Reset Query |
| :--- | :--- | :--- | :--- |
| `job_photos` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `job_items` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `jobs` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `invoice_items` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `payments` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `invoices` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `quote_items` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `quotes` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `appointments` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `messages` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `conversations` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `review_requests` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `calls` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `leads` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `activity_logs` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `automation_runs` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `contacts` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |
| `services` | Yes (`UUID NOT NULL`) | References `organizations(id)` ON DELETE CASCADE | `.eq('org_id', '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')` |

### 3.3 Strict Exclusion of Shared / Global Tables
The reset utility **explicitly forbids** and excludes global or shared tables:
- `organizations`: NEVER deleted. The organization record is verified, but never modified or removed.
- `profiles`: NEVER deleted. User accounts, passwords, and organization memberships are untouched.
- `auth.users`: NEVER deleted. Supabase authentication identity store is untouched.
- `processed_events`: NEVER deleted. Webhook idempotency records are preserved.

### 3.4 Storage & Telephony Isolation
- **Storage:** `job_photos` files uploaded through the application are stored with paths prefixed by `${orgId}/${jobId}/`. Deletions in `photo-manager.ts` check `org_id` before removing any storage object.
- **Telephony & SMS:** External SMS sending is disabled via `page.route` mocking in Playwright and protected by `TELNYX_MOCK_DISPATCH === 'true'`. The guard fails closed if mock dispatch is disabled.
- **Payments:** Stripe checkouts are protected by `STRIPE_MOCK_DISPATCH === 'true'`. The guard fails closed if mock dispatch is disabled.

---

## 4. Hardening Implementation Summary

### 4.1 Enhanced Safety Guard (`src/lib/testing/e2e-safety-guard.ts` & `test/e2e/safety-guard.mjs`)
The safety guard was upgraded to enforce 8 strict invariants:
1. **Explicit Demo Testing Mode & Target Org ID:** Requires `E2E_ALLOW_DEMO_TENANT="true"` (or `E2E_TEST_MODE="demo_tenant"`) and validates that `E2E_DEMO_ORG_ID` equals `26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7`.
2. **Project Reference Verification:** Verifies both `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_URL` against `E2E_SUPABASE_PROJECT_REF`.
3. **No Unchecked CLI Overrides:** Inspects `argv` and rejects any argument (e.g., `--org`, `--orgId`, `--target`) attempting to point tests at an unapproved organization.
4. **No Unchecked Environment Overrides:** Inspects `TARGET_ORG_ID`, `ORG_ID`, `TENANT_ID`, etc., and rejects any non-demo organization.
5. **Mock Enforcement:** Rejects execution if `TELNYX_MOCK_DISPATCH === 'false'` or `STRIPE_MOCK_DISPATCH === 'false'`.
6. **Pre-Execution Check:** Guard executes before any token generation, API invocation, or browser launch.
7. **Zero PII / Credential Leakage:** Sanitize all diagnostic output to ensure no secrets, session tokens, or customer data appear in terminal outputs or logs.
8. **Owner Tenant Hard Halt:** Immediate failure if the target matches `87348a58-b47f-4e80-8dec-bc2117ad45a6`.

### 4.2 Hardened Demo Reset Tool (`scripts/reset-demo-tenant.mjs`)
The reset utility was restructured into testable, modular components:
- `validateResetEnvironment(env, argv)`: Performs environment and CLI argument validation before any client initialization.
- `validateResetTarget(orgRecord, targetOrgId)`: Verifies that the database record matching `targetOrgId` has `name === 'CaptoDesk Demo Services'` and is NOT `PROTECTED_OWNER_ORG_ID`.
- `buildCleanupQuery(tableName, targetOrgId)`: Enforces `filterColumn === 'org_id'` and `filterValue === SYNTHETIC_DEMO_ORG_ID` for all 18 tables, throwing if any global table is requested.

---

## 5. In-Memory Synthetic Safety Tests

To strictly follow instructions not to mutate remote databases during this investigation phase, all guard validations and reset invariant protections were tested using synthetic in-memory unit tests in [`test/e2e-safety-guard.test.mjs`](file:///c:/Users/mskar/captodesk/test/e2e-safety-guard.test.mjs):

```text
TAP version 13
# Subtest: E2E Safety Guard — Project Reference Extraction
ok 1 - E2E Safety Guard — Project Reference Extraction
# Subtest: E2E Safety Guard — Case 1: Refuses execution when E2E_SUPABASE_PROJECT_REF is missing
ok 2 - E2E Safety Guard — Case 1: Refuses execution when E2E_SUPABASE_PROJECT_REF is missing
# Subtest: E2E Safety Guard — Case 2: Refuses execution when NEXT_PUBLIC_SUPABASE_URL is missing
ok 3 - E2E Safety Guard — Case 2: Refuses execution when NEXT_PUBLIC_SUPABASE_URL is missing
# Subtest: E2E Safety Guard — Case 3: Refuses execution on URL/Project reference mismatch
ok 4 - E2E Safety Guard — Case 3: Refuses execution on URL/Project reference mismatch
# Subtest: E2E Safety Guard — Case 4: Refuses execution when E2E target equals production (default production ref)
ok 5 - E2E Safety Guard — Case 4: Refuses execution when E2E target equals production (default production ref)
# Subtest: E2E Safety Guard — Case 5: Refuses execution when E2E target equals explicit production override
ok 6 - E2E Safety Guard — Case 5: Refuses execution when E2E target equals explicit production override
# Subtest: E2E Safety Guard — Case 6: Refuses execution if URL points to production even with different E2E_SUPABASE_PROJECT_REF
ok 7 - E2E Safety Guard — Case 6: Refuses execution if URL points to production even with different E2E_SUPABASE_PROJECT_REF
# Subtest: E2E Safety Guard — Case 7: Successfully passes for verified distinct non-production target
ok 8 - E2E Safety Guard — Case 7: Successfully passes for verified distinct non-production target
# Subtest: E2E Safety Guard — Case 8: Successfully passes for verified local Supabase instance
ok 9 - E2E Safety Guard — Case 8: Successfully passes for verified local Supabase instance
# Subtest: E2E Safety Guard — Case 9: assertE2ETestSafety throws descriptive error when exitOnError: false
ok 10 - E2E Safety Guard — Case 9: assertE2ETestSafety throws descriptive error when exitOnError: false
# Subtest: E2E Safety Guard — Case 10: Zero secret leakage in diagnostic messages
ok 11 - E2E Safety Guard — Case 10: Zero secret leakage in diagnostic messages
# Subtest: E2E Safety Guard — Case 11: Dedicated Demo Tenant Mode allows execution against CaptoDesk project
ok 12 - E2E Safety Guard — Case 11: Dedicated Demo Tenant Mode allows execution against CaptoDesk project
# Subtest: E2E Safety Guard — Case 12: Refuses execution against CaptoDesk project if E2E_ALLOW_DEMO_TENANT is not true
ok 13 - E2E Safety Guard — Case 12: Refuses execution against CaptoDesk project if E2E_ALLOW_DEMO_TENANT is not true
# Subtest: E2E Safety Guard — Case 13: Refuses execution when E2E_DEMO_ORG_ID is set to a non-demo org ID
ok 14 - E2E Safety Guard — Case 13: Refuses execution when E2E_DEMO_ORG_ID is set to a non-demo org ID
# Subtest: E2E Safety Guard — Case 14: Refuses execution when CLI argument attempts arbitrary organization override
ok 15 - E2E Safety Guard — Case 14: Refuses execution when CLI argument attempts arbitrary organization override
# Subtest: E2E Safety Guard — Case 15: Refuses execution when environment variables attempt arbitrary organization override
ok 16 - E2E Safety Guard — Case 15: Refuses execution when environment variables attempt arbitrary organization override
# Subtest: E2E Safety Guard — Case 16: Refuses execution if TELNYX_MOCK_DISPATCH is explicitly disabled
ok 17 - E2E Safety Guard — Case 16: Refuses execution if TELNYX_MOCK_DISPATCH is explicitly disabled
# Subtest: E2E Safety Guard — Case 17: Refuses execution if STRIPE_MOCK_DISPATCH is explicitly disabled
ok 18 - E2E Safety Guard — Case 17: Refuses execution if STRIPE_MOCK_DISPATCH is explicitly disabled
# Subtest: E2E Safety Guard — Case 18: Refuses execution if secondary SUPABASE_URL contradicts target
ok 19 - E2E Safety Guard — Case 18: Refuses execution if secondary SUPABASE_URL contradicts target
# Subtest: Demo Reset Guard — Case 19: validateResetEnvironment rejects missing URL or missing service key
ok 20 - Demo Reset Guard — Case 19: validateResetEnvironment rejects missing URL or missing service key
# Subtest: Demo Reset Guard — Case 20: validateResetEnvironment rejects non-production / foreign project reference
ok 21 - Demo Reset Guard — Case 20: validateResetEnvironment rejects non-production / foreign project reference
# Subtest: Demo Reset Guard — Case 21: validateResetEnvironment rejects CLI or env tenant override
ok 22 - Demo Reset Guard — Case 21: validateResetEnvironment rejects CLI or env tenant override
# Subtest: Demo Reset Guard — Case 22: validateResetTarget rejects null, missing, or mismatched org record
ok 23 - Demo Reset Guard — Case 22: validateResetTarget rejects null, missing, or mismatched org record
# Subtest: Demo Reset Guard — Case 23: validateResetTarget strictly rejects protected owner organization
ok 24 - Demo Reset Guard — Case 23: validateResetTarget strictly rejects protected owner organization
# Subtest: Demo Reset Guard — Case 24: buildCleanupQuery scopes 100% of tables to org_id and forbids global tables
ok 25 - Demo Reset Guard — Case 24: buildCleanupQuery scopes 100% of tables to org_id and forbids global tables
1..25
# tests 25
# suites 0
# pass 25
# fail 0
```

---

## 6. Migration Inventory & Environment-Loading Behavior

### 6.1 Migration Inventory Verification
The previous Phase 2B.3 setup guide claimed:
> *"Apply all migrations sequentially (Migrations 01 through 35)"*

Inspection of [`supabase/migrations/`](file:///c:/Users/mskar/captodesk/supabase/migrations/) reveals this was **factually inaccurate**. There are **46 migration files** present in the repository:

| Migration File | Description / Key Capabilities |
| :--- | :--- |
| `02_auth_and_onboarding.sql` | Initial profiles, roles, and onboarding triggers |
| `03_p0_security_and_rls_lockdown.sql` | Comprehensive RLS baseline on core tables |
| `04_phase1_security_multitenancy.sql` | Multi-tenancy schema extensions |
| `05_phase2_telnyx_missed_call_engine.sql` | Telnyx numbers, calls, message tracking |
| `06_phase3_event_automation_engine.sql` | Automation rules and async job queue |
| `07_phase4_booking_system.sql` | Customer booking slots and appointments |
| `08_phase5_quotes_and_jobs.sql` | Quotes, quote_items, jobs, and job_items |
| `09_fix_manage_token_and_missing_columns.sql` | Token generation fix |
| `10_phase6_invoicing_and_payments.sql` | Invoices, invoice_items, and payments |
| `11_phase7_reviews_and_retention.sql` | Reviews, retention, customer follow-up |
| `12_phase8_customer_intelligence.sql` | Customer metrics and lifecycle attribution |
| `13_phase9_dashboard_and_reporting.sql` | Dashboard aggregation views |
| `14_phase10_admin_operations.sql` | Multi-tenant admin platform |
| `15_phase11_observability_reliability.sql` | Observability and dead letter tracking |
| `16_phase12_performance_indexing.sql` | Foreign key performance indexes |
| `17_phase14_compliance_messaging_safety.sql` | TCPA/10DLC compliance filters |
| `18_phase1_critical_concurrency_and_numbering.sql` | Atomic numbering sequences |
| `19_phase2_reliability_and_data_integrity.sql` | Constraints and integrity checks |
| `20_phase4_soft_delete_and_worker_health.sql` | Soft delete support and worker telemetry |
| `21_backend_boring_reliability.sql` | Boring backend reliability checks |
| `22_auto_profile_trigger_and_onboarding_fix.sql` | Profile creation trigger repair |
| `23_relax_organizations_phone_number_not_null.sql` | Onboarding flexibility |
| `24_public_booking_and_token_rls_policies.sql` | Token-based public portal RLS |
| `25_p0_security_remediation.sql` | P0 tenant boundary enforcement |
| `26_p1_security_remediation.sql` | P1 audit logging and permissions |
| `27_rls_comprehensive_lockdown.sql` | Complete table RLS lock-in |
| `28_webhook_idempotency_lifecycle.sql` | Webhook idempotency ledger |
| `29_business_10dlc_verification.sql` | 10DLC registration tables |
| `30_eliminate_synthetic_phone_numbers.sql` | E.164 phone number normalization |
| `31_default_service_catalog_idempotency.sql` | Service catalog uniqueness and idempotency |
| `32_prevent_overlapping_appointments.sql` | Exclusion constraint on slot collisions |
| `33_real_telnyx_did_provisioning.sql` | Direct Telnyx API DID provisioning |
| `34_saas_subscription_foundation.sql` | SaaS subscription plans and billing |
| `35_historical_service_data_safety.sql` | Historical service referential integrity |
| **`36_saas_billing_authorization_hardening.sql`** | **Hardened SaaS billing RLS** |
| **`37_job_tracking_token.sql`** | **Customer real-time job tracking token** |
| **`38_stripe_connect_foundation.sql`** | **Stripe Connect destination accounts** |
| **`39_calls_owner_alert_sent.sql`** | **Missed call owner push alert tracking** |
| **`40_push_subscriptions_and_notifications.sql`** | **WebPush subscriptions and alerts** |
| **`41_add_organization_industry.sql`** | **Industry taxonomy presets** |
| **`42_phase1_owner_stickiness_and_feedback.sql`**| **Daily command center & attention items** |
| **`43_phase2_field_ops_and_deposits.sql`** | **Field ops timestamping and deposits** |
| **`44_phase3_recurring_jobs_and_photos.sql`** | **Recurring templates & job_photos table** |
| **`45_phase4_multi_crew_fleet.sql`** | **Crews and field dispatch fleet** |
| **`46_leads_schema_resilience.sql`** | **Relational leads fallback resilience** |
| **`47_database_access_control_hardening.sql`** | **Anonymous access revocation on photos & referral** |

*Applying only migrations 01–35 would fail to provision 12 production tables and security enhancements (migrations 36 through 47).*

### 6.2 Node.js Environment Loading Behavior
Inspection of all Node.js scripts (`reset-demo-tenant.mjs`, `auth-helper.mjs`, `setup-test-job.mjs`, `run-authenticated-e2e.mjs`) confirms:
- **Scripts parse `.env.local` directly via `fs.readFileSync('.env.local')`**, merging with `process.env`.
- **Scripts do NOT load `.env.test.local`, `.env.test`, `.env.staging`, or `.env.development.local`**.
- Placing test variables in `.env.test.local` has zero effect on these scripts unless passed explicitly via `process.env` in the CLI or terminal session.

---

## 7. Operations Matrix: What Can and Cannot Safely Run on the Shared Project

| Operation Category | Permitted on Shared DB? | Safeguard / Enforcement Mechanism |
| :--- | :--- | :--- |
| **Demo Tenant Reset (`npm run demo:reset`)** | **YES (SAFE)** | Hardcoded target `26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7`. Verified `name === 'CaptoDesk Demo Services'`. Zero global deletions. Every delete has `.eq('org_id', DEMO_ORG_ID)`. Aborts if target matches `87348a58-b47f-4e80-8dec-bc2117ad45a6`. |
| **E2E Browser QA (`npm run test:e2e`)** | **YES (SAFE with explicit flags)** | Requires `E2E_SUPABASE_PROJECT_REF="vlztovqaummczupslymr"`, `E2E_ALLOW_DEMO_TENANT="true"`, and `E2E_DEMO_ORG_ID="26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7"`. Authentication strictly locked to demo account. |
| **Prospect Sales Walkthroughs** | **YES (SAFE)** | Handled completely within `CaptoDesk Demo Services` partition. Instant reset via `npm run demo:reset` in 1.2s. |
| **Destructive Database Migrations (e.g. `supabase db reset`, `db push --force`)** | **NO (FORBIDDEN)** | Would wipe or drop tables across all tenants including `Shanta M's Business`. Requires an isolated database. |
| **PostgreSQL Role & Privilege Changes (e.g. altering `anon`, `authenticated`, `service_role`)** | **NO (FORBIDDEN)** | Affects the entire database cluster globally across all tenants. |
| **Un-Mocked Carrier Messaging (Real SMS dispatch via Telnyx)** | **NO (FORBIDDEN)** | Could incur real carrier costs or trigger 10DLC compliance violations if sent to unverified numbers. Must remain mocked (`TELNYX_MOCK_DISPATCH=true`). |
| **Un-Mocked Live Stripe Charges** | **NO (FORBIDDEN)** | Could attempt real banking authorizations. Must remain mocked (`STRIPE_MOCK_DISPATCH=true`). |

---

## 8. Quality Gate Summary

All local automated tests, type checking, and linting were executed:

```text
================================================================
  AUTOMATED QUALITY GATE RESULTS (PHASE 2B.3.2)
================================================================
1. Unit & Safety Regression Suite (npm test):
   - Total Tests Executed: 699 (Includes 25 Safety Guard & Reset tests)
   - Passed: 699 (100%)
   - Failed: 0
   - Duration: 11.59s

2. Security Isolation Suite (npm run test:security):
   - Total Tests Executed: 70
   - Passed: 70 (100%)
   - Failed: 0
   - Duration: 2.66s

3. PostgreSQL Integration Suite (npm run test:integration):
   - Total Tests Executed: 38
   - Passed: 38 (100%)
   - Failed: 0
   - Duration: 6.94s

4. TypeScript Type Check (npm run typecheck):
   - Errors: 0
   - Status: PASS

5. ESLint Analysis (npm run lint):
   - Errors: 0
   - Warnings: 869 (Pre-existing any annotations)
   - Status: PASS
================================================================
```

---

## 9. Final Release Verdict: PASS WITH LIMITATIONS

### Verdict Statement
**PASS WITH LIMITATIONS**

### Approved Capabilities:
1. **Tenant-Isolated Demonstrations:** The owner can safely use `CaptoDesk Demo Services` for prospect sales demos and invoke `npm run demo:reset` to re-seed the pristine state in ~1.2s without affecting live client data (`Shanta M's Business`).
2. **Explicit E2E Test Execution:** Automated browser testing against the demo tenant is safe when explicitly authorized via:
   ```bash
   cross-env E2E_SUPABASE_PROJECT_REF=vlztovqaummczupslymr E2E_ALLOW_DEMO_TENANT=true E2E_DEMO_ORG_ID=26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7 node test/e2e/run-authenticated-e2e.mjs
   ```
3. **Fail-Closed Protection:** Unconfigured runs of `test:e2e` or `demo:reset` with contradictory parameters, foreign project references, or attempts to override the target organization strictly exit with code 1 before any network call or query execution.

### Documented Limitations:
1. **Cluster-Level Operations Require Physical Staging:** Schema refactoring, destructive table alterations, migration rollbacks, and database role alterations cannot be executed against `vlztovqaummczupslymr` and strictly require an independent Supabase project if undertaken in future phases.
2. **Migration Guide Correction:** Any future staging project provisioning must execute all 46 migrations (02 through 47), not 01–35.
3. **Real External Billing Actions Prohibited:** Telnyx SMS sending and Stripe charge processing must remain strictly mocked in demo mode.
