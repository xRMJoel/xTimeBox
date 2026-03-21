-- =============================================================================
-- xTimeBox - Supabase Migration
-- =============================================================================
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- This creates all tables, functions, RLS policies, and seed data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Custom types
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('user', 'resource_manager', 'admin');
CREATE TYPE entry_status AS ENUM ('draft', 'submitted', 'signed_off');

-- ---------------------------------------------------------------------------
-- 2. Profiles table (extends Supabase Auth)
-- ---------------------------------------------------------------------------

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  default_client TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create a profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Timesheet entries table
-- ---------------------------------------------------------------------------

CREATE TABLE timesheet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  client TEXT NOT NULL,
  week_ending DATE NOT NULL,
  day_name TEXT NOT NULL,
  entry_date DATE NOT NULL,
  category TEXT NOT NULL,
  time_block TEXT NOT NULL,
  time_value NUMERIC(3,2) NOT NULL CHECK (time_value > 0 AND time_value <= 1),
  feature_tag TEXT,
  notes TEXT,
  status entry_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX idx_entries_user_id ON timesheet_entries(user_id);
CREATE INDEX idx_entries_week_ending ON timesheet_entries(week_ending);
CREATE INDEX idx_entries_status ON timesheet_entries(status);
CREATE INDEX idx_entries_user_week ON timesheet_entries(user_id, week_ending);

CREATE TRIGGER entries_updated_at
  BEFORE UPDATE ON timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Monthly sign-offs table
-- ---------------------------------------------------------------------------

CREATE TABLE monthly_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month_start DATE NOT NULL,
  signed_off_by UUID NOT NULL REFERENCES profiles(id),
  signed_off_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(user_id, month_start)
);

CREATE INDEX idx_signoffs_user ON monthly_signoffs(user_id);
CREATE INDEX idx_signoffs_month ON monthly_signoffs(month_start);

-- ---------------------------------------------------------------------------
-- 5. Helper function: check if current user is admin or resource_manager
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_manager_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('resource_manager', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: check if entries for a given month are signed off for a user
CREATE OR REPLACE FUNCTION is_month_signed_off(p_user_id UUID, p_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM monthly_signoffs
    WHERE user_id = p_user_id
    AND month_start = date_trunc('month', p_date)::date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- 6. RPC: Sign off a user's entries for a given month
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sign_off_month(
  p_user_id UUID,
  p_month_start DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Only managers/admins can sign off
  IF NOT is_manager_or_admin() THEN
    RAISE EXCEPTION 'Only resource managers or admins can sign off entries';
  END IF;

  -- Create the sign-off record
  INSERT INTO monthly_signoffs (user_id, month_start, signed_off_by, notes)
  VALUES (p_user_id, p_month_start, auth.uid(), p_notes)
  ON CONFLICT (user_id, month_start) DO UPDATE
  SET signed_off_by = auth.uid(), signed_off_at = now(), notes = p_notes;

  -- Lock all entries in that month
  UPDATE timesheet_entries
  SET status = 'signed_off'
  WHERE user_id = p_user_id
  AND entry_date >= p_month_start
  AND entry_date < (p_month_start + INTERVAL '1 month')::date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 7. RPC: Revoke a sign-off (unlock entries)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION revoke_signoff(
  p_user_id UUID,
  p_month_start DATE
)
RETURNS VOID AS $$
BEGIN
  IF NOT is_manager_or_admin() THEN
    RAISE EXCEPTION 'Only resource managers or admins can revoke sign-offs';
  END IF;

  -- Remove the sign-off record
  DELETE FROM monthly_signoffs
  WHERE user_id = p_user_id AND month_start = p_month_start;

  -- Unlock entries back to submitted
  UPDATE timesheet_entries
  SET status = 'submitted'
  WHERE user_id = p_user_id
  AND entry_date >= p_month_start
  AND entry_date < (p_month_start + INTERVAL '1 month')::date
  AND status = 'signed_off';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 8. RPC: Get summary for admin dashboard
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 9. Row Level Security policies
-- ---------------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_signoffs ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own, managers/admins can read all
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Managers can view all profiles"
  ON profiles FOR SELECT
  USING (is_manager_or_admin());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Timesheet entries: users own their entries, managers can read all
CREATE POLICY "Users can view own entries"
  ON timesheet_entries FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Managers can view all entries"
  ON timesheet_entries FOR SELECT
  USING (is_manager_or_admin());

CREATE POLICY "Users can insert own entries"
  ON timesheet_entries FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own non-locked entries"
  ON timesheet_entries FOR UPDATE
  USING (
    user_id = auth.uid()
    AND status != 'signed_off'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status != 'signed_off'
  );

CREATE POLICY "Users can delete own draft entries"
  ON timesheet_entries FOR DELETE
  USING (
    user_id = auth.uid()
    AND status = 'draft'
  );

-- Monthly sign-offs: managers can read and manage
CREATE POLICY "Managers can view sign-offs"
  ON monthly_signoffs FOR SELECT
  USING (is_manager_or_admin());

CREATE POLICY "Users can view own sign-offs"
  ON monthly_signoffs FOR SELECT
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 10. Grant the service role access (Supabase handles this, but explicit)
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
