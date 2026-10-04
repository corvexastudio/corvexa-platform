-- ==============================================================================
-- CAPTODESK: COMPLETE CONSOLIDATED MIGRATION (PHASE 4 & PHASE 5)
-- Run this directly in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vlztovqaummczupslymr/sql/new
-- Idempotent, safe for pre-existing tables, and handles missing columns.
-- ==============================================================================

-- 1. Enable pgcrypto if possible (fallback md5 generator works either way)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. SERVICES CATALOG TABLE & BOOKING CONFIGURATION
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    price NUMERIC(10,2),
    requires_address BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Service';
ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 60;
ALTER TABLE services ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
ALTER TABLE services ADD COLUMN IF NOT EXISTS requires_address BOOLEAN DEFAULT true;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE services ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE services ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Extend organizations for booking & availability configuration
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS booking_mode TEXT DEFAULT 'instant';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_duration_minutes INT DEFAULT 60;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS buffer_minutes INT DEFAULT 15;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS minimum_notice_hours INT DEFAULT 2;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_booking_days_ahead INT DEFAULT 30;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS blocked_dates TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_services_org ON services(org_id, is_active, sort_order);

-- 3. REPAIR APPOINTMENTS TABLE (TOKENIZED ACCESS & BOOKING LIFECYCLE)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    service_type TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    status TEXT DEFAULT 'scheduled',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Safely update status constraint
DO $$
BEGIN
    ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
    ALTER TABLE appointments ADD CONSTRAINT appointments_status_check 
        CHECK (status IN ('requested', 'confirmed', 'cancelled', 'completed', 'no_show', 'scheduled'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'booking_page';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS manage_token TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_2h_sent_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes TEXT;

-- Backfill manage_token for existing appointments
UPDATE appointments 
SET manage_token = md5(random()::text || clock_timestamp()::text || id::text) || md5(random()::text || clock_timestamp()::text) 
WHERE manage_token IS NULL;

ALTER TABLE appointments ALTER COLUMN manage_token SET DEFAULT md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text);
ALTER TABLE appointments ALTER COLUMN manage_token SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname IN ('appointments_manage_token_key', 'appointments_manage_token_unique')
    ) THEN
        ALTER TABLE appointments ADD CONSTRAINT appointments_manage_token_unique UNIQUE (manage_token);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_org_time ON appointments(org_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_appointments_manage_token ON appointments(manage_token);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(org_id, status);

-- 4. REPAIR QUOTES TABLE
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    quote_number TEXT NOT NULL DEFAULT 'Q-1001',
    title TEXT NOT NULL DEFAULT 'Quote',
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

UPDATE quotes 
SET manage_token = md5(random()::text || clock_timestamp()::text || id::text) || md5(random()::text || clock_timestamp()::text) 
WHERE manage_token IS NULL;

ALTER TABLE quotes ALTER COLUMN manage_token SET DEFAULT md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text);
ALTER TABLE quotes ALTER COLUMN manage_token SET NOT NULL;

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

CREATE INDEX IF NOT EXISTS idx_quotes_org_status ON quotes(org_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_manage_token ON quotes(manage_token);
CREATE INDEX IF NOT EXISTS idx_quotes_contact ON quotes(contact_id);

-- 5. REPAIR QUOTE ITEMS TABLE
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

ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2) DEFAULT 1.00;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);

-- 6. REPAIR JOBS TABLE
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    job_number TEXT NOT NULL DEFAULT 'J-1001',
    title TEXT NOT NULL DEFAULT 'Job',
    description TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled',
    scheduled_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    scheduled_end TIMESTAMPTZ,
    en_route_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_jobs_org_status ON jobs(org_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_org_scheduled ON jobs(org_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_jobs_contact ON jobs(contact_id);
CREATE INDEX IF NOT EXISTS idx_jobs_quote ON jobs(quote_id);

-- 7. REPAIR JOB ITEMS TABLE
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

ALTER TABLE job_items ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE CASCADE;
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2) DEFAULT 1.00;
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_job_items_job ON job_items(job_id);

-- 8. ROW LEVEL SECURITY & POLICIES
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_items ENABLE ROW LEVEL SECURITY;

-- Services Policies
DROP POLICY IF EXISTS "Public can view active services" ON services;
CREATE POLICY "Public can view active services" ON services FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Members can manage their organization services" ON services;
CREATE POLICY "Members can manage their organization services" ON services FOR ALL
USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Quotes Policies
DROP POLICY IF EXISTS "Members can manage their organization quotes" ON quotes;
CREATE POLICY "Members can manage their organization quotes" ON quotes FOR ALL
USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Members can manage their organization quote items" ON quote_items;
CREATE POLICY "Members can manage their organization quote items" ON quote_items FOR ALL
USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Jobs Policies
DROP POLICY IF EXISTS "Members can manage their organization jobs" ON jobs;
CREATE POLICY "Members can manage their organization jobs" ON jobs FOR ALL
USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Members can manage their organization job items" ON job_items;
CREATE POLICY "Members can manage their organization job items" ON job_items FOR ALL
USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));