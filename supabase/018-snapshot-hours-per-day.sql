-- ────────────────────────────────────────────────────────
-- 018: Snapshot hours_per_day on each timesheet entry
-- ────────────────────────────────────────────────────────
--
-- Background:
--   Days (time_value) were derived from the live user_projects.hours_per_day
--   on every write. If an admin changed the rate mid-project, the next
--   sign-off or return on a historic entry retroactively recomputed its
--   days against the new rate. Rate changes were unintentionally applied
--   in arrears.
--
-- What this migration does:
--   1. Adds timesheet_entries.hours_per_day_snapshot. Each entry stores the
--      rate that was in force when it was first created.
--   2. Backfills the snapshot for existing rows: from the current
--      user_projects rate where the assignment still exists, otherwise by
--      reverse-engineering it from time_hours / time_value so historic days
--      are preserved exactly.
--   3. Replaces the derive-days trigger so it:
--        - On INSERT, copies the current user_projects rate into the snapshot
--          and derives time_value from it.
--        - On UPDATE that changes project_id or user_id, refreshes the
--          snapshot from the NEW user-project's rate. The entry has been
--          re-attached, so it adopts its new home's rate.
--        - On UPDATE that changes only time_hours, keeps the existing
--          snapshot and recomputes time_value from it. This is what makes
--          rate changes non-retrospective: edits to an old entry stick with
--          its original rate. To pick up a new rate, delete and re-create
--          the entry.
--        - On any other UPDATE (status-only), leaves snapshot, time_value,
--          and time_block alone.
--   4. Adds a CHECK constraint: any row with non-zero hours must have a
--      positive snapshot.
--
-- Manual steps after running:
--   None.
--
-- Depends on:
--   Migrations 015 (NOT NULL + CHECK > 0 on user_projects.hours_per_day) and
--   016 (the trigger this one replaces).
--
-- ────────────────────────────────────────────────────────

-- 1. Add the snapshot column (nullable for the duration of the backfill).
ALTER TABLE timesheet_entries
  ADD COLUMN IF NOT EXISTS hours_per_day_snapshot NUMERIC;

-- 2a. Backfill from the current user_projects rate where the assignment
--     still exists. Only touches rows that are still missing the snapshot.
UPDATE timesheet_entries te
SET hours_per_day_snapshot = up.hours_per_day
FROM user_projects up
WHERE te.user_id = up.user_id
  AND te.project_id = up.project_id
  AND te.hours_per_day_snapshot IS NULL;

-- 2b. Backfill orphan rows by reverse-engineering from existing values.
--     This guarantees historic time_value is preserved exactly.
UPDATE timesheet_entries
SET hours_per_day_snapshot = time_hours / time_value
WHERE hours_per_day_snapshot IS NULL
  AND time_hours IS NOT NULL
  AND time_hours > 0
  AND time_value IS NOT NULL
  AND time_value > 0;

-- 3. Constraint: any row with hours must have a usable snapshot.
ALTER TABLE timesheet_entries
  DROP CONSTRAINT IF EXISTS timesheet_entries_snapshot_with_hours_chk;

ALTER TABLE timesheet_entries
  ADD CONSTRAINT timesheet_entries_snapshot_with_hours_chk
  CHECK (
    time_hours IS NULL
    OR time_hours = 0
    OR (hours_per_day_snapshot IS NOT NULL AND hours_per_day_snapshot > 0)
  );

-- 4. Replace the derive-days trigger function.
CREATE OR REPLACE FUNCTION timesheet_entries_derive_days()
RETURNS TRIGGER AS $$
DECLARE
  v_hours_per_day NUMERIC;
  v_rounded NUMERIC;
  v_refresh_snapshot BOOLEAN;
  v_recompute_days BOOLEAN;
BEGIN
  -- Nothing to derive if there are no hours on the row.
  IF NEW.time_hours IS NULL OR NEW.time_hours = 0 THEN
    RETURN NEW;
  END IF;

  -- Decide what this write should do.
  --   INSERT: refresh snapshot, recompute days.
  --   UPDATE that changes project_id or user_id: refresh snapshot (entry
  --     has been re-attached to a different user-project), recompute days.
  --   UPDATE that changes only time_hours: keep snapshot, recompute days
  --     from existing snapshot. Rate changes are NOT retrospective.
  --   UPDATE otherwise (status-only): no-op.
  IF TG_OP = 'INSERT' THEN
    v_refresh_snapshot := TRUE;
    v_recompute_days   := TRUE;
  ELSIF NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.user_id    IS DISTINCT FROM OLD.user_id THEN
    v_refresh_snapshot := TRUE;
    v_recompute_days   := TRUE;
  ELSIF NEW.time_hours IS DISTINCT FROM OLD.time_hours THEN
    v_refresh_snapshot := FALSE;
    v_recompute_days   := TRUE;
  ELSE
    RETURN NEW;
  END IF;

  -- Refresh the snapshot from the live user_projects rate, if needed.
  IF v_refresh_snapshot THEN
    SELECT up.hours_per_day INTO v_hours_per_day
    FROM user_projects up
    WHERE up.user_id = NEW.user_id
      AND up.project_id = NEW.project_id;

    IF v_hours_per_day IS NULL OR v_hours_per_day <= 0 THEN
      RAISE EXCEPTION
        'Cannot derive days for timesheet entry: user % is not assigned to project %, or the assignment has no hours_per_day rate set.',
        NEW.user_id, NEW.project_id
        USING HINT = 'Assign the user to the project with a valid hours-per-day rate before saving this entry.';
    END IF;

    NEW.hours_per_day_snapshot := v_hours_per_day;
  END IF;

  -- Recompute days from whatever snapshot the row now carries.
  IF NEW.hours_per_day_snapshot IS NULL OR NEW.hours_per_day_snapshot <= 0 THEN
    RAISE EXCEPTION
      'Cannot derive days for timesheet entry: row has no usable hours_per_day_snapshot.'
      USING HINT = 'This is an orphan row that could not be backfilled. Re-create the entry against a current user-project assignment.';
  END IF;

  IF v_recompute_days THEN
    NEW.time_value := NEW.time_hours / NEW.hours_per_day_snapshot;

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
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Rebind the trigger (drop first so the migration is idempotent).
DROP TRIGGER IF EXISTS trg_timesheet_entries_derive_days ON timesheet_entries;
CREATE TRIGGER trg_timesheet_entries_derive_days
  BEFORE INSERT OR UPDATE ON timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION timesheet_entries_derive_days();

-- 6. Sanity report.
DO $$
DECLARE
  v_with_snapshot INTEGER;
  v_orphan_no_snapshot INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_with_snapshot
  FROM timesheet_entries
  WHERE hours_per_day_snapshot IS NOT NULL;

  SELECT COUNT(*) INTO v_orphan_no_snapshot
  FROM timesheet_entries
  WHERE hours_per_day_snapshot IS NULL
    AND time_hours IS NOT NULL
    AND time_hours > 0;

  RAISE NOTICE 'Backfill: % row(s) have a snapshot. % row(s) with hours still have no snapshot (will block on next save).', v_with_snapshot, v_orphan_no_snapshot;
END $$;
