-- Migration 55: Quote Finger Signature & Photo Intake
-- Supports legally binding canvas finger-signatures and diagnostic intake photos for remote quoting

DO $$
BEGIN
    -- 1. Add signature fields to quotes
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'quotes'
    ) THEN
        ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signature_data TEXT;
        ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signed_by TEXT;
        ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signed_ip TEXT;
    END IF;

    -- 2. Add intake_photos to appointments
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'appointments'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS intake_photos JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

COMMENT ON COLUMN public.quotes.signature_data IS 'Base64 SVG or PNG of customer canvas finger-signature';
COMMENT ON COLUMN public.quotes.signed_by IS 'Full name entered by the customer during electronic signing';
COMMENT ON COLUMN public.quotes.signed_ip IS 'IP address of the client at the time of electronic signature';
COMMENT ON COLUMN public.appointments.intake_photos IS 'Array of customer diagnostic intake photo URLs or data URIs';
