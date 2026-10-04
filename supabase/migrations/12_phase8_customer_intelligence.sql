-- ==============================================================================
-- PHASE 8: CUSTOMER DATABASE & LIFECYCLE INTELLIGENCE
-- ==============================================================================

-- Performance indexes for fast customer aggregation and timeline synthesis
CREATE INDEX IF NOT EXISTS idx_payments_contact ON payments(contact_id);
CREATE INDEX IF NOT EXISTS idx_quotes_contact ON quotes(contact_id);
CREATE INDEX IF NOT EXISTS idx_jobs_contact ON jobs(contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_contact ON appointments(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_contact ON review_requests(contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org_phone ON contacts(org_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_org_email ON contacts(org_id, email);
