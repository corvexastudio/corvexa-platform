-- ==============================================================================
-- CAPTODESK MIGRATION 36: SAAS BILLING AUTHORIZATION & ENTITLEMENT HARDENING (P1-BILLING-01)
-- Enforces server-authoritative SaaS billing state, strictly blocks tenant
-- self-mutation of subscription_status and monthly_rate, and guarantees that
-- only Super Admins and service_role can modify organization billing state.
-- ==============================================================================

-- 1. Function to protect organization billing fields from tenant modification
CREATE OR REPLACE FUNCTION public.protect_organization_billing_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_jwt_role text;
  v_auth_role text;
BEGIN
  -- Detect privileged contexts
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

  -- Block any unprivileged or tenant user from mutating billing-sensitive fields
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Tenant users cannot modify subscription_status. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.monthly_rate IS DISTINCT FROM OLD.monthly_rate THEN
    RAISE EXCEPTION 'Tenant users cannot modify monthly_rate. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Attach trigger to public.organizations
DROP TRIGGER IF EXISTS trg_protect_organization_billing_fields ON public.organizations;
CREATE TRIGGER trg_protect_organization_billing_fields
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.protect_organization_billing_fields();
