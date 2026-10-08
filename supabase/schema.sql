-- ==============================================================================
-- CAPTODESK MASTER PRODUCTION DATABASE SCHEMA & POLICIES
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ORGANIZATIONS (TENANTS)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_phone TEXT,
    telnyx_phone_number TEXT,
    carrier TEXT DEFAULT 'Unknown',
    is_missed_call_active BOOLEAN DEFAULT true,
    is_review_engine_active BOOLEAN DEFAULT true,
    auto_reply_template TEXT NOT NULL DEFAULT 'Hey, this is {business_name}! We are mid-job and missed your call. How can we help you?',
    after_hours_template TEXT NOT NULL DEFAULT 'Thanks for calling {business_name}. We are currently closed for the evening, but received your message and will call you first thing tomorrow morning.',
    busy_template TEXT DEFAULT 'Hey, this is {business_name}! We are currently on the other line with a client. How can we help you?',
    business_hours JSONB DEFAULT '{
        "monday": {"open": "08:00", "close": "18:00", "closed": false},
        "tuesday": {"open": "08:00", "close": "18:00", "closed": false},
        "wednesday": {"open": "08:00", "close": "18:00", "closed": false},
        "thursday": {"open": "08:00", "close": "18:00", "closed": false},
        "friday": {"open": "08:00", "close": "18:00", "closed": false},
        "saturday": {"open": "09:00", "close": "14:00", "closed": false},
        "sunday": {"open": "00:00", "close": "00:00", "closed": true}
    }'::jsonb,
    google_review_url TEXT,
    timezone TEXT DEFAULT 'America/Chicago',
    cooldown_hours INT DEFAULT 24,
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled')),
    monthly_rate NUMERIC(10,2) DEFAULT 99.00,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS owner_phone TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS telnyx_phone_number TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS carrier TEXT DEFAULT 'Unknown';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_missed_call_active BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_review_engine_active BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS auto_reply_template TEXT DEFAULT 'Hey, this is {business_name}! We are mid-job and missed your call. How can we help you?';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS after_hours_template TEXT DEFAULT 'Thanks for calling {business_name}. We are currently closed for the evening, but received your message and will call you first thing tomorrow morning.';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS busy_template TEXT DEFAULT 'Hey, this is {business_name}! We are currently on the other line with a client. How can we help you?';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"monday":{"open":"08:00","close":"18:00","closed":false},"tuesday":{"open":"08:00","close":"18:00","closed":false},"wednesday":{"open":"08:00","close":"18:00","closed":false},"thursday":{"open":"08:00","close":"18:00","closed":false},"friday":{"open":"08:00","close":"18:00","closed":false},"saturday":{"open":"09:00","close":"14:00","closed":false},"sunday":{"open":"00:00","close":"00:00","closed":true}}'::jsonb;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS google_review_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Chicago';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS cooldown_hours INT DEFAULT 24;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS monthly_rate NUMERIC(10,2) DEFAULT 99.00;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS booking_mode TEXT DEFAULT 'instant' CHECK (booking_mode IN ('instant', 'request'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_duration_minutes INT DEFAULT 60;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS buffer_minutes INT DEFAULT 15;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS minimum_notice_hours INT DEFAULT 2;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_booking_days_ahead INT DEFAULT 30;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS blocked_dates TEXT[] DEFAULT '{}';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. USER PROFILES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    role TEXT DEFAULT 'owner' CHECK (role IN ('super_admin', 'owner', 'admin', 'member', 'dispatcher', 'client_admin')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;


-- 4. CONTACTS (Homeowners & Callers)
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    opt_out BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, phone)
);

-- 5. LEADS
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    source TEXT DEFAULT 'missed_call' CHECK (source IN ('missed_call', 'web_form', 'manual', 'referral')),
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'booked', 'lost', 'archived')),
    urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'emergency')),
    service_needed TEXT,
    estimated_value NUMERIC(10,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. CALLS
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    caller_number TEXT NOT NULL,
    called_number TEXT NOT NULL,
    direction TEXT DEFAULT 'inbound',
    status TEXT CHECK (status IN ('initiated', 'ringing', 'answered', 'bridged', 'completed', 'missed', 'busy', 'no_answer', 'failed')),
    duration_seconds INT DEFAULT 0,
    telnyx_call_control_id TEXT,
    call_session_id TEXT,
    call_leg_id TEXT,
    hangup_cause TEXT,
    auto_reply_sent BOOLEAN DEFAULT false,
    suppression_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS call_session_id TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS call_leg_id TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS hangup_cause TEXT;

-- 7. CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ DEFAULT now(),
    last_message_preview TEXT,
    unread_count INT DEFAULT 0,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, contact_id)
);

