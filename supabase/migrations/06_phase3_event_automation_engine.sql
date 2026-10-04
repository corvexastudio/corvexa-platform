-- ==============================================================================
-- CAPTODESK MIGRATION 06: PHASE 3 EVENT-DRIVEN AUTOMATION ENGINE
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

-- 1. ENHANCE AUTOMATION_RULES TABLE
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS stop_conditions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS delay_seconds INT NOT NULL DEFAULT 0;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' 
  CHECK (status IN ('active', 'paused', 'archived'));

-- Remove legacy trigger_type check constraint so all typed domain events are accepted
ALTER TABLE automation_rules DROP CONSTRAINT IF EXISTS automation_rules_trigger_type_check;

-- 2. ENHANCE AUTOMATION_RUNS TABLE (JOB QUEUE & AUDIT STORE)
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS job_id TEXT UNIQUE;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS event_payload JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT 'unspecified';
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS action_params JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS max_retries INT NOT NULL DEFAULT 3;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Update automation_runs status constraint to include full queue lifecycle
ALTER TABLE automation_runs DROP CONSTRAINT IF EXISTS automation_runs_status_check;
ALTER TABLE automation_runs ADD CONSTRAINT automation_runs_status_check
  CHECK (status IN ('pending', 'scheduled', 'running', 'success', 'failed', 'cancelled', 'dead_letter'));

-- 3. PERFORMANCE INDEXES FOR QUEUE PROCESSING & OBSERVABILITY
CREATE INDEX IF NOT EXISTS idx_automation_runs_queue ON automation_runs(status, scheduled_at) 
  WHERE status IN ('pending', 'scheduled');
CREATE INDEX IF NOT EXISTS idx_automation_runs_org ON automation_runs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_rule ON automation_runs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_idempotency ON automation_runs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_automation_rules_org_trigger ON automation_rules(org_id, trigger_type, status);
