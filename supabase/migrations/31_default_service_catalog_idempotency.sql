-- ==============================================================================
-- CAPTODESK MIGRATION 31: DEFAULT SERVICE CATALOG CONCURRENCY & IDEMPOTENCY
-- Enforces per-organization active service uniqueness, safe non-destructive
-- duplicate reconciliation, and referential integrity protection.
-- ==============================================================================

DO $$
DECLARE
  has_apt_svc BOOLEAN := false;
  has_jobs_svc BOOLEAN := false;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'services'
  ) THEN

    -- Check whether appointments and jobs tables have service_id column
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'service_id'
    ) INTO has_apt_svc;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'service_id'
    ) INTO has_jobs_svc;

    -- 1. Safely reconcile any pre-existing duplicate ACTIVE services WITHOUT deleting data.
    -- Redundant duplicate active services are deactivated (is_active = false) to preserve
    -- all historical references, audit trails, and foreign keys.
    -- Dynamic query handles environments where appointments/jobs may or may not have service_id.
    EXECUTE format($query$
      WITH ranked_active_services AS (
        SELECT 
          s.id,
          s.org_id,
          s.name,
          ROW_NUMBER() OVER (
            PARTITION BY s.org_id, lower(trim(s.name))
            ORDER BY 
              (
                %s + %s
              ) DESC,
              s.updated_at DESC,
              s.created_at DESC,
              s.id DESC
          ) as rnum
        FROM public.services s
        WHERE s.is_active = true
      )
      UPDATE public.services
      SET is_active = false,
          updated_at = now()
      WHERE id IN (
        SELECT id FROM ranked_active_services WHERE rnum > 1
      );
    $query$,
      CASE WHEN has_apt_svc THEN 'COALESCE((SELECT COUNT(*) FROM public.appointments a WHERE a.service_id = s.id), 0)' ELSE '0' END,
      CASE WHEN has_jobs_svc THEN 'COALESCE((SELECT COUNT(*) FROM public.jobs j WHERE j.service_id = s.id), 0)' ELSE '0' END
    );

    -- 2. Drop obsolete global unique constraint on (org_id, name) if it exists,
    -- allowing historical/inactive records to coexist without constraint violations.
    IF EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'uq_services_org_id_name'
    ) THEN
      ALTER TABLE public.services DROP CONSTRAINT uq_services_org_id_name;
    END IF;

    -- 3. Enforce active service uniqueness per organization (case-insensitive & trimmed)
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE indexname = 'uq_services_org_id_active_name'
    ) THEN
      CREATE UNIQUE INDEX uq_services_org_id_active_name 
      ON public.services(org_id, lower(trim(name))) 
      WHERE is_active = true;
    END IF;

    -- 4. Ensure composite index for fast tenant active service lookups
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_org_active_sort'
    ) THEN
      CREATE INDEX idx_services_org_active_sort ON public.services(org_id, is_active, sort_order);
    END IF;

    -- 5. Upgrade foreign key constraints to ON DELETE RESTRICT
    -- Prevents historical references from being silently set to NULL or deleted
    IF has_apt_svc THEN
      ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_service_id_fkey;
      ALTER TABLE public.appointments ADD CONSTRAINT appointments_service_id_fkey
        FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;
    END IF;

    IF has_jobs_svc THEN
      ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_service_id_fkey;
      ALTER TABLE public.jobs ADD CONSTRAINT jobs_service_id_fkey
        FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;
    END IF;

  END IF;
END $$;
