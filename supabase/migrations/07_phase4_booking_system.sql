-- ==============================================================================
-- PHASE 4: BOOKING + AVAILABILITY SPECIALIST MIGRATION
-- Adds services catalog, booking configuration, tokenized customer management,
-- and appointment status workflow.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. SERVICES CATALOG TABLE
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

-- 2. EXTEND ORGANIZATIONS FOR BOOKING & AVAILABILITY CONFIGURATION
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS booking_mode TEXT DEFAULT 'instant' CHECK (booking_mode IN ('instant', 'request'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_duration_minutes INT DEFAULT 60;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS buffer_minutes INT DEFAULT 15;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS minimum_notice_hours INT DEFAULT 2;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_booking_days_ahead INT DEFAULT 30;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS blocked_dates TEXT[] DEFAULT '{}';

-- 3. EXTEND APPOINTMENTS TABLE FOR BOOKING LIFECYCLE & TOKENIZED ACCESS
-- Ensure base appointments table exists
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

-- Safely drop existing check constraint if any and re-add updated statuses
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

-- Backfill manage_token for existing appointments that may have NULL
UPDATE appointments 
SET manage_token = md5(random()::text || clock_timestamp()::text || id::text) || md5(random()::text || clock_timestamp()::text) 
WHERE manage_token IS NULL;

-- Set default and NOT NULL constraint after backfill
ALTER TABLE appointments ALTER COLUMN manage_token SET DEFAULT md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text);
ALTER TABLE appointments ALTER COLUMN manage_token SET NOT NULL;

-- Safely add unique constraint on manage_token
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

-- 4. PERFORMANCE & CONCURRENCY INDEXES
CREATE INDEX IF NOT EXISTS idx_services_org ON services(org_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_appointments_org_time ON appointments(org_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_appointments_manage_token ON appointments(manage_token);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(org_id, status);

-- 5. ROW LEVEL SECURITY FOR SERVICES
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Allow public read of active services for customer booking page
DROP POLICY IF EXISTS "Public can view active services" ON services;
CREATE POLICY "Public can view active services"
ON services FOR SELECT
USING (is_active = true);

-- Allow organization members full CRUD on their own services
DROP POLICY IF EXISTS "Members can manage their organization services" ON services;
CREATE POLICY "Members can manage their organization services"
ON services FOR ALL
USING (
    org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
    )
)
WITH CHECK (
    org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
    )
);
