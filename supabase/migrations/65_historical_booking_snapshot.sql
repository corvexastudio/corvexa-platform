-- ==============================================================================
-- CAPTODESK MIGRATION 65: HISTORICAL BOOKING SNAPSHOT & SERVICE INTEGRITY
-- Preserves immutable booking configuration (pricing model, add-ons, fees)
-- on appointments so contractor catalog mutations never alter historical records.
-- ==============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'appointments'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS booking_snapshot JSONB;
    END IF;
END $$;
