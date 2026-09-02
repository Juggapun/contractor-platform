-- =====================================================================
-- 0013_rls_policies.sql
-- Depends on: every table migration above (0002–0011)
-- Enables RLS on EVERY table and defines policies per PHASE 1 strategy.
-- No table is left with RLS disabled. No policy trusts the frontend.
-- =====================================================================

-- Note: public.is_admin() is defined in 0004_profiles.sql (not here) so
-- that trigger functions in 0012 can use it before RLS policies exist.
-- It is used throughout the policies below.

-- =====================================================================
-- provinces / districts / categories — public reference data
-- =====================================================================
alter table public.provinces enable row level security;
alter table public.districts enable row level security;
alter table public.categories enable row level security;

create policy "provinces_select_all" on public.provinces
  for select using (true);
create policy "provinces_admin_write" on public.provinces
  for all using (public.is_admin()) with check (public.is_admin());

create policy "districts_select_all" on public.districts
  for select using (true);
create policy "districts_admin_write" on public.districts
  for all using (public.is_admin()) with check (public.is_admin());

create policy "categories_select_all" on public.categories
  for select using (true);
create policy "categories_admin_write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- profiles
-- =====================================================================
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());
-- No public INSERT policy: rows are created only by the
-- handle_new_user() trigger (security definer) on signup.
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- contractors
-- =====================================================================
alter table public.contractors enable row level security;

create policy "contractors_select_approved_public" on public.contractors
  for select using (status = 'approved' or user_id = auth.uid() or public.is_admin());

create policy "contractors_insert_own" on public.contractors
  for insert with check (user_id = auth.uid());

-- Ownership check only. Locking status/verification_status/plan_tier/
-- featured_until against self-approval is enforced by a BEFORE UPDATE
-- trigger (trg_contractors_lock_admin_fields, see 0012) rather than a
-- correlated-subquery WITH CHECK, which is unreliable to reason about
-- inside RLS — the trigger approach is deterministic and easy to audit.
create policy "contractors_update_own" on public.contractors
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "contractors_admin_delete" on public.contractors
  for delete using (public.is_admin());

-- =====================================================================
-- contractor_categories
-- =====================================================================
alter table public.contractor_categories enable row level security;

create policy "contractor_categories_select" on public.contractor_categories
  for select using (
    exists (select 1 from public.contractors c where c.id = contractor_id and c.status = 'approved')
    or exists (select 1 from public.contractors c where c.id = contractor_id and c.user_id = auth.uid())
    or public.is_admin()
  );

create policy "contractor_categories_owner_write" on public.contractor_categories
  for all using (
    exists (select 1 from public.contractors c where c.id = contractor_id and c.user_id = auth.uid())
    or public.is_admin()
  )
  with check (
    exists (select 1 from public.contractors c where c.id = contractor_id and c.user_id = auth.uid())
    or public.is_admin()
  );

-- =====================================================================
-- portfolio_images
-- =====================================================================
alter table public.portfolio_images enable row level security;

create policy "portfolio_images_select" on public.portfolio_images
  for select using (
    exists (select 1 from public.contractors c where c.id = contractor_id and c.status = 'approved')
    or exists (select 1 from public.contractors c where c.id = contractor_id and c.user_id = auth.uid())
    or public.is_admin()
  );

create policy "portfolio_images_owner_write" on public.portfolio_images
  for all using (
    exists (select 1 from public.contractors c where c.id = contractor_id and c.user_id = auth.uid())
    or public.is_admin()
  )
  with check (
    exists (select 1 from public.contractors c where c.id = contractor_id and c.user_id = auth.uid())
    or public.is_admin()
  );

-- =====================================================================
-- reviews
-- =====================================================================
alter table public.reviews enable row level security;

create policy "reviews_select_active_or_own" on public.reviews
  for select using (status = 'active' or reviewer_id = auth.uid() or public.is_admin());

create policy "reviews_insert_authenticated" on public.reviews
  for insert with check (auth.uid() = reviewer_id);

-- Reviewers cannot edit/delete their own review once posted (MVP simplicity,
-- prevents rating manipulation after the fact) — only admin can moderate.
create policy "reviews_admin_moderate" on public.reviews
  for update using (public.is_admin()) with check (public.is_admin());
create policy "reviews_admin_delete" on public.reviews
  for delete using (public.is_admin());

-- =====================================================================
-- contact_events — anonymous insert allowed by design (PHASE 1 decision)
-- =====================================================================
alter table public.contact_events enable row level security;

create policy "contact_events_insert_anyone" on public.contact_events
  for insert with check (true);

create policy "contact_events_select_owner_or_admin" on public.contact_events
  for select using (
    exists (select 1 from public.contractors c where c.id = contractor_id and c.user_id = auth.uid())
    or public.is_admin()
  );

-- No update/delete policy for anyone but admin — events are immutable.
create policy "contact_events_admin_delete" on public.contact_events
  for delete using (public.is_admin());

-- =====================================================================
-- reports
-- =====================================================================
alter table public.reports enable row level security;

create policy "reports_insert_anyone" on public.reports
  for insert with check (true);

create policy "reports_select_admin_only" on public.reports
  for select using (public.is_admin());

create policy "reports_admin_update" on public.reports
  for update using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- admin_actions — admin only, no update/delete policy for anyone (immutable log)
-- =====================================================================
alter table public.admin_actions enable row level security;

create policy "admin_actions_admin_select" on public.admin_actions
  for select using (public.is_admin());

create policy "admin_actions_admin_insert" on public.admin_actions
  for insert with check (public.is_admin());

-- =====================================================================
-- system_settings — no direct table access for anon/authenticated;
-- read only via the get_setting() SECURITY DEFINER function (0011).
-- =====================================================================
alter table public.system_settings enable row level security;

create policy "system_settings_admin_all" on public.system_settings
  for all using (public.is_admin()) with check (public.is_admin());
-- Deliberately no select policy for non-admins: get_setting() bypasses
-- RLS via SECURITY DEFINER, so this table stays otherwise inaccessible.
