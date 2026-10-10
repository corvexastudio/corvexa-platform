-- ==============================================================================
-- CAPTODESK MIGRATION 32: PREVENT OVERLAPPING APPOINTMENT CONCURRENCY
-- Enforces PostgreSQL GiST exclusion constraint on active appointment intervals
-- ==============================================================================

-- 1. Ensure required btree_gist extension exists for UUID scalar comparison in GiST
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
DECLARE
    conflict_count INT := 0;
BEGIN
    -- 2. Backfill any active appointments that have NULL end_time (defaulting to start_time + 1 hour)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'end_time'
    ) THEN
        UPDATE public.appointments
        SET end_time = start_time + INTERVAL '1 hour'
        WHERE end_time IS NULL;
    END IF;

    -- 3. Diagnostic check: detect any pre-existing overlapping active appointments
    SELECT COUNT(*) INTO conflict_count
    FROM public.appointments a1
    JOIN public.appointments a2 ON a1.org_id = a2.org_id
        AND a1.id < a2.id
        AND a1.status IN ('requested', 'confirmed', 'scheduled')
        AND a2.status IN ('requested', 'confirmed', 'scheduled')
        AND a1.deleted_at IS NULL
        AND a2.deleted_at IS NULL
        AND tstzrange(a1.start_time, a1.end_time, '[)') && tstzrange(a2.start_time, a2.end_time, '[)');

    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Migration halted: Found % overlapping active appointment pair(s). Resolve conflicting records before applying exclusion constraint.', conflict_count;
    END IF;

    -- 4. Add the exclusion constraint if it does not already exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_overlapping_bookings'
    ) THEN
        ALTER TABLE public.appointments
        ADD CONSTRAINT appointments_no_overlapping_bookings
        EXCLUDE USING gist (
            org_id WITH =,
            tstzrange(start_time, end_time, '[)') WITH &&
        )
        WHERE (status IN ('requested', 'confirmed', 'scheduled') AND deleted_at IS NULL);
    END IF;

END $$;
