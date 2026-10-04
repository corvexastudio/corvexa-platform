-- ==============================================================================
-- CAPTODESK MIGRATION 03: P0 SECURITY & RLS POLICY HARDENING
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

-- 1. Helper function: check if user is super_admin
CREATE OR REPLACE FUNCTION auth_is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. ORGANIZATIONS: Lock down SELECT and UPDATE
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
DROP POLICY IF EXISTS "Allow lookup of organizations" ON organizations;
CREATE POLICY "Users can view their own organization"
ON organizations FOR SELECT
TO authenticated
USING (
  id = auth_user_org_id() OR auth_is_super_admin()
);

DROP POLICY IF EXISTS "Users can update their own organization" ON organizations;
CREATE POLICY "Users can update their own organization"
ON organizations FOR UPDATE
TO authenticated
USING (
  id = auth_user_org_id() OR auth_is_super_admin()
);

-- 3. PROFILES: Allow super_admin visibility
DROP POLICY IF EXISTS "Super admin can view all profiles" ON profiles;
CREATE POLICY "Super admin can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR auth_is_super_admin()
);

-- 4. CONTACTS: Revoke anon webhook inserts, enforce tenant isolation
DROP POLICY IF EXISTS "Webhook inserts for contacts" ON contacts;
DROP POLICY IF EXISTS "Allow webhook inserts for contacts" ON contacts;
DROP POLICY IF EXISTS "Tenant isolation for contacts" ON contacts;
CREATE POLICY "Tenant isolation for contacts"
ON contacts FOR ALL
TO authenticated
USING (
  org_id = auth_user_org_id() OR auth_is_super_admin()
)
WITH CHECK (
  org_id = auth_user_org_id() OR auth_is_super_admin()
);

-- 5. LEADS: Revoke anon webhook inserts, enforce tenant isolation
DROP POLICY IF EXISTS "Webhook inserts for leads" ON leads;
DROP POLICY IF EXISTS "Allow webhook inserts for leads" ON leads;
DROP POLICY IF EXISTS "Tenant isolation for leads" ON leads;
CREATE POLICY "Tenant isolation for leads"
ON leads FOR ALL
TO authenticated
USING (
  org_id = auth_user_org_id() OR auth_is_super_admin()
)
WITH CHECK (
  org_id = auth_user_org_id() OR auth_is_super_admin()
);

-- 6. CALLS: Revoke anon webhook inserts, enforce tenant isolation
DROP POLICY IF EXISTS "Webhook inserts for calls" ON calls;
DROP POLICY IF EXISTS "Allow webhook inserts for calls" ON calls;
DROP POLICY IF EXISTS "Tenant isolation for calls" ON calls;
CREATE POLICY "Tenant isolation for calls"
ON calls FOR ALL
TO authenticated
USING (
  org_id = auth_user_org_id() OR auth_is_super_admin()
)
WITH CHECK (
  org_id = auth_user_org_id() OR auth_is_super_admin()
);

-- 7. CONVERSATIONS: Revoke anon webhook inserts/updates
DROP POLICY IF EXISTS "Webhook inserts for conversations" ON conversations;
DROP POLICY IF EXISTS "Allow webhook inserts for conversations" ON conversations;
DROP POLICY IF EXISTS "Webhook updates for conversations" ON conversations;
DROP POLICY IF EXISTS "Allow webhook updates for conversations" ON conversations;
DROP POLICY IF EXISTS "Tenant isolation for conversations" ON conversations;
CREATE POLICY "Tenant isolation for conversations"
ON conversations FOR ALL
TO authenticated
USING (
  org_id = auth_user_org_id() OR auth_is_super_admin()
)
WITH CHECK (
  org_id = auth_user_org_id() OR auth_is_super_admin()
);

-- 8. MESSAGES: Revoke anon webhook inserts/updates
DROP POLICY IF EXISTS "Webhook inserts for messages" ON messages;
DROP POLICY IF EXISTS "Allow webhook inserts for messages" ON messages;
DROP POLICY IF EXISTS "Webhook updates for messages" ON messages;
DROP POLICY IF EXISTS "Allow webhook updates for messages" ON messages;
DROP POLICY IF EXISTS "Tenant isolation for messages" ON messages;
CREATE POLICY "Tenant isolation for messages"
ON messages FOR ALL
TO authenticated
USING (
  org_id = auth_user_org_id() OR auth_is_super_admin()
)
WITH CHECK (
  org_id = auth_user_org_id() OR auth_is_super_admin()
);

-- 9. ACTIVITY_LOGS: Revoke anon webhook inserts
DROP POLICY IF EXISTS "Webhook inserts for activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "Allow webhook inserts for activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "Tenant isolation for activity_logs" ON activity_logs;
CREATE POLICY "Tenant isolation for activity_logs"
ON activity_logs FOR ALL
TO authenticated
USING (
  org_id = auth_user_org_id() OR auth_is_super_admin()
)
WITH CHECK (
  org_id = auth_user_org_id() OR auth_is_super_admin()
);

-- 10. PROCESSED_EVENTS: Lock table exclusively to service role
DROP POLICY IF EXISTS "Webhook inserts for processed_events" ON processed_events;
DROP POLICY IF EXISTS "Strict isolation for processed_events" ON processed_events;
CREATE POLICY "Strict isolation for processed_events"
ON processed_events FOR ALL
TO authenticated
USING (false); -- Accessible internally exclusively via SUPABASE_SERVICE_ROLE_KEY
