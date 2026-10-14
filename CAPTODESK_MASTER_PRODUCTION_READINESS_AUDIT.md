# CAPTODESK — MASTER PRODUCTION READINESS AUDIT
### Principal Architect + Application Security + Database/Supabase + Frontend/UX + Telephony/10DLC + Distributed Systems + Billing + Product Audit

- **Target Repository:** `c:\Users\mskar\captodesk`
- **Git Commit Baseline:** `cafc083`
- **Environment Tier:** Staging / Production Architecture
- **Audit Date:** October 14, 2026
- **Auditor Role:** Master System Architect & Principal Reliability Engineer

---

## 1. Executive Summary

| Metric | Score | Assessment |
|:---|:---:|:---|
| **Overall Production Readiness** | **74%** | Functional core; bounded operational/carrier integration constraints |
| **Security Readiness** | **91%** | Strong RLS, tenant isolation, fail-closed webhooks, timing-safe crypto |
| **Core Product Readiness** | **78%** | End-to-end loop implemented; missing owner outbound push/SMS alerts |
| **Infrastructure & Worker Readiness** | **68%** | Vercel Hobby cron limitation (`* * * * *`) requires Vercel Pro or external runner |
| **First-Customer Readiness** | **82%** | Feasible under supervised manual onboarding and carrier verification |
| **General Availability (GA) Readiness** | **46%** | Blocked by manual PayPal billing, team invite bug, and 10DLC lead time |

### Executive Verdict: **CONDITIONAL GO**

CaptoDesk demonstrates an unusually mature backend architecture for a pre-first-customer SaaS: tenant isolation is strictly enforced via database RLS and server-side context resolution, webhook idempotency is atomically guaranteed with Postgres row locking, appointment scheduling is concurrency-hardened with native `tstzrange` exclusion constraints (`23P01`), and Telnyx DID ordering has been securely restricted to Super Admin privilege.

However, CaptoDesk is **NOT** ready for an unassisted public self-serve launch. It can onboard **ONE paying customer under strict operator supervision** provided that:
1. The CaptoDesk operator manually orders the Telnyx DID via the Super Admin console.
2. The customer's mobile carrier conditional forwarding is manually verified (avoiding flawed USSD/MMI dial codes).
3. The background worker is triggered by Vercel Pro or an external cron runner because Vercel Hobby limits cron jobs to once daily.
4. The customer is informed that new lead notifications must be checked via the dashboard/inbox until direct contractor SMS lead notifications are shipped.

---

## 2. System Architecture

```text
                                 [ CUSTOMER PHONE CALL ]
                                            │
                             (Unanswered Call on Cell/Landline)
                                            │
                       Carrier Conditional Forwarding (*71 / *004*)
                                            ▼
                               [ TELNYX TELEPHONY CLOUD ]
                                            │
                        Ed25519 Webhook (call.hangup / call.initiated)
                                            ▼
                    ┌──────────────────────────────────────────────┐
                    │          NEXT.JS 16 SERVERLESS APIS          │
                    │   (/api/webhooks/telnyx/voice, /messages)    │
                    │   - Ed25519 Signature Verification           │
                    │   - Atomic Webhook Idempotency Claims        │
                    │   - Sliding-Window Distributed Rate Limiting │
                    └───────┬──────────────────────────────┬───────┘
                            │                              │
         Server-Side RLS / Tenant Context           Outbound Dispatch via Telnyx REST
                            ▼                              ▼
                 ┌────────────────────┐          [ HOMEOWNER AUTO-REPLY SMS ]
                 │   SUPABASE / PG    │          "Thanks for calling! Book here:"
                 │  - Multi-Tenant RLS│                        │
                 │  - 23P01 Exclusion │                        ▼
                 │  - Job Worker Queue│              [ PUBLIC BOOKING PAGE ]
                 └─────────┬──────────┘             (/book/[slug] -> Manage Token)
                           │                                   │
              Cron Ping (/api/automations/worker)              ▼
                           │                         [ CONTRACTOR WORKSPACE ]
                           ▼                         - Today's Actions / Inbox
                 [ AUTOMATION WORKER ]               - Customer CRM / Jobs
                 - Reminders / Win-back              - Invoices (Stripe / Offline)
                 - SKIP LOCKED Execution             - Reviews / Reputation
```

---

## 3. Test / Build Results

| Check | Result | Evidence / Command Output |
|:---|:---:|:---|
| **npm ci (dry-run)** | **PASS** | `up to date in 2s` (zero dependency errors, Linux/Vercel platform safe) |
| **Unit & Integration Suite** | **PASS** | `565/565 passed` across 44 test files (`npm test`, 8.82s duration) |
| **PostgreSQL Integration Tests** | **PASS** | `24/24 passed` (`npm run test:integration`, real Postgres `23P01` exclusion & Migration 31/35 tests) |
| **TypeScript Typecheck** | **PASS** | `tsc --noEmit` exited with code 0 (0 compilation errors) |
| **ESLint Static Analysis** | **PASS** | `eslint .` exited with code 0 (0 errors, 1,512 baseline `any` warnings) |
| **Production Build** | **PASS** | `next build` compiled successfully (57 static & dynamic routes, Turbopack) |
| **Environment Parity Check** | **FAIL (Local)** | `scripts/validate-env.mjs`: Local `.env.local` has Supabase project ref mismatch (`vlztovqaummczupslymr` vs `ttshyxmudazpnwkpvqcb`); production Vercel is configured manually |

