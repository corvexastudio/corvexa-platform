-- ==============================================================================
-- CAPTODESK MIGRATION 44: PHASE 3 RECURRING JOBS & BEFORE/AFTER PHOTO PROOF
-- Creates recurring_job_templates for self-scheduling recurring trades,
-- extends jobs with recurring_template_id, and creates job_photos for visual proof.
-- ==============================================================================

-- 1. Create recurring_job_templates table
CREATE TABLE IF NOT EXISTS public.recurring_job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'biannual')),
  day_of_week INT, -- 0=Sun, 1=Mon, ..., 6=Sat
  preferred_time_start TIME NOT NULL DEFAULT '09:00:00',
  duration_minutes INT NOT NULL DEFAULT 60,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  auto_generate_days_ahead INT NOT NULL DEFAULT 14,
  last_generated_at TIMESTAMPTZ,
  next_scheduled_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for recurring templates
CREATE INDEX IF NOT EXISTS idx_recurring_jobs_org_next 
  ON public.recurring_job_templates(org_id, next_scheduled_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_recurring_jobs_contact 
  ON public.recurring_job_templates(contact_id);

-- 2. Link jobs table to recurring template
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs'
  ) THEN
    ALTER TABLE public.jobs 
      ADD COLUMN IF NOT EXISTS recurring_template_id UUID REFERENCES public.recurring_job_templates(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_jobs_recurring_template ON public.jobs(recurring_template_id);
  END IF;
END $$;

-- 3. Create job_photos table for before/after visual verification
CREATE TABLE IF NOT EXISTS public.job_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  photo_type TEXT NOT NULL CHECK (photo_type IN ('before', 'after', 'progress', 'completion')),
  url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for job photos
CREATE INDEX IF NOT EXISTS idx_job_photos_job ON public.job_photos(job_id, photo_type);
CREATE INDEX IF NOT EXISTS idx_job_photos_org ON public.job_photos(org_id, created_at DESC);

-- 4. Row Level Security for recurring_job_templates
ALTER TABLE public.recurring_job_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recurring templates tenant isolation select" ON public.recurring_job_templates;
CREATE POLICY "Recurring templates tenant isolation select" ON public.recurring_job_templates 
  FOR SELECT TO authenticated
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Recurring templates tenant isolation insert" ON public.recurring_job_templates;
CREATE POLICY "Recurring templates tenant isolation insert" ON public.recurring_job_templates 
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Recurring templates tenant isolation update" ON public.recurring_job_templates;
CREATE POLICY "Recurring templates tenant isolation update" ON public.recurring_job_templates 
  FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Recurring templates tenant isolation delete" ON public.recurring_job_templates;
CREATE POLICY "Recurring templates tenant isolation delete" ON public.recurring_job_templates 
  FOR DELETE TO authenticated
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Recurring templates service role full access" ON public.recurring_job_templates;
CREATE POLICY "Recurring templates service role full access" ON public.recurring_job_templates 
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Row Level Security for job_photos
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Job photos tenant isolation select" ON public.job_photos;
CREATE POLICY "Job photos tenant isolation select" ON public.job_photos 
  FOR SELECT TO authenticated
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Job photos public read for customer tracking" ON public.job_photos;
CREATE POLICY "Job photos public read for customer tracking" ON public.job_photos 
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Job photos tenant isolation insert" ON public.job_photos;
CREATE POLICY "Job photos tenant isolation insert" ON public.job_photos 
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Job photos tenant isolation delete" ON public.job_photos;
CREATE POLICY "Job photos tenant isolation delete" ON public.job_photos 
  FOR DELETE TO authenticated
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Job photos service role full access" ON public.job_photos;
CREATE POLICY "Job photos service role full access" ON public.job_photos 
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
