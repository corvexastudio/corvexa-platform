-- ==============================================================================
-- PHASE 5: QUOTES + JOB MANAGEMENT SPECIALIST MIGRATION
-- Adds quotes, quote_items, jobs, and job_items tables with RLS and indexes.
-- Idempotent and safe for pre-existing tables.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. QUOTES TABLE
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    quote_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    tax NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'draft',
    expires_at TIMESTAMPTZ,
    manage_token TEXT,
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    decline_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS quote_number TEXT DEFAULT 'Q-1001';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Quote';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tax NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS manage_token TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS decline_reason TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill manage_token for existing quotes
UPDATE quotes 
SET manage_token = md5(random()::text || clock_timestamp()::text || id::text) || md5(random()::text || clock_timestamp()::text) 
WHERE manage_token IS NULL;

-- Set default and NOT NULL constraint after backfill
ALTER TABLE quotes ALTER COLUMN manage_token SET DEFAULT md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text);
ALTER TABLE quotes ALTER COLUMN manage_token SET NOT NULL;

-- Safely add unique constraint on quotes(manage_token)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname IN ('quotes_manage_token_key', 'quotes_manage_token_unique')
    ) THEN
        ALTER TABLE quotes ADD CONSTRAINT quotes_manage_token_unique UNIQUE (manage_token);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 2. QUOTE ITEMS TABLE
CREATE TABLE IF NOT EXISTS quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1.00,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing quote_items table
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2) DEFAULT 1.00;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3. JOBS TABLE
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    job_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'en_route', 'in_progress', 'completed', 'cancelled', 'no_show')),
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ,
    en_route_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_number TEXT DEFAULT 'J-1001';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Job';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ DEFAULT now();
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS en_route_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 4. JOB ITEMS TABLE
CREATE TABLE IF NOT EXISTS job_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1.00,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing job_items table
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE CASCADE;
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2) DEFAULT 1.00;
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_quotes_org_status ON quotes(org_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_manage_token ON quotes(manage_token);
CREATE INDEX IF NOT EXISTS idx_quotes_contact ON quotes(contact_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org_status ON jobs(org_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_org_scheduled ON jobs(org_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_jobs_contact ON jobs(contact_id);
CREATE INDEX IF NOT EXISTS idx_jobs_quote ON jobs(quote_id);
CREATE INDEX IF NOT EXISTS idx_job_items_job ON job_items(job_id);

-- 6. ROW LEVEL SECURITY
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_items ENABLE ROW LEVEL SECURITY;

-- Tenant access policies for quotes and quote items
DROP POLICY IF EXISTS "Members can manage their organization quotes" ON quotes;
CREATE POLICY "Members can manage their organization quotes"
ON quotes FOR ALL
USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Members can manage their organization quote items" ON quote_items;
CREATE POLICY "Members can manage their organization quote items"
ON quote_items FOR ALL
USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Tenant access policies for jobs and job items
DROP POLICY IF EXISTS "Members can manage their organization jobs" ON jobs;
CREATE POLICY "Members can manage their organization jobs"
ON jobs FOR ALL
USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Members can manage their organization job items" ON job_items;
CREATE POLICY "Members can manage their organization job items"
ON job_items FOR ALL
USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));
