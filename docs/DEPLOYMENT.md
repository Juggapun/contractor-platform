# Beta/Staging Deployment Guide

Written for Issue #12 ("Beta Staging Deployment — Owner Testing URL"). This
document exists because **the actual deployment could not be completed by
this session** — see the blocker explanation at the bottom — and Issue
#12 itself asks for exactly this outcome when that happens: "clearly
documenting the blocking prerequisite" plus "any repository changes
required for the staging deployment configuration." This is that
documentation; no secret values appear anywhere in it, and none should
ever be pasted into it or committed alongside it.

## Why no code changes were needed

This app was already written to be deployment-ready from early phases:
config is read entirely from environment variables (`src/lib/env.ts`),
never hardcoded; there's no framework-specific config this project needs
beyond what Next.js auto-detects on any standard host. The blocker here
is entirely about **credentials/accounts only the owner can create**, not
missing code.

## What the owner needs to do (in order)

### 1. Create a real Supabase project

This project has never had a real hosted Supabase project — every phase
so far ran against a local Postgres emulation
(`supabase/local-dev/README.md`) specifically because no such project
existed. Issue #12 requires connecting to "the intended Supabase
environment," so this step has to happen first, by the owner, at
[supabase.com](https://supabase.com) (new project, any region close to
your users, note the database password somewhere safe — Supabase
generates and shows it once).

Recommend a **separate project from any future production one** (this is
explicitly a Beta/Staging deployment per Issue #12, not production) so
production data is never at risk from beta testing.

### 2. Run the migrations against it

From the Supabase dashboard's SQL Editor, or via the Supabase CLI
(`supabase link --project-ref <ref>` then `supabase db push`), run every
file in `supabase/migrations/` **in numeric order**, 0001 through 0017.
These are the same migrations already reviewed and tested throughout
every prior phase — nothing new to write here.

**Do NOT run `supabase/seed.sql` or `scripts/seed-districts.mjs` against
this project as real seed data for a browser-accessible environment** —
`seed.sql` creates test accounts (`admin1@test.local`,
`customer1@test.local`, etc.) with predictable, publicly-known test
passwords, meant only for the local-dev emulation. Running it against a
real, internet-reachable project would leave an admin account with a
guessable password sitting on the open internet. Districts data
(`scripts/seed-districts.mjs`) is real reference data (Thailand's
provinces/districts) and is fine and expected to run once for real.

### 3. Turn OFF "Confirm email" in Supabase Auth settings — important, easy to miss

**A real finding from reviewing this project's own history, not a
guess**: `docs/AUTHENTICATION.md` (Phase 3) already disclosed that no
real GoTrue/Supabase Auth server had ever been tested against, only a
mocked client. Checking the actual signup/login code confirms why this
matters now: `ContractorRegistrationForm`'s success message and
`LoginForm`'s post-signup flow both assume a user can sign in
**immediately** after signing up — there is no "check your email to
confirm" screen anywhere in this codebase. Supabase projects **default
to requiring email confirmation** before a new user can sign in. Left at
that default, every signup during beta testing would appear to silently
fail at login with no explanation, even though the app code is correct.

Fix: in the Supabase dashboard, **Authentication → Providers → Email →
turn off "Confirm email"** before beta testing begins. (Building a real
email-confirmation UI is out of scope for this issue and for Phase 12's
own "do not add features" guard — this is a project *setting*, not code.)

### 4. Create a hosting deployment (recommended: Vercel)

No hosting provider is configured anywhere in this repo (no
`vercel.json`, no CI/CD workflow, nothing under `.github/`) — this is a
genuinely open choice, not a preference this project already committed
to. **Vercel** is recommended because it's the natural fit for a Next.js
App Router project like this one (the framework's own maintainer,
zero-config detection, a free tier that easily covers beta traffic) —
not because anything in this repo requires it specifically. Any Node.js
host that supports Next.js's App Router would work.

At [vercel.com](https://vercel.com): "Add New Project" → import
`Juggapun/contractor-platform` from GitHub → deploy from the
`claude/thai-contractor-db-migration-q7byw6` branch (or `main`, once
this work is merged — the owner's call) → **before the first deploy**,
set the environment variables below.

### 5. Set these environment variables in the hosting provider's dashboard

Names only — get the actual values from the Supabase dashboard's
**Settings → API** page for the project created in step 1. Never paste
real values into this file, into a commit, or into chat.

| Variable | Where to find it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL | Client-safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → Project API keys → `anon`/`public` | Client-safe — RLS is the real boundary, not secrecy of this key |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → Project API keys → `service_role` | **Secret** — bypasses RLS entirely; server-only; never exposed to a browser (`src/lib/supabase/admin.ts` is the only reader) |
| `NEXT_PUBLIC_SITE_URL` | The Beta URL the host assigns after first deploy, e.g. `https://contractor-platform-xyz.vercel.app` | Not secret. Needed for correct canonical/OG URLs and the sitemap (Phase 11) — can be set right after the first deploy once the URL is known |

Full descriptions of each variable (safety, what reads it, why it's
shaped this way) are in `.env.example` at the repo root — this table
just says where to find the real values for a hosted project instead of
the local-dev shim.

### 6. Deploy, then smoke-test

Once deployed, confirm (this is the same checklist
`docs/BETA_CHECKLIST.md`, Phase 12, already documents in full for the
owner's own manual pass):
- Homepage loads, shows real categories/provinces from the new project.
- `/search` returns results (none yet, until a contractor registers and
  is approved — that's expected, not a bug).
- Register a real test contractor account → confirm it does **not**
  appear in search until approved.
- Sign up a customer account, confirm login works (this is exactly what
  step 3 above fixes).
- Approve the contractor from `/admin/contractors` (needs a profiles row
  manually promoted to `role = 'admin'` first — via the Supabase SQL
  editor: `update public.profiles set role = 'admin' where id = '<the
  test admin's auth user id>';`, the same mechanism this project's own
  admin-promotion path already uses, just run once by hand since there's
  no self-serve "become an admin" flow by design).
- Confirm the approved contractor now appears in search and has a public
  profile page.

This session could not run this smoke test itself — see the blocker
explanation below — but everything above is exactly what a full pass
should confirm once the URL exists.

## Blocker: why this session could not complete the deployment itself

Checked directly, not assumed:
- No Supabase account or project is linked anywhere in this environment
  — `supabase/config.toml`'s `project_id` is only the local CLI's
  directory-name label, not a real project reference; the `supabase` CLI
  is installed but returns `Access token not provided` (never logged
  in); no `SUPABASE_ACCESS_TOKEN` or similar is set in this environment.
- No hosting-provider credentials, CLI, or MCP tool (Vercel, Netlify, or
  otherwise) are available to this session — checked for environment
  variables, installed CLIs, and available tools; none found.
- Issue #12 itself explicitly forbids the one workaround this session
  *could* otherwise reach for — item 6 requires confirming the deployed
  app is connected to a real Supabase environment, "not a local/mock
  database," ruling out pointing a real deployment at the local-dev shim.

None of this is something a coding session can provision on its own —
creating a Supabase project and a hosting account are account-creation
actions that need the owner's own identity/billing, by design (the same
reason this project has never had one, disclosed consistently since
Phase 2/3's own reports).

## Minimum action required from the owner

1. Create the Supabase project (step 1).
2. Either grant this session access to run the remaining steps (Supabase
   project credentials + a way to deploy, e.g. a Vercel account this
   session can be connected to), **or** complete steps 2–6 above
   directly and share the resulting Beta URL back for the smoke-test
   pass to be run against it.
