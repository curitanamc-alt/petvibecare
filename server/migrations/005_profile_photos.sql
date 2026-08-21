-- PetVibe Care — migration 005: profile photos for clients and staff.
--
-- Photos are stored as base64 data URLs in a photo_url TEXT column (the pets
-- table already had one). No external file storage — the same column serves
-- the client portal profile, the admin Team page, and pet photos everywhere.
-- Idempotent; applied automatically at server startup via server/migrations.js
-- or run by hand in the Supabase SQL Editor. `server/schema.sql` already has
-- the new shape for fresh installs.

ALTER TABLE owners ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE staff  ADD COLUMN IF NOT EXISTS photo_url TEXT;
