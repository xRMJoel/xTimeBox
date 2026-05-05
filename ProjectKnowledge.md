# xTimeBox - Project Knowledge

> **Purpose:** This file provides full project context for AI tools working on xTimeBox. Load this at the start of every session involving this codebase.
>
> **Last updated:** 2026-05-05 (Per-entry hours_per_day snapshot; rate changes are no longer retrospective)
>
> **Owner:** Joel Abbott (Joel.Abbott@xrm365.co.uk)

---

## 1. What xTimeBox Is

A timesheet management app for the xRM365 team. Users log time against projects, submit weekly, and resource managers sign off monthly. It replaced a single-page HTML + Google Sheets setup (v1) with a full React app backed by Supabase.

**Live URL:** https://www.xtimebox.app/
**Version:** 2.0.0
**Users:** Under 10 (internal xRM365 team only)
**Status:** Live in production

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 18 + Vite 5 | Single-page app, no SSR |
| Styling | Tailwind CSS 3.4 | Dark glassmorphism theme |
| Routing | React Router DOM 6 | Client-side routing |
| Backend | Supabase (hosted) | Auth, database, RLS |
| Database | PostgreSQL (via Supabase) | Row Level Security enforces all access control |
| Deployment | Vercel | Auto-deploys on push to main |
| Analytics | Vercel Analytics + Speed Insights | Bundled in App.jsx |
| PDF export | jsPDF + html2canvas | Loaded from CDN at runtime |
| Fonts | Montserrat (headings), Nunito Sans (body) | Google Fonts, loaded in index.html |

**No test framework is currently configured.** There are zero test files in the project.

---

## 3. Project Structure

```
xtimebox/
  src/
    App.jsx                  # Root component, all route definitions
    main.jsx                 # Entry point, wraps App in AuthProvider + Router
    index.css                # Global styles, CSS variables, Tailwind directives
    components/
      Layout.jsx             # App shell: nav header, background, page wrapper
      EntryCard.jsx          # Single timesheet entry display card
      LoadingSpinner.jsx     # Reusable loading state
      ProtectedRoute.jsx     # Auth guard, redirects to /login if no session
      StatusBadge.jsx        # Coloured badge for entry status (draft/submitted/signed_off/returned)
      WeekCalendar.jsx       # Visual week calendar used on the home page
    hooks/
      useAuth.jsx            # AuthContext provider: session, profile, login/logout, role checks
      useEntries.js          # All timesheet CRUD: fetch, save, submit, delete, admin operations
      useTheme.jsx           # Theme context (currently dark mode only)
    lib/
      constants.js           # Categories, time helpers, date utilities, reference generator
      pdfExport.js           # PDF generation: loads jsPDF/html2canvas from CDN, builds HTML, exports
      supabase.js            # Supabase client initialisation from env vars
    pages/
      AdminPage.jsx          # Resource manager/admin dashboard (approvals, projects, users tabs)
      CompleteProfilePage.jsx # First-login profile completion
      ForgotPasswordPage.jsx # Password reset request
      HomePage.jsx           # Dashboard home with QuickEntryModal, WeekCalendar, recent entries
      LoginPage.jsx          # Email/password and Google OAuth login
      MyEntriesPage.jsx      # User's own entries grouped by week, with edit/delete
      ProfilePage.jsx        # User profile settings, email change
      RegisterPage.jsx       # Registration (used via admin invite flow)
      ReportsPage.jsx        # Reporting/export page
      ResetPasswordPage.jsx  # Password reset completion
      TimesheetPage.jsx      # Full weekly timesheet entry form
  supabase/
    migration.sql            # Base schema (run first)
    002-*.sql to 013-*.sql   # Sequential migrations (see Migration History below)
  public/                    # Static assets
  dist/                      # Build output (Vite)
```

---

## 4. Database Schema

### Core Tables

**profiles** — extends Supabase Auth. One row per user.
- `id` (UUID, FK to auth.users), `full_name`, `email`, `role` (user_role enum), `default_client`, `avatar_url`, `deactivated_at`, `created_at`, `updated_at`
- Roles: `user`, `resource_manager`, `admin`
- Auto-created via trigger on auth.users insert

