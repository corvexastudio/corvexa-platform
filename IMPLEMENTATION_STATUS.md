# CaptoDesk Implementation Status & Technical Debt Audit
**Author:** Senior Software Architect & Lead Auditor  
**Codebase:** CaptoDesk (Phase 0 Audit)  
**Date:** October 2026  
**Status:** Comprehensive Baseline & Prioritized Remediation Plan  

---

## 1. Executive Summary

This document provides a complete audit of all software components, API endpoints, database interactions, and business logic within CaptoDesk. It details the status of each component (Working, Partial, Broken, Mock), cataloging 14 deep-seated technical pain points, architectural defects, and security flaws discovered during Phase 0.

It concludes with a phased, four-tier engineering roadmap (**P0 Production Blockers**, **P1 Required for V1**, **P2 Required for V1.5**, and **P3 Future Capabilities**) designed to transform CaptoDesk into an enterprise-grade, resilient, multi-tenant HVAC/Contractor automation platform.

---

## 2. Comprehensive Component Status Matrix

### 2.1 User Interface & Client Portal (`/client/*`)

| Route / Component | File Path | Status | Operational Capabilities | Deficiencies & Failures |
|---|---|---|---|---|
| **Client Login** | `src/app/client/login/page.tsx` | **WORKING** | Google OAuth PKCE initiation via `@supabase/ssr`, dark aesthetic. | None. Production-ready. |
| **Client Onboarding** | `src/app/client/onboarding/page.tsx` | **PARTIAL** | Collects business name and forwarding phone number. | Hardcodes assigned Telnyx number; fails to populate `automation_settings.config` correctly. |
| **Client Dashboard** | `src/app/client/dashboard/page.tsx` | **WORKING** | Fetches tenant metrics (missed calls, active leads, unread count). | Relies on client-side Supabase query rather than cached server action. |
| **Conversations Inbox** | `src/app/client/inbox/page.tsx` | **PARTIAL** | Renders 2-way SMS threads, canned snippets, real-time message stream. | Sends outbound SMS via unauthenticated `/api/messages/send`; no optimistic rollback. |
| **Leads Pipeline** | `src/app/client/leads/page.tsx` | **WORKING** | Kanban-style stages (`new`, `contacted`, `booked`, `lost`), urgency tags. | Fully functional client-side Supabase queries. |
| **Customer Directory** | `src/app/client/customers/page.tsx` | **WORKING** | Lists customer contacts, search filter, TCPA opt-out badge display. | Fully functional. |
| **Appointment Calendar** | `src/app/client/calendar/page.tsx` | **WORKING** | Displays scheduled visits, estimate consultations, status tags. | Fully functional read interface. |
| **Automations Control** | `src/app/client/automations/page.tsx` | **PARTIAL** | Edits business hours, auto-reply SMS templates, cooldown hours. | Updates `organizations` columns directly instead of `automation_settings` module config. |
| **Activity Stream** | `src/app/client/activity/page.tsx` | **BROKEN** | Intended to display telephony audit trail and retry failed dispatches. | **Schema Mismatch:** Queries non-existent columns (`type`, `delivery_status`, `retry_count`). Page fails or displays empty data. |
| **Reviews Engine** | `src/app/client/reviews/page.tsx` | **BROKEN** | Dispatches review invite SMS; shows metrics. | **Misleading Metric:** Counts `activity_logs.delivery_status = 'delivered'` as actual Google reviews posted. Queries invalid column `type`. |
| **Settings** | `src/app/client/settings/page.tsx` | **WORKING** | Carrier forwarding setup instructions (`*71`), timezone selector. | Fully functional. |
| **Team Management** | `src/app/client/team/page.tsx` | **BROKEN** | Displays team members; modal to invite staff. | Invites dispatch to a mock API endpoint; selects invalid role `client_member` not in DB check constraint. |

---

### 2.2 Super Admin Cockpit (`/admin/*`)

