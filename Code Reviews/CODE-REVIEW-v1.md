# xTimeBox Code Review

---

## Step 0: Scope Confirmation

### Files reviewed

**Frontend (React/Vite):**
- `src/main.jsx`, `src/App.jsx`, `src/index.css`
- `src/lib/supabase.js`, `src/lib/constants.js`, `src/lib/pdfExport.js`
- `src/hooks/useAuth.jsx`, `src/hooks/useEntries.js`, `src/hooks/useTheme.jsx`
- `src/components/EntryCard.jsx`, `src/components/Layout.jsx`, `src/components/LoadingSpinner.jsx`, `src/components/ProtectedRoute.jsx`, `src/components/StatusBadge.jsx`, `src/components/WeekCalendar.jsx`
- `src/pages/AdminPage.jsx`, `src/pages/CompleteProfilePage.jsx`, `src/pages/ForgotPasswordPage.jsx`, `src/pages/HomePage.jsx`, `src/pages/LoginPage.jsx`, `src/pages/MyEntriesPage.jsx`, `src/pages/ProfilePage.jsx`, `src/pages/RegisterPage.jsx`, `src/pages/ReportsPage.jsx`, `src/pages/ResetPasswordPage.jsx`, `src/pages/TimesheetPage.jsx`

**Backend (Supabase SQL):**
- `supabase/migration.sql` (base schema)
- `supabase/002-add-profile-fields.sql` through `supabase/009-hours-based-time.sql`
- `supabase/insert-jed-march.sql`

**Config/Infra:**
- `package.json`, `vite.config.js`, `vercel.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`
- `.env`, `.env.example`, `.gitignore`, `CREDENTIALS.md`

**Email templates:**
- 14 HTML email templates in `emails/`

### Files I cannot see

- The live Supabase RLS configuration (I can only review what's in the SQL migration files, not what's actually deployed)
- Any Supabase Edge Functions or database triggers beyond those in the migration files
- The Vercel deployment configuration beyond `vercel.json`
- Storage bucket policies as deployed (only `003-avatar-storage.sql` is visible)

---

## Step 1: Cognitive Reset

xTimeBox is a timesheet tracking application built with React (Vite) and Supabase. Users log time entries against projects in weekly blocks, managers review and sign off submissions, and reports provide analytics. The data flows: user creates entries (draft) > submits week > manager signs off or returns.

**Most vulnerable execution path:** The admin deletion flow (`admin_delete_user` RPC). It runs as `SECURITY DEFINER`, deletes from `auth.users`, cascades to `profiles`, and SET NULLs `timesheet_entries.user_id`. A bug or race condition here could orphan entries, break referential integrity across multiple tables, or inadvertently delete data. The function also trusts that `is_manager_or_admin()` is sufficient authorisation, but any `resource_manager` can permanently delete another user's auth record, which is arguably an admin-only operation.

---

## Step 2: The Review

---

### Domain 1: Logic and Data Integrity

**[Logic] -- QuickEntryModal uses legacy day-based TIME_BLOCKS, not hours**

- **Severity:** High
- **How this breaks:** The `QuickEntryModal` in `HomePage.jsx` (the quick-add popup from the dashboard) still uses the old `TIME_BLOCKS` (Quarter Day, Half Day, etc.) and writes `time_value` from `timeBlock.numericValue`. It never sets `time_hours`. After migration 009 introduced hours-based time entry, the main `TimesheetPage` correctly uses hours. But entries created via the HomePage modal will have `time_hours = null` and `time_value` based on the old fixed 0.25/0.5/0.75/1.0 increments, ignoring the project's `hours_per_day` conversion rate entirely. This produces inconsistent data: some entries have hours, some do not. Reports that sum `time_hours` will undercount. The `ReportsPage` and PDF export both check `grandTotalHours > 0` to decide whether to show an hours column, so mixed data produces misleading reports.
- **The fix:** Refactor `QuickEntryModal` to match `TimesheetPage`'s hours-based input. Replace the `TIME_BLOCKS` dropdown with an hours numeric input, fetch `hours_per_day` from `user_projects`, and calculate `time_value` from hours at save time. The `canSave` check should validate hours with `isValidHourIncrement()` instead of checking `form.time_block`.

---

**[Logic] -- Race condition in concurrent save operations**

- **Severity:** High
- **How this breaks:** `TimesheetPage.handleSubmit()` fires deletes, updates, and inserts in parallel via `Promise.all(ops)`. If a user double-clicks "Save" or "Submit week" fast enough, two batches of operations fire against the same entries. The `loading` flag is set to true inside each individual `useEntries` hook call, but `handleSubmit` checks `loading` at the UI level before the async calls begin. The second click can slip through before the first `Promise.all` resolves. This can produce duplicate entries (the same new entries inserted twice) or conflicting status updates.
- **The fix:** Add a local `submitting` ref that's checked and set synchronously at the top of `handleSubmit`:

