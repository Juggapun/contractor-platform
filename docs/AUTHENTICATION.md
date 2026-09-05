# Authentication — ศูนย์รวมผู้รับเหมาไทย (Phase 3)

This document covers the authentication foundation built in Phase 3 on
top of the Phase 2 database (see `docs/PHASE2-EXECUTION-REPORT.md`,
preserved unmodified). Phase 3 is the authentication foundation only —
no UI, no contractor-registration form (that's Phase 7), no unrelated
features.

## Architecture

```
Browser / any future frontend
        │
        │  anon key only
        ▼
src/lib/supabase/client.ts  ──────────────►  Supabase Auth (GoTrue) + PostgREST
        │                                             │
        │  src/lib/auth/authService.ts                │  every query still goes
        │  (signUpCustomer, signIn, signOut,           │  through RLS
        │   getSession, getCurrentUser,                ▼
        │   onAuthStateChange)                  public.profiles / auth.users
        │
        │  src/lib/auth/guards.ts
        │  (requireRole / isAdmin / ownsOrIsAdmin —
        │   defense-in-depth ONLY, see below)

Trusted server process only (never a browser bundle)
        │  service_role key
        ▼
src/lib/supabase/admin.ts  ──►  promoteNewAccountToContractor()
```

- **`src/lib/supabase/client.ts`** — the only Supabase client a browser
  bundle should ever construct. Uses the `anon` key. Session persistence
  (`persistSession`/`autoRefreshToken`) is delegated entirely to
  supabase-js.
- **`src/lib/supabase/admin.ts`** — uses the `service_role` key, which
  **bypasses Row Level Security entirely**. Throws if evaluated where a
  `window` global exists (i.e., a browser). `eslint.config.js` also
  flags any relative import of this file as a lint error, as a second,
  independent guard.
- **`src/lib/auth/authService.ts`** — the actual sign-up/sign-in/sign-out/
  session/current-user functions. Every function takes an *optional*
  `SupabaseClient` parameter (defaulting to the anon client) so it can be
  unit-tested with a mock instead of a real network call.
- **`src/lib/auth/guards.ts`** — `requireRole`/`isAdmin`/`ownsOrIsAdmin`
  helpers for server-side route code (later phases) to fail fast. **Not
  the authorization boundary** — see "Role handling" below.

## User roles

Same three roles as Phase 2's `public.profiles.role` — this phase does
not add, remove, or redefine any role:

| Role | Created via |
|---|---|
| `customer` | Default. Assigned by `handle_new_user()` (0004_profiles.sql) to every new `auth.users` row, regardless of which sign-up function was called. |
| `contractor` | `customer` at signup, then promoted by `signUpContractor()`'s server-side `promote` step (see below). |
| `admin` | Never assignable through this module. Set directly by a database administrator (or a future trusted internal tool built the same way as the contractor promotion path). |

## Sign-up / sign-in flow

- **`signUpCustomer({ email, password, fullName })`** — calls
  `supabase.auth.signUp()`. Supabase Auth creates the `auth.users` row;
  the existing `handle_new_user` trigger creates the matching `profiles`
  row with `role = 'customer'`. No role is ever passed in this call.
- **`signUpContractor({ email, password, fullName }, promote)`** — does
  exactly the above, then calls the caller-supplied `promote(userId)`
  function. **This is account provisioning only** — it does not create a
  `contractors` business-profile row (that needs `business_name`, `slug`,
  and the rest of the fields Phase 7's registration form collects). It
  exists so a `contractor`-role account is ready for Phase 7 to attach
  that row to.
- **`promoteNewAccountToContractor(userId, adminClient)`** — the one and
  only place in this codebase that changes `profiles.role` outside the
  signup trigger. Server-only: requires a `service_role` admin client,
  because `trg_profiles_lock_role` (0004_profiles.sql) forces `role`
  back to its previous value for any non-trusted caller — verified by
  test **G7** below, which attempts the identical `UPDATE` as an
  ordinary authenticated user and confirms it's rejected. Takes only a
  `userId`; a caller must obtain that id from the `signUpCustomer` result
  in the *same request* — never from arbitrary request input — so it
  cannot be used to promote an unrelated existing account.
- **`signIn({ email, password })`** / **`signOut()`** — thin wrappers
  over `signInWithPassword`/`signOut`.
- **`getSession()`** — session persistence/retrieval, backed by
  supabase-js's own storage.
- **`getCurrentUser()`** — resolves the active session's user **and**
  their `profiles` row in one call; returns `null` for no session
  (never throws for "not logged in"). The profile fetch is a plain
  `select * from profiles where id = <uid>`, which only ever returns the
  caller's own row because of RLS's `profiles_select_own` policy — not
  because of anything this function does. Verified by test **G1**/**G2**.
- **`onAuthStateChange(callback)`** — thin wrapper over supabase-js's
  auth-state-change subscription.

## Role handling — never trust a client-provided role

- No function in `authService.ts` accepts a `role` parameter from a
  caller. `signUpCustomer`'s payload to `supabase.auth.signUp()` never
  includes `role` (verified by a unit test that inspects the exact call
  argument).
- The **only** role change this codebase performs is
  `promoteNewAccountToContractor`, which hardcodes the literal string
  `'contractor'` — it is architecturally incapable of setting any other
  role, including `admin`.
- Even if application code had a bug and tried to let a normal user set
  their own role, the database would still reject it:
  `trg_profiles_lock_role` (0004_profiles.sql) silently forces `role`
  back to its previous value unless the caller is `is_admin()` or
  `auth.role() = 'service_role'`. This was true before Phase 3 and
  remains true — Phase 3 added no schema changes, per the instructions.
- `src/lib/auth/guards.ts`'s `requireRole`/`isAdmin`/etc. are
  **UX/fail-fast conveniences for future server route code, not the
  authorization boundary.** Even if every guard call were deleted, RLS
  and the locking triggers still enforce the same rules — this is
  proven by running the guard-bypassing raw SQL directly (see RLS
  verification below), not by trusting the guards themselves.

## Session handling

Session persistence and refresh are handled entirely by supabase-js
(`persistSession: true, autoRefreshToken: true` in
`src/lib/supabase/client.ts`) — this project does not implement its own
token storage, refresh logic, or cookie handling. `detectSessionInUrl` is
enabled only in a browser context (magic-link/OAuth redirect handling),
disabled in Node.

## Facebook OAuth (Issue #41)

Member/customer-only social login, added on top of the architecture
above with **no schema change and no new authorization code path**:

- **`signInWithFacebook(redirectTo)`** (`authService.ts`) — a thin
  wrapper over `supabase.auth.signInWithOAuth({ provider: 'facebook' })`.
  In a browser this immediately navigates away to Supabase's
  `/auth/v1/authorize` endpoint, which redirects to Facebook, which
  redirects back to `redirectTo` (this app's `/auth/callback`) with a
  session (or an error) encoded in the URL.
- **Why no contractor-approval bypass is possible:** Facebook sign-in
  provisions an `auth.users` row through the exact same GoTrue mechanism
  as `signUpCustomer()` — no separate code path exists. The existing
  `handle_new_user` trigger (0004_profiles.sql) is what creates the
  matching `profiles` row, and it hardcodes `role` to the column default
  `'customer'` regardless of which provider created the account or what
  metadata it attached. `promoteAccountToContractor` — the one and only
  place `role` ever changes — is never called anywhere in this flow.
  Verified directly against real Postgres by tests **L1**/**L2** below,
  not just asserted from reading the trigger.
- **`app/auth/callback`** (`AuthCallbackClient.tsx`) — the OAuth landing
  page. `getSupabaseClient()`'s `detectSessionInUrl: true`
  (`src/lib/supabase/client.ts`) does the actual token/error extraction
  from this page's own URL as soon as the Supabase client is constructed
  here; this component just waits for that (via `getSession()` /
  `onAuthStateChange`) and then redirects to the original `?redirect=`
  target (validated through the same `resolveRedirectPath()` open-redirect
  guard `/login` already uses), or shows a Thai error message — mapped
  from Facebook/GoTrue's `error`/`error_description` params — with a link
  back to `/login` if the OAuth exchange failed or was cancelled.
- **Account linking:** none is implemented, deliberately — if a Facebook
  account's email matches an existing `auth.users` row, whatever
  behavior Supabase Auth's own provider-linking settings dictate applies
  (configured entirely in the Supabase Dashboard, not in this
  repository's code); no client-side "merge this into that account"
  logic exists here that could itself become an account-takeover vector.
- **Sign-out** required no changes at all — `authService.signOut()` and
  `AuthStatus.tsx`'s sign-out button already call the provider-agnostic
  `supabase.auth.signOut()`, which ends a Facebook-originated session
  exactly like an email/password one.
- **No secrets in this repository:** the Facebook App ID/Secret are
  configured entirely in the Supabase Dashboard (Authentication →
  Providers → Facebook), never in this app's code or environment
  variables — this app only ever passes the literal string `'facebook'`
  and a same-origin `redirectTo` URL.

**Manual setup required before this works against a real Facebook app**
(cannot be done from this repository/session — no Meta or hosted
Supabase credentials exist here):
1. Create a Facebook App in Meta for Developers, add the "Facebook
   Login" product, and note its App ID/Secret.
2. In the Supabase Dashboard → Authentication → Providers → Facebook:
   enable it and paste that App ID/Secret.
3. In the Facebook App's own Login settings, add Supabase's fixed OAuth
   callback as a **Valid OAuth Redirect URI**:
   `https://<your-project-ref>.supabase.co/auth/v1/callback` (shown on
   that same Supabase provider settings page).
4. Set `NEXT_PUBLIC_SITE_URL` (see `.env.example`) to the real deployed
   origin — `FacebookLoginButton`/`signInWithFacebook` build
   `redirectTo` from this value, so an unset/incorrect value would send
   real users back to `http://localhost:3000` after a real Facebook
   login.
5. No `/auth/callback`-specific Supabase configuration is needed beyond
   the above — it's an ordinary page in this app, not a registered
   redirect URI itself (Supabase's own fixed `/auth/v1/callback` is the
   one Facebook needs to know about).

## RLS verification results

All RLS/trigger verification ran against real Postgres 16 (see "What was
actually tested" below for the one substitution this requires), using
`supabase/local-dev/run-security-tests.mjs` — the same harness built for
Phase 2, extended with a new **section G** specifically for Phase 3's
authentication-flow shapes (current-user retrieval, session-scoped
access, the promotion path). **54/54 pass: the original 46 Phase 2
assertions (44 checklist items) plus 8 new Phase 3 assertions — zero
regressions, zero new failures.**

| # | Scenario | Result |
|---|---|---|
| G1 | Authenticated customer's current-user retrieval returns exactly their own profile row | ✅ PASS |
| G2 | Authenticated customer cannot retrieve a different user's profile row | ✅ PASS |
| G3 | Authenticated customer cannot `SELECT admin_actions` | ✅ PASS |
| G4 | Authenticated customer cannot `SELECT reports` | ✅ PASS |
| G5 | Authenticated customer cannot `SELECT system_settings` directly | ✅ PASS |
| G6 | Authenticated contractor cannot retrieve another contractor's non-approved, non-owned row | ✅ PASS |
| G7 | Self-service role change (the exact `UPDATE` a compromised client might attempt) is rejected for a non-trusted authenticated caller | ✅ PASS |
| G8 | The real `promoteNewAccountToContractor` code path, via `service_role`, succeeds — scoped to one user | ✅ PASS |
| L1 | A new `auth.users` row carrying Facebook-shaped profile metadata still gets `profiles.role='customer'` by default (Issue #41) | ✅ PASS |
| L2 | That Facebook-originated customer cannot self-promote to contractor — the role-lock trigger applies regardless of signup method (Issue #41) | ✅ PASS |

Mapped to the four bullet groups in the Phase 3 request:

- **ANON** — cannot access protected profile data (A5), can access
  approved contractors (A7), cannot modify protected records (A1-A4):
  all already covered by Phase 2's suite, reconfirmed passing unchanged.
- **CUSTOMER** — correct access to own data (G1), cannot access
  contractor/admin protected data (G2-G5): new in Phase 3, all pass.
- **CONTRACTOR** — can access/update only own permitted data (B1, B8),
  cannot modify admin-controlled fields (B3-B5), cannot modify another
  contractor's data (B6, B9, G6): pass.
- **ADMIN** — can perform intended admin operations (C1-C9): pass.
- **SERVICE ROLE** — works only in trusted server-side contexts (D1-D3,
  G8), and a non-trusted context gets the same denial a real client would
  (G7): pass.

## Security verification results

- **Client-side role escalation:** checked by test G7 (rejected at the
  database layer) and by static review — no function anywhere in
  `src/` accepts or forwards a caller-supplied `role`.
- **Unauthorized profile access:** checked by tests G1/G2/A5 — RLS
  restricts every `profiles` read to the caller's own row (or an admin).
- **Session/authentication bypass:** `getCurrentUser()` returns `null`
  for no session rather than throwing or defaulting to any identity;
  unit-tested.
- **Insecure exposure of service_role credentials:** `grep`-verified —
  `getServiceRoleSupabaseConfig`/`service_role` appear only in
  `src/lib/env.ts` and `src/lib/supabase/admin.ts`; nowhere else in
  `src/`. `admin.ts` throws if `window` exists. `eslint.config.js`'s
  `no-restricted-imports` rule additionally flags any import of
  `admin.ts` by relative path as a lint error.
- **Improper authorization checks / incorrect RLS assumptions:** this is
  what the 54-test harness (previous section) exists to catch — every
  assumption this document makes about who can read/write what is
  backed by an executed test against real Postgres, not a description.
- **No `.env` file exists in this repo; no secrets were committed** —
  verified via `git status`/`git diff` review before commit (see final
  report).

## Environment variables

See `.env.example` (committed, placeholder values only) for the full,
commented list. Summary:

| Variable | Safe in a browser bundle? | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `src/lib/supabase/client.ts`, `src/lib/supabase/admin.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** — every table it can touch is RLS-gated | `src/lib/supabase/client.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | **NEVER** — bypasses RLS entirely | `src/lib/supabase/admin.ts` only |
| `LOCAL_DB_AUTHENTICATOR_PASSWORD` | N/A — local-dev harness only | `supabase/local-dev/` scripts only |

`.gitignore` covers `.env`, `.env.local`, `.env.*.local`. Only
`.env.example` (no real values) is committed.

**Correction (Phase 6):** the client-safe variables must use the
`NEXT_PUBLIC_` prefix — Next.js only inlines a variable into a browser
bundle when it's accessed as a literal `process.env.NEXT_PUBLIC_...`
expression at build time; a non-prefixed name (what this doc originally
said, and what `src/lib/env.ts` originally read) is simply `undefined`
in client-side code. That's a real bug, not a documentation nit: every
client-side Supabase call from Phase 3 onward — the header auth-state
widget, Phase 6's contact-click tracking — was silently failing in an
actual browser bundle. It went unnoticed through Phase 3-5 because the
auth widget's failure path (falling back to "logged out") looks
identical to a real logged-out state; Phase 6's contact-click tracking
made the same failure visible as a console error, which is what
surfaced it. Fixed in `src/lib/env.ts`/`.env.example`; see
`docs/PHASE6-CONTRACTOR-PROFILE-REPORT.md` for the full account.

## What was actually tested vs. what still requires a real hosted Supabase project

**Actually tested, against real Postgres 16, in this session:**
- Every RLS policy, trigger, and constraint this document relies on (the
  54-test harness above, including the 8 new Phase 3 scenarios).
- `authService.ts`'s own logic — argument shapes, error handling, that
  no role is ever sent on sign-up, that `promoteNewAccountToContractor`
  is the only role-mutating call and is scoped to one id — via 24 unit
  tests against a **mocked** `SupabaseClient` (`tests/authService.test.ts`,
  `tests/guards.test.ts`).
- `tsc --noEmit`, `eslint .`, and a full `tsc` build, all clean (see
  final report for exact commands/output).

**NOT tested — requires a real hosted Supabase project (same gap
disclosed in `docs/PHASE2-EXECUTION-REPORT.md` §7, unchanged by Phase
3):**
- Real `supabase.auth.signUp()`/`signInWithPassword()` against a live
  GoTrue server — this session cannot pull the Supabase Docker images
  (org egress policy blocks the GHCR/Docker Hub blob CDNs; see the Phase
  2 report §0 for the exact diagnostic). No hosted-Supabase project
  credentials exist in this environment either.
- Real JWT issuance/verification and PostgREST's own request-routing
  layer. The 54-test harness proves the *authorization logic* is
  correct for any caller PostgREST would present as
  `anon`/`authenticated`/`service_role` with a given `sub`/`role` claim
  — it does not prove PostgREST/GoTrue themselves behave that way,
  which is Supabase-platform code, not this project's.
- Password reset / email verification / magic-link flows — not built in
  Phase 3 per scope ("authentication foundation only"), and would need
  a real GoTrue instance (with a configured mail provider) to test even
  if built.
- Concurrent-session / multi-device session behavior.
- **Real end-to-end Facebook login (Issue #41):** the actual
  Facebook-consent-screen-to-session round trip requires a configured
  Facebook App and a real hosted Supabase project with that provider
  enabled — neither exists in this sandbox. What WAS verified live: the
  Facebook button correctly triggers supabase-js's real
  `signInWithOAuth()` call, which the browser observably attempts to
  navigate to Supabase's real `/auth/v1/authorize?provider=facebook&...`
  endpoint with the correct `redirect_to`; `/auth/callback`'s own
  error-handling (an `access_denied`/generic OAuth error redirected back
  with `error`/`error_description` params) and its redirect-resolution
  logic (using an already-established session in place of one a real
  OAuth exchange would have just created, since both reach that page via
  the identical `getSession()`/`onAuthStateChange` code path) — see the
  Issue #41 report for the exact Playwright scenarios. **Manual test
  after the Supabase/Meta configuration above is completed is required
  before claiming this feature works for real users.**

**Action required before production launch:** once a real hosted
Supabase project exists, re-run `docs/SECURITY_TEST_PLAN.md` end-to-end
through the actual REST API (real `anon`/`service_role` keys, real
signed-up users) rather than the SQL-level emulation — this was already
flagged in the Phase 2 report and remains the single pre-launch gate.
No hosted-Supabase test result is claimed anywhere in this document or
in the Phase 3 report; every ✅ above names exactly what was executed.
