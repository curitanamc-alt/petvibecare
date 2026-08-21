-- PetVibe Care — migration 004: RBAC cleanup + session expiry.
--
-- * staff.role becomes display-only. The CHECK widens to admit any future
--   job title (front_desk, etc.) and the app no longer branches permission
--   logic on it — access is a binary client/admin decision driven by the
--   session + requireAdmin middleware. The constraint only guards against
--   garbage values.
-- * sessions gain expires_at (7-day default) so stale tokens stop working.
-- * admin_action_log records sensitive admin actions (audit trail).
-- Idempotent; applied automatically at server startup via server/migrations.js
-- or run by hand in the Supabase SQL Editor. `server/schema.sql` already has
-- the new shape for fresh installs.

ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check
  CHECK (role IN ('admin', 'vet', 'groomer', 'front_desk')); -- display-only, add more freely later

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days';
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS admin_action_log (
  log_id      SERIAL PRIMARY KEY,
  staff_id    INTEGER REFERENCES staff(staff_id),
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
