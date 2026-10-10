# CAPTODESK — PHASE 4 PRODUCTION READINESS AUDIT

**Audit Date**: October 9, 2026  
**Repository**: `c:\Users\mskar\captodesk`  
**Commit/Version**: `23ab358be1cb1e20ae76f96955e4e32a54b1006b` (`main`)  
**Auditor Roles**: Principal SaaS Production Engineer, SRE, DevOps Engineer, QA Lead, Security Engineer, and SaaS Launch Readiness Auditor  

---

## EXECUTIVE SUMMARY

A comprehensive, read-only production readiness and commercial launch audit was conducted across the CaptoDesk codebase following the completion of security hardening, webhook idempotency, worker scheduling, appointment overlap prevention, and the P0-01 Telnyx DID provisioning remediation.

The core distributed systems and security invariants of CaptoDesk are **solid and resilient**:
1. **Database-level appointment concurrency**: Protected by PostgreSQL GiST exclusion constraints (`tstzrange` + `org_id` with `=`), verified with real concurrent PostgreSQL transactions.
2. **Webhook idempotency**: Protected by atomic database claims (`claim_webhook_event`), lock timeouts, and partial unique indexes (`idx_messages_org_telnyx_id`).
3. **Worker queue safety**: Protected by PostgreSQL `SELECT FOR UPDATE SKIP LOCKED` batching, bounded time budgets (25s ceiling, 5s safety margin), and exponential backoff retry/dead-lettering.
4. **Telephony safeguards**: Completely eliminated synthetic `+1999` and `Math.random()` numbers. Real Telnyx API contract implemented with fail-closed production semantics, crash reconciliation, and outbound sender verification.
5. **Test & Build Quality**: All 434 tests pass (`npm test`), 55/55 security tests pass, 15/15 real Postgres integration tests pass, zero TypeScript errors (`tsc --noEmit`), zero ESLint errors, and clean Next.js 16 production build across all 58 routes.

However, if a paying customer signs up tomorrow, **the platform cannot yet operate on 100% self-serve autopilot**. It requires a **concierge / operator-assisted onboarding model** due to 4 operational and UI gaps:
1. The client onboarding form (`/client/onboarding`) does not submit a phone number or area code to trigger the Telnyx provisioning API; organizations are created in `pending_number` state and require operator activation.
2. The client dashboard lacks a Service Catalog management screen (`/client/services` does not exist), meaning trade services beyond the default "General Service" must be configured by the operator.
3. CaptoDesk lacks an automated self-serve SaaS subscription checkout for the contractor; customer subscription billing is handled out-of-band and manually toggled to `active` in `/admin/organizations`.
4. Severe configuration drift exists in local `.env.local` (mismatched Supabase project keys and missing Telnyx public key) which would be fatal if copied to production without verification.

### OVERALL VERDICT:
**PRODUCTION READINESS: CONDITIONAL GO**

*CaptoDesk can safely onboard and deliver service to its first paying customer tomorrow under an operator-assisted concierge go-live procedure, provided that production environment variables are verified, the operator triggers Telnyx DID assignment, and trade services are entered.*

---

## P0 FINDINGS (BLOCKERS TO RAW DEPLOYMENT)

