# Phase 7 — Contractor Registration: Execution Report

Implements GitHub Issue #4 ("Phase 7 — Contractor Registration"), built to
the UI/tone standard in `docs/BRAND_UI_SPEC.md` (Chiphi Engineering brand
spec, added to the repo before this phase started). Scope was registration
+ the pending workflow only — no contractor dashboard, no admin approval
UI, no portfolio/reviews, no schema redesign.

## Implementation summary

- **One combined registration form** at `/contractors/register`
  (`app/contractors/register/page.tsx` + `src/components/
  ContractorRegistrationForm.tsx`) collects account fields (full name,
  email, password) and business fields (business name, description,
  province, district, categories, phone, LINE ID, Facebook URL, website,
  address, years of experience) in one submission. Province and category
  lists come from real `public.provinces`/`public.categories` rows
  (server-fetched, passed as props — no hard-coded lists); districts
  cascade client-side from the chosen province via a new
  `getDistrictsByProvince()` call.
- **Server-only Route Handler** (`app/api/contractors/register/route.ts`)
  does the actual work:
  1. Re-runs the same field validation the client already ran (never
     trusts the client-side pass).
  2. Cross-checks `provinceId`/`districtId`/`categoryIds` against real
     rows (province exists; district exists AND belongs to that
     province; every category id exists).
  3. Calls `signUpContractor()` (Phase 3, unmodified) to create the auth
     account and promote its role to `contractor` via
     `promoteNewAccountToContractor()` — the exact same service_role-only
     path Phase 3 built, not a new one.
  4. Generates a unique slug from the business name (Thai slug
     convention — see below), inserts the `contractors` row via the
     admin client, then the `contractor_categories` links.
  5. Returns a generic pending-approval confirmation.
- **No new auth architecture.** Every account/role operation goes through
  the exact Phase 3 functions (`signUpCustomer`/`signUpContractor`/
  `promoteNewAccountToContractor`) unchanged.
- **Existing CTAs updated** (`ContractorCta.tsx`, `Footer.tsx`) from the
  placeholder `/signup?role=contractor` to the real
  `/contractors/register`. `SignupForm.tsx`'s `?role=contractor` banner
  (for anyone who still lands there via an old link) now points at the
  real page instead of a "coming soon" message.

## Why a single combined form, not "sign up, then register"

The codebase has no server-side session mechanism at all (no
`@supabase/ssr`, no cookies — confirmed by inspecting `package.json` and
every existing auth call site): sessions live only in the browser's
localStorage via the plain `supabase-js` client. A "log in first, then
fill out a business form while authenticated" design would need the
Route Handler to verify who's calling it, which — with no cookies — means
trusting a client-submitted access token and round-tripping it through
`auth.getUser(token)` to confirm it's real. A single combined form avoids
that whole class of problem: the server itself creates the account via
`signUpContractor()` and gets a trustworthy `user.id` directly back from
that call — never from anything the client asserts. This is both simpler
and a smaller trust surface, so it's what got built.

## Files changed

New:
- `app/api/contractors/register/route.ts` — the Route Handler above.
- `app/contractors/register/page.tsx` — page shell, fetches
  provinces/categories, `export const dynamic = 'force-dynamic'` (see
  Limitations — a real bug this phase found and fixed before it shipped).
- `src/components/ContractorRegistrationForm.tsx` — the form.
- `src/lib/data/districts.ts` — `getDistrictsByProvince(provinceId)`,
  anon-key client, same posture as `getProvinces()`/`getCategories()`.
- `src/lib/validation/contractorRegistration.ts` — pure field validation,
  shared verbatim between the client form and the server route (the
  server is the actual security boundary; the client copy is only UX).
- `tests/contractorRegistrationValidation.test.ts` — 10 unit tests for
  the validation module.

Modified:
- `eslint.config.js` — see "ESLint fix" below.
- `src/components/ContractorCta.tsx`, `src/components/Footer.tsx` — CTA
  href updated to `/contractors/register`.
- `src/components/SignupForm.tsx` — contractor-intent banner now links
  to the real page.
- `supabase/local-dev/postgrest-shim.mjs` — local-dev-only PostgREST/
  GoTrue emulation, see below.

