-- Migration 54: Contractor Privacy Tracking Mode & Verified Trade License
-- Supports Domino's Smart Milestone Tracking (default) vs Live Geofenced GPS
-- Adds trade license number for homeowner safety & trust

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS license_number TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tracking_mode TEXT DEFAULT 'milestone';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tracking_geofence_miles NUMERIC DEFAULT 5;

-- Ensure jobs status constraint supports 'arrived' in addition to standard lifecycle
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'jobs'
    ) THEN
        ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
        ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check 
            CHECK (status IN ('draft', 'scheduled', 'confirmed', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show'));
        ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
    END IF;
END $$;

COMMENT ON COLUMN organizations.tracking_mode IS 'Customer tracking presentation: "milestone" (Domino''s milestone progress bar, 100% contractor privacy) or "geofence_live" (live vehicle map when within geofence).';
COMMENT ON COLUMN organizations.license_number IS 'Verified state or municipal trade license number (e.g. Master Plumber, HVAC, Electrician) shown on customer tracking page.';

