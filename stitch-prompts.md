# xTimeBox - Google Stitch Prompts

Use these prompts in Google Stitch to redesign each page of the app. Attach a screenshot of the current page when using "Redesign" mode, then paste the prompt.

---

## Brand Guidelines (reference for all pages)

```
Brand: xTimeBox by xRM365
Fonts: Montserrat (headings, bold 700/800), Nunito Sans (body, 400/600/700)
Theme: Dark mode with glassmorphism
Background: Very dark navy (#020617) with a subtle grid pattern overlay and a soft cyan radial glow in the top-right corner
Cards: Frosted glass effect - semi-transparent white (rgba(255,255,255,0.04)), backdrop blur, 1px border rgba(255,255,255,0.08), rounded 16px corners, deep shadow
Primary accent: Cyan (#00C9FF) for links, active states, highlights, and totals
Secondary accent: Purple (#7B2FDB) for gradients
Gradient: linear-gradient(135deg, #00C9FF, #7B2FDB) for primary buttons and decorative accents
Text: Light slate (#e2e8f0) for body text, white (#fff) for headings, muted slate (#94a3b8) for labels and secondary text, dark slate (#64748b) for subtle text
Inputs: Dark semi-transparent backgrounds (rgba(255,255,255,0.05)), subtle borders, cyan glow on focus
Buttons: Primary = cyan-to-purple gradient with glow shadow. Secondary = transparent with subtle border. Add = dashed cyan border, transparent background
Status colours: Success/done = green (#4ade80), Error = red (#ef4444), Warning = amber (#fbbf24)
Overall feel: Modern, sleek, space-inspired. Think developer tool meets premium SaaS. No flat corporate look.
```

---

## 1. Login Page

```
Redesign this login page for "xTimeBox", a timesheet management app. Match the dark glassmorphism style described below.

Design system:
- Background: Very dark navy (#020617) with a subtle grid pattern overlay (thin white lines at ~2% opacity, 60px spacing) and a soft cyan radial glow in the top-right corner
- Fonts: Montserrat 800 for the heading, Nunito Sans for body and inputs
- Card: Frosted glass - semi-transparent (rgba(255,255,255,0.04)), backdrop-filter blur(20px), 1px border at rgba(255,255,255,0.08), border-radius 16px, deep shadow (0 8px 32px rgba(0,0,0,0.3))

Layout:
- Centred on screen, max-width around 380px
- "xTimeBox" heading in white, Montserrat 800, large
- Subtitle: "Sign in to log your time" in muted slate (#94a3b8)
- Email input: dark background (rgba(255,255,255,0.05)), subtle border, light text, cyan focus ring
- Password input: same style
- Labels above inputs: small, uppercase, bold, muted slate (#94a3b8), letter-spaced
- "Sign in" button: full width, cyan-to-purple gradient (linear-gradient(135deg, #00C9FF, #7B2FDB)), white text, glow shadow (0 0 20px rgba(0,201,255,0.15)), slight lift on hover
- Below the card: small muted text "Need an account? Ask your resource manager to invite you."
- Error state: a soft red-tinted banner (rgba(239,68,68,0.08) background, red border, red text) inside the card above the fields

No sidebar, no navigation. Just the glass card centred on the dark background. Mobile-friendly.
```

---

## 2. App Shell / Navigation Header

```
Redesign the navigation header for "xTimeBox", a timesheet management app. Match the dark glassmorphism style.

Design system:
- Background: Dark navy, slightly lighter than page background, or semi-transparent with backdrop blur
- Border: subtle bottom border (rgba(255,255,255,0.08))
- Fonts: Montserrat 800 for logo, Nunito Sans 600 for nav items

Layout:
- Sticky top bar, around 56px tall
- Left: "xTimeBox" in white, Montserrat 800 weight
- Centre: Navigation items - "New Entry", "My Entries", "Admin" (Admin only for managers)
  - Active tab: cyan text (#00C9FF) with a soft cyan background pill (rgba(0,201,255,0.08)), subtle cyan border
  - Inactive tabs: muted slate (#94a3b8), lighten to white on hover
- Right: User's name in small muted text, "Sign out" link in muted text that brightens on hover

On mobile, the nav items should remain accessible. Consider a compact layout where items wrap or use smaller text. The header should feel like part of the dark glass UI, not a separate white bar.
```

---

## 3. Timesheet Entry Page (New Entry)

```
Redesign the main timesheet entry page for "xTimeBox". This is where users log their time for each day of the week. Match the dark glassmorphism style.

Design system:
- Background: Very dark navy (#020617) with grid pattern and radial glow
- Cards: Frosted glass (rgba(255,255,255,0.04)), backdrop blur, subtle borders, rounded 16px
- Accent: Cyan (#00C9FF) for interactive elements, purple (#7B2FDB) for gradients
- Fonts: Montserrat 800 for page title and day names, Nunito Sans for body

Page title: "Log Time" in white, Montserrat 800

Section 1 - Week details (glass card):
- Two fields side by side: "Week ending (Friday)" date picker and "Client" text input
- Labels: small, uppercase, bold, muted slate, letter-spaced
- Inputs: dark transparent backgrounds, subtle borders, cyan focus glow
- Below: a toggle switch for "Include Saturday and Sunday" - dark track (#334155), cyan when active with a glow

Section 2 - Day sections (one per weekday, Monday to Friday):
- Each day is a collapsible section within a glass-style card
- Header bar: day name in white Montserrat 700, full date in muted slate, total days logged in cyan (#60E0FF) on the right, chevron for expand/collapse
- When expanded:
  - Entry cards: darker glass panels (rgba(255,255,255,0.03)) with subtle borders, rounded 10px
  - Each entry has: an "Entry 1" label in gradient text (cyan to purple), category dropdown, time block dropdown, optional feature/release tag input, optional notes textarea
  - A remove button in red (#ef4444) top right of each entry
  - A "+ Add entry" button: dashed cyan border, transparent background, cyan text
  - Between entries: 0.75rem gap

Section 3 - Submit bar (bottom of page):
- Left: "New entries: X days" summary in muted text
- Right: "Save entries" button in cyan-to-purple gradient with glow
- Disabled state: flat dark grey (#334155), no glow, no cursor

Info banner (conditional):
- Soft cyan-tinted panel (rgba(0,201,255,0.08) background, cyan border) showing "You already have X entries for this week"

Success state:
- Glass card with a green checkmark, "Entries saved" heading in white, message in muted text, "Add more entries" button in gradient

The page should feel like the original v1 timesheet - dark, modern, and focused. Clean spacing, no visual clutter.
```