---

## 4. MASTER FINDINGS TABLE

| ID | Severity | Category | Finding | Evidence | Customer Impact | Fix Before First Customer? | Fix Before GA? |
|:---|:---:|:---|:---|:---|:---|:---:|:---:|
| **P0-DEP-01** | **P0** | DevOps / Cron | Vercel Hobby rejects sub-daily cron (`* * * * *`); worker halts | `vercel.json:6`, `test/worker-scheduling-and-draining.test.mjs` | Automations, SMS retries, and reminders stop firing unless Vercel Pro or external cron runner is used | **YES** | **YES** |
| **P0-TEL-01** | **P0** | Telephony | Inbound call receives dead ring until caller disconnects (no audio/reject) | `src/app/api/webhooks/telnyx/voice/route.ts:160` | Callers hear 30–60s of dead ringing before auto-reply SMS fires; no voicemail prompt | **YES** (Operational guidance / TeXML reject) | **YES** |
| **P1-TEAM-01** | **P1** | RBAC / Auth | Team member invitation fails to link employee to organization profile | `supabase/migrations/22_auto_profile_trigger_and_onboarding_fix.sql:10`, `src/app/client/auth/callback/route.ts:66` | Invited employees are redirected to `/client/onboarding` and forced to create their own separate business | **NO** (If solo operator) | **YES** |
| **P1-NOTIF-01** | **P1** | Product / Core | Contractor receives NO outbound SMS/push notification when call is missed | `src/lib/services/call-recovery.ts:194-275` | Business owner is not alerted on their personal phone; must constantly monitor web dashboard | **YES** | **YES** |
| **P1-BILL-01** | **P1** | Billing / Entitlement | Inactive/expired SaaS subscription does not gate missed-call SMS or booking | `src/lib/services/call-recovery.ts:136`, `src/app/api/messages/send/route.ts:8` | Non-paying/canceled tenants continue consuming CaptoDesk Telnyx SMS funds indefinitely | **NO** (Only 1 customer) | **YES** |
| **P1-TEL-02** | **P1** | Telephony / UX | Inaccurate carrier forwarding codes displayed for AT&T and T-Mobile | `src/app/client/settings/page.tsx:300-318` | Contractors dial wrong carrier codes; conditional forwarding fails to trigger on unanswered calls | **YES** | **YES** |
| **P1-SEC-01** | **P1** | AppSec / Rate Limit | Client IP extraction trusts spoofable `cf-connecting-ip` without Cloudflare validation | `src/lib/security/rate-limiter.ts:195-200` | Attacker can bypass booking and signup rate limits by rotating arbitrary request headers | **NO** | **YES** |
| **P2-UX-01** | **P2** | Frontend / UX | Settings displays `*71XXXXXXXXXX` placeholder before DID provisioning | `src/app/client/settings/page.tsx:272-315` | Contractor dials invalid placeholder digits and breaks mobile carrier forwarding | **YES** (Hide until DID active) | **YES** |
| **P2-PRIV-01** | **P2** | Data Privacy | Company Federal Tax ID (EIN) returned to junior crew members via API | `src/app/api/client/organization/route.ts:59`, `src/lib/security/permissions.ts:80` | Ordinary employees/dispatchers with `org:view` can inspect business owner's confidential EIN | **NO** | **YES** |
| **P2-BILL-02** | **P2** | Billing / Ops | SaaS subscription requires 100% manual PayPal reconciliation | `docs/SAAS_BILLING_FOUNDATION.md`, `/admin/organizations/[id]/subscription` | Operator must manually create invoices, send PayPal links, and click "Record Payment" | **NO** (Acceptable for 1–5 customers) | **YES** |
| **P2-TEL-03** | **P2** | Telephony / 10DLC | 10DLC brand/campaign review latency (3–14 days) risks carrier SMS filtering | `src/lib/telephony/telnyx-10dlc.ts:152-250` | Outbound SMS from newly provisioned numbers may be filtered by AT&T/Verizon spam filters | **YES** (Pre-register brand) | **YES** |
| **P2-OBS-01** | **P2** | Observability | Absence of automated external uptime pinger for serverless health | `src/app/api/health/route.ts`, `src/app/api/health/worker/route.ts` | Outages at 2:00 AM are not alerted to engineering until a customer complains | **NO** | **YES** |
| **P3-CODE-01** | **P3** | Code Quality | 1,512 ESLint `@typescript-eslint/no-explicit-any` warnings in codebase | `src/lib/telephony/telnyx-api-client.ts`, `src/lib/webhooks/idempotency.ts` | Increases maintenance overhead and obscures strict TypeScript types | **NO** | **NO** |
| **P3-PERF-01** | **P3** | Performance | In-memory fallback rate limiter evicts entries at 20,000 threshold | `src/lib/security/rate-limiter.ts:61-69` | Ephemeral serverless lambdas do not share memory across instances; requires Upstash/Redis | **NO** | **YES** |
| **P3-UX-02** | **P3** | Frontend / Polish | Review requests sent without Google URL fall back to generic page | `src/app/api/reviews/send/route.ts:70` | Homeowner review invites fail to redirect to Google Maps listing if URL is blank | **NO** | **YES** |

