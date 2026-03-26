-- ============================================================
-- Migration 009: Hours-based time entry
-- ============================================================
-- Changes time entry from 0.25 day increments to 0.5hr increments.
-- Users log hours; the system converts to days using hours_per_day
-- set on each user-project assignment.
--
-- IMPORTANT: After running this migration, you MUST set hours_per_day
-- on all existing user_projects rows before running the data conversion
-- at the bottom. The conversion will SKIP any entries where
-- hours_per_day is not set.
-- ============================================================

-- 1. Add hours_per_day to user_projects (required for conversion calc)
--    NOT NULL is NOT enforced yet so existing rows aren't broken.
--    After backfilling, run the ALTER at the bottom to enforce NOT NULL.
ALTER TABLE user_projects
  ADD COLUMN IF NOT EXISTS hours_per_day NUMERIC(4,2);

-- 2. Add time_hours column to timesheet_entries
--    This stores the raw hours the user logged (e.g. 3.5)
ALTER TABLE timesheet_entries
  ADD COLUMN IF NOT EXISTS time_hours NUMERIC(5,2);

-- 3. Relax the time_value constraint to allow values > 1
--    (a single entry can now exceed 1 day if hours are large)
--    First drop the old check, then add a new one.
ALTER TABLE timesheet_entries
  DROP CONSTRAINT IF EXISTS timesheet_entries_time_value_check;

ALTER TABLE timesheet_entries
  ADD CONSTRAINT timesheet_entries_time_value_check
  CHECK (time_value > 0);

-- 4. Add a check that time_hours is positive when present
ALTER TABLE timesheet_entries
  ADD CONSTRAINT timesheet_entries_time_hours_check
  CHECK (time_hours IS NULL OR time_hours > 0);

-- ============================================================
-- STEP A: Set hours_per_day on all existing user_projects
-- ============================================================
-- YOU MUST DO THIS MANUALLY or via the Admin UI before proceeding.
-- Example:
--   UPDATE user_projects SET hours_per_day = 7.5 WHERE hours_per_day IS NULL;
--
-- Once set, continue to Step B.

-- ============================================================
-- STEP B: Convert existing day-based entries to hours
-- ============================================================
-- This calculates time_hours = time_value * hours_per_day
-- Only runs for entries that have a project_id with hours_per_day set.

UPDATE timesheet_entries te
SET time_hours = te.time_value * up.hours_per_day
FROM user_projects up
WHERE te.project_id = up.project_id
  AND te.user_id = up.user_id
  AND up.hours_per_day IS NOT NULL
  AND te.time_hours IS NULL;

-- ============================================================
-- STEP C: Enforce NOT NULL on hours_per_day after backfill
-- ============================================================
-- Uncomment and run after confirming all user_projects have hours_per_day set:
--
-- ALTER TABLE user_projects
--   ALTER COLUMN hours_per_day SET NOT NULL;
--
-- ALTER TABLE user_projects
--   ADD CONSTRAINT user_projects_hours_per_day_check
--   CHECK (hours_per_day > 0);

-- ============================================================
-- 5. Update get_admin_summary to include total_hours
-- ============================================================
-- Must drop first because the return type is changing (adding total_hours)
DROP FUNCTION IF EXISTS get_admin_summary(DATE);

CREATE OR REPLACE FUNCTION get_admin_summary(p_month_start DATE)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  total_days NUMERIC,
  total_hours NUMERIC,
  entry_count BIGINT,
  draft_count BIGINT,
  submitted_count BIGINT,
  signed_off_count BIGINT,
  is_signed_off BOOLEAN,
  signed_off_by_name TEXT,
  signed_off_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT is_manager_or_admin() THEN
    RAISE EXCEPTION 'Only resource managers or admins can view the admin summary';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.full_name,
    p.email,
    COALESCE(SUM(e.time_value), 0) AS total_days,
    COALESCE(SUM(e.time_hours), 0) AS total_hours,
    COUNT(e.id) AS entry_count,
    COUNT(e.id) FILTER (WHERE e.status = 'draft') AS draft_count,
    COUNT(e.id) FILTER (WHERE e.status = 'submitted') AS submitted_count,
    COUNT(e.id) FILTER (WHERE e.status = 'signed_off') AS signed_off_count,
    (ms.id IS NOT NULL) AS is_signed_off,
    signer.full_name AS signed_off_by_name,
    ms.signed_off_at
  FROM profiles p
  LEFT JOIN timesheet_entries e
    ON e.user_id = p.id
    AND e.entry_date >= p_month_start
    AND e.entry_date < (p_month_start + INTERVAL '1 month')::date
  LEFT JOIN monthly_signoffs ms
    ON ms.user_id = p.id AND ms.month_start = p_month_start
  LEFT JOIN profiles signer
    ON signer.id = ms.signed_off_by
  WHERE p.role = 'user' OR e.id IS NOT NULL
  GROUP BY p.id, p.full_name, p.email, ms.id, signer.full_name, ms.signed_off_at
  ORDER BY p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
