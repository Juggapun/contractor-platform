-- =====================================================================
-- 0002_geography.sql
-- Depends on: 0001_extensions.sql
-- Tables: provinces, districts
-- =====================================================================

create table public.provinces (
  id serial primary key,
  name_th text not null,
  name_en text not null,
  slug text not null unique,          -- Thai-language slug, e.g. 'นนทบุรี' (founder decision, updated after PHASE 2)
  region text,
  created_at timestamptz not null default now()
);

comment on table public.provinces is 'Thailand''s 77 provinces. Seeded once, rarely changes.';

create table public.districts (
  id serial primary key,
  province_id integer not null references public.provinces(id) on delete restrict,
  name_th text not null,
  name_en text not null,
  slug text not null,                 -- unique only within a province, not globally
  created_at timestamptz not null default now(),
  unique (province_id, slug)
);

comment on table public.districts is 'Amphoe/Khet within each province. ~928 rows nationwide.';

create index idx_districts_province_id on public.districts(province_id);
