-- ────────────────────────────────────────────────────────
-- 008: Sign off / unsign-off a single week for a user
-- ────────────────────────────────────────────────────────

-- Sign off all submitted entries for a specific week
CREATE OR REPLACE FUNCTION sign_off_week(
  p_user_id UUID,
  p_week_ending DATE
)
RETURNS VOID AS $$
BEGIN
  IF NOT is_manager_or_admin() THEN
    RAISE EXCEPTION 'Only resource managers or admins can sign off entries';
  END IF;

  UPDATE timesheet_entries
  SET status = 'signed_off'
  WHERE user_id = p_user_id
    AND week_ending = p_week_ending
    AND status = 'submitted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revert a signed-off week back to submitted
CREATE OR REPLACE FUNCTION unsign_off_week(
  p_user_id UUID,
  p_week_ending DATE
)
RETURNS VOID AS $$
BEGIN
  IF NOT is_manager_or_admin() THEN
    RAISE EXCEPTION 'Only resource managers or admins can modify sign-off status';
  END IF;

  UPDATE timesheet_entries
  SET status = 'submitted'
  WHERE user_id = p_user_id
    AND week_ending = p_week_ending
    AND status = 'signed_off';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
