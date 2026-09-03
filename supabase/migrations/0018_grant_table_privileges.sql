-- =====================================================================
-- 0018_grant_table_privileges.sql
-- Depends on: every table migration above (0002-0011)
-- Issue #17 -- found in production: contractor registration failed with
-- Postgres error 42501 ("permission denied for table profiles") when
-- promoteNewAccountToContractor() (src/lib/auth/authService.ts) ran
-- `service_role client .from('profiles').update({role:'contractor'})`.
--
-- RLS and base table privileges are two SEPARATE Postgres layers.
-- `alter table ... enable row level security` (0013_rls_policies.sql)
-- only controls which ROWS a query can see/touch once it already has
-- privilege to run that kind of query on the table at all -- base
-- `GRANT ... ON TABLE` is the prerequisite RLS filters on top of, not
-- something RLS policies substitute for. Not one migration in this
-- directory ever ran a `grant ... on table` statement -- every table
-- created since 0002 has only ever worked because whatever bootstrapped
-- the running Postgres instance ALSO configured default privileges for
-- anon/authenticated/service_role, entirely outside this repo's own
-- migrations.
--
-- This exact gap was already known and already fixed -- just only for
-- the local-dev emulation, never for a real deployment:
-- supabase/local-dev/00_bootstrap.sql (Phase 2) grants this same set of
-- privileges to anon/authenticated/service_role with the comment
-- "default privileges are otherwise closed; RLS does the real gating" --
-- written specifically because a bare Postgres instance (unlike a
-- pre-configured hosted Supabase project) needs it spelled out. Issue
-- #17 shows the real hosted project needs the exact same thing spelled
-- out too, at least for `service_role` on `profiles` -- rather than
-- special-case just that one table/role, this ports the local-dev
-- harness's already-reasoned-through grant set verbatim into a real,
-- reproducible migration, so the schema no longer depends on whatever
-- default-privilege behavior a given Postgres host happens to apply.
--
-- Not a security change: RLS (0013) remains the actual authorization
-- boundary for anon/authenticated -- no policy is touched here, and a
-- base GRANT without a matching RLS policy still allows zero rows for
-- those two roles on any RLS-enabled table. service_role already
-- bypasses RLS entirely by design (that is its whole purpose, per
-- public.is_trusted_context()'s own comment in 0004_profiles.sql) --
-- granting it base table access is fixing a missing prerequisite for
-- its already-intended trust level, not adding a new one. Idempotent:
-- safe to run again if some tables already had grants and others didn't.
-- =====================================================================

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

-- So a future migration's `create table` doesn't reintroduce this same
-- gap for whichever role ends up applying it.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
