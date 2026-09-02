# Phase 9 — Contractor Reviews & Ratings: Execution Report

Implements GitHub Issue #7 ("Phase 9 — Contractor Reviews & Ratings"), built
to `docs/BRAND_UI_SPEC.md`'s standard: "review UI should feel friendly and
informal, but review content and rating information must remain clear and
trustworthy" — a plain-language Thai form, star rating, no gimmicks, brand
yellow accents, matching the contractor profile page's existing register.

## Implementation summary

- **Authenticated customers can submit a review** (1–5 star rating +
  written comment) for an **approved** contractor, directly from the
  contractor profile page (`app/contractors/[slug]/page.tsx`).
- **No Route Handler, no service_role.** Unlike Phase 7/8, this needed
  neither: a user reviewing on their own behalf is not a privileged
  operation. `src/lib/data/reviewSubmission.ts` calls the anon-key client
  directly, using the browser's own authenticated session — RLS is the
  full "server/database-side" enforcement Issue #7 asks for, not an
  intermediary API layer. `reviewer_id` is derived fresh from
  `client.auth.getUser()` on every call — never accepted as a parameter,
  so there's no code path that could even be tempted to trust a caller-
  supplied identity.
- **Aggregate rating/count** (`contractors.rating_avg`/`review_count`)
  were already trigger-maintained since Phase 2
  (`0012_denormalized_field_triggers.sql`) — no new calculation code was
  needed, only a real fix to make that trigger actually fire correctly
  for a normal user (see "A privilege bug this phase found" below).