---

## 5. P0 FINDINGS

### P0-DEP-01: Vercel Hobby Cron Incompatibility & Function Timeout
- **File / Component:** `vercel.json:6` (`"schedule": "* * * * *"`), `src/app/api/automations/worker/route.ts:11` (`maxDuration = 60`)
- **Current Behavior:** The automation worker relies on Vercel Cron firing every minute (`* * * * *`). On Vercel Hobby tier, Vercel strictly rejects cron schedules shorter than daily (`0 0 * * *`) during deployment (`Hobby accounts are limited to daily cron jobs. Upgrade to Pro plan...`). Additionally, `maxDuration = 60` exceeds Hobby's 15-second execution limit.
- **Why It Is a Blocker:** Background workers drive missed-call retry backoffs, appointment confirmation reminders, review request automations, and win-back retention campaigns. On Vercel Hobby, none of these automations will run on schedule.
- **Reproduction:** Run `vercel deploy` or inspect Vercel Project Cron settings under a free/Hobby team.
- **Business Impact:** High. Missed-call SMS retries and booking reminders will fail to fire in production.
- **Remediation:** Either (a) deploy to a Vercel Pro team account ($20/seat/mo), or (b) set up an external uptime scheduler (e.g., Upstash QStash, cron-job.org, or GitHub Actions) authenticated with `Authorization: Bearer <CRON_SECRET>` targeting `POST /api/automations/worker`.

### P0-TEL-01: Inbound Call Dead-Air / Unanswered Ringing Until Caller Hangup
- **File / Component:** `src/app/api/webhooks/telnyx/voice/route.ts:160-176`
- **Current Behavior:** When Telnyx receives an inbound forwarded call, it dispatches `call.initiated` and `call.ringing` to `/api/webhooks/telnyx/voice`. The route logs the event, updates idempotency records, and returns HTTP 200 `{ success: true, intermediate: true }`. It issues **zero** Call Control commands (`answer`, `speak`, `play_audio`, `reject`, or TeXML `<Response><Reject/></Response>`).
- **Why It Is a Blocker:** The caller remains on an active line hearing continuous ringing for 30 to 60 seconds until they either hang up in frustration (`hangup_cause: originator_cancel`) or Telnyx times out (`timeout`). Only *after* the caller hangs up does Telnyx send `call.hangup`, which finally triggers `processMissedCall` and dispatches the recovery SMS.
- **Reproduction:** Route an inbound voice call to a Telnyx Call Control application linked to this webhook. Observe that the caller hears infinite ringing without voicemail or audio.
- **Business Impact:** High customer confusion. Callers expecting a voicemail greeting or busy tone experience dead ringing.
- **Remediation:** In the short term, configure Telnyx Call Control or TeXML to reject the call with cause `USER_BUSY` after 2 rings, or answer and play an automated greeting: *"Thanks for calling [Business]. We're currently assisting another customer and have just texted you our booking link."*

---

## 6. P1 FINDINGS

### P1-TEAM-01: Team Member Invitations Break Tenant Association
- **File / Component:** `supabase/migrations/22_auto_profile_trigger_and_onboarding_fix.sql:10-24`, `src/app/client/auth/callback/route.ts:57-70`
- **Current Behavior:** When a business owner invites an employee via `/api/team/invite`, `adminClient.auth.admin.inviteUserByEmail` passes `user_metadata: { role: assignedRole, org_id: orgId }`. However, the Supabase trigger `handle_new_user()` executes on signup and hardcodes `role = 'owner'` and leaves `org_id = NULL`. When the employee clicks the invitation link, `auth/callback` detects `!profile.org_id` and redirects the employee to `/client/onboarding`, forcing them to create their own new organization as an `owner`.
- **Why It Is a Problem:** Contractors cannot invite dispatchers, technicians, or office managers to their organization.
- **Reproduction:** Invite a teammate email from `/client/team`. Accept the invite in an incognito window. Observe that the user lands on `/client/onboarding` and is prompted to create a new business.
- **Remediation:** Update `handle_new_user()` in a new migration to read `COALESCE(new.raw_user_meta_data->>'org_id', NULL)` and `COALESCE(new.raw_user_meta_data->>'role', 'owner')`.

