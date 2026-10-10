# CAPTODESK — P1-OPS-03 BILLING FOUNDATION REMEDIATION REPORT
## Provider-Independent Subscription System + Manual Initial Billing Operations

**Author**: Senior SaaS Billing Architect & Security Engineer  
**Date**: October 10, 2026  
**Status**: COMPLETE & VERIFIED  
**Production Blocker Remediated**: P1-OPS-03  
**Telnyx Telephony Status**: TELNYX LIVE VERIFICATION: DEFERRED (Pending first paying customer)  

---

## 1. Executive Summary & Business Context

CaptoDesk is operated from India with a verified PayPal Business account under **S M CREATIONS**.
CaptoDesk does not yet have paying customers. Live Stripe or automated payment gateway integration was intentionally avoided to prevent unnecessary infrastructure complexity, fees, or compliance hurdles before the first customer signs on.

### The Problem Remediated (P1-OPS-03)
The platform previously possessed only primitive organization status flags (`subscription_status`, `monthly_rate`) and had no dedicated SaaS subscription tracking, period duration management, payment recording ledger, or operator interface to manage customer subscriptions. The only existing payment system was designed strictly for homeowner invoice payments on contractor jobs.

### The Remediation
1. **Engineered Provider-Independent SaaS Subscription Foundation**: Created a decoupled subscription system (`saas_subscriptions` and `saas_payments`) completely separated from homeowner job payments.
2. **Built Manual PayPal Initial Billing Workflow**: Operators can invoice or collect payments via PayPal (S M CREATIONS) and activate/renew tenant subscriptions through a secure Super Admin interface with full audit trailing.
3. **Established Extensible Gateway Boundary**: Implemented clean `BillingProvider` interface allowing seamless future plug-in of automated payment providers (PayPal Subscriptions API, Stripe SaaS, or Dodo Payments) without touching subscription schemas or entitlement checks.
4. **Enforced Server-Authoritative Security**: Client-controlled prices, currencies, status flags, and cross-tenant tampering are strictly rejected (HTTP 400).
5. **Comprehensive Automated Verification**: Created 19-point automated test suite with 100% pass rate, zero typecheck errors, zero lint errors, and zero regression across the existing 468+ tests.

---

## 2. Architectural Design & Separation of Concerns

```
                               CAPTODESK PAYMENT ISOLATION
                               
   ┌─────────────────────────────────────────┐   ┌────────────────────────────────────────┐
   │       SaaS PLATFORM BILLING             │   │        HOMEOWNER JOB BILLING           │
   │      (Contractor pays CaptoDesk)        │   │       (Homeowner pays Contractor)      │
   ├─────────────────────────────────────────┤   ├────────────────────────────────────────┤
   │ Tables:                                 │   │ Tables:                                │
   │ - public.saas_subscriptions             │   │ - public.invoices                      │
   │ - public.saas_payments                  │   │ - public.payments                      │
   │ - public.activity_logs (audit)          │   │ - stripe_accounts (Connect)            │
   ├─────────────────────────────────────────┤   ├────────────────────────────────────────┤
   │ Model: $99/mo USD (CaptoDesk Standard)  │   │ Model: Variable job amounts ($89-$500) │
   │ Provider: PayPal Manual (S M CREATIONS) │   │ Provider: Stripe Connect / Cash / Check│
   │ Admin: Super Admin Only (/admin/*)      │   │ User: Contractor Client (/client/*)    │
   └─────────────────────────────────────────┘   └────────────────────────────────────────┘
```

Both systems share zero tables, zero routes, and zero mutating logic, guaranteeing complete multi-tenant and financial isolation.

---

## 3. Database Schema Changes (Migration 34)

File: `supabase/migrations/34_saas_subscription_foundation.sql`

### 1. `public.saas_subscriptions`
```sql
CREATE TABLE IF NOT EXISTS public.saas_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL DEFAULT 'captodesk_standard',
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'active', 'past_due', 'canceled', 'expired')),
    billing_interval TEXT NOT NULL DEFAULT 'month' 
        CHECK (billing_interval IN ('month', 'year')),
    amount NUMERIC(10,2) NOT NULL DEFAULT 99.00 CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    current_period_start TIMESTAMPTZ NULL,
    current_period_end TIMESTAMPTZ NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    canceled_at TIMESTAMPTZ NULL,
    provider TEXT NOT NULL DEFAULT 'manual',
    provider_subscription_reference TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_saas_subscriptions_org_id UNIQUE (org_id)
);
```