**timesheet_entries** — the main data table.
- `id` (UUID), `user_id` (FK profiles), `project_id` (FK projects), `reference` (generated), `client`, `week_ending` (DATE, always a Friday), `day_name`, `entry_date` (DATE), `category`, `time_block` (legacy text), `time_value` (NUMERIC, days), `time_hours` (NUMERIC, hours logged by user), `hours_per_day_snapshot` (NUMERIC, locked rate at entry-create time, used to derive days non-retrospectively), `feature_tag`, `notes`, `status` (entry_status enum), `created_at`, `updated_at`
- Status enum: `draft`, `submitted`, `signed_off` (plus `returned` added in migration 004)

**projects** — client projects that users log time against.
- `id`, `name`, `client`, `is_active`, `created_by`, `created_at`

**user_projects** — assignment of users to projects.
- `user_id`, `project_id`, `hours_per_day` (NUMERIC, used for hours-to-days conversion), `created_at`

**monthly_signoffs** — tracks which user-months have been signed off.
- `id`, `user_id`, `month_start` (DATE), `signed_off_by`, `signed_off_at`

**non_working_days** — bank holidays, leave, etc.
- `id`, `user_id` (nullable for global days), `entry_date`, `reason`, `created_by`, `created_at`

### Key RPCs (Supabase Functions)

- `is_manager_or_admin()` — returns boolean, used in RLS policies
- `is_admin()` — returns boolean, admin-only operations
- `get_admin_summary(p_month_start DATE)` — returns aggregated monthly data per user for the admin dashboard
- `sign_off_month(...)` / `revoke_sign_off(...)` — manages monthly signoff lifecycle
- `admin_delete_user(...)` — admin-only user deletion
- `submit_week(...)` — moves entries from draft to submitted

### Entry Status Flow

```
draft → submitted → signed_off
                  → returned → draft (re-editable)
```

Users can edit entries in `draft` or `submitted` status. Once signed off, entries are read-only. A resource manager can return entries to unlock them.

### Migration History

Migrations are numbered sequentially. The base schema is in `migration.sql`. All subsequent migrations are in `supabase/` as `NNN-description.sql`.

| Migration | Description |
|---|---|
| migration.sql | Base schema: profiles, timesheet_entries, RLS policies, triggers |
| 002 | Profile fields (avatar, additional columns) |
| 003 | Avatar storage bucket |
| 004 | Added `returned` status |
| 005 | Projects and user_projects tables |
| 006 | Admin delete user function |
| 007 | Non-working days table |
| 008 | Sign-off by week (later superseded by monthly) |
| 009 | Hours-based time entry (time_hours column, hours_per_day on user_projects) |
| 010 | Tightened database grants (replaced blanket GRANT ALL with minimal permissions) |
| 011 | Admin-only delete (restricted from resource_manager) |
| 012 | Fixed get_admin_summary to include returned_count |
| 013 | Server-side trigger to sync auth.users.email to profiles.email on email change confirmation |
| 014 | Add `reason` column to `non_working_days` table |
| 015 | Enforce `user_projects.hours_per_day` NOT NULL + CHECK > 0 |
| 016 | Authoritative BEFORE INSERT/UPDATE trigger on `timesheet_entries` deriving `time_value` and `time_block` from `time_hours` and `user_projects.hours_per_day`, plus one-off self-heal pass |
| 017 | Added `Managers and admins can delete any entry` RLS policy on `timesheet_entries` so admin clean-up of submitted/signed-off entries works |
| 018 | Added `hours_per_day_snapshot` to `timesheet_entries`. Trigger now snapshots the rate on INSERT (and refreshes only when project_id/user_id changes), so rate changes on `user_projects.hours_per_day` are non-retrospective |

**Next migration number:** 019

---

## 5. Authentication and Authorisation

Authentication is handled by Supabase Auth. The app supports email/password login and Google OAuth.