- **Duplicate prevention**: `reviews`'s existing `unique(contractor_id,
  reviewer_id)` constraint (Phase 2) already enforces one review per
  user per contractor — Issue #7's "if the schema does not support a
  strict one-review-per-user rule, document the chosen policy" doesn't
  apply here because the schema already supports it exactly. The UI also
  checks for an existing review first (`getMyReviewForContractor`) and
  shows it instead of the form, but the database constraint is what
  actually prevents a duplicate regardless of what the UI does.
- **Cannot edit/delete another user's review** — trivially true because
  the existing schema (`0013_rls_policies.sql`) never let a non-admin
  edit/delete *any* review, including their own ("MVP simplicity,
  prevents rating manipulation after the fact" — unchanged this phase,
  no edit/delete UI was built).

## Two real gaps found and fixed — both via a new, minimal migration and one further fix, not by inventing new tables

**`supabase/migrations/0014_reviews_hardening.sql`** (RLS policy changes
+ one CHECK constraint, no new tables/columns):
1. `reviews_insert_authenticated` (0013) only ever checked `auth.uid() =
   reviewer_id` — nothing stopped a review against a pending/rejected/
   suspended contractor. Tightened to also require
   `EXISTS (... contractors WHERE id = contractor_id AND status =
   'approved')`, directly implementing Issue #7's "submit a review for
   an approved contractor."
2. `reviews_select_active_or_own` (0013) only ever checked the review's
   own `status`, never the parent contractor's current status — unlike
   `portfolio_images_select`/`contractor_categories_select` (0013), which
   both already require the parent contractor to be approved. A
   contractor suspended *after* accumulating active reviews would keep
   those reviews **publicly queryable via a direct
   `GET /rest/v1/reviews?contractor_id=eq...` call** — unreachable
   through the normal profile page (which 404s first), but a real leak
   via direct API access. Tightened to match the established pattern:
   public visibility now requires the review to be `active` **and** the
   parent contractor to be currently `approved`; the reviewer's own row
   and admin access are unaffected. **Verified directly**, not just
   reasoned about — see Security tests below.
3. Added `reviews_comment_length` CHECK (`<=2000` chars, matching the
   bound already used for `contractors.description`) — a real,
   unspoofable length limit, not just a client-side one.

**`supabase/migrations/0015_fix_review_stats_trigger_privileges.sql`**
(found *while building the submission flow end-to-end*, before shipping
it — see "A privilege bug this phase found" below).

## A privilege bug this phase found (not introduced by this phase, but invisible until now)

`update_contractor_review_stats()` (Phase 2,
`0012_denormalized_field_triggers.sql`) is the trigger that recomputes
`contractors.rating_avg`/`review_count` after any change to `reviews`. It
was defined **without** `security definer`, so its internal
`UPDATE public.contractors SET rating_avg = ..., review_count = ...`
ran with the *calling user's own privileges* — meaning that internal
UPDATE was itself subject to RLS as if the calling user had issued it
directly. `contractors_update_own` (0013) only allows
`user_id = auth.uid() or is_admin()` to update a contractors row.

Every review author is, by definition, **not** the contractor's owner —
you review someone else's business. So for any ordinary customer
submitting a review, this trigger's internal UPDATE matched **zero
rows** under RLS and silently did nothing: no error, just a rating that
quietly stopped reflecting reality the moment a real customer (almost
every real reviewer) posted one.

This was invisible in every prior check: the Phase 2 harness's F1-F3
trigger tests (`supabase/local-dev/run-security-tests.mjs`) all run
`asServiceRole`, which bypasses RLS entirely and never exercised this
path; no review-*submission* flow existed before Phase 9 for anything to
exercise it live. **Caught by a real end-to-end browser test** — log in
as an ordinary customer, submit a review, check the displayed aggregate
actually changed — not by any static check or by the SQL-level harness
as it was originally written (a second, real find this project's rigor
around live testing has now paid for twice: Phase 7 found a `.single()`
content-negotiation bug in the local shim the same way, and this is the
same category, but a real production-schema bug rather than a local-dev
shim bug).

**Fix**: `0015_fix_review_stats_trigger_privileges.sql` re-creates the
function with `security definer set search_path = public` and revokes
direct `EXECUTE` from `public`/`anon`/`authenticated` — the exact same
established pattern already used for `handle_new_user()` and
`is_admin()`/`is_trusted_context()` (0004_profiles.sql) for precisely
this class of problem: a normal user's own action needs to update a row
they don't own, in a narrowly-scoped, trigger-only way. Verified fixed
end-to-end (see Security tests below) — the aggregate now correctly
updates the moment a customer submits a review, and correctly
recalculates on delete too.

I checked every other trigger function in `0012` for the same
vulnerability class and found none: `trg_set_profile_completeness()` and
`lock_contractor_admin_fields()` only modify the row already being
written (governed by the *same* RLS check as the original statement, not
a new cross-table update) — not vulnerable. `touch_contractor_on_portfolio_change()`
does do a separate cross-table UPDATE, but `portfolio_images_owner_write`
(0013) already restricts *who* can fire it to the contractor's own owner
(or admin) — the only callers who can ever trigger it are already
authorized to update that same contractor row, so it was safe by
construction, not by luck.

## Files changed

New:
- `supabase/migrations/0014_reviews_hardening.sql`,
  `0015_fix_review_stats_trigger_privileges.sql` — see above.
- `src/lib/validation/reviewSubmission.ts` — pure rating/comment
  validation (UX only; the CHECK constraints are the real bound).
- `src/lib/data/reviewSubmission.ts` — `submitReview()`,
  `getMyReviewForContractor()`.
- `src/components/ReviewForm.tsx` — the star-rating + comment form,
  with signed-out/already-reviewed/form/success states.
- `tests/reviewSubmissionValidation.test.ts` — 9 new unit tests.

Modified:
- `app/contractors/[slug]/page.tsx` — `<ReviewForm>` added to the
  Reviews section.
- `src/lib/data/reviews.ts` — doc comment updated (submission now
  exists; it was previously flagged "Phase 9/out of scope").
- `supabase/local-dev/postgrest-shim.mjs` — local-dev-only, see below.
- `supabase/local-dev/run-security-tests.mjs` — new section H, 7 tests
  (see Security tests).

## Local-dev shim extensions (not production code)

- `POST /rest/v1/reviews` — deliberately **not** service_role. Runs
  under whatever role/claims `applyRequestRole()` (Phase 8) already
  resolved for the request (anon, or authenticated with the caller's
  real `sub`/`email`) — real Postgres RLS is what actually decides
  whether this succeeds, this handler does no authorization of its own.
  What it does do is translate a raw Postgres error into the real
  PostgREST `{code, message, details, hint}` shape, so
  `submitReview()`'s `error.code` switch (`23505` duplicate, `42501` RLS
  rejection, `23514` CHECK violation) works correctly on the client —
  the shim's generic catch-all elsewhere only ever returns a bare
  `{error: string}}`, which has no `.code`.
- **A real bug found via browser testing, not curl**: the `reviews`
  entry in the shim's generic read-table map only ever whitelisted
  `contractor_id`/`status` as filterable columns (all Phase 6 ever
  needed for the public list). `getMyReviewForContractor()` additionally
  filters by `reviewer_id` — silently ignored by the shim (not
  rejected), so the query returned *every* review for that contractor
  instead of just the caller's own. `.maybeSingle()` then received more
  than one row and errored, which `getMyReviewForContractor()` treats as
  "no existing review found" — so a user who'd already reviewed kept
  seeing the submission form again on every page load. Fixed by adding
  `reviewer_id` to that table's filterable columns.

## Security tests (Issue #7's explicit requirements — each verified directly, live)

All of the following were run as real HTTP requests against the local
Postgres + extended shim (curl) and, for the end-to-end flow, a real
browser session (Playwright) — not asserted from reading the policy SQL:

| # | Test | Result |
|---|---|---|
| 1 | Anonymous `POST /rest/v1/reviews` (no session) | `403`, `{code: "42501", ...}` — RLS rejection, no row inserted |
| 2 | Authenticated insert with a spoofed `reviewer_id` (someone else's id, while logged in as a different user) | `403` RLS rejection — identity cannot be spoofed |
| 3 | Authenticated insert against a **pending** contractor | `403` RLS rejection (the new 0014 policy) |
| 4 | Insert with `rating: 99` | `400`, CHECK constraint violation |
| 5 | Insert with a 2001-character comment | `400`, `reviews_comment_length` CHECK violation (the new 0014 constraint) |
| 6 | Duplicate insert (same contractor + reviewer) | `409`, unique constraint violation |
| 7 | Valid insert (real approved contractor, own identity, valid rating, valid comment) | `201`, succeeds |
| 8 | A review on a contractor later **suspended**: anon visibility before vs. after | Visible before suspension, **hidden after** (the leak this phase found and fixed) |
| 9 | Same suspended-contractor review, read by **its own reviewer** | Still visible — confirms the fix didn't over-restrict |
| 10 | Same suspended-contractor review, read by **admin** | Still visible |
| 11 | Real end-to-end: log in as an ordinary customer, submit a review through the actual UI, confirm `rating_avg`/`review_count` on the contractor actually changed | Confirmed correct (4.5/2 → 4.3/3) — this is what caught the trigger privilege bug in the first place |

`node supabase/local-dev/run-security-tests.mjs` — **61/61 pass**
(54 pre-existing + 7 new section H tests), zero regressions, re-run after
every fix above including the 0015 trigger fix.

## Other tests

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run test:unit` — **67/67 pass** (58 pre-existing + 9 new:
  `validateReviewSubmission` — valid input accepted, missing/out-of-range/
  non-integer rating rejected, every integer 1-5 accepted, missing/too-
  short/too-long comment rejected, comment accepted at exactly the 2000-
  char boundary).
