-- =====================================================================
-- 0007_reviews.sql
-- Depends on: 0004_profiles.sql, 0005_contractors.sql
-- Tables: reviews
-- =====================================================================

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,

  rating smallint not null check (rating between 1 and 5),
  comment text,
  status text not null default 'active' check (status in ('active', 'flagged', 'removed')),

  created_at timestamptz not null default now(),

  -- one review per (contractor, reviewer) — prevents the simplest form of spam
  unique (contractor_id, reviewer_id)
);

comment on table public.reviews is 'One review per reviewer per contractor. status=active is the only publicly visible state.';

create index idx_reviews_contractor on public.reviews(contractor_id);
create index idx_reviews_contractor_status on public.reviews(contractor_id, status);
