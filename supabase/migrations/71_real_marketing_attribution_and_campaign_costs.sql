-- ==============================================================================
-- CAPTODESK MIGRATION 71: REAL MARKETING ATTRIBUTION AND CAMPAIGN COSTS
-- Remediates F-AGY-03:
-- 1. Eliminates synthetic 160% campaign revenue allocations and fake campaign names.
-- 2. Creates genuine marketing attribution ledger (public.marketing_attributions).
-- 3. Adds deterministic first-touch UTM columns to appointments, leads, jobs, invoices.
-- 4. Creates agency campaign costs ledger (public.agency_campaign_costs) for true ROAS/ROI.
-- 5. Enables Row Level Security on all attribution tables.
-- ==============================================================================

-- 1. Create marketing_attributions table
CREATE TABLE IF NOT EXISTS public.marketing_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  utm_source TEXT NOT NULL,
  utm_medium TEXT,
  utm_campaign TEXT NOT NULL,
  utm_content TEXT,
  utm_term TEXT,
  landing_page TEXT,
  referrer TEXT,
  first_touch_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes for marketing_attributions
CREATE INDEX IF NOT EXISTS idx_marketing_attributions_org_id
ON public.marketing_attributions(org_id);

CREATE INDEX IF NOT EXISTS idx_marketing_attributions_campaign
ON public.marketing_attributions(org_id, utm_source, utm_campaign);

CREATE INDEX IF NOT EXISTS idx_marketing_attributions_appointment
ON public.marketing_attributions(appointment_id);

CREATE INDEX IF NOT EXISTS idx_marketing_attributions_lead
ON public.marketing_attributions(lead_id);

-- 2. Add attribution columns to appointments
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_content TEXT,
ADD COLUMN IF NOT EXISTS utm_term TEXT,
ADD COLUMN IF NOT EXISTS landing_page TEXT,
ADD COLUMN IF NOT EXISTS referrer TEXT,
ADD COLUMN IF NOT EXISTS attribution_id UUID REFERENCES public.marketing_attributions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_utm_campaign
ON public.appointments(org_id, utm_source, utm_campaign);

-- 3. Add attribution columns to leads
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_content TEXT,
ADD COLUMN IF NOT EXISTS utm_term TEXT,
ADD COLUMN IF NOT EXISTS attribution_id UUID REFERENCES public.marketing_attributions(id) ON DELETE SET NULL;

-- 4. Add attribution columns to jobs
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS attribution_id UUID REFERENCES public.marketing_attributions(id) ON DELETE SET NULL;

-- 5. Add attribution reference to invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS attribution_id UUID REFERENCES public.marketing_attributions(id) ON DELETE SET NULL;

-- 6. Create agency_campaign_costs table for actual ad spend and retainers
CREATE TABLE IF NOT EXISTS public.agency_campaign_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.partner_agencies(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_name TEXT NOT NULL,
  utm_source TEXT,
  reporting_period TEXT NOT NULL,
  cost_amount NUMERIC(12, 2) NOT NULL CHECK (cost_amount >= 0),
  cost_category TEXT NOT NULL CHECK (cost_category IN ('ad_spend', 'agency_retainer', 'other_marketing')),
  currency TEXT NOT NULL DEFAULT 'USD',
  entry_source TEXT NOT NULL DEFAULT 'manual',
  cost_date DATE NOT NULL DEFAULT CURRENT_DATE,
  acting_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_campaign_costs_agency_org
ON public.agency_campaign_costs(agency_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_agency_campaign_costs_campaign
ON public.agency_campaign_costs(campaign_name, reporting_period);

-- 7. Row Level Security for marketing_attributions
ALTER TABLE public.marketing_attributions ENABLE ROW LEVEL SECURITY;

-- Public insert allowed for public booking submissions
DROP POLICY IF EXISTS "Public can record marketing attribution" ON public.marketing_attributions;
CREATE POLICY "Public can record marketing attribution"
ON public.marketing_attributions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Authenticated read: tenant organization members, agency owners, or super admins
DROP POLICY IF EXISTS "Authorized users can view marketing attribution" ON public.marketing_attributions;
CREATE POLICY "Authorized users can view marketing attribution"
ON public.marketing_attributions FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT id FROM public.organizations WHERE partner_agency_id IN (
      SELECT id FROM public.partner_agencies WHERE primary_owner_id = auth.uid()
    )
  )
  OR org_id IN (
    SELECT org_id FROM public.profiles WHERE id = auth.uid()
  )
  OR public.auth_is_super_admin()
);

-- 8. Row Level Security for agency_campaign_costs
ALTER TABLE public.agency_campaign_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency owners can view own campaign costs" ON public.agency_campaign_costs;
CREATE POLICY "Agency owners can view own campaign costs"
ON public.agency_campaign_costs FOR SELECT
TO authenticated
USING (
  agency_id IN (
    SELECT id FROM public.partner_agencies WHERE primary_owner_id = auth.uid()
  )
  OR public.auth_is_super_admin()
);

DROP POLICY IF EXISTS "Agency owners can insert campaign costs" ON public.agency_campaign_costs;
CREATE POLICY "Agency owners can insert campaign costs"
ON public.agency_campaign_costs FOR INSERT
TO authenticated
WITH CHECK (
  agency_id IN (
    SELECT id FROM public.partner_agencies WHERE primary_owner_id = auth.uid()
  )
  OR public.auth_is_super_admin()
);

DROP POLICY IF EXISTS "Agency owners can update campaign costs" ON public.agency_campaign_costs;
CREATE POLICY "Agency owners can update campaign costs"
ON public.agency_campaign_costs FOR UPDATE
TO authenticated
USING (
  agency_id IN (
    SELECT id FROM public.partner_agencies WHERE primary_owner_id = auth.uid()
  )
  OR public.auth_is_super_admin()
)
WITH CHECK (
  agency_id IN (
    SELECT id FROM public.partner_agencies WHERE primary_owner_id = auth.uid()
  )
  OR public.auth_is_super_admin()
);

DROP POLICY IF EXISTS "Agency owners can delete campaign costs" ON public.agency_campaign_costs;
CREATE POLICY "Agency owners can delete campaign costs"
ON public.agency_campaign_costs FOR DELETE
TO authenticated
USING (
  agency_id IN (
    SELECT id FROM public.partner_agencies WHERE primary_owner_id = auth.uid()
  )
  OR public.auth_is_super_admin()
);

COMMENT ON TABLE public.marketing_attributions IS 'First-touch marketing attribution linking booking sessions to appointments, jobs, and invoices';
COMMENT ON TABLE public.agency_campaign_costs IS 'Recorded advertising spend and agency retainers for accurate ROAS and ROI calculations';
