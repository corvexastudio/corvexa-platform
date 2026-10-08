-- ==============================================================================
-- CAPTODESK MIGRATION 21: BACKEND BORING RELIABILITY & INVARIANT ENFORCEMENT
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. APPOINTMENT SOFT-DELETE & DOUBLE-BOOKING CONCURRENCY PROTECTION
-- Enforces partial unique constraint on active slots so concurrent bookings cannot collide
-- ------------------------------------------------------------------------------
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_org_active 
    ON appointments(org_id) 
    WHERE deleted_at IS NULL;

-- Atomic slot locking: Prevents double-booking at the PostgreSQL engine level
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_org_active_slot 
    ON appointments(org_id, start_time) 
    WHERE status IN ('requested', 'confirmed', 'scheduled') AND deleted_at IS NULL;


-- ------------------------------------------------------------------------------
-- 2. PAYMENT IDEMPOTENCY & DUPLICATE WEBHOOK PROTECTION
-- Prevents double-crediting invoices when Stripe sends both checkout.session.completed 
-- and payment_intent.succeeded or when webhooks retry.
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_org_stripe_pi 
    ON payments(org_id, stripe_payment_intent_id) 
    WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_org_stripe_cs 
    ON payments(org_id, stripe_checkout_session_id) 
    WHERE stripe_checkout_session_id IS NOT NULL;


-- ------------------------------------------------------------------------------
-- 3. MISSED-CALL & TELEPHONY WEBHOOK IDEMPOTENCY
-- Prevents duplicate call records on carrier webhook retries
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_org_call_control_id 
    ON calls(org_id, telnyx_call_control_id) 
    WHERE telnyx_call_control_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calls_org_session_id 
    ON calls(org_id, call_session_id) 
    WHERE call_session_id IS NOT NULL;


-- ------------------------------------------------------------------------------
-- 4. REVIEW REQUEST DEDUPLICATION PER COMPLETED JOB
-- Prevents duplicate review invitation dispatches for the same field-service job
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_requests_org_job 
    ON review_requests(org_id, job_id) 
    WHERE job_id IS NOT NULL AND status != 'suppressed';


-- ------------------------------------------------------------------------------
-- 5. MESSAGING STATE CONSTRAINT HARDENING
-- Restricts message delivery_status to deterministic state machine values
-- ------------------------------------------------------------------------------
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_delivery_status_check;
ALTER TABLE messages ADD CONSTRAINT messages_delivery_status_check
    CHECK (delivery_status IN ('queued', 'sending', 'sent', 'delivered', 'failed', 'received', 'undelivered'));


-- ------------------------------------------------------------------------------
-- 6. TEAM INVITATION & STAFF UNIQUENESS
-- Prevents duplicate profiles for the same email in the same organization
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_org_email 
    ON profiles(org_id, LOWER(email));
