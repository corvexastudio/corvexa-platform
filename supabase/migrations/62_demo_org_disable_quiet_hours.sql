-- Migration 62: Disable TCPA quiet hours suppression on the interactive public Demo org
-- The public toll-free demo (+18777713802) is tested interactively around the clock from multiple timezones.
-- Normal tenant orgs continue to default enforce_quiet_hours = true.

UPDATE organizations
SET
  enforce_quiet_hours = false,
  cooldown_hours = 0,
  updated_at = now()
WHERE id = '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7';
