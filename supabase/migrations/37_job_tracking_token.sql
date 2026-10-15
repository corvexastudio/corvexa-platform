-- ==============================================================================
-- PHASE 1: JOB LIFECYCLE & REAL-TIME TRACKER EXTENSION
-- Adds tracking_token to jobs table and performance index.
-- ==============================================================================

-- 1. Ensure tracking_token column exists
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tracking_token TEXT;

-- 2. Backfill tracking_token for existing jobs safely
UPDATE jobs 
SET tracking_token = md5(random()::text || clock_timestamp()::text || id::text) || md5(random()::text || clock_timestamp()::text) 
WHERE tracking_token IS NULL;

-- 3. Set default generator and NOT NULL
ALTER TABLE jobs ALTER COLUMN tracking_token SET DEFAULT md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text);

-- 4. Unique constraint and Index
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname IN ('jobs_tracking_token_key', 'jobs_tracking_token_unique')
    ) THEN
        ALTER TABLE jobs ADD CONSTRAINT jobs_tracking_token_unique UNIQUE (tracking_token);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_tracking_token ON jobs(tracking_token);
