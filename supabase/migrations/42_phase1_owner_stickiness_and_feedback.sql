-- ==============================================================================
-- CAPTODESK MIGRATION 42: PHASE 1 OWNER STICKINESS & PRIVATE FEEDBACK INTERCEPTOR
-- Adds customer feedback interception table, weekly digest columns on organizations,
-- and tenant-isolated Row Level Security policies.
-- ==============================================================================

-- 1. Extend organizations with weekly ROI digest settings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations'
  ) THEN
    ALTER TABLE public.organizations 
      ADD COLUMN IF NOT EXISTS weekly_digest_enabled BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS weekly_digest_channels TEXT[] DEFAULT ARRAY['sms']::TEXT[],
      ADD COLUMN IF NOT EXISTS weekly_digest_day_of_week INT DEFAULT 1, -- 1 = Monday
      ADD COLUMN IF NOT EXISTS weekly_digest_hour INT DEFAULT 8,         -- 8:00 AM local
      ADD COLUMN IF NOT EXISTS last_weekly_digest_sent_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_organizations_weekly_digest 
      ON public.organizations(weekly_digest_enabled, last_weekly_digest_sent_at);
  END IF;
END $$;

-- 2. Customer Private Feedback Table (Review Interceptor)
CREATE TABLE IF NOT EXISTS public.customer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance and quick dashboard resolution lookups
CREATE INDEX IF NOT EXISTS idx_customer_feedback_org_created 
  ON public.customer_feedback(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_org_unresolved 
  ON public.customer_feedback(org_id, resolved) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_customer_feedback_job 
  ON public.customer_feedback(job_id);

-- 3. Row Level Security Policies for customer_feedback
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Feedback tenant isolation select" ON public.customer_feedback;
CREATE POLICY "Feedback tenant isolation select" ON public.customer_feedback 
  FOR SELECT TO authenticated
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Feedback tenant isolation update" ON public.customer_feedback;
CREATE POLICY "Feedback tenant isolation update" ON public.customer_feedback 
  FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Feedback service role full access" ON public.customer_feedback;
CREATE POLICY "Feedback service role full access" ON public.customer_feedback 
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
