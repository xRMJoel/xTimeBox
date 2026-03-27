-- ============================================================
-- Migration 012: Re-add returned_count to get_admin_summary
-- ============================================================
-- Migration 009 dropped and recreated get_admin_summary to add
-- total_hours, but accidentally removed the returned_count column
-- that migration 004 added. This restores it.
-- ============================================================

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
    COALESCE(SUM(e.time_hours), 0) AS total_hours,
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
