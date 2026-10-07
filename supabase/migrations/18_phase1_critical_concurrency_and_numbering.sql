-- ==============================================================================
-- CAPTODESK MIGRATION 18: PHASE 1 CRITICAL PRODUCTION BLOCKERS & CONCURRENCY
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ATOMIC DOCUMENT NUMBER SEQUENCES (QUOTES, INVOICES, JOBS)
-- Prevents modulo timestamp wrap-around and guarantees per-tenant sequential IDs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('quote', 'invoice', 'job')),
    year INT NOT NULL,
    next_value INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, document_type, year)
);

CREATE INDEX IF NOT EXISTS idx_document_counters_org_type_year 
    ON document_counters(org_id, document_type, year);

ALTER TABLE document_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for document_counters" ON document_counters;
CREATE POLICY "Tenant isolation for document_counters" ON document_counters FOR ALL TO authenticated
USING (org_id = auth_user_org_id() OR auth_is_super_admin())
WITH CHECK (org_id = auth_user_org_id() OR auth_is_super_admin());

-- Atomic sequence generator function
CREATE OR REPLACE FUNCTION next_document_number(
    p_org_id UUID,
    p_doc_type TEXT,
    p_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_val INT;
BEGIN
    INSERT INTO document_counters (org_id, document_type, year, next_value, updated_at)
    VALUES (p_org_id, p_doc_type, p_year, 2, NOW())
    ON CONFLICT (org_id, document_type, year)
    DO UPDATE SET 
        next_value = document_counters.next_value + 1,
        updated_at = NOW()
    RETURNING (document_counters.next_value - 1) INTO v_val;
    
    RETURN v_val;
END;
$$;

-- Enforce per-organization uniqueness on newly generated document numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_org_quote_number 
    ON quotes(org_id, quote_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_org_invoice_number 
    ON invoices(org_id, invoice_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_org_job_number 
    ON jobs(org_id, job_number);


-- ------------------------------------------------------------------------------
-- 2. AUTOMATION WORKER ATOMIC ROW CLAIMING & CONCURRENCY LOCKING
-- Eliminates double-processing and race conditions via SELECT FOR UPDATE SKIP LOCKED
-- ------------------------------------------------------------------------------
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS locked_by TEXT;

-- Update status constraint to explicitly support 'processing'
ALTER TABLE automation_runs DROP CONSTRAINT IF EXISTS automation_runs_status_check;
ALTER TABLE automation_runs ADD CONSTRAINT automation_runs_status_check
  CHECK (status IN ('pending', 'scheduled', 'processing', 'running', 'success', 'failed', 'cancelled', 'dead_letter'));

CREATE INDEX IF NOT EXISTS idx_automation_runs_locked_at ON automation_runs(locked_at) 
  WHERE status IN ('processing', 'running');

CREATE INDEX IF NOT EXISTS idx_automation_runs_status_scheduled_active ON automation_runs(status, scheduled_at) 
  WHERE status IN ('pending', 'scheduled', 'processing');

-- Atomic claiming RPC function
CREATE OR REPLACE FUNCTION claim_due_automation_runs(
    p_worker_id TEXT,
    p_batch_size INT DEFAULT 25,
    p_stale_threshold_seconds INT DEFAULT 600
)
RETURNS SETOF automation_runs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stale_limit TIMESTAMPTZ := NOW() - (p_stale_threshold_seconds || ' seconds')::INTERVAL;
BEGIN
    RETURN QUERY
    WITH eligible AS (
        SELECT id
        FROM automation_runs
        WHERE 
            (
                status IN ('pending', 'scheduled') 
                AND scheduled_at <= NOW()
            )
            OR
            (
                status IN ('processing', 'running')
                AND locked_at IS NOT NULL
                AND locked_at < v_stale_limit
                AND retry_count < max_retries
            )
        ORDER BY scheduled_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_batch_size
    )
    UPDATE automation_runs r
    SET 
        status = 'processing',
        locked_at = NOW(),
        locked_by = p_worker_id,
        started_at = COALESCE(r.started_at, NOW())
    FROM eligible
    WHERE r.id = eligible.id
    RETURNING r.*;
END;
$$;


-- ------------------------------------------------------------------------------
-- 3. MULTI-TENANT TELNYX PHONE NUMBER ISOLATION & PROVISIONING
-- Guarantees a phone number belongs to exactly one tenant; allows NULL for pending
-- ------------------------------------------------------------------------------
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS phone_provisioning_status TEXT 
    DEFAULT 'active' CHECK (phone_provisioning_status IN ('pending_number', 'provisioning', 'active', 'failed'));

-- Add partial unique index on non-null active telnyx phone numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_active_telnyx_phone 
    ON organizations(telnyx_phone_number) 
    WHERE telnyx_phone_number IS NOT NULL AND telnyx_phone_number != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_telnyx_phone_numbers_active_phone 
    ON telnyx_phone_numbers(phone_number) 
    WHERE status = 'active';
