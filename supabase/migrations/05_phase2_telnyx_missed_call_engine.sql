-- ==============================================================================
-- CAPTODESK MIGRATION 05: PHASE 2 TELNYX & MISSED-CALL RECOVERY ENGINE
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

-- 1. ORGANIZATIONS: Add busy_template
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS busy_template TEXT 
  DEFAULT 'Hey, this is {business_name}! We are currently on the other line with a client. How can we help you?';

-- 2. TELNYX_PHONE_NUMBERS: Dedicated organization-to-number mapping table
CREATE TABLE IF NOT EXISTS telnyx_phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phone_number TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'released', 'suspended')),
    capabilities TEXT[] DEFAULT '{"voice", "sms"}',
    messaging_profile_id TEXT,
    connection_id TEXT,
    provisioning_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    released_at TIMESTAMPTZ
);

-- Backfill pre-existing numbers from organizations into telnyx_phone_numbers
INSERT INTO telnyx_phone_numbers (org_id, phone_number, status, capabilities)
SELECT id, telnyx_phone_number, 'active', '{"voice", "sms"}'
FROM organizations
WHERE telnyx_phone_number IS NOT NULL AND telnyx_phone_number != ''
ON CONFLICT (phone_number) DO NOTHING;

-- Index for fast lookup by phone number
CREATE INDEX IF NOT EXISTS idx_telnyx_phone_numbers_phone ON telnyx_phone_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_telnyx_phone_numbers_org ON telnyx_phone_numbers(org_id);

-- Enable RLS for telnyx_phone_numbers
ALTER TABLE telnyx_phone_numbers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for telnyx_phone_numbers" ON telnyx_phone_numbers;
CREATE POLICY "Tenant isolation for telnyx_phone_numbers" ON telnyx_phone_numbers FOR ALL TO authenticated
USING (org_id = auth_user_org_id() OR auth_is_super_admin())
WITH CHECK (org_id = auth_user_org_id() OR auth_is_super_admin());

-- 3. CALLS TABLE ENHANCEMENTS: Telemetry and state machine support
ALTER TABLE calls ADD COLUMN IF NOT EXISTS call_session_id TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS call_leg_id TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS hangup_cause TEXT;

-- Update calls status check constraint to support full call state machine
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_status_check;
ALTER TABLE calls ADD CONSTRAINT calls_status_check 
  CHECK (status IN ('initiated', 'ringing', 'answered', 'bridged', 'completed', 'missed', 'busy', 'no_answer', 'failed'));

-- 4. MESSAGES TABLE ENHANCEMENTS: Automation tracking & delivery callback support
ALTER TABLE messages ADD COLUMN IF NOT EXISTS automation_source TEXT DEFAULT 'manual';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Update messages delivery_status check constraint to support full delivery lifecycle
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_delivery_status_check;
ALTER TABLE messages ADD CONSTRAINT messages_delivery_status_check 
  CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'failed', 'received', 'undelivered'));

CREATE INDEX IF NOT EXISTS idx_messages_telnyx_id ON messages(telnyx_message_id);
