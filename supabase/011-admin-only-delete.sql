-- ============================================================
-- Migration 011: Restrict destructive user operations to admin only
-- ============================================================
-- Currently admin_delete_user, admin_deactivate_user, and
-- admin_reactivate_user all use is_manager_or_admin(), meaning
-- any resource_manager can permanently delete users.
--
-- This migration:
-- 1. Creates an is_admin() helper function
-- 2. Updates admin_delete_user to require admin role
-- 3. Leaves deactivate/reactivate as manager-level (reversible)
--
-- Also adds is_admin() to the authenticated function grants
-- (if migration 010 has been applied).
-- ============================================================


-- 1. Create is_admin() helper
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to authenticated (consistent with 010)
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;


-- 2. Update admin_delete_user to require admin role only
CREATE OR REPLACE FUNCTION admin_delete_user(
  p_user_id UUID,
  p_delete_entries BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
BEGIN
  -- Only admins can permanently delete users
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can permanently delete users';
  END IF;

  -- Prevent self-deletion
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  -- Must be deactivated first
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND deactivated_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'User must be deactivated before they can be permanently deleted';
  END IF;

  -- Handle timesheet entries
  IF p_delete_entries THEN
    DELETE FROM timesheet_entries WHERE user_id = p_user_id;
  END IF;

  -- Remove project assignments
  DELETE FROM user_projects WHERE user_id = p_user_id;

  -- Remove monthly signoffs for this user
  DELETE FROM monthly_signoffs WHERE user_id = p_user_id;

  -- Delete from auth.users — cascades to profiles via FK,
  -- which in turn SET NULLs timesheet_entries.user_id
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
