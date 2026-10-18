-- ==============================================================================
-- CAPTODESK — PHASE 2A.2: READ-ONLY DATABASE & STORAGE VERIFICATION SCRIPT
-- Strictly read-only queries to verify Migration 47 RLS policies and Storage.
-- Target: CaptoDesk Supabase Project (vlztovqaummczupslymr)
-- ==============================================================================

-- ==============================================================================
-- OVERVIEW: RUN THIS CONSOLIDATED QUERY FIRST FOR AN INSTANT STATUS SUMMARY
-- ==============================================================================
SELECT 
  t.tablename AS table_name,
  t.rowsecurity AS rls_enabled,
  COUNT(p.policyname) AS total_policies,
  COUNT(CASE WHEN 'anon' = ANY(p.roles) THEN 1 END) AS insecure_anon_policies,
  COUNT(CASE WHEN p.qual = 'true' AND NOT ('service_role' = ANY(p.roles)) THEN 1 END) AS insecure_using_true_policies,
  CASE 
    WHEN t.rowsecurity = true 
     AND COUNT(CASE WHEN 'anon' = ANY(p.roles) THEN 1 END) = 0
     AND COUNT(CASE WHEN p.qual = 'true' AND NOT ('service_role' = ANY(p.roles)) THEN 1 END) = 0
     AND COUNT(p.policyname) >= 4
    THEN 'PASS (Hardened & Protected)'
    ELSE 'INVESTIGATE'
  END AS security_verdict
FROM pg_tables t
LEFT JOIN pg_policies p 
  ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename IN ('referral_links', 'job_photos', 'crews', 'recurring_job_templates')
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;


-- ==============================================================================
-- DETAILED SECTIONS: RUN INDIVIDUALLY OR HIGHLIGHT TO INSPECT EXACT POLICIES
-- ==============================================================================

-- 1. VERIFY POLICIES ON JOB_PHOTOS
SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'job_photos'
ORDER BY policyname;


-- 2. VERIFY POLICIES ON REFERRAL_LINKS
SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'referral_links'
ORDER BY policyname;


-- 3. VERIFY POLICIES ON CREWS
SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'crews'
ORDER BY policyname;


-- 4. VERIFY POLICIES ON RECURRING_JOB_TEMPLATES
SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'recurring_job_templates'
ORDER BY policyname;


-- 5. VERIFY STORAGE.BUCKETS CONFIGURATION FOR JOB-PHOTOS
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'job-photos';


-- 6. VERIFY POLICIES ON STORAGE.OBJECTS FOR JOB-PHOTOS
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname ILIKE '%job photo%'
ORDER BY policyname;


-- 7. AUDIT FOR ANY RESIDUAL INSECURE "TO anon" OR "USING (true)" POLICIES
-- Expected: 0 rows returned
SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('referral_links', 'job_photos', 'crews', 'recurring_job_templates')
  AND (
    'anon' = ANY(roles)
    OR qual = 'true'
  )
  AND NOT ('service_role' = ANY(roles));


-- 8. CHECK MIGRATION TRACKING STATUS
SELECT 
  table_schema,
  table_name
FROM information_schema.tables 
WHERE table_schema = 'supabase_migrations';
