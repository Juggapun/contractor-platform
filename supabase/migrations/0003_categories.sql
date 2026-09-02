-- =====================================================================
-- 0003_categories.sql
-- Depends on: 0001_extensions.sql
-- Tables: categories
-- =====================================================================

create table public.categories (
  id serial primary key,
  name_th text not null,
  name_en text not null,
  slug text not null unique,          -- Thai-language slug, e.g. 'รีโนเวท' (founder decision, updated after PHASE 2)
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.categories is 'Contractor work categories (สร้างบ้าน, ต่อเติม, ...). Seeded with 10 initial values.';