```jsx
const submittingRef = useRef(false)

async function handleSubmit({ skipNavigate = false } = {}) {
  if (submittingRef.current) return false
  submittingRef.current = true
  try {
    // ... existing logic
  } finally {
    submittingRef.current = false
  }
}
```

---

**[Logic] -- `get_admin_summary` excludes managers/admins with entries from the returned count**

- **Severity:** Medium
- **How this breaks:** The `WHERE` clause `WHERE p.role = 'user' OR e.id IS NOT NULL` means managers/admins only appear in the summary if they have entries. If a manager logs time in some months but not others, they appear and disappear from the admin view inconsistently. More critically, the migration 009 version of `get_admin_summary` dropped the `returned_count` column that migration 004 added. This means any code relying on `returned_count` from this RPC will get `undefined`, silently hiding returned entries in the admin summary.
- **The fix:** Re-add `returned_count` to the migration 009 version of `get_admin_summary`. Consider whether the `WHERE` filter should include all active profiles regardless of role if the intent is a complete team view.

---

**[Logic] -- `submitWeek` in `useEntries` clears `return_reason` and `returned_by` client-side but RLS may block the update**

- **Severity:** Medium
- **How this breaks:** When a user re-submits returned entries, `submitWeek` runs:
  ```js
  .update({ status: 'submitted', return_reason: null, returned_by: null })
  .in('status', ['draft', 'returned'])
  ```
  The RLS policy "Users can update own non-locked entries" allows updates where `status != 'signed_off'`. The `WITH CHECK` clause also requires `status != 'signed_off'`. Since the new status is `'submitted'`, this should pass. However, the update sets `status` to `submitted` in the same operation. If Supabase evaluates `WITH CHECK` against the new row values and the old row was `'returned'`, this works. But if there's a timing issue where another admin signs off the entry between the user clicking "Submit" and the query executing, the update silently affects zero rows and the user sees a success message for a no-op.
- **The fix:** Check the count of affected rows after the update and warn the user if no rows were updated. Use `.select()` on the update to get the returned data and verify.

---

### Domain 2: Security and Trust Boundaries

**[Security] -- Live credentials committed to the repository**

- **Severity:** Critical
- **How this breaks:** The `.env` file contains the live Supabase URL and anon key. While `.env` is in `.gitignore`, the `CREDENTIALS.md` file (also in `.gitignore`) contains the **database password** (`T36yKy5&8s$YxZr`), the anon key, and the publishable key. Both files exist in the working tree. If this repository is ever shared, cloned to a new machine, or backed up without respecting `.gitignore`, the database password is exposed. The anon key is already in the `.env` that was provided to me, meaning it's accessible in the workspace folder. The anon key alone, combined with the overly broad grants (see next finding), allows any authenticated user to escalate privileges.
- **The fix:** Rotate the database password immediately. Remove `CREDENTIALS.md` from the working tree (or move it to a separate secrets manager). Verify that `.env` has never been committed to git history with `git log --all --full-history -- .env`. If it has, the anon key should be rotated via the Supabase dashboard.

---

**[Security] -- Overly permissive database grants defeat RLS**

- **Severity:** Critical
- **How this breaks:** The base migration includes:
  ```sql
  GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
  ```
  This grants the `anon` role (unauthenticated API requests) full access to all tables and functions. RLS policies are the only barrier. If any table has RLS disabled (or a future migration forgets to enable it), the `anon` role can read and write everything. The `anon` role should never have `ALL` on tables; it should have minimal grants (e.g., `SELECT` on specific tables needed for public access, if any). The `authenticated` role getting `ALL` also means any authenticated user can attempt `DELETE`, `INSERT`, `UPDATE` on any table, relying entirely on RLS to block them. A single missing or misconfigured policy becomes a full data breach.
- **The fix:** Replace the blanket grants with specific, minimal grants:
  ```sql
  -- Remove the broad grants
  REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

  -- Grant only what's needed
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON timesheet_entries TO authenticated;
  GRANT SELECT, UPDATE ON profiles TO authenticated;
  GRANT SELECT ON projects TO authenticated;
  -- etc., table by table
  ```

---

**[Security] -- `resource_manager` role can permanently delete users, which should be admin-only**