### P0-ENV-01: Fatal Project ID Mismatch and Incomplete Configuration in `.env.local`
- **Location**: `.env.local`
- **Description**: 
  - `NEXT_PUBLIC_SUPABASE_URL` points to project `vlztovqaummczupslymr.supabase.co`.
  - `SUPABASE_SERVICE_ROLE_KEY` contains a JWT issued for a completely different project ref (`ttshyxmudazpnwkpvqcb`).
  - `TELNYX_PUBLIC_KEY` is completely empty.
  - `CRON_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `TELNYX_MESSAGING_PROFILE_ID` are unconfigured.
- **Impact**: If `.env.local` values were copied to Vercel/Production, all server-side operations (admin client, automations worker, webhook claims, public token lookups) would fail immediately with HTTP 401 `[SECURITY FATAL]` errors, and all inbound Telnyx webhooks would be rejected due to missing public keys.
- **Condition for Go-Live**: Production Vercel environment variables MUST be configured using matching credentials from the active production Supabase and Telnyx projects.

---

## P1 FINDINGS (OPERATIONAL / LAUNCH BLOCKERS)

### P1-OPS-01: Onboarding UI Does Not Trigger Telnyx DID Provisioning
- **Location**: `src/app/client/onboarding/page.tsx` & `src/app/api/onboarding/route.ts`
- **Description**: The onboarding route only calls `provisionOrganizationPhoneNumber()` if `body.requestedNumber` or `body.telnyxPhoneNumber` is passed. However, the client onboarding form (`/client/onboarding`) never collects or sends either field. Organizations are created with `telnyx_phone_number: null` and `phone_provisioning_status: 'pending_number'`.
- **Impact**: When the customer reaches `/client/dashboard` and `/client/settings`, their phone line displays "Provisioning..." indefinitely. Neither the client settings nor Super Admin `/admin/organizations` has a button to trigger or retry phone provisioning.
- **Operator Workaround**: Operator must execute a provisioning script or call `provisionOrganizationPhoneNumber(supabase, { orgId })` to purchase and assign the customer's Telnyx DID.

### P1-OPS-02: Missing Service Catalog Management Screen in Client Dashboard
- **Location**: `src/app/client/` (No `services` route exists)
- **Description**: While P1-01 remediation auto-seeds a "General Service" (60 mins, $0) so the public booking page loads, the client portal contains no UI screen for the business owner to add, edit, price, or delete their services.
- **Impact**: A contractor (e.g. AC repair, plumbing) cannot add their custom trade services ("AC Maintenance $89", "Emergency Service Call $149") through the web app.
- **Operator Workaround**: Operator must insert or update the tenant's services catalog directly in Supabase or via curl to `/api/client/services`.

### P1-OPS-03: Lack of Automated Self-Serve SaaS Subscription Billing
- **Location**: `src/lib/payments/stripe-adapter.ts` & `src/app/admin/organizations/page.tsx`
- **Description**: The Stripe integration in CaptoDesk is strictly built for **tenant customer invoicing** (contractor billing a homeowner for completed jobs). There is no automated Stripe Subscription checkout flow for a business to pay CaptoDesk for access to the software.
- **Impact**: Customer payment must be collected out-of-band (e.g. manual Stripe payment link, invoice, or credit card charge), and their subscription status (`active`) must be toggled manually by the operator in Super Admin `/admin/organizations`.

### P1-OPS-04: Migration 31 Data Loss Risk on Historical Duplicate Services
- **Location**: `supabase/migrations/31_default_service_catalog_idempotency.sql`
- **Description**: Migration 31 executes `DELETE FROM public.services WHERE id IN (...)` for duplicate services partitioned by `(org_id, lower(trim(name)))`. Because child foreign keys (`appointments.service_id`, `quotes.service_id`, `jobs.service_id`) specify `ON DELETE SET NULL`, any historical appointments or quotes referencing the deleted duplicate service ID have their `service_id` set to `NULL` rather than re-pointed to the surviving service record.
- **Impact**: Not an issue for a brand-new customer, but poses a data-integrity risk for pre-existing tenants if Migration 31 is executed against a populated database without migrating child foreign keys first.

### P1-OBS-01: Zero External Alerting Infrastructure
- **Location**: `src/lib/observability/`
- **Description**: There is no external alerting mechanism (no Sentry, PagerDuty, Slack webhooks, or error emails). 
- **Impact**: If the background worker halts, Stripe webhooks fail, or Telnyx rejects outbound SMS, no automated alert is dispatched. Outages can only be discovered if the operator manually logs into `/admin/system-health` or inspects Vercel/Supabase logs.

---

## P2 FINDINGS (IMPORTANT RESILIENCE & USABILITY GAPS)

### P2-UI-01: No Automation Execution History or Self-Serve Retry in Client Portal
- **Location**: `src/app/client/automations/page.tsx`
- **Description**: The `/client/automations` screen only contains templates and settings toggles. Contractors cannot view their automation run history, inspect failed executions, or click retry.
- **Impact**: If a missed call SMS or review request fails, the contractor cannot see why or retry it; they must contact the CaptoDesk operator to inspect `/admin/events` and trigger `/api/automations/runs/[id]/retry`.

### P2-DB-01: Hardcoded 100-Limit on Inbox Conversations Without Pagination
- **Location**: `src/app/api/client/inbox/route.ts`
- **Description**: The inbox conversations endpoint hardcodes `.limit(100)` without cursor or offset pagination.
- **Impact**: Once a busy contractor accumulates more than 100 customer conversations, older conversations become inaccessible in the inbox UI.

### P2-REC-01: Disaster Recovery Procedure Unverified
- **Location**: Operational Infrastructure
- **Description**: No automated database backup export scripts, WAL archiving tests, or Point-In-Time-Recovery (PITR) restoration drills have been executed.
- **Classification**: **RECOVERY PROCEDURE UNVERIFIED**.

### P2-SEC-01: Transitive Dev Dependency Vulnerabilities in Production Bundle
- **Location**: `package.json`
- **Description**: `shadcn: ^4.19.0` is listed under `"dependencies"` rather than `"devDependencies"`. This pulls `fast-glob` -> `micromatch` -> `braces`, resulting in 7 high-severity prototype/stack-exhaustion vulnerabilities in `npm audit --omit=dev`.
- **Impact**: While not directly exposed to untrusted input at runtime, CLI dev tools should not reside in the production bundle.

---

## P3 FINDINGS (LOW SEVERITY / CODE HYGIENE)

### P3-FE-01: Typeless Package.json Warning on Module Imports
- **Location**: `package.json`
- **Description**: Node.js test runner emits `MODULE_TYPELESS_PACKAGE_JSON` warning when executing test files importing `.ts` files because `"type": "module"` is omitted.

### P3-LOG-01: In-Memory Circular Log Buffer Size
- **Location**: `src/lib/observability/logger.ts`
- **Description**: The in-memory log buffer for live platform tailing holds 250 entries, rolling over quickly under high webhook volume.

---

## ENVIRONMENT CONFIGURATION AUDIT

Every environment variable across the entire repository was extracted and analyzed:

| Variable | Required? | Used By | Production Required? | Failure Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser & Server clients | Yes | Throws immediately; app cannot start or connect. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser Auth & Client queries | Yes | Supabase client fails to authenticate public requests. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Webhooks, Worker, Admin, Tokens | Yes | **Fail-closed**: Throws `[SECURITY FATAL]`; refuses downgrade. |
| `SUPABASE_JWT_SECRET` | Optional | Session verification fallback | No | Falls back to Supabase standard auth client. |
| `SUPER_ADMIN_EMAILS` | Yes | Platform Super Admin (`/admin`) | Yes | **Fail-closed**: Non-matching users demoted to `owner`. |
| `CRON_SECRET` | Yes | Worker endpoint (`/api/automations/worker`) | Yes | **Fail-closed**: Constant-time check rejects without 401. |
| `TELNYX_API_KEY` | Yes | DID Orders, Search, SMS, Calls | Yes | **Fail-closed**: Throws error; refuses to fake SMS. |
| `TELNYX_PUBLIC_KEY` | Yes | Ed25519 Webhook Signature check | Yes | **Fail-closed**: Webhooks rejected with 401. |
| `TELNYX_CONNECTION_ID` | Yes | Number Orders API (Voice routing) | Yes | Voice calls cannot route to Telnyx connection. |
| `TELNYX_MESSAGING_PROFILE_ID` | Yes | Number Orders API (SMS webhooks) | Yes | Outbound/Inbound SMS webhooks not attached to profile. |
| `TELNYX_PHONE_NUMBER` | Optional | Platform default outbound caller | No | Falls back to organization provisioned DID. |
| `STRIPE_SECRET_KEY` | Yes | Invoice Checkout sessions | Yes | **Fail-closed**: Throws error; refuses mock checkout in prod. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe Webhook signature verification | Yes | **Fail-closed**: Webhook rejected with 400. |
| `BOOKING_CSRF_SECRET` | Optional | Cross-origin booking token sign | No | Falls back to internal cryptographic derivation. |
| `NEXT_PUBLIC_APP_URL` | Yes | Invoices, quotes, review redirect URLs | Yes | Defaults to `http://localhost:3000` (breaks links if omitted). |
| `UPSTASH_REDIS_REST_URL` | Optional | Distributed edge rate-limiting | No | Gracefully falls back to Supabase RPC & in-memory store. |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash Redis authentication | No | Gracefully falls back to Supabase RPC & in-memory store. |
| `WORKER_MAX_DURATION_MS` | Optional | Worker runtime budget ceiling | No | Defaults to 25,000ms. |
| `WORKER_SAFETY_MARGIN_MS` | Optional | Worker shutdown safety margin | No | Defaults to 5,000ms. |
| `APP_ENV` / `NODE_ENV` | Yes | Production tier checks | Yes | Determines whether fail-closed security rules apply. |

