-- ==============================================================================
-- PHASE 11: OBSERVABILITY + RELIABILITY SPECIALIST MIGRATION
-- Structured telemetry, webhook idempotency audit, and historical observability snapshots
-- ==============================================================================

-- 1. Ensure activity_logs indexes for high-throughput operational audit tailing
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_created ON activity_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_desc ON activity_logs(created_at DESC);

-- 2. Ensure processed_events idempotency store is hardened
CREATE TABLE IF NOT EXISTS processed_events (
    id TEXT PRIMARY KEY,
    provider TEXT DEFAULT 'telnyx',
    event_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'telnyx';
ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_processed_events_provider_created ON processed_events(provider, created_at DESC);

-- 3. Telemetry snapshots table for historical platform health trend analysis
CREATE TABLE IF NOT EXISTS telemetry_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_type TEXT NOT NULL DEFAULT 'hourly',
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    active_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_snapshots_created ON telemetry_snapshots(created_at DESC);