### Auth Flow

1. `useAuth.jsx` initialises by calling `supabase.auth.getSession()`
2. Profile is loaded in the background (non-blocking) via `loadProfileInBackground()`
3. `ProtectedRoute` checks for a valid session and redirects to `/login` if absent
4. New users without a complete profile are redirected to `/complete-profile`
5. Deactivated users are signed out automatically

### Role-Based Access

| Role | Capabilities |
|---|---|
| `user` | Log time, view/edit own entries, submit weeks |
| `resource_manager` | All user capabilities + view all entries, sign off months, invite users, return entries |
| `admin` | All resource_manager capabilities + change user roles, delete users |

All access control is enforced at the database level via Supabase RLS policies. The frontend hides UI elements by role, but the database is the single source of truth for permissions.

---

## 6. Styling and Design

### Visual Language

Dark glassmorphism theme. The UI has a space-inspired, premium SaaS feel.

- **Background:** Very dark navy (`#020617`) with a subtle grid pattern overlay and a soft cyan radial glow
- **Cards:** Frosted glass effect (`rgba(255,255,255,0.04)`), backdrop blur, 1px border at `rgba(255,255,255,0.08)`, rounded 16px
- **Primary accent:** Cyan (`#00C9FF`) for links, active states, highlights, totals
- **Secondary accent:** Purple (`#7B2FDB`) for gradients
- **Gradient buttons:** `linear-gradient(135deg, #00C9FF, #7B2FDB)` with glow shadow
- **Status colours:** Green (`#4ade80`) for success/signed off, red (`#ef4444`) for errors, amber (`#fbbf24`) for warnings
- **Text:** Light slate (`#e2e8f0`) body, white (`#fff`) headings, muted slate (`#94a3b8`) labels

### CSS Variables

Defined in `src/index.css` (lines 26-35). These should be used for theming, though some components still use hardcoded hex values (see Tech Debt).

### Fonts

- **Montserrat** (700/800) for headings and the logo
- **Nunito Sans** (400/600/700) for body text and inputs

Both loaded via Google Fonts in `index.html`. Tailwind's `font-sans` is configured to use Nunito Sans.

### Design Reference

Full page-by-page design prompts are in `stitch-prompts.md` (used with Google Stitch for design iteration). This is the definitive visual reference for each page.

---

## 7. Time Entry Model

Time is logged in **hours**. The system converts hours to days using `hours_per_day` from the user's project assignment.

### How It Works

1. User enters hours (in 0.25-hour increments, validated by `isValidHourIncrement()`)
2. Hours are stored in `time_hours` on the entry
3. Days (`time_value`) and the `time_block` label are derived server-side by the `timesheet_entries_derive_days` trigger. The frontend still calculates them for optimistic display, but the DB trigger is authoritative and overwrites whatever the caller supplies.
4. Each entry stores its own `hours_per_day_snapshot` (migration 018). The trigger sets it on INSERT from `user_projects.hours_per_day`, and refreshes it on UPDATE only when `project_id` or `user_id` changes. Edits that change just `time_hours` keep the original snapshot, so changing the rate on `user_projects` is non-retrospective: existing entries keep the rate they were saved against.
5. To pick up a new rate on a historic entry, delete and re-create it. The AdminPage rate-change input surfaces a confirm modal stating this.
6. `user_projects.hours_per_day` is NOT NULL with `CHECK > 0` (migration 015). The trigger raises if a rate can't be resolved when a snapshot needs to be set/refreshed.
7. Weekly day totals are rounded UP to nearest 0.25 days (via `roundDays()`)
8. `hours_per_day` is set per user-project assignment (e.g. 7.5 for a standard day)

### Key Functions (in constants.js)

- `isValidHourIncrement(hours)` — validates 0.25-hour increments
- `hoursToDaysRaw(hours, hoursPerDay)` — raw division, no rounding
- `roundDays(days)` — rounds UP to nearest 0.25
- `hoursToDays(hours, hoursPerDay)` — convenience: raw then round
- `generateReference(date, counter)` — generates `XRM-YYYYMMDD-ABC-01` format references using `crypto.getRandomValues`