## ESLint fix (a real, pre-existing gap this phase exposed)

`eslint.config.js` already had a rule intending to let `app/api/**`
Route Handlers import `src/lib/supabase/admin.ts` (the service_role
client) — its own comment said so — but the exception was attached to a
rule matching only `app/**/*.tsx`, while Route Handlers are `.ts` files.
The rule that actually applied to `.ts` files (the base rule, matching
`app/**/*.{ts,tsx}` with no exception) still unconditionally blocked the
import. This had never been caught because Phase 7 is the first phase to
add a Route Handler at all. Fixed by adding an
`app/api/**/*.ts` override that turns the restriction off for exactly
that directory — restoring what the existing comment already claimed was
true. `npm run lint` is clean with the fix; reverting it locally
reproduces the lint error, confirming the fix is what makes
`route.ts`'s `admin.ts` import legal.

## Schema / data used

No migration was added or changed. Every column written already existed
from Phase 2 (`supabase/migrations/0005_contractors.sql`): `user_id,
business_name, slug, description, phone, line_id, facebook_url,
website_url, province_id, district_id, address, years_experience`. The
route never sets `status`, `verification_status`, `plan_tier`,
`featured_until`, `rating_avg`, `review_count`, or
`profile_completeness` — the column defaults (`status = 'pending'`,
`verification_status = 'unverified'`) are what actually apply, so this
code cannot make a contractor public on its own even if every validation
check were somehow bypassed.

