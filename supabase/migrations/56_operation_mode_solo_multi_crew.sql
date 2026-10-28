-- ==============================================================================
-- CAPTODESK MIGRATION 56: OPERATION SCALE (SOLO VS MULTI-CREW)
-- Adds operation_mode column to organizations to tailor UI and upgrade paths.
-- ==============================================================================

-- 1. Add operation_mode column to organizations (defaults to 'solo')
ALTER TABLE public.organizations 
    ADD COLUMN IF NOT EXISTS operation_mode TEXT DEFAULT 'solo';

-- 2. Add constraint checking valid values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'organizations_operation_mode_check'
    ) THEN
        ALTER TABLE public.organizations 
            ADD CONSTRAINT organizations_operation_mode_check 
            CHECK (operation_mode IN ('solo', 'multi_crew'));
    END IF;
END $$;

-- 3. Backfill existing organizations based on active plan
UPDATE public.organizations 
SET operation_mode = CASE 
    WHEN plan_id IN ('multi_crew', 'multi_crew_yearly', 'fleet') THEN 'multi_crew'
    ELSE 'solo'
END
WHERE operation_mode IS NULL;

-- 4. Index for performant lookups
CREATE INDEX IF NOT EXISTS idx_organizations_operation_mode 
    ON public.organizations(operation_mode);
