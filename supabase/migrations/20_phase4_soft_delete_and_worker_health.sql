-- =============================================================================
-- Migration 20: Phase 4 Data Integrity, Soft Delete, Timezones & Reactivation
-- =============================================================================

-- 1. Soft Delete Support on Core Domain Entities
-- Allows non-destructive deletion while preserving financial, messaging, and customer history.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- 2. Partial Indexes for High-Performance Active Record Filtering
CREATE INDEX IF NOT EXISTS idx_contacts_org_active ON contacts(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_org_active ON quotes(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_org_active ON invoices(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_org_active ON jobs(org_id) WHERE deleted_at IS NULL;

-- 3. Customer Reactivation Settings on Organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS reactivation_cooldown_days INT DEFAULT 30;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS reactivation_template TEXT DEFAULT 'Hi {customer_name}, it''s been a little while since your last service with {business_name}. Would you like us to schedule your next visit? You can book online anytime: {booking_url}';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS reactivation_quiet_hours BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS reactivation_max_daily INT DEFAULT 50;

-- 4. Automation Runs Observability & Provider Tracking Index
CREATE INDEX IF NOT EXISTS idx_automation_runs_health_check 
  ON automation_runs(status, scheduled_at) 
  WHERE status IN ('pending', 'scheduled');

CREATE INDEX IF NOT EXISTS idx_automation_runs_stale_locks 
  ON automation_runs(status, locked_at) 
  WHERE status IN ('processing', 'running');
