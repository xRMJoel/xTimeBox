-- Add 'returned' to entry_status enum
ALTER TYPE entry_status ADD VALUE IF NOT EXISTS 'returned';

-- Add return_reason and returned_by columns to timesheet_entries
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS return_reason TEXT;
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS returned_by UUID REFERENCES profiles(id);

-- RPC: Return entries for a specific week (admin action)
CREATE OR REPLACE FUNCTION return_week_entries(
  p_user_id UUID,
  p_week_ending DATE,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF NOT is_manager_or_admin() THEN
    RAISE EXCEPTION 'Only resource managers or admins can return entries';
  END IF;

  UPDATE timesheet_entries
  SET status = 'returned',
      return_reason = p_reason,
      returned_by = auth.uid()
  WHERE user_id = p_user_id
  AND week_ending = p_week_ending
  AND status = 'submitted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Return a single entry (admin action)
CREATE OR REPLACE FUNCTION return_entry(
  p_entry_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF NOT is_manager_or_admin() THEN
    RAISE EXCEPTION 'Only resource managers or admins can return entries';
  END IF;

  UPDATE timesheet_entries
  SET status = 'returned',
      return_reason = p_reason,
      returned_by = auth.uid()
  WHERE id = p_entry_id
  AND status = 'submitted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_admin_summary to include returned_count
-- Must DROP first because the return type is changing (added returned_count)
DROP FUNCTION IF EXISTS get_admin_summary(DATE);
CREATE OR REPLACE FUNCTION get_admin_summary(p_month_start DATE)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  total_days NUMERIC,
  entry_count BIGINT,
  draft_count BIGINT,
  submitted_count BIGINT,
  signed_off_count BIGINT,
  returned_count BIGINT,
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
    COUNT(e.id) AS entry_count,
    COUNT(e.id) FILTER (WHERE e.status = 'draft') AS draft_count,
    COUNT(e.id) FILTER (WHERE e.status = 'submitted') AS submitted_count,
    COUNT(e.id) FILTER (WHERE e.status = 'signed_off') AS signed_off_count,
    COUNT(e.id) FILTER (WHERE e.status = 'returned') AS returned_count,
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

-- Update RLS: Users can delete returned entries too
-- Drop and recreate the delete policy to include returned
DROP POLICY IF EXISTS "Users can delete own draft entries" ON timesheet_entries;
CREATE POLICY "Users can delete own draft or returned entries"
  ON timesheet_entries FOR DELETE
  USING (
    user_id = auth.uid()
    AND status IN ('draft', 'returned')
  );
