-- =====================================================================
-- 0012_denormalized_field_triggers.sql
-- Depends on: 0005_contractors.sql, 0006_portfolio_images.sql, 0007_reviews.sql
-- Purpose: guarantee rating_avg / review_count / profile_completeness on
-- contractors can NEVER drift out of sync with their source rows, because
-- they are recalculated by trigger on every relevant change — never
-- written to directly by application code.
-- =====================================================================

-- ---------------------------------------------------------------------
-- rating_avg + review_count: recalculated from ACTIVE reviews only,
-- on any insert/update/delete on reviews.
-- ---------------------------------------------------------------------
create or replace function public.update_contractor_review_stats()
returns trigger
language plpgsql
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

create trigger trg_reviews_update_contractor_stats
  after insert or update or delete on public.reviews
  for each row execute function public.update_contractor_review_stats();

-- ---------------------------------------------------------------------
-- profile_completeness: simple weighted checklist, recalculated whenever
-- a contractor row is updated (covers profile edits and portfolio-driven
-- updates via the application explicitly re-saving the contractor row).
-- Kept intentionally simple for MVP — not wired into ranking logic yet.
-- ---------------------------------------------------------------------
create or replace function public.calculate_profile_completeness(c public.contractors)
returns integer
language plpgsql
immutable
as $$
declare
  score integer := 0;
  has_portfolio boolean;
begin
  if c.business_name is not null and length(trim(c.business_name)) > 0 then score := score + 15; end if;
  if c.description is not null and length(trim(c.description)) > 20 then score := score + 15; end if;
  if c.profile_image_url is not null then score := score + 15; end if;
  if c.phone is not null or c.line_id is not null then score := score + 15; end if;
  if c.province_id is not null and c.district_id is not null then score := score + 10; end if;
  if c.years_experience is not null then score := score + 10; end if;

  select exists(select 1 from public.portfolio_images where contractor_id = c.id) into has_portfolio;
  if has_portfolio then score := score + 20; end if;

  return least(score, 100);
end;
$$;

create or replace function public.trg_set_profile_completeness()
returns trigger
language plpgsql
as $$
begin
  new.profile_completeness := public.calculate_profile_completeness(new);
  return new;
end;
$$;

create trigger trg_contractors_set_completeness
  before insert or update on public.contractors
  for each row execute function public.trg_set_profile_completeness();

-- Portfolio image changes also affect completeness (the "has_portfolio"
-- factor above) — touch the parent contractor row so the BEFORE UPDATE
-- trigger above recalculates it.
create or replace function public.touch_contractor_on_portfolio_change()
returns trigger
language plpgsql
as $$
declare
  target_contractor_id uuid;
begin
  target_contractor_id := coalesce(new.contractor_id, old.contractor_id);
  update public.contractors set updated_at = now() where id = target_contractor_id;
  return coalesce(new, old);
end;
$$;

create trigger trg_portfolio_images_touch_contractor
  after insert or delete on public.portfolio_images
  for each row execute function public.touch_contractor_on_portfolio_change();

-- ---------------------------------------------------------------------
-- Lock admin-only fields on contractors: a non-trusted caller (a normal
-- authenticated user or the contractor themself editing their own row)
-- cannot change status, verification_status, plan_tier, or
-- featured_until no matter what value they submit — those columns are
-- silently forced back to their previous value. Admins AND trusted
-- service-role (server-side) callers can change them.
--
-- SECURITY REVIEW FIX (post-PHASE-2, ChatGPT review item 1): originally
-- gated on public.is_admin() alone, which would have incorrectly blocked
-- a legitimate service-role server operation that has no auth.uid().
-- Now gated on public.is_trusted_context() (0004), which additionally
-- allows auth.role() = 'service_role'.
--
-- This runs alongside trg_contractors_set_completeness — both are
-- BEFORE UPDATE triggers on disjoint columns, so execution order between
-- them does not affect correctness.
-- ---------------------------------------------------------------------
create or replace function public.lock_contractor_admin_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_trusted_context() then
    new.status := old.status;
    new.verification_status := old.verification_status;
    new.plan_tier := old.plan_tier;
    new.featured_until := old.featured_until;
  end if;
  return new;
end;
$$;

create trigger trg_contractors_lock_admin_fields
  before update on public.contractors
  for each row execute function public.lock_contractor_admin_fields();
