-- PetVibe Care — migration 003: in-app notifications for clients AND staff.
--
-- Turns the notifications table from a client-only email log into an inbox
-- that both clients and staff can read in-app:
--   * owner_id becomes optional — staff notifications use staff_id instead
--   * adds staff_id, subject (for the bell UI) and read_at (unread tracking)
--   * widens the type enum with 'reschedule' and 'booking_received'
-- Idempotent, so it can be run from the Supabase SQL Editor against an
-- existing database or applied automatically at server startup via
-- server/migrations.js. `server/schema.sql` already has the new shape
-- for fresh installs.

ALTER TABLE notifications ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES staff(staff_id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('confirmation', 'rebooking', 'reminder', 'reschedule', 'booking_received'));
