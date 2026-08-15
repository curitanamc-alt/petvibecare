-- PetVibe Care — migration 002: widen the pets species enum.
--
-- Adds rabbit / guinea pig / fancy rat / bird / pig as first-class species.
-- Idempotent, so it can be run from the Supabase SQL Editor against an
-- existing database or applied automatically at server startup via
-- server/migrations.js. `server/schema.sql` already has the new constraint
-- for fresh installs.

ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_species_check;
ALTER TABLE pets ADD CONSTRAINT pets_species_check CHECK (species IN ('dog', 'cat', 'rabbit', 'guinea_pig', 'rat', 'bird', 'pig', 'other'));
