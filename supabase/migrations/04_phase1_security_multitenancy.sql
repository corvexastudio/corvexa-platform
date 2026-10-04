-- ==============================================================================
-- CAPTODESK MIGRATION 04: PHASE 1 SECURITY & MULTI-TENANCY EXPANSION
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

-- 1. Helper function: check if user is super_admin (if not already defined)
CREATE OR REPLACE FUNCTION auth_is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Update profiles role constraint to support canonical & legacy roles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('super_admin', 'owner', 'admin', 'member', 'dispatcher', 'client_admin'));

-- 3. JOBS TABLE
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled')),
    total_amount NUMERIC(10,2) DEFAULT 0.00,
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. QUOTES TABLE
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    quote_number TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired')),
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    items JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. INVOICES TABLE
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    invoice_number TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled')),
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    due_date TIMESTAMPTZ,
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'succeeded' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    payment_method TEXT DEFAULT 'credit_card',
    transaction_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. REVIEW_REQUESTS TABLE
CREATE TABLE IF NOT EXISTS review_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'opened', 'reviewed', 'failed')),
    rating INT CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    sent_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. AUTOMATION_RULES TABLE
CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('missed_call', 'lead_created', 'job_completed', 'manual', 'schedule')),
    is_active BOOLEAN DEFAULT true,
    conditions JSONB DEFAULT '{}'::jsonb,
    actions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. AUTOMATION_RUNS TABLE
CREATE TABLE IF NOT EXISTS automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES automation_rules(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'success' CHECK (status IN ('pending', 'running', 'success', 'failed')),
    execution_log JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_jobs_org ON jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_org ON quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_org ON review_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON automation_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_org ON automation_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org_user ON notifications(org_id, user_id);

-- 12. ROW-LEVEL SECURITY (RLS) ACTIVATION
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 13. TENANT ISOLATION POLICIES (Enforces org_id = auth_user_org_id() OR auth_is_super_admin())
DROP POLICY IF EXISTS "Tenant isolation for jobs" ON jobs;
CREATE POLICY "Tenant isolation for jobs" ON jobs FOR ALL TO authenticated
USING (org_id = auth_user_org_id() OR auth_is_super_admin())
WITH CHECK (org_id = auth_user_org_id() OR auth_is_super_admin());

DROP POLICY IF EXISTS "Tenant isolation for quotes" ON quotes;
CREATE POLICY "Tenant isolation for quotes" ON quotes FOR ALL TO authenticated
USING (org_id = auth_user_org_id() OR auth_is_super_admin())
WITH CHECK (org_id = auth_user_org_id() OR auth_is_super_admin());

DROP POLICY IF EXISTS "Tenant isolation for invoices" ON invoices;
CREATE POLICY "Tenant isolation for invoices" ON invoices FOR ALL TO authenticated
USING (org_id = auth_user_org_id() OR auth_is_super_admin())
WITH CHECK (org_id = auth_user_org_id() OR auth_is_super_admin());

DROP POLICY IF EXISTS "Tenant isolation for payments" ON payments;
CREATE POLICY "Tenant isolation for payments" ON payments FOR ALL TO authenticated
USING (org_id = auth_user_org_id() OR auth_is_super_admin())
WITH CHECK (org_id = auth_user_org_id() OR auth_is_super_admin());

DROP POLICY IF EXISTS "Tenant isolation for review_requests" ON review_requests;
CREATE POLICY "Tenant isolation for review_requests" ON review_requests FOR ALL TO authenticated
USING (org_id = auth_user_org_id() OR auth_is_super_admin())
WITH CHECK (org_id = auth_user_org_id() OR auth_is_super_admin());

DROP POLICY IF EXISTS "Tenant isolation for automation_rules" ON automation_rules;
CREATE POLICY "Tenant isolation for automation_rules" ON automation_rules FOR ALL TO authenticated
USING (org_id = auth_user_org_id() OR auth_is_super_admin())
WITH CHECK (org_id = auth_user_org_id() OR auth_is_super_admin());

DROP POLICY IF EXISTS "Tenant isolation for automation_runs" ON automation_runs;
CREATE POLICY "Tenant isolation for automation_runs" ON automation_runs FOR ALL TO authenticated
USING (org_id = auth_user_org_id() OR auth_is_super_admin())
WITH CHECK (org_id = auth_user_org_id() OR auth_is_super_admin());

DROP POLICY IF EXISTS "Tenant isolation for notifications" ON notifications;
CREATE POLICY "Tenant isolation for notifications" ON notifications FOR ALL TO authenticated
USING (org_id = auth_user_org_id() OR auth_is_super_admin())
WITH CHECK (org_id = auth_user_org_id() OR auth_is_super_admin());
