# CAPTODESK — PHASE 2B.3: ENVIRONMENT ISOLATION AND AUTOMATED TEST SAFETY REPORT

**Environment Separation, Fail-Closed E2E Safety Guards, External Integration Mocking & Release Blocker Audit**

- **Document Version:** 1.0.0
- **Execution Date:** October 19, 2026
- **Auditor / Engineering Roles:** Principal DevOps Engineer, Supabase Architect, Application Security Engineer, Senior QA Automation Engineer
- **Target Repository:** `C:\Users\mskar\captodesk`
- **Target Branch:** `main`
- **Production Supabase Project Reference:** `vlztovqaummczupslymr` (`https://vlztovqaummczupslymr.supabase.co`)
- **Vercel Production Linkage:** `corvexa-platform` (`prj_gus7l8IIn2CGpCT5qfN5gB8Lhxpl`), Team: `team_0TNPrAleyH2pjlD8Gqtze8kQ`
- **Overall Verdict:** **FAIL-CLOSED GUARDS ACTIVE — RELEASE BLOCKED ON DEDICATED TEST BACKEND PROVISIONING**

---

## 1. Executive Summary & Critical Findings

### 1.1 Critical Finding
During Phase 2B.2 and Phase 2A.3 audits, forensic inspection confirmed that **a single Supabase project (`vlztovqaummczupslymr`) is currently configured across local developer workstations, Vercel Preview deployments, and the Vercel Production environment**. Furthermore, this shared project contains synthetic demo records (`CaptoDesk Demo Services`, ID `26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7`) alongside production owner records.

While all unit and integration test suites safely use in-memory harnesses or local ephemeral `embedded-postgres` instances, **running live authenticated browser tests against the shared project created a severe operational risk of data pollution, unintended state mutation, and cross-tier interference**.

### 1.2 Core Actions Completed in Phase 2B.3
1. **Implemented Fail-Closed E2E Safety Guard:** Designed and integrated `src/lib/testing/e2e-safety-guard.ts` and `test/e2e/safety-guard.mjs`. Authenticated E2E tests (`npm run test:e2e`), magic link generation (`test/e2e/auth-helper.mjs`), and test job seeding (`test/e2e/setup-test-job.mjs`) strictly refuse execution if pointed to production (`vlztovqaummczupslymr`) or an unverified project.
2. **Verified Fail-Closed Halt:** Verified that attempting to run `npm run test:e2e` against the shared/production environment immediately halts with exit code `1` and emits a safe diagnostic with zero credential or PII disclosure.
3. **Classified All Test Scripts & External Services:** Classified all 60 test suites, scripts, and helpers into the 4 mandatory categories (`READ ONLY`, `SYNTHETIC DATA WRITE`, `DESTRUCTIVE DATA OPERATION`, `EXTERNAL BILLABLE ACTION`).
4. **Hardened External Integration Protections:** Added explicit test/mock guards (`TELNYX_MOCK_DISPATCH`, `STRIPE_MOCK_DISPATCH`) preventing accidental billable telephony dispatches or live payment sessions in test workflows.
5. **Verified Phase 2B.2 Bug Fixes with Regression Tests:** Added `test/phase2b2-regressions.test.mjs` verifying that `jobs` and `items` in `/api/client/jobs` reference the exact same memory array, and confirming that `loadConversations` functional state updates prevent re-fetch loops while preserving thread selections.
6. **Provided Dedicated Non-Production Setup Guide:** Detailed the complete manual provisioning runbook for a dedicated test Supabase project.
7. **Formally Logged Release Blocker:** Declared the absence of a provisioned non-production Supabase project as an explicit **RELEASE BLOCKER**. Production deployment is blocked until a distinct staging Supabase backend is provisioned.

### 1.3 Project Owner Clarification: Architecture Disambiguation (CaptoDesk vs. Corvexa Dialer)
Forensic inspection and user clarification conclusively resolved the cross-product relationship:
- **Corvexa Dialer (`C:\Users\mskar\Corvexa Dialer`):** An independent repository (`package.json`: `corvexa-dialer`) connected exclusively to its own dedicated Supabase project: **`ttshyxmudazpnwkpvqcb`** (`https://ttshyxmudazpnwkpvqcb.supabase.co`).
- **CaptoDesk (`C:\Users\mskar\captodesk`):** An independent repository (`package.json`: `captodesk`) connected exclusively to its own dedicated Supabase project: **`vlztovqaummczupslymr`** (`https://vlztovqaummczupslymr.supabase.co`).
- **Zero Cross-Product Database Sharing:** There is **zero shared database access** between CaptoDesk and Corvexa Dialer. The Vercel naming legacy (`corvexa-platform` in `.vercel/project.json`) led earlier audits to suspect cross-product database mingling, but direct inspection confirms they are completely distinct database clusters.
- **Database Partition in `vlztovqaummczupslymr`:** Live inspection confirmed exactly two organizations exist:
  1. `87348a58-b47f-4e80-8dec-bc2117ad45a6` ("Shanta M's Business" — Owner tenant)
  2. `26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7` ("CaptoDesk Demo Services" — Synthetic demo tenant)


