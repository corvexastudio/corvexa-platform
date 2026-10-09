-- ==============================================================================
-- CAPTODESK MIGRATION 27: COMPREHENSIVE RLS ENFORCEMENT & POLICY HARDENING
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
--
-- AUDIT REMEDIATION:
-- 1. Explicitly ENABLES Row Level Security (RLS) across all tables.
-- 2. Closes missing tenant isolation policy on appointments.
-- 3. Locks telemetry_snapshots and processed_events to service-role operations.
-- 4. Revokes anonymous table permissions across all remaining tenant tables.
-- ==============================================================================

-- ==============================================================================
-- 1. IDEMPOTENT RLS ACTIVATION ON ALL SCHEMA TABLES
-- ==============================================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telnyx_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'automation_settings') THEN
        ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ==============================================================================
-- 2. APPOINTMENTS TENANT ISOLATION POLICY
-- ==============================================================================
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

-- ==============================================================================
-- 3. PROCESSED_EVENTS & TELEMETRY_SNAPSHOTS STRICT RESTRICTIONS
-- ==============================================================================
DROP POLICY IF EXISTS "Strict isolation for processed_events" ON public.processed_events;
CREATE POLICY "Strict isolation for processed_events"
ON public.processed_events FOR ALL
TO authenticated
USING (false);

DROP POLICY IF EXISTS "Strict isolation for telemetry_snapshots" ON public.telemetry_snapshots;
CREATE POLICY "Strict isolation for telemetry_snapshots"
ON public.telemetry_snapshots FOR ALL
TO authenticated
USING (public.auth_is_super_admin());

-- ==============================================================================
-- 4. EXPLICIT ANON REVOCATIONS ON ALL TENANT & SYSTEM TABLES
-- ==============================================================================
REVOKE ALL ON public.organizations FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.contacts FROM anon;
REVOKE ALL ON public.leads FROM anon;
REVOKE ALL ON public.calls FROM anon;
REVOKE ALL ON public.conversations FROM anon;
REVOKE ALL ON public.messages FROM anon;
REVOKE ALL ON public.activity_logs FROM anon;
REVOKE ALL ON public.telnyx_phone_numbers FROM anon;
REVOKE ALL ON public.services FROM anon;
REVOKE ALL ON public.appointments FROM anon;
REVOKE ALL ON public.jobs FROM anon;
REVOKE ALL ON public.job_items FROM anon;
REVOKE ALL ON public.quotes FROM anon;
REVOKE ALL ON public.quote_items FROM anon;
REVOKE ALL ON public.invoices FROM anon;
REVOKE ALL ON public.invoice_items FROM anon;
REVOKE ALL ON public.payments FROM anon;
REVOKE ALL ON public.document_counters FROM anon;
REVOKE ALL ON public.review_requests FROM anon;
REVOKE ALL ON public.automation_rules FROM anon;
REVOKE ALL ON public.automation_runs FROM anon;
REVOKE ALL ON public.notifications FROM anon;
REVOKE ALL ON public.compliance_suppression_list FROM anon;
REVOKE ALL ON public.compliance_consent_records FROM anon;
REVOKE ALL ON public.compliance_audit_logs FROM anon;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;
REVOKE ALL ON public.processed_events FROM anon;
REVOKE ALL ON public.telemetry_snapshots FROM anon, authenticated;
