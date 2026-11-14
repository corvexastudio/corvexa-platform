-- Raise default daily outbound SMS per-recipient limit from 3 to 20
-- to cover full multi-touch job workflows (missed-call recovery, booking confirm,
-- quote, On My Way alert, invoice, payment receipt, review request, and Inbox replies).

ALTER TABLE organizations
ALTER COLUMN max_daily_sms_per_recipient SET DEFAULT 20;

UPDATE organizations
SET max_daily_sms_per_recipient = 20
WHERE max_daily_sms_per_recipient IS NULL
   OR max_daily_sms_per_recipient < 20;
