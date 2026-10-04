-- ==============================================================================
-- PHASE 10: ADMIN / PLATFORM OPERATIONS SPECIALIST MIGRATION
-- Self-healing schema: ensures activity_logs, messages, and automation_runs
-- columns exist before indexing, and expands organization subscription statuses.
-- ==============================================================================

-- 1. Ensure all columns exist on activity_logs (handles legacy table schemas)
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- If legacy "type" column exists on activity_logs, copy it to event_type
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'activity_logs' AND column_name = 'type'
    ) THEN
        UPDATE activity_logs SET event_type = type WHERE event_type IS NULL;
    END IF;
END $$;

-- Backfill default event_type if any rows are null
UPDATE activity_logs SET event_type = 'system.event' WHERE event_type IS NULL;
UPDATE activity_logs SET description = 'System Activity' WHERE description IS NULL;

-- 2. Ensure messages columns exist (handles delivery_status vs status schemas)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'queued';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'status'
    ) THEN
        UPDATE messages SET delivery_status = status WHERE delivery_status IS NULL;
    END IF;
END $$;

-- 3. Ensure automation_runs columns exist (handles scheduled_at vs scheduled_for schemas)
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'automation_runs' AND column_name = 'scheduled_for'
    ) THEN
        UPDATE automation_runs SET scheduled_at = scheduled_for WHERE scheduled_at IS NULL;
    END IF;
END $$;

-- 4. Expand subscription_status check constraint to support suspended and churned
DO $$
BEGIN
    ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_subscription_status_check;
    ALTER TABLE organizations ADD CONSTRAINT organizations_subscription_status_check 
        CHECK (subscription_status IN ('trial', 'active', 'past_due', 'suspended', 'canceled', 'churned'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 5. Safe composite performance indexes for admin platform monitoring
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'activity_logs' AND column_name = 'event_type'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_activity_logs_created_event ON activity_logs(created_at, event_type);
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'delivery_status'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_messages_created_delivery_status ON messages(created_at, delivery_status);
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'automation_runs' AND column_name = 'scheduled_at'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_automation_runs_status_scheduled ON automation_runs(status, scheduled_at);
    END IF;
END $$;
