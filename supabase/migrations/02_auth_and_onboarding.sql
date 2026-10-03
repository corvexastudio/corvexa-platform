-- CaptoDesk Migration: Auth, Onboarding & Webhook Policies

-- 1. Organizations: Allow authenticated users to create an organization during onboarding
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
CREATE POLICY "Authenticated users can create organizations"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. Organizations: Allow lookup by telnyx number (needed by telephony webhooks)
DROP POLICY IF EXISTS "Allow lookup of organizations" ON organizations;
CREATE POLICY "Allow lookup of organizations"
ON organizations FOR SELECT
TO anon, authenticated
USING (true);

-- 3. User Profiles: Allow authenticated users to read, insert, and update their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- 4. Service role / webhook insert permissions for telephony
DROP POLICY IF EXISTS "Allow webhook inserts for calls" ON calls;
CREATE POLICY "Allow webhook inserts for calls"
ON calls FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow webhook inserts for messages" ON messages;
CREATE POLICY "Allow webhook inserts for messages"
ON messages FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow webhook updates for messages" ON messages;
CREATE POLICY "Allow webhook updates for messages"
ON messages FOR UPDATE
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow webhook inserts for contacts" ON contacts;
CREATE POLICY "Allow webhook inserts for contacts"
ON contacts FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow webhook inserts for leads" ON leads;
CREATE POLICY "Allow webhook inserts for leads"
ON leads FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow webhook inserts for conversations" ON conversations;
CREATE POLICY "Allow webhook inserts for conversations"
ON conversations FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow webhook updates for conversations" ON conversations;
CREATE POLICY "Allow webhook updates for conversations"
ON conversations FOR UPDATE
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow webhook inserts for activity_logs" ON activity_logs;
CREATE POLICY "Allow webhook inserts for activity_logs"
ON activity_logs FOR INSERT
TO anon, authenticated
WITH CHECK (true);
