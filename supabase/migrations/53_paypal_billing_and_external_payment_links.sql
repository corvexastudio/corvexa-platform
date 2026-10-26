-- ==============================================================================
-- CAPTODESK MIGRATION 53: PAYPAL SAAS BILLING & EXTERNAL PAYMENT LINKS
-- Adds PayPal subscription metadata, external invoice payment URLs & instructions,
-- and dynamic setup fee waiver flags.
-- ==============================================================================

-- 1. Organizations: PayPal subscription identifiers & contractor payment links
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS billing_provider TEXT DEFAULT 'paypal',
    ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS paypal_plan_id TEXT,
    ADD COLUMN IF NOT EXISTS paypal_payer_id TEXT,
    ADD COLUMN IF NOT EXISTS external_payment_url TEXT,
    ADD COLUMN IF NOT EXISTS payment_instructions TEXT,
    ADD COLUMN IF NOT EXISTS waive_setup_fee BOOLEAN DEFAULT true;

-- 2. SaaS Subscriptions: PayPal subscription synchronization
ALTER TABLE public.saas_subscriptions
    ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS paypal_plan_id TEXT,
    ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'paypal';

-- 3. High-performance lookup indexes
CREATE INDEX IF NOT EXISTS idx_organizations_paypal_sub
    ON public.organizations(paypal_subscription_id);

CREATE INDEX IF NOT EXISTS idx_saas_subs_paypal
    ON public.saas_subscriptions(paypal_subscription_id);

CREATE INDEX IF NOT EXISTS idx_organizations_billing_provider
    ON public.organizations(billing_provider);