| Route / Component | File Path | Status | Operational Capabilities | Deficiencies & Failures |
|---|---|---|---|---|
| **Admin Overview** | `src/app/admin/page.tsx` | **BROKEN (SECURITY)** | Aggregates platform MRR, total tenants, total calls, live feed. | **No Auth Guard:** Publicly accessible to unauthenticated visitors; relies on open RLS. |
| **Client Tenants** | `src/app/admin/organizations/page.tsx` | **BROKEN (SECURITY)** | Tenant roster, activate/pause missed call engine. | Unauthenticated access; toggle status invokes broken API column. |
| **Live Sales Simulator** | `src/app/admin/simulator/page.tsx` | **BROKEN (SECURITY)** | Demonstrates instant SMS reply to prospect phone numbers. | Invokes unauthenticated, unthrottled `/api/admin/demo-simulator` endpoint. |
| **Platform Analytics** | `src/app/admin/analytics/page.tsx` | **BROKEN (SECURITY)** | Recharts visualization of missed calls, reviews, and leads over time. | Unauthenticated access; pulls tenant data without super-admin verification. |
| **Carrier Health** | `src/app/admin/system-health/page.tsx` | **WORKING (STATIC)** | Displays operational status of Telnyx webhooks and Supabase. | Latency checks are simulated/static. |

---

### 2.3 Application & Webhook APIs (`src/app/api/*`)

| Endpoint Route | File Path | Status | Operational Capabilities | Deficiencies & Failures |
|---|---|---|---|---|
| `POST /api/messages/send` | `src/app/api/messages/send/route.ts` | **BROKEN (SECURITY)** | Dispatches outbound SMS via Telnyx and inserts message row. | **Zero Auth Check:** Any unauthenticated actor can send paid SMS. |
| `POST /api/admin/demo-simulator` | `src/app/api/admin/demo-simulator/route.ts` | **BROKEN (SECURITY)** | Dispatches live demo SMS to prospect number. | **Zero Auth Check & No Rate Limit:** Public SMS open-relay vulnerability. |
| `POST /api/webhooks/telnyx/voice` | `src/app/api/webhooks/telnyx/voice/route.ts` | **BROKEN (LOGIC & SEC)** | Ingests telephony events from Telnyx. | **No Signature Verification:** Accepts spoofed webhooks. Prematurely triggers on `call.initiated`. Doesn't check if call was answered on `call.hangup`. TOCTOU idempotency race condition. |
| `POST /api/webhooks/telnyx/messages` | `src/app/api/webhooks/telnyx/messages/route.ts` | **BROKEN (SECURITY)** | Ingests inbound SMS and threads conversation. | **No Signature Verification:** Allows forged inbound SMS injection. TOCTOU idempotency race condition. |
| `POST /api/webhooks/twilio/voice` | `src/app/api/webhooks/twilio/voice/route.ts` | **DEAD CODE** | Legacy Twilio webhook handler. | Queries non-existent columns (`twilio_number`, `type`, `status`). Dead code. |
| `POST /api/onboarding` | `src/app/api/onboarding/route.ts` | **PARTIAL** | Creates organization, links user profile as owner. | Inserts invalid column `settings` into `automation_settings` (schema requires `config`). Hardcodes single Telnyx DID across all tenants. |
| `POST /api/reviews/send` | `src/app/api/reviews/send/route.ts` | **WORKING** | Verifies auth session; dispatches review request text via Telnyx. | Inserts into `activity_logs` using schema format, but frontend views query legacy format. |
| `POST /api/team/invite` | `src/app/api/team/invite/route.ts` | **MOCK** | Validates session. | Rejects valid `owner` role with 403; returns mock JSON without invoking Supabase admin invite. |
| `POST /api/admin/organizations/toggle-status` | `src/app/api/admin/organizations/toggle-status/route.ts` | **BROKEN** | Checks super-admin role. | Updates column `status` instead of `subscription_status` on `organizations` table. Fails with Postgres error. |

---

### 2.4 Application Services & Utilities (`src/lib/*`)

