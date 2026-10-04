# CaptoDesk Comprehensive Security Audit
**Author:** Senior Security Architect & Principal Engineer  
**Codebase:** CaptoDesk (Phase 0 Audit)  
**Date:** October 2026  
**Status:** High-Priority Remediation Mandate  

---

## 1. Executive Summary

A comprehensive, line-by-line security review of the CaptoDesk codebase was conducted, focusing on authentication boundaries, telephony webhook ingestion, database row-level security (RLS), multi-tenant isolation, and telecommunications compliance (TCPA/10DLC).

Three **CRITICAL (CVSS > 9.0)** vulnerabilities and two **HIGH-SEVERITY** vulnerabilities were identified. These vulnerabilities permit unauthenticated SMS toll fraud, arbitrary multi-tenant data tampering, unauthenticated webhook injection, and complete public exposure of the Super Admin cockpit.

Remediation specifications are provided for all findings. Implementation must be executed in Priority P0 before platform production launch.

---

## 2. Vulnerability Severity Matrix

| Vulnerability ID | Title | Severity | CVSS v3.1 | Impacted Surface | Blast Radius |
|---|---|---|---|---|---|
| **SEC-01** | Unauthenticated Outbound SMS Relay | **CRITICAL** | **9.8** | `POST /api/messages/send` | Telnyx financial drain, spam dispatch, carrier blacklisting |
| **SEC-02** | Unauthenticated Public Demo SMS Simulator | **CRITICAL** | **9.8** | `POST /api/admin/demo-simulator` | Unrestricted SMS relay, financial drain, toll fraud |
| **SEC-03** | Missing Ed25519 Webhook Signature Verification | **CRITICAL** | **9.1** | `POST /api/webhooks/telnyx/*` | Spoofed call events, arbitrary SMS dispatch, data corruption |
| **SEC-04** | Excessive Anon Permissiveness in Database RLS | **HIGH** | **8.6** | Supabase RLS (`schema.sql`, `02_auth...`) | Cross-tenant data exfiltration & injection via anon key |
| **SEC-05** | Unprotected Super Admin Control Panel | **HIGH** | **8.2** | `/admin/*`, `src/proxy.ts`, `layout.tsx` | Full platform metrics & tenant settings exposure |
| **SEC-06** | Broken RBAC & Hardcoded Rejection in Team Invites | **MEDIUM** | **6.5** | `POST /api/team/invite` | Legitimate owners locked out; non-functional mock flow |
| **SEC-07** | Shared Inbound DID Collision Across Tenants | **MEDIUM** | **6.3** | `/api/onboarding`, `call-recovery.ts` | Cross-tenant call routing collision; privacy leakage |
| **SEC-08** | Complete Lack of Edge Rate Limiting / Abuse Control | **MEDIUM** | **5.8** | All `/api/*` endpoints | Denial of service, brute force, API quota exhaustion |
| **SEC-09** | TCPA Compliance Gaps & Timezone Calculation Defect | **MEDIUM** | **5.3** | `safety-rules.ts`, `reviews/page.tsx` | Legal liability under TCPA, quiet-hours SMS delivery |

---

## 3. Deep-Dive Vulnerability Specifications

### SEC-01: Unauthenticated Outbound SMS Relay
- **Location:** `src/app/api/messages/send/route.ts:5-23`
- **CVSS v3.1:** 9.8 (`AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`)
- **Vulnerability Description:**
  The `POST /api/messages/send` endpoint does not validate the Supabase user session or token. It initializes a raw Supabase client using server environment keys and proceeds immediately to parse `conversation_id`, `to`, and `message` from the request body.
- **Root Cause:**
  Zero call to `supabase.auth.getUser()`. Any external actor can issue an HTTP POST request with an arbitrary `to` number and message text, provided they pass any existing `conversation_id` (or forge one if DB access is acquired).
- **Attack Scenario:**
  An attacker scripts automated POST requests to `/api/messages/send`, utilizing the agency's Telnyx credentials to blast hundreds of thousands of SMS spam messages or premium-rate SMS messages, resulting in catastrophic billing charges and carrier disconnection.
- **Remediation Specification:**
  1. Switch to `@supabase/ssr` server client.
  2. Authenticate the caller: `const { data: { user } } = await supabase.auth.getUser()`. If missing, return `401 Unauthorized`.
  3. Verify that `user.id` belongs to the tenant that owns `conversation_id`.
  4. Ensure the outbound phone number matches the tenant's assigned Telnyx DID.