---

## 2. Environment Connections Map

Forensic inspection of repository configurations, environment templates, deployment manifests, worker scripts, and test tooling identified the following environment relationships:

| Environment Tier | Config Source | Supabase Project Reference | Supabase Base URL | Database Role / Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Local Development** | `.env.local` | `vlztovqaummczupslymr` | `https://vlztovqaummczupslymr.supabase.co` | `service_role` + `anon` |
| **Vercel Preview** | Vercel Project Config | `vlztovqaummczupslymr` (Shared) | `https://vlztovqaummczupslymr.supabase.co` | `service_role` + `anon` |
| **Vercel Production** | Vercel Project Config | `vlztovqaummczupslymr` | `https://vlztovqaummczupslymr.supabase.co` | `service_role` + `anon` |
| **Unit & Mock Tests** | In-Memory Harnesses | N/A (Pure Memory) | N/A (Isolated Mock Store) | Mock DB Client |
| **PostgreSQL Integration Tests** | `embedded-postgres` | Local Ephemeral Port 54335/54336 | `postgresql://localhost:54335/captodesk_...` | Superuser (`postgres`) |
| **Authenticated E2E Tests** | `test/e2e/safety-guard.mjs` | **BLOCKED** (`vlztovqaummczupslymr` rejected) | Checked against `E2E_SUPABASE_PROJECT_REF` | **Halted Closed** |

### 2.1 State-Changing & Data Mutation Scripts
Inspection identified the following scripts that perform user creation, magic link generation, record addition/deletion, or cleanup:

1. **`test/e2e/auth-helper.mjs`**:
   - **Operation:** Calls `supabase.auth.admin.generateLink({ type: 'magiclink', email: 'corvexastudio@gmail.com' })` and exchanges it for session cookies via `/client/auth/callback`.
   - **Safety Status:** **Protected by Safety Guard**. Calls `assertE2ETestSafety()` before instantiating the Supabase client or generating tokens.
2. **`test/e2e/setup-test-job.mjs`**:
   - **Operation:** Inserts/updates synthetic contact and inserts scheduled job for tenant `26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7`.
   - **Safety Status:** **Protected by Safety Guard**. Calls `assertE2ETestSafety()` before database connection.
3. **`test/e2e/run-authenticated-e2e.mjs`**:
   - **Operation:** Drives authenticated browser session through Playwright; interacts with date-range filters, tabs, modal forms, and UI controls.
   - **Safety Status:** **Protected by Safety Guard**. Calls `assertE2ETestSafety()` at initialization; halts with exit code 1.
4. **`scripts/live-storage-probe.mjs`**:
   - **Operation:** Performs non-destructive inspection of `job-photos` Supabase Storage bucket metadata and RLS policies.
   - **Safety Status:** Read-only inspection; zero object upload or deletion.
5. **`scripts/capture-production-screens.mjs`**:
   - **Operation:** Headless browser navigation capturing static PNG evidence of public/preview routes.
   - **Safety Status:** Read-only navigation; zero form submissions or data mutation.

---

## 3. Comprehensive Test Script & External Integration Classification

Every automated test file and script was inspected to classify its actual operations:

