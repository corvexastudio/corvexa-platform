-- ==============================================================================
-- CAPTODESK MIGRATION 43: PHASE 2 FIELD OPS, DEPOSITS & REFERRAL ENGINE
-- Adds technician & ETA fields to jobs, upfront deposit columns to quotes,
-- and creates the referral_links table with Row Level Security.
-- ==============================================================================

-- 1. Extend jobs table with technician name and ETA minutes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs'
  ) THEN
    ALTER TABLE public.jobs 
      ADD COLUMN IF NOT EXISTS technician_name TEXT,
      ADD COLUMN IF NOT EXISTS eta_minutes INT;
  END IF;
END $$;

-- 2. Extend quotes table with upfront deposit configuration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quotes'
  ) THEN
    ALTER TABLE public.quotes 
      ADD COLUMN IF NOT EXISTS requires_deposit BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS deposit_type TEXT CHECK (deposit_type IN ('percentage', 'fixed')),
      ADD COLUMN IF NOT EXISTS deposit_value NUMERIC(10,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS deposit_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Create referral_links table for neighbor word-of-mouth growth
CREATE TABLE IF NOT EXISTS public.referral_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  referral_code TEXT UNIQUE NOT NULL,
  reward_amount NUMERIC(10,2) NOT NULL DEFAULT 25.00,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 25.00,
  clicks_count INT NOT NULL DEFAULT 0,
  conversions_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for referral links
CREATE INDEX IF NOT EXISTS idx_referral_links_code ON public.referral_links(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_links_org ON public.referral_links(org_id);
CREATE INDEX IF NOT EXISTS idx_referral_links_contact ON public.referral_links(contact_id);

-- 4. Extend leads and contacts with referral attribution
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads'
  ) THEN
    ALTER TABLE public.leads 
      ADD COLUMN IF NOT EXISTS referring_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS referral_code TEXT;
  END IF;
END $$;

-- 5. Row Level Security Policies for referral_links
ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Referral tenant isolation select" ON public.referral_links;
CREATE POLICY "Referral tenant isolation select" ON public.referral_links 
  FOR SELECT TO authenticated
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Referral public read for redirect" ON public.referral_links;
CREATE POLICY "Referral public read for redirect" ON public.referral_links 
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Referral tenant isolation update" ON public.referral_links;
CREATE POLICY "Referral tenant isolation update" ON public.referral_links 
  FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Referral service role full access" ON public.referral_links;
CREATE POLICY "Referral service role full access" ON public.referral_links 
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