-- 8. MESSAGES
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender_type TEXT NOT NULL CHECK (sender_type IN ('system', 'owner', 'customer')),
    body TEXT NOT NULL,
    delivery_status TEXT DEFAULT 'queued' CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'failed', 'received', 'undelivered')),
    telnyx_message_id TEXT,
    automation_source TEXT DEFAULT 'manual',
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS automation_source TEXT DEFAULT 'manual';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- 8.5 SERVICES (CATALOG)
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    price NUMERIC(10,2),
    requires_address BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. APPOINTMENTS (CALENDAR & BOOKINGS)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    service_type TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('requested', 'confirmed', 'cancelled', 'completed', 'no_show', 'scheduled')),
    source TEXT DEFAULT 'booking_page' CHECK (source IN ('booking_page', 'inbox', 'manual', 'phone', 'missed_call')),
    manage_token TEXT UNIQUE NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text),
    cancellation_reason TEXT,
    confirmed_at TIMESTAMPTZ,
    reminder_24h_sent_at TIMESTAMPTZ,
    reminder_2h_sent_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'booking_page';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS manage_token TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_2h_sent_at TIMESTAMPTZ;

-- Backfill manage_token for existing appointments
UPDATE appointments 
SET manage_token = md5(random()::text || clock_timestamp()::text || id::text) || md5(random()::text || clock_timestamp()::text) 
WHERE manage_token IS NULL;

ALTER TABLE appointments ALTER COLUMN manage_token SET DEFAULT md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text);
ALTER TABLE appointments ALTER COLUMN manage_token SET NOT NULL;

-- 9.5 QUOTES & ESTIMATES
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    quote_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    tax NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
    expires_at TIMESTAMPTZ,
    manage_token TEXT UNIQUE NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text),
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    decline_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS quote_number TEXT DEFAULT 'Q-1001';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Quote';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tax NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS manage_token TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS decline_reason TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE quotes 
SET manage_token = md5(random()::text || clock_timestamp()::text || id::text) || md5(random()::text || clock_timestamp()::text) 
WHERE manage_token IS NULL;

ALTER TABLE quotes ALTER COLUMN manage_token SET DEFAULT md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text);
ALTER TABLE quotes ALTER COLUMN manage_token SET NOT NULL;

CREATE TABLE IF NOT EXISTS quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1.00,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9.6 JOBS (FIELD SERVICE EXECUTION)
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    job_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'en_route', 'in_progress', 'completed', 'cancelled', 'no_show')),
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ,
    en_route_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_number TEXT DEFAULT 'J-1001';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Job';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ DEFAULT now();
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS en_route_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS job_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1.00,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing job_items table
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE CASCADE;
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2) DEFAULT 1.00;
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE job_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 10. AUTOMATION MODULE SETTINGS
CREATE TABLE IF NOT EXISTS automation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    module_key TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, module_key)
);