---

### SEC-02: Unauthenticated Public Demo SMS Simulator
- **Location:** `src/app/api/admin/demo-simulator/route.ts:4-21`
- **CVSS v3.1:** 9.8 (`AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`)
- **Vulnerability Description:**
  The demo simulator API endpoint was built for rapid sales demonstrations. It accepts `{ business_name, phone, message }` via JSON POST and immediately invokes `sendTelnyxSms(...)` using the platform's primary Telnyx number. It contains zero authentication checks, zero session cookies, and zero IP rate limiting.
- **Root Cause:**
  Designed as an open test hook without access controls.
- **Attack Scenario:**
  A bot discovers `/api/admin/demo-simulator` and sends high-frequency SMS dispatches to premium rate international destinations or for SMS phishing campaigns.
- **Remediation Specification:**
  1. Enforce Super Admin session authentication via Supabase server client.
  2. Verify user has `role === 'super_admin'`.
  3. If required for unauthenticated public marketing demos, place behind Cloudflare Turnstile CAPTCHA and enforce strict IP rate limiting (maximum 1 SMS per IP per 24 hours).

---

### SEC-03: Missing Ed25519 Webhook Signature Verification
- **Location:** `src/app/api/webhooks/telnyx/voice/route.ts:5-22`, `src/app/api/webhooks/telnyx/messages/route.ts:5-20`
- **CVSS v3.1:** 9.1 (`AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H`)
- **Vulnerability Description:**
  Telnyx signs all webhook events using asymmetric Ed25519 cryptography, including `telnyx-signature-ed25519` and `telnyx-timestamp` HTTP headers. Both voice and SMS webhook handlers parse the raw JSON payload and execute downstream database writes and outbound SMS triggers without verifying the signature. In `.env.local`, `TELNYX_PUBLIC_KEY` is present but completely empty (0 characters).
- **Root Cause:**
  Omission of Ed25519 cryptographic signature verification function in `src/lib/telnyx.ts`.
- **Attack Scenario:**
  An adversary crafts forged JSON webhooks indicating missed calls from arbitrary numbers and posts them to `https://app.corvexastudio.com/api/webhooks/telnyx/voice`. CaptoDesk automatically sends auto-reply SMS messages to the spoofed phone numbers, allowing attackers to weaponize CaptoDesk as an SMS spam cannon.
- **Remediation Specification:**
  1. Extract `TELNYX_PUBLIC_KEY` from the Telnyx Mission Control Portal (Webhooks section) and populate `.env.local`.
  2. Implement `verifyTelnyxWebhookSignature(rawBody: string, signature: string, timestamp: string, publicKey: string): boolean` using Node.js `crypto` or `@noble/ed25519`.
  3. In Next.js route handlers, read `await request.text()` before `JSON.parse` to preserve the exact raw payload byte buffer for verification.
  4. Reject unverified requests with `401 Unauthorized`.

---

### SEC-04: Excessive Anon Permissiveness in Database RLS
- **Location:** `supabase/schema.sql:242-243`, `supabase/schema.sql:278-304`, `supabase/migrations/02_auth_and_onboarding.sql:10-15`
- **CVSS v3.1:** 8.6 (`AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N`)
- **Vulnerability Description:**
  In `schema.sql` and `02_auth_and_onboarding.sql`, RLS policies were created granting `anon` (unauthenticated public users holding only `NEXT_PUBLIC_SUPABASE_ANON_KEY`):
  - `SELECT` permission on ALL rows in `organizations` (`USING (true)`).
  - `INSERT` permission on `calls`, `contacts`, `leads`, `messages`, `conversations`, `activity_logs`, `processed_events` (`WITH CHECK (true)`).
  - `UPDATE` permission on `messages` and `conversations` (`USING (true)`).
- **Root Cause:**
  Temporary developer workaround to allow serverless webhooks to insert rows when `SUPABASE_SERVICE_ROLE_KEY` was missing or misconfigured in early testing.
- **Attack Scenario:**
  Using the public browser anon key extracted from client bundle HTML, an anonymous user executes `supabase.from('organizations').select('*')` to harvest all business names, owner cell phones, and Telnyx DIDs. They can also directly insert fraudulent leads or modify existing conversation messages.