**Slug convention**: per the founder decision already recorded in
`supabase/seed.sql` ("Slug language: Thai... slugs use the Thai name
directly rather than an English transliteration"), the slug is the
business name with whitespace collapsed to `-`, no transliteration.
Collisions are resolved by appending `-2`, `-3`, ... until a free slug is
found (verified in testing — see below).

## Auth flow

1. Client-side `validateContractorRegistration()` runs first for instant
   feedback; a client-side failure never reaches the network.
2. Server-side: the same validator runs again (authoritative), then
   `provinceId`/`districtId`/`categoryIds` are checked against real rows
   via `getProvinces()`/`getDistrictsByProvince()`/`getCategories()`.
3. `signUpContractor({email, password, fullName}, promote, freshClient)`
   — `freshClient` is a **new, non-cached** Supabase client created per
   request (`persistSession: false`), not the shared `getSupabaseClient()`
   singleton. Reusing that module-level singleton for a server-side
   `auth.signUp()` call would let one request's in-memory session
   state leak into a concurrent, unrelated request from a different
   visitor — the singleton has no `window`/localStorage on the server to
   isolate it. This is a real concurrency hazard that only exists because
   this is the first Route Handler to call `auth.signUp()`; every prior
   phase's use of `getSupabaseClient()` on the server was read-only.
4. `promoteNewAccountToContractor(userId, adminClient)` — Phase 3's
   function, unmodified, using the `userId` the signUp call itself just
   returned (never a client-supplied value).
5. The `contractors` + `contractor_categories` rows are inserted with the
   admin (service_role) client, using that same server-derived `userId`.

**Auth errors are deliberately generic.** A failed `signUpContractor()`
call (bad credentials, or — per real Supabase's default behavior — an
email that's already registered) always surfaces as the same Thai
message ("ไม่สามารถสมัครสมาชิกได้ กรุณาตรวจสอบข้อมูลหรือลองใหม่อีกครั้ง"),
never the auth provider's specific error text, per Issue #4's
"avoid leaking whether another account/email already exists" requirement.
The real error is still logged server-side for debugging.

## Pending/approval behavior

- New registrations are never publicly visible: `status` defaults to
  `'pending'` at the database level and is never set by this code path
  (see Schema section above).
- The success screen states plainly, in Thai, that the submission is
  pending admin review and will not appear in search or on a public
  profile until approved (per `BRAND_UI_SPEC.md`'s "Contractor
  registration: ... requirements and approval status must be
  unambiguous. Explain that contractor information is reviewed before
  becoming public").
- Verified directly (not just asserted) — see Tests below: a pending
  contractor is invisible via the anon-key REST read, its profile route
  404s, and it's absent from search results.

## Security checks

- RLS is untouched; no policy or migration changed.
- `service_role` is used only inside `app/api/contractors/register/
  route.ts` — the one place the eslint config (fixed this phase) allows
  it within `app/`. Never touched in `ContractorRegistrationForm.tsx` or
  any other client-facing code.
- Client-provided `status`/`verification_status`/role values are never
  accepted anywhere in this flow — role comes from
  `promoteNewAccountToContractor`'s fixed `'contractor'` literal, and
  contractor status comes from the column default, not request input.
- `provinceId`/`districtId`/`categoryIds` are re-validated server-side
  against real rows, not trusted from the client.
- Anti-enumeration: auth failures return one generic message regardless
  of cause (see Auth flow above).
- Explicit column lists throughout; no `select('*')` introduced.

## Responsive / accessibility behavior

Screenshotted at 1280px and 375px viewports. The form stacks into a
single column on mobile, all inputs remain full-width and tappable, the
category checkbox grid drops to two columns, and the submit button stays
full-width in the brand-400/500 yellow. Every field has an associated
`<label htmlFor>`, validation errors render as `role="alert"` text tied
visually to their field, and the success state is `role="status"`.

## Tests executed and results

- `npm run typecheck` — clean.
- `npm run lint` — clean (confirms the eslint fix above is load-bearing:
  reverting it reproduces a lint failure on `route.ts`'s admin.ts
  import).
- `npm run test:unit` — **45/45 pass** (35 pre-existing + 10 new for
  `validateContractorRegistration`, covering: full-valid accepted,
  minimal-required-only accepted, missing/malformed email, short
  password, missing/too-long business name, missing province, missing/
  too-many categories, malformed vs. well-formed Thai phone, facebook/
  website URLs without `http(s)://` rejected, out-of-range/non-integer
  years of experience).
- `node supabase/local-dev/run-security-tests.mjs` — **54/54 pass**, zero
  regressions.
- `npm run build` — succeeds (exit 0) both with and without Supabase env
  vars configured; `/api/contractors/register` and `/contractors/
  register` both correctly listed as dynamic (ƒ) routes in the build
  output.
- **Registration smoke tests** (Playwright, against the real local
  Postgres + extended shim, not mocked):
  1. Valid end-to-end registration through the actual browser form
     (fill every field, cascading province→district select, category
     checkboxes) → 201, pending-approval success screen shown, verified
     in the database: `status='pending'`, `verification_status=
     'unverified'`, `profiles.role='contractor'`, category link present.
  2. Empty-form submit → client-side field errors shown, **no network
     request made** (verified no `/api/` call fired).
  3. Server-side validation, bypassing the client entirely (raw `fetch`
     with malformed data) → 400 with per-field errors — proves the
     server, not just the form, is the actual gate.
  4. Duplicate email → first submission 201, second 400 with the generic
     message (not "already registered" verbatim) — anti-enumeration
     behavior verified, not just asserted.
  5. Slug collision → registering two contractors with the same business
     name yields `.../ช่างทดสอบระบบ-Playwright` then
     `.../ช่างทดสอบระบบ-Playwright-2` — verified in the database.
  6. Unauthenticated access: the page and its API route require no
     session to reach (by design — see "Why a single combined form"
     above); confirmed the page renders and the API accepts a request
     with no `Authorization` header from the browser beyond the anon
     key.
  7. Pending contractor NOT publicly visible — verified three
     independent ways: anon-key REST read of `/rest/v1/contractors?
     slug=eq....` returns empty, `GET /contractors/<slug>` returns
     `HTTP 404`, and it does not appear in `/search` results for its own
     business name.
  8. Mobile viewport (375px) — screenshotted, correct single-column
     layout.
  9. Golden-path console check — zero unexpected console errors or page
     errors during a real registration (the two deliberately-triggered
     400 responses in tests 3-4 do log a benign "Failed to load
     resource: 400" network line in the browser console, which is
     expected for an intentionally-invalid request, not an application
     error).
- All test fixtures created during smoke testing were deleted afterward;
  final `contractors`/`auth.users` row counts match the pre-Phase-7
  baseline (15 / 18).

## Local-dev shim extensions (not production code)

`supabase/local-dev/postgrest-shim.mjs` gained, for this phase only:
- `POST /auth/v1/signup` — just enough of GoTrue's real wire contract
  for `client.auth.signUp()` to work against real Postgres. Deliberately
  does **not** emulate password storage/verification, email
  confirmation, or session/JWT issuance — this phase's flow doesn't need
  a sign-in step, so those stayed out of scope (see Limitations).
- `PATCH /rest/v1/profiles` (role column only, service_role) — backs
  `promoteNewAccountToContractor`.
- `POST /rest/v1/contractors` (service_role, RETURNING the row) and
  `POST /rest/v1/contractor_categories` (service_role, bulk insert) —
  back the registration insert.
- `districts` added to the generic read-only table map, filterable by
  `province_id` — backs the client-side cascading select.

**A real bug found and fixed while wiring this up**: the first version
of the `POST /rest/v1/contractors` handler always returned a JSON array,
but `.insert(...).select(...).single()` (used by the route to get the
new row's id back) sets `Accept: application/vnd.pgrst.object+json` and
expects a single unwrapped object — real PostgREST's content negotiation
for that header. Because the shim ignored that header, `.single()`'s
`data` came back as `[{...}]` instead of `{...}`, so
`contractorRow.id` was `undefined`, and the following
`contractor_categories` insert failed with `null value in column
"contractor_id" violates not-null constraint`. Caught by the Playwright
smoke test (not by typecheck/lint/unit tests — this is exactly the class
of bug static checks can't see), root-caused by reading `postgrest-js`'s
actual `.single()`/`.maybeSingle()` source rather than guessing, and
fixed by having the shim honor that Accept header. Re-verified end to
end afterward.

## Limitations / disclosed gaps

1. **No rollback on partial failure.** If `signUpContractor()` +
   `promoteNewAccountToContractor()` succeed but the `contractors` insert
   (or the `contractor_categories` insert right after it) fails, there is
   no `admin.deleteUser()` call to undo the account creation — this local
   shim doesn't implement GoTrue's admin user-delete endpoint, and adding
   it was judged out of proportion to Phase 7's scope. The user is shown
   an honest message telling them the account was created but the
   business profile wasn't, and to retry or contact an admin. A real
   hosted Supabase project's `service_role` admin API does support
   `admin.deleteUser()`; wiring that rollback in is a reasonable
   follow-up but wasn't built here.
2. **Sign-in and email confirmation remain untested against a real
   auth server** — an unchanged gap from Phase 3
   (`docs/AUTHENTICATION.md`), not something Phase 7 introduces. This
   phase's shim additions only cover what `signUpContractor()` itself
   needs (account creation), not `/auth/v1/token` (login) or session
   issuance — deliberately, since this flow never signs the new user in
   automatically (the success screen tells them to log in at `/login`
   once approved).
3. **No "already logged in" detection.** Because there is no server-side
   session mechanism in this codebase (see "Why a single combined form"
   above), the registration page has no way to notice a visitor is
   already authenticated and would just create a second, unrelated
   account if they submitted it again. This is an architectural gap
   inherited from the whole project's current auth design, not something
   introduced or worked around here.
4. **`app/contractors/register/page.tsx` needed `export const dynamic =
   'force-dynamic'`**, added after `next build` first produced a
   *statically prerendered* page with the province/category dropdowns
   baked in from whatever `getProvinces()`/`getCategories()` returned at
   build time (empty, since the shim wasn't running during that build) —
   a real bug that would have shipped a permanently-empty registration
   form. Fixed and verified: the build output now lists this route as
   dynamic (ƒ), and a request against the built app shows real data.
   **Note for the reviewer**: the Home Page (`app/page.tsx`, Phase 4)
   fetches categories the same way and is still statically prerendered
   (`○` in every build output, including this phase's) — the same class
   of staleness risk exists there. That page is out of Phase 7's scope
   to fix and was left untouched, but is flagged here since it was
   noticed while diagnosing this phase's own instance of the issue.

No other blockers.

## Commit

<!-- SHA filled in after commit below -->

## Verdict

**READY FOR REVIEW.**

Per Issue #4: **STOP after Phase 7. Do not start Phase 8 without explicit
approval.**
