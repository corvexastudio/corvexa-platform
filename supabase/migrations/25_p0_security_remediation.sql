-- ==============================================================================
-- CAPTODESK MIGRATION 25: P0 SECURITY REMEDIATION & MULTI-TENANT HARDENING
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
--
-- REMEDIATES ALL VERIFIED P0 RELEASE BLOCKERS:
-- 1. CRIT-01: Drops dangerous "manage_token IS NOT NULL" RLS policies on quotes,
--             invoices, appointments, and services.
-- 2. CRIT-02: Installs BEFORE UPDATE & BEFORE INSERT triggers locking profile role,
--             org_id, and user id against tampering by non-service-role callers.
--             Adds explicit search_path on auth helper functions.
-- 3. CRIT-03: Drops dangerous "WITH CHECK (true)" anonymous INSERT policies on
--             contacts and appointments. Revokes direct anon table writes.
-- 4. CRIT-04: Drops dangerous "token IS NOT NULL" public SELECT and UPDATE policies
--             on review_requests. Revokes direct anon table updates.
-- 5. HIGH-02: Hardens organizations UPDATE policy to require owner/admin role.
-- ==============================================================================

-- ==============================================================================
-- 1. DROP DANGEROUS WILDCARD / ANONYMOUS POLICIES (CRIT-01, CRIT-03, CRIT-04)
-- ==============================================================================

-- Drop Migration 24 insecure public policies
DROP POLICY IF EXISTS "Public can view organization booking profile by slug" ON public.organizations;
DROP POLICY IF EXISTS "Public can view active services" ON public.services;
DROP POLICY IF EXISTS "Public can view appointments by manage_token" ON public.appointments;
DROP POLICY IF EXISTS "Public can create appointments via booking" ON public.appointments;
DROP POLICY IF EXISTS "Public can create contacts via booking" ON public.contacts;
DROP POLICY IF EXISTS "Public can view quotes by manage_token" ON public.quotes;
DROP POLICY IF EXISTS "Public can view invoices by manage_token" ON public.invoices;

-- Drop Migration 11 insecure review request policies
DROP POLICY IF EXISTS "Public token click redirect access" ON public.review_requests;
DROP POLICY IF EXISTS "Public token click counter update" ON public.review_requests;

-- Revoke all table-level access from anon role on tenant tables
-- Public token access is handled strictly via authenticated server-side API routes
-- using service-role clients, never direct anonymous PostgREST access.
REVOKE ALL ON public.organizations FROM anon;
REVOKE ALL ON public.services FROM anon;
REVOKE ALL ON public.appointments FROM anon;
REVOKE ALL ON public.contacts FROM anon;
REVOKE ALL ON public.quotes FROM anon;
REVOKE ALL ON public.quote_items FROM anon;
REVOKE ALL ON public.invoices FROM anon;
REVOKE ALL ON public.invoice_items FROM anon;
REVOKE ALL ON public.review_requests FROM anon;
REVOKE ALL ON public.leads FROM anon;
REVOKE ALL ON public.calls FROM anon;
REVOKE ALL ON public.conversations FROM anon;
REVOKE ALL ON public.messages FROM anon;
REVOKE ALL ON public.automation_settings FROM anon;
REVOKE ALL ON public.activity_logs FROM anon;

-- ==============================================================================
-- 2. SECURE AUTH HELPER FUNCTIONS (Explicit search_path & Role Helpers)
-- ==============================================================================

-- Helper function: get current user org_id
CREATE OR REPLACE FUNCTION public.auth_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth, pg_temp;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth, pg_temp;

-- Helper function: check if user is super_admin
CREATE OR REPLACE FUNCTION public.auth_is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth, pg_temp;

-- ==============================================================================
-- 3. CRIT-02: LOCK PROFILE ROLE, ORG_ID, AND IDENTITY MUTABILITY
-- ==============================================================================

-- Ensure profile UPDATE policy requires authentication and limits to self/super_admin
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.auth_is_super_admin())
WITH CHECK (id = auth.uid() OR public.auth_is_super_admin());

-- Trigger function: Reject role/org_id/id tampering on UPDATE
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_jwt_role text;
  v_auth_role text;
BEGIN
  -- Extract caller authorization role
  v_jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  BEGIN
    v_auth_role := coalesce(auth.role(), '');
  EXCEPTION WHEN OTHERS THEN
    v_auth_role := '';
  END;

  -- Allow trusted server execution (service_role, postgres superuser, or platform super_admin)
  IF v_jwt_role = 'service_role' 
     OR v_auth_role = 'service_role' 
     OR current_user IN ('postgres', 'supabase_admin')
     OR public.auth_is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- Block privilege escalation (changing role to owner, admin, or super_admin)
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Modifying profile role is prohibited. Only server administrative operations may change roles.'
      USING ERRCODE = '42501';
  END IF;

  -- Block tenant hijacking (changing org_id to victim organization)
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'Modifying profile org_id is prohibited. Cross-tenant movement is forbidden.'
      USING ERRCODE = '42501';
  END IF;

  -- Block user identity spoofing
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Modifying profile user id is prohibited.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_security_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_security_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_security_fields();

-- Trigger function: Reject self-assigned privileged role or org on INSERT
CREATE OR REPLACE FUNCTION public.protect_profile_insert_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_jwt_role text;
  v_auth_role text;
BEGIN
  v_jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  BEGIN
    v_auth_role := coalesce(auth.role(), '');
  EXCEPTION WHEN OTHERS THEN
    v_auth_role := '';
  END;

  -- Allow trusted server execution
  IF v_jwt_role = 'service_role' 
     OR v_auth_role = 'service_role' 
     OR current_user IN ('postgres', 'supabase_admin')
     OR public.auth_is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- Normal users cannot self-assign super_admin role on creation
  IF NEW.role NOT IN ('owner', 'member') THEN
    RAISE EXCEPTION 'Cannot self-assign privileged role on profile insertion.'
      USING ERRCODE = '42501';
  END IF;

  -- Normal users cannot self-assign arbitrary org_id on creation
  -- org_id must be linked through authorized onboarding server endpoint
  IF NEW.org_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot self-assign organization on profile insertion. Must be linked via authorized onboarding.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_insert_security_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_insert_security_fields
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_insert_security_fields();

-- ==============================================================================
-- 4. HIGH-02: RESTRICT ORGANIZATIONS UPDATE TO OWNER / ADMIN ONLY
-- ==============================================================================

DROP POLICY IF EXISTS "Users can update their own organization" ON public.organizations;
CREATE POLICY "Users can update their own organization"
ON public.organizations FOR UPDATE
TO authenticated
USING (
  (id = public.auth_user_org_id() AND public.auth_user_role() IN ('owner', 'admin')) 
  OR public.auth_is_super_admin()
)
WITH CHECK (
  (id = public.auth_user_org_id() AND public.auth_user_role() IN ('owner', 'admin')) 
  OR public.auth_is_super_admin()
);
