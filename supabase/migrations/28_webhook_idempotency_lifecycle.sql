-- ==============================================================================
-- CAPTODESK MIGRATION 28: WEBHOOK IDEMPOTENCY & RETRY SAFETY LIFECYCLE
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PROCESSED_EVENTS TABLE ENHANCEMENTS
-- Adds lifecycle status ('processing', 'completed', 'failed'), lock timestamps,
-- attempt counters, and error diagnostics for zero-data-loss webhook retries.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.processed_events (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'generic',
    event_type TEXT NOT NULL,
    provider_event_id TEXT,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed')),
    locked_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 1,
    last_error TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist on pre-existing table
ALTER TABLE public.processed_events ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'generic';
ALTER TABLE public.processed_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE public.processed_events ADD COLUMN IF NOT EXISTS provider_event_id TEXT;
ALTER TABLE public.processed_events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed'));
ALTER TABLE public.processed_events ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE public.processed_events ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.processed_events ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 1;
ALTER TABLE public.processed_events ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE public.processed_events ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.processed_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Backfill legacy records to 'completed'
UPDATE public.processed_events SET status = 'completed' WHERE status IS NULL;

-- Index for fast status and lock lookups
CREATE INDEX IF NOT EXISTS idx_processed_events_status_locked 
    ON public.processed_events(status, locked_at);

-- Partial unique index on messages.telnyx_message_id (prevents duplicate messages from semantically duplicate webhooks)
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_org_telnyx_id 
    ON public.messages(org_id, telnyx_message_id) 
    WHERE telnyx_message_id IS NOT NULL;


-- ------------------------------------------------------------------------------
-- 2. ATOMIC WEBHOOK CLAIM FUNCTION (SELECT FOR UPDATE / STALE LOCK RECOVERY)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_webhook_event(
    p_event_id TEXT,
    p_provider TEXT,
    p_event_type TEXT,
    p_stale_timeout_seconds INT DEFAULT 60
)
RETURNS TABLE (
    action TEXT,
    status TEXT,
    attempt_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing RECORD;
    v_stale_limit TIMESTAMPTZ := NOW() - (p_stale_timeout_seconds || ' seconds')::INTERVAL;
BEGIN
    -- 1. Optimistic INSERT for brand new events
    INSERT INTO public.processed_events (
        id,
        provider,
        provider_event_id,
        event_type,
        status,
        locked_at,
        attempt_count,
        created_at
    )
    VALUES (
        p_event_id,
        p_provider,
        p_event_id,
        p_event_type,
        'processing',
        NOW(),
        1,
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    IF FOUND THEN
        RETURN QUERY SELECT 'claimed'::TEXT, 'processing'::TEXT, 1::INT;
        RETURN;
    END IF;

    -- 2. Row exists: Lock row FOR UPDATE to safely evaluate state transition
    SELECT * INTO v_existing
    FROM public.processed_events
    WHERE id = p_event_id
    FOR UPDATE;

    -- Case A: Event previously succeeded -> Duplicate delivery, do NOT re-run
    IF v_existing.status = 'completed' THEN
        RETURN QUERY SELECT 'completed'::TEXT, 'completed'::TEXT, v_existing.attempt_count;
        RETURN;
    END IF;

    -- Case B: Event currently marked 'processing'
    IF v_existing.status = 'processing' THEN
        IF v_existing.locked_at IS NOT NULL AND v_existing.locked_at > v_stale_limit THEN
            -- Currently active in another execution within stale timeout threshold
            RETURN QUERY SELECT 'concurrent_active'::TEXT, 'processing'::TEXT, v_existing.attempt_count;
            RETURN;
        ELSE
            -- Stale lock detected (previous worker crashed or timed out): Reclaim lock
            UPDATE public.processed_events
            SET status = 'processing',
                locked_at = NOW(),
                attempt_count = v_existing.attempt_count + 1,
                last_error = COALESCE(v_existing.last_error, 'Stale lock recovered')
            WHERE id = p_event_id;

            RETURN QUERY SELECT 'reclaimed_stale'::TEXT, 'processing'::TEXT, v_existing.attempt_count + 1;
            RETURN;
        END IF;
    END IF;

    -- Case C: Event previously marked 'failed' -> Reclaim for retry
    UPDATE public.processed_events
    SET status = 'processing',
        locked_at = NOW(),
        attempt_count = v_existing.attempt_count + 1
    WHERE id = p_event_id;

    RETURN QUERY SELECT 'reclaimed_retry'::TEXT, 'processing'::TEXT, v_existing.attempt_count + 1;
    RETURN;
END;
$$;


-- ------------------------------------------------------------------------------
-- 3. ATOMIC WEBHOOK COMPLETION FUNCTION
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_webhook_event(
    p_event_id TEXT,
    p_metadata JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.processed_events
    SET status = 'completed',
        completed_at = NOW(),
        locked_at = NULL,
        last_error = NULL,
        metadata = CASE 
            WHEN p_metadata IS NOT NULL THEN COALESCE(metadata, '{}'::jsonb) || p_metadata 
            ELSE metadata 
        END
    WHERE id = p_event_id;

    RETURN FOUND;
END;
$$;


-- ------------------------------------------------------------------------------
-- 4. ATOMIC WEBHOOK FAILURE FUNCTION
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fail_webhook_event(
    p_event_id TEXT,
    p_error TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.processed_events
    SET status = 'failed',
        locked_at = NULL,
        last_error = p_error
    WHERE id = p_event_id;

    RETURN FOUND;
END;
$$;


-- ------------------------------------------------------------------------------
-- 5. STRICT SECURITY DEFINER ACCESS PERMISSIONS
-- ------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.claim_webhook_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_webhook_event TO service_role, postgres;

REVOKE ALL ON FUNCTION public.complete_webhook_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_webhook_event TO service_role, postgres;

REVOKE ALL ON FUNCTION public.fail_webhook_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_webhook_event TO service_role, postgres;