---

## 4. My Entries Page

```
Redesign the "My Entries" page for "xTimeBox". This shows a user's historical timesheet entries grouped by week. Match the dark glassmorphism style.

Design system:
- Background: Very dark navy (#020617) with grid pattern and radial glow
- Cards: Frosted glass, subtle borders, rounded 16px
- Accent: Cyan (#00C9FF), purple (#7B2FDB)
- Fonts: Montserrat for headings, Nunito Sans for body

Page title: "My Entries" in white, Montserrat 800

Layout - entries grouped by week:
- Each week is a glass card
- Week header: "Week ending [date]" in white Montserrat 700, below it "[Client] · X days · Y entries" in muted slate
  - Right side: "Submit week" button (cyan-to-purple gradient) if drafts exist, or a "Signed off" badge (green) if locked
- Inside each week card, entries grouped by day
- Day sub-header: day name in white Montserrat 700, date in muted slate
- Entry rows: dark glass panels (rgba(255,255,255,0.02)) with subtle borders
  - Category name in light text, bold
  - Status badge next to it:
    - Draft: dark slate background (rgba(255,255,255,0.06)), muted text
    - Submitted: cyan-tinted background (rgba(0,201,255,0.08)), cyan text
    - Signed off: green-tinted background (rgba(74,222,128,0.08)), green text (#4ade80)
  - Time block value in cyan
  - Feature tag in cyan, slightly smaller
  - Notes in muted italic
  - Edit link in cyan, Delete link in red (only for appropriate statuses)

Empty state:
- Centred message in muted text with a cyan link to the timesheet page

Edit modal:
- Dark overlay (rgba(0,0,0,0.5))
- Glass card centred on screen with the entry's day and date
- Same dark input styling as the timesheet page
- Cancel button (secondary style) and "Save changes" (gradient)

The page should make it easy to scan weeks at a glance. Use the collapsible day pattern from the original v1 review page.
```

---

## 5. Admin Dashboard

```
Redesign the admin dashboard for "xTimeBox". This is the resource manager's view for reviewing and signing off team timesheets. Match the dark glassmorphism style.

Design system:
- Background: Very dark navy (#020617) with grid pattern and radial glow
- Cards/tables: Frosted glass, subtle borders
- Accent: Cyan (#00C9FF), purple (#7B2FDB), green (#4ade80) for sign-off
- Fonts: Montserrat for headings, Nunito Sans for body and table content

Page header:
- "Admin Dashboard" in white, Montserrat 800
- "Invite user" button on the right (cyan-to-purple gradient)

Month navigator:
- Centred row: left arrow, month/year label in white Montserrat 700 (e.g. "March 2026"), right arrow
- Arrows in muted slate, brighten on hover
- Minimal styling, no heavy background

Summary table (glass card):
- Table with subtle row separators (rgba(255,255,255,0.06))
- Header row: muted slate text, uppercase, small, letter-spaced (matching the label style from v1)
- Columns: Name (with email in smaller muted text below), Days (total in cyan), Entries (count), Status (badge), View (cyan link)
- Status badges same as My Entries page
- Rows: subtle hover effect (rgba(255,255,255,0.02))
- Below table: "Total across all users: X days" right-aligned, total in white bold

User detail view (when clicking "View"):
- Back arrow in muted text, user's name in white Montserrat 800
- Subtitle: "[Month Year] · X days total" in muted slate with total in cyan
- Sign-off status card (glass):
  - Not signed off: muted message, entry count, green "Sign off month" button (solid green #4ade80 background or green-tinted glass)
  - Signed off: green-tinted glass card, "Signed off" in green, who signed off and when in muted text, "Revoke sign-off" link in red
- Below: entries grouped by week and day (same layout as My Entries but read-only, no edit/delete)

Invite user modal:
- Dark overlay, centred glass card
- Fields: Full name, Email, Role dropdown (User / Resource Manager / Admin)
- Same dark input styling
- Cancel (secondary) and "Create account" (gradient) buttons

Success banner after invite:
- Green-tinted glass panel showing account details and temporary password in a monospace code block

The dashboard should feel powerful but clean. Prioritise table readability with good contrast on the dark background.
```

---

## Tips for Stitch

- Use "Redesign" mode and attach a screenshot of the current page for each prompt
- Generate each page separately, then verify they share the same dark glass visual language
- The key visual signatures to keep consistent: the grid background, the radial glow, the frosted glass cards, cyan/purple gradient buttons, and the dark input styling
- If Stitch generates React/HTML code, the component structure maps directly to: Layout.jsx, LoginPage.jsx, TimesheetPage.jsx, MyEntriesPage.jsx, AdminPage.jsx
- Focus on getting the visual design right - the data layer and interactivity are already built
