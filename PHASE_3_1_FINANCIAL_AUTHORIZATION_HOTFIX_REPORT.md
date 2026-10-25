# CAPTODESK — PHASE 3.1: FINANCIAL API AUTHORIZATION HOTFIX REPORT

**Author:** Principal Application Security Engineer & Senior Next.js Architect  
**Date:** October 25, 2026  
**Target Repository:** `C:\Users\mskar\captodesk`  
**Status:** Remediated & Verified  

---

## 1. Executive Summary & Verified Audit Findings

During the architectural security audit (`CAPTODESK_AUDIT_REPORT.md`), two critical financial authorization vulnerabilities were confirmed in the tenant API layer:

1. **`RBAC-002` (Over-Privileged Member Access to Financial Invoicing & Quotes):**
   - **Diagnosis:** The canonical role normalization function previously collapsed the `dispatcher` role into `member`. While `member` was restricted from tenant billing (`org:billing`) and team administration, all financial routes—including invoice listing, invoice creation, offline payment recording, quote generation, and sending—were previously evaluated using coarse operational permissions (e.g. `appointments:manage`, `appointments:read`), or lacked explicit financial permission barriers. Consequently, dispatchers and technicians could issue invoices, inspect company billing records, record cash payments, and modify quote pricing via direct API calls.
2. **`RBAC-004` (Executive Financial Data Exposure on Dashboard & Customer 360):**
   - **Diagnosis:** The primary dashboard metrics endpoint (`/api/client/dashboard`) and Customer 360 endpoint (`/api/client/customers/[id]`) returned total revenue collected, outstanding invoice balances, booked revenue values, quote conversion metrics, and attention queue items to any user with `org:view`. Because `dispatcher` was granted `org:view` to monitor scheduling and missed calls, dispatchers could view all company-wide financial metrics and customer billing balances.

### Scope of the Hotfix
Phase 3.1 strictly resolves these vulnerabilities at the server-authoritative API layer without modifying database schemas, migrations, or remote Supabase RLS policies:
- Distinct, fine-grained financial permissions introduced.
- `dispatcher` preserved as a distinct canonical role with least-privilege operational permissions.
- Invoices, quotes, payments, dashboard, and customer 360 endpoints gated with dedicated financial permissions.
- Navigation, dashboard UI widgets, and universal quick-create actions aligned with server-enforced permissions.
- Automated regression suite added with 100% test pass rate.

---

## 2. Exact Files Modified & Technical Changes

