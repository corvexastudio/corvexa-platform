-- ==============================================================================
-- PHASE 7: REVIEWS + CUSTOMER RETENTION MIGRATION (IDEMPOTENT & REPAIR SAFE)
-- ==============================================================================

-- 1. Extend organizations with review & retention preferences
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS review_requests_enabled BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS review_delay_hours INT DEFAULT 24;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS review_cooldown_days INT DEFAULT 60;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS reactivation_enabled BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_reactivation_interval_days INT DEFAULT 90;

-- 2. Extend contacts with customer lifecycle tracking
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_service_date TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS service_frequency_days INT DEFAULT 90;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_expected_service_date TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'active';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_reactivation_sent_at TIMESTAMPTZ;

-- 3. Create review_requests table if it doesn't already exist
CREATE TABLE IF NOT EXISTS review_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Ensure ALL required Phase 7 columns exist on pre-existing review_requests table
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS token TEXT DEFAULT encode(gen_random_bytes(16), 'hex');
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS google_review_url TEXT DEFAULT '';
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS click_count INT DEFAULT 0;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS suppression_reason TEXT;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure all rows have a token populated
UPDATE review_requests SET token = encode(gen_random_bytes(16), 'hex') WHERE token IS NULL;

-- Ensure unique constraint on token if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'review_requests_token_key'
    ) THEN
        ALTER TABLE review_requests ADD CONSTRAINT review_requests_token_key UNIQUE (token);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 5. Indexes for fast tenant lookups and click tracking
CREATE INDEX IF NOT EXISTS idx_review_requests_org_id ON review_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_contact_id ON review_requests(contact_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_status ON review_requests(org_id, status);
CREATE INDEX IF NOT EXISTS idx_review_requests_token ON review_requests(token);
CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle ON contacts(org_id, lifecycle_status);

-- 6. Row Level Security (RLS)
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Tenant review_requests access" ON review_requests;
    DROP POLICY IF EXISTS "Public token click redirect access" ON review_requests;
    DROP POLICY IF EXISTS "Public token click counter update" ON review_requests;
END $$;

CREATE POLICY "Tenant review_requests access"
    ON review_requests
    FOR ALL
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

CREATE POLICY "Public token click redirect access"
    ON review_requests
    FOR SELECT
    USING (token IS NOT NULL);

CREATE POLICY "Public token click counter update"
    ON review_requests
    FOR UPDATE
    USING (token IS NOT NULL)
    WITH CHECK (token IS NOT NULL);
