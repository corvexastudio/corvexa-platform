-- Migration 64: Next-Gen Universal Booking Customizer & Priority Dispatch Engine
-- Adds contractor-configurable slot intervals, policy notices, priority fees, and service add-ons.

-- 1. Organizations Booking Customization Columns
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS slot_interval_minutes INT DEFAULT 30,
  ADD COLUMN IF NOT EXISTS booking_notice TEXT,
  ADD COLUMN IF NOT EXISTS booking_notice_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_dispatch_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_dispatch_fee NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS priority_dispatch_label TEXT DEFAULT 'Fast-Track Priority Service',
  ADD COLUMN IF NOT EXISTS how_heard_options TEXT[] DEFAULT ARRAY['Google Maps / Search', 'Instagram / Facebook', 'Friend or Neighbor Referral', 'Saw Your Van / Truck', 'Repeat Customer'];

-- 2. Services Add-Ons Column (JSONB array of { id, name, description, price, duration_minutes })
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS add_ons JSONB DEFAULT '[]'::jsonb;

-- 3. Appointments Priority & Add-On Tracking Columns
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_priority BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_fee NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS selected_add_ons JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS how_heard TEXT;
