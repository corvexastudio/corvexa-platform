-- ==============================================================================
-- CAPTODESK MIGRATION 68: ROW LEVEL SECURITY FOR PARTNER AGENCIES
-- Remediates F-AGY-07: Enables PostgreSQL Row Level Security (RLS) on public.partner_agencies
-- Enforces owner-scoped SELECT, INSERT, and UPDATE policies using immutable auth.uid().
-- Protects authoritative billing, tier, and capacity allocation fields from client mutation.
-- Grants agency owners visibility into their linked client organizations.
-- Preserves privileged access for service_role, postgres, and platform super_admin.
-- ==============================================================================

-- 1. Enable Row Level Security on partner_agencies
ALTER TABLE public.partner_agencies ENABLE ROW LEVEL SECURITY;

-- 2. Owner-Scoped SELECT Policy
DROP POLICY IF EXISTS "Partner agency owner can view own agency" ON public.partner_agencies;
CREATE POLICY "Partner agency owner can view own agency"
ON public.partner_agencies FOR SELECT
TO authenticated
USING (
  primary_owner_id = auth.uid() OR public.auth_is_super_admin()
);

-- 3. Owner-Scoped UPDATE Policy
DROP POLICY IF EXISTS "Partner agency owner can update own agency profile" ON public.partner_agencies;
CREATE POLICY "Partner agency owner can update own agency profile"
ON public.partner_agencies FOR UPDATE
TO authenticated
USING (
  primary_owner_id = auth.uid() OR public.auth_is_super_admin()
)
WITH CHECK (
  primary_owner_id = auth.uid() OR public.auth_is_super_admin()
);

-- 4. Owner-Scoped INSERT Policy
DROP POLICY IF EXISTS "Authenticated users can create own partner agency" ON public.partner_agencies;
CREATE POLICY "Authenticated users can create own partner agency"
ON public.partner_agencies FOR INSERT
TO authenticated
WITH CHECK (
  primary_owner_id = auth.uid() OR public.auth_is_super_admin()
);

-- 5. Trigger Function to Protect Authoritative Fields from Tenant Tampering
CREATE OR REPLACE FUNCTION public.protect_partner_agency_authoritative_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_jwt_role text;
  v_auth_role text;
BEGIN
  -- Detect privileged database execution contexts
  v_jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  BEGIN
    v_auth_role := coalesce(auth.role(), '');
  EXCEPTION WHEN OTHERS THEN
    v_auth_role := '';
  END;

  -- Allow trusted server execution (service_role, postgres, supabase_admin, or Super Admin)
  IF v_jwt_role = 'service_role' 
     OR v_auth_role = 'service_role' 
     OR current_user IN ('postgres', 'supabase_admin')
     OR public.auth_is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- 1. primary_owner_id cannot be changed by tenant
  IF NEW.primary_owner_id IS DISTINCT FROM OLD.primary_owner_id THEN
    RAISE EXCEPTION 'Agency users cannot modify primary_owner_id.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. subscription_tier cannot be self-mutated (server-authoritative billing)
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    RAISE EXCEPTION 'Agency users cannot modify subscription_tier. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  -- 3. subscription_status cannot be self-mutated
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Agency users cannot modify subscription_status. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  -- 4. total_slots cannot be self-mutated (capacity allocation is server-authoritative)
  IF NEW.total_slots IS DISTINCT FROM OLD.total_slots THEN
    RAISE EXCEPTION 'Agency users cannot modify total_slots. Capacity allocation is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_partner_agency_authoritative_fields ON public.partner_agencies;
CREATE TRIGGER trg_protect_partner_agency_authoritative_fields
BEFORE UPDATE ON public.partner_agencies
FOR EACH ROW
EXECUTE FUNCTION public.protect_partner_agency_authoritative_fields();

-- 6. Grant Agency Owners Visibility into Linked Client Organizations
DROP POLICY IF EXISTS "Agency owners can view their linked client organizations" ON public.organizations;
CREATE POLICY "Agency owners can view their linked client organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (
  partner_agency_id IN (
    SELECT id FROM public.partner_agencies WHERE primary_owner_id = auth.uid()
  )
);
