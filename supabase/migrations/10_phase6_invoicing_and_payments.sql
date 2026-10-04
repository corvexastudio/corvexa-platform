-- ==============================================================================
-- CAPTODESK MIGRATION 10: PHASE 6 INVOICING + STRIPE SPECIALIST
-- Adds invoices, invoice_items, and payments tables with RLS and indexes.
-- Idempotent and safe for pre-existing tables.
-- ==============================================================================

-- 1. Enable pgcrypto if possible (fallback md5 generator works either way)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. INVOICES TABLE
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
    status TEXT NOT NULL DEFAULT 'draft',
    due_date TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    manage_token TEXT,
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

-- Update invoices status constraint
DO $$
BEGIN
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
    ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
        CHECK (status IN ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'void'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Backfill manage_token for existing invoices
UPDATE invoices 
SET manage_token = md5(random()::text || clock_timestamp()::text || id::text) || md5(random()::text || clock_timestamp()::text) 
WHERE manage_token IS NULL;

ALTER TABLE invoices ALTER COLUMN manage_token SET DEFAULT md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text);
ALTER TABLE invoices ALTER COLUMN manage_token SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname IN ('invoices_manage_token_key', 'invoices_manage_token_unique')
    ) THEN
        ALTER TABLE invoices ADD CONSTRAINT invoices_manage_token_unique UNIQUE (manage_token);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON invoices(org_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_manage_token ON invoices(manage_token);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(job_id);

-- 3. INVOICE ITEMS TABLE
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

-- Ensure all columns exist on pre-existing invoice_items table
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2) DEFAULT 1.00;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- 4. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'usd',
    payment_method TEXT NOT NULL DEFAULT 'stripe',
    status TEXT NOT NULL DEFAULT 'succeeded',
    stripe_payment_intent_id TEXT,
    stripe_checkout_session_id TEXT,
    stripe_receipt_url TEXT,
    reference_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on pre-existing payments table
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

-- Update payments constraints
DO $$
BEGIN
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
    ALTER TABLE payments ADD CONSTRAINT payments_status_check 
        CHECK (status IN ('succeeded', 'pending', 'failed', 'refunded'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
    ALTER TABLE payments ADD CONSTRAINT payments_method_check 
        CHECK (payment_method IN ('stripe', 'cash', 'check', 'card_offline', 'other'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session ON payments(stripe_checkout_session_id);

-- 5. ROW LEVEL SECURITY
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Tenant access policies for invoices
DROP POLICY IF EXISTS "Members can manage their organization invoices" ON invoices;
CREATE POLICY "Members can manage their organization invoices"
ON invoices FOR ALL
USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Tenant access policies for invoice items
DROP POLICY IF EXISTS "Members can manage their organization invoice items" ON invoice_items;
CREATE POLICY "Members can manage their organization invoice items"
ON invoice_items FOR ALL
USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Tenant access policies for payments
DROP POLICY IF EXISTS "Members can manage their organization payments" ON payments;
CREATE POLICY "Members can manage their organization payments"
ON payments FOR ALL
USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));