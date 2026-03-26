-- ============================================================
-- Insert Jed Alder's March 2026 timesheet entries
-- Run in Supabase SQL Editor
-- ============================================================
-- Source: Jed's spreadsheet (22.75 days total)
-- Project: IPCI
-- Rate: 6 hrs/day
-- Spreading: Fill whole days first, remainder on last day
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
  v_project_id UUID;
  v_client TEXT;
BEGIN
  -- Look up Jed's user ID
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bills@abbottwebs.com';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User Bills@abbottwebs.com not found';
  END IF;

  -- Look up IPCI project
  SELECT id, client INTO v_project_id, v_client FROM projects WHERE name ILIKE '%IPCI%' AND status = 'active';
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'IPCI project not found';
  END IF;

  RAISE NOTICE 'User ID: %, Project ID: %, Client: %', v_user_id, v_project_id, v_client;

  -- ============================================================
  -- COLUMN 1: Sunday 1 March (w/e 2026-03-06)
  -- Only one entry: Development | Show/Hide Credit Amount = 0.75d
  -- ============================================================

  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-06', 'Sunday', '2026-03-01', 'Development', 'Day', 0.75, 4.50, 'Show/Hide Credit Amount', 'Show/Hide Credit Amount', 'XRM-IPC: Development | Project: Show/Hide Credit Amount', 'draft');

  -- ============================================================
  -- COLUMN 2: Mon 2 Mar - Fri 6 Mar (w/e 2026-03-06)
  -- ============================================================

  -- Development | Project: Show/Hide Credit Amount = 2.25d
  -- Mon 1.0 + Tue 1.0 + Wed 0.25
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-06', 'Monday',    '2026-03-02', 'Development', 'Day',          1.00, 6.00, 'Show/Hide Credit Amount', 'Show/Hide Credit Amount', 'XRM-IPC: Development | Project: Show/Hide Credit Amount', 'draft'),
    (v_user_id, v_project_id, v_client, '2026-03-06', 'Tuesday',   '2026-03-03', 'Development', 'Day',          1.00, 6.00, 'Show/Hide Credit Amount', 'Show/Hide Credit Amount', 'XRM-IPC: Development | Project: Show/Hide Credit Amount', 'draft'),
    (v_user_id, v_project_id, v_client, '2026-03-06', 'Wednesday', '2026-03-04', 'Development', 'Quarter Day',  0.25, 1.50, 'Show/Hide Credit Amount', 'Show/Hide Credit Amount', 'XRM-IPC: Development | Project: Show/Hide Credit Amount', 'draft');

  -- Testing | Project: Show/Hide Credit Amount = 1.83d
  -- Mon 1.0 + Tue 0.83
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-06', 'Monday',  '2026-03-02', 'Testing', 'Day',                1.00, 6.00, 'Show/Hide Credit Amount', 'Show/Hide Credit Amount', 'XRM-IPC: Testing | Project: Show/Hide Credit Amount', 'draft'),
    (v_user_id, v_project_id, v_client, '2026-03-06', 'Tuesday', '2026-03-03', 'Testing', 'Three Quarter Day',  0.83, 4.98, 'Show/Hide Credit Amount', 'Show/Hide Credit Amount', 'XRM-IPC: Testing | Project: Show/Hide Credit Amount', 'draft');

  -- UAT Support | Project: Environment Setup = 1.25d
  -- Mon 1.0 + Tue 0.25
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-06', 'Monday',  '2026-03-02', 'UAT Support', 'Day',          1.00, 6.00, 'Environment Setup', 'Environment Setup', 'XRM-IPC: UAT Support | Project: Environment Setup', 'draft'),
    (v_user_id, v_project_id, v_client, '2026-03-06', 'Tuesday', '2026-03-03', 'UAT Support', 'Quarter Day',  0.25, 1.50, 'Environment Setup', 'Environment Setup', 'XRM-IPC: UAT Support | Project: Environment Setup', 'draft');

  -- UAT Support | Project: Show/Hide Credit Amount = 0.17d
  -- Mon 0.17
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-06', 'Monday', '2026-03-02', 'UAT Support', 'Quarter Day', 0.17, 1.02, 'Show/Hide Credit Amount', 'Show/Hide Credit Amount', 'XRM-IPC: UAT Support | Project: Show/Hide Credit Amount', 'draft');

  -- UAT Support | Project: Show/Hide Credit Amount / MPC = 2.25d
  -- Mon 1.0 + Tue 1.0 + Wed 0.25
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-06', 'Monday',    '2026-03-02', 'UAT Support', 'Day',          1.00, 6.00, 'Show/Hide Credit Amount / MPC', 'Show/Hide Credit Amount / MPC', 'XRM-IPC: UAT Support | Project: Show/Hide Credit Amount / MPC', 'draft'),
    (v_user_id, v_project_id, v_client, '2026-03-06', 'Tuesday',   '2026-03-03', 'UAT Support', 'Day',          1.00, 6.00, 'Show/Hide Credit Amount / MPC', 'Show/Hide Credit Amount / MPC', 'XRM-IPC: UAT Support | Project: Show/Hide Credit Amount / MPC', 'draft'),
    (v_user_id, v_project_id, v_client, '2026-03-06', 'Wednesday', '2026-03-04', 'UAT Support', 'Quarter Day',  0.25, 1.50, 'Show/Hide Credit Amount / MPC', 'Show/Hide Credit Amount / MPC', 'XRM-IPC: UAT Support | Project: Show/Hide Credit Amount / MPC', 'draft');

  -- ============================================================
  -- COLUMN 3: Mon 9 Mar - Fri 13 Mar (w/e 2026-03-13)
  -- ============================================================

  -- Development | Project: Show/Hide Credit Amount = 2.58d
  -- Mon 1.0 + Tue 1.0 + Wed 0.58
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-13', 'Monday',    '2026-03-09', 'Development', 'Day',          1.00, 6.00, 'Show/Hide Credit Amount', 'Show/Hide Credit Amount', 'XRM-IPC: Development | Project: Show/Hide Credit Amount', 'draft'),
    (v_user_id, v_project_id, v_client, '2026-03-13', 'Tuesday',   '2026-03-10', 'Development', 'Day',          1.00, 6.00, 'Show/Hide Credit Amount', 'Show/Hide Credit Amount', 'XRM-IPC: Development | Project: Show/Hide Credit Amount', 'draft'),
    (v_user_id, v_project_id, v_client, '2026-03-13', 'Wednesday', '2026-03-11', 'Development', 'Half Day',     0.58, 3.48, 'Show/Hide Credit Amount', 'Show/Hide Credit Amount', 'XRM-IPC: Development | Project: Show/Hide Credit Amount', 'draft');

  -- Development | Project: Show/Hide Credit Amount / MPC = 1.17d
  -- Mon 1.0 + Tue 0.17
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-13', 'Monday',  '2026-03-09', 'Development', 'Day',          1.00, 6.00, 'Show/Hide Credit Amount / MPC', 'Show/Hide Credit Amount / MPC', 'XRM-IPC: Development | Project: Show/Hide Credit Amount / MPC', 'draft'),
    (v_user_id, v_project_id, v_client, '2026-03-13', 'Tuesday', '2026-03-10', 'Development', 'Quarter Day',  0.17, 1.02, 'Show/Hide Credit Amount / MPC', 'Show/Hide Credit Amount / MPC', 'XRM-IPC: Development | Project: Show/Hide Credit Amount / MPC', 'draft');

  -- Testing | Project: Show/Hide Credit Amount = 1.50d
  -- Mon 1.0 + Tue 0.50
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-13', 'Monday',  '2026-03-09', 'Testing', 'Day',          1.00, 6.00, 'Show/Hide Credit Amount', 'Show/Hide Credit Amount', 'XRM-IPC: Testing | Project: Show/Hide Credit Amount', 'draft'),
    (v_user_id, v_project_id, v_client, '2026-03-13', 'Tuesday', '2026-03-10', 'Testing', 'Half Day',     0.50, 3.00, 'Show/Hide Credit Amount', 'Show/Hide Credit Amount', 'XRM-IPC: Testing | Project: Show/Hide Credit Amount', 'draft');

  -- Testing | Project: Show/Hide Credit Amount / MPC = 0.25d
  -- Mon 0.25
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-13', 'Monday', '2026-03-09', 'Testing', 'Quarter Day', 0.25, 1.50, 'Show/Hide Credit Amount / MPC', 'Show/Hide Credit Amount / MPC', 'XRM-IPC: Testing | Project: Show/Hide Credit Amount / MPC', 'draft');

  -- UAT Support | Project: Show/Hide Credit Amount / MPC = 1.75d
  -- Mon 1.0 + Tue 0.75
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-13', 'Monday',  '2026-03-09', 'UAT Support', 'Day',                1.00, 6.00, 'Show/Hide Credit Amount / MPC', 'Show/Hide Credit Amount / MPC', 'XRM-IPC: UAT Support | Project: Show/Hide Credit Amount / MPC', 'draft'),
    (v_user_id, v_project_id, v_client, '2026-03-13', 'Tuesday', '2026-03-10', 'UAT Support', 'Three Quarter Day',  0.75, 4.50, 'Show/Hide Credit Amount / MPC', 'Show/Hide Credit Amount / MPC', 'XRM-IPC: UAT Support | Project: Show/Hide Credit Amount / MPC', 'draft');

  -- ============================================================
  -- COLUMN 4: Mon 16 Mar - Fri 20 Mar (w/e 2026-03-20)
  -- ============================================================

  -- Onboarding | Cloud2020 Admin = 0.25d
  -- Mon 0.25
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-20', 'Monday', '2026-03-16', 'Onboarding', 'Quarter Day', 0.25, 1.50, 'Cloud2020 Admin', 'Cloud2020 Admin', 'Dynamics365 - Consultancy & Development | Cloud2020 Admin', 'draft');

  -- Development | Project: Show/Hide Credit Amount / MPC = 0.58d
  -- Mon 0.58
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-20', 'Monday', '2026-03-16', 'Development', 'Half Day', 0.58, 3.48, 'Show/Hide Credit Amount / MPC', 'Show/Hide Credit Amount / MPC', 'XRM-IPC: Development | Project: Show/Hide Credit Amount / MPC', 'draft');

  -- Release | Release: Production = 1.17d
  -- Mon 1.0 + Tue 0.17
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-20', 'Monday',  '2026-03-16', 'Release', 'Day',          1.00, 6.00, 'Production', 'Production', 'XRM-IPC: Release | Release: Production', 'draft'),
    (v_user_id, v_project_id, v_client, '2026-03-20', 'Tuesday', '2026-03-17', 'Release', 'Quarter Day',  0.17, 1.02, 'Production', 'Production', 'XRM-IPC: Release | Release: Production', 'draft');

  -- Release | Release: Production Post rollback fixes = 1.17d
  -- Mon 1.0 + Tue 0.17
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-20', 'Monday',  '2026-03-16', 'Release', 'Day',          1.00, 6.00, 'Production Post rollback fixes', 'Production Post rollback fixes', 'XRM-IPC: Release | Release: Production Post rollback fixes', 'draft'),
    (v_user_id, v_project_id, v_client, '2026-03-20', 'Tuesday', '2026-03-17', 'Release', 'Quarter Day',  0.17, 1.02, 'Production Post rollback fixes', 'Production Post rollback fixes', 'XRM-IPC: Release | Release: Production Post rollback fixes', 'draft');

  -- Release | Release: Production Rollback = 0.83d
  -- Mon 0.83
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-20', 'Monday', '2026-03-16', 'Release', 'Three Quarter Day', 0.83, 4.98, 'Production Rollback', 'Production Rollback', 'XRM-IPC: Release | Release: Production Rollback', 'draft');

  -- Testing | Project: Show/Hide Credit Amount = 0.17d
  -- Mon 0.17
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-20', 'Monday', '2026-03-16', 'Testing', 'Quarter Day', 0.17, 1.02, 'Show/Hide Credit Amount', 'Show/Hide Credit Amount', 'XRM-IPC: Testing | Project: Show/Hide Credit Amount', 'draft');

  -- Testing | Project: Show/Hide Credit Amount / MPC = 0.58d
  -- Mon 0.58
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-20', 'Monday', '2026-03-16', 'Testing', 'Half Day', 0.58, 3.48, 'Show/Hide Credit Amount / MPC', 'Show/Hide Credit Amount / MPC', 'XRM-IPC: Testing | Project: Show/Hide Credit Amount / MPC', 'draft');

  -- UAT Support | Project: Environment Setup = 2.25d
  -- Mon 1.0 + Tue 1.0 + Wed 0.25
  INSERT INTO timesheet_entries (user_id, project_id, client, week_ending, day_name, entry_date, category, time_block, time_value, time_hours, feature_tag, reference, notes, status)
  VALUES
    (v_user_id, v_project_id, v_client, '2026-03-20', 'Monday',    '2026-03-16', 'UAT Support', 'Day',          1.00, 6.00, 'Environment Setup', 'Environment Setup', 'XRM-IPC: UAT Support | Project: Environment Setup', 'draft'),
    (v_user_id, v_project_id, v_client, '2026-03-20', 'Tuesday',   '2026-03-17', 'UAT Support', 'Day',          1.00, 6.00, 'Environment Setup', 'Environment Setup', 'XRM-IPC: UAT Support | Project: Environment Setup', 'draft'),
    (v_user_id, v_project_id, v_client, '2026-03-20', 'Wednesday', '2026-03-18', 'UAT Support', 'Quarter Day',  0.25, 1.50, 'Environment Setup', 'Environment Setup', 'XRM-IPC: UAT Support | Project: Environment Setup', 'draft');

  -- ============================================================
  -- Summary
  -- ============================================================
  RAISE NOTICE 'Inserted 34 entries for Jed Alder (March 2026)';
  RAISE NOTICE 'Week 1 (Sun 1 Mar):  0.75d';
  RAISE NOTICE 'Week 2 (w/e 6 Mar):  7.75d';
  RAISE NOTICE 'Week 3 (w/e 13 Mar): 7.25d';
  RAISE NOTICE 'Week 4 (w/e 20 Mar): 7.00d';
  RAISE NOTICE 'Grand total: 22.75d';

END $$;