- **Remediation Specification:**
  1. Revoke all `anon` grants on `organizations`, `calls`, `contacts`, `leads`, `conversations`, `messages`, and `activity_logs`.
  2. Enforce strict tenant isolation on authenticated users: `org_id = auth_user_org_id()`.
  3. Webhook endpoints must initialize Supabase using `SUPABASE_SERVICE_ROLE_KEY`, which automatically bypasses RLS in Postgres without opening RLS to the public.

---

### SEC-05: Unprotected Super Admin Control Panel
- **Location:** `src/proxy.ts:49-55`, `src/app/admin/layout.tsx:25-30`
- **CVSS v3.1:** 8.2 (`AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N`)
- **Vulnerability Description:**
  `src/proxy.ts` intercepts `/admin` and subdomains (`admin.domain.com`), but unconditionally returns `supabaseResponse` without validating that a user is logged in or holds the `super_admin` role. Furthermore, `src/app/admin/layout.tsx` is a client component with no authentication barrier or redirect.
- **Root Cause:**
  Missing role check in edge proxy and missing layout-level server component auth guard.
- **Attack Scenario:**
  Any public user can navigate to `https://app.corvexastudio.com/admin` or `admin.corvexastudio.com` and load the admin cockpit, inspect platform analytics, view system health, and trigger the live sales simulator.
- **Remediation Specification:**
  1. In `src/proxy.ts`, enforce:
     ```ts
     if (pathname.startsWith('/admin') || hostname.startsWith('admin.')) {
       if (!user) return NextResponse.redirect(new URL('/client/login?redirect=' + pathname, request.url))
     }
     ```
  2. In `src/app/admin/layout.tsx` (or a server parent wrapper), query `profiles.role` for `user.id`. If `role !== 'super_admin'`, redirect to `/client/dashboard` or render a 403 Forbidden screen.

---

### SEC-06: Broken RBAC & Hardcoded Rejection in Team Invites
- **Location:** `src/app/api/team/invite/route.ts:15-28`
- **CVSS v3.1:** 6.5 (`AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:L`)
- **Vulnerability Description:**
  The team invite route checks `if (!['client_admin', 'super_admin'].includes(profile.role)) return 403`. However, the onboarding flow sets the primary tenant account holder's role to `'owner'` (`src/app/api/onboarding/route.ts:70`). As a result, genuine business owners are rejected with `403 Forbidden` when attempting to invite team members. Furthermore, the endpoint returns a fake mock JSON response and does not invoke `supabaseAdmin.auth.admin.inviteUserByEmail`.
- **Root Cause:**
  Role mismatch between DB check constraint (`owner`, `client_admin`, `super_admin`, `dispatcher`) and hardcoded API condition.
- **Remediation Specification:**
  1. Update role check to allow `'owner'`, `'client_admin'`, and `'super_admin'`.
  2. Implement genuine Supabase Admin email invitation using `SUPABASE_SERVICE_ROLE_KEY`.

---

### SEC-07: Shared Inbound DID Collision Across Tenants
- **Location:** `src/app/api/onboarding/route.ts:41-53`, `src/lib/services/call-recovery.ts:21-29`
- **CVSS v3.1:** 6.3 (`AV:N/AC:L/PR:N/UI:N/S:C/C:L/I:L/A:N`)
- **Vulnerability Description:**
  When a contractor signs up, `src/app/api/onboarding/route.ts` assigns `telnyxNumber = process.env.TELNYX_PHONE_NUMBER || '+16823808060'`. Every newly onboarded tenant receives the identical hardcoded tracking number. When a missed call webhook arrives, `processMissedCall` executes:
  `supabase.from('organizations').select('*').eq('telnyx_phone_number', formattedCalled).single()`
  If more than one tenant exists with that number, `.single()` throws an exception, breaking call recovery for all tenants, or links calls to the wrong tenant.
- **Root Cause:**
  Lack of dynamic phone number provisioning or multi-tenant DID allocation pool.
- **Remediation Specification:**
  1. For V1 single-number demo: ensure unique routing via tenant slug or dedicated number allocation.
  2. For V1 multi-tenant production: allocate unique Telnyx numbers from an inventory pool or via the Telnyx Number Orders API upon onboarding. Add a UNIQUE constraint on `organizations(telnyx_phone_number)`.