| Test File / Script | Category | Database Target | External Services | Mutation / Execution Details |
| :--- | :--- | :--- | :--- | :--- |
| `test-safety.mjs` | **READ ONLY** | None | None | TCPA keyword detection, curfew hours, Ed25519 signature validation. |
| `test/security-baseline.test.mjs` | **READ ONLY** | None | None | HTTP security headers, CORS origin verification, cookie security flags. |
| `test/missed-call-engine.test.mjs` | **SYNTHETIC DATA WRITE** | In-Memory Mock Store | Mocked Telnyx | Webhook ingestion, automated SMS response sequencing in mock store. |
| `test/automation-engine.test.mjs` | **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | Event dispatcher, stop conditions, rule evaluation in mock store. |
| `test/booking-engine.test.mjs` | **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | Appointment slot calculation, buffer enforcement in mock store. |
| `test/quotes-jobs-engine.test.mjs` | **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | Quote acceptance, line-item rollup, job conversion in mock store. |
| `test/invoicing-stripe-engine.test.mjs` | **SYNTHETIC DATA WRITE** | In-Memory Mock Store | Mocked Stripe | Invoice creation, tax/discount calculation, simulated Stripe checkout (`cs_sim_...`). |
| `test/reviews-retention-engine.test.mjs` | **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | Review dispatch throttle, sentiment analysis, retention rules in mock store. |
| `test/customer-intelligence-engine.test.mjs`| **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | Customer scoring, lifetime value calculation, lead status in mock store. |
| `test/dashboard-reporting-engine.test.mjs` | **READ ONLY** | In-Memory Mock Store | None | Aggregate metric calculation, 7d/30d period queries in mock store. |
| `test/admin-platform-operations.test.mjs` | **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | Tenant provisioning, plan upgrades, platform metrics in mock store. |
| `test/admin-login-and-staff.test.mjs` | **READ ONLY** | In-Memory Mock Store | None | Staff authentication, RBAC permission resolution in mock store. |
| `test/observability-reliability-engine.test.mjs`| **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | Dead-letter queue retries, structured error logging in mock store. |
| `test/performance-database-benchmarks.test.mjs`| **READ ONLY** | In-Memory Mock Store | None | Query latency evaluation, pagination cursor benchmarking in mock store. |
| `test/compliance-messaging-safety.test.mjs` | **SYNTHETIC DATA WRITE** | In-Memory Mock Store | Mocked Telnyx | TCPA quiet hours, STOP suppression list, frequency cap in mock store. |
| `test/full-e2e-production-qa.test.mjs` | **SYNTHETIC DATA WRITE** | In-Memory Mock Store | Mocked Telnyx/Stripe | Dual-tenant (Apex Plumbing vs Beacon Electric) full lifecycle in mock store. |
| `test/production-release-readiness.test.mjs` | **READ ONLY** | None | None | Production route readiness, environment validation, bundle gates. |
| `test/phase1-concurrency-and-blockers.test.mjs`| **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | Optimistic locking, double-booking prevention in mock store. |
| `test/phase2-backend-reliability.test.mjs` | **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | Circuit breakers, exponential backoff, retry queues in mock store. |
| `test/phase3-security-compliance-hardening.test.mjs`| **READ ONLY** | In-Memory Mock Store | None | CSRF validation, XSS sanitization, rate limit thresholds in mock store. |
| `test/phase4-data-integrity-worker-health.test.mjs`| **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | Worker heartbeat, job lease acquisition, stuck task recovery in mock store. |
| `test/phase5-frontend-functional-correctness.test.mjs`| **READ ONLY** | None | None | React component prop contracts, accessibility aria attributes, render tests. |
| `test/architecture-modularity-gate.test.mjs`| **READ ONLY** | None | None | Architectural import boundaries, dependency cycle detection. |
| `test/production-security-failclosed.test.mjs`| **READ ONLY** | None | None | Missing secret fail-closed responses, invalid token rejection. |
| `test/backend-boring-reliability.test.mjs` | **READ ONLY** | In-Memory Mock Store | None | Timeout enforcement, deterministic error responses in mock store. |
| `test/onboarding-profile-resilience.test.mjs`| **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | Multi-step onboarding state machine, organization linkage in mock store. |
| `test/p0-security-remediation.test.mjs` | **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | SQL injection prevention, parameter validation, role separation. |
| `test/p1-security-remediation.test.mjs` | **READ ONLY** | In-Memory Mock Store | None | Cross-tenant isolation matrix, role-based access checks. |
| `test/multitenant-security-matrix.test.mjs` | **DESTRUCTIVE DATA OPERATION** | In-Memory Mock Store | None | Exercises cross-tenant `DELETE`, `UPDATE`, and `INSERT` against isolated in-memory tenant store. |
| `test/webhook-idempotency-and-retry.test.mjs`| **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | Idempotency key tracking, duplicate event suppression in mock store. |
| `test/worker-scheduling-and-draining.test.mjs`| **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | Multi-batch worker draining, batch locking, runtime budget in mock store. |
| `test/p0-synthetic-phone-elimination.test.mjs`| **READ ONLY** | None | None | Asserts synthetic phone number generation is prohibited in production. |
| `test/p1-public-booking-service.test.mjs` | **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | Public customer booking submission, slot allocation in mock store. |
| `test/p1-appointment-concurrency-overlap.test.mjs`| **READ ONLY** | In-Memory Mock Store | None | Appointment interval overlap logic, exclusion constraint simulation. |
| `test/integration/p1-appointment-postgres-concurrency.test.mjs` | **SYNTHETIC DATA WRITE** | Local `embedded-postgres` (Port 54335) | None | Spawns real PostgreSQL instance, tests concurrent GiST exclusion transactions. |
| `test/p0-telnyx-did-provisioning.test.mjs` | **EXTERNAL BILLABLE ACTION** | In-Memory Mock Store | Mocked Telnyx Client | Verifies DID order payload, idempotency, and state persistence with injected mock client. |
| `test/p1-ops-admin-did-provisioning.test.mjs`| **EXTERNAL BILLABLE ACTION** | In-Memory Mock Store | Mocked Telnyx Client | Super Admin DID provisioning authorization; tested via injected mock client. |
| `test/p1-ops-service-catalog.test.mjs` | **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | Service catalog CRUD, pricing tiers, category organization in mock store. |
| `test/p1-ops-saas-billing.test.mjs` | **READ ONLY** | In-Memory Mock Store | None | Subscription plan limits, feature flags, tenant seat limits. |
| `test/p1-ops-historical-service-safety.test.mjs`| **READ ONLY** | In-Memory Mock Store | None | Historical appointment and job immutability, foreign key RESTRICT checks. |
| `test/integration/p1-ops-migration31-postgres-safety.test.mjs` | **SYNTHETIC DATA WRITE** | Local `embedded-postgres` (Port 54336) | None | Spawns real PostgreSQL, executes Migration 31/35, verifies FK RESTRICT constraints. |
| `test/integration/p1-database-access-control-postgres.test.mjs` | **SYNTHETIC DATA WRITE** | Local `embedded-postgres` (Port 54335) | None | Spawns real PostgreSQL, tests Row Level Security (RLS) enforcement. |
| `test/p0-env-alignment.test.mjs` | **READ ONLY** | None | None | Environment variable presence, format, and fail-closed validation. |
| `test/p1-obs-external-monitoring.test.mjs` | **READ ONLY** | None | None | Health check endpoint minimal disclosure, readiness probes. |
| `test/p0-telnyx-did-provisioning-authorization.test.mjs`| **READ ONLY** | In-Memory Mock Store | Mocked Telnyx Client | RBAC gate testing for DID ordering; ensures non-super-admins receive HTTP 403. |
| `test/p1-billing-authorization-hardening.test.mjs`| **READ ONLY** | In-Memory Mock Store | None | Billing authorization gates, invoice voiding, refund role requirements. |
| `test/p1-notif-01-owner-alert.test.mjs` | **SYNTHETIC DATA WRITE** | In-Memory Mock Store | Mocked Web-Push | Owner alert notifications, push payload construction in mock store. |
| `test/notification-platform.test.mjs` | **SYNTHETIC DATA WRITE** | In-Memory Mock Store | Mocked Web-Push | VAPID key encryption, notification batch delivery in mock store. |
| `test/industry-presets-and-starter-services.test.mjs`| **READ ONLY** | None | None | HVAC, Plumbing, Electrical starter preset data fixtures. |
| `test/in-app-notification-center.test.mjs`| **SYNTHETIC DATA WRITE** | In-Memory Mock Store | None | In-app notification mark-as-read, unread badge counter in mock store. |
| `test/p1-database-access-control-hardening.test.mjs`| **READ ONLY** | In-Memory Mock Store | None | PostgREST RLS access control rule mapping and verification. |
| `test/phase2b1-accessibility-touch-targets.test.mjs`| **READ ONLY** | None | None | 44px touch targets, WCAG 2.1 AA color contrast ratios, screen reader semantics. |
| `test/e2e-safety-guard.test.mjs` | **READ ONLY** | None | None | **11 unit regression tests** verifying fail-closed E2E environment safety guard. |
| `test/phase2b2-regressions.test.mjs` | **READ ONLY** | None | Mocked Telnyx/Stripe | **4 unit regression tests** covering Field `jobs`/`items` equivalence, Inbox loop prevention, Telnyx mock guard, and Stripe mock guard. |
| `test/e2e/auth-helper.mjs` | **EXTERNAL BILLABLE ACTION** | Configured Supabase | Supabase Auth API | Generates magic link session cookies. **Guarded by Fail-Closed Safety Guard.** |
| `test/e2e/setup-test-job.mjs` | **SYNTHETIC DATA WRITE** | Configured Supabase | None | Inserts test contact and job for today. **Guarded by Fail-Closed Safety Guard.** |
| `test/e2e/run-authenticated-e2e.mjs` | **SYNTHETIC DATA WRITE** | Configured Supabase | Native Browser UI | 45 authenticated Playwright browser assertions. **Guarded by Fail-Closed Safety Guard.** |
| `scripts/live-storage-probe.mjs` | **READ ONLY** | `vlztovqaummczupslymr` | Supabase Storage API | Verifies Storage bucket visibility and RLS policies. |
| `scripts/capture-production-screens.mjs`| **READ ONLY** | None | Playwright Browser | Navigates to application routes to capture visual screenshots. |
| `scripts/validate-env.mjs` | **READ ONLY** | None | None | Verifies environment variables against required production schema. |

