-- =====================================================================
-- 0015_fix_review_stats_trigger_privileges.sql
-- Depends on: 0012_denormalized_field_triggers.sql
-- PHASE 9 — found while building real review submission end-to-end.
--
-- update_contractor_review_stats() (0012) is an AFTER INSERT/UPDATE/
-- DELETE trigger ON public.reviews that runs `UPDATE public.contractors
-- SET rating_avg = ..., review_count = ... WHERE id = ...`. It was
-- defined WITHOUT `security definer`, so it ran with the CALLING USER's
-- own privileges — meaning that internal UPDATE was itself subject to
-- RLS as if the calling user had issued it directly. `contractors_update_own`
-- (0013_rls_policies.sql) only allows `user_id = auth.uid() or
-- is_admin()` to update a contractors row.
--
-- Every review author is, by definition, NOT the contractor's owner (you
-- review someone else's business). So for any ordinary customer
-- submitting a review, this trigger's internal UPDATE matched zero rows
-- under RLS and silently did nothing — no error, just a rating_avg/
-- review_count that quietly stopped reflecting reality the moment a
-- non-admin, non-owner user (i.e. almost every real reviewer) posted a
-- review.
--
-- This was invisible in every prior test: the Phase 2 harness's F1-F3
-- trigger tests (supabase/local-dev/run-security-tests.mjs) all run
-- `asServiceRole`, which bypasses RLS entirely and so never exercised
-- this path; no review-SUBMISSION flow existed at all before Phase 9.
-- Caught here by a real end-to-end browser test (log in as an ordinary
-- customer, submit a review, check the displayed aggregate actually
-- changed) — not by any static check or the SQL-level harness as
-- originally written.
--
-- Fix: run the trigger function as its DEFINER (the migration-applying
-- role, effectively the schema owner) rather than the caller — the same
-- established pattern already used for handle_new_user() (0004) and
-- is_admin()/is_trusted_context() (0004) for exactly this class of
-- "a normal user's action needs to update a row they don't own, in a
-- narrowly-scoped, trigger-only way" problem. Direct EXECUTE is revoked
-- from public/anon/authenticated — this function has no legitimate use
-- outside its own trigger, and (per the same note on handle_new_user())
-- revoking EXECUTE does not affect the trigger mechanism's own ability
-- to invoke it.
-- =====================================================================

create or replace function public.update_contractor_review_stats()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_contractor_id uuid;
begin
  target_contractor_id := coalesce(new.contractor_id, old.contractor_id);

  update public.contractors
  set
    rating_avg = coalesce((
      select round(avg(rating)::numeric, 1)
      from public.reviews
      where contractor_id = target_contractor_id and status = 'active'
    ), 0),
    review_count = (
      select count(*)
      from public.reviews
      where contractor_id = target_contractor_id and status = 'active'
    )
  where id = target_contractor_id;

  return coalesce(new, old);
end;
$$;

revoke execute on function public.update_contractor_review_stats() from public, anon, authenticated;