- **Severity:** High
- **How this breaks:** `admin_delete_user`, `admin_deactivate_user`, and `admin_reactivate_user` all use `is_manager_or_admin()` as their authorisation check. This means any `resource_manager` can permanently delete another user's auth record (including their email, password hash, and all auth metadata) from `auth.users`. User deletion is irreversible and should be restricted to `admin` only. A disgruntled or compromised resource_manager account could wipe the entire user base one by one.
- **The fix:** Create a separate `is_admin()` helper and use it for destructive operations:
  ```sql
  CREATE OR REPLACE FUNCTION is_admin()
  RETURNS BOOLEAN AS $$
  BEGIN
    RETURN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    );
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
  ```
  Then update `admin_delete_user`, `admin_deactivate_user`, and `admin_reactivate_user` to use `is_admin()` instead of `is_manager_or_admin()`.

---

**[Security] -- No input sanitisation on user-supplied text rendered as HTML in PDF export**

- **Severity:** High
- **How this breaks:** `pdfExport.js` builds an HTML string from data that includes `projectName`, `client`, `monthLabel`, category names, and reference strings. These values originate from user input (project names, client names, feature tags). The function uses template literals to inject them directly into HTML:
  ```js
  container.innerHTML = buildReportHTML(data)
  ```
  If a project name contains `<script>alert('xss')</script>` or `<img onerror=...>`, it gets injected into the DOM. While html2canvas renders to a canvas (limiting the blast radius), the DOM is still modified with the malicious HTML before the canvas capture. This is a stored XSS vector: an admin creates a project with a malicious name, every user who exports a PDF for that project gets the payload executed.
- **The fix:** Escape all dynamic values before inserting them into the HTML string:
  ```js
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
  ```
  Apply `escapeHtml()` to every dynamic value in `buildReportHTML`.

---

**[Security] -- Client-side role check for admin route is the only access control for the admin UI**

- **Severity:** Medium
- **How this breaks:** The `ProtectedRoute` component checks `isManager` (derived from `profile.role` in the client-side auth context) to gate the `/admin` route. This is a UI-level check only. The actual data protection comes from the RLS policies and `SECURITY DEFINER` functions on the database side, which is correct. However, the admin page calls `fetchAllEntries` which uses a straightforward Supabase query with `is_manager_or_admin()` in the RLS policy. If the `is_manager_or_admin()` function has a bug or the profile role is somehow manipulated (e.g., via the "Admins can update any profile" policy, which an admin could use to promote themselves, but a compromised admin session could promote others), the entire authorisation model collapses. This is not a standalone vulnerability, but the defence is thin: one function, used everywhere, with no secondary checks.
- **The fix:** Consider adding role verification at the RPC level for critical operations (sign-off, return, delete) by checking `auth.uid()` against the profiles table directly within each function, rather than relying solely on the shared `is_manager_or_admin()` helper. This creates defence in depth.

---

### Domain 3: Resilience and Performance

**[Performance] -- No pagination on `fetchAllEntries` (admin view)**