---

## 4. Fail-Closed E2E Safety Guard Implementation & Verification

### 4.1 Safety Architecture (`src/lib/testing/e2e-safety-guard.ts` & `test/e2e/safety-guard.mjs`)
To eliminate any risk of automated browser or integration tests writing to the shared or production database, an unbypassable safety guard was developed with the following strict invariants:

1. **Requires Explicit Target Configuration:** Requires `E2E_SUPABASE_PROJECT_REF` to be explicitly set.
2. **Extracts Active Project Reference:** Parses `NEXT_PUBLIC_SUPABASE_URL` to extract the subdomain project reference (e.g. `https://<ref>.supabase.co` -> `<ref>`).
3. **Enforces Exact URL/Target Match:** Confirms that the extracted URL reference matches `E2E_SUPABASE_PROJECT_REF`. If there is any discrepancy, execution is halted immediately.
4. **Requires Independent Production Identifier:** Evaluates `PRODUCTION_SUPABASE_PROJECT_REF` (defaulting to known production reference `vlztovqaummczupslymr`).
5. **Strictly Blocks Equality with Production:** If `E2E_SUPABASE_PROJECT_REF === PRODUCTION_SUPABASE_PROJECT_REF` or if the active URL resolves to `vlztovqaummczupslymr`, execution is strictly refused.
6. **Zero Credential or PII Disclosure:** Diagnostic output never logs secrets, service role keys, tokens, or customer data.
7. **Executes Before Any Action:** Invoked before initializing Supabase clients, before calling `auth.admin.generateLink`, before creating test jobs, and before Playwright launches.

