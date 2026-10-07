-- ==============================================================================
-- CAPTODESK MIGRATION 19: PHASE 2 BACKEND RELIABILITY & DATA INTEGRITY
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. WEBHOOK IDEMPOTENCY ENFORCEMENT (STRIPE & TELNYX)
-- Enforces provider-scoped atomic uniqueness on incoming webhook event IDs
-- ------------------------------------------------------------------------------
ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS provider_event_id TEXT;
ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_events_provider_event 
    ON processed_events(provider, COALESCE(provider_event_id, id));


-- ------------------------------------------------------------------------------
-- 2. MISSED-CALL LEAD ENHANCEMENTS
-- Adds missed_call_count to track repeated caller attempts without duplicate leads
-- ------------------------------------------------------------------------------
ALTER TABLE leads ADD COLUMN IF NOT EXISTS missed_call_count INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_leads_org_contact_open 
    ON leads(org_id, contact_id, status) 
    WHERE status IN ('new', 'contacted');


-- ------------------------------------------------------------------------------
-- 3. ATOMIC QUOTE CREATION TRANSACTION (QUOTES + LINE ITEMS)
-- Guarantees all-or-nothing insertion so quotes are never orphaned without line items
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_quote_with_items(
    p_org_id UUID,
    p_contact_id UUID,
    p_lead_id UUID,
    p_quote_number TEXT,
    p_title TEXT,
    p_description TEXT,
    p_subtotal NUMERIC,
    p_tax NUMERIC,
    p_discount NUMERIC,
    p_total NUMERIC,
    p_expires_at TIMESTAMPTZ,
    p_manage_token TEXT,
    p_notes TEXT,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_quote_id UUID;
    v_quote RECORD;
    v_item JSONB;
    v_inserted_items JSONB := '[]'::jsonb;
    v_item_record RECORD;
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Quote must include at least one line item';
    END IF;

    -- 1. Insert Quote Record
    INSERT INTO quotes (
        org_id, contact_id, lead_id, quote_number, title, description,
        subtotal, tax, discount, total, status, expires_at, manage_token, notes
    )
    VALUES (
        p_org_id, p_contact_id, p_lead_id, p_quote_number, p_title, p_description,
        p_subtotal, p_tax, p_discount, p_total, 'draft', p_expires_at, p_manage_token, p_notes
    )
    RETURNING * INTO v_quote;

    v_quote_id := v_quote.id;

    -- 2. Insert Line Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO quote_items (
            quote_id, org_id, description, quantity, unit_price, total
        )
        VALUES (
            v_quote_id,
            p_org_id,
            (v_item->>'description')::TEXT,
            (v_item->>'quantity')::NUMERIC,
            (v_item->>'unit_price')::NUMERIC,
            (v_item->>'total')::NUMERIC
        )
        RETURNING * INTO v_item_record;

        v_inserted_items := v_inserted_items || to_jsonb(v_item_record);
    END LOOP;

    RETURN jsonb_build_object(
        'quote', to_jsonb(v_quote),
        'items', v_inserted_items
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$;


-- ------------------------------------------------------------------------------
-- 4. ATOMIC INVOICE CREATION TRANSACTION (INVOICES + LINE ITEMS)
-- Guarantees atomic insertion so invoices and line items succeed or fail together
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_invoice_with_items(
    p_org_id UUID,
    p_contact_id UUID,
    p_job_id UUID,
    p_quote_id UUID,
    p_invoice_number TEXT,
    p_title TEXT,
    p_description TEXT,
    p_subtotal NUMERIC,
    p_tax NUMERIC,
    p_discount NUMERIC,
    p_total NUMERIC,
    p_due_date TIMESTAMPTZ,
    p_manage_token TEXT,
    p_notes TEXT,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invoice_id UUID;
    v_invoice RECORD;
    v_item JSONB;
    v_inserted_items JSONB := '[]'::jsonb;
    v_item_record RECORD;
BEGIN
    -- 1. Insert Invoice Parent
    INSERT INTO invoices (
        org_id, contact_id, job_id, quote_id, invoice_number, title, description,
        subtotal, tax, discount, total, amount_paid, amount_due, status,
        due_date, manage_token, notes
    )
    VALUES (
        p_org_id, p_contact_id, p_job_id, p_quote_id, p_invoice_number, p_title, p_description,
        p_subtotal, p_tax, p_discount, p_total, 0.00, p_total, 'draft',
        p_due_date, p_manage_token, p_notes
    )
    RETURNING * INTO v_invoice;

    v_invoice_id := v_invoice.id;

    -- 2. Insert line items if present
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            INSERT INTO invoice_items (
                invoice_id, org_id, description, quantity, unit_price, total
            )
            VALUES (
                v_invoice_id,
                p_org_id,
                (v_item->>'description')::TEXT,
                (v_item->>'quantity')::NUMERIC,
                (v_item->>'unit_price')::NUMERIC,
                (v_item->>'total')::NUMERIC
            )
            RETURNING * INTO v_item_record;

            v_inserted_items := v_inserted_items || to_jsonb(v_item_record);
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'invoice', to_jsonb(v_invoice),
        'items', v_inserted_items
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$;
