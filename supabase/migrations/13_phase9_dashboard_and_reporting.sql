-- ==============================================================================
-- PHASE 9: DASHBOARD + REPORTING SPECIALIST MIGRATION
-- Performance indexes for real-time attention queue and outcome metric queries
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_quotes_org_status_expires ON quotes(org_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_appointments_org_status_start ON appointments(org_id, status, start_time);
CREATE INDEX IF NOT EXISTS idx_jobs_org_scheduled_start ON jobs(org_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status_due ON invoices(org_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_conversations_org_unread ON conversations(org_id, unread_count);
CREATE INDEX IF NOT EXISTS idx_leads_org_status_created ON leads(org_id, status, created_at);
