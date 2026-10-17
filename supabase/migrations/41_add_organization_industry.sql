-- ==============================================================================
-- CAPTODESK MIGRATION 41: INDUSTRY CATEGORY SUPPORT
-- Adds industry trade classification column to organizations table
-- ==============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS industry TEXT DEFAULT 'general';
    CREATE INDEX IF NOT EXISTS idx_organizations_industry ON public.organizations(industry);
  END IF;
END $$;
