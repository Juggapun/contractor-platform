-- =====================================================================
-- 0010_admin_actions.sql
-- Depends on: 0004_profiles.sql
-- Tables: admin_actions
-- Audit log — cheap to write now, essential the moment there is a
-- second admin, and useful for the single-founder case to answer
-- "why was this contractor suspended?" months later.
-- =====================================================================

create table public.admin_actions (
  id bigserial primary key,
  admin_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,           -- e.g. 'approve_contractor', 'suspend_contractor', 'remove_review'
  target_type text,               -- e.g. 'contractor', 'review', 'report'
  target_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.admin_actions is 'Audit log of every admin action. Written by application code on each admin operation, never edited or deleted.';

create index idx_admin_actions_admin on public.admin_actions(admin_id);
create index idx_admin_actions_target on public.admin_actions(target_type, target_id);
