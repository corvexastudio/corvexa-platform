-- ==============================================================================
-- CAPTODESK MIGRATION 33: REAL TELNYX DID PROVISIONING & ORDER TRACKING
-- Adds columns for provider order tracking, verification status, and tenant DID isolation
-- ==============================================================================

-- 1. Extend organizations with Telnyx order tracking columns
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS telnyx_order_id TEXT NULL,
ADD COLUMN IF NOT EXISTS telnyx_phone_number_id TEXT NULL,
ADD COLUMN IF NOT EXISTS telnyx_provisioned_at TIMESTAMPTZ NULL;

-- 2. Extend telnyx_phone_numbers with order tracking and verification status
ALTER TABLE public.telnyx_phone_numbers
ADD COLUMN IF NOT EXISTS order_id TEXT NULL,
ADD COLUMN IF NOT EXISTS telnyx_phone_number_id TEXT NULL,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified';

-- Ensure verification_status check constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'telnyx_phone_numbers_verification_status_check'
    ) THEN
        ALTER TABLE public.telnyx_phone_numbers
        ADD CONSTRAINT telnyx_phone_numbers_verification_status_check
        CHECK (verification_status IN ('verified', 'unverified', 'failed'));
    END IF;
END $$;

-- 3. Enforce single active phone number per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_telnyx_phone_numbers_org_active
    ON public.telnyx_phone_numbers(org_id)
    WHERE (status = 'active');

-- 4. Classify existing records:
-- If a number has a recorded provider order ID or official metadata, mark verified.
-- Otherwise, mark unverified and set status to 'pending' so synthetic numbers
-- cannot be used for outbound SMS or inbound routing.
UPDATE public.telnyx_phone_numbers
SET verification_status = 'unverified',
    status = 'pending'
WHERE order_id IS NULL 
  AND (provisioning_metadata->>'order_id') IS NULL
  AND verification_status = 'unverified';

-- Correspondingly, if an organization's number is unverified, reset provisioning status
UPDATE public.organizations o
SET phone_provisioning_status = 'pending_number'
WHERE o.phone_provisioning_status = 'active'
  AND EXISTS (
      SELECT 1 FROM public.telnyx_phone_numbers tpn
      WHERE tpn.org_id = o.id 
        AND tpn.verification_status = 'unverified'
  );