---

### SEC-08: Complete Lack of Edge Rate Limiting / Abuse Control
- **Location:** All API routes (`src/app/api/*`)
- **CVSS v3.1:** 5.8 (`AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L`)
- **Vulnerability Description:**
  There are no rate-limiting headers, token bucket counters, or IP throttling algorithms applied to any API route or webhook endpoint.
- **Root Cause:**
  Lack of rate-limiting middleware or Upstash Redis integration.
- **Remediation Specification:**
  Implement edge-level rate limiting in `src/proxy.ts` using an in-memory sliding window for standard routes and strict per-minute limits on SMS dispatch routes.

---

### SEC-09: TCPA Compliance Gaps & Timezone Calculation Defect
- **Location:** `src/lib/services/safety-rules.ts:28-51`, `src/app/client/reviews/page.tsx:40-42`
- **CVSS v3.1:** 5.3 (`AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L`)
- **Vulnerability Description:**
  1. **Timezone Bug:** `now.getDay()` in `isWithinBusinessHours` computes weekday in server UTC, while time is formatted in the client's local timezone. Over weekends and midnight boundaries, Sunday hours are evaluated against Monday dates, leading to erroneous SMS dispatch outside permitted hours.
  2. **TCPA Quiet Hours:** Federal TCPA rules prohibit commercial automated SMS outside 8:00 AM – 9:00 PM in the recipient's local time. The system lacks a strict 8 AM – 9 PM hard safety cap regardless of organization settings.
- **Root Cause:**
  JavaScript `Date` timezone discrepancy and omission of a global TCPA legal curfew filter.
- **Remediation Specification:**
  1. Fix weekday calculation using `new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' }).format(now).toLowerCase()`.
  2. Implement an immovable TCPA Quiet Hours guard: reject outbound SMS if recipient local time is before 08:00 or after 20:00 (8:00 PM).

---

## 4. Supabase Row-Level Security (RLS) Audit & Target Matrix

### Current State vs. Hardened Production State

| Table Name | RLS Enabled? | Current Vulnerability / Permissiveness | Target Production Policy |
|---|---|---|---|
| **`organizations`** | Yes | `SELECT` allowed `TO anon, authenticated USING (true)` | `SELECT` restricted to tenant members (`id = auth_user_org_id()`) or `super_admin`. `anon` access revoked completely. |
| **`profiles`** | Yes | Restricted to `id = auth.uid()` | Maintain `id = auth.uid()`. Add policy for `super_admin` to view all profiles. |
| **`contacts`** | Yes | `INSERT` allowed `TO anon WITH CHECK (true)` | Revoke `anon`. Allow authenticated users where `org_id = auth_user_org_id()`. Serverless webhooks insert via service role. |
| **`leads`** | Yes | `INSERT` allowed `TO anon WITH CHECK (true)` | Revoke `anon`. Allow authenticated users where `org_id = auth_user_org_id()`. Webhooks insert via service role. |
| **`calls`** | Yes | `INSERT` allowed `TO anon WITH CHECK (true)` | Revoke `anon`. Allow authenticated users where `org_id = auth_user_org_id()`. Webhooks insert via service role. |
| **`conversations`** | Yes | `INSERT` and `UPDATE` allowed `TO anon` | Revoke `anon`. Tenant isolation `org_id = auth_user_org_id()`. Webhooks insert/update via service role. |
| **`messages`** | Yes | `INSERT` and `UPDATE` allowed `TO anon` | Revoke `anon`. Tenant isolation `org_id = auth_user_org_id()`. Webhooks insert/update via service role. |
| **`appointments`** | Yes | Properly isolated to `org_id = auth_user_org_id()` | Maintain current tenant isolation. |
| **`automation_settings`** | Yes | Properly isolated to `org_id = auth_user_org_id()` | Maintain current tenant isolation. |
| **`activity_logs`** | Yes | `INSERT` allowed `TO anon WITH CHECK (true)` | Revoke `anon`. Restrict to `org_id = auth_user_org_id()`. |
| **`processed_events`** | Yes | `ALL` operations allowed `TO anon USING (true)` | Revoke `anon`. Webhook idempotency table accessed exclusively via service role key. |

---

## 5. Secrets & Environment Configuration Audit