### P1-NOTIF-01: Missing Business Owner Missed-Call Alerts
- **File / Component:** `src/lib/services/call-recovery.ts:194-275`
- **Current Behavior:** When an inbound call is missed, CaptoDesk sends an SMS to the *caller*, records the call, updates the lead, and creates an inbox thread. However, it sends **zero alerts** (no SMS, push notification, or email) to `org.owner_phone`.
- **Why It Is a Problem:** Small business owners (plumbers, HVAC techs, lawn-care operators) are in the field or driving. They do not sit at a desktop web app. If they don't receive a notification on their mobile phone, they will not know a lead came in until hours later.
- **Remediation:** In `processMissedCall()`, after dispatching SMS to the caller, check `org.owner_phone`. If present, dispatch a concise notification: *"CaptoDesk: Missed call from [Caller Phone]. Auto-reply sent with booking link. Reply in your dashboard."*

### P1-BILL-01: Inactive SaaS Subscriptions Do Not Gate Core Telephony/SMS
- **File / Component:** `src/lib/services/call-recovery.ts:136-146`, `src/app/api/messages/send/route.ts:8-25`
- **Current Behavior:** `SubscriptionService.hasActiveSaaSEntitlement()` is only enforced on `/api/client/retention`. Neither `processMissedCall()`, `/api/messages/send`, nor `/api/book/[slug]/submit` checks SaaS entitlement.
- **Why It Is a Problem:** If a client cancels their $99/mo subscription or their period expires, CaptoDesk continues absorbing Telnyx telecom costs for every missed call and SMS sent by that organization.
- **Remediation:** Add `const entitled = await hasActiveSaaSEntitlement(supabase, org.id)` to `processMissedCall()` and `/api/messages/send`. If unentitled, suppress auto-reply and return `402 Payment Required`.

### P1-TEL-02: Carrier Forwarding USSD/MMI Code Inaccuracies in UI
- **File / Component:** `src/app/client/settings/page.tsx:300-318`
- **Current Behavior:** Settings instructs AT&T users to dial `*71<number>` and T-Mobile users to dial `**62*<number>#`.
- **Why It Is a Problem:** On AT&T wireless, `*71` is not universally supported for conditional call forwarding; GSM standard `*004*<number>#` (or `*61*`) is required. On T-Mobile, `**62*` only forwards when *unreachable* (phone off or no signal), NOT when unanswered. To forward unanswered ringing calls on T-Mobile, the user must dial `**61*<number>#` or `**004*<number>#`.
- **Remediation:** Update the Settings instructions:
  - **Verizon:** `*71<TELNYX_NUMBER>` (Deactivate: `*73`)
  - **AT&T:** `*004*<TELNYX_NUMBER>#` or `*61*<TELNYX_NUMBER>#` (Deactivate: `*004#` / `#61#`)
  - **T-Mobile:** `**004*<TELNYX_NUMBER>#` or `**61*<TELNYX_NUMBER>#` (Deactivate: `##004#` / `##61#`)

### P1-SEC-01: Client IP Extraction Header Spoofing
- **File / Component:** `src/lib/security/rate-limiter.ts:191-225`
- **Current Behavior:** `extractClientIp` checks `cf-connecting-ip` and `x-real-ip` before Vercel's trusted forwarding headers.
- **Why It Is a Problem:** Unless traffic is routed strictly through Cloudflare with authenticated origin pulls, an attacker can pass arbitrary `CF-Connecting-IP: 1.2.3.4` headers to bypass rate limits on `/api/onboarding` and `/api/book/[slug]/submit`.
- **Remediation:** Prioritize `x-vercel-forwarded-for` when running on Vercel, or ignore `cf-connecting-ip` unless Cloudflare edge proxy headers are validated.

---

## 7. P2 FINDINGS

### P2-UX-01: Settings Displays `*71XXXXXXXXXX` Before DID Provisioning
- **File:** `src/app/client/settings/page.tsx:273, 294`
- **Problem:** When an organization is created, `telnyx_phone_number` is null. The UI renders `Provisioning...` and `*71XXXXXXXXXX`. A non-technical contractor might dial `*71XXXXXXXXXX` on their cell phone and break their carrier routing.
- **Remediation:** Conditionally hide carrier dial codes until `formData.telnyx_phone_number` is populated and active. Show an alert: *"Your dedicated line is being configured by your onboarding specialist. Check back shortly."*

### P2-PRIV-01: Federal Tax ID (EIN) Exposed to All Team Members
- **File:** `src/app/api/client/organization/route.ts:59`
- **Problem:** `GET /api/client/organization` selects `ein` and returns it to any role with `org:view`, including `member` (technicians and dispatchers).
- **Remediation:** Mask the EIN (`***-**-1234`) or return `null` unless the requesting actor has `role === 'owner'` or `role === 'client_admin'`.

