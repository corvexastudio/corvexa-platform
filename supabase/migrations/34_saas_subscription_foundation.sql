-- ==============================================================================
-- CAPTODESK MIGRATION 34: SAAS SUBSCRIPTION FOUNDATION & MANUAL BILLING
-- Provider-independent subscription data model, manual payment records,
-- and strict tenant-isolated access control for CaptoDesk SaaS subscriptions.
-- ==============================================================================

-- 1. SaaS Subscriptions Table
CREATE TABLE IF NOT EXISTS public.saas_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL DEFAULT 'captodesk_standard',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'past_due', 'canceled', 'expired')),
    billing_interval TEXT NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month', 'year')),
    amount NUMERIC(10,2) NOT NULL DEFAULT 99.00 CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    canceled_at TIMESTAMPTZ,
    provider TEXT NOT NULL DEFAULT 'manual',
    provider_customer_id TEXT NULL,
    provider_subscription_id TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_saas_subscriptions_org UNIQUE (org_id)
);

-- Index for fast tenant subscription lookups and status filtering
CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_org_status 
    ON public.saas_subscriptions(org_id, status);

-- 2. SaaS Payments Table (Dedicated for SaaS subscriptions, completely isolated from homeowner payments)
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
    payment_status TEXT NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('completed', 'refunded', 'pending', 'failed')),
    notes TEXT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_saas_payments_period UNIQUE (subscription_id, billing_period_start, billing_period_end),
    CONSTRAINT chk_saas_payments_period CHECK (billing_period_end > billing_period_start)
);

-- Indexes for fast payment history inspection
CREATE INDEX IF NOT EXISTS idx_saas_payments_sub 
    ON public.saas_payments(subscription_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_saas_payments_org 
    ON public.saas_payments(org_id, payment_date DESC);

-- 3. Row-Level Security (RLS) Lockdown
ALTER TABLE public.saas_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_payments ENABLE ROW LEVEL SECURITY;

-- Revoke direct anonymous access
REVOKE ALL ON public.saas_subscriptions FROM anon;
REVOKE ALL ON public.saas_payments FROM anon;

-- Drop any previous policies
DROP POLICY IF EXISTS "Tenant members can view own subscription" ON public.saas_subscriptions;
DROP POLICY IF EXISTS "Super admins can manage all subscriptions" ON public.saas_subscriptions;
DROP POLICY IF EXISTS "Tenant members can view own payments" ON public.saas_payments;
DROP POLICY IF EXISTS "Super admins can manage all payments" ON public.saas_payments;

-- Subscriptions: Authenticated tenant users can view their own tenant subscription
CREATE POLICY "Tenant members can view own subscription"
ON public.saas_subscriptions FOR SELECT
TO authenticated
USING (
    org_id = public.auth_user_org_id() 
    OR public.auth_is_super_admin()
);

-- Subscriptions: Only super administrators can mutate subscriptions
CREATE POLICY "Super admins can manage all subscriptions"
ON public.saas_subscriptions FOR ALL
TO authenticated
USING (public.auth_is_super_admin())
WITH CHECK (public.auth_is_super_admin());

-- Payments: Authenticated tenant users can view their own SaaS payment receipts
CREATE POLICY "Tenant members can view own payments"
ON public.saas_payments FOR SELECT
TO authenticated
USING (
    org_id = public.auth_user_org_id() 
    OR public.auth_is_super_admin()
);

-- Payments: Only super administrators can record/mutate SaaS payments
CREATE POLICY "Super admins can manage all payments"
ON public.saas_payments FOR ALL
TO authenticated
USING (public.auth_is_super_admin())
WITH CHECK (public.auth_is_super_admin());
