-- ────────────────────────────────────────────────────────
-- 016: Authoritative derive-days trigger on timesheet_entries
-- ────────────────────────────────────────────────────────
--
-- Background:
--   Days (time_value) should always be derived from hours (time_hours) and
--   the user's day rate for the project (user_projects.hours_per_day). Until
--   now the derivation lived only in the frontend, which meant any edit path
--   that forgot to include time_value on the update would leave stale days in
--   the row. That was the source of drift (e.g. 1hr showing as 1.07d).
--
-- What this migration does:
--   1. Adds a BEFORE INSERT OR UPDATE trigger that recomputes time_value and
--      time_block from time_hours and the project's hours_per_day. The trigger
--      is authoritative: it overrides whatever time_value the caller supplies.
--   2. On INSERT, raises if hours_per_day can't be resolved. On UPDATE, only
--      raises if time_hours or project_id is changing, so that status-only
--      updates on historic entries (sign off, return) never break.
--   3. Runs a one-off self-heal pass to correct any existing drifted rows.
--      This only touches rows whose user/project still has a valid rate. Any
--      "orphaned" rows (user no longer on the project) are listed in a notice.
--
-- Depends on:
--   Migration 015 (hours_per_day NOT NULL + CHECK > 0) for the user_projects
--   guarantee. This migration must run after 015.
--
-- ────────────────────────────────────────────────────────

-- 1. Trigger function
CREATE OR REPLACE FUNCTION timesheet_entries_derive_days()
RETURNS TRIGGER AS $$
DECLARE
  v_hours_per_day NUMERIC;
  v_rounded NUMERIC;
  v_needs_calc BOOLEAN;
BEGIN
  -- Nothing to derive if there are no hours on the row.
  IF NEW.time_hours IS NULL OR NEW.time_hours = 0 THEN
    RETURN NEW;
  END IF;

  -- Look up the user's day rate for this project.
  SELECT up.hours_per_day INTO v_hours_per_day
  FROM user_projects up
  WHERE up.user_id = NEW.user_id
    AND up.project_id = NEW.project_id;

  -- Decide whether we must recompute on this operation.
  --   INSERT: always
  --   UPDATE where time_hours or project_id is changing: always
  --   UPDATE where neither is changing (status-only): only if a rate is
  --     resolvable, so we self-heal on any touch without blocking sign-off
  --     of historic entries whose user-project row no longer exists.
  IF TG_OP = 'INSERT' THEN
    v_needs_calc := TRUE;
  ELSIF NEW.time_hours IS DISTINCT FROM OLD.time_hours
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    v_needs_calc := TRUE;
  ELSE
    v_needs_calc := FALSE;
  END IF;

  -- If we need a calc but can't resolve a rate, refuse the write.
  IF v_needs_calc AND (v_hours_per_day IS NULL OR v_hours_per_day <= 0) THEN
    RAISE EXCEPTION
      'Cannot derive days for timesheet entry: user % is not assigned to project %, or the assignment has no hours_per_day rate set.',
      NEW.user_id, NEW.project_id
      USING HINT = 'Assign the user to the project with a valid hours-per-day rate before saving this entry.';
  END IF;

  -- On a status-only update where the user-project was removed, leave the
  -- stored time_value alone. We can't do better without a rate.
  IF v_hours_per_day IS NULL OR v_hours_per_day <= 0 THEN
    RETURN NEW;
  END IF;

  -- Authoritative recompute. Overrides whatever the caller supplied.
  NEW.time_value := NEW.time_hours / v_hours_per_day;

  -- Match the frontend daysToTimeBlock label (round UP to nearest 0.25).
  v_rounded := CEIL(NEW.time_value * 4) / 4.0;
  IF v_rounded = 0.25 THEN
    NEW.time_block := 'Quarter Day';
  ELSIF v_rounded = 0.5 THEN
    NEW.time_block := 'Half Day';
  ELSIF v_rounded = 0.75 THEN
    NEW.time_block := 'Three Quarter Day';
  ELSIF v_rounded = 1 THEN
    NEW.time_block := 'Day';
  ELSE
    NEW.time_block := to_char(v_rounded, 'FM990.00') || ' Days';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Wire the trigger. Drop first so the migration is idempotent.
DROP TRIGGER IF EXISTS trg_timesheet_entries_derive_days ON timesheet_entries;

CREATE TRIGGER trg_timesheet_entries_derive_days
  BEFORE INSERT OR UPDATE ON timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION timesheet_entries_derive_days();

-- 3. One-off self-heal pass for historic entries.
--    This fires the trigger on every matched row, which will recompute
--    time_value and time_block from the canonical source. We only touch rows
--    where the user is still assigned to the project, to avoid the trigger
--    raising on orphaned entries.
DO $$
DECLARE
  v_healed INTEGER;
  v_orphaned INTEGER;
BEGIN
  -- Heal rows with a resolvable rate.
  UPDATE timesheet_entries te
  SET time_hours = te.time_hours  -- no-op on value, but fires the trigger
  FROM user_projects up
  WHERE te.user_id = up.user_id
    AND te.project_id = up.project_id
    AND te.time_hours IS NOT NULL
    AND te.time_hours > 0
    AND up.hours_per_day IS NOT NULL
    AND up.hours_per_day > 0;

  GET DIAGNOSTICS v_healed = ROW_COUNT;

  -- Count orphaned rows that couldn't be healed. These are entries whose
  -- user-project assignment has since been removed. They are not touched.
  SELECT COUNT(*) INTO v_orphaned
  FROM timesheet_entries te
  LEFT JOIN user_projects up
    ON up.user_id = te.user_id AND up.project_id = te.project_id
  WHERE te.time_hours IS NOT NULL
    AND te.time_hours > 0
    AND (up.hours_per_day IS NULL OR up.hours_per_day <= 0);

  RAISE NOTICE 'Self-heal pass: % row(s) refreshed, % orphaned row(s) skipped.', v_healed, v_orphaned;
END $$;
