-- =====================================================================
-- 0025_articles_facebook_post_id.sql
-- Depends on: 0024_articles.sql
-- Tables: articles (adds a column)
--
-- Issue #44 — replaces the HTML/og:image scraper (Issue #42) with a
-- proper Meta Graph API importer against our own Facebook Page. Graph
-- API posts have a real, stable id (e.g. "{page-id}_{post-id}") that
-- `facebook_post_url` alone cannot be safely deduped against (the same
-- post can be reached by more than one equivalent URL shape) — this
-- column is that stable identifier, populated only for
-- Graph-API-imported rows. Nullable and NOT unique-constrained against
-- itself as a hard requirement for every row: existing rows and any
-- future manually-added-by-URL row (see app/api/admin/articles/route.ts)
-- have no Graph API post to point at and legitimately stay null; the
-- partial unique index below only enforces uniqueness where a value is
-- actually present, which is exactly the "re-importing the same post
-- must not create duplicate articles" requirement.
-- =====================================================================

alter table public.articles
  add column facebook_post_id text;

alter table public.articles
  add constraint articles_facebook_post_id_length check (char_length(facebook_post_id) <= 200);

comment on column public.articles.facebook_post_id is 'Graph API post id (e.g. "{page-id}_{post-id}") for rows imported via the Facebook Page importer (Issue #44). Null for manually-added-by-URL rows, which have no Graph API object to dedupe against.';

-- Partial unique index: only enforces uniqueness among non-null values,
-- so multiple manually-added rows (all null here) never conflict, while
-- two Graph-API imports of the very same post do.
create unique index idx_articles_facebook_post_id on public.articles(facebook_post_id) where facebook_post_id is not null;
