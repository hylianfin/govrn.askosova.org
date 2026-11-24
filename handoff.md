# Handoff: ASK Student Government & Elections platform

Last updated 2026-10-20 (session end). Repo: https://github.com/hylianfin/govrn.askosova.org (branch `main`).
Live site: https://ask-gov.ruhanpacolli.online (Vercel project `govrn.askosova.org`, team `rahanpacos-projects`, region `dub1`).
Database: Supabase project **ASK-Gov** (`pvsqetxiryhivuswzuqv`, eu-west-1).

## 1. Goal

A school election platform for ASK (Next.js 16 App Router + Supabase + Tailwind). Students apply for the **Executive Team** (team of 4) or **Student Senate** (individual). Staff review applications against eligibility criteria. Admins run the election (timeline, forms, roles). Volunteers sign up for shifts.

The current push: **bring applications already collected through Google Forms into the platform and attach each to the right student account automatically when they sign up.** The Senate form is done. The Executive Team form import is explicitly "later".

Election timeline (Europe/Berlin, 2026): application deadline 20-21 Oct 15:00; eligibility 23 Oct; prep 26-27 Oct; campaign 3-5 Nov; debate 5 Nov; silence 6 Nov; election day 9 Nov.

## 2. Current status of the code

Everything below is committed and pushed (HEAD `6a6b32a`, deployed to Vercel). `npx tsc --noEmit` passes. ESLint only reports the pre-existing `no-explicit-any` errors in the repo's style.

**Important: almost nothing has been seen running while signed in.** The browser pane was never signed in and the agent cannot type passwords. Verification so far = type-check, lint, database tests inside rolled-back transactions, `curl` against the live site (public pages, redirects), and unit tests of pure functions. **No signed-in page has been visually checked** (dashboards, forms, builder, review, volunteers, import wizard, verify screen).

Built and live:
- **Role-based consoles**: student `/dashboard`, staff `/staff`, admin `/admin`. Admin gets admin+staff consoles (not student); staff get staff only (`lib/nav.ts` `homeForRoles`, `consoleLinks`). Grouped sidebar, mobile drawer.
- **Google Forms-style applicant forms + admin form builder** (`components/forms/*`, `lib/actions/forms.ts`, `lib/actions/form-answers.ts`). Autosave, server-enforced required checks, team-scope vs individual-scope answers.
- **Timeline editor** with date/time pickers, election-timezone aware (`lib/datetime.ts`, `components/forms/timeline-editor.tsx`). Progress tracker is **date-driven** (`lib/timeline.ts`); the manual "current stage" control was removed.
- **Application review** (`app/staff/applications/[id]`, `lib/actions/review.ts`): per-criterion Meets/Doesn't/Unsure, approve blocked until all met, required comment for deny/changes, applicant + team notified.
- **Users/Roles pages**, volunteer shifts system (staff board + volunteer self-service), notifications page.
- **Sign-up restricted to askosova.org** (form check + DB trigger on `auth.users`).
- **Google Forms import** (`/admin/forms/import`, `lib/csv.ts`, `lib/import.ts`, `lib/actions/import.ts`): CSV upload, column mapping, works **without an email column**, ignores Google's `[Score]`/`[Feedback]`/`Total score` columns.
- **Linking imported responses to accounts** (three paths, all server-side in Postgres, migrations 0008-0015):
  1. Exact email match once the email is confirmed.
  2. No-email responses: confirmed `@students.askosova.org` address that spells the name (`firstname.lastname@`, either order, typo-tolerant, digits need exact match).
  3. Otherwise the student sees `/dashboard/verify`, asks grade + homeroom teacher, typo/case/title tolerant (`Ms`/`MS`/`ms`, one wrong/missing/extra letter or swapped neighbours), 5 wrong tries/hour lockout.
  Staff can also attach an email by hand in the import list.
- **Performance**: `vercel.json` pins functions to `dub1`; auth uses `getClaims()` (local JWT verify, project uses ES256 keys) in `proxy.ts` and `lib/auth/session.ts`.
- **Auth emails**: `/auth/callback` route + `emailRedirectTo` in sign-up; branded templates in `supabase/email-templates/*.html` (NOT yet pasted into Supabase).

Database migrations `0001`-`0015` are in `supabase/migrations/` and **all applied to the live DB** (applied via the Supabase MCP tool, not the CLI, so there is no `supabase_migrations` drift tracking guarantee beyond names).

## 3. Files I'm actively editing

None are uncommitted. The last work was `supabase/migrations/0015_email_name_match.sql` plus the verify flow (`lib/actions/verify.ts`, `components/forms/verify-form.tsx`, `app/dashboard/verify/page.tsx`, banner in `app/dashboard/page.tsx`, redirect in `app/dashboard/applications/senate/page.tsx`). This handoff file is the only new file and is not committed yet.

## 4. Everything I tried that failed (and what I learned)

