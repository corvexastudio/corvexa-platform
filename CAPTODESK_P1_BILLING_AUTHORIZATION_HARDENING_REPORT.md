# CAPTODESK — P1 BILLING AUTHORIZATION & ENTITLEMENT HARDENING REPORT

### 1. STATUS
**PASS**  
SaaS billing state is now strictly server-authoritative. Normal tenant owners, tenant admins, members, and unauthenticated callers are technically incapable of modifying subscription status, altering monthly rates, extending billing periods, recording fake SaaS payments, or granting themselves paid entitlement. All SaaS billing mutations are strictly restricted to authenticated Super Admins (`admin:all`).

---

### 2. Billing Mutation Map

| File / Route | Caller Access Level | Allowed Mutations | Security Enforcement |
| :--- | :--- | :--- | :--- |
| `POST /api/admin/organizations/[id]/subscription/activate` | Super Admin Only | Initial activation, plan assignment, period calculation, payment record | `getTenantContext('admin:all')` + body parameter tampering guard |
| `POST /api/admin/organizations/[id]/subscription/renew` | Super Admin Only | Period extension, renewal payment logging | `getTenantContext('admin:all')` + server-calculated period end |
| `POST /api/admin/organizations/[id]/subscription/cancel` | Super Admin Only | Immediate cancellation or cancel at period end | `getTenantContext('admin:all')` + audit logger |
| `POST /api/admin/organizations/[id]/subscription/reactivate` | Super Admin Only | Clear scheduled cancellation | `getTenantContext('admin:all')` + state machine validation |
| `POST /api/admin/organizations/[id]/subscription/payments` | Super Admin Only | Record manual PayPal payment receipts | `getTenantContext('admin:all')` + date/amount validation |
| `POST /api/admin/organizations/toggle-status` | **Super Admin Only** *(Hardened)* | Toggle `subscription_status` (`active`, `past_due`, `canceled`, etc.) | **Changed from tenant owner to `getTenantContext('admin:all')`**; syncs `saas_subscriptions` |
| `PATCH /api/client/organization` | Tenant Owner / Admin | Operational settings only (name, phone, business hours, templates) | **Strictly rejects billing & identity keys (`subscription_status`, `monthly_rate`, `org_id`, etc.) with 400** |
| `POST /api/onboarding` | Authenticated Signup | Organization creation | Ignores any billing/pricing parameters from client; sets default trial state |
| `Direct PostgREST Update` | Tenant Owner / Admin | None for billing columns | **PostgreSQL trigger `trg_protect_organization_billing_fields` blocks updates with 42501** |
| `Direct PostgREST Insert/Update on saas_subscriptions` | Tenant Owner / Admin | None | RLS restricts INSERT/UPDATE/DELETE to `public.auth_is_super_admin()` |
| `Direct PostgREST Insert/Update on saas_payments` | Tenant Owner / Admin | None | RLS restricts INSERT/UPDATE/DELETE to `public.auth_is_super_admin()` |

---

### 3. Tenant Billing Restrictions
- **Organization Settings Route (`PATCH /api/client/organization`):**
  - Added strict parameter rejection for:
    `subscription_status`, `monthly_rate`, `org_id`, `orgId`, `id`, `role`, `provider`, `provider_customer_id`, `provider_subscription_id`, `stripe_customer_id`, `stripe_subscription_id`, `billing_period`, `billing_period_start`, `billing_period_end`, `payment_status`, `telnyx_phone_number`, `telnyx_order_id`, `phone_provisioning_status`, `carrier_registration_status`, `tcr_brand_id`, `tcr_campaign_id`, `requestedNumber`, `telnyxPhoneNumber`.
  - Any request containing one or more of these prohibited fields is immediately rejected with `400 Bad Request` and audited as a privilege escalation attempt.
