-- =====================================================================
-- 0005_contractors.sql
-- Depends on: 0001, 0002 (provinces/districts), 0004 (profiles)
-- Tables: contractors
-- =====================================================================

create table public.contractors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,

  business_name text not null,
  slug text not null unique,
  description text,

  phone text,
  line_id text,
  facebook_url text,
  website_url text,

  province_id integer references public.provinces(id),
  district_id integer references public.districts(id),
  address text,

  years_experience integer check (years_experience is null or years_experience >= 0),
  profile_image_url text,

  -- denormalized, trigger-maintained — never written to directly by the app
  rating_avg numeric(2,1) not null default 0 check (rating_avg between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  profile_completeness integer not null default 0 check (profile_completeness between 0 and 100),

  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended', 'rejected')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified')),

  -- monetization-ready fields — nullable/default-safe, no logic reads these in MVP
  plan_tier text not null default 'free' check (plan_tier in ('free', 'premium')),
  featured_until timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contractors is 'One row per contractor business. status gates public visibility.';
comment on column public.contractors.rating_avg is 'Maintained by trg_reviews_update_contractor_stats — do not write directly.';
comment on column public.contractors.review_count is 'Maintained by trg_reviews_update_contractor_stats — do not write directly.';
comment on column public.contractors.plan_tier is 'Monetization-ready field. No billing logic reads this in MVP.';
comment on column public.contractors.featured_until is 'Monetization-ready field. No listing logic reads this in MVP.';

create index idx_contractors_status_province on public.contractors(status, province_id);
create index idx_contractors_status_district on public.contractors(status, district_id);

create trigger trg_contractors_updated_at
  before update on public.contractors
  for each row execute function public.set_updated_at();

-- Contractor <-> Category (many-to-many)
create table public.contractor_categories (
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  category_id integer not null references public.categories(id) on delete restrict,
  primary key (contractor_id, category_id)
);

create index idx_contractor_categories_category on public.contractor_categories(category_id);
