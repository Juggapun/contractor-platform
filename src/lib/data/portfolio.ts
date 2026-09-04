/**
 * Read-only portfolio gallery for the Phase 6 profile page (also reused
 * by the Issue #23 self-service manage page). Reads
 * public.portfolio_images (0006_portfolio_images.sql) through the
 * anon-key client — RLS's `portfolio_images_select` policy
 * (0013_rls_policies.sql) is what actually restricts this to images
 * belonging to an approved contractor (or the owner/admin, neither of
 * which applies to this anonymous public-page read). Explicit columns
 * only; `original_url` is deliberately never selected here — the
 * migration's own comment says it's "kept for future use, never served
 * directly to users."
 *
 * Issue #28 — `project_type` and `description` used to be selected here
 * too, even though no consumer of this function (this file's own two
 * callers: this profile page and ContractorManagePanel.tsx) ever reads
 * either field — grep-confirmed. That mattered because, unlike
 * `project_name` (capped at 200 chars server-side by the one route that
 * ever sets it, app/api/contractors/me/portfolio/route.ts),
 * `project_type`/`description` were, until 0020_portfolio_images_text_
 * length_caps.sql, unconstrained `text` columns writable directly via
 * PostgREST by any contractor with a valid bearer token for their own
 * rows (portfolio_images_owner_write, 0013_rls_policies.sql — ownership
 * is checked, column values are not) — bypassing the app's own routes
 * and their conventions entirely. A single oversized value in either
 * column would have been returned in full by this query for every
 * caller, public profile page included. Fixed at two layers: the DB
 * migration now caps every text column's length regardless of how a
 * row gets written, and this SELECT no longer asks for columns nothing
 * renders, so neither is fetched at all even if something upstream ever
 * changes.
 *
 * This is Phase 6 (display existing portfolio data), not Phase 8
 * (upload/manage portfolio) — there is no write path here at all. An
 * empty result is a normal, expected state (no contractor has uploaded
 * portfolio images yet in this environment) and the profile page must
 * render a clean empty state for it, never invented images.
 */
import { getSupabaseClient } from '../supabase/client';

/** Hard ceiling on the query itself, not just a UI assumption — matches
 * the DB-enforced maximum (trg_portfolio_images_enforce_limit,
 * 0019_portfolio_image_limit.sql) so this read can never return more
 * rows than any contractor could ever legitimately have, regardless of
 * what future code paths might do. */
const PORTFOLIO_IMAGE_LIMIT = 20;

export interface PortfolioImage {
  id: string;
  project_name: string | null;
  image_url: string;
  thumbnail_url: string;
}

export async function getPortfolioImages(contractorId: string): Promise<PortfolioImage[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('portfolio_images')
      .select('id, project_name, image_url, thumbnail_url')
      .eq('contractor_id', contractorId)
      .order('sort_order', { ascending: true })
      .limit(PORTFOLIO_IMAGE_LIMIT);

    if (error) {
      console.error('getPortfolioImages: query failed', error.message);
      return [];
    }
    return (data as PortfolioImage[]) ?? [];
  } catch (err) {
    console.error('getPortfolioImages: Supabase not reachable/configured', err);
    return [];
  }
}
