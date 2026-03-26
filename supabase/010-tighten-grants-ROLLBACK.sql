-- ============================================================
-- ROLLBACK for Migration 010: Restore original blanket grants
-- ============================================================
-- Run this ONLY if 010-tighten-grants.sql causes issues.
-- This restores the exact grants from the original migration.sql
-- (lines 318-321) so the app returns to its previous state.
--
-- After running this, the app will work exactly as before.
-- You can then investigate what broke and adjust 010 accordingly.
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
