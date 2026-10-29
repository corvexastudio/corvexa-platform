-- ==============================================================================
-- CAPTODESK MIGRATION 58: PROTECT ALL AUTHORITATIVE BILLING & ENTITLEMENT FIELDS
-- Remediates P0-004: Enforces server-authoritative SaaS billing state by strictly
-- blocking tenant self-mutation across all authoritative billing/entitlement fields:
-- 1. subscription_status
-- 2. monthly_rate
-- 3. plan_id
-- 4. plan_tier
-- 5. billing_provider
-- 6. paypal_subscription_id
-- 7. paypal_plan_id
-- 8. stripe_customer_id
-- 9. stripe_subscription_id
-- Preserves authorized administrative updates via service_role, postgres,
-- supabase_admin, and verified platform super_admin.
-- ==============================================================================

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

  -- 1. plan_id
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
    RAISE EXCEPTION 'Tenant users cannot modify plan_id. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. plan_tier
  IF NEW.plan_tier IS DISTINCT FROM OLD.plan_tier THEN
    RAISE EXCEPTION 'Tenant users cannot modify plan_tier. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  -- 3. subscription_status
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Tenant users cannot modify subscription_status. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  -- 4. monthly_rate
  IF NEW.monthly_rate IS DISTINCT FROM OLD.monthly_rate THEN
    RAISE EXCEPTION 'Tenant users cannot modify monthly_rate. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  -- 5. billing_provider
  IF NEW.billing_provider IS DISTINCT FROM OLD.billing_provider THEN
    RAISE EXCEPTION 'Tenant users cannot modify billing_provider. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  -- 6. paypal_subscription_id
  IF NEW.paypal_subscription_id IS DISTINCT FROM OLD.paypal_subscription_id THEN
    RAISE EXCEPTION 'Tenant users cannot modify paypal_subscription_id. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  -- 7. paypal_plan_id
  IF NEW.paypal_plan_id IS DISTINCT FROM OLD.paypal_plan_id THEN
    RAISE EXCEPTION 'Tenant users cannot modify paypal_plan_id. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  -- 8. stripe_customer_id
  IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
    RAISE EXCEPTION 'Tenant users cannot modify stripe_customer_id. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  -- 9. stripe_subscription_id
  IF NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN
    RAISE EXCEPTION 'Tenant users cannot modify stripe_subscription_id. Billing state is server-authoritative.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Re-attach trigger to public.organizations BEFORE UPDATE
DROP TRIGGER IF EXISTS trg_protect_organization_billing_fields ON public.organizations;
CREATE TRIGGER trg_protect_organization_billing_fields
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.protect_organization_billing_fields();
