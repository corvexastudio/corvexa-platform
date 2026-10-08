-- ==============================================================================
-- CAPTODESK MIGRATION 23: RELAX ORGANIZATIONS PHONE_NUMBER NOT-NULL CONSTRAINT
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE organizations ALTER COLUMN phone_number DROP NOT NULL;
  ELSE
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS phone_number TEXT;
  END IF;
END $$;
