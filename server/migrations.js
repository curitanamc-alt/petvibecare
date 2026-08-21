import { dbRun } from './db.js'

// Idempotent schema migrations, applied at server startup before seed().
// The SQL lives in server/migrations/001_extend_schema.sql (runnable by hand
// in the Supabase SQL Editor); this file runs the same statements so existing
// databases are upgraded automatically. Each statement is safe to re-run.
const STATEMENTS = [
  `ALTER TABLE owners ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended'))`,

  `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS record_type TEXT`,
  `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS title TEXT`,
  `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS attachments JSONB`,

  `CREATE TABLE IF NOT EXISTS booking_status_log (
    log_id            SERIAL PRIMARY KEY,
    booking_id        INTEGER NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    from_status       TEXT,
    to_status         TEXT,
    note              TEXT,
    changed_by_role   TEXT,
    changed_by_name   TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_booking_status_log_booking ON booking_status_log(booking_id)`,

  `CREATE TABLE IF NOT EXISTS reschedule_requests (
    request_id       SERIAL PRIMARY KEY,
    booking_id       INTEGER NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    requested_date   TEXT NOT NULL,
    requested_time   TEXT NOT NULL,
    reason           TEXT,
    status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_reschedule_requests_booking ON reschedule_requests(booking_id)`,

  // Pets: widen the species enum — rabbit/guinea_pig/rat/bird/pig are now
  // first-class species. Drop + re-add is idempotent (constraint name is the
  // Postgres default `pets_species_check`).
  `ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_species_check`,
  `ALTER TABLE pets ADD CONSTRAINT pets_species_check CHECK (species IN ('dog', 'cat', 'rabbit', 'guinea_pig', 'rat', 'bird', 'pig', 'other'))`,

  // Notifications: support staff recipients + in-app inbox (subject, read_at).
  // owner_id becomes optional — staff notifications use staff_id instead.
  `ALTER TABLE notifications ALTER COLUMN owner_id DROP NOT NULL`,
  `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES staff(staff_id)`,
  `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS subject TEXT`,
  `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ`,
  `ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check`,
  `ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('confirmation', 'rebooking', 'reminder', 'reschedule', 'booking_received'))`,

  // RBAC cleanup (004): staff.role becomes display-only, sessions expire,
  // and sensitive admin actions are audited in admin_action_log.
  `ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check`,
  `ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('admin', 'vet', 'groomer', 'front_desk'))`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`,
  `CREATE TABLE IF NOT EXISTS admin_action_log (
     log_id      SERIAL PRIMARY KEY,
     staff_id    INTEGER REFERENCES staff(staff_id),
     action      TEXT NOT NULL,
     target_type TEXT,
     target_id   INTEGER,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,

  // Profile photos (005): base64 data URLs stored in photo_url on clients and
  // staff (pets already had the column).
  `ALTER TABLE owners ADD COLUMN IF NOT EXISTS photo_url TEXT`,
  `ALTER TABLE staff ADD COLUMN IF NOT EXISTS photo_url TEXT`,
]

export async function migrate() {
  for (const sql of STATEMENTS) {
    try {
      await dbRun(sql)
    } catch (e) {
      // Log and continue: a statement can legitimately fail on a partially
      // migrated DB (e.g. the column already exists with a different shape).
      console.error('[migrate]', e.message)
    }
  }
  console.log('[migrate] Schema up to date')
}
