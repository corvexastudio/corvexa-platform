-- ==============================================================================
-- MIGRATION 29: BUSINESS CARRIER & 10DLC VERIFICATION PROFILE
-- ==============================================================================

-- 1. ADD 10DLC BRAND & COMPLIANCE FIELDS TO ORGANIZATIONS
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS legal_business_name TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'llc';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS ein TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS is_sole_proprietor BOOLEAN DEFAULT false;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address_street TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address_city TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address_state TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address_postal_code TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS carrier_registration_status TEXT DEFAULT 'pending';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS tcr_brand_id TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS tcr_campaign_id TEXT;

-- 2. ADD CHECK CONSTRAINTS IF NOT ALREADY ENFORCED
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_organizations_business_type'
    ) THEN
        ALTER TABLE public.organizations 
        ADD CONSTRAINT check_organizations_business_type 
        CHECK (business_type IN ('llc', 'corporation', 'partnership', 'sole_proprietorship', 'non_profit', 'other'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_organizations_carrier_status'
    ) THEN
        ALTER TABLE public.organizations 
        ADD CONSTRAINT check_organizations_carrier_status 
        CHECK (carrier_registration_status IN ('unregistered', 'pending', 'in_review', 'verified', 'rejected'));
    END IF;
END $$;

-- 3. INDEX FOR FAST CARRIER STATUS AUDITS
CREATE INDEX IF NOT EXISTS idx_organizations_carrier_status 
ON public.organizations(carrier_registration_status);
