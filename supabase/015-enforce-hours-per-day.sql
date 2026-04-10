-- ────────────────────────────────────────────────────────
-- 015: Enforce hours_per_day on user_projects
-- ────────────────────────────────────────────────────────
--
-- Background:
--   Migration 009 introduced user_projects.hours_per_day but left it nullable,
--   with the NOT NULL / CHECK step commented out pending a manual backfill.
--   In practice every live assignment has a value, but without a constraint a
--   null could still creep in through direct SQL or a future code path, which
--   would break the derived-days trigger added in migration 016.
--
-- What this migration does:
--   1. Surfaces any user_projects rows that would block the constraint.
--   2. Sets hours_per_day NOT NULL.
--   3. Adds a CHECK constraint that the value is strictly positive.
--
-- Manual steps before running:
--   Run the SELECT in step 1 first. If it returns rows, set a sensible
--   hours_per_day on each offending row (or delete the assignment) BEFORE
--   running steps 2 and 3. The NOT NULL step will fail otherwise.
--
-- ────────────────────────────────────────────────────────

-- 1. Surface any rows that would block the constraint.
--    Run this first and resolve any hits manually before proceeding.
--
-- SELECT up.user_id, up.project_id, p.full_name, pr.name AS project_name, up.hours_per_day
-- FROM user_projects up
-- LEFT JOIN profiles p ON p.id = up.user_id
-- LEFT JOIN projects pr ON pr.id = up.project_id
-- WHERE up.hours_per_day IS NULL OR up.hours_per_day <= 0;

-- 2. Enforce NOT NULL. (Idempotent: SET NOT NULL is a no-op if already set.)
ALTER TABLE user_projects
  ALTER COLUMN hours_per_day SET NOT NULL;

-- 3. Enforce positive value. Drop first so the migration is idempotent — if
--    the constraint was added manually or by a previous partial run, we want
--    to be able to re-run this file cleanly.
ALTER TABLE user_projects
  DROP CONSTRAINT IF EXISTS user_projects_hours_per_day_check;

ALTER TABLE user_projects
  ADD CONSTRAINT user_projects_hours_per_day_check
  CHECK (hours_per_day > 0);
