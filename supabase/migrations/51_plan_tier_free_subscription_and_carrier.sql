-- ==============================================================================
-- CAPTODESK MIGRATION 51: PLAN TIER FOUNDATION, FREE TIER STATUS & MOBILE CARRIER
-- Adds native plan_id, primary_carrier, and expands subscription_status to allow
-- 'free' tier operations without constraint violations.
-- ==============================================================================

-- 1. Add plan_id column to organizations (defaults to 'free')
ALTER TABLE public.organizations 
    ADD COLUMN IF NOT EXISTS plan_id TEXT DEFAULT 'free';

-- 2. Add primary_carrier column to organizations (defaults to 'other')
ALTER TABLE public.organizations 
    ADD COLUMN IF NOT EXISTS primary_carrier TEXT DEFAULT 'other';

-- 3. Update organizations_subscription_status_check constraint to permit 'free'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'organizations_subscription_status_check'
    ) THEN
        ALTER TABLE public.organizations DROP CONSTRAINT organizations_subscription_status_check;
    END IF;
END $$;

ALTER TABLE public.organizations 
    ADD CONSTRAINT organizations_subscription_status_check 
    CHECK (subscription_status IN ('free', 'trial', 'active', 'past_due', 'canceled'));

-- 4. Backfill existing organizations with plan_id if null
UPDATE public.organizations 
SET plan_id = CASE 
    WHEN subscription_status = 'active' THEN 'solo'
    ELSE 'free'
END
WHERE plan_id IS NULL;

-- 5. Index for performant plan_id lookups
CREATE INDEX IF NOT EXISTS idx_organizations_plan_id 
    ON public.organizations(plan_id);

-- 6. Add status column to contacts table for backward compatibility if referenced
ALTER TABLE public.contacts 
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'customer';
