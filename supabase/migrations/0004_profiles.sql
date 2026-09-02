-- =====================================================================
-- 0004_profiles.sql
-- Depends on: 0001_extensions.sql
-- Tables: profiles (1:1 extension of auth.users)
-- =====================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'contractor', 'admin')),
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Extends auth.users with app-specific fields and role. Row is created via trigger on signup.';

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Automatically create a profiles row whenever a new auth.users row appears,
-- so the rest of the schema can always assume profiles.id exists for any
-- authenticated user without extra application-side bookkeeping.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- SECURITY REVIEW FIX (post-PHASE-2, ChatGPT review item 3): SECURITY
-- DEFINER functions are callable directly by any role unless revoked,
-- regardless of how they're "meant" to be used. handle_new_user() has no
-- legitimate use outside the AFTER INSERT trigger above — revoke direct
-- EXECUTE so it cannot be called as a general-purpose privileged
-- profile-insertion function by an authenticated user. Trigger execution
-- is unaffected by function-level REVOKE (Postgres always allows the
-- trigger mechanism itself to invoke the function).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Defined here (not in 0013_rls_policies.sql) so that trigger functions in
-- later migrations — e.g. trg_contractors_lock_admin_fields in 0012 — can
-- use it before RLS policies exist. Used throughout 0013 as well.
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- SECURITY REVIEW FIX (post-PHASE-2, ChatGPT review item 1/2):
-- is_admin() alone is not enough to gate admin-only-field-locking triggers,
-- because a legitimate service-role (server-side) call may have no
-- auth.uid() at all, even though it bypasses RLS. auth.role() reads the
-- 'role' claim Supabase's PostgREST puts on every request's JWT — for the
-- service_role key that claim is literally 'service_role'. Trusted context
-- = caller is an admin OR the request itself was authenticated with the
-- service_role key (server-side code, not a bypassed-RLS trick a normal
-- user can trigger).
create or replace function public.is_trusted_context()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.is_admin() or auth.role() = 'service_role';
$$;

revoke execute on function public.is_trusted_context() from public;
grant execute on function public.is_trusted_context() to authenticated, anon, service_role;

-- SECURITY REVIEW FIX (post-PHASE-2, ChatGPT review item 2 — BLOCKER):
-- profiles_update_own (0013) lets a user UPDATE their own row, and role
-- was NOT excluded from that. Without this trigger, any authenticated
-- user could set their own role to 'admin' via a direct PostgREST call,
-- bypassing every is_admin()-gated policy in the whole schema. This
-- trigger forces `role` back to its previous value on every UPDATE
-- unless the caller is admin or a trusted service-role context.
create or replace function public.lock_profile_role()
returns trigger
language plpgsql
as $$
begin
  if not public.is_trusted_context() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_lock_role
  before update on public.profiles
  for each row execute function public.lock_profile_role();