| File Path | Type | Modifications Made |
| :--- | :--- | :--- |
| `src/lib/security/permissions.ts` | **RBAC Engine** | 1. Added explicit financial actions: `invoices:read`, `invoices:manage`, `quotes:read`, `quotes:manage`, `payments:read`, `payments:manage`, `financials:read`, `analytics:read`.<br>2. Updated `CanonicalRole` union to include `'dispatcher'` as a first-class canonical role.<br>3. Updated `normalizeRole`: `'dispatcher'` now maps to `'dispatcher'` (no longer collapses into `'member'`).<br>4. Updated `ROLE_PERMISSIONS`: `owner` and `admin` retain full financial permissions; `dispatcher`, `technician`, and `member` are strictly denied all financial actions. |
| `src/app/api/client/invoices/route.ts` | **API Route** | 1. `GET`: Gated with `invoices:read`.<br>2. `POST`: Gated with `invoices:manage`.<br>3. `DELETE`: Gated with `invoices:manage`.<br>4. Added support for dependency-injected test context. |
| `src/app/api/client/invoices/[id]/pay-offline/route.ts` | **API Route** | `POST`: Changed authorization check from general appointment/member access to `payments:manage`. Blocks dispatchers and technicians from recording manual cash/check payments. |
| `src/app/api/client/invoices/[id]/send/route.ts` | **API Route** | `POST`: Gated with `invoices:manage`. Blocks dispatchers/technicians from triggering customer billing communications. |
| `src/app/api/client/invoices/[id]/void/route.ts` | **API Route** | `POST`: Gated with `invoices:manage`. Blocks unauthorized voiding or cancelling of active invoices. |
| `src/app/api/client/quotes/route.ts` | **API Route** | 1. `GET`: Gated with `quotes:read`.<br>2. `POST`: Gated with `quotes:manage`.<br>3. `DELETE`: Gated with `quotes:manage`. |
| `src/app/api/client/quotes/[id]/send/route.ts` | **API Route** | `POST`: Gated with `quotes:manage`. |
| `src/app/api/client/payments/connect/route.ts` | **API Route** | 1. `GET`: Gated with `payments:read`.<br>2. `POST`: Gated with `payments:manage`. |
| `src/app/api/client/payments/connect/dashboard/route.ts` | **API Route** | `POST`: Gated with `payments:manage`. Prevents unauthorized generation of Stripe Express Dashboard login links. |
| `src/app/api/client/dashboard/route.ts` | **API Route** | Checks `financials:read`, `invoices:read`, and `quotes:read`. When caller lacks permissions, redacts financial outcomes (`paymentCollection`, `totalBookedValue`, `acceptedValue`, `totalSentValue`, `outstandingInvoicesBalance`, `paymentsReceivedAmount`), strips financial items from `attentionQueue`, and returns permission flags. |
| `src/app/api/client/customers/[id]/route.ts` | **API Route** | Redacts `invoices`, `payments`, and `lifetimeValue` when caller lacks `invoices:read`; redacts `quotes` when caller lacks `quotes:read`. |
| `src/app/client/layout.tsx` | **Frontend Shell** | Configured `dispatcherNavSections` omitting Invoices, Quotes, and Billing. Added route-level guard redirecting unauthorized roles away from `/client/invoices`, `/client/quotes`, and `/client/billing`. |
| `src/app/client/dashboard/page.tsx` | **Frontend UI** | Evaluates `canViewFinancials`, `canViewInvoices`, and `canViewQuotes`. Pipeline Status replaces "Pending Quotes" and "Unpaid Invoices" with "Active Bookings" and "Today's Jobs" for dispatchers. Performance section replaces "Payments Collected" with "Calls Recovered". |
| `src/components/universal-quick-create.tsx` | **Frontend UI** | Filters out "Create Quote" when user lacks quote permissions. Limits technicians strictly to "Log Field Note" and "Book Follow-up". |
| `test/security-baseline.test.mjs` | **Test Suite** | Updated baseline test assertions to verify `normalizeRole('dispatcher') === 'dispatcher'` and confirmed permission boundaries. |
| `test/financial-authorization-hotfix.test.mjs` | **Test Suite** | Comprehensive 12-test regression suite covering role normalization, permission matrix, route rejections (403), dashboard redactions, and customer 360 data stripping. |
| `package.json` | **Config** | Registered `test/financial-authorization-hotfix.test.mjs` in the main test runner script. |

---

## 3. Effective Permissions by Role Matrix

The following table reflects the verified effective permission boundaries enforced across all canonical roles:

| Action / Capability | `owner` | `admin` | `dispatcher` | `technician` | `member` | `super_admin` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`invoices:read`** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **`invoices:manage`** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **`quotes:read`** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **`quotes:manage`** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **`payments:read`** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **`payments:manage`** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **`financials:read`** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **`analytics:read`** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **`org:view`** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **`org:update`** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **`org:billing`** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **`org:delete`** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **`team:view`** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **`team:invite`** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **`appointments:read`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`appointments:manage`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`leads:read`** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **`leads:manage`** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **`messages:read`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`messages:send`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`contacts:read`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`contacts:manage`** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **`crews:view`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`crews:manage`** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **`reviews:send`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 4. Server-Layer Enforcement & Defense-in-Depth

### Server-Authoritative Identity & Context
All authorization checks rely strictly on `getTenantContext(requiredAction, supabase)` in `src/lib/security/tenant-context.ts`:
- User identity is resolved via authenticated Supabase session (`supabase.auth.getUser()`).
- The user's role is queried from the `profiles` table within their verified tenant organization (`org_id`).
- Roles are strictly canonicalized via `normalizeRole`. Any unknown, missing, or malformed role fails closed to `'member'`.
- If the resolved role lacks the required action in `ROLE_PERMISSIONS`, `getTenantContext` rejects the request immediately:
  ```json
  { "error": "Forbidden: User lacks permission for 'invoices:read'" }
  ```
  with HTTP Status `403 Forbidden` **before any database query or mutation occurs**.

### Sensitive Endpoint Protection
1. **Direct API Tampering Prevention:**
   Direct curl or Postman requests to `/api/client/invoices`, `/api/client/quotes`, or `/api/client/invoices/[id]/pay-offline` using technician or dispatcher credentials receive a `403 Forbidden` response.
2. **Dashboard Executive Redaction:**
   When a user without `financials:read` calls `/api/client/dashboard`:
   - `outcomes.paymentCollection.collectedAmount = 0`
   - `outcomes.paymentCollection.invoicedAmount = 0`
   - `outcomes.bookingsFromCaptoDesk.totalBookedValue = 0`
   - `outcomes.quoteConversion.acceptedValue = 0`
   - `outcomes.quoteConversion.totalSentValue = 0`
   - `operations.outstandingInvoicesBalance = 0`
   - `operations.paymentsReceivedAmount = 0`
   - `operations.quotesAwaitingResponseValue = 0`
   - Overdue invoice and expiring quote items are stripped from `attentionQueue`.
