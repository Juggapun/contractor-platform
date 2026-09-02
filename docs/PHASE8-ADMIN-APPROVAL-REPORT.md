# Phase 8 — Contractor Admin Approval Workflow: Execution Report

Implements GitHub Issue #6 ("Phase 8 — Contractor Admin Approval Workflow"),
built to `docs/BRAND_UI_SPEC.md`'s standard (yellow brand system, "functional
and professional" — the spec doesn't call out an admin-specific tone, so this
follows the same restrained, clear register as the contractor profile/
registration pages). Scope was the approval queue and approve/reject
workflow only — no payments/credits, no Facebook Login, no chat/AI
matching/quote systems, and no unrelated redesign of existing pages.

## Implementation summary

- **Admin approval queue** at `/admin/contractors` lists pending contractor
  applications; **detail view** at `/admin/contractors/[id]` shows full
  submitted business info and two actions: approve, or reject with a
  required reason.
- **Every real authorization decision happens server-side**, in Route
  Handlers under `app/api/admin/**` — not in the page, which has no way to
  gate itself (see "No cookie-based session" below). `requireAdmin()`
  (`app/api/admin/_lib/requireAdmin.ts`) is the actual boundary every one of
  those four routes calls first:
  1. Verifies the caller's bearer token against the auth provider itself
     (`auth.getUser(token)`) — proves it's a live session for a real user,
     never trusts a client-asserted identity.
  2. Reads that user's role fresh from `profiles` via the service_role
     client — never from a claim inside the token or anything the request
     says about itself.
  3. Delegates the actual "is this role allowed" decision to
     `src/lib/auth/guards.ts`'s existing `requireAdmin()` (built in Phase 3,
     whose own header comment already said: "server-side route/handler code
     (later phases) can fail fast... before even attempting a query" — this
     is that later phase, reused rather than reimplemented).
- **Approve/reject** (`app/api/admin/_lib/decideContractor.ts`) only ever
  transitions `pending → approved` or `pending → rejected`, via an atomic
  conditional `UPDATE ... WHERE id = X AND status = 'pending'` — see
  Concurrency below. On success it also writes one `admin_actions` row
  (`action`, `target_type: 'contractor'`, `target_id`, and — for
  rejections — the reason in `notes`).
- **No schema change.** `admin_actions.notes` (from
  `0010_admin_actions.sql`, Phase 2) already exists for exactly this
  purpose — a rejection reason is stored there, not in a new column on
  `contractors`.
