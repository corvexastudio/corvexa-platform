-- Migration 59: Add organization logo_url for customized invoices, booking pages, and live dispatch
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Ensure storage bucket 'organization-logos' exists if storage schema is present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'organization-logos',
        'organization-logos',
        true,
        5242880, -- 5MB limit
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']
      )
      ON CONFLICT (id) DO UPDATE SET public = true;
    END IF;

    -- Public read policy for organization logos on customer-facing invoices and booking pages
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
      DROP POLICY IF EXISTS "Public can view organization logos" ON storage.objects;
      CREATE POLICY "Public can view organization logos"
        ON storage.objects FOR SELECT TO anon, authenticated
        USING (bucket_id = 'organization-logos');

      DROP POLICY IF EXISTS "Authenticated users can upload organization logos" ON storage.objects;
      CREATE POLICY "Authenticated users can upload organization logos"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'organization-logos');

      DROP POLICY IF EXISTS "Authenticated users can update organization logos" ON storage.objects;
      CREATE POLICY "Authenticated users can update organization logos"
        ON storage.objects FOR UPDATE TO authenticated
        USING (bucket_id = 'organization-logos');

      DROP POLICY IF EXISTS "Authenticated users can delete organization logos" ON storage.objects;
      CREATE POLICY "Authenticated users can delete organization logos"
        ON storage.objects FOR DELETE TO authenticated
        USING (bucket_id = 'organization-logos');
    END IF;
  END IF;
END $$;
