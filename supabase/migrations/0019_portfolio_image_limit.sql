-- =====================================================================
-- 0019_portfolio_image_limit.sql
-- Depends on: 0006_portfolio_images.sql
-- Issue #23 — "Never allow the total to exceed 20, including attempts
-- through direct API/REST calls." RLS (0013_rls_policies.sql) already
-- correctly scopes portfolio_images writes to the owning contractor (or
-- admin); it cannot express an AGGREGATE invariant like "at most 20 rows
-- for this contractor_id" — RLS policies evaluate one row at a time. A
-- BEFORE INSERT trigger is the correct tool for a count-based invariant,
-- the same reasoning already applied to every other cross-row rule in
-- this schema (e.g. rating_avg/review_count, 0012_denormalized_field_triggers.sql).
--
-- Applies to EVERY insert, unconditionally — including service_role
-- (the registration route's initial 0-5 images). Unlike the admin-field
-- locks (lock_contractor_admin_fields/lock_profile_role), this is not a
-- privilege-escalation guard where a trusted server context should be
-- allowed to bypass it; it is a plain data-integrity ceiling that must
-- hold no matter who is inserting.
-- =====================================================================

create or replace function public.enforce_portfolio_image_limit()
returns trigger
language plpgsql
as $$
declare
  current_count integer;
begin
  -- Serialize concurrent inserts for the SAME contractor so two
  -- simultaneous uploads can't both read a count under the cap and both
  -- land under it, pushing the real total past 20 — the same category
  -- of race decideContractor.ts's conditional UPDATE guards against for
  -- approve/reject (app/api/admin/_lib/decideContractor.ts), applied
  -- here via an advisory lock since this is an insert-count invariant,
  -- not a state-transition one. Held only for the rest of this
  -- transaction and only for this contractor_id — never blocks a
  -- different contractor's concurrent upload.
  perform pg_advisory_xact_lock(hashtext(new.contractor_id::text));

  select count(*) into current_count
  from public.portfolio_images
  where contractor_id = new.contractor_id;

  if current_count >= 20 then
    raise exception 'contractor % already has % portfolio images (maximum 20)', new.contractor_id, current_count
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger trg_portfolio_images_enforce_limit
  before insert on public.portfolio_images
  for each row execute function public.enforce_portfolio_image_limit();