-- 11. ACTIVITY & AUDIT LOGS
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. PROCESSED WEBHOOK EVENTS (IDEMPOTENCY GUARD)
CREATE TABLE IF NOT EXISTS processed_events (
    id TEXT PRIMARY KEY,
    provider TEXT DEFAULT 'telnyx',
    event_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. INDEXES
CREATE INDEX IF NOT EXISTS idx_contacts_org_phone ON contacts(org_id, phone);
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON leads(org_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_org_last_msg ON conversations(org_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_calls_org_created ON calls(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orgs_telnyx ON organizations(telnyx_phone_number);

-- 14. TRIGGER: AUTO-UPDATE CONVERSATION PREVIEW & UNREAD COUNT
CREATE OR REPLACE FUNCTION update_conversation_on_new_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET 
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.body, 120),
        unread_count = CASE 
            WHEN NEW.direction = 'inbound' THEN unread_count + 1 
            ELSE unread_count 
        END
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_conversation_on_new_message ON messages;
CREATE TRIGGER trg_update_conversation_on_new_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_on_new_message();

-- 15. ROW-LEVEL SECURITY (RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_events ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's org_id
CREATE OR REPLACE FUNCTION auth_user_org_id()
RETURNS UUID AS $$
    SELECT org_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Organizations Policies
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
CREATE POLICY "Authenticated users can create organizations" ON organizations FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
CREATE POLICY "Users can view their own organization" ON organizations FOR SELECT TO authenticated USING (id = auth_user_org_id());

DROP POLICY IF EXISTS "Users can update their own organization" ON organizations;
CREATE POLICY "Users can update their own organization" ON organizations FOR UPDATE TO authenticated USING (id = auth_user_org_id());

-- Profiles Policies
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
CREATE POLICY "Users can manage own profile" ON profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Tenant Isolation Policies (SELECT, INSERT, UPDATE, DELETE strictly for authenticated dashboard users)
DROP POLICY IF EXISTS "Tenant isolation for contacts" ON contacts;
CREATE POLICY "Tenant isolation for contacts" ON contacts FOR ALL TO authenticated USING (org_id = auth_user_org_id()) WITH CHECK (org_id = auth_user_org_id());

DROP POLICY IF EXISTS "Tenant isolation for leads" ON leads;
CREATE POLICY "Tenant isolation for leads" ON leads FOR ALL TO authenticated USING (org_id = auth_user_org_id()) WITH CHECK (org_id = auth_user_org_id());

DROP POLICY IF EXISTS "Tenant isolation for calls" ON calls;
CREATE POLICY "Tenant isolation for calls" ON calls FOR ALL TO authenticated USING (org_id = auth_user_org_id()) WITH CHECK (org_id = auth_user_org_id());

DROP POLICY IF EXISTS "Tenant isolation for conversations" ON conversations;
CREATE POLICY "Tenant isolation for conversations" ON conversations FOR ALL TO authenticated USING (org_id = auth_user_org_id()) WITH CHECK (org_id = auth_user_org_id());

DROP POLICY IF EXISTS "Tenant isolation for messages" ON messages;
CREATE POLICY "Tenant isolation for messages" ON messages FOR ALL TO authenticated USING (org_id = auth_user_org_id()) WITH CHECK (org_id = auth_user_org_id());

DROP POLICY IF EXISTS "Tenant isolation for appointments" ON appointments;
CREATE POLICY "Tenant isolation for appointments" ON appointments FOR ALL TO authenticated USING (org_id = auth_user_org_id()) WITH CHECK (org_id = auth_user_org_id());

DROP POLICY IF EXISTS "Tenant isolation for automation_settings" ON automation_settings;
CREATE POLICY "Tenant isolation for automation_settings" ON automation_settings FOR ALL TO authenticated USING (org_id = auth_user_org_id()) WITH CHECK (org_id = auth_user_org_id());

DROP POLICY IF EXISTS "Tenant isolation for activity_logs" ON activity_logs;
CREATE POLICY "Tenant isolation for activity_logs" ON activity_logs FOR ALL TO authenticated USING (org_id = auth_user_org_id()) WITH CHECK (org_id = auth_user_org_id());

-- Processed Events: Exclusively accessed internally via service role key
DROP POLICY IF EXISTS "Strict isolation for processed_events" ON processed_events;
CREATE POLICY "Strict isolation for processed_events" ON processed_events FOR ALL TO authenticated USING (false);

-- 16. EXPANDED MULTI-TENANT DOMAIN TABLES
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

CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    is_active BOOLEAN DEFAULT true,
    delay_seconds INT NOT NULL DEFAULT 0,
    conditions JSONB DEFAULT '{}'::jsonb,
    actions JSONB DEFAULT '[]'::jsonb,
    stop_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing automation_rules table
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS stop_conditions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS delay_seconds INT NOT NULL DEFAULT 0;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES automation_rules(id) ON DELETE CASCADE,
    job_id TEXT UNIQUE,
    idempotency_key TEXT UNIQUE,
    event_type TEXT NOT NULL DEFAULT 'manual',
    event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    action_type TEXT NOT NULL DEFAULT 'unspecified',
    action_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'running', 'success', 'failed', 'cancelled', 'dead_letter')),
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failure_reason TEXT,
    execution_log JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing automation_runs table
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS job_id TEXT UNIQUE;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS event_payload JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT 'unspecified';
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS action_params JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS max_retries INT NOT NULL DEFAULT 3;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS failure_reason TEXT;

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

CREATE INDEX IF NOT EXISTS idx_jobs_org ON jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_org ON quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_org ON review_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON automation_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_org ON automation_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org_user ON notifications(org_id, user_id);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

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

-- 17. TELNYX PHONE NUMBERS (DEDICATED MULTI-TENANT NUMBER REPOSITORY)
CREATE TABLE IF NOT EXISTS telnyx_phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phone_number TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'released', 'suspended')),
    capabilities TEXT[] DEFAULT '{"voice", "sms"}',
    messaging_profile_id TEXT,
    connection_id TEXT,
    provisioning_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_telnyx_phone_numbers_phone ON telnyx_phone_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_telnyx_phone_numbers_org ON telnyx_phone_numbers(org_id);

