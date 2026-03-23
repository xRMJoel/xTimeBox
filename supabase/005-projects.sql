-- ============================================================
-- Migration 005: Projects
-- ============================================================
-- Run this in the Supabase SQL Editor as a single block.
-- ============================================================

-- 1. Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Junction table: which users are assigned to which projects
CREATE TABLE IF NOT EXISTS user_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- 3. Add project_id to timesheet_entries (nullable for backwards compatibility)
ALTER TABLE timesheet_entries
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- 4. RLS policies for projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Everyone can read active projects
CREATE POLICY "Anyone can read projects"
  ON projects FOR SELECT
  USING (true);

-- Only admins/managers can insert/update/delete projects
CREATE POLICY "Admins can manage projects"
  ON projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'resource_manager')
    )
  );

-- 5. RLS policies for user_projects
ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;

-- Users can see their own assignments; admins can see all
CREATE POLICY "Users can read own assignments"
  ON user_projects FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'resource_manager')
    )
  );

-- Only admins/managers can assign/remove users from projects
CREATE POLICY "Admins can manage user assignments"
  ON user_projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'resource_manager')
    )
  );

-- 6. Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_project_id ON user_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_project_id ON timesheet_entries(project_id);
