-- =====================================================================
-- 0011_system_settings.sql
-- Depends on: 0001_extensions.sql
-- Tables: system_settings
-- Purpose: config values (e.g. portfolio image limit) that must be
-- changeable by an admin WITHOUT a code deploy.
-- =====================================================================

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  -- SECURITY REVIEW FIX (post-PHASE-2, ChatGPT review item 3):
  -- get_setting() originally let ANY caller request ANY key. That is
  -- unsafe the moment a future admin-only setting (e.g. a feature flag
  -- controlling fraud thresholds) lands in this table — this column is
  -- the allowlist: only rows explicitly marked is_public are readable
  -- through get_setting(). Everything else requires is_admin().
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.system_settings is 'Admin-editable configuration (limits, toggles). Read via public.get_setting() helper (respects is_public), never queried raw from anon/authenticated roles.';

create trigger trg_system_settings_updated_at
  before update on public.system_settings
  for each row execute function public.set_updated_at();

-- SECURITY DEFINER helper so contractors/anon can read a SPECIFIC setting
-- value (e.g. their portfolio limit) without being granted table-level
-- SELECT on system_settings. Only returns a value when the row is marked
-- is_public = true, OR the caller is admin/trusted service-role context —
-- this is the fix for ChatGPT review item 3 (design A: explicit allowlist
-- via is_public, chosen over B/C because it keeps a single simple
-- function signature the frontend already expects, while still letting
-- future admin-only settings exist safely in the same table).
create or replace function public.get_setting(setting_key text)
returns jsonb
language sql
security definer set search_path = public
stable
as $$
  select value from public.system_settings
  where key = setting_key
    and (is_public = true or public.is_trusted_context());
$$;

-- Defense in depth: even though get_setting() is SECURITY DEFINER and
-- filters internally, explicitly control who may call it at all — no
-- reason for an unauthenticated caller to be unable to call it (public
-- settings must work for anonymous visitors), but this makes the
-- intended callers explicit rather than implicit.
revoke execute on function public.get_setting(text) from public;
grant execute on function public.get_setting(text) to anon, authenticated, service_role;
