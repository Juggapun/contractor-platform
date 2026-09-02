-- =====================================================================
-- 0014_reviews_hardening.sql
-- Depends on: 0005_contractors.sql, 0007_reviews.sql, 0013_rls_policies.sql
-- PHASE 9 — Contractor Reviews & Ratings.
--
-- Minimal, targeted fix for two gaps found while implementing the real
-- review-submission flow, neither requiring any new table/column:
--
-- 1. `reviews_insert_authenticated` (0013) only ever checked
--    `auth.uid() = reviewer_id` — nothing stopped an authenticated user
--    from submitting a review against a PENDING, REJECTED, or SUSPENDED
--    contractor. Issue #7 explicitly scopes review submission to
--    "an approved contractor"; this closes that gap at the one place a
--    client genuinely cannot route around it.
--
-- 2. `reviews_select_active_or_own` (0013) only ever checked the
--    review's OWN `status`, never the parent contractor's current
--    status — unlike `portfolio_images_select`/`contractor_categories_select`
--    (0013), which both already require the parent contractor to be
--    approved. A contractor that later gets suspended/rejected after
--    accumulating active reviews would keep those reviews publicly
--    queryable via a direct `GET /rest/v1/reviews?contractor_id=eq...`
--    call — unreachable through the normal profile-page flow (which
--    404s before ever calling getReviews()), but a real leak via direct
--    API access, exactly what Issue #7's "Test direct unauthorized
--    API/database requests" and "keep pending/rejected/suspended...
--    reviews out of public results" call out. Fixed to match the
--    existing portfolio_images/contractor_categories pattern: a
--    reviewer can always see their own review regardless of the
--    contractor's current status (so it doesn't just vanish from their
--    own view), admins see everything, and the public sees active
--    reviews only on currently-approved contractors.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Bound comment length — Issue #7 asks for "sensible validation and
-- length limits". Real, unspoofable enforcement (unlike an
-- application-level check alone, which only binds callers going through
-- this project's own UI/route) since it's a CHECK constraint. 2000
-- matches the bound already used for contractors.description
-- (src/lib/validation/contractorRegistration.ts).
-- ---------------------------------------------------------------------
alter table public.reviews
  add constraint reviews_comment_length check (comment is null or char_length(comment) <= 2000);

-- ---------------------------------------------------------------------
-- INSERT: reviewer identity was already unspoofable (auth.uid() =
-- reviewer_id); this adds "and the target contractor is approved".
-- ---------------------------------------------------------------------
drop policy "reviews_insert_authenticated" on public.reviews;

create policy "reviews_insert_authenticated" on public.reviews
  for insert with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.contractors c
      where c.id = contractor_id and c.status = 'approved'
    )
  );

-- ---------------------------------------------------------------------
-- SELECT: public visibility now requires BOTH the review's own
-- status = 'active' AND the parent contractor currently being
-- 'approved' — not just the review's own status. The reviewer's own
-- row and admin access are unaffected (unchanged from 0013).
-- ---------------------------------------------------------------------
drop policy "reviews_select_active_or_own" on public.reviews;

create policy "reviews_select_active_or_own" on public.reviews
  for select using (
    (
      status = 'active'
      and exists (
        select 1 from public.contractors c
        where c.id = contractor_id and c.status = 'approved'
      )
    )
    or reviewer_id = auth.uid()
    or public.is_admin()
  );
