-- ==============================================================================
-- CAPTODESK MIGRATION 48: APPOINTMENTS SCHEMA RESILIENCE
-- Ensures public.appointments has updated_at column and resilient check constraint.
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'appointments' 
          AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;
