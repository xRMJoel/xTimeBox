-- 014: Add reason column to non_working_days
-- Allows users to specify why a day is non-working (Holiday, Training, etc.)
-- The column is nullable to remain backward-compatible with existing rows.
--
-- Run this in the Supabase SQL Editor before deploying the code that references it.

ALTER TABLE non_working_days
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- Backfill existing rows with a sensible default
UPDATE non_working_days SET reason = 'Holiday' WHERE reason IS NULL;
