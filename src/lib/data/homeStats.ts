/**
 * Home Page stats banner (Issue #42) — real, live-queried counts only.
 * The Master Design Reference shows a stat banner with specific numbers
 * (e.g. "5,000+" contractors); this issue explicitly forbids inventing
 * contractor counts/ratings/review counts, so every number here comes
 * straight from the anon-key client, the same client/RLS boundary every
 * other public data-access function in this codebase already uses:
 *   - `portfolio_images_select` / `reviews_select_active_or_own`
 *     (0013_rls_policies.sql, the latter tightened by
 *     0014_reviews_hardening.sql) already restrict an anon read of
 *     those tables to rows belonging to a currently-approved
 *     contractor — no extra join/filter is needed here for that reason.
 *
 * The approved-contractor COUNT itself is deliberately NOT queried
 * again here — app/page.tsx already calls searchContractors({page:1})
 * for the "ช่างแนะนำ" section and that result's own `totalCount` (a
 * real `{ count: 'exact' }` query against `contractors`,
 * `status='approved'`) is reused directly, avoiding a second identical
 * count query against the same table.
 *
 * In a small/early dataset (as of writing: a handful of contractors, a
 * single review) these numbers will look modest rather than impressive
 * — that's the honest, correct behavior. `averageRating`/`reviewCount`
 * are returned together specifically so a caller can show the sample
 * size alongside the average (e.g. "5.0/5 (1 รีวิว)") rather than
 * presenting a single-review average as if it were a robust statistic.
 */
import { getSupabaseClient } from '../supabase/client';

export interface HomeStats {
  portfolioImageCount: number;
  reviewCount: number;
  averageRating: number | null;
}

const EMPTY_STATS: HomeStats = {
  portfolioImageCount: 0,
  reviewCount: 0,
  averageRating: null,
};

export async function getHomeStats(): Promise<HomeStats> {
  try {
    const client = getSupabaseClient();

    const [portfolioRes, reviewsRes] = await Promise.all([
      client.from('portfolio_images').select('id', { count: 'exact', head: true }),
      client.from('reviews').select('rating').eq('status', 'active'),
    ]);

    if (portfolioRes.error || reviewsRes.error) {
      console.error('getHomeStats: query failed', portfolioRes.error?.message, reviewsRes.error?.message);
      return EMPTY_STATS;
    }

    const ratings = (reviewsRes.data ?? []).map((r) => Number((r as { rating: number }).rating));
    const reviewCount = ratings.length;
    const averageRating =
      reviewCount > 0 ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / reviewCount) * 10) / 10 : null;

    return {
      portfolioImageCount: portfolioRes.count ?? 0,
      reviewCount,
      averageRating,
    };
  } catch (err) {
    console.error('getHomeStats: Supabase not reachable/configured', err);
    return EMPTY_STATS;
  }
}
