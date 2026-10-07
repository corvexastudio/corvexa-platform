# CaptoDesk Production Deployment Runbook

**System:** CaptoDesk SaaS Platform  
**Target Environments:** Vercel (Edge & Serverless Tier) + Supabase (PostgreSQL 15+ Enterprise) + Telnyx (Voice/SMS) + Stripe (Payments)  
**Document Owner:** Senior Production Release Engineer  
**Version:** 1.0.0 (Production Release Ready)  

---

## 1. Architecture & Tier Overview

CaptoDesk employs a modern, distributed architecture:
- **Presentation & API Tier:** Next.js 16 (App Router + Turbopack) deployed on Vercel with edge middleware rewrite proxy (`src/proxy.ts`).
- **Database & Identity Tier:** Supabase PostgreSQL with strict Row Level Security (RLS) and keyset-indexed relational tables.
- **Telephony & Messaging Tier:** Telnyx Voice & SMS with Ed25519 cryptographic signature verification.
- **Invoicing & Payments Tier:** Stripe API & webhook listeners for asynchronous payment reconciliation.
- **Background Worker Tier:** Autonomous cron-triggered worker (`/api/automations/worker`) managed via Vercel Cron (`vercel.json`).

---

## 2. Pre-Deployment Prerequisites

Ensure the following accounts and permissions are ready:
1. **GitHub Repository:** Administrative access to `corvexastudio/corvexa-platform`.
2. **Vercel Team Account:** Permissions to manage production domains and environment variables for `corvexa-platform`.
3. **Supabase Organization:** Production project with PostgreSQL 15+ and `uuid-ossp` extension enabled.
4. **Telnyx Mission Control Portal:** Production API key, Ed25519 public key, and active 10DLC messaging profile.
5. **Stripe Dashboard:** Production Stripe account in live mode with webhook destination endpoints configured.

---

## 3. Database Migration Sequence

When provisioning a fresh Supabase database or deploying updates, execute SQL migrations in strict order:

### Option A: Master Schema (Single Run for Fresh Databases)
Run `supabase/schema.sql` in the Supabase SQL Editor:
```sql
-- Paste entire contents of supabase/schema.sql into:
-- https://supabase.com/dashboard/project/<PROJECT_ID>/sql/new
```

### Option B: Incremental Migrations (Existing Database Upgrades)
If updating an existing production environment, run migrations sequentially:
1. `02_auth_and_onboarding.sql` - Base auth profiles and onboarding policies
2. `03_p0_security_and_rls_lockdown.sql` - Core RLS policies
3. `04_phase1_security_multitenancy.sql` - Tenant context & role isolation
4. `05_phase2_telnyx_missed_call_engine.sql` - Calls, telephony logs, auto-replies
5. `06_phase3_event_automation_engine.sql` - Automation rules, runs, actions
6. `07_phase4_booking_system.sql` - Services, appointments, buffer rules
7. `08_phase5_quotes_and_jobs.sql` - Line items, tokens, quote lifecycle
8. `09_fix_manage_token_and_missing_columns.sql` - Integrity constraints
9. `10_phase6_invoicing_and_payments.sql` - Invoices, tax rates, Stripe sessions
10. `11_phase7_reviews_and_retention.sql` - Review invites, anti-gating, lifecycle
11. `12_phase8_customer_intelligence.sql` - Aggregated metrics & CRM tags
12. `13_phase9_dashboard_and_reporting.sql` - Metric views
13. `14_phase10_admin_operations.sql` - Super admin diagnostics & audit logs
14. `15_phase11_observability_reliability.sql` - Telemetry snapshots & idempotency
15. `16_phase12_performance_indexing.sql` - Keyset performance indexes
16. `17_phase14_compliance_messaging_safety.sql` - Suppression lists, TCPA records

---

## 4. Domain & DNS Configuration

Configure DNS records with your DNS provider (Cloudflare, Namecheap, Vercel DNS):

| Host / Subdomain | Type | Target | Purpose |
| :--- | :--- | :--- | :--- |
| `@` (root) | A | `76.76.21.21` (Vercel) | Marketing / Root redirect to client portal |
| `app` | CNAME | `cname.vercel-dns.com` | Primary Small-Business Client Portal |
| `admin` | CNAME | `cname.vercel-dns.com` | Super Admin Operations Console |
| `book` | CNAME | `cname.vercel-dns.com` | Public Customer Booking Portal |

