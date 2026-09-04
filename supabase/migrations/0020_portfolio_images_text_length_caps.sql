-- =====================================================================
-- 0020_portfolio_images_text_length_caps.sql
-- Depends on: 0006_portfolio_images.sql
-- Issue #28 — investigating a reported large-payload/413 failure on the
-- portfolio read path found that project_name/project_type/description/
-- location_text were all unconstrained `text` (effectively unbounded,
-- up to Postgres's ~1GB text limit). The app's own upload route
-- (app/api/contractors/me/portfolio/route.ts) already caps project_name
-- at 200 chars and never sets project_type/description/location_text at
-- all — but that's an app-level convention, not an enforced boundary: a
-- contractor's own valid bearer token is enough to write directly to
-- PostgREST (portfolio_images_owner_write, 0013_rls_policies.sql allows
-- any column value for their own contractor_id), bypassing the Next.js
-- route and its 200-char cap entirely. A single oversized value in any
-- of these columns would be returned in full by every read of that
-- contractor's portfolio (src/lib/data/portfolio.ts's getPortfolioImages
-- — used by both the public profile page and the contractor's own
-- manage page), which is exactly the shape of failure this issue
-- describes: a normally-tiny metadata response ballooning past a
-- platform payload limit. RLS already gates WHO can write; this adds
-- the bound on WHAT they can write, at the one layer that can't be
-- bypassed by skipping the app's own routes.
-- =====================================================================

alter table public.portfolio_images
  add constraint portfolio_images_project_name_length check (char_length(project_name) <= 200),
  add constraint portfolio_images_project_type_length check (char_length(project_type) <= 100),
  add constraint portfolio_images_description_length check (char_length(description) <= 2000),
  add constraint portfolio_images_location_text_length check (char_length(location_text) <= 300);
