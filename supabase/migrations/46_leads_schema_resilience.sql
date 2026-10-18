-- ==============================================================================
-- CAPTODESK MIGRATION 46: LEADS SCHEMA RESILIENCE & COMPREHENSIVE RLS POLICIES
-- Ensures public.leads exists with all required columns, indices, and tenant isolation policies.
-- ==============================================================================

-- 1. Ensure leads table exists
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    source TEXT DEFAULT 'manual',
    status TEXT DEFAULT 'new',
    urgency TEXT DEFAULT 'normal',
    service_needed TEXT,
    estimated_value NUMERIC(10,2),
    notes TEXT,
    missed_call_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Safely add any missing columns to leads
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'org_id') THEN
        ALTER TABLE public.leads ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'contact_id') THEN
        ALTER TABLE public.leads ADD COLUMN contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'source') THEN
        ALTER TABLE public.leads ADD COLUMN source TEXT DEFAULT 'manual';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'status') THEN
        ALTER TABLE public.leads ADD COLUMN status TEXT DEFAULT 'new';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'urgency') THEN
        ALTER TABLE public.leads ADD COLUMN urgency TEXT DEFAULT 'normal';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'service_needed') THEN
        ALTER TABLE public.leads ADD COLUMN service_needed TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'estimated_value') THEN
        ALTER TABLE public.leads ADD COLUMN estimated_value NUMERIC(10,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'notes') THEN
        ALTER TABLE public.leads ADD COLUMN notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'missed_call_count') THEN
        ALTER TABLE public.leads ADD COLUMN missed_call_count INT DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'created_at') THEN
        ALTER TABLE public.leads ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'updated_at') THEN
        ALTER TABLE public.leads ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- 3. Ensure contacts has address, email, phone, name columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'address') THEN
        ALTER TABLE public.contacts ADD COLUMN address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'name') THEN
        ALTER TABLE public.contacts ADD COLUMN name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'phone') THEN
        ALTER TABLE public.contacts ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'email') THEN
        ALTER TABLE public.contacts ADD COLUMN email TEXT;
    END IF;
END $$;

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_leads_org_id ON public.leads(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_created ON public.leads(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON public.leads(org_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_contact_id ON public.leads(contact_id);

-- 5. Row Level Security on leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for leads" ON public.leads;
CREATE POLICY "Tenant isolation for leads"
ON public.leads FOR ALL
TO authenticated
USING (
    org_id = public.auth_user_org_id() 
    OR public.auth_is_super_admin()
)
WITH CHECK (
    org_id = public.auth_user_org_id() 
    OR public.auth_is_super_admin()
);

-- 6. Grant standard table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
