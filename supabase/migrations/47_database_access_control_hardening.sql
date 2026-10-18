-- ==============================================================================
-- CAPTODESK MIGRATION 47: DATABASE ACCESS CONTROL HARDENING
-- Remediates anonymous direct-table access on job_photos and referral_links.
-- Enforces strict role-based write permissions on crews, recurring_job_templates,
-- and job_photos. Hardens storage bucket configuration to private with RLS.
-- ==============================================================================

-- 1. HARDEN JOB_PHOTOS ACCESS CONTROL
-- ------------------------------------------------------------------------------
-- Drop insecure anonymous select policy (prevents anonymous metadata enumeration)
DROP POLICY IF EXISTS "Job photos public read for customer tracking" ON public.job_photos;

-- Enforce tenant-isolated SELECT for authenticated members
DROP POLICY IF EXISTS "Job photos tenant isolation select" ON public.job_photos;
CREATE POLICY "Job photos tenant isolation select" ON public.job_photos 
  FOR SELECT TO authenticated
  USING (
    org_id = public.auth_user_org_id()
    OR public.auth_is_super_admin()
  );

-- Enforce tenant-isolated INSERT (members and technicians can upload photos)
DROP POLICY IF EXISTS "Job photos tenant isolation insert" ON public.job_photos;
CREATE POLICY "Job photos tenant isolation insert" ON public.job_photos 
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.auth_user_org_id()
    OR public.auth_is_super_admin()
  );

-- Enforce restricted UPDATE: only owners, admins, or the original uploader
DROP POLICY IF EXISTS "Job photos tenant isolation update" ON public.job_photos;
CREATE POLICY "Job photos tenant isolation update" ON public.job_photos 
  FOR UPDATE TO authenticated
  USING (
    (
      org_id = public.auth_user_org_id()
      AND (
        public.auth_user_role() IN ('owner', 'admin', 'client_admin')
        OR uploaded_by = auth.uid()
      )
    )
    OR public.auth_is_super_admin()
  )
  WITH CHECK (
    (
      org_id = public.auth_user_org_id()
      AND (
        public.auth_user_role() IN ('owner', 'admin', 'client_admin')
        OR uploaded_by = auth.uid()
      )
    )
    OR public.auth_is_super_admin()
  );

-- Enforce restricted DELETE: only owners, admins, or the original uploader
DROP POLICY IF EXISTS "Job photos tenant isolation delete" ON public.job_photos;
CREATE POLICY "Job photos tenant isolation delete" ON public.job_photos 
  FOR DELETE TO authenticated
  USING (
    (
      org_id = public.auth_user_org_id()
      AND (
        public.auth_user_role() IN ('owner', 'admin', 'client_admin')
        OR uploaded_by = auth.uid()
      )
    )
    OR public.auth_is_super_admin()
  );

-- Ensure service_role retains full access for backend processing & tracking API
DROP POLICY IF EXISTS "Job photos service role full access" ON public.job_photos;
CREATE POLICY "Job photos service role full access" ON public.job_photos 
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- 2. HARDEN REFERRAL_LINKS ACCESS CONTROL
-- ------------------------------------------------------------------------------
-- Drop insecure anonymous select policy (prevents anonymous referral enumeration)
DROP POLICY IF EXISTS "Referral public read for redirect" ON public.referral_links;

-- Enforce tenant-isolated SELECT for authenticated users
DROP POLICY IF EXISTS "Referral tenant isolation select" ON public.referral_links;
CREATE POLICY "Referral tenant isolation select" ON public.referral_links 
  FOR SELECT TO authenticated
  USING (
    org_id = public.auth_user_org_id()
    OR public.auth_is_super_admin()
  );

-- Enforce role-restricted INSERT: only managers (owner, admin, client_admin)
DROP POLICY IF EXISTS "Referral tenant isolation insert" ON public.referral_links;
CREATE POLICY "Referral tenant isolation insert" ON public.referral_links 
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      org_id = public.auth_user_org_id()
      AND public.auth_user_role() IN ('owner', 'admin', 'client_admin')
    )
    OR public.auth_is_super_admin()
  );

