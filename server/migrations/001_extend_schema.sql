-- PetVibe Care — migration 001: client account management, typed medical
-- records, booking audit trail, and client reschedule requests.
--
-- Idempotent (IF NOT EXISTS) so it can be run against an existing database
-- from the Supabase SQL Editor, or applied automatically at server startup
-- via server/migrations.js. `server/schema.sql` already includes these for
-- fresh installs.

-- 1) Owners: account status (active / suspended)
ALTER TABLE owners ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended'));

-- 2) Medical records: typed records (vaccination / checkup / surgery / grooming / other)
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS record_type TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS attachments JSONB;

-- 3) Booking audit trail — one row per status transition / notable change
CREATE TABLE IF NOT EXISTS booking_status_log (
  log_id            SERIAL PRIMARY KEY,
  booking_id        INTEGER NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  from_status       TEXT,
  to_status         TEXT,
  note              TEXT,
  changed_by_role   TEXT,
  changed_by_name   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_status_log_booking ON booking_status_log(booking_id);

-- 4) Client reschedule requests — staff must approve before the slot moves
CREATE TABLE IF NOT EXISTS reschedule_requests (
  request_id       SERIAL PRIMARY KEY,
  booking_id       INTEGER NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  requested_date   TEXT NOT NULL,
  requested_time   TEXT NOT NULL,
  reason           TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reschedule_requests_booking ON reschedule_requests(booking_id);