3. **Customer 360 Sanitization:**
   When `/api/client/customers/[id]` is queried by a user lacking financial permissions, `invoices: []`, `payments: []`, `quotes: []`, and `lifetimeValue: 0` are enforced on the JSON response payload.

---

## 5. UI and UX Alignment

While UI concealment is not a security boundary, frontend elements have been aligned to prevent confusing unauthorized states:
1. **Sidebar Navigation (`src/app/client/layout.tsx`):**
   - For `dispatcher` and `member`, the sidebar sections exclude Quotes, Invoices, and Billing.
   - Route-guard checks redirect unauthorized roles attempting to access `/client/invoices`, `/client/quotes`, or `/client/billing` to `/client/dashboard`.
2. **Command Center Dashboard (`src/app/client/dashboard/page.tsx`):**
   - Non-financial roles view "Active Bookings" (linking to Calendar) and "Today's Jobs" (linking to Jobs) instead of "Pending Quotes" and "Unpaid Invoices".
   - In Section 3 Verified Performance, "Payments Collected" is replaced with operational "Calls Recovered".
3. **Universal Quick-Create (`src/components/universal-quick-create.tsx`):**
   - "Create Quote" is omitted for roles lacking quote permissions.
   - Technicians see only field-relevant actions ("Log Field Note", "Book Follow-up").

---

## 6. Verification & Test Outcomes

### 1. New Regression Test Suite
File: `test/financial-authorization-hotfix.test.mjs`
Execution Command:
```powershell
node --experimental-strip-types --test test/financial-authorization-hotfix.test.mjs
```
**Results:**
```text
TAP version 13
ok 1 - 1. RBAC: Canonical role normalization strictly preserves distinct dispatcher and technician roles
ok 2 - 2. RBAC: Role-permission matrix grants financial actions only to owner and admin
ok 3 - 3. RBAC: Operational field and scheduling boundaries are strictly preserved
ok 4 - 4. Security: getTenantContext rejects unauthorized roles with 403 before any db mutation
ok 5 - 5. Invoices API: Technician is blocked with 403 on GET, POST, DELETE, and pay-offline
ok 6 - 6. Invoices API: Dispatcher is blocked with 403 on GET, POST, DELETE, and mutation routes
ok 7 - 7. Quotes API: Technician & Dispatcher are blocked with 403 on GET, POST, DELETE, send
ok 8 - 8. Stripe Payments Connect: Non-owner/non-admin roles rejected with 403
ok 9 - 9. Dashboard API: Technician is blocked with 403 (lacks org:view)
ok 10 - 10. Dashboard API: Dispatcher receives sanitized metrics with financial totals redacted
ok 11 - 11. Dashboard API: Owner receives complete operational and financial metrics
ok 12 - 12. Customer 360 API: Redacts financial history for dispatchers & technicians
1..12
# tests 12
# suites 0
# pass 12
# fail 0
# duration_ms 755.4852
```

### 2. Baseline Security Test Suite
File: `test/security-baseline.test.mjs`
Execution Command:
```powershell
node --experimental-strip-types --test test/security-baseline.test.mjs
```
**Results:**
```text
1..12
# tests 12
# suites 0
# pass 12
# fail 0
# duration_ms 309.383
```

### 3. Static Typecheck
Execution Command:
```powershell
npm run typecheck --prefix "C:\Users\mskar\captodesk"
```
**Results:** `tsc --noEmit` exited 0 (clean).

### 4. Code Linting
Execution Command:
```powershell
npm run lint --prefix "C:\Users\mskar\captodesk"
```
**Results:** 0 errors (917 existing non-blocking warnings).

### 5. Production Compilation
Execution Command:
```powershell
npm run build --prefix "C:\Users\mskar\captodesk"
```
**Results:** `next build` compiled all 64 app routes successfully with static and dynamic code generation verified.

---

## 7. Limitations & Scope Boundaries

1. **Database Schema & RLS:**
   As stipulated by the phase requirements, zero PostgreSQL migrations or Supabase RLS changes were introduced. Authorization enforcement is currently handled server-authoritatively at the Next.js API route layer.
2. **Owner Custom Permission Editor:**
   This hotfix implements the canonical role model (`owner`, `admin`, `dispatcher`, `technician`, `member`). It does not introduce dynamic custom permission toggles per user in the frontend settings UI (deferred to future roadmap phases).
3. **Deployment:**
   No code has been deployed to production environments. Verification was conducted using in-memory and embedded fixtures.
