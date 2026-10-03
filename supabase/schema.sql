-- CaptoDesk Multi-Tenant Production Schema
-- Designed for PostgreSQL / Supabase with Row Level Security (RLS)

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ORGANIZATIONS (TENANTS)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_phone TEXT,
    telnyx_phone_number TEXT UNIQUE,
    carrier TEXT DEFAULT 'Unknown',
    is_missed_call_active BOOLEAN DEFAULT true,
    is_review_engine_active BOOLEAN DEFAULT true,
    auto_reply_template TEXT NOT NULL DEFAULT 'Hey, this is {business_name}! We are mid-job and missed your call. How can we help you?',
    after_hours_template TEXT NOT NULL DEFAULT 'Thanks for calling {business_name}. We are currently closed for the evening, but received your message and will call you first thing tomorrow morning.',
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

-- 3. USER PROFILES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    role TEXT DEFAULT 'owner' CHECK (role IN ('super_admin', 'owner', 'dispatcher')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CONTACTS (Homeowners & Clients)
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
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'booked', 'lost')),
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
    status TEXT CHECK (status IN ('missed', 'answered', 'busy', 'failed', 'rejected')),
    duration_seconds INT DEFAULT 0,
    telnyx_call_control_id TEXT,
    auto_reply_sent BOOLEAN DEFAULT false,
    suppression_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

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
    delivery_status TEXT DEFAULT 'queued' CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'failed', 'received')),
    telnyx_message_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. APPOINTMENTS (CALENDAR)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    service_type TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

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
    id TEXT PRIMARY KEY, -- Telnyx event_id
    provider TEXT DEFAULT 'telnyx',
    event_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. INDEXES FOR HIGH-THROUGHPUT REALTIME QUERIES
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

-- 15. ROW-LEVEL SECURITY (RLS) POLICIES
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

-- Helper function to get current user's org_id
CREATE OR REPLACE FUNCTION auth_user_org_id()
RETURNS UUID AS $$
    SELECT org_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Organizations policy: user can read their own org
CREATE POLICY "Users can view their own organization"
ON organizations FOR SELECT
USING (id = auth_user_org_id());

CREATE POLICY "Users can update their own organization"
ON organizations FOR UPDATE
USING (id = auth_user_org_id());

-- Generic tenant isolation policy template
CREATE POLICY "Tenant isolation for contacts" ON contacts
FOR ALL USING (org_id = auth_user_org_id());

CREATE POLICY "Tenant isolation for leads" ON leads
FOR ALL USING (org_id = auth_user_org_id());

CREATE POLICY "Tenant isolation for calls" ON calls
FOR ALL USING (org_id = auth_user_org_id());

CREATE POLICY "Tenant isolation for conversations" ON conversations
FOR ALL USING (org_id = auth_user_org_id());

CREATE POLICY "Tenant isolation for messages" ON messages
FOR ALL USING (org_id = auth_user_org_id());

CREATE POLICY "Tenant isolation for appointments" ON appointments
FOR ALL USING (org_id = auth_user_org_id());

CREATE POLICY "Tenant isolation for automation_settings" ON automation_settings
FOR ALL USING (org_id = auth_user_org_id());

CREATE POLICY "Tenant isolation for activity_logs" ON activity_logs
FOR ALL USING (org_id = auth_user_org_id());
