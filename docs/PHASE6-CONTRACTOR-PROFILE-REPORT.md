# Phase 6 — Contractor Profile: Execution Report

Implements GitHub Issue #3 ("Phase 6: Contractor Profile"). Scope was the
public contractor profile page at `/contractors/[slug]` only — no
Phase 7-15 functionality (payments, chat, AI matching, marketplace, quote
system) was touched, and no schema/migration change was needed.

## Implementation summary

- **Profile route** (`app/contractors/[slug]/page.tsx`) — rewritten from
  Phase 5's placeholder into the real profile page. Server Component,
  fetches the contractor by slug, 404s via `notFound()` if it doesn't
  exist or isn't `status = 'approved'` (the two cases are never
  distinguished in the response, to avoid leaking the existence of
  pending/rejected/suspended contractors — see Security below).
- **Sections**, all built only from real schema fields, nothing
  fabricated:
  - Identity header: avatar placeholder, business name (`h1`), verified
    badge (`verification_status`), location (province/district),
    category chips, rating average + review count (or an honest "ยังไม่มีรีวิว"
    empty state when `review_count = 0`), years of experience.
  - Description (conditional — omitted entirely if `description` is
    null).
  - Contact CTAs: phone (`tel:`), LINE (`https://line.me/ti/p/~{line_id}`),
    Facebook, website — each rendered only if the corresponding column is
    non-null, with an honest empty state ("ยังไม่มีข้อมูลติดต่อสาธารณะ...")
    when none exist. Address text shown if present.
  - Portfolio gallery: grid of `thumbnail_url` images from
    `portfolio_images`, or an empty state if none.
  - Reviews: star rating + comment + Thai-locale date per row (newest
    first, capped at 20), or an empty state if none.
  - "← กลับไปหน้าค้นหา" link back to `/search`.
- **SEO**: `generateMetadata()` builds title/description from the real
  fetched profile (falls back to `{business_name} — {categories} —
  {location}` when `description` is null). No metadata is emitted for
  non-existent/non-public contractors beyond the standard 404 page.
- **Route conventions**: `not-found.tsx` (shared, non-distinguishing
  message) and `error.tsx` (generic error boundary with reset). No
  `loading.tsx` — see Limitations below for why it was removed.
- **Contact-click tracking**: `src/components/ContactLink.tsx`, a small
  client component wrapping an `<a>` tag, fires
  `recordContactEvent(contractorId, eventType)` in `onClick` for phone /
  LINE / Facebook links. `website` clicks are intentionally NOT tracked —
  see Contact tracking status below. A `profile_view` event is recorded
  server-side (fire-and-forget) on every successful page render.

## Files changed

New:
- `app/contractors/[slug]/error.tsx`
- `app/contractors/[slug]/not-found.tsx`
- `src/components/ContactLink.tsx`
- `src/lib/data/contactEvents.ts`
- `src/lib/data/portfolio.ts`
- `src/lib/data/reviews.ts`

Modified:
- `app/contractors/[slug]/page.tsx` — real implementation replacing
  Phase 5's placeholder.
- `src/lib/data/contractors.ts` — added `ContractorProfile` type and
  `getContractorProfile(slug)`; removed the now-unused
  `getContractorNameBySlug` from Phase 5.
- `src/lib/env.ts` — fixed the `NEXT_PUBLIC_` static-inlining bug (see
  Limitations/bugs below).
- `.env.example`, `docs/AUTHENTICATION.md`,
  `src/lib/data/categories.ts` — renamed `SUPABASE_URL`/`SUPABASE_ANON_KEY`
  to `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` to match
  the env.ts fix, plus documentation of why.
- `supabase/local-dev/postgrest-shim.mjs` — local-dev-only PostgREST
  emulation: widened the contractors SELECT with the new profile
  columns, generalized the generic-table GET handler to support
  `portfolio_images`/`reviews` with filter/order whitelists, added a
  `POST /rest/v1/contact_events` handler, and added CORS support (this
  was the first genuinely cross-origin browser fetch in the project).

