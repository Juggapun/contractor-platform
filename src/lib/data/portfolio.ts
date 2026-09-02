/**
 * Read-only portfolio gallery for the Phase 6 profile page. Reads
 * public.portfolio_images (0006_portfolio_images.sql) through the
 * anon-key client — RLS's `portfolio_images_select` policy
 * (0013_rls_policies.sql) is what actually restricts this to images
 * belonging to an approved contractor (or the owner/admin, neither of
 * which applies to this anonymous public-page read). Explicit columns
 * only; `original_url` is deliberately never selected here — the
 * migration's own comment says it's "kept for future use, never served
 * directly to users."
 *
 * This is Phase 6 (display existing portfolio data), not Phase 8
 * (upload/manage portfolio) — there is no write path here at all. An
 * empty result is a normal, expected state (no contractor has uploaded
 * portfolio images yet in this environment) and the profile page must
 * render a clean empty state for it, never invented images.
 */
import { getSupabaseClient } from '../supabase/client';

export interface PortfolioImage {
  id: string;
  project_name: string | null;
  project_type: string | null;
  description: string | null;
  image_url: string;
  thumbnail_url: string;
}

export async function getPortfolioImages(contractorId: string): Promise<PortfolioImage[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('portfolio_images')
      .select('id, project_name, project_type, description, image_url, thumbnail_url')
      .eq('contractor_id', contractorId)
      .order('sort_order', { ascending: true });

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