-- Enforce role-restricted UPDATE: only managers (owner, admin, client_admin)
DROP POLICY IF EXISTS "Referral tenant isolation update" ON public.referral_links;
CREATE POLICY "Referral tenant isolation update" ON public.referral_links 
  FOR UPDATE TO authenticated
  USING (
    (
      org_id = public.auth_user_org_id()
      AND public.auth_user_role() IN ('owner', 'admin', 'client_admin')
    )
    OR public.auth_is_super_admin()
  )
  WITH CHECK (
    (
      org_id = public.auth_user_org_id()
      AND public.auth_user_role() IN ('owner', 'admin', 'client_admin')
    )
    OR public.auth_is_super_admin()
  );

-- Ensure service_role retains full access for public referral redirect & conversion
DROP POLICY IF EXISTS "Referral service role full access" ON public.referral_links;
CREATE POLICY "Referral service role full access" ON public.referral_links 
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- 3. HARDEN CREWS ACCESS CONTROL
-- ------------------------------------------------------------------------------
-- Enforce tenant-isolated SELECT for authenticated users
DROP POLICY IF EXISTS "Tenant users can view crews" ON public.crews;
CREATE POLICY "Tenant users can view crews" ON public.crews
  FOR SELECT TO authenticated
  USING (
    org_id = public.auth_user_org_id()
    OR public.auth_is_super_admin()
  );

-- Enforce role-restricted INSERT: only managers (owner, admin, client_admin)
DROP POLICY IF EXISTS "Tenant users can insert crews" ON public.crews;
CREATE POLICY "Tenant users can insert crews" ON public.crews
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      org_id = public.auth_user_org_id()
      AND public.auth_user_role() IN ('owner', 'admin', 'client_admin')
    )
    OR public.auth_is_super_admin()
  );

-- Enforce role-restricted UPDATE: only managers (owner, admin, client_admin)
DROP POLICY IF EXISTS "Tenant users can update crews" ON public.crews;
CREATE POLICY "Tenant users can update crews" ON public.crews
  FOR UPDATE TO authenticated
  USING (
    (
      org_id = public.auth_user_org_id()
      AND public.auth_user_role() IN ('owner', 'admin', 'client_admin')
    )
    OR public.auth_is_super_admin()
  )
  WITH CHECK (
    (
      org_id = public.auth_user_org_id()
      AND public.auth_user_role() IN ('owner', 'admin', 'client_admin')
    )
    OR public.auth_is_super_admin()
  );

-- Enforce role-restricted DELETE: only managers (owner, admin, client_admin)
DROP POLICY IF EXISTS "Tenant users can delete crews" ON public.crews;
CREATE POLICY "Tenant users can delete crews" ON public.crews
  FOR DELETE TO authenticated
  USING (
    (
      org_id = public.auth_user_org_id()
      AND public.auth_user_role() IN ('owner', 'admin', 'client_admin')
    )
    OR public.auth_is_super_admin()
  );

-- Ensure service_role has full access
DROP POLICY IF EXISTS "Crews service role full access" ON public.crews;
CREATE POLICY "Crews service role full access" ON public.crews
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- 4. HARDEN RECURRING_JOB_TEMPLATES ACCESS CONTROL
-- ------------------------------------------------------------------------------
-- Enforce tenant-isolated SELECT for authenticated users
DROP POLICY IF EXISTS "Recurring templates tenant isolation select" ON public.recurring_job_templates;
CREATE POLICY "Recurring templates tenant isolation select" ON public.recurring_job_templates 
  FOR SELECT TO authenticated
  USING (
    org_id = public.auth_user_org_id()
    OR public.auth_is_super_admin()
  );

-- Enforce role-restricted INSERT: only managers (owner, admin, client_admin)
DROP POLICY IF EXISTS "Recurring templates tenant isolation insert" ON public.recurring_job_templates;
CREATE POLICY "Recurring templates tenant isolation insert" ON public.recurring_job_templates 
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      org_id = public.auth_user_org_id()
      AND public.auth_user_role() IN ('owner', 'admin', 'client_admin')
    )
    OR public.auth_is_super_admin()
  );

