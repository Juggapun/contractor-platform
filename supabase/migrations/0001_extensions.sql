-- =====================================================================
-- 0001_extensions.sql
-- PHASE 2 — Foundation extensions required by later migrations
-- =====================================================================

-- UUID generation (gen_random_uuid) is built into Postgres 13+ via pgcrypto,
-- Supabase ships pgcrypto enabled by default, but we enable explicitly
-- so this migration is self-contained and reproducible on a fresh project.
create extension if not exists "pgcrypto";

-- citext not required for MVP (kept out intentionally — email/slug matching
-- is handled at the application layer with normalized lowercase text).

-- Generic helper: keep updated_at in sync on every UPDATE.
-- Used by every table below that has an updated_at column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
