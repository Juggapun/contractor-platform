-- =====================================================================
-- Bootstrap: reproduce the parts of a fresh Supabase project that the
-- Phase 2 migrations assume already exist (roles + auth schema), since
-- this session cannot pull the Supabase Docker images (org egress
-- policy blocks GHCR/Docker Hub blob CDNs). This mirrors Supabase's
-- actual open-source init scripts (supabase/postgres repo) as closely
-- as possible so RLS/policy behavior is faithful to production.
-- =====================================================================

-- Roles Supabase creates on every project. NOLOGIN because PostgREST
-- switches into them per-request via SET ROLE (which is exactly how we
-- will emulate requests in the SQL-level test harness).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login password 'authenticator_pw';
  end if;
end $$;

grant anon, authenticated, service_role to authenticator;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- Minimal auth.users, matching the columns the Phase 2 schema actually
-- touches (id, raw_user_meta_data) plus the standard identity columns.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select on auth.users to service_role;

-- auth.uid() / auth.role() reproduced verbatim from Supabase's own
-- postgres init scripts (supabase/postgres, auth-schema.sql): they read
-- the request.jwt.claim(s) GUCs that PostgREST sets from the decoded
-- JWT on every request. Our SQL-level test harness sets the same GUCs
-- via SET LOCAL to emulate an anon/authenticated/service_role request.
create or replace function auth.uid() returns uuid
  language sql stable
as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$;

create or replace function auth.role() returns text
  language sql stable
as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
    )::text
$$;

create or replace function auth.email() returns text
  language sql stable
as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim.email', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
    )::text
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;
grant execute on function auth.email() to anon, authenticated, service_role;

-- PostgREST behavior: anon/authenticated get USAGE on public schema and
-- default privileges are otherwise closed; RLS does the real gating.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