*Proxy Edge Behavior:*
- Requests to `admin.domain.com` automatically rewrite to `/admin`.
- Requests to `book.domain.com/:slug` automatically rewrite to `/book/:slug`.
- Requests to `app.domain.com` serve `/client/dashboard` directly.

---

## 5. External Webhook Registration

### A. Telnyx Webhook Configuration
1. Navigate to **Telnyx Mission Control** -> **Outbound Voice** / **Messaging Profiles**.
2. Set Webhook URLs:
   - Voice: `https://app.corvexastudio.com/api/webhooks/telnyx/voice`
   - Messages: `https://app.corvexastudio.com/api/webhooks/telnyx/messages`
3. Set Webhook Version to **API v2**.
4. Retrieve the **Ed25519 Public Key** from the profile and set `TELNYX_PUBLIC_KEY` in Vercel.

### B. Stripe Webhook Configuration
1. Navigate to **Stripe Dashboard** -> **Developers** -> **Webhooks**.
2. Add endpoint: `https://app.corvexastudio.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Retrieve the **Signing Secret** (`whsec_...`) and set `STRIPE_WEBHOOK_SECRET` in Vercel.

---

## 6. Vercel Deployment & Verification Protocol

### Step 1: Set Production Environment Variables
Set all variables specified in `ENVIRONMENT.md` under Vercel Project Settings for the **Production** environment.

### Step 2: Trigger Production Deployment
```bash
# Deploy to Vercel production
npx vercel --prod --yes
```

### Step 3: Smoke Test Checklist
Immediately verify post-deployment health:
- [ ] `GET https://app.corvexastudio.com/api/health` returns `{"status": "healthy"}` with HTTP 200.
- [ ] Database latency is under 50ms.
- [ ] `/admin/login` loads with Super Admin authentication controls.
- [ ] Public booking test page `https://app.corvexastudio.com/book/test-org` loads available slots.
- [ ] Telnyx Ping in `/api/admin/diagnostics` succeeds.
- [ ] Stripe API key status in `/api/admin/diagnostics` reports live mode (`sk_live_`).

---

## 7. Production Security Guarantees & Fail-Closed Baseline

The following architectural guarantees are strictly enforced in production:

1. **Privileged Supabase Isolation (`src/lib/supabase/admin.ts`):**
   - Server-only helper `createAdminClient()` enforces `SUPABASE_SERVICE_ROLE_KEY`.
   - Never falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Missing key throws a fatal error and halts execution.
   - Guarded against client-side bundling and execution.

2. **Zero Fake SMS in Production (`src/lib/telnyx.ts`):**
   - Missing `TELNYX_API_KEY` in production (`NODE_ENV === 'production'`) yields a hard configuration failure with error diagnostics.
   - Simulation / mock message IDs are strictly forbidden in production.

3. **Fail-Closed Super-Admin Allowlist (`src/lib/security/tenant-context.ts`):**
   - In production, missing or empty `SUPER_ADMIN_EMAILS` fails closed (`isSuperAdminEmail = false`).
   - Any profile claiming `role: 'super_admin'` whose email is not in `SUPER_ADMIN_EMAILS` is automatically demoted to `owner` and constrained to single-tenant isolation.

4. **Atomic Automation Worker Claiming (`src/lib/automations/worker.ts`):**
   - Background worker claiming mandates the PostgreSQL RPC `claim_due_automation_runs` (`FOR UPDATE SKIP LOCKED`).
   - If the RPC fails or is unavailable in production, the worker logs a critical fault and returns `[]`. It never falls back to naive query loops that would cause duplicate customer messages.

5. **Fail-Closed Stripe Webhook Signatures (`src/lib/payments/stripe-adapter.ts`):**
   - In production, missing `STRIPE_WEBHOOK_SECRET` immediately rejects incoming webhooks.
   - Simulated payload parsing is strictly prohibited in live environments.

6. **Anti-Spoofing Client IP Extraction (`src/lib/security/rate-limiter.ts`):**
   - Prioritizes trusted edge headers (`cf-connecting-ip`, `x-real-ip`, `x-vercel-forwarded-for`) over easily spoofed `x-forwarded-for` headers.

