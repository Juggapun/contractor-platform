-- =====================================================================
-- 0021_reports_hardening.sql
-- Depends on: 0009_reports.sql, 0013_rls_policies.sql
-- Issue #35 security audit — two gaps found in the anonymous-insert
-- `reports` table, the same class of issue as 0020's portfolio_images
-- fix: RLS governs WHO can write a row, never WHAT the row can contain.
--
-- 1. `reason` was unconstrained `text` (unbounded, unlike every other
--    user-supplied text column in this schema — reviews.comment capped
--    at 2000 by 0014_reviews_hardening.sql, portfolio_images' four text
--    columns capped by 0020). `reports_insert_anyone` (0013) allows
--    `with check (true)` for anon, so any anonymous caller with the
--    public anon key can POST directly to PostgREST with an arbitrarily
--    large `reason` string — a storage-bloat/DoS vector into a table
--    only admins can even read.
--
-- 2. `reports_insert_anyone`'s `with check (true)` also never validated
--    `reporter_id` against the caller's own identity. `reporter_id` is
--    nullable specifically to allow anonymous reports (0009's own
--    comment), but nothing stopped an authenticated — or even fully
--    anonymous — caller from setting `reporter_id` to an ARBITRARY
--    other user's uuid, forging who filed a report. Impact is bounded
--    (only admins can ever read `reports`, via `reports_select_admin_only`),
--    but it's still an identity-spoofing gap in an admin-facing audit
--    trail an admin might reasonably act on. Fixed the same way
--    profiles/contact_events already require: a caller may only ever
--    claim to be themselves.
-- =====================================================================

alter table public.reports
  add constraint reports_reason_length check (char_length(reason) <= 2000);

drop policy "reports_insert_anyone" on public.reports;
create policy "reports_insert_anyone" on public.reports
  for insert
  with check (reporter_id is null or reporter_id = auth.uid());
