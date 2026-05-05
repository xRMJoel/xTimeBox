# xTimeBox - Project Instructions

> These instructions apply to all AI sessions working on the xTimeBox codebase. They sit alongside Joel's global rules (in `XX - About Me/my-rules.md`) and add project-specific context and maintenance requirements.

---

## Session Setup

At the start of every session involving this codebase:

1. Read `ProjectKnowledge.md` in the project root for full project context.
2. Read Joel's global rules: `XX - About Me/my-rules.md`, `XX - About Me/my-voice.md`, `XX - About Me/about-me.md`.
3. If the session involves writing user-facing text, documentation, or commit messages, apply the voice and style rules from `my-voice.md`.

---

## Working on This Project

### Before Making Changes

- Check the **Outstanding Tech Debt** section in `ProjectKnowledge.md` to see if the work you're about to do overlaps with a known issue.
- Check the **Resolved Issues** table before raising something as a problem. It may already be fixed.
- If the change touches database schema, check the **Migration History** table for the next migration number.

### Code Conventions

Follow the patterns already in the codebase. Key rules:

- **No TypeScript.** This project uses plain JSX.
- **Functional components only.** No class components.
- **Hooks for business logic.** Domain logic goes in `src/hooks/`, not in page components.
- **RLS is the access control layer.** Never rely solely on frontend checks for permissions. If a new feature needs access control, it needs an RLS policy.
- **Escape dynamic content in HTML strings.** Any dynamic value rendered in HTML (especially in `pdfExport.js`) must go through `escapeHtml()`.
- **Paginate Supabase queries.** Never assume a query will return all rows. Use `.range()` with a loop if the result set could exceed 1,000 rows.
- **Use CSS variables for colours where possible.** New components should reference CSS variables from `index.css`, not hardcode hex values.

### Database Changes

- Create a new migration file: `supabase/NNN-description.sql` where NNN is the next number in sequence.
- Include a header comment block explaining what the migration does and any manual steps required.
- Never modify existing migration files. They represent the history of what was run.
- Test in the Supabase SQL Editor before committing.

### Deployment

Push to `main` auto-deploys to Vercel. There are no branch protections or PR reviews. This means:

- **Test locally before pushing.** Run `npm run build` to catch build errors.
- **Don't push broken code to main.** If something is half-done, keep it local.
- **Database migrations are manual.** After pushing code that depends on a new migration, run the migration in the Supabase SQL Editor promptly.

---

## Keeping ProjectKnowledge.md Up to Date

This is the most important maintenance task. The ProjectKnowledge.md file is only useful if it reflects the current state of the project. Update it as part of completing work, not as a separate task.

### When to Update

Update `ProjectKnowledge.md` when any of the following happen during a session:

| Change | What to update |
|---|---|
| New migration added | Add to the **Migration History** table. Update **Next migration number**. |
| New page or route added | Update the **Project Structure** tree and the **Key Files Quick Reference**. |
| New table or column added | Update the **Core Tables** section in Database Schema. |
| New RPC/function added | Add to the **Key RPCs** list. |
| Tech debt item resolved | Move from **Outstanding Tech Debt** to **Resolved Issues** with the commit hash or migration number. |
| New tech debt identified | Add to **Outstanding Tech Debt** with appropriate priority. |
| New dependency added | Update the **Tech Stack** table. |
| Styling system changes | Update the **Styling and Design** section. |
| Auth flow changes | Update the **Authentication and Authorisation** section. |
| Time entry model changes | Update the **Time Entry Model** section. |
| Convention established or changed | Update the **Conventions** section. |
| Deployment process changes | Update the **Deployment** section. |

### How to Update

- Update the **Last updated** date in the frontmatter.
- Keep entries factual and concise. This file is for AI consumption, not documentation for humans.
- When resolving tech debt, include the commit hash or migration number so the resolution is traceable.
- Don't remove resolved issues from the **Resolved Issues** table. The history prevents AI tools from re-raising fixed problems.

### What Not to Put Here

- Detailed code explanations (read the code instead)
- Conversation-specific context (use the todo list)
- Joel's personal preferences or voice rules (those live in the About Me files)
- Credentials, API keys, or sensitive data of any kind

---

## Project-Specific Rules

These supplement Joel's global rules for this specific project:

1. **Never commit credentials.** The `.env` file is gitignored. Never create files containing Supabase keys, passwords, or tokens outside of `.env`.
2. **Always use RLS.** If you're creating a new table or modifying access patterns, write RLS policies. The anon key is exposed in the frontend, so RLS is the only real security boundary.
3. **Respect the entry status flow.** `draft → submitted → signed_off` (with `returned` as a branch back to editable). Don't create shortcuts around this flow without discussing it.
4. **PDF export is CDN-dependent.** jsPDF and html2canvas are loaded at runtime from CDN. If you modify `pdfExport.js`, test that the CDN loading still works and that all dynamic content is escaped.
5. **The home page QuickEntryModal is a large inline component.** It lives inside `HomePage.jsx` (around 400 lines). If making significant changes, consider whether it should finally be extracted to its own file.
6. **AdminPage.jsx is overdue for splitting.** It contains three tab components. If your change only affects one tab, be careful not to break the others. If you're doing significant work here, consider splitting it as part of the change.
