-- PetVibe Care — database schema (Postgres / Supabase)
-- Ported from server/schema.sql (SQLite). Run this once in the Supabase
-- SQL Editor (or via `psql $DATABASE_URL -f schema.sql`) to create all tables.

CREATE TABLE IF NOT EXISTS owners (
  owner_id     SERIAL PRIMARY KEY,
  full_name    TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  phone        TEXT NOT NULL,
  password_hash TEXT,
  address      TEXT,
  account_type TEXT NOT NULL DEFAULT 'registered' CHECK (account_type IN ('registered', 'walk_in')),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  photo_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pets (
  pet_id      SERIAL PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES owners(owner_id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  species     TEXT NOT NULL DEFAULT 'dog' CHECK (species IN ('dog', 'cat', 'rabbit', 'guinea_pig', 'rat', 'bird', 'pig', 'other')),
  breed       TEXT,
  gender      TEXT CHECK (gender IN ('male', 'female')),
  birthdate   TEXT,
  weight_kg   REAL,
  photo_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff (
  staff_id        SERIAL PRIMARY KEY,
  full_name       TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('admin', 'vet', 'groomer', 'front_desk')), -- display-only job title, never gates access
  email           TEXT UNIQUE,
  password_hash   TEXT,
  specialization  TEXT,
  photo_url       TEXT,
  active          INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS services (
  service_id            SERIAL PRIMARY KEY,
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL,
  description           TEXT,
  price_min             REAL NOT NULL DEFAULT 0,
  price_max             REAL,
  duration_minutes      INTEGER,
  requires_fasting      INTEGER NOT NULL DEFAULT 0,
  requires_anesthesia   INTEGER NOT NULL DEFAULT 0,
  recovery_time_hours   REAL,
  weight_requirement    TEXT,
  weight_tier           TEXT,
  client_bookable       INTEGER NOT NULL DEFAULT 0,
  active                INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS bundles (
  bundle_id        SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT,
  price            REAL NOT NULL,
  discount_percent REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bundle_services (
  bundle_id  INTEGER NOT NULL REFERENCES bundles(bundle_id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(service_id) ON DELETE CASCADE,
  PRIMARY KEY (bundle_id, service_id)
);

CREATE TABLE IF NOT EXISTS staff_schedules (
  schedule_id SERIAL PRIMARY KEY,
  staff_id    INTEGER NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  schedule_date TEXT,
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL,
  is_available INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS bookings (
  booking_id     SERIAL PRIMARY KEY,
  reference_code TEXT UNIQUE NOT NULL,
  owner_id       INTEGER NOT NULL REFERENCES owners(owner_id),
  pet_id         INTEGER NOT NULL REFERENCES pets(pet_id),
  service_id     INTEGER NOT NULL REFERENCES services(service_id),
  staff_id       INTEGER REFERENCES staff(staff_id),
  booking_date   TEXT NOT NULL,
  booking_time   TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show', 'rebooked')),
  created_by     TEXT NOT NULL DEFAULT 'client' CHECK (created_by IN ('client', 'admin')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medical_records (
  record_id         SERIAL PRIMARY KEY,
  pet_id            INTEGER NOT NULL REFERENCES pets(pet_id) ON DELETE CASCADE,
  booking_id        INTEGER REFERENCES bookings(booking_id),
  visit_date        TEXT NOT NULL,
  staff_id          INTEGER REFERENCES staff(staff_id),
  diagnosis         TEXT,
  treatment_notes   TEXT,
  vaccinations_given TEXT,
  weight_at_visit   REAL,
  next_due_date     TEXT,
  record_type       TEXT CHECK (record_type IN ('vaccination', 'checkup', 'surgery', 'grooming', 'other')),
  title             TEXT,
  attachments       JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id SERIAL PRIMARY KEY,
  owner_id        INTEGER REFERENCES owners(owner_id),
  staff_id        INTEGER REFERENCES staff(staff_id),
  booking_id      INTEGER REFERENCES bookings(booking_id),
  type            TEXT NOT NULL CHECK (type IN ('confirmation', 'rebooking', 'reminder', 'reschedule', 'booking_received')),
  channel         TEXT NOT NULL DEFAULT 'email',
  subject         TEXT,
  message_body    TEXT,
  read_at         TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  owner_id   INTEGER REFERENCES owners(owner_id) ON DELETE CASCADE,
  staff_id   INTEGER REFERENCES staff(staff_id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Audit trail for sensitive admin actions (suspend, password reset, staff mgmt).
CREATE TABLE IF NOT EXISTS admin_action_log (
  log_id      SERIAL PRIMARY KEY,
  staff_id    INTEGER REFERENCES staff(staff_id),
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_owner   ON bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date    ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_pets_owner       ON pets(owner_id);
CREATE INDEX IF NOT EXISTS idx_records_pet      ON medical_records(pet_id);

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