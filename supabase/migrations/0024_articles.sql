-- =====================================================================
-- 0024_articles.sql
-- Depends on: 0001_extensions.sql, 0004_profiles.sql
-- Tables: articles
--
-- Issue #42, Articles (comment 5582752011, "REQUEST CHANGES — Articles:
-- Admin-managed Facebook posts"): replaces the earlier static/curated
-- array approach (src/lib/content/facebookArticles.ts, now retired) with
-- a real admin-managed table. An admin supplies exactly two fields per
-- article — the Facebook post URL and a title — and the server fetches
-- the post's own og:image server-side to use as the cover, never asking
-- the admin to upload one and never fabricating one. cover_image_url
-- always points at OUR OWN Supabase Storage (the fetched image is
-- downloaded, re-optimized through the same pipeline used for
-- contractor/portfolio images, and re-uploaded there — see
-- src/lib/storage/articleMedia.ts) rather than hotlinking Facebook's own
-- CDN, which is exactly what the Owner's "prefer storing a stable local
-- copy... rather than depending on a fragile Facebook image hotlink"
-- instruction asks for.
--
-- cover_image_status/cover_image_error exist specifically so a failed
-- fetch is visible to the admin (per the Owner's explicit "does not
-- create fake content" requirement) rather than silently leaving
-- cover_image_url null with no explanation — the admin UI surfaces
-- cover_image_error directly.
-- =====================================================================

create table public.articles (
  id uuid primary key default gen_random_uuid(),

  facebook_post_url text not null,
  title text not null,

  -- Always OUR OWN Storage URL once populated (contractor-media bucket,
  -- articles/ path prefix — see src/lib/storage/articleMedia.ts), never
  -- a direct Facebook/fbcdn.net URL. Null until a fetch has succeeded.
  cover_image_url text,
  cover_image_status text not null default 'pending'
    check (cover_image_status in ('pending', 'success', 'failed')),
  -- Short, admin-facing reason when cover_image_status = 'failed' (e.g.
  -- "no og:image found", "fetch timed out") — never shown to public
  -- visitors, only in the admin UI.
  cover_image_error text,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint articles_title_length check (char_length(title) <= 200),
  constraint articles_facebook_post_url_length check (char_length(facebook_post_url) <= 2000),
  constraint articles_cover_image_error_length check (char_length(cover_image_error) <= 500)
);

comment on table public.articles is 'Admin-managed Home "บทความ & เคล็ดลับ" entries (Issue #42). Every row links to a real Facebook post the admin explicitly entered; cover_image_url is our own re-hosted copy of that post''s og:image, fetched server-side, never fabricated.';

create index idx_articles_created_at on public.articles(created_at desc);

create trigger trg_articles_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

alter table public.articles enable row level security;

-- Same shape as categories (0013_rls_policies.sql): a real public SELECT
-- policy (Home renders these for every visitor, signed in or not) plus
-- an admin-only write policy. Admin mutations in practice go through
-- app/api/admin/articles/* using the service_role client (which bypasses
-- RLS entirely, per requireAdmin()'s own real auth+role check being the
-- actual gate) — this policy exists anyway so the database itself
-- enforces the boundary too, not just the app route, matching this
-- schema's established posture for every other admin-writable table.
create policy "articles_select_all" on public.articles
  for select using (true);
create policy "articles_admin_write" on public.articles
  for all using (public.is_admin()) with check (public.is_admin());