- **No new auth architecture.** Role checks reuse Phase 3's
  `guards.ts`/`getCurrentUser()`-shaped `CurrentUser`; account creation and
  promotion (Phase 7's registration flow) are untouched.

## Why this needed real login for the first time

Phase 7 deliberately never signed a user in after registration (see its
report). Phase 8 can't avoid it: an admin has to actually be authenticated
to reach the queue, and this codebase has **no cookie-based server session**
(no `@supabase/ssr`, confirmed absent from `package.json` — see Phase 7's
report for the same finding). That means:
- The admin UI pages (`app/admin/**`) are plain Client Components with no
  server-fetchable data — they read the browser's current Supabase session
  (`src/lib/auth/adminSession.ts`) and send its access token as a bearer
  header on every call to `app/api/admin/**`. This is convenience/UX only;
  it never renders admin data on the strength of that check alone.
- The Route Handlers verify that bearer token themselves
  (`requireAdmin()`), the same pattern Phase 7 already established for
  `signUp()` (a fresh, non-persisting client per request — extracted into a
  shared `app/api/_lib/authClients.ts` this phase, used by both the
  registration route and every admin route, replacing Phase 7's
  route-local copy).
- Getting here required building real `/auth/v1/token` (sign-in) and
  `/auth/v1/user` (session verification) into the local-dev shim for the
  first time — both explicitly deferred as out-of-scope in Phase 7's
  report ("nothing signed the new account back in"). See "Local-dev shim
  extensions" below for what that took and what it deliberately still
  doesn't cover.

## Files changed

New:
- `app/api/admin/_lib/requireAdmin.ts`, `decideContractor.ts`,
  `mapContractorRow.ts` — the authorization boundary, the approve/reject
  logic, and the shared row-mapping helper.
- `app/api/admin/contractors/route.ts` (GET, list by status),
  `app/api/admin/contractors/[id]/route.ts` (GET, detail),
  `.../approve/route.ts`, `.../reject/route.ts` (POST).
- `app/api/_lib/authClients.ts` — shared one-off auth client (see above).
- `app/admin/contractors/page.tsx`, `app/admin/contractors/[id]/page.tsx`
  — thin Server Component shells (metadata + `force-dynamic`).
- `src/components/AdminContractorQueue.tsx`,
  `src/components/AdminContractorDetail.tsx` — the actual client UI.
- `src/lib/auth/adminSession.ts`, `src/lib/data/adminContractors.ts` —
  client-safe session/fetch helpers for the admin UI.
- `tests/requireAdmin.test.ts`, `tests/decideContractor.test.ts` — 13 new
  unit tests (mocked clients).

Modified:
- `app/api/contractors/register/route.ts` — refactored to use the new
  shared `createOneOffAuthClient()` instead of its own local copy; no
  behavior change.
- `src/components/AuthStatus.tsx` — shows a "จัดการผู้รับเหมา" link when
  `profile.role === 'admin'`, the only way to reach the queue from the UI
  (no other page changed).
- `eslint.config.js` — see "ESLint hardening" below.
- `supabase/local-dev/00_bootstrap.sql`, `supabase/local-dev/postgrest-shim.mjs`
  — local-dev-only auth/data emulation, see below.
- `vitest.config.ts` — added a `@` → `src/` path alias (mirrors
  `tsconfig.json`), needed because this phase's tests are the first to
  import a file under `app/api/**`, which itself imports `src/lib/**` via
  that alias.

## ESLint hardening

While confirming `app/api/**` really is the only place `admin.ts` gets
imported from, I found the existing rule (a `paths` list of exact literal
specifier strings, added Phase 6/7) only ever matched
`../lib/supabase/admin` and `@/lib/supabase/admin` — it would have silently
missed an import like `../supabase/admin` from a file under `src/lib/*/`,
which is exactly the relative depth a file like
`app/api/admin/_lib/requireAdmin.ts` would need if it lived under `src/lib`
instead. Replaced the `paths` list with a `patterns: [{ group:
['**/supabase/admin'] }]` glob, robust to where the importing file actually
lives. Verified the fix catches what the old rule missed: a throwaway test
file at `src/lib/auth/__eslint_test__/leak.ts` importing `../supabase/admin`
is now flagged (`no-restricted-imports` error); it was not flagged before
this change. Also removed a second, now-fully-redundant rule block that
only ever matched `.tsx` files (route handlers are always `.ts`) — one rule
now covers the whole ban plus its `app/api/**` exception.

## Admin authorization model

- **Server-verified identity**: `auth.getUser(token)` against the auth
  provider — not a local decode of the token's claims.
- **Server-verified role**: read fresh from `profiles.role` via
  service_role on every request, never cached, never trusted from the
  client. `profiles.role` is itself protected against self-service change
  by `trg_profiles_lock_role` (Phase 3, `0004_profiles.sql`) — unrelated to
  this phase, but the reason a compromised/malicious client can't just
  grant itself `admin` even if it could reach the profiles table directly.
- **No UI-only gating**: the admin pages' client-side checks
  (signed-out/forbidden states) exist purely for user experience — every
  actual read or write goes through a Route Handler that runs the same two
  checks above regardless of what the page did or didn't show.
- **IDOR/self-approval**: approve/reject take a contractor `id` from the
  URL, but access is gated on the *caller's role*, not on any relationship
  between the caller and that id — an authenticated contractor (even the
  owner of the specific application being approved) gets 403 the same as
  any other non-admin, verified directly (see Security tests below), not
  just asserted.

## Approve / reject behavior

- Only `pending → approved` and `pending → rejected` are supported.
  Deciding on an application in any other state (already approved/
  rejected, or the historically-separate `suspended` status) returns
  `409 Conflict` naming the current status, rather than silently allowing
  it — re-approving a rejected contractor or un-suspending one is a
  different, undescribed workflow, deliberately not built here.
- **Concurrency**: the UPDATE itself carries the safety, not a
  read-then-write race. `UPDATE contractors SET status = $1 WHERE id = $2
  AND status = 'pending'` only ever matches a row still in the expected
  prior state; two simultaneous decisions on the same application can't
  both succeed — verified directly (see below), not just reasoned about.
- **Audit**: every successful decision writes one `admin_actions` row
  (`admin_id`, `action`, `target_type: 'contractor'`, `target_id`, and the
  reason in `notes` for rejections). An audit-write failure does not roll
  back or fail the response — the status change is already correct and
  complete at that point — but is logged loudly server-side.
- **Rejection reason**: required, 3-1000 characters, validated
  server-side (the authoritative check) independent of whatever the form
  did client-side.
- **Queue bound**: the list route caps at 200 rows
  (`.range(0, 199)`) rather than fetching unbounded — consistent with this
  project's established pagination posture elsewhere
  (`src/lib/data/contractors.ts`). If the pending backlog ever legitimately
  exceeds that, this needs real pagination — flagged as a limitation, not
  silently truncated without disclosure.

## Local-dev shim extensions (not production code)

`supabase/local-dev/postgrest-shim.mjs` gained, for this phase:
- `POST /auth/v1/token` (`grant_type=password` and `refresh_token`) and
  `GET /auth/v1/user` — real sign-in and session verification, built on a
  new `password_local_dev_only` column on the shim's `auth.users`
  (`00_bootstrap.sql`; nullable, so every pre-Phase-8 fixture row keeps
  working). Session tokens are an unsigned `local-token.<base64url(JSON)>`
  string — explicitly not a real JWT (documented prominently in the shim's
  header comment) — fine only because this is a throwaway local harness
  where the actual RLS/trigger authorization logic is exercised for real
  either way (see the next point), not because of anything this token
  format itself proves.
- **A correctness fix this phase's own design required, caught before it
  shipped, not after**: real PostgREST sets the `request.jwt.claims` GUC
  from the decoded JWT on every request (role, and `sub`/`email` once
  authenticated); this shim previously only ever did `SET LOCAL ROLE
  <role>` and never set that GUC. It had never mattered before Phase 8
  because `auth.role()`/`auth.uid()` (which read that GUC) were only ever
  consulted by paths this shim hadn't exercised over HTTP yet — every
  prior phase's `service_role` write here was an INSERT, and
  `is_trusted_context()` (used by `lock_contractor_admin_fields`,
  `0012_denormalized_field_triggers.sql`) is only checked on UPDATE.
  Phase 8's approve/reject is the first `service_role` UPDATE against a
  trigger-protected column (`contractors.status`) to go through the HTTP
  layer at all — reasoned through and fixed *before* writing the
  approve/reject routes on top of it, then verified directly (see Security
  tests below) rather than assumed correct.
- `profiles` added to the generic read-only table map (needed by
  `requireAdmin()` and, for the first time via a real session, by
  `getCurrentUser()`/`AuthStatus.tsx`) — RLS-protected identically to
  every other table this shim serves.
- `id`/`status` filters and `status`/`created_at` columns added to the
  existing `handleContractorsSearch()` (reused for the admin list/detail
  reads, not a separate handler), a conditional `PATCH /rest/v1/contractors`
  (id + status guard, mirrors the real route's concurrency guard), and
  `POST /rest/v1/admin_actions`.

**Three more bugs found via real end-to-end testing, not by static
checks — each fixed and re-verified before moving on:**
1. `select=*` (only ever sent by `getCurrentUser()`'s `.select('*')` on
   `profiles`, exercised for the first time now that real sessions exist)
   was being quoted as a column name (`SELECT "*"` — invalid SQL asking
   for a column literally named `*`) by the shim's generic read handler.
   Fixed to leave `*` unquoted.
2. The same generic handler didn't honor `.single()`'s
   `Accept: application/vnd.pgrst.object+json` header (the fix Phase 7
   already made to the bespoke `POST /rest/v1/contractors` handler was
   never applied here) — `getCurrentUser()`'s profile fetch got an array
   back instead of one object, so `profile.role` read as `undefined` and
   the admin nav link never appeared even for a real admin. Caught by a
   real browser login, not a curl test (curl tests of the REST layer
   directly used `.maybeSingle()`-shaped calls elsewhere, which don't
   depend on this header). Fixed the same way as the bespoke handler.
3. The new `POST /rest/v1/admin_actions` handler checked
   `Array.isArray(rows)` before inserting, but `decideContractor()` (like
   every existing single-row insert call site — `contact_events`,
   `contractors`) sends one plain object, not an array — every audit
   insert was silently skipped, returning `201` with nothing written.
   Fixed to normalize a single object into a one-element array first,
   matching the existing `contact_events` handler's pattern (which had it
   right from Phase 6).
4. A real cross-origin browser sign-in (`LoginForm.tsx`, exercised live
   for the first time this phase) preflighted and failed: `auth-js` adds
   an `x-supabase-api-version` header to every request, which wasn't in
   the shim's `Access-Control-Allow-Headers`. Added.

## Security tests (Issue #6's explicit requirements — each verified directly, live, not asserted)

All of the following were run against the real local Postgres + extended
shim via direct HTTP requests (curl) and, for the full flow, real browser
sessions (Playwright) — not unit-tested assumptions:

| # | Test | Result |
|---|---|---|
| 1 | `GET /api/admin/contractors` with no Authorization header | `401`, no data |
| 2 | ...with a garbage/invalid bearer token | `401`, no data |
| 3 | ...with a valid session for a non-admin (`customer1`) | `403`, no data |
| 4 | `POST .../approve` as a valid non-admin session | `403`, DB unchanged |
| 5 | **`POST .../approve` by the contractor who OWNS the application being approved** (self-approval attempt, the exact scenario Issue #6 names) | `403` at the API layer; separately, the same attempt made directly against the DB layer (bypassing the API, straight `PATCH` as that user's real session) came back `200` with the row **returned but its `status` unchanged** — `lock_contractor_admin_fields` silently reverted the write, proving defense-in-depth still holds even if the API check were somehow bypassed |
| 6 | `GET /api/admin/contractors/[id]` (detail) as non-admin | `403` |
| 7 | `POST .../reject` as non-admin | `403` |
| 8 | Same 4 endpoints as a real logged-in **admin** | all succeed, correct data |
| 9 | Reject with a 1-character reason, and with no reason at all | both `400`, admin_actions untouched |
| 10 | Two concurrent `POST .../approve` on the same pending application | exactly one `200`, one `409`; exactly one `admin_actions` row written |
| 11 | Re-approve an already-approved application | `409` naming the current status |
| 12 | Approved contractor visible publicly | profile route `200`, appears in `/search` |
| 13 | Rejected contractor stays hidden | profile route `404`, absent from `/search`, anon REST read of it returns empty |
| 14 | Pending contractor (never decided) stays hidden | same three checks as #13, all pass |

`node supabase/local-dev/run-security-tests.mjs` — **54/54 pass**, zero
regressions (rerun after every shim change above).

## Other tests

- `npm run typecheck` — clean.
- `npm run lint` — clean (including the hardened admin.ts-import rule).
- `npm run test:unit` — **58/58 pass** (45 pre-existing + 13 new:
  `requireAdmin` — no header, invalid token, non-admin role x2, missing
  profile row, valid admin accepted, looks up by the token-derived id and
  nothing else; `decideContractor` — not-found, conflict-on-wrong-state,
  approve writes correct audit row, reject stores the reason in `notes`,
  lost-race reports the real current status, audit-insert failure doesn't
  block a successful decision).
- `npm run build` — succeeds (exit 0) with and without Supabase env vars;
  all four new API routes and both admin pages correctly listed as dynamic
  (ƒ) — `force-dynamic` was added to both admin page shells up front this
  time (a bug Phase 7 found and fixed reactively), since neither has any
  server-fetchable data to statically bake in anyway.
- End-to-end Playwright smoke tests: anonymous visitor sees the sign-in
  prompt (not the queue); logged-in non-admin sees "ไม่มีสิทธิ์เข้าถึงหน้านี้"
  and no admin nav link; logged-in admin sees the nav link, the queue,
  clicks into a detail page, approves it, and the status badge updates
  live to "อนุมัติแล้ว" with the action buttons replaced by a
  can't-change-it-from-here message; mobile viewport (375px) renders
  correctly. Zero unexpected console errors on every real (non-negative-test)
  path — the two logged "Failed to load resource: 403" lines came only from
  the deliberate non-admin-probe test itself.
- Also re-verified Phase 7's registration flow end-to-end after the shared
  `authClients.ts` refactor — unaffected.
- All test fixtures (contractors, `admin_actions` rows, `auth.users` rows,
  and test passwords set on shared seed fixtures) were cleaned up after
  testing; final `contractors`/`auth.users`/`admin_actions` counts match
  the pre-Phase-8 baseline (15 / 18 / 0).

## Limitations / disclosed gaps

1. **No pagination on the admin queue** beyond a 200-row bound — see
   "Approve / reject behavior" above.
2. **No "reverse a decision" workflow** (un-reject, un-approve, or handle
   `suspended`) — Issue #6 describes approve/reject of pending
   applications only; broader lifecycle management is a different,
   undescribed feature.
3. **Sign-in/session emulation remains a local-dev-only, unsigned token**
   — real JWT verification only happens against an actual hosted Supabase
   project, never tested in this environment (same category of gap
   disclosed since Phase 3's `docs/AUTHENTICATION.md`, now covering more
   surface since real sign-in exists for the first time this phase).
4. **No email notification to the applicant** on approval/rejection —
   not mentioned in Issue #6, not built.

No other blockers.

## Commit

<!-- SHA filled in after commit below -->

## Verdict

**READY FOR REVIEW.**

Per Issue #6: **STOP after Phase 8. Do not start Phase 9 or unrelated
work.**