### P2-BILL-02: Manual PayPal SaaS Payment Reconciliation Friction
- **File:** `docs/SAAS_BILLING_FOUNDATION.md`, `src/lib/billing/subscription-service.ts`
- **Problem:** SaaS billing is 100% manual. The operator must create PayPal invoices under S M CREATIONS, receive payments out-of-band, and manually click "Record Payment" in `/admin/organizations/[id]/subscription`.
- **Remediation:** Acceptable for 1–5 early pilot customers; automate via PayPal Webhooks or Stripe Billing before scaling to 20 customers.

### P2-TEL-03: 10DLC Brand & Campaign Verification Latency
- **File:** `src/lib/telephony/telnyx-10dlc.ts:152-250`
- **Problem:** TCR 10DLC campaign review takes 3–14 business days. Outbound SMS from newly provisioned numbers sent during the review period may be filtered or rejected by US mobile carriers.
- **Remediation:** File 10DLC brand and campaign registration immediately upon customer signup, and advise the first customer that carrier messaging approval requires an initial review window.

### P2-OBS-01: Absence of External Synthetic Uptime Monitoring
- **File:** `src/app/api/health/route.ts`, `src/app/api/health/worker/route.ts`
- **Problem:** Health endpoints exist but are not probed by an external uptime monitor (e.g., BetterStack, UptimeRobot). If database connection pooling exhausts at night, operators are not alerted.
- **Remediation:** Connect `/api/health` to a free external monitor with email/SMS alerting.

---

## 8. P3 FINDINGS

### P3-CODE-01: 1,512 ESLint Warnings (`@typescript-eslint/no-explicit-any`)
- **File:** System-wide (`src/lib/telephony/telnyx-api-client.ts`, etc.)
- **Problem:** Excessive use of `any` types weakens compile-time type safety.
- **Remediation:** Incrementally replace `any` with strict schema types during maintenance cycles.

### P3-PERF-01: Serverless In-Memory Fallback Rate Limiting
- **File:** `src/lib/security/rate-limiter.ts:61`
- **Problem:** In-memory fallback rate limiting does not share counters across Vercel lambdas.
- **Remediation:** Ensure `UPSTASH_REDIS_REST_URL` or Supabase RPC rate limiting is configured in production.

### P3-UX-02: Review Request Link Fallback Behavior
- **File:** `src/app/api/reviews/send/route.ts:70`
- **Problem:** If `google_review_url` is not set in organization settings, review invitations direct customers to a generic feedback form rather than Google Maps.
- **Remediation:** Prompt contractors during onboarding or in settings to input their Google Business Profile review link.

---

## 9. THINGS THAT ARE ALREADY STRONG

The following core systems have undergone rigorous remediation and should **NOT** be refactored:

1. **Multi-Tenant RLS & Data Isolation:** Tenant isolation is enforced at the database layer using Supabase RLS policies and server-side `getTenantContext()` verification. No tenant can view or mutate another tenant's data via IDOR.
2. **Webhook Idempotency & Concurrency:** Both Telnyx voice/message webhooks and Stripe payment webhooks use atomic database claims (`claimWebhookEvent`) with row locking, preventing duplicate event execution and race conditions.
3. **Appointment Concurrency Protection:** Scheduling collisions are prevented at the engine level and enforced by PostgreSQL exclusion constraints (`appointments_no_overlapping_bookings` / `23P01`).
4. **Privileged DID Provisioning Boundary:** DID search and purchase APIs are strictly gated to Super Admin authentication. Regular tenant onboarding cannot trigger number ordering or financial liabilities.
5. **SaaS Billing Server-Authoritativeness:** Tenant admins cannot modify `subscription_status` or `monthly_rate` via client APIs; database triggers (Migration 36) actively reject client tampering.
6. **Worker Concurrency & Queue Safety:** The background worker uses `FOR UPDATE SKIP LOCKED`, runtime deadlines, batch budgets, and exponential backoff to ensure zero-duplicate processing across distributed serverless invocations.
7. **Cryptographic Token Entropy:** All public manage tokens (booking, quotes, invoices) use cryptographically secure `crypto.randomBytes(24)` (192 bits of entropy), preventing token enumeration.

---

## 10. CORE MISSED-CALL LOOP SCORE

| Component | Score | Status / Evaluation |
|:---|---:|:---|
| **1. Carrier Forwarding** | **6/10** | Instructions exist, but AT&T and T-Mobile dial codes require correction to GSM standards. |
| **2. Telnyx Inbound Webhook** | **9/10** | Robust Ed25519 signature verification, fail-closed security, atomic idempotency. |
| **3. Missed-Call Detection** | **8/10** | State machine correctly evaluates hangup causes; caller experiences dead ring until disconnect. |
| **4. Contact Creation** | **9/10** | E.164 normalization, deduplication by phone, opt-out status preservation. |
| **5. Lead Creation** | **9/10** | Repeat calls increment `missed_call_count` and append notes; open leads are deduplicated. |
| **6. Auto-Reply SMS Dispatch** | **7/10** | Compliant transactional formatting and opt-out checks; subject to 10DLC carrier approval. |
| **7. Owner Lead Notification** | **2/10** | **Critical Gap:** Contractor receives no SMS/push alert on mobile phone; must check dashboard. |
| **8. Inbound Reply Handling** | **9/10** | Telnyx message webhook routes replies to conversation thread with real-time updates. |
| **9. Public Booking Page** | **9/10** | Service-specific durations, buffer minutes, slot availability calculation, manage tokens. |
| **10. Appointment Scheduling** | **9/10** | PostgreSQL `23P01` exclusion constraint guarantees zero overlapping double-bookings. |
| **11. Pre-Appt Reminders** | **7/10** | Reminders scheduled in queue; execution depends on per-minute cron runner. |
| **12. Job Progression** | **8/10** | Clear status progression (scheduled -> en_route -> completed) with optional customer text. |
| **13. Review Request Dispatch** | **8/10** | Un-gated compliant review links, rate limited, delivery logged to audit trail. |

