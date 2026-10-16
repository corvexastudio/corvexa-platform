-- Migration 39: Add owner_alert_sent column to calls table for P1-NOTIF-01
ALTER TABLE calls ADD COLUMN IF NOT EXISTS owner_alert_sent BOOLEAN DEFAULT false;
COMMENT ON COLUMN calls.owner_alert_sent IS 'Indicates whether an owner mobile alert SMS was successfully dispatched for this missed call';