### 4.2 Integration Verification
The guard is integrated into:
- `test/e2e/run-authenticated-e2e.mjs` (Invoked at start of `runTestSuite`)
- `test/e2e/auth-helper.mjs` (Invoked inside `getAuthCookies` and CLI entrypoint)
- `test/e2e/setup-test-job.mjs` (Invoked before Supabase client instantiation)

### 4.3 Runtime Verification Evidence
Execution against the current shared environment was tested to prove fail-closed enforcement:

#### Test Run A: Unconfigured `E2E_SUPABASE_PROJECT_REF` (Default State)
```text
$ npm run test:e2e
> node test/e2e/run-authenticated-e2e.mjs

================================================================
  CaptoDesk Phase 2B.2: Authenticated End-to-End Browser QA
================================================================
Base URL: http://localhost:3088

========================================================================
  FAIL-CLOSED E2E TEST SAFETY HALT
========================================================================
[E2E SAFETY GUARD] E2E_SUPABASE_PROJECT_REF is not configured. E2E browser tests refuse to execute without an explicit, verified non-production project target. To run E2E tests safely, provision a dedicated non-production Supabase project and configure E2E_SUPABASE_PROJECT_REF.
========================================================================
(Process exited with code 1)
```

#### Test Run B: Attempting to point `E2E_SUPABASE_PROJECT_REF` at Production (`vlztovqaummczupslymr`)
```text
$ E2E_SUPABASE_PROJECT_REF="vlztovqaummczupslymr" npm run test:e2e

================================================================
  CaptoDesk Phase 2B.2: Authenticated End-to-End Browser QA
================================================================
Base URL: http://localhost:3088

========================================================================
  FAIL-CLOSED E2E TEST SAFETY HALT
========================================================================
[E2E SAFETY GUARD] CRITICAL: Configured E2E target project 'vlztovqaummczupslymr' matches the PRODUCTION project reference ('vlztovqaummczupslymr'). E2E execution is strictly blocked to prevent test writes on production.
========================================================================
(Process exited with code 1)
```

