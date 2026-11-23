-- Migration 66: Remove obsolete GPS and geofencing configuration columns from organizations
-- In accordance with complete removal of unfinished vehicle tracking and geofencing.
-- CaptoDesk uses technician-updated status milestones and manual ETA.

ALTER TABLE public.organizations DROP COLUMN IF EXISTS tracking_mode;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS tracking_geofence_miles;
