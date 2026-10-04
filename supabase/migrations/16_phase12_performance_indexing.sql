-- =============================================================================
-- CAPTODESK MIGRATION 16: PHASE 12 PERFORMANCE + DATABASE INDEXING
-- Optimizes query performance, eliminates table scans, and accelerates joins
-- =============================================================================

-- 1. TENANT ISOLATION (organization_id indexes on all operational tables)
CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_appointments_org_id ON appointments(org_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org_id ON jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_org_id ON quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_org_id ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_calls_org_id ON calls(org_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org_id ON conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_org_id ON messages(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads(org_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_org_id ON review_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_id ON activity_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_org_id ON automation_runs(org_id);

-- 2. PHONE LOOKUPS (inbound voice, inbound SMS, contact deduplication, search)
CREATE INDEX IF NOT EXISTS idx_contacts_org_phone ON contacts(org_id, phone);
CREATE INDEX IF NOT EXISTS idx_calls_org_caller ON calls(org_id, caller_number);
CREATE INDEX IF NOT EXISTS idx_telnyx_phone_numbers_phone_org ON telnyx_phone_numbers(phone_number, org_id);

-- 3. EMAIL LOOKUPS (auth resolution, customer search)
CREATE INDEX IF NOT EXISTS idx_contacts_org_email ON contacts(org_id, email);
CREATE INDEX IF NOT EXISTS idx_profiles_email_org ON profiles(email, org_id);

-- 4. CREATED_AT & CHRONOLOGICAL KEYSET CURSORS (pagination, activity feeds, metrics)
CREATE INDEX IF NOT EXISTS idx_contacts_org_created ON contacts(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_org_created ON calls(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_org_created ON messages(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_org_created ON quotes(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_org_created ON jobs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_org_created ON invoices(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_org_created ON payments(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_created ON activity_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_requests_org_created ON review_requests(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_org_created ON leads(org_id, created_at DESC);

-- 5. STATUS FILTERS & ATTENTION QUEUE AGGREGATIONS
CREATE INDEX IF NOT EXISTS idx_contacts_org_lifecycle ON contacts(org_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_calls_org_status ON calls(org_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_org_status ON appointments(org_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_org_status ON quotes(org_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_org_status ON jobs(org_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON invoices(org_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_org_status ON payments(org_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON leads(org_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_org_unread ON conversations(org_id, unread_count);
CREATE INDEX IF NOT EXISTS idx_review_requests_org_status ON review_requests(org_id, status);

-- 6. APPOINTMENT TIME (calendar queries, conflict detection, availability slots)
CREATE INDEX IF NOT EXISTS idx_appointments_org_time ON appointments(org_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_appointments_org_start ON appointments(org_id, start_time);

-- 7. JOB STATUS & SCHEDULED TIME (today's dispatching, status pipeline)
CREATE INDEX IF NOT EXISTS idx_jobs_org_status_scheduled ON jobs(org_id, status, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_jobs_org_scheduled_start ON jobs(org_id, scheduled_start);

-- 8. INVOICE STATUS & DUE DATE (overdue tracking, payment collection)
CREATE INDEX IF NOT EXISTS idx_invoices_org_status_due ON invoices(org_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_org_due_date ON invoices(org_id, due_date);

-- 9. AUTOMATION SCHEDULED TIME (worker queue polling, partial active index)
CREATE INDEX IF NOT EXISTS idx_automation_runs_queue_status_sched ON automation_runs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_automation_runs_org_sched ON automation_runs(org_id, scheduled_at);

-- 10. PROVIDER EVENT ID (instant O(1) webhook idempotency lookups)
CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_events_provider_event ON processed_events(provider, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_messages_telnyx_id ON messages(telnyx_message_id);

-- 11. FOREIGN KEY JOIN INDEXES (eliminates table scans on parent-child queries)
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_job_items_job_id ON job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_contact_id ON quotes(contact_id);
CREATE INDEX IF NOT EXISTS idx_jobs_contact_id ON jobs(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_contact_id ON payments(contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_contact_id ON appointments(contact_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_contact_id ON review_requests(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id);

-- 12. RETENTION & SERVICE FOLLOW-UP DATES
CREATE INDEX IF NOT EXISTS idx_contacts_org_next_service ON contacts(org_id, next_expected_service_date);
CREATE INDEX IF NOT EXISTS idx_contacts_org_last_service ON contacts(org_id, last_service_date DESC);
