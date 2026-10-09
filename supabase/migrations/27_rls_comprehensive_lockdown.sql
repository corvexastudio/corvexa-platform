-- ==============================================================================
-- CAPTODESK MIGRATION 27: COMPREHENSIVE RLS ENFORCEMENT & POLICY HARDENING
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
--
-- AUDIT REMEDIATION:
-- 1. Safely & conditionally ENABLES Row Level Security (RLS) across all existing tables.
-- 2. Closes missing tenant isolation policy on appointments.
-- 3. Locks telemetry_snapshots and processed_events to service-role operations (if present).
-- 4. Revokes anonymous table permissions across all existing tenant tables.
-- ==============================================================================

-- ==============================================================================
-- 1. SAFE, CONDITIONAL RLS ACTIVATION & ANON REVOCATION ACROSS ALL SCHEMA TABLES
-- ==============================================================================
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'organizations', 'profiles', 'contacts', 'leads', 'calls',
        'conversations', 'messages', 'activity_logs', 'telnyx_phone_numbers',
        'services', 'appointments', 'jobs', 'job_items', 'quotes',
        'quote_items', 'invoices', 'invoice_items', 'payments',
        'document_counters', 'review_requests', 'automation_rules',
        'automation_runs', 'automation_settings', 'notifications',
        'compliance_suppression_list', 'compliance_consent_records',
        'compliance_audit_logs', 'rate_limits', 'processed_events',
        'telemetry_snapshots'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Only alter and revoke if table actually exists in public schema
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
            EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
            IF t IN ('rate_limits', 'telemetry_snapshots') THEN
                EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
            END IF;
        END IF;
    END LOOP;
END $$;

-- ==============================================================================
-- 2. APPOINTMENTS TENANT ISOLATION POLICY (SAFE CONDITIONAL DDL)
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'appointments') THEN
        DROP POLICY IF EXISTS "Tenant isolation for appointments" ON public.appointments;
        DROP POLICY IF EXISTS "Public can view appointments by manage_token" ON public.appointments;
        DROP POLICY IF EXISTS "Public can create appointments via booking" ON public.appointments;

        CREATE POLICY "Tenant isolation for appointments"
        ON public.appointments FOR ALL
        TO authenticated
        USING (
            org_id = public.auth_user_org_id() 
            OR public.auth_is_super_admin()
        )
        WITH CHECK (
            org_id = public.auth_user_org_id() 
            OR public.auth_is_super_admin()
        );
    END IF;
END $$;

-- ==============================================================================
-- 3. PROCESSED_EVENTS STRICT RESTRICTIONS (SAFE CONDITIONAL DDL)
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'processed_events') THEN
        DROP POLICY IF EXISTS "Strict isolation for processed_events" ON public.processed_events;
        CREATE POLICY "Strict isolation for processed_events"
        ON public.processed_events FOR ALL
        TO authenticated
        USING (false);
    END IF;
END $$;

-- ==============================================================================
-- 4. TELEMETRY_SNAPSHOTS STRICT RESTRICTIONS (SAFE CONDITIONAL DDL)
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'telemetry_snapshots') THEN
        DROP POLICY IF EXISTS "Strict isolation for telemetry_snapshots" ON public.telemetry_snapshots;
        CREATE POLICY "Strict isolation for telemetry_snapshots"
        ON public.telemetry_snapshots FOR ALL
        TO authenticated
        USING (public.auth_is_super_admin());
    END IF;
END $$;