### **CORE LOOP SCORE: 77 / 100**

---

## 11. FIRST CUSTOMER READINESS

### "If I received $99 from a real customer tomorrow, what exactly would happen?"

Here is the exact chronological sequence of events and required manual operator steps:

1. **Payment Collection (Manual):**
   - The operator sends a $99 PayPal invoice or payment link from the **S M CREATIONS** business account.
   - The customer completes payment via PayPal.
2. **Account Creation:**
   - The customer visits `https://captodesk.com/client/login` and signs up via email/magic link or Google OAuth.
3. **Workspace Onboarding:**
   - The customer lands on `/client/onboarding` and enters business details (Business Name, Cell Phone, Business Address, EIN/Sole Prop).
   - CaptoDesk creates the organization record and default service catalog.
   - **No number is ordered yet; customer sees `Provisioning...` in settings.**
4. **Super Admin DID Provisioning (Manual Operator Action):**
   - The CaptoDesk operator logs into `/admin/organizations`.
   - Navigates to the new tenant's detail page.
   - Selects an available local area code, searches Telnyx inventory, and clicks **"Order & Provision DID"**.
   - CaptoDesk submits the real Telnyx order, links the connection and messaging profile, and stores the number in `telnyx_phone_numbers`.
5. **Subscription Activation (Manual Operator Action):**
   - In `/admin/organizations/[id]/subscription`, the operator clicks **"Record Payment"** ($99.00, PayPal reference) and sets the subscription status to **Active** (30-day period).
6. **10DLC Submission (Manual Operator Action):**
   - In `/admin/10dlc`, the operator triggers 10DLC brand and campaign registration for the new organization.
7. **Carrier Forwarding Activation (Coached Customer Action):**
   - The operator instructs the customer on their specific mobile carrier dial code:
     - *Verizon:* Dial `*71<PROVISIONED_DID>`
     - *AT&T:* Dial `*004*<PROVISIONED_DID>#`
     - *T-Mobile:* Dial `**004*<PROVISIONED_DID>#`
8. **Live Verification Test:**
   - The operator places a test call from an outside line to the customer's personal cell.
   - The customer ignores the call (lets it ring).
   - Call forwards to CaptoDesk's provisioned DID.
   - Operator hangs up; caller receives instant auto-reply text with booking link within 5 seconds.
   - Operator verifies that lead appears in customer's dashboard at `/client/leads`.

---

## 12. LIVE TESTS REQUIRED

The following verifications cannot be completed in code alone and require live carrier/account access:

| Test | Why Required | Required Account / Service | Expected Result |
|:---|:---|:---|:---|
| **Live DID Order** | Verify Telnyx Sub-Number Order API and webhook assignment | Funded Telnyx Account ($1.00+) | Number status transitions from `pending` to `active` |
| **AT&T Conditional Forwarding** | Verify GSM MMI codes on AT&T wireless | AT&T Mobile Phone | Call forwards on 3 unanswered rings |
| **T-Mobile Conditional Forwarding** | Verify `**004*` vs `**61*` on T-Mobile network | T-Mobile Mobile Phone | Call forwards on unanswered ring |
| **10DLC Carrier Delivery** | Verify SMS delivery without carrier spam filtering | Approved TCR Campaign | SMS reaches recipient mobile device |
| **Vercel Cron Inbound Ping** | Verify automated worker execution every minute | Vercel Pro or External Runner | HTTP 200 response from `/api/automations/worker` |
| **Stripe Live Checkout** | Verify homeowner invoice online card payment | Connected Stripe Account | Invoice updates to `paid` via webhook |

---

## 13. TOP 10 THINGS TO FIX BEFORE FIRST CUSTOMER

