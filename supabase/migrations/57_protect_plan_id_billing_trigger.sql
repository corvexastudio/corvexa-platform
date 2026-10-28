-- ==============================================================================
-- CAPTODESK MIGRATION 57: PROTECT PLAN_ID IN BILLING AUTHORIZATION TRIGGER
-- Enforces server-authoritative SaaS billing state, strictly blocks tenant
-- self-mutation of organizations.plan_id via direct Supabase client SDK or RLS,
-- and preserves server-authoritative execution via service_role and super_admin.
-- ==============================================================================

-- 1. Redefine public.protect_organization_billing_fields() with plan_id protection
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

  -- Block any unprivileged or tenant user from mutating plan_id
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
    RAISE EXCEPTION 'Tenant users cannot modify plan_id. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  -- Block any unprivileged or tenant user from mutating subscription_status
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Tenant users cannot modify subscription_status. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  -- Block any unprivileged or tenant user from mutating monthly_rate
  IF NEW.monthly_rate IS DISTINCT FROM OLD.monthly_rate THEN
    RAISE EXCEPTION 'Tenant users cannot modify monthly_rate. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  -- Block any unprivileged or tenant user from mutating paypal_subscription_id
  IF NEW.paypal_subscription_id IS DISTINCT FROM OLD.paypal_subscription_id THEN
    RAISE EXCEPTION 'Tenant users cannot modify paypal_subscription_id. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  -- Block any unprivileged or tenant user from mutating paypal_plan_id
  IF NEW.paypal_plan_id IS DISTINCT FROM OLD.paypal_plan_id THEN
    RAISE EXCEPTION 'Tenant users cannot modify paypal_plan_id. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Re-attach trigger to public.organizations BEFORE UPDATE
DROP TRIGGER IF EXISTS trg_protect_organization_billing_fields ON public.organizations;
CREATE TRIGGER trg_protect_organization_billing_fields
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.protect_organization_billing_fields();
