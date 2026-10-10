-- ==============================================================================
-- CAPTODESK MIGRATION 30: ELIMINATE SYNTHETIC +1999 PHONE NUMBERS & ENFORCE NULL SAFETY
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

DO $$
BEGIN
  -- 1. Ensure organizations.owner_phone permits NULL
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'owner_phone'
  ) THEN
    ALTER TABLE organizations ALTER COLUMN owner_phone DROP NOT NULL;
  END IF;

  -- 2. Ensure organizations.phone_number permits NULL (if column exists)
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE organizations ALTER COLUMN phone_number DROP NOT NULL;
  END IF;

  -- 3. Ensure profiles.phone permits NULL
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL;
  END IF;

  -- 4. Clean up any existing synthetic +1999 numbers in organizations.owner_phone
  UPDATE organizations
  SET owner_phone = NULL
  WHERE owner_phone LIKE '+1999%' 
     OR owner_phone LIKE '1999%'
     OR owner_phone LIKE '+1999________';

  -- 5. Clean up any existing synthetic +1999 numbers in organizations.phone_number (if column exists)
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'phone_number'
  ) THEN
    UPDATE organizations
    SET phone_number = NULL
    WHERE phone_number LIKE '+1999%' 
       OR phone_number LIKE '1999%'
       OR phone_number LIKE '+1999________';
  END IF;

  -- 6. Clean up any existing synthetic +1999 numbers in profiles.phone
  UPDATE profiles
  SET phone = NULL
  WHERE phone LIKE '+1999%' 
     OR phone LIKE '1999%'
     OR phone LIKE '+1999________';

END $$;