1. **Deploy Background Worker on Vercel Pro or Configure External Cron Runner:** Resolve `P0-DEP-01` to guarantee background queue execution.
2. **Correct Carrier Forwarding Instructions in UI:** Fix AT&T (`*004*`) and T-Mobile (`**004*`) dial codes in `src/app/client/settings/page.tsx`.
3. **Hide Carrier Forwarding Code Placeholder When DID is Null:** Prevent contractors from dialing `*71XXXXXXXXXX` before provisioning completes.
4. **Add Business Owner SMS Notification on Missed Call:** Dispatch an alert to `org.owner_phone` when a missed call generates a new lead.
5. **Resolve Local Supabase Environment Parity:** Fix `.env.local` service role key project mismatch to restore clean `npm run validate:env` output.
6. **Implement Fast Call Termination or TeXML Audio Greeting:** Prevent callers from experiencing 30–60 seconds of dead ringing.
7. **Pre-Register CaptoDesk 10DLC ISV Brand with Telnyx:** Submit master TCR brand to minimize campaign vetting delays for the first customer.
8. **Enforce Entitlement Check on Missed Call & SMS:** Protect against resource leakage by checking `hasActiveSaaSEntitlement()` in `call-recovery.ts`.
9. **Configure External Uptime Monitor:** Point a synthetic pinger at `/api/health` with operator SMS alerts.
10. **Document Operator Runbook for First Onboarding:** Provide a single-page checklist for manual PayPal receipt and Telnyx DID provisioning.

---

## 14. TOP 10 THINGS TO FIX BEFORE GENERAL AVAILABILITY (GA)

1. **Automate SaaS Subscription Billing:** Replace manual PayPal billing with automated Stripe Billing or PayPal Subscriptions with webhook reconciliation.
2. **Fix Team Member Invitation Flow (`P1-TEAM-01`):** Patch `handle_new_user()` trigger so invited teammates join their employer's workspace.
3. **Automate 10DLC Onboarding & TCR Approval Tracking:** Surface real-time carrier campaign review status directly in tenant settings.
4. **Sanitize Client IP Extraction (`P1-SEC-01`):** Ensure `cf-connecting-ip` is only trusted when verified behind Cloudflare CDN.
5. **Mask Business Federal Tax ID (EIN) in Organization API:** Restrict plain-text EIN to owner and admin roles.
6. **Automate Inbound Call Audio Greeting via TeXML:** Provide custom voicemail-style greeting ("We're on a job, texting you right now").
7. **Self-Healing Webhook Queue Resiliency:** Implement dead-letter queue inspection dashboard in Super Admin console.
8. **Automate Telnyx Number Allocation with Abuse Thresholds:** Allow verified paid signups to provision DIDs with credit limits.
9. **Eliminate 1,512 ESLint Warnings:** Enforce strict TypeScript typing across all services.
10. **Implement Native Mobile Push Notifications (PWA / WebPush):** Allow contractors to receive instant push alerts on iOS and Android devices.

---

## 15. TOP 10 PRODUCT / UX IMPROVEMENTS

1. **Immediate Lead SMS Alert to Owner's Cell:** *"New lead from (555) 123-4567. We texted them your booking link."*
2. **Carrier Forwarding Assistant Wizard:** Add a 1-tap carrier selector that formats a clickable `tel:` link on mobile.
3. **Clear "Number Configuring" Status Card:** Replace placeholder `XXXXXXXXXX` with a progress card: *"Your phone line is being prepared by our team."*
4. **Google Business Review Setup Guide:** Walk contractors through pasting their Google Maps review shortlink.
5. **Quick-Action "Call Back" Button in Inbox:** Allow contractors to tap to dial a lead directly from the mobile inbox.
6. **Audio Sound / Vibration on New Inbound SMS:** Ensure the web dashboard rings or vibrates when a customer replies.
7. **Simplified Service Catalog Presets:** Provide 1-click industry templates during onboarding (e.g., Lawn Mowing, Pipe Leak Repair, AC Tune-Up).
8. **Job Status Update One-Tap SMS:** Enable one-click *"I'm on my way"* customer notifications from the Jobs screen.
9. **Visual Calendar Slot Blocking:** Allow contractors to drag and block personal hours directly on the calendar.
10. **Revenue Impact Metric on Dashboard:** Highlight *"Estimated Revenue Recovered"* based on missed calls converted into jobs.

---

## 16. MANUAL OPERATOR BURDEN

### MUST BE AUTOMATED BEFORE FIRST CUSTOMER:
- **None.** All necessary manual steps for a single pilot customer (PayPal payment recording, Super Admin DID ordering, carrier forwarding coaching) are feasible.

### CAN REMAIN MANUAL FOR FIRST 1–5 CUSTOMERS:
- **PayPal Payment Logging:** Invoicing customer via S M CREATIONS PayPal and clicking "Record Payment" in Admin console.
- **DID Ordering:** Searching and ordering Telnyx phone numbers via `/admin/organizations/[id]`.
- **10DLC Registration:** Triggering TCR submission via `/admin/10dlc`.
- **Carrier Forwarding Guidance:** Coaching the contractor through dialing their carrier forwarding code.

### SHOULD BE AUTOMATED BEFORE 20 CUSTOMERS:
- **SaaS Subscription Billing:** Automated recurring credit card charges via Stripe/PayPal.
- **Automated Number Provisioning:** Instant DID assignment upon subscription payment.
- **Automated 10DLC Brand/Campaign Submission:** Direct API integration triggered at onboarding.
- **Team Invitations:** Automated employee profile linkage without manual database fixes.