---

## DATABASE READINESS

All 33 migrations were inspected in chronological dependency order:
- **Order & Structure**: Migrations apply sequentially from `02_auth_and_onboarding.sql` through `33_real_telnyx_did_provisioning.sql`.
- **Idempotency**: All migrations use `IF EXISTS`, `IF NOT EXISTS`, and `DO $$` conditional execution blocks.
- **Constraints & Indexes**:
  - Migration 32 enforces PostgreSQL GiST exclusion on `(org_id, tstzrange(start_time, end_time, '[)'))` for active appointments.
  - Migration 33 enforces unique partial index `idx_telnyx_phone_numbers_org_active` preventing duplicate active DIDs per tenant.
  - Migration 28 enforces unique partial index `idx_messages_org_telnyx_id` preventing duplicate SMS records.
  - Migration 16 provides comprehensive composite indexing on all tenant IDs, created timestamps, and status filters.
- **RLS & Security**: Comprehensive RLS enabled across all operational tables; privileged server operations strictly isolated via `createAdminClient()`.
- **Migration 31 Risk**: Inspected in detail (P1-04). Dedupes services via hard delete without cascade foreign-key remapping. Safe on greenfield/new customer databases; risky on historical databases with duplicate services.

---

## WORKER READINESS

Inspected `src/lib/automations/worker.ts`:
- **Scheduling**: Invoked via `GET/POST /api/automations/worker` with `Bearer $CRON_SECRET`.
- **Locking**: Uses PostgreSQL `claim_due_automation_runs` RPC with `SELECT FOR UPDATE SKIP LOCKED`. Concurrent workers never process overlapping jobs.
- **Serverless Time Budget**: Defaults to 25s execution ceiling with 5s safety margin. Exits cleanly before Vercel 30s timeout.
- **500-Job Draining Analysis**:
  - Batch size is 25, max batches is 10 (up to 250 jobs per invocation).
  - If 500 jobs are waiting, the worker safely processes up to 250, records stop reason `max_batches_reached`, and exits cleanly.
  - The next scheduled cron run immediately claims the remaining 250 jobs.
  - Multiple concurrent cron instances safely drain the queue in parallel without collision.