| Environment Variable | Status in `.env.local` | Security Assessment |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Present (40 chars) | Correct. Public endpoint. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Present (46 chars) | Correct. Browser-safe key once RLS is locked down. |
| `SUPABASE_SERVICE_ROLE_KEY` | Present (219 chars) | **CRITICAL:** Verified present. Must NEVER be prefixed with `NEXT_PUBLIC_` or bundled in client components. |
| `TELNYX_API_KEY` | Present (58 chars) | Correct. Kept server-side in API routes. |
| `TELNYX_CONNECTION_ID` | Present (19 chars) | Correct. Used for call control applications. |
| `TELNYX_PHONE_NUMBER` | Present (12 chars) | Correct. Primary platform DID (`+16823808060`). |
| `TELNYX_PUBLIC_KEY` | **EMPTY (0 chars)** | **CRITICAL DEFECT:** Must be populated from Telnyx Portal to enable Ed25519 webhook signature validation. |

---

## 6. Actionable Remediation Implementation Specs

### 6.1 Database Hardening SQL Migration (Priority P0)

Execute the following SQL migration script in Supabase to eliminate anonymous access:

```sql
-- Revoke all unauthenticated access across telephony tables
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
DROP POLICY IF EXISTS "Allow lookup of organizations" ON organizations;
CREATE POLICY "Users can view their own organization"
ON organizations FOR SELECT
TO authenticated
USING (id = auth_user_org_id());

DROP POLICY IF EXISTS "Webhook inserts for calls" ON calls;
DROP POLICY IF EXISTS "Allow webhook inserts for calls" ON calls;

DROP POLICY IF EXISTS "Webhook inserts for messages" ON messages;
DROP POLICY IF EXISTS "Allow webhook inserts for messages" ON messages;
DROP POLICY IF EXISTS "Webhook updates for messages" ON messages;
DROP POLICY IF EXISTS "Allow webhook updates for messages" ON messages;

DROP POLICY IF EXISTS "Webhook inserts for contacts" ON contacts;
DROP POLICY IF EXISTS "Allow webhook inserts for contacts" ON contacts;

DROP POLICY IF EXISTS "Webhook inserts for leads" ON leads;
DROP POLICY IF EXISTS "Allow webhook inserts for leads" ON leads;

DROP POLICY IF EXISTS "Webhook inserts for conversations" ON conversations;
DROP POLICY IF EXISTS "Allow webhook inserts for conversations" ON conversations;
DROP POLICY IF EXISTS "Webhook updates for conversations" ON conversations;
DROP POLICY IF EXISTS "Allow webhook updates for conversations" ON conversations;

DROP POLICY IF EXISTS "Webhook inserts for activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "Allow webhook inserts for activity_logs" ON activity_logs;

DROP POLICY IF EXISTS "Webhook inserts for processed_events" ON processed_events;
CREATE POLICY "Strict isolation for processed_events"
ON processed_events FOR ALL
TO authenticated
USING (false); -- Exclusively accessed via service role key
```

### 6.2 Telnyx Ed25519 Webhook Signature Verifier

```ts
import crypto from 'crypto'

export function verifyTelnyxSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  publicKeyBase64: string
): boolean {
  if (!signatureHeader || !timestampHeader || !publicKeyBase64) return false

  try {
    const timestamp = parseInt(timestampHeader, 10)
    const now = Math.floor(Date.now() / 1000)
    // Tolerance: 5 minutes replay window
    if (Math.abs(now - timestamp) > 300) return false

    const payload = `${timestamp}|${rawBody}`
    const publicKeyDer = Buffer.from(
      `302a300506032b6570032100${Buffer.from(publicKeyBase64, 'base64').toString('hex')}`,
      'hex'
    )
    const key = crypto.createPublicKey({
      key: publicKeyDer,
      format: 'der',
      type: 'spki'
    })

    return crypto.verify(
      null,
      Buffer.from(payload, 'utf8'),
      key,
      Buffer.from(signatureHeader, 'base64')
    )
  } catch (err) {
    console.error('[TELNYX SIGNATURE VERIFICATION FAILED]', err)
    return false
  }
}
```

---

## 7. Next Steps & Sign-off

This audit concludes Phase 0 Security Discovery. All items above are sequenced in the companion document `IMPLEMENTATION_STATUS.md`.