### Categories

Defined in `constants.js`. Each category specifies whether it shows a reference field and what the placeholder text should be:

Onboarding, Support Ticket Investigation, Solution Design, Development, Testing, UAT Support, Release, Other

---

## 8. Deployment

### Workflow

Push to `main` triggers Vercel auto-deploy. There is no staging environment, no branch protection, and no PR process. The workflow is intentionally lightweight for a small internal tool.

### Environment Variables (Vercel)

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key (safe to expose, RLS enforces access)

### Build

```bash
npm run dev      # Local dev server (Vite, port 5173)
npm run build    # Production build to dist/
npm run preview  # Preview production build locally
```

### Domain

Custom domain configured in Vercel, with matching Site URL and Redirect URLs in Supabase Auth settings.

---

## 9. Conventions

### Component Patterns

- **File naming:** PascalCase for components and pages (e.g. `AdminPage.jsx`, `EntryCard.jsx`)
- **Hooks:** Return objects with `{ loading, error, ...methods }` pattern
- **State management:** React Context for global state (auth, theme), custom hooks for domain logic
- **Protected routes:** Wrap in `<ProtectedRoute>` (or `<ProtectedRoute requireManager>` for admin pages)
- **Layout:** All authenticated pages wrap content in `<Layout>` for the nav header and page background

### Code Style

- Functional components with hooks throughout (no class components)
- Named exports for hooks and context, default exports for page/component files
- Vite handles all bundling and HMR
- No TypeScript (plain JSX)
- No linter or formatter configured

### Database Conventions

- All access control via RLS policies, never application-level checks alone
- `SECURITY DEFINER` functions for operations that need elevated access
- Migrations numbered sequentially (`NNN-description.sql`)
- Always test migrations in the Supabase SQL Editor before deploying

### Commit Messages

Descriptive, imperative mood. Examples from the git log:

- "Fix admin summary, submitWeek no-op check, pagination, minor cleanups"
- "Add email change feature to Profile page"
- "Fix code review items 3-6: hours-based quick entry, race condition guard, admin-only delete, XSS escaping"

---

## 10. Outstanding Tech Debt

These are open items from the code review (CODE-REVIEW-v1.md, dated 2026-03-26). Items are listed in priority order.

### Medium Priority

1. **CDN-loaded PDF libraries have no SRI hashes.** `pdfExport.js` loads jsPDF and html2canvas from CDN fallbacks (jsdelivr, cdnjs, unpkg) without Subresource Integrity attributes. Options: add SRI hashes, or bundle via npm.

2. **AdminPage.jsx is still 1,313 lines.** Contains three tab components (ApprovalsTab, ProjectsTab, UsersTab) with shared state in a single file. Should be split into separate component files.

3. **Hardcoded colour values throughout components.** CSS variables exist in `index.css` but many components use inline hex values (e.g. `#22c55e`, `#fbbf24`, `rgba(0,201,255,...)`) instead of referencing them.

### Low Priority

4. **No test coverage.** Zero test files. For a timesheet app where data accuracy affects billing, this is a gap worth addressing eventually.

5. **Empty scripts/ directory.** Contains no files. Either add utility scripts or remove the directory.

6. **TIME_BLOCKS still imported in HomePage.jsx.** The constant is marked as legacy in `constants.js` and is no longer used in the QuickEntryModal (which now uses hours-based input), but the import statement remains.

7. **Body font-family set in both index.css and Tailwind config.** `index.css` sets `font-family: 'Nunito Sans'` on body, while Tailwind's `font-sans` is also configured to Nunito Sans. Works correctly but the CSS rule is redundant.

---

## 11. Resolved Issues

These were identified in the code review and have been fixed. Listed here so AI tools don't re-raise them.