- **Failure Resilience**: Individual job failures do not abort the batch. Exponential backoff and dead-letter queue prevent infinite retries.

---

## WEBHOOK READINESS

Inspected Stripe and Telnyx webhook implementations:
- **Signature Verification**:
  - Stripe: HMAC SHA-256 via `stripe.webhooks.constructEvent()`.
  - Telnyx: Ed25519 asymmetric signature via `tweetnacl` using `TELNYX_PUBLIC_KEY`.
- **Atomic Lifecycle**:
  - `claimWebhookEvent()` locks the event ID in `processed_events`.
  - Duplicate events return HTTP 200 `{ duplicate: true }`.
  - Concurrent executions wait 1.5s for resolution; if unresolved, return HTTP 429 for provider retry.
  - Completed events marked with `completed_at`.
  - Failed events record error diagnostic and return HTTP 500 to trigger provider exponential retry.

---

## TELNYX READINESS

- **No Synthetic Numbers**: Repo-wide scan confirms zero occurrences of `+1999`, `+15555550100`, or `Math.random()` in phone generation logic.
- **API Contract**: Implemented using official Telnyx v2 `available_phone_numbers`, `number_orders`, and `customer_reference` polling.
- **Inbound Routing**: `resolveOrganizationByPhoneNumber()` strictly rejects unverified numbers.
- **Outbound Sender Guard**: `verifyTenantOutboundSender()` verifies the sender is active, verified, and tenant-bound before any SMS dispatch.
- **Status Designation**:
  ```
  P0-01 LIVE PROVIDER VERIFICATION:
  DEFERRED UNTIL FIRST PAYING CUSTOMER
  ```

