-- =====================================================================
-- 0006_portfolio_images.sql
-- Depends on: 0005_contractors.sql
-- Tables: portfolio_images
-- =====================================================================

create table public.portfolio_images (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,

  project_name text,
  project_type text,
  location_text text,
  description text,
  completion_date date,

  image_url text not null,        -- resized "display" version actually served to users
  thumbnail_url text not null,    -- used in listing/search — never serve image_url there
  original_url text,              -- kept for future use, never served directly to users

  sort_order integer not null default 0,
  file_size_kb integer,

  created_at timestamptz not null default now()
);

comment on table public.portfolio_images is 'Portfolio photos. image_url/thumbnail_url are the only URLs the frontend should render.';

create index idx_portfolio_images_contractor on public.portfolio_images(contractor_id);