ALTER TABLE telnyx_phone_numbers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for telnyx_phone_numbers" ON telnyx_phone_numbers;
CREATE POLICY "Tenant isolation for telnyx_phone_numbers" ON telnyx_phone_numbers FOR ALL TO authenticated
USING (org_id = auth_user_org_id() OR auth_is_super_admin())
WITH CHECK (org_id = auth_user_org_id() OR auth_is_super_admin());

-- 18. INVOICING & PAYMENTS (PHASE 6)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL DEFAULT 'INV-1001',
    title TEXT NOT NULL DEFAULT 'Invoice',
    description TEXT,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    tax NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    amount_due NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'void')),
    due_date TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    manage_token TEXT UNIQUE NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text),
    stripe_payment_link_id TEXT,
    stripe_payment_link_url TEXT,
    stripe_checkout_session_id TEXT,
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT DEFAULT 'INV-1001';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Invoice';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_due NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days');
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS manage_token TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_link_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_link_url TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE invoices 
SET manage_token = md5(random()::text || clock_timestamp()::text || id::text) || md5(random()::text || clock_timestamp()::text) 
WHERE manage_token IS NULL;

ALTER TABLE invoices ALTER COLUMN manage_token SET DEFAULT md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text);
ALTER TABLE invoices ALTER COLUMN manage_token SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON invoices(org_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_manage_token ON invoices(manage_token);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(job_id);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1.00,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2) DEFAULT 1.00;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'usd',
    payment_method TEXT NOT NULL DEFAULT 'stripe' CHECK (payment_method IN ('stripe', 'cash', 'check', 'card_offline', 'other')),
    status TEXT NOT NULL DEFAULT 'succeeded' CHECK (status IN ('succeeded', 'pending', 'failed', 'refunded')),
    stripe_payment_intent_id TEXT,
    stripe_checkout_session_id TEXT,
    stripe_receipt_url TEXT,
    reference_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'usd';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'stripe';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'succeeded';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_receipt_url TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_note TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session ON payments(stripe_checkout_session_id);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for invoices" ON invoices;
CREATE POLICY "Tenant isolation for invoices" ON invoices FOR ALL TO authenticated
USING (org_id = auth_user_org_id() OR auth_is_super_admin())
WITH CHECK (org_id = auth_user_org_id() OR auth_is_super_admin());

DROP POLICY IF EXISTS "Tenant isolation for invoice_items" ON invoice_items;
CREATE POLICY "Tenant isolation for invoice_items" ON invoice_items FOR ALL TO authenticated
USING (org_id = auth_user_org_id() OR auth_is_super_admin())
WITH CHECK (org_id = auth_user_org_id() OR auth_is_super_admin());

DROP POLICY IF EXISTS "Tenant isolation for payments" ON payments;
CREATE POLICY "Tenant isolation for payments" ON payments FOR ALL TO authenticated
USING (org_id = auth_user_org_id() OR auth_is_super_admin())
WITH CHECK (org_id = auth_user_org_id() OR auth_is_super_admin());





