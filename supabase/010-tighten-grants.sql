-- ============================================================
-- Migration 010: Tighten database grants (least privilege)
-- ============================================================
-- Replaces the blanket GRANT ALL from migration.sql (lines 319-321)
-- with table-by-table, operation-specific grants.
--
-- WHY: The original grants give `anon` (unauthenticated) and
-- `authenticated` full access to every table, sequence, and
-- function. RLS is the only safety net. If any table ever has
-- RLS disabled or a policy is misconfigured, it's a full
-- data breach. This migration enforces least privilege so
-- that even without RLS, roles can only do what they need.
--
-- IMPORTANT: Run this in Supabase SQL Editor. Test on a
-- non-production project first.
-- ============================================================


-- =========================================================
-- STEP 1: Revoke the blanket grants
-- =========================================================
-- These match the three GRANT ALL statements in migration.sql.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;


-- =========================================================
-- STEP 2: Schema usage (both roles need this to see objects)
-- =========================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;


-- =========================================================
-- STEP 3: anon role - minimal grants
-- =========================================================
-- The anon role should have almost no direct table access.
-- All meaningful operations require authentication.
-- The only thing anon needs is the ability to call
-- handle_new_user() indirectly (via the auth trigger, which
-- runs as SECURITY DEFINER and doesn't need anon grants).
--
-- No table grants for anon.
-- No function grants for anon.


-- =========================================================
-- STEP 4: authenticated role - table grants
-- =========================================================

-- profiles: users read own (via RLS), update own (via RLS)
-- admins update any (via RLS). No direct INSERT or DELETE
-- needed - profile creation is handled by the handle_new_user()
-- trigger (SECURITY DEFINER), and deletion cascades from
-- auth.users via admin_delete_user() (also SECURITY DEFINER).
GRANT SELECT, UPDATE ON profiles TO authenticated;

-- timesheet_entries: users CRUD own entries (all gated by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON timesheet_entries TO authenticated;

-- monthly_signoffs: read-only for authenticated users (via RLS).
-- Inserts and deletes are handled by sign_off_month() and
-- revoke_signoff() which are SECURITY DEFINER.
GRANT SELECT ON monthly_signoffs TO authenticated;

-- projects: everyone can read (RLS policy "Anyone can read projects").
-- Admins/managers can manage (RLS policy "Admins can manage projects").
GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO authenticated;

-- user_projects: users read own assignments, admins manage all (via RLS).
GRANT SELECT, INSERT, UPDATE, DELETE ON user_projects TO authenticated;

-- non_working_days: users manage own (via RLS), managers read all.
GRANT SELECT, INSERT, DELETE ON non_working_days TO authenticated;


-- =========================================================
-- STEP 5: authenticated role - sequence grants
-- =========================================================
-- All tables use gen_random_uuid() for PKs, so no serial
-- sequences are needed. Grant USAGE on all sequences as a
-- safety net in case any are added later, but not UPDATE.

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- =========================================================
-- STEP 6: authenticated role - function grants
-- =========================================================
-- Only grant EXECUTE on the specific functions the app calls.
-- All SECURITY DEFINER functions need to be callable by
-- authenticated users (they do their own internal auth checks).

-- Helper functions (called indirectly by RLS policies and other functions)
GRANT EXECUTE ON FUNCTION is_manager_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_month_signed_off(UUID, DATE) TO authenticated;

-- Sign-off RPCs
GRANT EXECUTE ON FUNCTION sign_off_month(UUID, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_signoff(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION sign_off_week(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION unsign_off_week(UUID, DATE) TO authenticated;

-- Admin summary
GRANT EXECUTE ON FUNCTION get_admin_summary(DATE) TO authenticated;

-- Entry return RPCs
GRANT EXECUTE ON FUNCTION return_week_entries(UUID, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION return_entry(UUID, TEXT) TO authenticated;

-- User management RPCs
GRANT EXECUTE ON FUNCTION admin_deactivate_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reactivate_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_user(UUID, BOOLEAN) TO authenticated;

-- Utility functions (used by triggers, but grant anyway for safety)
GRANT EXECUTE ON FUNCTION update_updated_at() TO authenticated;


-- =========================================================
-- STEP 7: Ensure default privileges for future objects
-- =========================================================
-- This prevents any new tables or functions from inheriting
-- the old blanket grants. New objects get no grants by default;
-- you must explicitly grant access in future migrations.

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM authenticated;
