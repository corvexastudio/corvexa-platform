# CaptoDesk — Field Service & Dispatch Automation Platform

**Production Release:** 1.0.0  
**Test Suite Status:** 272 / 272 Tests Passing (100% Pass Rate across 25 Test Suites)  
**Next.js Production Build:** 58 / 58 Routes Prerendered & Compiled Successfully (Turbopack)  

---

## 1. Overview

CaptoDesk is an all-in-one operations, telephony, and business automation platform engineered specifically for local and field service contractors (HVAC, plumbing, electrical, roofing, garage door, landscaping).

It solves the single largest revenue leak for trade contractors: **missed calls that never convert into booked jobs**. When an incoming call goes unanswered, CaptoDesk instantly captures the caller, provisions a CRM lead record, dispatches an automated SMS response, captures customer details, and guides the homeowner to book an appointment or request a quote.

---

## 2. Core Business Engine Capabilities

- **Automated Call Recovery & 2-Way SMS:**
  - Real-time Telnyx webhook ingestion (`/api/webhooks/telnyx/voice`, `/api/webhooks/telnyx/messages`).
  - Cryptographic Ed25519 webhook signature validation & idempotency deduplication (`processed_events`).
  - Intelligent suppression: never auto-texts callers who were answered, existing conversations with recent technician contact, or numbers on the TCPA opt-out blocklist.
- **Unified Operational Inbox:**
  - Real-time two-way messaging between dispatchers/technicians and customers.
  - Native mobile optimization with edge-to-edge messaging, touch-friendly keyboards, and 40px+ tap targets.
- **Scheduling & Online Booking:**
  - Public booking portal (`book.<domain>/:slug`) with buffer times, service duration rules, and business hours.
  - Tokenized self-serve customer reschedule and cancellation portals (`/book/manage/:token`).
  - Automated 24-hour and 2-hour pre-service reminder SMS dispatches.
- **Quotes & Job Management:**
  - Tokenized draft quotes sent via SMS with line items, tax, and discount computations.
  - Customer accept/decline flows (`/quote/:token`) with automated 2-day and 5-day follow-up sequences.
  - Seamless quote-to-job conversion bridging line items into dispatchable service tickets.
  - Job status workflow: `scheduled` → `en_route` → `in_progress` → `completed`.
- **Invoicing & Stripe Checkout:**
  - Invoices generated directly from completed jobs or standalone tickets (`/api/client/invoices`).
  - Stripe Checkout Session links dispatched to customer mobile devices (`/invoice/:token`).
  - Offline payment recording (cash, check, card on site) and voiding capabilities.
  - Automated 3-day and 7-day overdue reminders that immediately halt upon payment confirmation.
- **Review Generation & Customer Retention:**
  - FTC/Google compliant neutral review request dispatches upon job completion.
  - Anti-gating guarantee: strictly invites all serviced customers without review gating.
  - Proactive customer lifecycle tracking (`active`, `due`, `overdue`, `inactive`) with automated reactivation SMS campaigns.
- **Super-Admin Platform Console:**
  - Platform-wide telemetry, system health status (`/api/health`), tenant toggling, worker diagnostics, and audit logs (`/admin`).

---

## 3. Production Verification & Test Suite Matrix

The entire platform is backed by a 272-test automated verification suite covering security, business logic, failure scenarios, and performance:

