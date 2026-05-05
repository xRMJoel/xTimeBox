-- ============================================================
-- Migration 017: Allow managers and admins to delete any
-- timesheet_entries row regardless of status
-- ============================================================
-- The existing DELETE policy (from migration 004) only allows
-- a user to delete their own entries when status is 'draft'
-- or 'returned'. Once an entry is 'submitted' or 'signed_off'
-- nobody can delete it, even an admin. This blocks legitimate
-- admin clean-up, e.g. an "Other" entry left on a day that
-- was later marked non-working.
--
-- This migration adds a second DELETE policy that lets
-- resource_manager and admin roles delete any entry. The
-- existing user-self policy is left untouched.
--
-- No manual steps required. Run in the Supabase SQL Editor.
-- ============================================================

CREATE POLICY "Managers and admins can delete any entry"
  ON timesheet_entries FOR DELETE
  USING (is_manager_or_admin());