-- Enforce role-restricted UPDATE: only managers (owner, admin, client_admin)
DROP POLICY IF EXISTS "Recurring templates tenant isolation update" ON public.recurring_job_templates;
CREATE POLICY "Recurring templates tenant isolation update" ON public.recurring_job_templates 
  FOR UPDATE TO authenticated
  USING (
    (
      org_id = public.auth_user_org_id()
      AND public.auth_user_role() IN ('owner', 'admin', 'client_admin')
    )
    OR public.auth_is_super_admin()
  )
  WITH CHECK (
    (
      org_id = public.auth_user_org_id()
      AND public.auth_user_role() IN ('owner', 'admin', 'client_admin')
    )
    OR public.auth_is_super_admin()
  );

-- Enforce role-restricted DELETE: only managers (owner, admin, client_admin)
DROP POLICY IF EXISTS "Recurring templates tenant isolation delete" ON public.recurring_job_templates;
CREATE POLICY "Recurring templates tenant isolation delete" ON public.recurring_job_templates 
  FOR DELETE TO authenticated
  USING (
    (
      org_id = public.auth_user_org_id()
      AND public.auth_user_role() IN ('owner', 'admin', 'client_admin')
    )
    OR public.auth_is_super_admin()
  );

-- Ensure service_role has full access
DROP POLICY IF EXISTS "Recurring templates service role full access" ON public.recurring_job_templates;
CREATE POLICY "Recurring templates service role full access" ON public.recurring_job_templates 
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- 5. HARDEN STORAGE BUCKET & STORAGE.OBJECTS RLS POLICIES
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    -- Ensure job-photos bucket exists and is marked private
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'job-photos',
        'job-photos',
        false,
        10485760, -- 10MB
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']
      )
      ON CONFLICT (id) DO UPDATE SET public = false;
    END IF;

    -- Enforce storage.objects tenant isolation policies
    -- Note: storage.objects has RLS enabled by default in Supabase; do not execute ALTER TABLE ENABLE RLS (owned by supabase_storage_admin)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
      DROP POLICY IF EXISTS "Tenant users can view own job photos" ON storage.objects;
      CREATE POLICY "Tenant users can view own job photos"
        ON storage.objects FOR SELECT TO authenticated
        USING (
          bucket_id = 'job-photos'
          AND (
            (storage.foldername(name))[1] = public.auth_user_org_id()::text
            OR public.auth_is_super_admin()
          )
        );

      DROP POLICY IF EXISTS "Tenant users can upload job photos" ON storage.objects;
      CREATE POLICY "Tenant users can upload job photos"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'job-photos'
          AND (
            (storage.foldername(name))[1] = public.auth_user_org_id()::text
            OR public.auth_is_super_admin()
          )
        );

      DROP POLICY IF EXISTS "Tenant users can update own job photos" ON storage.objects;
      CREATE POLICY "Tenant users can update own job photos"
        ON storage.objects FOR UPDATE TO authenticated
        USING (
          bucket_id = 'job-photos'
          AND (
            (
              (storage.foldername(name))[1] = public.auth_user_org_id()::text
              AND (
                public.auth_user_role() IN ('owner', 'admin', 'client_admin')
                OR owner = auth.uid()
              )
            )
            OR public.auth_is_super_admin()
          )
        )
        WITH CHECK (
          bucket_id = 'job-photos'
          AND (
            (
              (storage.foldername(name))[1] = public.auth_user_org_id()::text
              AND (
                public.auth_user_role() IN ('owner', 'admin', 'client_admin')
                OR owner = auth.uid()
              )
            )
            OR public.auth_is_super_admin()
          )
        );

      DROP POLICY IF EXISTS "Tenant users can delete own job photos" ON storage.objects;
      CREATE POLICY "Tenant users can delete own job photos"
        ON storage.objects FOR DELETE TO authenticated
        USING (
          bucket_id = 'job-photos'
          AND (
            (
              (storage.foldername(name))[1] = public.auth_user_org_id()::text
              AND (
                public.auth_user_role() IN ('owner', 'admin', 'client_admin')
                OR owner = auth.uid()
              )
            )
            OR public.auth_is_super_admin()
          )
        );
    END IF;
  END IF;
END $$;
