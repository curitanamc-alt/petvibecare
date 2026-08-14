-- PetVibe Care — database schema (mirrors the ERD in the master prompt)
-- SQLite flavor. Ports directly to PostgreSQL/MySQL (swap SERIAL -> IDENTITY,
-- drop the STRICT/CHECK syntax that your dialect doesn't support).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS owners (
  owner_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name    TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  phone        TEXT NOT NULL,
  password_hash TEXT,
  address      TEXT,
  account_type TEXT NOT NULL DEFAULT 'registered' CHECK (account_type IN ('registered', 'walk_in')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pets (
  pet_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    INTEGER NOT NULL REFERENCES owners(owner_id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  species     TEXT NOT NULL DEFAULT 'dog' CHECK (species IN ('dog', 'cat', 'bird', 'rabbit', 'other')),
  breed       TEXT,
  gender      TEXT CHECK (gender IN ('male', 'female')),
  birthdate   TEXT,
  weight_kg   REAL,
  photo_url   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff (
  staff_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name       TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('vet', 'groomer', 'admin')),
  email           TEXT UNIQUE,
  password_hash   TEXT,
  specialization  TEXT,
  active          INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS services (
  service_id            INTEGER PRIMARY KEY AUTOINCREMENT,
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
  client_bookable       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bundles (
  bundle_id        INTEGER PRIMARY KEY AUTOINCREMENT,
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
  schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id    INTEGER NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  schedule_date TEXT,
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL,
  is_available INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS bookings (
  booking_id     INTEGER PRIMARY KEY AUTOINCREMENT,
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
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medical_records (
  record_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  pet_id            INTEGER NOT NULL REFERENCES pets(pet_id) ON DELETE CASCADE,
  booking_id        INTEGER REFERENCES bookings(booking_id),
  visit_date        TEXT NOT NULL,
  staff_id          INTEGER REFERENCES staff(staff_id),
  diagnosis         TEXT,
  treatment_notes   TEXT,
  vaccinations_given TEXT,
  weight_at_visit   REAL,
  next_due_date     TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id        INTEGER NOT NULL REFERENCES owners(owner_id),
  booking_id      INTEGER REFERENCES bookings(booking_id),
  type            TEXT NOT NULL CHECK (type IN ('confirmation', 'rebooking', 'reminder')),
  channel         TEXT NOT NULL DEFAULT 'email',
  sent_at         TEXT NOT NULL DEFAULT (datetime('now')),
  message_body    TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token     TEXT PRIMARY KEY,
  owner_id  INTEGER REFERENCES owners(owner_id) ON DELETE CASCADE,
  staff_id  INTEGER REFERENCES staff(staff_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_owner   ON bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date    ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_pets_owner       ON pets(owner_id);
CREATE INDEX IF NOT EXISTS idx_records_pet      ON medical_records(pet_id);
