-- ==============================================================================
-- CAPTODESK MIGRATION 52: BOOKING ATTRIBUTION, PAGE VIEWS & ACCOUNT CLAIM TRACKING
-- Tracks client account claim milestones and visitor traffic attribution (Google Maps vs Website vs SMS)
-- ==============================================================================

-- 1. Organizations: claim tracking & website url
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS account_claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS website_url TEXT;

-- 2. Profiles: placeholder email flag
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_placeholder_email BOOLEAN DEFAULT false;

-- 3. Appointments: booking traffic channel attribution
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS booking_source TEXT DEFAULT 'direct';

-- 4. Create booking_link_views table for traffic attribution (Google Maps vs Website vs SMS)
CREATE TABLE IF NOT EXISTS public.booking_link_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'direct', -- 'google_maps', 'website', 'sms', 'direct', 'other'
    referrer TEXT,
    referrer_domain TEXT,
    user_agent TEXT,
    ip_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Indexes for fast aggregation
CREATE INDEX IF NOT EXISTS idx_booking_link_views_org_created 
    ON public.booking_link_views(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_link_views_org_source 
    ON public.booking_link_views(org_id, source);

-- 6. Enable RLS
ALTER TABLE public.booking_link_views ENABLE ROW LEVEL SECURITY;

-- Allow public / anon to record page views
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'booking_link_views' AND policyname = 'Allow public insert on booking_link_views'
    ) THEN
        CREATE POLICY "Allow public insert on booking_link_views" 
            ON public.booking_link_views
            FOR INSERT 
            WITH CHECK (true);
    END IF;
END $$;

-- Allow authenticated users and admins to view their organization's page views
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'booking_link_views' AND policyname = 'Allow authenticated read on booking_link_views'
    ) THEN
        CREATE POLICY "Allow authenticated read on booking_link_views" 
            ON public.booking_link_views
            FOR SELECT 
            USING (
                org_id IN (
                    SELECT org_id FROM public.profiles WHERE id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
                )
            );
    END IF;
END $$;
