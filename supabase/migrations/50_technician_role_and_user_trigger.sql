-- ==============================================================================
-- CAPTODESK MIGRATION 50: TECHNICIAN ROLE AND USER TRIGGER RESILIENCE
-- 1. Permits 'technician' canonical role in profiles_role_check constraint.
-- 2. Upgrades handle_new_user() trigger to recognize invited role and org_id.
-- ==============================================================================

DO $$
BEGIN
    -- 1. Upgrade public.profiles role check constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'profiles'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
            CHECK (role IN ('super_admin', 'owner', 'admin', 'member', 'dispatcher', 'client_admin', 'technician'));
    END IF;
END $$;

-- 2. Upgrade handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, org_id)
  VALUES (
    new.id,
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    COALESCE(new.raw_user_meta_data->>'role', 'owner'),
    CASE 
      WHEN (new.raw_user_meta_data->>'org_id') IS NOT NULL AND (new.raw_user_meta_data->>'org_id') != ''
      THEN (new.raw_user_meta_data->>'org_id')::uuid
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
      org_id = COALESCE(profiles.org_id, EXCLUDED.org_id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