---

## STRIPE READINESS

- **Commercial Invoicing Flow**: Customer receives invoice via unguessable token (`/invoice/[token]`), clicks pay, creates Stripe Checkout session in `mode: 'payment'`.
- **Webhook Fulfillment**: On `checkout.session.completed`, Stripe webhook idempotently marks invoice paid, generates payment record, and logs audit event.
- **Tamper Protection**: Payment status is never accepted from client query parameters (`status=paid`); only verified cryptographic webhooks transition invoice state.
- **SaaS Billing Gap**: CaptoDesk platform subscriptions are not automated via Stripe Subscriptions; operator must handle software billing out-of-band and toggle tenant status.

---

## DEPLOYMENT READINESS

Executed complete build and test pipeline:
- **`npm ci --dry-run`**: **PASS** (Lockfile is clean and synchronized).
- **`npm test`**: **PASS** (434 / 434 tests passed).
- **`npm run test:security`**: **PASS** (55 / 55 tests passed).
- **`npm run test:integration`**: **PASS** (15 / 15 tests passed on real PostgreSQL).
- **`npm run typecheck`**: **PASS** (Zero TypeScript compilation errors).
- **`npm run lint`**: **PASS** (Zero ESLint errors).
- **`npm run build`**: **PASS** (Compiled all 58 Next.js routes successfully).

---

## OBSERVABILITY

- **Structured Logging**: All backend services use `createStructuredLogger` emitting standard JSON logs with `organization_id`, `request_id`, `event_id`, and `duration_ms`.
- **Traceability**: Operator can trace any missed call from call arrival -> lead creation -> SMS dispatch -> customer reply -> booking via `/admin/events`.
- **Credential Sanitization**: Secrets, API keys, card numbers, and authorization tokens are redacted via `redactor.ts`.
- **Manual Automation Retry**: Operator can safely retry failed jobs via `POST /api/automations/runs/[id]/retry`.

---

## BACKUP & RECOVERY

- **Classification**: **RECOVERY PROCEDURE UNVERIFIED**.
- **Assessment**: While hosted Supabase provides daily physical backups, there are no repository-level export scripts, WAL archiving tests, or documented restoration playbooks.

---

## FRONTEND & MOBILE READINESS

- **Empty States**: Handled cleanly across Dashboard, Leads, Invoices, Calendar, Quotes, and Jobs using null-coalescing defaults.
- **Placeholder Data**: Zero fake/dummy data arrays hardcoded in client views.
- **Mobile Viewport Testing**: Evaluated responsive layouts at 375px, 390px, and 430px widths:
  - Navigation collapses cleanly into mobile hamburger drawer.
  - Booking wizard uses responsive full-width card layout (`max-w-xl mx-auto`).
  - Wide data tables include horizontal scroll wrappers (`overflow-x-auto`).
  - Form inputs meet 40px+ tap-target standards (`h-10 sm:h-9`).

---

