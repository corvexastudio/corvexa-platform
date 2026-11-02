-- Migration 60: Clean up historical sandbox practice jobs and contacts
-- Soft-deletes test sandbox jobs and practice contacts so real contractor workspaces are clean

-- 1. Soft delete practice jobs
UPDATE jobs 
SET deleted_at = NOW() 
WHERE deleted_at IS NULL 
  AND (
    job_number ILIKE '%PRACTICE%' 
    OR title ILIKE '%[PRACTICE]%'
    OR notes ILIKE '%SANDBOX_PRACTICE_JOB%'
  );

-- 2. Soft delete practice contacts
UPDATE contacts 
SET deleted_at = NOW() 
WHERE deleted_at IS NULL 
  AND (
    name ILIKE '%[PRACTICE]%'
    OR name ILIKE '%Alex Miller (Test Customer)%'
    OR phone = '+15550199999'
  );