Deliberately unchanged: `scripts/seed-districts.mjs` and
`supabase/local-dev/README.md` — both correctly use plain
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` because they run standalone
via `node`, outside the Next.js bundler that the `NEXT_PUBLIC_` fix is
about.

## Data / schema used

No migrations were added or modified. All fields read already existed in
the schema from Phase 2:
- `contractors`: `business_name, slug, description, phone, line_id,
  facebook_url, website_url, address, years_experience,
  profile_image_url, rating_avg, review_count, verification_status,
  status` + FK joins to `provinces`, `districts`, and `categories` (via
  `contractor_categories`).
- `portfolio_images`: `id, project_name, project_type, description,
  image_url, thumbnail_url`, ordered by `sort_order`.
  `original_url` is deliberately never selected — the migration's own
  comment says it's never served directly.
- `reviews`: `id, rating, comment, created_at`, filtered to
  `status = 'active'`, ordered `created_at desc`, capped at 20 rows.
  `reviewer_id` is deliberately not joined to `profiles` — there's no
  public-read RLS policy for other users' profiles, and no product need
  to expose reviewer identity on this page.
- `contact_events`: inserted (not read) — `contractor_id, event_type`.

All queries use explicit column lists; no `select('*')` anywhere added
this phase.

## Contact tracking status

`phone`, `line`, and `facebook` clicks call `recordContactEvent`, which
inserts a best-effort row into `contact_events` (insert failures are
caught and logged, never thrown, never block navigation).

**Limitation, disclosed rather than silently absorbed**: `website` link
clicks are NOT tracked. The `contact_events.event_type` column has a
CHECK constraint allowing only `phone | line | facebook | profile_view` —
there is no `website` value. Adding one would require a migration, which
Issue #3 explicitly says to avoid ("if a schema/migration change is
required, STOP and report the blocker instead of silently changing the
database"). The website link itself is still shown and fully functional;
only its click isn't counted. This is reported as a blocker/limitation,
not fixed by widening the schema.

## Security checks

- RLS remains the only enforced boundary; no policies or migrations were
  touched.
- Pending/rejected/suspended contractors are never exposed: verified via
  the search page (Phase 5, which already filters to `approved`) and,
  directly for this phase, by hitting `/contractors/<slug-of-a-pending-contractor>`
  and confirming `HTTP 404` (see Tests below) — same 404 as a
  non-existent slug, so existence isn't leaked either.
  `getContractorProfile` never distinguishes "row doesn't exist" from
  "row exists but isn't approved" — both return `null`.
  `getPortfolioImages`/`getReviews` are looked up by the already-verified
  approved contractor's ID, so they can't be used to probe non-public
  contractors independently.
- `service_role` is never touched in client code; `ContactLink` and
  every new `src/lib/data/*.ts` module use only the anon-key client
  (`getSupabaseClient()`), same as prior phases.
- Client-provided authorization/status is never trusted — visibility is
  decided entirely by the `status = 'approved'` filter applied
  server-side inside `getContractorProfile`, not by anything the client
  sends.
- Explicit column selection throughout; no `select('*')` was introduced.
- No contact data, ratings, or reviews were invented — every value
  rendered comes from a real column, and every section has an honest
  empty state when the underlying data is null/empty rather than a
  placeholder value.

## Responsive / accessibility behavior

Verified via Playwright screenshots at desktop (1280px) and mobile
(375px) viewports across multiple real contractor profiles (with/without
portfolio, with/without reviews). Layout reflows correctly: identity
header stacks on mobile, contact CTA buttons remain full-width and
tappable, portfolio grid drops from multi-column to single/double column,
reviews stack vertically. The yellow brand system introduced in Issue #1
(Phase 4's follow-up) is preserved throughout — CTA buttons, badges, and
accent colors match the existing design language rather than introducing
a new palette.

## Tests executed and results

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run test:unit` — 35/35 pass.
- `npm run build` — succeeds (confirmed genuine exit code 0, both with
  and without Supabase env vars configured; see the "Exit code 1"
  false-alarm note below).
- `node supabase/local-dev/run-security-tests.mjs` — 54/54 pass. (One
  fixture collision was found and fixed during this phase's DB-fixture
  work — see below — and the full suite was re-run clean afterward.)
- Playwright smoke tests (screenshots + console-error monitoring) across
  6 scenarios:
  1. Electrician contractor — has portfolio, no reviews yet.
  2. "Contractor One Co." — has reviews, no portfolio.
  3. `sukjai-toterm` — has reviews.
  4. `general-bkk` — no portfolio, no reviews (both empty states shown).
  5. A `pending`-status contractor's slug, hit directly — `HTTP 404`.
  6. A nonexistent slug — `HTTP 404`.

  All 6 showed correct HTTP status codes, correct page titles, and zero
  unexpected browser console errors after the bug fixes described below.

## Build result

`npm run build` — succeeds, exit code 0 (verified in isolation with an
explicit `echo "exit code: $?"` after an earlier compound command
appeared to report exit code 1 — that turned out to be a preceding
`pkill` finding no matching process and its own nonzero exit bleeding
into the compound command's reported status, not an actual build
failure; the build itself was never broken).

## Limitations / bugs found and fixed this phase

Two genuine bugs were found during manual browser testing of the new
contact-click tracking feature (not present in any static check or unit
test) and fixed:

1. **`NEXT_PUBLIC_` env var bug (pre-existing since Phase 3, most
   significant finding)** — `src/lib/env.ts`'s `getPublicSupabaseConfig()`
   read `SUPABASE_URL`/`SUPABASE_ANON_KEY` via a dynamic
   `requireEnv(name)` helper (`process.env[name]`). Next.js's build-time
   static analysis only inlines `NEXT_PUBLIC_*` variables into a browser
   bundle when they're accessed as a literal `process.env.NEXT_PUBLIC_X`
   expression; a dynamic lookup is invisible to it and silently resolves
   to `undefined` client-side, regardless of what's actually set in the
   environment. This meant **every client-side Supabase call since Phase
   3 was silently failing in a real browser** — including the header
   auth-state widget (`AuthStatus.tsx`). It went undetected for three
   phases because the auth widget's catch-block fallback ("show logged
   out") is visually indistinguishable from an actually-logged-out user.
   This phase's `ContactLink` onClick handler hit the same failure, but
   this time it surfaced as a visible console error, which is what
   caught it. Fixed by rewriting `getPublicSupabaseConfig()` to use
   literal `process.env.NEXT_PUBLIC_SUPABASE_URL`/
   `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`, and renaming the
   variables throughout `.env.example` and `docs/AUTHENTICATION.md`.
   Verified fixed end-to-end: rebuilt/restarted with the new env var
   names, clicked a real phone contact link, confirmed a `contact_events`
   row was actually inserted and zero console errors occurred.
   **Anyone deploying this app needs to rename their env vars** from
   `SUPABASE_URL`/`SUPABASE_ANON_KEY` to `NEXT_PUBLIC_SUPABASE_URL`/
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` — this is a breaking rename, not
   additive.
2. **`notFound()` returning HTTP 200 instead of 404** — with
   `app/contractors/[slug]/loading.tsx` present (an implicit Suspense
   boundary), curl showed `HTTP 200` for both a nonexistent slug and a
   pending contractor's slug, where `404` was expected. This is a known
   Next.js App Router limitation: once a `loading.tsx` sibling causes the
   initial response to start streaming, the 200 status is already
   committed by the time an async Server Component further down calls
   `notFound()`. Fixed by deleting `loading.tsx` — re-verified via curl
   that both bad-slug cases now correctly return `404` while a real
   approved contractor still returns `200`. Traded away a custom loading
   skeleton for this one route in exchange for correct HTTP status
   codes; this is a deliberate, disclosed choice, not an oversight.

One test-fixture-only issue was also found and fixed (not a product
bug): a manually-inserted review fixture for this phase's local-dev
testing reused a `(contractor_id, reviewer_id)` pair that collided with
`supabase/local-dev/run-security-tests.mjs`'s own dynamic test inserts,
tripping the `reviews` table's `UNIQUE (contractor_id, reviewer_id)`
constraint and failing 2 security tests (C5, E6). Fixed by re-pointing
the fixture's `reviewer_id` to a non-colliding user; the full 54-test
suite was re-run clean afterward. This was purely local-dev fixture
data, not a migration or RLS policy change.

No other blockers.

## Commit

<!-- SHA filled in after commit below -->

## Verdict

**READY FOR REVIEW.**

Per Issue #3: **STOP after Phase 6. Do not start Phase 7 without explicit
approval.**
