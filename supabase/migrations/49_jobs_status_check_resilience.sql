-- ==============================================================================
-- CAPTODESK MIGRATION 49: STATUS CONSTRAINTS RESILIENCE
-- Fixes "violates check constraint jobs_status_check" and status update failures across:
-- 1. jobs: permits 'draft', 'scheduled', 'confirmed', 'en_route', 'in_progress', 'completed', 'cancelled', 'no_show'
-- 2. quotes: permits 'draft', 'sent', 'viewed', 'accepted', 'declined', 'expired'
-- 3. invoices: permits 'draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'void', 'cancelled'
-- 4. leads: permits 'new', 'contacted', 'qualified', 'booked', 'won', 'lost', 'archived'
-- ==============================================================================

DO $$
BEGIN
    -- 1. Upgrade public.jobs status check constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'jobs'
    ) THEN
        ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
        ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check 
            CHECK (status IN ('draft', 'scheduled', 'confirmed', 'en_route', 'in_progress', 'completed', 'cancelled', 'no_show'));

        -- Ensure field-ops and dispatch tracking columns exist
        ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS en_route_at TIMESTAMPTZ;
        ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS technician_name TEXT;
        ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS eta_minutes INT;
        ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS tracking_token TEXT;
    END IF;

    -- 2. Upgrade public.quotes status check constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'quotes'
    ) THEN
        ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
        ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check 
            CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired'));
        ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
    END IF;

    -- 3. Upgrade public.invoices status check constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'invoices'
    ) THEN
        ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
        ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check 
            CHECK (status IN ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'void', 'cancelled'));
    END IF;

    -- 4. Upgrade public.leads status check constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'leads'
    ) THEN
        ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
        ALTER TABLE public.leads ADD CONSTRAINT leads_status_check 
            CHECK (status IN ('new', 'contacted', 'qualified', 'booked', 'won', 'lost', 'archived'));
    END IF;
END $$;
