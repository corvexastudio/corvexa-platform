-- Migration 45: Phase 4 Multi-Crew Fleet, Crew Dispatch, and Field Time Tracking

-- 1. Create crews table
CREATE TABLE IF NOT EXISTS crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color_code TEXT NOT NULL DEFAULT '#3B82F6',
  phone_number TEXT,
  service_area TEXT,
  crew_lead_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  member_ids UUID[] DEFAULT ARRAY[]::UUID[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crews_org_active ON crews(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_crews_crew_lead ON crews(crew_lead_id);

-- Enable RLS on crews
ALTER TABLE crews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view crews"
  ON crews
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant users can insert crews"
  ON crews
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant users can update crews"
  ON crews
  FOR UPDATE
  TO authenticated
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant users can delete crews"
  ON crews
  FOR DELETE
  TO authenticated
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- 2. Add crew_id and time tracking timestamps to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS crew_id UUID REFERENCES crews(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_crew_id ON jobs(crew_id);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_start_crew ON jobs(scheduled_start, crew_id);

-- 3. Add crew_id to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS crew_id UUID REFERENCES crews(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_crew_id ON appointments(crew_id);

-- 4. Add daily crew schedule broadcast configuration to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS daily_crew_schedule_enabled BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS daily_crew_schedule_hour INT DEFAULT 7;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS last_daily_crew_schedule_sent_at TIMESTAMPTZ;
