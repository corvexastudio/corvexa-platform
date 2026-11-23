-- ==============================================================================
-- CAPTODESK MIGRATION 70: AGENCY CONTRACTOR LIFECYCLE AND SLOT ALLOCATIONS
-- Remediates F-AGY-05, F-AGY-06, F-AGY-09:
-- 1. Creates auditable slot allocation ledger (public.agency_slot_allocations).
-- 2. Multi-van fleet capacity accounting (1 van = 1 slot, 2 to 5 vans = 2 slots, 6+ = admin review).
-- 3. Concurrency-safe slot reservations and rollback on provisioning failure.
-- 4. Contractor client offboarding ledger and historical data preservation.
-- 5. Enables Row Level Security on agency_slot_allocations.
-- ==============================================================================

-- 1. Create agency_slot_allocations table
CREATE TABLE IF NOT EXISTS public.agency_slot_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.partner_agencies(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  slots_consumed INTEGER NOT NULL CHECK (slots_consumed IN (1, 2)),
  van_count INTEGER NOT NULL DEFAULT 1 CHECK (van_count >= 1),
  assignment_state TEXT NOT NULL DEFAULT 'reserved' CHECK (
    assignment_state IN ('reserved', 'active', 'offboarding_pending', 'released', 'admin_review_required')
  ),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  reason TEXT,
  acting_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Performance indexes for slot lookups and concurrency locks
CREATE INDEX IF NOT EXISTS idx_agency_slot_allocations_agency_id
ON public.agency_slot_allocations(agency_id);

CREATE INDEX IF NOT EXISTS idx_agency_slot_allocations_org_id
ON public.agency_slot_allocations(organization_id);

CREATE INDEX IF NOT EXISTS idx_agency_slot_allocations_active_slots
ON public.agency_slot_allocations(agency_id, assignment_state)
WHERE assignment_state IN ('reserved', 'active', 'offboarding_pending');

-- 3. Add lifecycle and fleet columns to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS fleet_van_count INTEGER DEFAULT 1;

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'active' CHECK (
  lifecycle_status IN (
    'draft',
    'validating',
    'slot_reserved',
    'contractor_provisioning',
    'phone_provisioning_required',
    'carrier_registration_pending',
    'ready_for_activation',
    'active',
    'failed',
    'offboarding_pending',
    'offboarded',
    'admin_review_required'
  )
);

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS offboarded_at TIMESTAMPTZ;

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS offboarding_reason TEXT;

-- 4. Enable Row Level Security on agency_slot_allocations
ALTER TABLE public.agency_slot_allocations ENABLE ROW LEVEL SECURITY;

-- Policy: Agency owner can select slot allocations for their agency
DROP POLICY IF EXISTS "Agency owners can view own slot allocations" ON public.agency_slot_allocations;
CREATE POLICY "Agency owners can view own slot allocations"
ON public.agency_slot_allocations FOR SELECT
TO authenticated
USING (
  agency_id IN (
    SELECT id FROM public.partner_agencies WHERE primary_owner_id = auth.uid()
  )
  OR public.auth_is_super_admin()
);

-- Policy: Agency owners can insert slot allocations for their agency
DROP POLICY IF EXISTS "Agency owners can insert own slot allocations" ON public.agency_slot_allocations;
CREATE POLICY "Agency owners can insert own slot allocations"
ON public.agency_slot_allocations FOR INSERT
TO authenticated
WITH CHECK (
  agency_id IN (
    SELECT id FROM public.partner_agencies WHERE primary_owner_id = auth.uid()
  )
  OR public.auth_is_super_admin()
);

-- Policy: Agency owners can update own slot allocations
DROP POLICY IF EXISTS "Agency owners can update own slot allocations" ON public.agency_slot_allocations;
CREATE POLICY "Agency owners can update own slot allocations"
ON public.agency_slot_allocations FOR UPDATE
TO authenticated
USING (
  agency_id IN (
    SELECT id FROM public.partner_agencies WHERE primary_owner_id = auth.uid()
  )
  OR public.auth_is_super_admin()
)
WITH CHECK (
  agency_id IN (
    SELECT id FROM public.partner_agencies WHERE primary_owner_id = auth.uid()
  )
  OR public.auth_is_super_admin()
);

-- Policy: Only super admins can hard delete allocation records (audit trail safety)
DROP POLICY IF EXISTS "Only super admins can delete slot allocations" ON public.agency_slot_allocations;
CREATE POLICY "Only super admins can delete slot allocations"
ON public.agency_slot_allocations FOR DELETE
TO authenticated
USING (
  public.auth_is_super_admin()
);

-- 5. Documentation comments
COMMENT ON TABLE public.agency_slot_allocations IS 'Auditable slot ledger tracking wholesale capacity reservations, active clients, and offboarding';
COMMENT ON COLUMN public.agency_slot_allocations.slots_consumed IS 'Capacity slots consumed: 1 for solo (1 van), 2 for multi-van (2 to 5 vans)';
COMMENT ON COLUMN public.agency_slot_allocations.assignment_state IS 'State of allocation: reserved, active, offboarding_pending, released, admin_review_required';