| Service Module | File Path | Status | Operational Capabilities | Deficiencies & Failures |
|---|---|---|---|---|
| **Call Recovery Engine** | `src/lib/services/call-recovery.ts` | **PARTIAL** | Evaluates duration, opt-out, cooldown, and dispatches auto-reply SMS. | Queries `organizations` assuming 1:1 DID mapping. Does not run inside a serializable transaction. |
| **SMS Threading Engine** | `src/lib/services/sms-handler.ts` | **WORKING** | Processes inbound SMS, handles `STOP`/`START` opt-out compliance. | Fully handles TCPA carrier compliance keywords. |
| **Safety & Time Rules** | `src/lib/services/safety-rules.ts` | **BROKEN (LOGIC)** | Short call filter, keyword matching, business hours check. | **Timezone Defect:** `now.getDay()` executes in server UTC while times are formatted in local timezone, comparing mismatched days. |
| **Telnyx Adapter** | `src/lib/telnyx.ts` | **PARTIAL** | Dispatches REST SMS via `https://api.telnyx.com/v2/messages`, formats E.164. | Missing Ed25519 signature verification utility; missing call control hangup commands. |

---

## 3. Deep-Dive of Identified Technical Pain Points

### Pain Point 1: Unauthenticated Outbound SMS Relay (`/api/messages/send`)
- **Code Reference:** `src/app/api/messages/send/route.ts:5-23`
- **Root Cause:** The endpoint instantiates Supabase directly using server-level keys without checking `supabase.auth.getUser()`.
- **Business Impact:** High financial risk. An automated script can abuse the endpoint to dispatch unlimited SMS messages, driving up the agency's Telnyx bill and causing carrier blacklisting.
- **Remediation:** Enforce `@supabase/ssr` user authentication; verify user belongs to the tenant that owns `conversation_id`.

### Pain Point 2: Open Public Demo Simulator (`/api/admin/demo-simulator`)
- **Code Reference:** `src/app/api/admin/demo-simulator/route.ts:4-21`
- **Root Cause:** Zero authentication checks and zero rate limiting on an endpoint that triggers external Telnyx SMS dispatches.
- **Business Impact:** High exposure to toll fraud, SMS bombing, and carrier compliance violation penalties.
- **Remediation:** Restrict to authenticated `super_admin` users, or guard with Cloudflare Turnstile and strict IP rate limiting (1 request per IP per 24 hours).

### Pain Point 3: Telnyx Webhooks Lack Cryptographic Ed25519 Verification
- **Code Reference:** `src/app/api/webhooks/telnyx/voice/route.ts:5-22`, `src/app/api/webhooks/telnyx/messages/route.ts:5-20`
- **Root Cause:** Missing signature verification logic; `TELNYX_PUBLIC_KEY` in `.env.local` is empty.
- **Business Impact:** Adversaries can forge webhook payloads to inject fake calls, trigger unwanted auto-reply SMS to innocent phone numbers, and pollute CRM lead data.
- **Remediation:** Populate `TELNYX_PUBLIC_KEY` and verify `telnyx-signature-ed25519` and `telnyx-timestamp` headers against raw request body using Node.js crypto SPKI / Ed25519 verification.

### Pain Point 4: Supabase RLS Overly Permissive (`anon` Grants)
- **Code Reference:** `supabase/schema.sql:242-243, 278-304`, `supabase/migrations/02_auth_and_onboarding.sql:10-15, 36-84`
- **Root Cause:** `anon` was granted `SELECT` on all `organizations` and `INSERT/UPDATE` on calls, messages, and contacts as a temporary workaround for serverless webhooks.
- **Business Impact:** Any anonymous visitor with the public anon key can read all tenant profiles and insert fraudulent records into any tenant's CRM.
- **Remediation:** Revoke all unauthenticated `anon` grants. All backend webhooks must use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS internally.