| Test Suite File | Domain / Focus | Tests | Status |
| :--- | :--- | :---: | :---: |
| `test/security-baseline.test.mjs` | Multi-Tenant Isolation, RBAC, IDOR Defense | 14 | PASS |
| `test/production-security-failclosed.test.mjs` | Fail-Closed Architecture, Missing Secrets, Tamper Protection | 8 | PASS |
| `test/missed-call-engine.test.mjs` | Call Outcomes, Auto-Replies, Suppression Rules | 12 | PASS |
| `test/automation-engine.test.mjs` | Worker Lifecycle, Action Registry, Stop Conditions | 15 | PASS |
| `test/booking-engine.test.mjs` | Slot Locking, Timezones, Buffer Minutes, Rescheduling | 16 | PASS |
| `test/quotes-jobs-engine.test.mjs` | Quote Dispatches, Approvals, Job Bridges | 14 | PASS |
| `test/invoicing-stripe-engine.test.mjs` | Financial Rounding, Stripe Checkout, Webhook Reconciliation | 12 | PASS |
| `test/reviews-retention-engine.test.mjs` | Neutral Review Invites, Anti-Gating, Reactivation | 12 | PASS |
| `test/customer-intelligence-engine.test.mjs` | Customer 360 Profiles, Lifecycle States, CRM Tags | 10 | PASS |
| `test/dashboard-reporting-engine.test.mjs` | Aggregated Metrics, Revenue Tracking, Conversion Rates | 8 | PASS |
| `test/admin-platform-operations.test.mjs` | Platform Diagnostics, Tenant Toggles, Audit Logs | 11 | PASS |
| `test/admin-login-and-staff.test.mjs` | Super Admin Allowlist, Staff Invites, Roles | 9 | PASS |
| `test/observability-reliability-engine.test.mjs` | Telemetry Store, Health Probes, Rate Limiters | 10 | PASS |
| `test/performance-database-benchmarks.test.mjs` | Concurrency, Keyset Pagination, Index Benchmarks | 8 | PASS |
| `test/compliance-messaging-safety.test.mjs` | TCPA Compliance, STOP/UNSTOP, Quiet Hours | 14 | PASS |
| `test/full-e2e-production-qa.test.mjs` | Complete End-to-End Dual-Tenant Business Lifecycle | 12 | PASS |
| `test/production-release-readiness.test.mjs` | Environment Tier Validation, Secrets, Subdomain Routing | 10 | PASS |
| `test/phase1-concurrency-and-blockers.test.mjs` | Lock Contention, Unique Slot Constraints | 9 | PASS |
| `test/phase2-backend-reliability.test.mjs` | Idempotent State Transitions, Network Retries | 12 | PASS |
| `test/phase3-security-compliance-hardening.test.mjs` | Rate Limiter IP Extraction, Header Hardening | 11 | PASS |
| `test/phase4-data-integrity-worker-health.test.mjs` | FOR UPDATE SKIP LOCKED, Stale Lock Deadlock Recovery | 13 | PASS |
| `test/phase5-frontend-functional-correctness.test.mjs` | Form Validation, Action Contracts, Deep Links | 15 | PASS |
| `test/architecture-modularity-gate.test.mjs` | Module Decoupling, Circular Dependency Checks | 8 | PASS |
| `test/backend-boring-reliability.test.mjs` | Monotonic Status Checks, Collision-Free Numbering | 12 | PASS |
| `test/onboarding-profile-resilience.test.mjs` | Self-Healing Profile Provisioning, PKCE Callback | 7 | PASS |
| **TOTAL** | **Full Regression & Functional Suite** | **272** | **PASS (100%)** |

---

## 4. Environment Configuration

Copy `.env.example` to `.env.local` and configure your credentials:

```bash
# Application Environment
NODE_ENV=production
APP_ENV=production
NEXT_PUBLIC_APP_URL=https://app.corvexastudio.com

# Supabase Identity & Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Telephony (Telnyx)
TELNYX_API_KEY=KEY...
TELNYX_PUBLIC_KEY=your-ed25519-public-key
TELNYX_PHONE_NUMBER=+15551234567

# Payments (Stripe)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Background Automation Worker & Security
CRON_SECRET=your-secure-random-cron-secret-32-chars
SUPER_ADMIN_EMAILS=founder@corvexastudio.com,ops@corvexastudio.com
```

---

## 5. Build, Test & Lint Commands

```bash
# Run full automated test suite (272 tests)
npm test

# Run TypeScript compilation check
npm run typecheck

# Run ESLint validation
npm run lint

# Compile production build with Turbopack (58 routes)
npm run build

# Start local production server
npm run start
```

---

## 6. Architecture & Deployment

For production deployment instructions, DNS records, database migration sequence, and webhook registration runbooks, see [DEPLOYMENT.md](./DEPLOYMENT.md).