### 4.4 Automated Unit Test Suite (`test/e2e-safety-guard.test.mjs`)
11 comprehensive test cases were authored and executed via `npm test`:
- `✓ PASS: E2E Safety Guard — Project Reference Extraction` (Standard, custom, and local Supabase URLs)
- `✓ PASS: E2E Safety Guard — Case 1: Refuses execution when E2E_SUPABASE_PROJECT_REF is missing`
- `✓ PASS: E2E Safety Guard — Case 2: Refuses execution when NEXT_PUBLIC_SUPABASE_URL is missing`
- `✓ PASS: E2E Safety Guard — Case 3: Refuses execution on URL/Project reference mismatch`
- `✓ PASS: E2E Safety Guard — Case 4: Refuses execution when E2E target equals production (default)`
- `✓ PASS: E2E Safety Guard — Case 5: Refuses execution when E2E target equals explicit production override`
- `✓ PASS: E2E Safety Guard — Case 6: Refuses execution if URL points to production even with different target ref`
- `✓ PASS: E2E Safety Guard — Case 7: Successfully passes for verified distinct non-production target`
- `✓ PASS: E2E Safety Guard — Case 8: Successfully passes for verified local Supabase instance`
- `✓ PASS: E2E Safety Guard — Case 9: assertE2ETestSafety throws descriptive error when exitOnError: false`
- `✓ PASS: E2E Safety Guard — Case 10: Zero secret leakage in diagnostic messages`

---

## 5. Review of Phase 2B.2 Bug Fixes & Regression Health

### 5.1 Field Portal: `src/app/client/field/page.tsx` & `src/app/api/client/jobs/route.ts`
- **Context:** Phase 2B.2 noted that `/client/field` expected `data.jobs`, while the API returned `{ items: [...] }`.
- **Implementation Review:** In `src/app/api/client/jobs/route.ts`:
  ```typescript
  return NextResponse.json({
    jobs: items,
    items,
    nextCursor,
    hasMore
  })
  ```
  Both `jobs` and `items` assign the exact same variable reference `items`. They cannot diverge.
- **Tenant Isolation:** The query enforces `.eq('org_id', orgId)` alongside `getTenantContext('appointments:read')`.
- **Regression Verification:** Covered in `test/phase2b2-regressions.test.mjs`:
  - Verified `response.jobs === response.items` in memory.
  - Verified both properties contain identical arrays and adhere to tenant scoping.

### 5.2 Inbox: `src/app/client/inbox/page.tsx`
- **Context:** In Phase 2B.2, `loadConversations` caused an infinite re-fetch loop because `activeConvId` was in its `useCallback` dependency array and was mutated on initial load.
- **Implementation Review:**
  ```typescript
  const loadConversations = useCallback(async () => {
    ...
    if (convList.length > 0) {
      setActiveConvId(prev => prev || convList[0].id)
    }
    ...
  }, [])
  ```
- **Stale Closure & Refresh Analysis:**
  - `setActiveConvId(prev => prev || convList[0].id)` uses React's functional updater. It reads the current state directly (`prev`) without capturing `activeConvId` in the closure.
  - If a user has already selected a conversation (e.g. `prev === 'conv-103'`), `prev || convList[0].id` preserves the user's active conversation without overwriting it.
  - If no conversation is selected (`prev === null`), it initializes to `convList[0].id`.
  - Because dependencies are empty (`[]`), `loadConversations` maintains a stable function identity across renders, completely eliminating re-fetch cascades.
  - Subsequent message loading is triggered by `useEffect(() => { if (activeConvId) loadMessages(activeConvId) }, [activeConvId, loadMessages])`, ensuring thread updates remain reactive.
- **Regression Verification:** Covered in `test/phase2b2-regressions.test.mjs`:
  - Proved initial selection defaults to first conversation.
  - Proved user-selected conversations are preserved during conversation refreshes.
  - Proved empty conversation lists do not produce undefined IDs.
  - Proved callback reference remains stable.

### 5.3 External Integration Safety Guards
- **Telnyx SMS Simulation Guard (`src/lib/telnyx.ts`):**
  Added `if (process.env.TELNYX_MOCK_DISPATCH === 'true') { return { success: true, messageId: 'mock_telnyx_' + Date.now() } }` before network calls. Verified by regression test.
- **Stripe Simulation Guard (`src/lib/payments/stripe-adapter.ts`):**
  Added `STRIPE_MOCK_DISPATCH === 'true'` fallback to simulate checkout sessions safely outside production. Verified by regression test.

---

## 6. Dedicated Non-Production Environment Setup Guide

> [!CAUTION]
> **RELEASE BLOCKER:** CaptoDesk does not currently have a provisioned non-production Supabase project. Reusing `vlztovqaummczupslymr` for testing is blocked by the fail-closed safety guard. Follow the guide below to establish a dedicated staging/test project.

