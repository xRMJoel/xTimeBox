-- ============================================================
-- Migration 006: User deactivation + hard delete with auth cleanup
-- ============================================================
-- Run this in the Supabase SQL Editor as a single block.
--
-- 1. Adds a deactivated_at column to profiles for soft-delete.
-- 2. Alters the timesheet_entries FK so entries can survive
--    a hard user deletion (user_id nullable, ON DELETE SET NULL).
-- 3. Creates admin_deactivate_user / admin_reactivate_user RPCs.
-- 4. Creates admin_delete_user RPC that fully removes the
--    auth.users record (only works on deactivated users).
-- ============================================================


-- -------------------------------------------------------
-- Step 1: Add deactivated_at column to profiles
-- -------------------------------------------------------

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ DEFAULT NULL;

-- Index for quick filtering of active vs deactivated users
CREATE INDEX IF NOT EXISTS idx_profiles_deactivated
  ON profiles (deactivated_at);


-- -------------------------------------------------------
-- Step 2: Allow timesheet_entries.user_id to be nullable
--         and change cascade behaviour to SET NULL.
-- -------------------------------------------------------

-- Drop the existing FK constraint
ALTER TABLE timesheet_entries
  DROP CONSTRAINT IF EXISTS timesheet_entries_user_id_fkey;

-- Make the column nullable
ALTER TABLE timesheet_entries
  ALTER COLUMN user_id DROP NOT NULL;

-- Re-add the FK with ON DELETE SET NULL
ALTER TABLE timesheet_entries
  ADD CONSTRAINT timesheet_entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;


-- -------------------------------------------------------
-- Step 3: Deactivate / reactivate user functions
-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION admin_deactivate_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT is_manager_or_admin() THEN
    RAISE EXCEPTION 'Only resource managers or admins can deactivate users';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot deactivate your own account';
  END IF;

  UPDATE profiles
  SET deactivated_at = now()
  WHERE id = p_user_id
    AND deactivated_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION admin_reactivate_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT is_manager_or_admin() THEN
    RAISE EXCEPTION 'Only resource managers or admins can reactivate users';
  END IF;

  UPDATE profiles
  SET deactivated_at = NULL
  WHERE id = p_user_id
    AND deactivated_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -------------------------------------------------------
-- Step 4: Hard delete user function (deactivated only)
-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION admin_delete_user(
  p_user_id UUID,
  p_delete_entries BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
BEGIN
  -- Only admins/managers can delete users
  IF NOT is_manager_or_admin() THEN
    RAISE EXCEPTION 'Only resource managers or admins can delete users';
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
  -- If NOT deleting entries, the ON DELETE SET NULL FK will
  -- automatically nullify user_id when the profile is removed.

  -- Remove project assignments
  DELETE FROM user_projects WHERE user_id = p_user_id;

  -- Remove monthly signoffs for this user
  DELETE FROM monthly_signoffs WHERE user_id = p_user_id;

  -- Delete from auth.users — cascades to profiles via FK,
  -- which in turn SET NULLs timesheet_entries.user_id
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
