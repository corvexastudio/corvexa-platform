# CaptoDesk SaaS Billing Foundation & Manual Operations Architecture

## 1. Overview & Business Model

CaptoDesk is a multi-tenant SaaS platform built for US home service businesses (HVAC, plumbing, electrical, roofing, landscaping).
CaptoDesk operates from India with an active and verified PayPal Business account under **S M CREATIONS**.

### Key Separation of Concerns
1. **SaaS Platform Subscriptions (`saas_subscriptions` & `saas_payments`)**:
   - Organization/tenant subscriptions to use the CaptoDesk platform ($99.00 USD/month).
   - In initial production, billed manually via PayPal Business (PayPal invoices, PayPal checkout links, or direct bank transfer).
   - Super Admin verifies external payment and logs/activates subscription with complete audit trail.
   - Provider-independent architecture allowing instant plug-in of automated payment providers (PayPal Subscriptions API, Stripe Billing, Dodo Payments, etc.) without schema refactoring.

2. **Tenant Client / Homeowner Invoices (`invoices` & `payments`)**:
   - Payments from homeowners to contractors for physical jobs (e.g., $189 AC tune-up).
   - Uses contractor-configured Stripe Connect or manual job invoice payments.
   - **Completely isolated** from CaptoDesk SaaS subscriptions. No cross-contamination of schemas, webhooks, or ledger entries.

---

## 2. Database Architecture (Migration 34)

### `public.saas_subscriptions`
Tracks canonical SaaS subscription lifecycles per organization:
- `id` (UUID PK)
- `org_id` (UUID FK to `organizations.id`, UNIQUE constraint `uq_saas_subscriptions_org_id` — strictly one subscription per tenant)
- `plan_id` (TEXT, e.g. `'captodesk_standard'`)
- `status` (`'pending' | 'active' | 'past_due' | 'canceled' | 'expired'`)
- `billing_interval` (`'month' | 'year'`)
- `amount` (NUMERIC(10,2), server-authoritative, e.g. `99.00`)
- `currency` (TEXT, default `'USD'`)
- `current_period_start` (TIMESTAMPTZ)
- `current_period_end` (TIMESTAMPTZ)
- `cancel_at_period_end` (BOOLEAN, default `false`)
- `canceled_at` (TIMESTAMPTZ, NULLable)
- `provider` (TEXT, default `'manual'`)
- `provider_subscription_reference` (TEXT NULLable)
- `metadata` (JSONB)
- `created_at` / `updated_at` (TIMESTAMPTZ)

### `public.saas_payments`
Immutable ledger of verified SaaS subscription payments:
- `id` (UUID PK)
- `org_id` (UUID FK to `organizations.id`)
- `subscription_id` (UUID FK to `saas_subscriptions.id`)
- `amount` (NUMERIC(10,2) > 0)
- `currency` (TEXT, default `'USD'`)
- `payment_date` (TIMESTAMPTZ)
- `billing_period_start` (TIMESTAMPTZ)
- `billing_period_end` (TIMESTAMPTZ)
- `provider` (TEXT, default `'paypal_manual'`)
- `provider_payment_reference` (TEXT, e.g. PayPal Transaction ID `PAYID-M5XYZ...`)
- `payment_status` (`'completed' | 'refunded' | 'pending' | 'failed'`)
- `notes` (TEXT)
- `created_by` (UUID FK to `profiles.id`, administrator who verified payment)
- `created_at` (TIMESTAMPTZ)
- **Constraints**:
  - `uq_saas_payments_period`: UNIQUE `(subscription_id, billing_period_start, billing_period_end)` prevents duplicate payment recordings for the exact same billing window.
  - `chk_saas_payments_period`: CHECK `(billing_period_end > billing_period_start)`.

### Row-Level Security (RLS)
- `saas_subscriptions` & `saas_payments`:
  - **Tenants / Members**: Can `SELECT` their own organization records (`org_id = current_org_id()`).
  - **Super Admins**: Full `ALL` permissions (view, insert, update).
  - **Anonymous**: Zero access (`DENY ALL`).

---

## 3. Standard SaaS Plan Configuration

Defined in `src/lib/billing/plans.ts`:
- **ID**: `captodesk_standard`
- **Name**: CaptoDesk Standard
- **Rate**: $99.00 USD / month
- **Billing Interval**: `month`
- **Entitled Features**:
  1. Dedicated Telnyx business phone number (DID)
  2. Instant AI missed-call recovery text-back
  3. Public booking page & customizable service catalog
  4. Automated appointment confirmations & SMS reminders
  5. Lead management & customer intelligence
  6. Quotes, invoicing, and review automation

---

## 4. Super Admin Manual Operations Workflow

When an onboarding customer agrees to pay:
1. Operator generates a PayPal payment request or sends a PayPal invoice ($99 USD) from **S M CREATIONS** PayPal Business account to the customer.
2. Customer pays via PayPal.
3. Operator logs into CaptoDesk Admin (`/admin/organizations`).
4. In the Tenant table, clicks the **"Billing"** button on the target organization row.
5. In the Billing Modal:
   - Enters PayPal Transaction ID (e.g. `PAYID-M5XYZ123456789`).
   - Selects billing duration (1 month, 3 months, etc.).
   - Adds optional internal reference note (e.g. "Paid via PayPal invoice #1001").
   - Clicks **"Activate Subscription ($99 USD)"**.
6. The system automatically:
   - Sets `saas_subscriptions` to `status='active'`.
   - Computes exact `current_period_start` and `current_period_end`.
   - Records verified payment in `saas_payments`.
   - Synchronizes `organizations.subscription_status` to `'active'`.
   - Emits structured security audit log `billing.subscription_activated`.
7. For recurring monthly renewals:
   - Customer pays renewal invoice.
   - Operator opens Billing Modal, enters PayPal Transaction ID, and clicks **"Record Payment & Extend"**.
   - Period cleanly advances without gaps.

---

## 5. Security & Tamper Protection

1. **Authorization**:
   - All subscription modification endpoints require Super Admin authorization (`admin:all` permission checked via session profile + email allowlist).
   - Tenant members and unauthenticated callers receive immediate 401 / 403.
2. **Server-Authoritative Pricing**:
   - Clients cannot specify `amount`, `price`, `currency`, or force `status`.
   - Any attempt to pass client-controlled price or non-USD currency returns `400 Bad Request`.
3. **Cross-Tenant Lockdown**:
   - `org_id` is bound to URL route parameters. Passing mismatched `org_id` in request body returns `400 Bad Request`.
4. **Audit Logging**:
   - Every activation, renewal, cancellation, and payment is logged to `activity_logs` with actor ID, email, timestamp, and redacted payload.

---

## 6. Future Automated Gateway Expansion

The `BillingProvider` interface (`src/lib/billing/provider.ts`) defines the boundary:
```typescript
export interface BillingProvider {
  readonly providerId: string
  readonly name: string
  createSubscription(input: ...): Promise<...>
  cancelSubscription(input: ...): Promise<...>
  recordPayment(input: ...): Promise<...>
}
```
To connect PayPal automated subscriptions, Stripe Billing, or Dodo Payments in the future:
1. Implement `BillingProvider` (e.g. `PaypalAutomatedProvider`).
2. Add webhook handler to receive webhook notifications.
3. Call `SubscriptionService.renewSubscription` or `SubscriptionService.cancelSubscription`.
Zero database changes or client entitlement refactoring required.
