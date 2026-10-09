-- ==============================================================================
-- CAPTODESK MIGRATION 26: P1 SECURITY REMEDIATION
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
--
-- REMEDIATES VERIFIED P1 RELEASE BLOCKERS:
-- 1. HIGH-05: Distributed Persistent Rate Limiting Table & Atomic Counter RPC
-- 2. HIGH-06: Strict Tenant-Scoped Row Level Security on Services Catalog
-- ==============================================================================

-- ==============================================================================
-- 1. HIGH-05: DISTRIBUTED RATE LIMITING TABLE & ATOMIC SLIDING-WINDOW RPC
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,
    count INT NOT NULL DEFAULT 1,
    reset_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for expiring / querying stale records
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON public.rate_limits (reset_at);

-- RLS: Revoke table access from anon and authenticated clients; only service_role/RPC manages it
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

-- Atomic sliding-window rate limit checker
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_key TEXT,
    p_max INT,
    p_window_seconds INT
)
RETURNS TABLE (
    allowed BOOLEAN,
    remaining INT,
    reset_time BIGINT,
    total_limit INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_reset_at TIMESTAMPTZ;
    v_count INT;
    v_allowed BOOLEAN;
    v_remaining INT;
    v_reset_epoch BIGINT;
BEGIN
    -- Delete stale record if past reset_at
    DELETE FROM public.rate_limits WHERE key = p_key AND reset_at < v_now;

    -- Upsert atomically
    INSERT INTO public.rate_limits (key, count, reset_at)
    VALUES (p_key, 1, v_now + (p_window_seconds || ' seconds')::interval)
    ON CONFLICT (key) DO UPDATE
    SET count = public.rate_limits.count + 1
    RETURNING public.rate_limits.count, public.rate_limits.reset_at INTO v_count, v_reset_at;

    v_reset_epoch := EXTRACT(EPOCH FROM v_reset_at)::BIGINT;
    v_allowed := (v_count <= p_max);
    v_remaining := GREATEST(0, p_max - v_count);

    RETURN QUERY SELECT v_allowed, v_remaining, v_reset_epoch, p_max;
END;
$$;

-- Grant RPC execution strictly to service_role and postgres
REVOKE ALL ON FUNCTION public.check_rate_limit FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO service_role, postgres;

-- ==============================================================================
-- 2. HIGH-06: STRICT SERVICES CATALOG RLS POLICY CONSOLIDATION
-- ==============================================================================

-- Ensure RLS is enabled on services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Revoke all direct anonymous access to services table
REVOKE ALL ON public.services FROM anon;

-- Drop legacy or insecure policies
DROP POLICY IF EXISTS "Public can view active services" ON public.services;
DROP POLICY IF EXISTS "Members can manage their organization services" ON public.services;
DROP POLICY IF EXISTS "Tenant members can view and manage services" ON public.services;

-- Strict tenant-bounded policy for authenticated team members
CREATE POLICY "Tenant members can view and manage services"
ON public.services FOR ALL
TO authenticated
USING (
    org_id = public.auth_user_org_id() 
    OR public.auth_is_super_admin()
)
WITH CHECK (
    org_id = public.auth_user_org_id() 
    OR public.auth_is_super_admin()
);
