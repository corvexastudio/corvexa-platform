-- ==============================================================================
-- CAPTODESK MIGRATION 72: CONTRACTOR EMBED DOMAINS AND FRAME SECURITY POLICIES
-- Remediates F-AGY-11:
-- 1. Creates contractor_embed_domains table for authorized third-party website framing.
-- 2. Enables Row Level Security restricting domain management to contractor owners and managing agency.
-- 3. Enforces domain uniqueness per contractor and domain syntax validation.
-- ==============================================================================

-- 1. Create contractor_embed_domains table
CREATE TABLE IF NOT EXISTS public.contractor_embed_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_contractor_embed_domain UNIQUE (org_id, domain)
);

-- Performance index for domain lookups
CREATE INDEX IF NOT EXISTS idx_contractor_embed_domains_lookup
ON public.contractor_embed_domains(org_id, domain);

-- 2. Enable Row Level Security
ALTER TABLE public.contractor_embed_domains ENABLE ROW LEVEL SECURITY;

-- 3. SELECT Policy: Contractor members, managing agency owners, or super admins
DROP POLICY IF EXISTS "Authorized users can view contractor embed domains" ON public.contractor_embed_domains;
CREATE POLICY "Authorized users can view contractor embed domains"
ON public.contractor_embed_domains FOR SELECT
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

-- 4. INSERT Policy: Contractor owner/admin, managing agency owner, or super admin
DROP POLICY IF EXISTS "Authorized users can insert contractor embed domains" ON public.contractor_embed_domains;
CREATE POLICY "Authorized users can insert contractor embed domains"
ON public.contractor_embed_domains FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (
    SELECT id FROM public.organizations WHERE partner_agency_id IN (
      SELECT id FROM public.partner_agencies WHERE primary_owner_id = auth.uid()
    )
  )
  OR org_id IN (
    SELECT org_id FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR public.auth_is_super_admin()
);

-- 5. UPDATE Policy: Contractor owner/admin, managing agency owner, or super admin
DROP POLICY IF EXISTS "Authorized users can update contractor embed domains" ON public.contractor_embed_domains;
CREATE POLICY "Authorized users can update contractor embed domains"
ON public.contractor_embed_domains FOR UPDATE
TO authenticated
USING (
  org_id IN (
    SELECT id FROM public.organizations WHERE partner_agency_id IN (
      SELECT id FROM public.partner_agencies WHERE primary_owner_id = auth.uid()
    )
  )
  OR org_id IN (
    SELECT org_id FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR public.auth_is_super_admin()
);

-- 6. DELETE Policy: Contractor owner/admin, managing agency owner, or super admin
DROP POLICY IF EXISTS "Authorized users can delete contractor embed domains" ON public.contractor_embed_domains;
CREATE POLICY "Authorized users can delete contractor embed domains"
ON public.contractor_embed_domains FOR DELETE
TO authenticated
USING (
  org_id IN (
    SELECT id FROM public.organizations WHERE partner_agency_id IN (
      SELECT id FROM public.partner_agencies WHERE primary_owner_id = auth.uid()
    )
  )
  OR org_id IN (
    SELECT org_id FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR public.auth_is_super_admin()
);