### Pain Point 5: Super Admin Cockpit Completely Unprotected
- **Code Reference:** `src/proxy.ts:49-55`, `src/app/admin/layout.tsx:25-30`
- **Root Cause:** Proxy passes `/admin` requests without checking user authentication or the `super_admin` role.
- **Business Impact:** Complete exposure of all tenant data, MRR metrics, telephony settings, and simulator tools to unauthenticated visitors.
- **Remediation:** Add proxy-level redirect for unauthenticated users on `/admin/*` and a server layout role guard verifying `role === 'super_admin'`.

### Pain Point 6: Broken Team Invitations & Mock Implementation
- **Code Reference:** `src/app/api/team/invite/route.ts:15-28`, `src/app/client/team/page.tsx:21`
- **Root Cause:** API endpoint explicitly excludes `'owner'` role (returns 403) and returns a mock success string without invoking Supabase Admin API. Frontend attempts to invite with role `client_member` which violates DB schema check constraint.
- **Business Impact:** Legitimate contractor account owners cannot invite team members, dispatchers, or office managers.
- **Remediation:** Permit `'owner'` role, map invited roles to DB enum (`client_admin`, `dispatcher`), and execute `supabaseAdmin.auth.admin.inviteUserByEmail`.

### Pain Point 7: Multi-Tenant DID Collision Across Tenants
- **Code Reference:** `src/app/api/onboarding/route.ts:41-53`, `src/lib/services/call-recovery.ts:21-29`
- **Root Cause:** Every onboarded tenant is assigned the same hardcoded fallback Telnyx number (`+16823808060`).
- **Business Impact:** When a customer calls `+16823808060`, `processMissedCall` fails with `.single()` error or attributes calls to the wrong contractor.
- **Remediation:** Enforce a dedicated Telnyx DID per tenant or implement an inventory pool allocation system during onboarding.

### Pain Point 8: Flawed Missed-Call Detection in Voice Webhook
- **Code Reference:** `src/app/api/webhooks/telnyx/voice/route.ts:18-21`
- **Root Cause:** Endpoint accepts both `call.hangup` AND `call.initiated`. When `call.initiated` arrives, it triggers auto-reply immediately while the customer's phone is still ringing. Furthermore, on `call.hangup`, it does not check if the call was answered or rejected before triggering recovery.
- **Business Impact:** Contractors who answer calls still have auto-reply texts sent to their callers (*"Sorry we missed your call..."*), creating severe customer confusion.
- **Remediation:** Ignore `call.initiated`. On `call.hangup`, inspect `payload.hangup_cause` and ensure call was uncompleted, busy, or unanswered (`duration_secs == 0` or cause in `['call_rejected', 'timeout', 'busy', 'no_answer']`).

### Pain Point 9: Concurrency TOCTOU Defect in Idempotency Guard
- **Code Reference:** `src/app/api/webhooks/telnyx/voice/route.ts:25-39`, `src/app/api/webhooks/telnyx/messages/route.ts:23-38`
- **Root Cause:** Check-then-act pattern: `select` from `processed_events`, check if found, then `insert`. Under concurrent retries, two requests pass the check simultaneously.
- **Business Impact:** Duplicate SMS auto-replies sent to the same caller within seconds.
- **Remediation:** Use atomic insertion: `insert into processed_events (id, ...) on conflict (id) do nothing` and check row count or handle Postgres error code `23505`.

### Pain Point 10: Timezone Calculation Error in Business Hours Engine
- **Code Reference:** `src/lib/services/safety-rules.ts:28-44`
- **Root Cause:** `now.getDay()` computes the day of the week in server UTC, while `Intl.DateTimeFormat` formats the time in the tenant's local timezone. Over timezone boundaries, Sunday night compares against Monday daytime hours.
- **Business Impact:** Automated after-hours templates fire during business hours or vice versa; violation of customer expectations.
- **Remediation:** Derive the day of the week directly in the target timezone using `Intl.DateTimeFormat(..., { timeZone, weekday: 'long' })`.

