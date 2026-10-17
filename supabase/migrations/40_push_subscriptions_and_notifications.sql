-- Migration 40: Push Subscriptions & Centralized Notification Platform
-- Provides tenant-isolated Web Push subscription management and notification delivery tracking.

-- 1. Push Subscriptions Table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    device_label TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_sub_org_user ON push_subscriptions(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_endpoint ON push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_push_sub_active ON push_subscriptions(org_id, is_active);

-- Enable RLS for push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User push subscription isolation" ON push_subscriptions;
CREATE POLICY "User push subscription isolation" ON push_subscriptions FOR ALL TO authenticated
USING (
    ((user_id = auth.uid() AND org_id = auth_user_org_id()) OR auth_is_super_admin())
)
WITH CHECK (
    ((user_id = auth.uid() AND org_id = auth_user_org_id()) OR auth_is_super_admin())
);

-- 2. Extend Existing notifications Table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('critical', 'important', 'normal', 'low'));
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_org_idempotency ON notifications(org_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_event_type ON notifications(org_id, event_type);

-- 3. Notification Deliveries Table (Multi-channel delivery log)
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('push', 'sms', 'in_app', 'email')),
    destination TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    provider_message_id TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for notification_deliveries
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_notif_id ON notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_org ON notification_deliveries(org_id);
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_status ON notification_deliveries(status);

-- Enable RLS for notification_deliveries
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant notification deliveries isolation" ON notification_deliveries;
CREATE POLICY "Tenant notification deliveries isolation" ON notification_deliveries FOR ALL TO authenticated
USING (
    (org_id = auth_user_org_id() OR auth_is_super_admin())
)
WITH CHECK (
    (org_id = auth_user_org_id() OR auth_is_super_admin())
);
