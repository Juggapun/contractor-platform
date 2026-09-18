-- =====================================================================
-- 0026_grant_home_public_read.sql
-- Depends on: 0013_rls_policies.sql, 0018_grant_table_privileges.sql,
--             0024_articles.sql
-- Issue #46 — Home's 3 public-read sections (Recommended Contractors,
-- Reviews, Articles) returned empty results in Production despite the
-- underlying tables having real, RLS-passing data (confirmed via the
-- Owner's own SQL Editor session, which runs as an elevated role that
-- bypasses ordinary GRANT restrictions -- unlike the `anon` role every
-- Home page load actually queries as, since app/page.tsx's server-side
-- data fetching never attaches a user session).
--
-- Root cause: 0018_grant_table_privileges.sql was the first migration
-- in this schema's history to grant any base table-level privilege to
-- anon/authenticated (RLS alone, per 0018's own header comment, is not
-- a substitute -- it only filters rows once a query already has base
-- privilege to touch the table at all). This repo has no record of
-- 0018 ever being delivered to/applied against Production --
-- docs/DEPLOYMENT.md's one documented consolidated SQL packet stops at
-- migration 0017. `articles` (0024) was created AFTER 0018 regardless
-- of that: it only inherits a grant via 0018's `alter default
-- privileges` clause, which in Postgres auto-applies only to tables
-- later created BY THE SAME DATABASE ROLE that ran the ALTER DEFAULT
-- PRIVILEGES statement -- an assumption this repo cannot verify.
--
-- Deliberately narrower than 0018: SELECT only (never insert/update/
-- delete) on exactly the tables Home's public, logged-out read path
-- touches:
--   - contractors, reviews, articles: the 3 sections themselves
--   - provinces, districts, categories, contractor_categories: embedded
--     via PostgREST joins inside searchContractors()'s own select()
--     (src/lib/data/contractors.ts) -- a missing grant on any embedded
--     table fails the WHOLE request, not just that column
-- provinces/categories are included defensively even though they are
-- believed already readable by anon (Issue #2's dropdown fix implies
-- so) -- re-granting SELECT on a table that already has it is a
-- harmless no-op.
--
-- RLS (0013/0014/0024) remains the actual authorization boundary for
-- WHICH ROWS anon/authenticated can see -- this migration restores
-- only the prerequisite base privilege RLS filters on top of. It does
-- not create, drop, or alter any RLS policy, and grants no write
-- privilege beyond SELECT -- it does not touch whatever grant already
-- lets real logged-in users submit reviews today (that flow currently
-- works per the Owner's own report, so this migration leaves it alone
-- entirely).
--
-- Verified locally (Issue #46 patch-plan comment): inside a single
-- rolled-back transaction, revoked all privileges on these 7 tables
-- from anon/authenticated to simulate 0018 never having run, confirmed
-- `permission denied for table contractors` (the exact Postgres 42501
-- class Issue #17 hit for `profiles`), applied this exact grant,
-- confirmed anon SELECT then succeeds, and confirmed anon INSERT is
-- still rejected -- proving the patch is read-only.
--
-- Idempotent: `grant` is safe to re-run against a role that already
-- has the privilege.
-- =====================================================================

grant usage on schema public to anon, authenticated;

grant select on
  public.contractors,
  public.reviews,
  public.articles,
  public.provinces,
  public.districts,
  public.categories,
  public.contractor_categories
to anon, authenticated;
