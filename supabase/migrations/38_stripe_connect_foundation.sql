-- ==============================================================================
-- PHASE 1: STRIPE CONNECT & 1% APPLICATION FEE PLATFORM MARGIN
-- Adds Stripe Connect account metadata to organizations table with indexes.
-- ==============================================================================

-- 1. Extend organizations with Stripe Connect Account attributes
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_account_status TEXT DEFAULT 'not_connected',
ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_onboarded_at TIMESTAMPTZ;

-- 2. Performance & Idempotency Index
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_account ON organizations(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_status ON organizations(stripe_account_status);