### 2. `public.saas_payments`
```sql
CREATE TABLE IF NOT EXISTS public.saas_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES public.saas_subscriptions(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    billing_period_start TIMESTAMPTZ NOT NULL,
    billing_period_end TIMESTAMPTZ NOT NULL,
    provider TEXT NOT NULL DEFAULT 'paypal_manual',
    provider_payment_reference TEXT NULL,
    payment_status TEXT NOT NULL DEFAULT 'completed' 
        CHECK (payment_status IN ('completed', 'refunded', 'pending', 'failed')),
    notes TEXT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_saas_payments_period UNIQUE (subscription_id, billing_period_start, billing_period_end),
    CONSTRAINT chk_saas_payments_period CHECK (billing_period_end > billing_period_start)
);
```

### 3. Row-Level Security (RLS)
- Both tables have RLS enabled with fail-closed default.
- Tenant members can only `SELECT` records where `org_id = current_org_id()`.
- Super Admins have unrestricted access via policy `super_admin_manage_saas_*`.

---

## 4. Implementation Details

### A. Central Plan Registry (`src/lib/billing/plans.ts`)
- Canonical default plan: `captodesk_standard`
- Rate: $99.00 USD / month
- Features entitled: Dedicated Telnyx DID, AI missed-call recovery, service catalog & public booking, automated SMS reminders, lead intelligence, quotes and invoicing.
- Clean period calculation helper (`calculatePeriodEnd`) preserving calendar month days without timezone drift.

### B. Core Subscription Service (`src/lib/billing/subscription-service.ts`)
- **`getSubscription(supabase, orgId)`**: Fetches current subscription; automatically evaluates whether period has expired and transitions state to `expired` + `past_due`.
- **`getEntitlement(supabase, orgId)`**: Server-side authorization check determining active platform access (`isEntitled: boolean`), honoring grace periods when `cancel_at_period_end` is true.
- **`activateSubscription(supabase, actor, orgId, input)`**: Sets status to active, creates subscription row, logs payment, advances period, synchronizes organizations table, and logs audit event.
- **`renewSubscription(supabase, actor, orgId, input)`**: Seamlessly extends period from current end date without gaps, creates payment record, and enforces duplicate-period idempotency.
- **`cancelSubscription(supabase, actor, orgId, input)`**: Supports graceful cancellation at period end (`cancel_at_period_end: true`) or immediate termination (`status: 'canceled'`).
- **`reactivateSubscription(supabase, actor, orgId)`**: Clears pending cancellation and restores subscription.
- **`recordPayment(supabase, actor, orgId, input)`**: Directly logs manual or external bank/PayPal payments.

### C. Super Admin API Endpoints
All endpoints enforce `admin:all` permission via `getTenantContext`:
- `GET /api/admin/organizations/[id]/subscription`
- `POST /api/admin/organizations/[id]/subscription/activate`
- `POST /api/admin/organizations/[id]/subscription/renew`
- `POST /api/admin/organizations/[id]/subscription/cancel`
- `POST /api/admin/organizations/[id]/subscription/reactivate`
- `GET` & `POST /api/admin/organizations/[id]/subscription/payments`

**Security Validations Enforced**:
- Rejects client-supplied `amount` or `price` (400 Bad Request)
- Rejects non-USD currencies (400 Bad Request)
- Rejects client attempts to specify subscription `status` (400 Bad Request)
- Rejects mismatched `org_id` in body (400 Bad Request)
- Rejects invalid `periodMonths` outside 1–12 range (400 Bad Request)

### D. Super Admin Billing Management UI (`src/app/admin/organizations/page.tsx`)
- Added **"Billing"** button in tenant row action menu.
- Interactive modal with:
  - Plan rate card ($99.00/mo USD)
  - Subscription status badge + PayPal provider tag
  - Period start, end, and days remaining countdown
  - Cancellation warning banner if scheduled for cancellation
  - Activation form (PayPal Transaction ID, 1/3/6/12 month duration, admin notes)
  - Renewal form (PayPal Transaction ID, duration, notes)
  - Cancellation options (Immediate termination vs Cancel at period end)
  - Reactivation button for canceled/canceling subscriptions
  - Complete searchable payment history table

---

## 5. Verification & Test Suite

File: `test/p1-ops-saas-billing.test.mjs`

