-- =============================================================================
-- CAPTODESK MIGRATION 17: PHASE 14 COMPLIANCE + MESSAGING SAFETY
-- Strict carrier opt-out, suppression lists, consent tracking & audit logging
-- =============================================================================

-- 1. COMPLIANCE SUPPRESSION LIST
-- Real-time carrier blocklist preventing any outbound transmission to opted-out numbers
CREATE TABLE IF NOT EXISTS compliance_suppression_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT 'stop_keyword',
    source TEXT NOT NULL DEFAULT 'inbound_sms',
    keyword TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique index to prevent duplicates per org and phone
CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_suppression_org_phone 
ON compliance_suppression_list(org_id, phone);

CREATE INDEX IF NOT EXISTS idx_compliance_suppression_phone 
ON compliance_suppression_list(phone);

-- 2. COMPLIANCE CONSENT RECORDS
-- Proof of consumer consent for transactional and marketing communications
CREATE TABLE IF NOT EXISTS compliance_consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    consent_type TEXT NOT NULL DEFAULT 'transactional', -- 'transactional' | 'marketing' | 'express_written'
    status TEXT NOT NULL DEFAULT 'granted',             -- 'granted' | 'revoked'
    source TEXT NOT NULL DEFAULT 'booking_form',        -- 'booking_form' | 'inbound_keyword' | 'quote_request' | 'verbal' | 'manual'
    proof_text TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_compliance_consent_org_phone 
ON compliance_consent_records(org_id, phone);

CREATE INDEX IF NOT EXISTS idx_compliance_consent_contact 
ON compliance_consent_records(contact_id);

-- 3. COMPLIANCE AUDIT LOGS
-- Immutable log of compliance state transitions, verifications, and suppressions
CREATE TABLE IF NOT EXISTS compliance_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    action TEXT NOT NULL,               -- 'opt_out' | 'opt_in' | 'help_requested' | 'message_sent' | 'message_suppressed'
    message_type TEXT,                  -- 'transactional' | 'marketing'
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_org_created 
ON compliance_audit_logs(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_phone 
ON compliance_audit_logs(phone);

-- 4. CONTACTS TABLE EXTENSIONS
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_channel TEXT DEFAULT 'sms';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS transactional_opt_in BOOLEAN DEFAULT true;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_out_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_in_at TIMESTAMPTZ;

-- 5. ORGANIZATIONS TABLE EXTENSIONS
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS business_name_prefix TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_daily_sms_per_recipient INT DEFAULT 3;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enforce_quiet_hours BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS quiet_hours_start TEXT DEFAULT '20:00';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS quiet_hours_end TEXT DEFAULT '08:00';

-- 6. RLS POLICIES FOR COMPLIANCE TABLES
ALTER TABLE compliance_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'compliance_suppression_list' AND policyname = 'org_isolation_suppression'
    ) THEN
        CREATE POLICY org_isolation_suppression ON compliance_suppression_list
        FOR ALL USING (
            org_id IN (
                SELECT org_id FROM profiles WHERE id = auth.uid()
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'compliance_consent_records' AND policyname = 'org_isolation_consent'
    ) THEN
        CREATE POLICY org_isolation_consent ON compliance_consent_records
        FOR ALL USING (
            org_id IN (
                SELECT org_id FROM profiles WHERE id = auth.uid()
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'compliance_audit_logs' AND policyname = 'org_isolation_audit'
    ) THEN
        CREATE POLICY org_isolation_audit ON compliance_audit_logs
        FOR ALL USING (
            org_id IN (
                SELECT org_id FROM profiles WHERE id = auth.uid()
            )
        );
    END IF;
END $$;