- **Admin Status Toggle Route (`POST /api/admin/organizations/toggle-status`):**
  - Removed previous flaw where tenant owners (`role === 'owner' && userOrgId === org_id`) were permitted to toggle their own subscription status.
  - Upgraded authorization gate to `getTenantContext('admin:all')`. Non-superadmin callers receive `403 Forbidden`.
  - Synchronizes status transitions with `saas_subscriptions` table.

---

### 4. Database & RLS Protection
Created Migration 36 ([`supabase/migrations/36_saas_billing_authorization_hardening.sql`](file:///c:/Users/mskar/captodesk/supabase/migrations/36_saas_billing_authorization_hardening.sql)):
- Attached `BEFORE UPDATE` trigger `trg_protect_organization_billing_fields` executing `public.protect_organization_billing_fields()`.
- Detects whether execution context is `service_role`, `postgres`, `supabase_admin`, or `public.auth_is_super_admin()`.
- If an unprivileged tenant owner or admin attempts direct SQL or PostgREST update where `NEW.subscription_status IS DISTINCT FROM OLD.subscription_status` or `NEW.monthly_rate IS DISTINCT FROM OLD.monthly_rate`, PostgreSQL raises exception `42501` (`insufficient_privilege`).
- Preserves existing RLS policies on `saas_subscriptions` and `saas_payments` from Migration 34: tenants can only SELECT their own records; INSERT/UPDATE/DELETE requires `public.auth_is_super_admin()`.

---

### 5. Server-Authoritative Billing Flow
All subscription lifecycle operations pass through [`SubscriptionService`](file:///c:/Users/mskar/captodesk/src/lib/billing/subscription-service.ts):
- **Activation:** Validates target organization, calculates deterministic period end from server time, creates or updates `saas_subscriptions`, logs `saas_payments` record, and updates `organizations.subscription_status` to `'active'`.
- **Renewal:** Extends existing billing period from previous period end, records renewal receipt, and validates positive amount.
- **Cancellation:** Supports immediate cancellation (status transitions to `'canceled'` on both `saas_subscriptions` and `organizations`) or cancellation at period end (`cancel_at_period_end: true`).
- **Reactivation:** Restores scheduled-cancellation subscriptions prior to period expiry.
- **Audit Logging:** Every state change emits structured audit events (`billing.subscription_activated`, `billing.subscription_renewed`, `billing.subscription_canceled`, `billing.payment_recorded`).

---

### 6. Entitlement Enforcement
- Implemented `SubscriptionService.hasActiveSaaSEntitlement(supabase, orgId)` and exported top-level helper `hasActiveSaaSEntitlement(supabase, orgId)` in [`src/lib/billing/subscription-service.ts`](file:///c:/Users/mskar/captodesk/src/lib/billing/subscription-service.ts).
- Evaluates server-side subscription data:
  - If `saas_subscriptions` exists: checks `status === 'active'` with `current_period_end >= now`, or `status === 'canceled'` with `cancel_at_period_end === true` and `current_period_end >= now`.
  - Fallback to `organizations.subscription_status`: permits `'trial'` and `'active'`.
  - Fails closed for `'pending'`, `'past_due'`, `'expired'`, `'canceled'`, `'suspended'`, `'churned'`, or missing/invalid organizations.
- Gated paid operational capabilities:
  - [`src/app/api/client/retention/route.ts`](file:///c:/Users/mskar/captodesk/src/app/api/client/retention/route.ts): Gated `POST` (campaign execution) and `PUT` (campaign settings) behind `hasActiveSaaSEntitlement`. Unentitled organizations receive `402 Payment Required`.
  - Basic account access, tenant view, and dashboard navigation remain unblocked.

---

### 7. Payment-Record Protection
- Tenant users cannot insert fake SaaS payment rows: PostgREST RLS blocks direct `INSERT` with `42501`.
- Tenant users cannot update existing SaaS payment rows: PostgREST RLS blocks direct `UPDATE` with `42501`.
- Homeowner/customer invoice payments (`payments` table) remain completely isolated from SaaS subscriptions (`saas_payments` table). Customer invoice payments proceed normally.

---

### 8. Privilege-Escalation Tests
Dedicated test suite [`test/p1-billing-authorization-hardening.test.mjs`](file:///c:/Users/mskar/captodesk/test/p1-billing-authorization-hardening.test.mjs) covers 20 comprehensive scenarios:
1. Tenant owner modifying `subscription_status` -> **Rejected (400)**
2. Tenant owner modifying `monthly_rate` -> **Rejected (400)**
3. Tenant owner modifying `provider` -> **Rejected (400)**
4. Tenant owner modifying `billing_period` -> **Rejected (400)**
5. Tenant owner modifying `payment_status` -> **Rejected (400)**
6. Tenant user directly inserting `saas_payments` -> **Rejected by RLS (42501)**
7. Tenant user directly updating `saas_payments` -> **Rejected by RLS (42501)**
8. Tenant owner attempting `toggle-status` on own org -> **Rejected (403)**
9. Tenant owner attempting `toggle-status` on another org -> **Rejected (403)**
10. Client-supplied `org_id` tampering in organization PATCH -> **Rejected (400)**
11. Super Admin activating subscription -> **Authorized (200)**
12. Super Admin renewing subscription -> **Authorized (200)**
13. Super Admin canceling subscription -> **Authorized (200)**
14. Super Admin reactivating subscription -> **Authorized (200)**
15. Super Admin recording manual PayPal payment -> **Authorized (201)**
16. Active subscription permits retention campaign execution -> **Allowed (200)**
17. Canceled/expired subscription rejects retention campaign execution -> **Blocked (402)**
18. Missing or invalid subscription state fails closed -> **Returns false (402)**
19. Homeowner invoice payments table remains completely isolated -> **Verified**
20. Complex multi-field privilege escalation attempts -> **Rejected across all vectors**

---

### 9. Full Regression Results
- **Unit & System Test Suite (`npm test`):**
  - Total tests: **565**
  - Passed: **565**
  - Failed: **0**
  - Skipped: **0**
  - Focused new tests: **20**
- **Integration Test Suite (`npm run test:integration`):**
  - Total tests: **24**
  - Passed: **24**
  - Failed: **0**
- **TypeScript (`npm run typecheck`):** **PASS** (0 errors).
- **ESLint (`npm run lint`):** **PASS** (0 errors, 1512 baseline warnings).
- **Production Build (`npm run build`):** **PASS** (57 static & dynamic routes compiled cleanly).

---

### 10. Files Changed
1. `src/app/api/admin/organizations/toggle-status/route.ts`: Restricted strictly to Super Admin (`admin:all`); removed owner role bypass; synchronized status with `saas_subscriptions`.
2. `src/app/api/client/organization/route.ts`: Enforced strict rejection of billing and identity tampering keys; added route context for tests.
3. `src/app/api/client/retention/route.ts`: Enforced `hasActiveSaaSEntitlement` on customer retention operations (`POST` and `PUT`).
4. `src/lib/billing/subscription-service.ts`: Added `SubscriptionService.hasActiveSaaSEntitlement` and exported `hasActiveSaaSEntitlement`.
5. `supabase/migrations/36_saas_billing_authorization_hardening.sql`: Added PostgreSQL trigger `trg_protect_organization_billing_fields` blocking tenant direct updates to `subscription_status` and `monthly_rate`.
6. `test/p1-billing-authorization-hardening.test.mjs`: Added 20-test authorization and entitlement verification suite.
7. `package.json`: Added test suite to `npm test`.

---

### 11. Any Remaining Limitations
- **Manual PayPal SaaS Billing Kept Intact:** As required by constraints, SaaS subscription payments remain driven by Super Admin recording verified PayPal transactions rather than automated webhooks.
- **Homeowner Payments Untouched:** Homeowner invoice payments and checkout routes operate independently on homeowner payment tables (`invoices`, `payments`).
