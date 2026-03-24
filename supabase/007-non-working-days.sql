-- 007: Non-working days
-- A simple flag table so users can mark days as non-working (leave, holiday, etc.)
-- These days are treated as "accounted for" in submission trackers and week views.

CREATE TABLE IF NOT EXISTS non_working_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One flag per user per date
  UNIQUE(user_id, entry_date)
);

-- Index for fast lookups by user + date range
CREATE INDEX IF NOT EXISTS idx_nwd_user_date ON non_working_days(user_id, entry_date);

-- RLS
ALTER TABLE non_working_days ENABLE ROW LEVEL SECURITY;

-- Users can view their own non-working days
CREATE POLICY "Users can view own non-working days"
  ON non_working_days FOR SELECT
  USING (auth.uid() = user_id);

-- Managers can view all non-working days
CREATE POLICY "Managers can view all non-working days"
  ON non_working_days FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('resource_manager', 'admin')
    )
  );

-- Users can insert their own non-working days
CREATE POLICY "Users can insert own non-working days"
  ON non_working_days FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own non-working days
CREATE POLICY "Users can delete own non-working days"
  ON non_working_days FOR DELETE
  USING (auth.uid() = user_id);