---

## 17. LIVE INTEGRATION CHECKLIST

- [ ] **Supabase:** Verify database connectivity with matching project credentials (`validate:env` returns PASS).
- [ ] **Vercel Pro / External Cron:** Verify `/api/automations/worker` responds HTTP 200 every minute with `Authorization: Bearer <CRON_SECRET>`.
- [ ] **Telnyx Account:** Verify account has active balance ($10+) and API key has number purchase permissions.
- [ ] **Telnyx Voice Webhook:** Configure Call Control application inbound webhook to `https://<domain>/api/webhooks/telnyx/voice`.
- [ ] **Telnyx Messaging Profile:** Link provisioned DID to messaging profile pointing to `https://<domain>/api/webhooks/telnyx/messages`.
- [ ] **Carrier Forwarding:** Place test call to contractor phone; verify conditional forwarding to Telnyx DID on Verizon, AT&T, and T-Mobile.
- [ ] **Outbound SMS:** Verify customer receives auto-reply SMS within 5 seconds of hanging up.
- [ ] **10DLC Registration:** Verify TCR campaign status in Telnyx dashboard (`in_review` or `approved`).
- [ ] **PayPal SaaS Billing:** Verify payment reference is logged in `saas_payments` and organization status is active.
- [ ] **External Monitoring:** Verify `/api/health` returns HTTP 200 to external uptime monitor (e.g. BetterStack).

---

## 18. FINAL VERDICT

### Can CaptoDesk safely onboard ONE paying customer?
### **YES (CONDITIONAL)**
*Conditions:*
1. Super Admin manually orders the Telnyx number in `/admin/organizations`.
2. Operator provides the correct carrier forwarding code for the contractor's carrier (`*71` for Verizon, `*004*` for AT&T/T-Mobile).
3. The background worker is triggered by Vercel Pro or an external cron runner.
4. The customer is informed that new leads must be viewed on the dashboard until direct SMS lead notifications are shipped.

---

### Can CaptoDesk safely operate with 5 paying customers?
### **YES (CONDITIONAL)**
*Conditions:* Same as above. The manual operator burden of managing 5 numbers and recording 5 monthly PayPal payments is fully manageable by a single founder.

---

### Can CaptoDesk safely operate with 20 paying customers?
### **CONDITIONAL**
*Conditions:* Team invitations (`handle_new_user`) must be resolved so employees can use the app; business owner SMS lead alerts must be active; and automated recurring billing should be introduced to eliminate manual invoicing overhead.

---

### Can CaptoDesk launch publicly?
### **NO**
*Conditions for Public Launch:* Public self-serve onboarding requires automated credit card billing, automated number provisioning with fraud/abuse controls, automated 10DLC vetting status display, and self-serve team member onboarding.

---

## 19. RECOMMENDED REMEDIATION ORDER

1. **Fix Vercel Cron Scheduling & Worker Execution (`P0-DEP-01`):** Upgrade Vercel to Pro or configure an external cron runner (e.g. Upstash QStash) calling `POST /api/automations/worker` with `CRON_SECRET`.
2. **Correct Carrier Dial Codes in Settings (`P1-TEL-02`):** Update `src/app/client/settings/page.tsx` with accurate GSM MMI codes (`*004*` / `**004*`) for AT&T and T-Mobile.
3. **Conditionally Hide Carrier Codes When DID is Unprovisioned (`P2-UX-01`):** Prevent contractors from dialing placeholder `*71XXXXXXXXXX` digits.
4. **Implement Outbound Contractor SMS Alert on Missed Call (`P1-NOTIF-01`):** Add owner notification dispatch in `src/lib/services/call-recovery.ts`.
5. **Fix Team Member Invitation Trigger (`P1-TEAM-01`):** Update `handle_new_user()` in a new migration to preserve `org_id` and `role` from user metadata.
6. **Implement Inbound Call Audio / TeXML Rejection (`P0-TEL-01`):** Prevent 30–60 seconds of caller dead ringing before disconnect.
7. **Enforce SaaS Entitlement on Missed Call & SMS (`P1-BILL-01`):** Gate `call-recovery.ts` and `messages/send` behind `hasActiveSaaSEntitlement()`.
8. **Fix Client IP Extraction Header Precedence (`P1-SEC-01`):** Prioritize `x-vercel-forwarded-for` over untrusted `cf-connecting-ip`.
9. **Mask Federal Tax ID (EIN) in Organization API (`P2-PRIV-01`):** Restrict plain-text EIN to owner and client_admin roles.
10. **Connect External Synthetic Uptime Monitor (`P2-OBS-01`):** Point an external monitor at `/api/health` with alerting.
11. **Align Local Environment Parity (`P1-OBS-01`):** Update local `.env.local` service role key to match the active Supabase project.
12. **Automate SaaS Subscription Billing (`P2-BILL-02`):** Transition from manual PayPal logging to automated recurring billing before 20 customers.
