-- Migration 63: Partner Agencies and Slot Licensing for B2B Wholesale Distribution
-- Supports agency.captodesk.com and agency command center with slot capacity tracking.

CREATE TABLE IF NOT EXISTS public.partner_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  total_slots INTEGER NOT NULL DEFAULT 10,
  subscription_tier TEXT NOT NULL DEFAULT 'growth_10', -- 'starter_3', 'growth_10', 'scale_25', 'dominance_50'
  subscription_status TEXT NOT NULL DEFAULT 'active', -- 'trial', 'active', 'past_due', 'canceled'
  primary_owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link organizations to their partner agency
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS partner_agency_id UUID REFERENCES public.partner_agencies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_partner_agency_id ON public.organizations(partner_agency_id);

-- Insert default demo agency partner for testing and partner demos
INSERT INTO public.partner_agencies (
  id,
  name,
  slug,
  contact_email,
  contact_phone,
  total_slots,
  subscription_tier,
  subscription_status
) VALUES (
  'a0000000-0000-4000-a000-000000000001',
  'Lokal Media House',
  'lokal-media-house',
  'partners@lmh.agency',
  '+14695550188',
  10,
  'growth_10',
  'active'
) ON CONFLICT (slug) DO NOTHING;