- `npm run build` — succeeds (exit 0) with and without Supabase env vars;
  `/contractors/[slug]` was already a dynamic (ƒ) route from Phase 6, so
  no new `force-dynamic` flag was needed for `ReviewForm`.
- End-to-end Playwright smoke tests against both `next dev` and a real
  `next start` production build: anonymous visitor sees a sign-in prompt
  instead of the form; a logged-in customer submits a rating + comment
  and sees a success message; the new review appears in the list and the
  header's aggregate rating/count updates after `router.refresh()`;
  revisiting the page shows "already reviewed" instead of the form, not
  a second empty one; submitting empty shows client-side validation
  errors for both fields; mobile viewport (375px) renders correctly.
  Zero unexpected console errors on every real (non-negative-test) path.
- All test fixtures (reviews, test passwords set on shared seed
  accounts) were cleaned up after testing; final `contractors`/
  `auth.users`/`reviews` counts match the pre-Phase-9 baseline
  (15 / 18 / 5).

## Review authorization model (summary)

- **Identity**: always `client.auth.getUser()`'s verified result — never
  a parameter, never trusted from the client beyond what the session
  itself proves.
- **Eligibility**: enforced by RLS's `reviews_insert_authenticated`
  (0014) — the target contractor must be `approved` at the moment of
  insert, re-checked by Postgres on every single request, not cached or
  assumed by the client.
- **Duplicate prevention**: the `unique(contractor_id, reviewer_id)`
  constraint (Phase 2, unchanged) — unspoofable, database-level.
- **Rating/comment bounds**: `rating` CHECK (Phase 2, unchanged) and the
  new `reviews_comment_length` CHECK (0014) — both real constraints, not
  application-level-only checks a direct API caller could route around.
- **Visibility**: `reviews_select_active_or_own` (0014) — active review
  on an approved contractor (public), or your own review regardless of
  its status or the contractor's current status (so it never just
  vanishes from your own view), or admin (moderation).
- **Aggregate integrity**: `update_contractor_review_stats()` (0012,
  fixed by 0015) — `security definer`, so it always recomputes correctly
  regardless of who triggered the underlying review change, and direct
  `EXECUTE` is revoked so it can only ever run via its own trigger.

## Limitations / disclosed gaps

1. **No review editing or deletion**, for the reviewer or otherwise
   outside admin moderation — this was already the existing product
   decision (0013's own comment: "prevents rating manipulation after the
   fact"), not something Phase 9 needed to add or could change without
   contradicting Issue #7's own "Do NOT redesign... except where a
   direct integration blocker exists."
2. **No review-list pagination** on the profile page — unchanged from
   Phase 6 (fixed 20-review cap), not described as in-scope by Issue #7.
3. **No reviewer identity shown** (rating + comment + date only) —
   unchanged from Phase 6's deliberate choice; profiles has no public-
   read RLS policy for other users anyway.
4. Sign-in/session mechanics remain the same local-dev-only, unsigned
   token described in Phase 8's report — unchanged this phase.

No other blockers.

## Commit

<!-- SHA filled in after commit below -->

## Verdict

**READY FOR REVIEW.**

Per Issue #7: **STOP after Phase 9. Do not start Phase 10 or unrelated
work.**