### Test Suite Results (19 / 19 PASS)
```
# Subtest: 1. Super Admin Authorization: Unauthenticated request rejected (401)
ok 1 - 1. Super Admin Authorization: Unauthenticated request rejected (401)
# Subtest: 2. Super Admin Authorization: Regular client member rejected (403)
ok 2 - 2. Super Admin Authorization: Regular client member rejected (403)
# Subtest: 3. Super Admin Authorization: Super Admin allowed (200)
ok 3 - 3. Super Admin Authorization: Super Admin allowed (200)
# Subtest: 4. Super Admin Authorization: Non-existent org returns 404
ok 4 - 4. Super Admin Authorization: Non-existent org returns 404
# Subtest: 5. Subscription Activation: Super Admin activates subscription cleanly
ok 5 - 5. Subscription Activation: Super Admin activates subscription cleanly
# Subtest: 6. Server-Authoritative Pricing: Reject client supplying amount (400)
ok 6 - 6. Server-Authoritative Pricing: Reject client supplying amount (400)
# Subtest: 7. Server-Authoritative Currency: Reject non-USD currency (400)
ok 7 - 7. Server-Authoritative Currency: Reject non-USD currency (400)
# Subtest: 8. Client Tampering: Reject forced status transition (400)
ok 8 - 8. Client Tampering: Reject forced status transition (400)
# Subtest: 9. Client Tampering: Reject cross-tenant org_id mismatch in payload (400)
ok 9 - 9. Client Tampering: Reject cross-tenant org_id mismatch in payload (400)
# Subtest: 10. Client Tampering: Reject invalid periodMonths (400)
ok 10 - 10. Client Tampering: Reject invalid periodMonths (400)
# Subtest: 11. Subscription Renewal: Extends subscription period and records payment
ok 11 - 11. Subscription Renewal: Extends subscription period and records payment
# Subtest: 12. Idempotency: Duplicate payment for identical period rejected by DB constraint
ok 12 - 12. Idempotency: Duplicate payment for identical period rejected by DB constraint
# Subtest: 13. Cancellation at period end: Keeps active entitlement until period end
ok 13 - 13. Cancellation at period end: Keeps active entitlement until period end
# Subtest: 14. Immediate Cancellation: Immediately revokes entitlement and sets status to canceled
ok 14 - 14. Immediate Cancellation: Immediately revokes entitlement and sets status to canceled
# Subtest: 15. Reactivation: Clears pending cancellation and restores subscription
ok 15 - 15. Reactivation: Clears pending cancellation and restores subscription
# Subtest: 16. Direct Manual Payment Recording: POST payments route succeeds with valid params
ok 16 - 16. Direct Manual Payment Recording: POST payments route succeeds with valid params
# Subtest: 17. Direct Manual Payment Recording: Rejects invalid date ordering (end <= start)
ok 17 - 17. Direct Manual Payment Recording: Rejects invalid date ordering (end <= start)
# Subtest: 18. Entitlement Logic: Expired subscription denies access
ok 18 - 18. Entitlement Logic: Expired subscription denies access
# Subtest: 19. Segregation: Homeowner payments & invoices remain completely untouched
ok 19 - 19. Segregation: Homeowner payments & invoices remain completely untouched
```

---

## 6. Full Regression Matrix

| Check | Result | Details |
|---|---|---|
| `npm test` | **PASS (487 / 487)** | All 38 test suites pass with zero failures |
| `npm run test:security` | **PASS (55 / 55)** | Multi-tenant and RBAC security matrix verified |
| `npm run test:integration` | **PASS (15 / 15)** | Real PostgreSQL GiST concurrency verified |
| `npm run typecheck` | **PASS** | 0 TypeScript errors |
| `npm run lint` | **PASS** | 0 ESLint errors |
| `npm run build` | **PASS** | All routes compiled and optimized |

---

## 7. Operator Runbook for First Paying Customer

When the first customer agrees to purchase CaptoDesk:
1. **Invoice via PayPal**:
   - Send invoice or PayPal payment link from **S M CREATIONS** PayPal Business account for **$99.00 USD**.
2. **Collect & Verify Payment**:
   - Confirm receipt in PayPal dashboard and copy PayPal Transaction ID (`PAYID-...`).
3. **Activate Tenant**:
   - Open CaptoDesk Super Admin dashboard (`/admin/organizations`).
   - Locate customer organization and click **"Billing"**.
   - Paste PayPal Transaction ID, select billing duration (1 month), and click **"Activate Subscription"**.
4. **Order Phone Number (P1-OPS-01)**:
   - Click **"Order & Provision DID"** to acquire dedicated Telnyx phone number using official Number Orders API.
5. **Customer Go-Live**:
   - Customer accesses their portal (`/client/dashboard`) with full active entitlement.
