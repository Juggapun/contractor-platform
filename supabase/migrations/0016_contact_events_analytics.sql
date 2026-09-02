-- =====================================================================
-- 0016_contact_events_analytics.sql
-- Depends on: 0008_contact_events.sql, 0012_denormalized_field_triggers.sql,
--             0015_fix_review_stats_trigger_privileges.sql
-- PHASE 10 — Usage & Contact Analytics (Issue #8).
--
-- 1. Widen contact_events.event_type to add 'website'.
--
--    contact_events (0008) only ever allowed 'phone' | 'line' | 'facebook'
--    | 'profile_view'. contractors.website_url (0002) exists and is
--    rendered as a clickable link on the public profile
--    (app/contractors/[slug]/page.tsx), but there has never been an
--    event_type a click on it could report — a gap explicitly disclosed
--    in src/lib/data/contactEvents.ts and src/components/ContactLink.tsx
--    since Phase 6/7. This migration closes it.
--
-- 2. Add contractors.profile_view_count.
--
--    Issue #8 asks for contractors to see how many times their profile
--    was viewed. contact_events already records a 'profile_view' row per
--    view, but counting them live on every profile/admin read would mean
--    an uncapped aggregate query on an unbounded table on every request.
--    Same denormalized-counter shape already used for rating_avg /
--    review_count (0012), kept in sync by a trigger below.
--
-- 3. update_contractor_view_count(): SECURITY DEFINER from the start.
--
--    This trigger's internal UPDATE ... WHERE id = contractor_id touches
--    a contractors row the *caller* essentially never owns — a
--    profile_view (or a phone/line/facebook/website click) is
--    overwhelmingly reported by an anonymous site visitor (`anon`), who
--    the RLS policy contractors_update_own (0013) does not authorize to
--    update that row at all. Phase 9 (0015) hit exactly this failure
--    mode reactively for update_contractor_review_stats(): a trigger
--    without `security definer` runs with the caller's own privileges,
--    so its internal UPDATE is itself subject to RLS and silently
--    matches zero rows for any caller who isn't the row's owner or an
--    admin. Applying that lesson proactively here rather than shipping
--    a counter that would have quietly never incremented for a real
--    anonymous visitor.
--
--    Direct EXECUTE is revoked from public/anon/authenticated for the
--    same reason as update_contractor_review_stats() and
--    handle_new_user(): this function has no legitimate purpose outside
--    its own trigger, and revoking EXECUTE does not affect the trigger
--    mechanism's own ability to invoke it.
-- =====================================================================

alter table public.contact_events drop constraint contact_events_event_type_check;
alter table public.contact_events add constraint contact_events_event_type_check
  check (event_type in ('phone', 'line', 'facebook', 'website', 'profile_view'));

alter table public.contractors
  add column profile_view_count integer not null default 0 check (profile_view_count >= 0);

comment on column public.contractors.profile_view_count is
  'Denormalized count of contact_events rows with event_type=profile_view for this contractor. Maintained by update_contractor_view_count() trigger on contact_events. PHASE 10.';

-- Backfill: contact_events rows already existed (recorded by Phase 6's
-- profile-view tracking) before this column existed. The trigger below
-- only recomputes on new INSERT/DELETE activity, so without this
-- one-time backfill every contractor's profile_view_count would sit at
-- its default of 0 -- silently wrong -- until their next profile view.
update public.contractors c
set profile_view_count = (
  select count(*)
  from public.contact_events ce
  where ce.contractor_id = c.id and ce.event_type = 'profile_view'
);

create or replace function public.update_contractor_view_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_contractor_id uuid;
begin
  target_contractor_id := coalesce(new.contractor_id, old.contractor_id);

  update public.contractors
  set profile_view_count = (
    select count(*)
    from public.contact_events
    where contractor_id = target_contractor_id and event_type = 'profile_view'
  )
  where id = target_contractor_id;

  return coalesce(new, old);
end;
$$;

revoke execute on function public.update_contractor_view_count() from public, anon, authenticated;

-- A single AFTER INSERT OR DELETE trigger cannot use a WHEN clause that
-- references NEW (NEW is null on DELETE, and Postgres rejects a WHEN
-- clause referencing NEW for a trigger that fires on DELETE at all — even
-- guarded by coalesce). Split into two triggers instead, each referencing
-- only the row variable that exists for its own event.
create trigger trg_update_contractor_view_count_ins
  after insert on public.contact_events
  for each row
  when (new.event_type = 'profile_view')
  execute function public.update_contractor_view_count();

create trigger trg_update_contractor_view_count_del
  after delete on public.contact_events
  for each row
  when (old.event_type = 'profile_view')
  execute function public.update_contractor_view_count();