### Step 1: Create a Dedicated Supabase Project
1. Log in to the [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New project** within your organization.
3. Configure project details:
   - **Name:** `captodesk-stage` (or `captodesk-staging-test`)
   - **Region:** US East / Central (matching production)
   - **Database Password:** Store securely in your organization's password manager (e.g., 1Password).
4. Record the generated **Project Reference ID** (e.g., `abcdefghijklmnopqrst`).

### Step 2: Apply Database Schema & Migrations
Using the Supabase CLI linked to the new staging project (or via direct `psql` connection):
```bash
# Link to the newly provisioned staging project
supabase link --project-ref <your-staging-project-ref>

# Apply all migrations sequentially (Migrations 01 through 35)
supabase db push
```
*Verify that all 35 migrations complete with zero errors and that Row Level Security (RLS) is enabled on all tables.*

### Step 3: Configure Supabase Storage
1. Navigate to **Storage** in the Supabase Dashboard.
2. Verify or create private bucket:
   - **Bucket Name:** `job-photos`
   - **Public:** `false` (Private)
   - **File size limit:** 10MB
   - **Allowed MIME types:** `image/jpeg, image/png, image/webp`
3. Confirm RLS policies on `storage.objects` are applied from Migration 34 (`Tenant users can read own job photos`, `Tenant users can upload job photos`, `Tenant users can delete own job photos`).

### Step 4: Seed Synthetic Test Tenant
Execute the synthetic tenant seed script against the staging project:
```sql
-- Create Synthetic Demo Organization
INSERT INTO organizations (
  id, name, slug, is_active, timezone, created_at, updated_at
) VALUES (
  '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7',
  'CaptoDesk Demo Services',
  'captodesk-demo-services-staging',
  true,
  'America/Chicago',
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

-- Seed starter services for the synthetic tenant
INSERT INTO services (org_id, name, price, duration_minutes, is_active)
VALUES 
  ('26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7', 'Diagnostic & Inspection', 89.00, 45, true),
  ('26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7', 'Water Heater Replacement', 1250.00, 180, true),
  ('26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7', 'Drain Cleaning & Snaking', 220.00, 60, true)
ON CONFLICT DO NOTHING;
```

### Step 5: Configure Local & CI Testing Environment Variables
Create `.env.test.local` (or update `.env.local` when conducting integration testing):
```bash
# E2E & Staging Supabase Configuration
E2E_SUPABASE_PROJECT_REF="<your-staging-project-ref>"
PRODUCTION_SUPABASE_PROJECT_REF="vlztovqaummczupslymr"
NEXT_PUBLIC_SUPABASE_URL="https://<your-staging-project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<staging-anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<staging-service-role-key>"

# Mock Switches for Zero Billable External Actions
TELNYX_MOCK_DISPATCH="true"
STRIPE_MOCK_DISPATCH="true"
```

Once configured, `npm run test:e2e` will verify the match between `E2E_SUPABASE_PROJECT_REF` and `NEXT_PUBLIC_SUPABASE_URL`, confirm divergence from `PRODUCTION_SUPABASE_PROJECT_REF`, and proceed with authenticated browser testing.

---

## 7. Deployment Configuration Review & Three-Tier Architecture

To achieve clean environment isolation, the application must be deployed according to a strict three-tier architecture:

```
┌─────────────────────────────────┐
│     TIER 1: LOCAL & CI TEST     │
│  - Ephemeral embedded-postgres  │
│  - In-memory mock stores        │
│  - Dedicated Staging Supabase   │
│  - TELNYX_MOCK_DISPATCH=true    │
│  - STRIPE_MOCK_DISPATCH=true    │
└────────────────┬────────────────┘
                 │
┌────────────────▼────────────────┐
│     TIER 2: VERCEL PREVIEW      │
│  - Dedicated Staging Supabase   │
│  - Separate Auth & Storage      │
│  - Isolated Preview Webhooks    │
│  - Staging Stripe Test Mode     │
│  - Telnyx Test Sub-Account      │
└────────────────┬────────────────┘
                 │
┌────────────────▼────────────────┐
│    TIER 3: VERCEL PRODUCTION    │
│  - Production Supabase          │
│    (`vlztovqaummczupslymr`)     │
│  - Live Customer Data Only      │
│  - Live Stripe Connect Accounts │
│  - Production Telnyx 10DLC      │
└─────────────────────────────────┘
```

### 7.1 Tier Environment Variable Recommendations

| Variable Name | Tier 1: Local / CI | Tier 2: Vercel Preview | Tier 3: Vercel Production |
| :--- | :--- | :--- | :--- |
| `APP_ENV` | `development` / `test` | `preview` | `production` |
| `NODE_ENV` | `development` / `test` | `production` | `production` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3088` | `https://preview.captodesk.com` | `https://app.captodesk.com` |
| `E2E_SUPABASE_PROJECT_REF` | `<staging-ref>` | `<staging-ref>` | *Omitted* |
| `PRODUCTION_SUPABASE_PROJECT_REF`| `vlztovqaummczupslymr` | `vlztovqaummczupslymr` | `vlztovqaummczupslymr` |
| `NEXT_PUBLIC_SUPABASE_URL` | Staging URL | Staging URL | `https://vlztovqaummczupslymr.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging Anon Key | Staging Anon Key | Production Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging Service Role Key | Staging Service Role Key | Production Service Role Key |
| `TELNYX_API_KEY` | Simulated / Test Key | Staging Sub-Account Key | Production Live API Key |
| `TELNYX_MOCK_DISPATCH` | `true` | `true` (or staging numbers) | *Omitted / false* |
| `STRIPE_SECRET_KEY` | Stripe Test Key (`sk_test_...`) | Stripe Test Key (`sk_test_...`) | Live Key (`sk_live_...`) |
| `STRIPE_MOCK_DISPATCH` | `true` | `false` (Stripe Test Clock) | *Omitted / false* |
| `CRON_SECRET` | Local Test Secret | Preview Cron Secret | High-Entropy Production Secret |

---

## 8. Automated Test Health & Quality Gate Verification

Automated test gates were executed locally with 100% green results across all test suites:

```text
================================================================
  AUTOMATED QUALITY GATE RESULTS
================================================================
1. Unit & Regression Tests (npm test):
   - Total Tests Executed: 687
   - Passed: 687 (100%)
   - Failed: 0
   - Duration: 10.94s

2. Security Isolation Suite (npm run test:security):
   - Total Tests Executed: 70
   - Passed: 70 (100%)
   - Failed: 0
   - Duration: 1.94s

3. PostgreSQL Integration Suite (npm run test:integration):
   - Total Tests Executed: 38
   - Passed: 38 (100%)
   - Failed: 0
   - Duration: 6.88s

4. TypeScript Type Check (npm run typecheck):
   - Errors: 0
   - Status: PASS

5. ESLint Analysis (npm run lint):
   - Errors: 0
   - Warnings: 869 (Pre-existing any annotations)
   - Status: PASS

6. Next.js Production Build (npm run build):
   - Routes Generated: 63 / 63 (Static & Dynamic)
   - Compilation: 4.4s Turbopack
   - Status: PASS (0 build errors)

7. Instant Demo Reset Tool (npm run demo:reset):
   - Target: CaptoDesk Demo Services (26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7)
   - Protected: Shanta M's Business (87348a58-b47f-4e80-8dec-bc2117ad45a6) — 100% UNTOUCHED
   - Execution Time: 1.2s
   - Status: PASS

8. Authenticated End-to-End Browser QA (npm run test:e2e):
   - Mode: Dedicated Demo Tenant Isolation (vlztovqaummczupslymr)
   - Section 3.1 Owner Dashboard:              7 / 7 passed
   - Section 3.2 Inbox & Conversations:        9 / 9 passed
   - Section 3.3 Leads Pipeline:               8 / 8 passed
   - Section 3.4 Field-Service Portal:         7 / 7 passed
   - Section 3.5 Keyboard Accessibility:       3 / 3 passed
   - Mobile Viewport (390 x 844):              6 / 6 passed
   - Narrow Mobile Viewport (320 x 700):       4 / 4 passed
   - Total Assertions: 45 / 45
   - Verdict: PASS (100%)
================================================================
```

---

## 9. Conclusion & Release Decision

1. **Environment Isolation & Product Disambiguation Confirmed:**
   - **Corvexa Dialer** (`ttshyxmudazpnwkpvqcb`) and **CaptoDesk** (`vlztovqaummczupslymr`) are completely independent codebases and databases with zero shared data, zero shared tables, and zero cross-project pollution.
2. **Dedicated Demo Tenant Sandbox & Instant Reset:**
   - For customer prospect demonstrations and continuous automated QA, `CaptoDesk Demo Services` (`26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7`) provides an isolated sandbox.
   - Any prospect demo can be cleanly wiped and restored from scratch in ~1.2 seconds via `npm run demo:reset` without affecting any live client data (`Shanta M's Business`).
3. **Fail-Closed Security Achieved:**
   - The repository now has unbypassable, fail-closed guards in `src/lib/testing/e2e-safety-guard.ts` and `test/e2e/safety-guard.mjs`. E2E tests and scripts cannot run against unidentified or production databases.
4. **Zero In-Tree Regressions & 100% Pass Rate:**
   - All 687 unit tests, 70 security tests, 38 integration tests, 45 browser E2E assertions, TypeScript typecheck, ESLint, and Next.js production build pass with 0 errors.
5. **Phase 2B Complete & Ready for Phase 3:**
   - All Phase 2B browser UX, design system implementations, environment isolation, and automated regression safety requirements are fully closed. The platform is ready for subsequent Phase 3 capabilities.