## CUSTOMER OPERATIONS

If the first customer calls saying *"My missed call wasn't recovered,"* the operator can diagnose it in 3 steps:
1. Open `/admin/events`, filter by category `call` and `sms` for the customer's organization ID.
2. Inspect the call event payload: verify whether Telnyx fired the webhook, whether the call was classified as missed, and whether quiet hours were active.
3. If an automation run failed, inspect the error stack in `/admin/events` and click or invoke `POST /api/automations/runs/[id]/retry` to re-execute after resolving the underlying condition.

---

## FIRST CUSTOMER LAUNCH CHECKLIST

### Phase 1: Before Customer Pays
1. [ ] Confirm customer service business name, primary cell phone number, and physical business address.
2. [ ] Identify customer preferred 3-digit local area code for their dedicated CaptoDesk DID.
3. [ ] Agree upon subscription terms (e.g. $99/mo with 30-day money-back guarantee).

### Phase 2: After Payment
4. [ ] Collect payment out-of-band (Stripe payment link, direct invoice, or card charge).
5. [ ] Create contractor auth account in Supabase or send them invite link to `/client/login`.

### Phase 3: Configuration & Provisioning (Operator-Assisted)
6. [ ] Log into Super Admin (`/admin/organizations`) and set `Subscription Status = 'active'`.
7. [ ] Ensure production Vercel has matching `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`, `TELNYX_CONNECTION_ID`, `TELNYX_MESSAGING_PROFILE_ID`, and `CRON_SECRET`.
8. [ ] Execute provisioning for the tenant's DID:
   ```bash
   node -e "import('./src/lib/telephony/provisioning.ts').then(m => m.provisionOrganizationPhoneNumber(adminDb, { orgId: '<ORG_ID>', preferredAreaCode: '<AREA_CODE>' }))"
   ```
9. [ ] Confirm DID appears as `active` and `verified` in `telnyx_phone_numbers` table.
10. [ ] Configure customer trade services in `services` table (or verify default 'General Service').
11. [ ] Click `1-Click Submit` on `/admin/organizations` to file the customer's 10DLC brand with Telnyx.

### Phase 4: First Live Test Call & Go-Live
12. [ ] Test Inbound Call: Place a test call from an external phone to the provisioned Telnyx DID; verify carrier conditional call forwarding dial codes (`*71<DID>` on contractor's personal phone).
13. [ ] Let call ring out to missed status.
14. [ ] Verify contractor receives immediate text-back SMS within 5 seconds.
15. [ ] Reply to SMS as the customer; verify conversation appears in `/client/inbox`.
16. [ ] Open public booking link (`https://app.captodesk.com/book/<slug>`); submit test booking.
17. [ ] Verify appointment displays on `/client/calendar` and confirmation SMS is dispatched.
18. [ ] Hand over dashboard access to customer.

### Phase 5: First 24 Hours & 7 Days
19. [ ] Monitor `/admin/system-health` and `/admin/events` for any failed webhook or automation run.
20. [ ] Check worker drain rates at `/api/health/worker`.
21. [ ] Review customer inbox to ensure all missed calls are receiving automated responses.

---

## FINAL AUDIT CLASSIFICATION

```
SECURITY: PASS
INFRASTRUCTURE: PASS
PHASE 3 WORKFLOWS: PASS
P0-01 TELNYX IMPLEMENTATION: PASS
P0-01 LIVE TELNYX: DEFERRED
PHASE 4 PRODUCTION READINESS: CONDITIONAL GO

P0: 1 (Production environment configuration alignment)
P1: 5 (Assisted provisioning, service UI, manual SaaS billing, migration 31 historical risk, external alerting)
P2: 4 (Client retry UI, inbox 100-limit, backup verification, dev dependency audit)
P3: 2 (Typeless package warning, log buffer size)

RECOMMENDED NEXT STEP:
Implement an operator "1-Click Order & Provision DID" action button in Super Admin (/admin/organizations) to eliminate manual terminal execution for tenant phone provisioning.
```