### Pain Point 11: Schema Column Divergences Across Frontend & API
- **Code Reference:**
  - `src/app/client/activity/page.tsx:39, 49` (queries `type`, `delivery_status`, `retry_count` vs schema `event_type`, `description`, `metadata`)
  - `src/app/api/onboarding/route.ts:84` (inserts `settings` vs schema `config`)
  - `src/app/api/admin/organizations/toggle-status/route.ts:23` (updates `status` vs schema `subscription_status`)
- **Root Cause:** Schema evolution without refactoring corresponding UI pages and endpoints.
- **Business Impact:** 500 runtime errors, silent insert failures, and empty data tables on the Activity page.
- **Remediation:** Refactor queries and mutations to match `supabase/schema.sql` definitions precisely.

### Pain Point 12: Misleading Review Metrics in Client Portal
- **Code Reference:** `src/app/client/reviews/page.tsx:40-42`
- **Root Cause:** Counts `activity_logs.delivery_status = 'delivered'` as `totalPosted` Google reviews.
- **Business Impact:** False claims presented to the contractor indicating Google reviews were posted when only an SMS invite was delivered to the customer's phone.
- **Remediation:** Clarify UI metrics: "Review Invites Delivered" vs "Estimated Feedback". Integrate Google Places API or review webhooks for actual posted reviews in V1.5.

### Pain Point 13: Dead Code & Duplicate Stale Codebase Copies
- **Code Reference:** `src/app/api/webhooks/twilio/voice/route.ts`, `c:\Users\mskar\captodesk\New folder`
- **Root Cause:** Unused legacy Twilio code and an accidental copy of the codebase created during manual file operations.
- **Business Impact:** Cognitive clutter, potential deployment of obsolete webhook routes, unnecessary bundle size.
- **Remediation:** Delete `/api/webhooks/twilio/voice` and archive/delete `New folder`.

### Pain Point 14: Zero Automated Test Coverage (0%)
- **Code Reference:** Entire repository
- **Root Cause:** No test runner (Vitest/Jest) or integration test scripts configured in `package.json`.
- **Business Impact:** High risk of regressions during ongoing feature development and refactoring.
- **Remediation:** Install Vitest and write unit tests for `safety-rules.ts`, `call-recovery.ts`, and webhook signature verification.

---

## 4. Dead Code & Orphaned File Cleanup Manifest

The following files and folders must be purged from the repository during P1 cleanup:

```text
c:\Users\mskar\captodesk\
├── New folder/                         [PURGE] Stale duplicate snapshot (213 KB zip + unpacked directory)
├── New folder.zip                      [PURGE] Stale zip archive
└── src/app/api/webhooks/twilio/
    └── voice/
        └── route.ts                    [PURGE] Obsolete Twilio webhook handler with broken table schemas
```

---

## 5. Testing Gap Analysis & Strategy

| Layer | Current Coverage | Target Coverage (V1) | Recommended Stack | Critical Test Cases |
|---|---|---|---|---|
| **Unit Tests** | **0%** | **> 85%** | Vitest | • `isWithinBusinessHours` across UTC/CST timezone edges<br>• `isStopKeyword` / `isResumeKeyword` TCPA regex<br>• `isShortCall` duration filtering<br>• Telnyx Ed25519 signature validation |
| **Integration Tests** | **0%** | **> 70%** | Vitest + Supabase Local / Mock | • `processMissedCall` cooldown suppression<br>• Inbound SMS opt-out state update in `contacts`<br>• Webhook idempotency conflict handling in `processed_events` |
| **E2E Tests** | **0%** | **Smoke Suite** | Playwright | • Google OAuth login & session persistence<br>• Client Onboarding flow<br>• Inbox SMS message send & thread update |

---