-- ==============================================================================
-- 19. PHASE 7 — REVIEWS & CUSTOMER RETENTION
-- ==============================================================================
-- 1. Extend organizations with review & retention preferences
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS review_requests_enabled BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS review_delay_hours INT DEFAULT 24;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS review_cooldown_days INT DEFAULT 60;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS reactivation_enabled BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_reactivation_interval_days INT DEFAULT 90;

-- 2. Extend contacts with customer lifecycle tracking
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_service_date TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS service_frequency_days INT DEFAULT 90;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_expected_service_date TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'active';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_reactivation_sent_at TIMESTAMPTZ;

-- 3. Create review_requests table if it doesn't already exist
CREATE TABLE IF NOT EXISTS review_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Ensure ALL required Phase 7 columns exist on pre-existing review_requests table
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS token TEXT DEFAULT encode(gen_random_bytes(16), 'hex');
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS google_review_url TEXT DEFAULT '';
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS click_count INT DEFAULT 0;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS suppression_reason TEXT;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure all rows have a token populated
UPDATE review_requests SET token = encode(gen_random_bytes(16), 'hex') WHERE token IS NULL;

-- Ensure unique constraint on token if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'review_requests_token_key'
    ) THEN
        ALTER TABLE review_requests ADD CONSTRAINT review_requests_token_key UNIQUE (token);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 5. Indexes for fast tenant lookups and click tracking