- **Severity:** High
- **How this breaks:** `AdminPage` calls `fetchAllEntries({ monthStart })` which fetches every entry for every user for the month with no row limit. For a team of 20 people logging five entries per day over 22 working days, that's 2,200 rows with joined profile data, loaded into a single React state array. At 50 or 100 users, this becomes 5,500-11,000 rows per month view. Supabase's default response limit is 1,000 rows. Beyond that, the query silently returns only the first 1,000 rows, giving the admin an incomplete and misleading view with no indication that data is missing.
- **The fix:** Either increase the Supabase `apiMaxRows` setting for this query, add explicit pagination, or restructure the admin view to load entries per-user on demand (when the admin clicks into a user's detail view) rather than all users at once.

---

**[Resilience] -- CDN-loaded PDF libraries have no integrity checks (SRI)**

- **Severity:** Medium
- **How this breaks:** `pdfExport.js` dynamically loads `jspdf` and `html2canvas` from three CDN fallbacks (jsdelivr, cdnjs, unpkg) with no Subresource Integrity (SRI) hashes. If any of these CDNs is compromised or serves a tampered file, the malicious code runs in the user's browser with full access to the DOM and Supabase session. The fallback logic makes this worse: if the primary CDN is down, the code tries two more, tripling the attack surface.
- **The fix:** Add SRI hashes to the script elements:
  ```js
  s.integrity = 'sha384-...'
  s.crossOrigin = 'anonymous'
  ```
  Or better: install jspdf and html2canvas as npm dependencies and bundle them with Vite, eliminating the CDN dependency entirely.

---

**[Resilience] -- No error handling on `fetchAllEntries` Promise chain in admin `loadData`**

- **Severity:** Medium
- **How this breaks:** `AdminPage.loadData()` uses `Promise.all()` with five parallel requests. If any single request fails (network timeout, Supabase rate limit, auth token expired), the entire `Promise.all` rejects and none of the data is set. The `loadData` function has no `.catch()` handler. The component shows stale data from the previous successful load (or empty state on first load) with no error indication to the admin.
- **The fix:** Use `Promise.allSettled()` (as `HomePage` already does) and show partial data with an error banner for any failed requests.

---

### Domain 4: Architecture, Readability, and Long-Term Health

**[Architecture] -- HomePage `QuickEntryModal` duplicates the entire entry creation flow**

- **Severity:** High
- **How this breaks in practice:** There are now two completely independent code paths for creating timesheet entries: `TimesheetPage` (hours-based, post-migration 009) and `QuickEntryModal` in `HomePage` (legacy day-based blocks). They have different validation rules, different data shapes, and different field sets. Any future change to entry creation logic (new required fields, new validation rules, new categories) must be applied in both places or the data becomes inconsistent. This has already happened: the hours migration updated `TimesheetPage` but not `QuickEntryModal`.
- **The fix:** Extract the entry form into a shared component (or at minimum, a shared hook that handles validation, data shaping, and submission). Both `TimesheetPage` and `QuickEntryModal` should consume this shared logic. The `QuickEntryModal` should be updated to use hours-based input immediately.

---

**[Architecture] -- `AdminPage.jsx` is 1,800+ lines in a single file**

- **Severity:** Medium
- **How this breaks in practice:** The admin page contains three full tab components (`ApprovalsTab`, `ProjectsTab`, and a `UsersTab` or similar), each with their own state, data loading, modals, and event handlers. At 1,800+ lines, this file is difficult to navigate, review, and test. Any change to one tab risks unintended side effects in another because they share the same file scope. The file size also slows IDE features (autocomplete, linting) and makes git diffs harder to review.
- **The fix:** Split into separate files: `AdminApprovalsTab.jsx`, `AdminProjectsTab.jsx`, etc. The parent `AdminPage.jsx` becomes a thin shell with tab switching logic.

---

**[Readability] -- Hardcoded colour values scattered across components**

- **Severity:** Medium
- **How this breaks in practice:** Colour values like `#22c55e`, `rgba(0,201,255,0.06)`, `#fbbf24`, and `#ff716c` appear as literal strings in `WeekCalendar.jsx`, `HomePage.jsx`, `AdminPage.jsx`, `StatusBadge.jsx`, and others. The CSS variables in `index.css` define a proper theme system, but many components bypass it with inline hex values. Changing the brand colour or adjusting the theme requires finding and updating dozens of scattered literals. Some of these hardcoded values don't even match the CSS variable equivalents (e.g., `#22c55e` for green vs the theme system's approach).
- **The fix:** Define semantic CSS variables for status colours (e.g., `--color-status-draft`, `--color-status-submitted`, `--color-status-returned`, `--color-status-signed-off`) and reference them consistently. Replace hardcoded hex values with CSS variable references or Tailwind config tokens.

---

### Minor Observations

- **`generateReference` uses `Math.random()` for the 3-character random segment.** Collisions are unlikely but possible, and the function has no uniqueness guarantee. Consider using a database sequence or UUID prefix instead.
- **The `scripts/` directory is empty.** If it was intended for build or utility scripts, either populate it or remove it to avoid confusion.
- **`body` font-family in CSS is `'Plus Jakarta Sans'` but `tailwind.config.js` and all components use `'Nunito Sans'`.** The CSS `body` rule is immediately overridden by Tailwind's font-sans, but the mismatch suggests a leftover from an earlier design iteration.
- **No test files exist anywhere in the project.** No unit tests, no integration tests, no e2e tests. For a timesheet application where data accuracy directly affects billing, this is a significant gap.
- **`TIME_BLOCKS` is exported from `constants.js` and still used in `HomePage.jsx` but is labelled "Legacy."** Either complete the migration and remove it, or clearly document where it's still needed and why.

---

## Step 3: The Verdict

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 5 |
| Medium | 5 |
| Minor | 5 |

**This code is not safe to ship as-is.**

The two critical findings must be resolved before deployment: the overly permissive database grants (which undermine the entire RLS security model) and the exposed credentials. The high-severity items should be addressed in the same release, particularly the QuickEntryModal data inconsistency (which is actively producing bad data), the XSS vector in PDF export, and the admin deletion authorisation scope. The missing pagination on the admin view will cause silent data loss as the user base grows, so it should not wait long either.