## 6. Phased Implementation Roadmap

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   PHASED ENGINEERING IMPLEMENTATION                    │
├────────────────────┬────────────────────┬──────────────────────────────┤
│  P0: BLOCKERS      │  P1: V1 STABILITY  │  P2: V1.5 SCALE & AUTOMATION │
│  (Next Step)       │  (V1 Launch)       │  (Growth Engine)             │
├────────────────────┼────────────────────┼──────────────────────────────┤
│ • Secure send SMS  │ • Fix timezone bug │ • Dynamic Telnyx DID pool    │
│ • Secure simulator │ • Fix Activity UI  │ • Google Review API sync     │
│ • Ed25519 webhook  │ • Fix Onboarding   │ • Sliding window rate-limits │
│ • Lock down RLS    │ • Fix Team Invites │ • AI Receptionist module     │
│ • Protect /admin   │ • Prune dead code  │ • E2E Playwright test suite  │
│ • Fix call logic   │ • Install Vitest   │ • Stripe billing integration │
└────────────────────┴────────────────────┴──────────────────────────────┘
```

### Priority P0: Production Blockers (Immediate Execution)
1. **SEC-01 & SEC-02 Remediation:** Lock `/api/messages/send` behind authenticated user session and `/api/admin/demo-simulator` behind `super_admin` role.
2. **SEC-03 Remediation:** Implement Telnyx Ed25519 signature verification; populate `TELNYX_PUBLIC_KEY`.
3. **SEC-04 Remediation:** Execute database hardening SQL migration, revoking all `anon` grants across `organizations`, `calls`, `contacts`, `leads`, `conversations`, `messages`, and `processed_events`.
4. **SEC-05 Remediation:** Add proxy-level redirects for `/admin/*` in `src/proxy.ts` and add server-side `super_admin` role guard in `src/app/admin/layout.tsx`.
5. **Logic Fix (DEFECT-01):** Fix `call.hangup` vs `call.initiated` logic in voice webhook to eliminate false auto-replies on answered calls.
6. **Concurrency Fix (DEFECT-02):** Implement atomic `insert ... on conflict do nothing` in `processed_events`.

### Priority P1: Required for V1 (Core Stability & Functional Polish)
1. **Timezone Fix (DEFECT-03 & SEC-09):** Fix `isWithinBusinessHours` to derive day of the week in target timezone. Add 8:00 AM – 8:00 PM TCPA quiet hours ceiling.
2. **Schema Alignment (DEFECT-04):** Update `activity/page.tsx` to query `event_type`, `description`, and `metadata`. Fix `automation_settings` column (`config`) in `/api/onboarding`. Fix toggle status endpoint (`subscription_status`).
3. **Genuine Team Invites (SEC-06 & DEFECT-05):** Fix role authorization for `'owner'` and implement genuine `supabaseAdmin.auth.admin.inviteUserByEmail`.
4. **Metrics Integrity (DEFECT-06):** Clarify review metrics labels on `/client/reviews`.
5. **Repo Hygiene (DEFECT-07):** Delete `/api/webhooks/twilio/voice` and `New folder`.
6. **Testing Setup (DEFECT-08):** Configure Vitest with unit test suite covering telephony safety rules and cryptographic signature validation.

### Priority P2: Required for V1.5 (Scale & Reliability)
1. **Dynamic DID Management (SEC-07):** Integrate Telnyx Number Orders API or dedicated inventory allocation pool so every tenant has an isolated, unshared phone number.
2. **Google Review Scraper / Places API:** Replace SMS delivery proxy count with actual Google Business Profile API review verification.
3. **Edge Rate Limiting (SEC-08):** Add token bucket rate limiting on SMS and webhook ingestion endpoints.
4. **E2E Automation:** Add Playwright test suite for critical client flows.

### Priority P3: Future Platform Capabilities
1. **AI Voice Receptionist:** Real-time conversational AI answering calls when contractor is busy.
2. **Field Service CRM Integrations:** 2-way sync with Jobber, ServiceTitan, and Housecall Pro.
3. **Native Mobile Dispatcher Apps:** iOS and Android push notification clients for on-the-go contractors.

---

## 7. Sign-off & Transition to Execution

Phase 0 Architectural, Security, and Codebase Audit is complete. Deliverables established:
- `ARCHITECTURE.md`
- `SECURITY_AUDIT.md`
- `IMPLEMENTATION_STATUS.md`

Engineering is ready to transition to **Phase 1: Remediation of Priority P0 Production Blockers** upon user approval.