CREATE INDEX IF NOT EXISTS idx_review_requests_org_id ON review_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_contact_id ON review_requests(contact_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_status ON review_requests(org_id, status);
CREATE INDEX IF NOT EXISTS idx_review_requests_token ON review_requests(token);
CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle ON contacts(org_id, lifecycle_status);

-- 6. Row Level Security (RLS)
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Tenant review_requests access" ON review_requests;
    DROP POLICY IF EXISTS "Public token click redirect access" ON review_requests;
    DROP POLICY IF EXISTS "Public token click counter update" ON review_requests;
END $$;

CREATE POLICY "Tenant review_requests access"
    ON review_requests
    FOR ALL
    USING (
        org_id IN (
            SELECT org_id FROM profiles WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        org_id IN (
            SELECT org_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Public token click redirect access"
    ON review_requests
    FOR SELECT
    USING (token IS NOT NULL);

CREATE POLICY "Public token click counter update"
    ON review_requests
    FOR UPDATE
    USING (token IS NOT NULL)
    WITH CHECK (token IS NOT NULL);


-- ==============================================================================
-- 20. PHASE 8 — CUSTOMER DATABASE & LIFECYCLE INTELLIGENCE
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_payments_contact ON payments(contact_id);
CREATE INDEX IF NOT EXISTS idx_quotes_contact ON quotes(contact_id);
CREATE INDEX IF NOT EXISTS idx_jobs_contact ON jobs(contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_contact ON appointments(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_contact ON review_requests(contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org_phone ON contacts(org_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_org_email ON contacts(org_id, email);

-- 21. PHASE 9: DASHBOARD & REPORTING PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_quotes_org_status_expires ON quotes(org_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_appointments_org_status_start ON appointments(org_id, status, start_time);
CREATE INDEX IF NOT EXISTS idx_jobs_org_scheduled_start ON jobs(org_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status_due ON invoices(org_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_conversations_org_unread ON conversations(org_id, unread_count);
CREATE INDEX IF NOT EXISTS idx_leads_org_status_created ON leads(org_id, status, created_at);

-- 22. PHASE 10: ADMIN & PLATFORM OPERATIONS (SELF-HEALING)
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'queued';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT now();

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

-- 23. PHASE 11: OBSERVABILITY + RELIABILITY SPECIALIST
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_created ON activity_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_desc ON activity_logs(created_at DESC);

ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'telnyx';
ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_processed_events_provider_created ON processed_events(provider, created_at DESC);

CREATE TABLE IF NOT EXISTS telemetry_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_type TEXT NOT NULL DEFAULT 'hourly',
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    active_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_snapshots_created ON telemetry_snapshots(created_at DESC);

-- =============================================================================
-- 24. PHASE 12: PERFORMANCE + DATABASE SPECIALIST INDEXING
-- =============================================================================

-- Column and Table guards
ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'telnyx';
ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS provider_event_id TEXT;
ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
UPDATE processed_events SET provider_event_id = id WHERE provider_event_id IS NULL;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'active';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_expected_service_date DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_service_date TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS telnyx_message_id TEXT;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count INT DEFAULT 0;

-- Tenant isolation indexes
CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_appointments_org_id ON appointments(org_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org_id ON jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_org_id ON quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_org_id ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_calls_org_id ON calls(org_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org_id ON conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_org_id ON messages(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads(org_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_org_id ON review_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_id ON activity_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_org_id ON automation_runs(org_id);

-- Phone and Email lookups
CREATE INDEX IF NOT EXISTS idx_contacts_org_phone ON contacts(org_id, phone);
CREATE INDEX IF NOT EXISTS idx_calls_org_caller ON calls(org_id, caller_number);
CREATE INDEX IF NOT EXISTS idx_telnyx_phone_numbers_phone_org ON telnyx_phone_numbers(phone_number, org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org_email ON contacts(org_id, email);
CREATE INDEX IF NOT EXISTS idx_profiles_email_org ON profiles(email, org_id);

-- Chronological ordering & keyset cursors
CREATE INDEX IF NOT EXISTS idx_contacts_org_created ON contacts(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_org_created ON calls(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_org_created ON messages(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_org_created ON quotes(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_org_created ON jobs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_org_created ON invoices(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_org_created ON payments(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_requests_org_created ON review_requests(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_org_created ON leads(org_id, created_at DESC);

-- Status filters & aggregations
CREATE INDEX IF NOT EXISTS idx_contacts_org_lifecycle ON contacts(org_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_calls_org_status ON calls(org_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_org_status ON appointments(org_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_org_status ON quotes(org_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_org_status ON jobs(org_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON invoices(org_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_org_status ON payments(org_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON leads(org_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_org_unread ON conversations(org_id, unread_count);
CREATE INDEX IF NOT EXISTS idx_review_requests_org_status ON review_requests(org_id, status);

-- Appointment & Job time pipelines
CREATE INDEX IF NOT EXISTS idx_appointments_org_time ON appointments(org_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_appointments_org_start ON appointments(org_id, start_time);
CREATE INDEX IF NOT EXISTS idx_jobs_org_status_scheduled ON jobs(org_id, status, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_jobs_org_scheduled_start ON jobs(org_id, scheduled_start);

-- Invoice status & due date
CREATE INDEX IF NOT EXISTS idx_invoices_org_status_due ON invoices(org_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_org_due_date ON invoices(org_id, due_date);

-- Automation queue scheduling
CREATE INDEX IF NOT EXISTS idx_automation_runs_queue_status_sched ON automation_runs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_automation_runs_org_sched ON automation_runs(org_id, scheduled_at);

-- Provider event idempotency
CREATE INDEX IF NOT EXISTS idx_processed_events_provider_event ON processed_events(provider, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_messages_telnyx_id ON messages(telnyx_message_id);

-- Foreign key join optimization
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_job_items_job_id ON job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_contact_id ON quotes(contact_id);
CREATE INDEX IF NOT EXISTS idx_jobs_contact_id ON jobs(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_contact_id ON payments(contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_contact_id ON appointments(contact_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_contact_id ON review_requests(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id);

-- Retention & service follow-up
CREATE INDEX IF NOT EXISTS idx_contacts_org_next_service ON contacts(org_id, next_expected_service_date);
CREATE INDEX IF NOT EXISTS idx_contacts_org_last_service ON contacts(org_id, last_service_date DESC);


-- =============================================================================
-- CAPTODESK MIGRATION 17: PHASE 14 COMPLIANCE + MESSAGING SAFETY
-- Strict carrier opt-out, suppression lists, consent tracking & audit logging
-- =============================================================================

-- 1. COMPLIANCE SUPPRESSION LIST
-- Real-time carrier blocklist preventing any outbound transmission to opted-out numbers
CREATE TABLE IF NOT EXISTS compliance_suppression_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT 'stop_keyword',
    source TEXT NOT NULL DEFAULT 'inbound_sms',
    keyword TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique index to prevent duplicates per org and phone
CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_suppression_org_phone 
ON compliance_suppression_list(org_id, phone);

CREATE INDEX IF NOT EXISTS idx_compliance_suppression_phone 
ON compliance_suppression_list(phone);

-- 2. COMPLIANCE CONSENT RECORDS
-- Proof of consumer consent for transactional and marketing communications
CREATE TABLE IF NOT EXISTS compliance_consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    consent_type TEXT NOT NULL DEFAULT 'transactional', -- 'transactional' | 'marketing' | 'express_written'
    status TEXT NOT NULL DEFAULT 'granted',             -- 'granted' | 'revoked'
    source TEXT NOT NULL DEFAULT 'booking_form',        -- 'booking_form' | 'inbound_keyword' | 'quote_request' | 'verbal' | 'manual'
    proof_text TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_compliance_consent_org_phone 
ON compliance_consent_records(org_id, phone);

CREATE INDEX IF NOT EXISTS idx_compliance_consent_contact 
ON compliance_consent_records(contact_id);

-- 3. COMPLIANCE AUDIT LOGS
-- Immutable log of compliance state transitions, verifications, and suppressions
CREATE TABLE IF NOT EXISTS compliance_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    action TEXT NOT NULL,               -- 'opt_out' | 'opt_in' | 'help_requested' | 'message_sent' | 'message_suppressed'
    message_type TEXT,                  -- 'transactional' | 'marketing'
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_org_created 
ON compliance_audit_logs(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_phone 
ON compliance_audit_logs(phone);

-- 4. CONTACTS TABLE EXTENSIONS
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_channel TEXT DEFAULT 'sms';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS transactional_opt_in BOOLEAN DEFAULT true;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_out_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_in_at TIMESTAMPTZ;

-- 5. ORGANIZATIONS TABLE EXTENSIONS
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS business_name_prefix TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_daily_sms_per_recipient INT DEFAULT 3;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enforce_quiet_hours BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS quiet_hours_start TEXT DEFAULT '20:00';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS quiet_hours_end TEXT DEFAULT '08:00';

-- 6. RLS POLICIES FOR COMPLIANCE TABLES
ALTER TABLE compliance_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'compliance_suppression_list' AND policyname = 'org_isolation_suppression'
    ) THEN
        CREATE POLICY org_isolation_suppression ON compliance_suppression_list
        FOR ALL USING (
            org_id IN (
                SELECT org_id FROM profiles WHERE id = auth.uid()
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'compliance_consent_records' AND policyname = 'org_isolation_consent'
    ) THEN
        CREATE POLICY org_isolation_consent ON compliance_consent_records
        FOR ALL USING (
            org_id IN (
                SELECT org_id FROM profiles WHERE id = auth.uid()
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'compliance_audit_logs' AND policyname = 'org_isolation_audit'
    ) THEN
        CREATE POLICY org_isolation_audit ON compliance_audit_logs
        FOR ALL USING (
            org_id IN (
                SELECT org_id FROM profiles WHERE id = auth.uid()
            )
        );
    END IF;
END $$;

-- 24. PHASE 15: BACKEND BORING RELIABILITY & INVARIANT ENFORCEMENT
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_org_active 
    ON appointments(org_id) 
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_org_active_slot 
    ON appointments(org_id, start_time) 
    WHERE status IN ('requested', 'confirmed', 'scheduled') AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_org_stripe_pi 
    ON payments(org_id, stripe_payment_intent_id) 
    WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_org_stripe_cs 
    ON payments(org_id, stripe_checkout_session_id) 
    WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_org_call_control_id 
    ON calls(org_id, telnyx_call_control_id) 
    WHERE telnyx_call_control_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calls_org_session_id 
    ON calls(org_id, call_session_id) 
    WHERE call_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_requests_org_job 
    ON review_requests(org_id, job_id) 
    WHERE job_id IS NOT NULL AND status != 'suppressed';

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_delivery_status_check;
ALTER TABLE messages ADD CONSTRAINT messages_delivery_status_check
    CHECK (delivery_status IN ('queued', 'sending', 'sent', 'delivered', 'failed', 'received', 'undelivered'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_org_email 
    ON profiles(org_id, LOWER(email));
