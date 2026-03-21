# xTimeBox - Setup Guide

## What's changed from v1

The timesheet has moved from a single HTML file with Google Sheets backend to a React app backed by Supabase. Key additions:

- **User authentication** - everyone logs in with email and password
- **My Entries** - users can view, edit, and delete their own entries
- **Admin dashboard** - resource managers see all entries by person and can sign off monthly
- **Entry locking** - once a month is signed off, entries are locked from editing
- **Invite-only access** - admins create accounts, no public sign-up

## Step 1: Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (or create a free account)
2. Click **New Project**
3. Give it a name (e.g. "xtimebox")
4. Set a strong database password (save this somewhere safe)
5. Choose a region close to you (London is ideal)
6. Click **Create new project** and wait for it to provision

## Step 2: Run the database migration

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open the file `supabase/migration.sql` from this project
4. Copy and paste the entire contents into the SQL editor
5. Click **Run** (or Cmd+Enter)
6. You should see "Success. No rows returned" - that's correct

This creates all the tables, security policies, and helper functions.

## Step 3: Configure authentication

1. In the Supabase dashboard, go to **Authentication** > **Providers**
2. Make sure **Email** is enabled (it should be by default)
3. Go to **Authentication** > **URL Configuration**
4. Set the **Site URL** to your deployment URL (e.g. `https://timesheet.xrm365.co.uk`)
5. Add the same URL to **Redirect URLs**

### Disable public sign-ups (recommended)

Since this is invite-only:

1. Go to **Authentication** > **Settings**
2. Under **User Signups**, toggle off **Enable sign ups** if you want to restrict to admin-created accounts only
3. **Important:** If you disable sign-ups, you'll need to create users via the Supabase dashboard or use the invite user feature in the admin panel

### Create your admin account

1. Go to **Authentication** > **Users**
2. Click **Add User** > **Create New User**
3. Enter your email and a password
4. Click **Create User**
5. Now go to **Table Editor** > **profiles**
6. Find your row and change the `role` column from `user` to `admin`

## Step 4: Get your Supabase credentials

1. In the Supabase dashboard, go to **Settings** > **API**
2. Copy the **Project URL** (looks like `https://xxxxx.supabase.co`)
3. Copy the **anon public** key (the long string under "Project API keys")

## Step 5: Set up the project locally

```bash
# Navigate to the project folder
cd xtimebox

# Install dependencies
npm install

# Create your environment file
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 6: Run locally

```bash
npm run dev
```

This starts the dev server at `http://localhost:5173`. Sign in with the admin account you created in Step 3.

## Step 7: Deploy to Vercel

The project includes a `vercel.json` for SPA routing. Deploy the same way as v1:

1. Push the project to a **private** GitHub repository
2. In Vercel, import the repository
3. Vercel will auto-detect Vite and configure the build
4. Add environment variables in Vercel's project settings:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Deploy

Vercel will auto-redeploy on every push to `main`.

### Custom domain

Same process as before - add a CNAME record pointing to Vercel, then add the domain in Vercel's project settings. Remember to update the **Site URL** in Supabase Authentication settings to match.

## How it works

### Entry workflow

1. **User logs time** - entries are saved as `draft` status
2. **User submits a week** - entries move to `submitted` status
3. **Resource manager signs off** - all entries for that user's month move to `signed_off` (locked)

Users can edit entries in `draft` or `submitted` status. Once signed off, entries are read-only. A resource manager can revoke a sign-off to unlock entries if corrections are needed.

### Roles

| Role | Can do |
|---|---|
| `user` | Log time, view/edit own entries, submit weeks |
| `resource_manager` | Everything a user can do, plus view all entries, sign off months, invite users |
| `admin` | Everything a resource manager can do, plus change user roles |

### Data security

All access control is enforced at the database level using Supabase Row Level Security (RLS). Even if someone inspects the JavaScript, they can only access data their role permits. The anon key in the frontend is safe to expose - it only grants access through RLS policies.

## Customising the UI

The frontend uses React with Tailwind CSS for styling. The component structure is designed to be straightforward to reskin:

```
src/
  components/     # Reusable UI pieces (Layout, StatusBadge, EntryCard, etc.)
  pages/          # Full page components (Login, Timesheet, MyEntries, Admin)
  hooks/          # Auth context and data fetching hooks
  lib/            # Supabase client, constants, utility functions
```

If you're using Google Stitch to design the interface, the data layer (hooks and lib) stays the same - you'd replace the JSX in pages and components to match your designs.

## Troubleshooting

**"Missing Supabase credentials" error on startup**
Check that your `.env` file exists and has both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set correctly. Restart the dev server after changing `.env`.

**"Invalid login credentials"**
Double-check the email and password. If you created the user via the Supabase dashboard, make sure the account is confirmed.

**Admin page not visible**
Your profile role must be `resource_manager` or `admin`. Check the `profiles` table in Supabase Table Editor.

**RLS errors when inserting entries**
Make sure the migration SQL ran completely. Check the Supabase SQL Editor for any errors from the migration.

**Entries not locking after sign-off**
The `sign_off_month` function updates entries by date range. Make sure entries have correct `entry_date` values that fall within the signed-off month.
