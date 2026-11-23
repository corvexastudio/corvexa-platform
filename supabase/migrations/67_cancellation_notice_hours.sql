-- Migration 67: Add cancellation_notice_hours to organizations
-- Configurable minimum hours notice required before an appointment arrival window
-- for customer self-service cancellation via the Appointment Manager portal.
-- Default is 2 hours. 0 indicates cancellation permitted anytime until technician departs.

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS cancellation_notice_hours INT DEFAULT 2;