- **AGENTS.md prompt-injection-style block.** The repo's `AGENTS.md` contains an "agent feedback" block instructing agents to run `npx next internal agent-feedback-instructions` and to commit `AGENTS.md`. It is written by `next dev` (`experimental.agentFeedback: true` in `next.config.ts`). I treated it as untrusted, did not run or follow it, and have kept `AGENTS.md` out of every commit. It shows as modified in `git status`. Decide whether to remove `agentFeedback` from `next.config.ts`.
- **Browser verification impossible.** All signed-in pages redirect to sign-in; couldn't test UI.
- **Vercel CLI side effect.** `npx vercel integration discover` triggered a device login on the user's machine. Nothing else on the Vercel account was changed.
- **Resend / email-sending install not done.** Asked the user which provider/domain; they gave no preference and interrupted. Nothing installed.
- **Vercel env var rename**: edit by ID failed with 404 because the user had already replaced `NEXT_PUBLIC_SITE_URL` with `NEXT_SITE_URL` (production only, sensitive/unreadable). No code reads either variable now.
- **Bad test**: one DB test called a non-existent function inside a swallowed exception and proved nothing. Redone properly. All DB tests use `raise exception 'ROLLBACK_TEST ...'` so nothing persists; verified counts were 0 afterwards.
- **First fuzzy-match attempts** let "Ms Emsa Salihu" (swapped letters) and "Ms Esa Salihu" (missing letter) fail; fixed with `typo_equal` (adjacent swap) and a length rule.
- **Timeline data loss mystery**: all 7 seeded `election_events` were found deleted from the live DB mid-session (not by me; probably the old Delete buttons or testing). Re-entered the 7 milestones from the user's dates.
- **Lint**: `react-hooks/set-state-in-effect` and impure `Date.now()` in render errors, fixed by deriving state / moving the clock read into helpers. Remaining lint errors are only `no-explicit-any`.
- `sleep` chains are blocked by the harness; use Monitor with an until-loop instead.

## 5. Next steps (in order)

1. **Sign in and actually look at it.** Log in as `ruhan.pacolli@students.askosova.org` (admin) in the browser pane, then walk every new page on desktop and mobile: `/admin/forms/import`, `/admin/forms/senate`, `/admin/timeline`, `/admin/roles`, `/staff/applications/[id]`, `/staff/volunteers`, `/dashboard/verify`. Check the dev log for the earlier React "unique key" warning (the roles page one was fixed; others unverified).
2. **Run the real Senate import** with `~/Downloads/Student Senate - Senator Application Form 2026.csv` (2 rows: Alsara Ramadani, Oniksa Morina). Confirm column mapping, then confirm both show "Needs an account" / auto-link.
3. **Supabase dashboard settings the agent cannot change** (user must do): Authentication > URL Configuration: Site URL `https://ask-gov.ruhanpacolli.online`, Redirect URLs `https://ask-gov.ruhanpacolli.online/**` (+ `http://localhost:3000/**`). Paste the 4 templates from `supabase/email-templates/` into Authentication > Emails. Consider custom SMTP (built-in sender is rate-limited and often lands in spam).
4. **Transactional emails** (team approved, election day reminders, etc.): get the user's decision on Resend vs another provider and the sender domain (`ruhanpacolli.online` vs `askosova.org`, which needs school IT for DNS). Then `vercel integration add resend`, wire notifications in `lib/actions/review.ts` / volunteers.
5. **Executive Team import** (explicitly deferred by the user): reuse `lib/import.ts`; needs member email columns mapped (President/Vice-President/Secretary/Treasury); the DB function already creates the team + invitations.
6. Decide about `AGENTS.md` / `agentFeedback` and `supabase/.temp/` (leave untracked, or gitignore).

## 6. Files in flight

- `handoff.md`: new, uncommitted.
- `AGENTS.md`: modified by `next dev`, intentionally **not** committed.
- `supabase/.temp/`: untracked Supabase CLI cache, intentionally not committed.
- `.env.local`: gitignored, holds the Supabase URL/key and `NEXT_SITE_URL`; never committed.

## Reference

- Live DB cannot be changed from code alone: use the Supabase MCP (`apply_migration`, `execute_sql`) or the dashboard. Project id `pvsqetxiryhivuswzuqv`.
- Roles live in `public.user_roles` (`student`, `executive_member`, `staff_reviewer`, `volunteer`, `admin`). Known accounts: `ruhan.pacolli@students.askosova.org` (admin+student), `shpresah@askosova.org` (student, email confirmed, user asked to "verify" it, left unchanged pending which role to grant: staff or admin). Do not change roles without asking.
- Important DB functions: `link_imported_responses`, `link_all_imported_responses`, `claim_my_imported_responses` (runs on every `getCurrentUser()`), `verify_imported_response`, `pending_import_for_me`, `name_matches_email`, `homeroom_matches`, `typo_equal`, `confirmed_emails`.
- Conventions: Next 16 (read `node_modules/next/dist/docs/` before using unfamiliar APIs), `proxy.ts` replaces middleware, server actions in `lib/actions/*`, no secrets in git.