| Issue | Resolution | Commit/Migration |
|---|---|---|
| Overly permissive database grants (GRANT ALL) | Replaced with minimal grants | Migration 010 |
| QuickEntryModal used legacy day-based TIME_BLOCKS | Converted to hours-based input | Commit 1591c46 |
| Race condition on concurrent save in TimesheetPage | Added submittingRef guard | Commit 1591c46 |
| resource_manager could delete users (should be admin-only) | is_admin() check added | Migration 011 |
| XSS vulnerability in PDF export | escapeHtml() applied to all dynamic values | Commit 1591c46 |
| No pagination on fetchAllEntries (silent truncation at 1000 rows) | Paginated with PAGE_SIZE=500 | Commit 6608c1a |
| get_admin_summary missing returned_count | Column restored | Migration 012 |
| submitWeek no-op (silently affected zero rows) | Now checks affected row count and throws | Commit fac0a32 |
| No error handling on admin loadData | Uses Promise.allSettled with error reporting | Commit 6608c1a |
| generateReference used Math.random | Already uses crypto.getRandomValues (review was incorrect) | N/A |
| `MyEntriesPage` edit flow left stale `time_value` after an hours change (e.g. 1hr showing as 1.07d) | Edit handler now recalculates `time_value`/`time_block` from `hours_per_day` before save, and a DB trigger recomputes authoritatively on every write | Migration 016 + MyEntriesPage change |
| `user_projects.hours_per_day` was nullable | Enforced NOT NULL + CHECK > 0 so a user can't be assigned to a project without a valid rate | Migration 015 |
| Cross-month weeks: when a week's early days were signed off with the prior month, the remaining days of the same week were unreachable from the UI (no "Edit week" link, week badge read as fully signed off) | `getWeekStatus` now returns `'mixed'` for partially signed-off weeks; `MyEntriesPage` `WeekCard` always shows "Edit week" on cross-month weeks; `TimesheetPage` shows a lock banner and relabels submit button to "Submit drafts" when any entry in the loaded week is signed off. DB layer was already correct (`sign_off_month` filters by `entry_date`). | Commit b6d421f |
| Admin could not delete a submitted/signed-off `timesheet_entries` row, e.g. an entry left over after a day was marked non-working. The only DELETE policy was the user-self draft/returned one, so admin deletes were silently rejected by RLS while the toast claimed success | Added a manager/admin DELETE policy on `timesheet_entries`. Hardened `deleteEntry` in `useEntries.js` to `.select()` the deleted row and throw if zero rows came back, so a future RLS block surfaces as a real error instead of a silent no-op | Migration 017 |
| Changing `user_projects.hours_per_day` mid-project retroactively recomputed days on historic entries the next time they were touched (e.g. on sign-off), because the derive-days trigger always read the live rate. Rate increases/decreases were silently applied in arrears | Added `timesheet_entries.hours_per_day_snapshot`. Trigger snapshots the rate on INSERT and only refreshes it when `project_id`/`user_id` change. Plain edits and status-only updates keep the original snapshot, so rate changes only apply to entries created after the change. AdminPage rate input now defers save behind a confirm modal explaining the behaviour | Migration 018 |

---

## 12. Key Files Quick Reference

When working on a specific area, start with these files:

| Area | Start here |
|---|---|
| Adding a new page/route | `src/App.jsx` |
| Auth flow or role checks | `src/hooks/useAuth.jsx` |
| Timesheet CRUD, submit, admin ops | `src/hooks/useEntries.js` |
| Time calculation logic | `src/lib/constants.js` |
| PDF export | `src/lib/pdfExport.js` |
| Nav, header, app shell | `src/components/Layout.jsx` |
| Admin dashboard (approvals, projects, users) | `src/pages/AdminPage.jsx` |
| Quick entry from home page | `src/pages/HomePage.jsx` (QuickEntryModal component) |
| Full weekly timesheet form | `src/pages/TimesheetPage.jsx` |
| Database schema | `supabase/migration.sql` + subsequent migrations |
| Visual design reference | `stitch-prompts.md` |
| Supabase client config | `src/lib/supabase.js` |
| Global CSS, variables, Tailwind | `src/index.css` + `tailwind.config.js` |
