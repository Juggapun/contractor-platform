/**
/**
 * Read-only review list for the contractor profile page (Phase 6). Reads
 * public.reviews (0007_reviews.sql) through the anon-key client — RLS's
 * `reviews_select_active_or_own` policy (0013_rls_policies.sql, tightened
 * by supabase/migrations/0014_reviews_hardening.sql to also require the
 * parent contractor to be currently approved) already restricts
 * anonymous reads to `status = 'active'` on an approved contractor; the
 * explicit `.eq('status', 'active')` here is the same defense-in-depth/
 * index-usage choice as elsewhere (matches idx_reviews_contractor_status),
 * not the enforcement boundary.
 *
 * Deliberately does NOT join reviews.reviewer_id -> profiles — a
 * profile page has no business surfacing a reviewer's identity, and
 * profiles has no public-read RLS policy for other users anyway
 * (profiles_select_own is the only SELECT policy). Reviews render
 * anonymously (rating + comment + date only), which is both the
 * privacy-correct choice and the only one RLS would actually allow.
 *
 * Bounded to a fixed count — never an unbounded fetch, matching the
 * same posture as Phase 5's search pagination. Review SUBMISSION is
 * Phase 9's src/lib/data/reviewSubmission.ts + src/components/ReviewForm.tsx
 * — a separate module, since writing and reading go through different
 * RLS policies and have no code in common. No review-pagination UI
 * exists here (out of Phase 9's scope, undescribed by Issue #7).
 */
import { getSupabaseClient } from '../supabase/client';

const REVIEWS_LIMIT = 20;

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export async function getReviews(contractorId: string): Promise<Review[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('reviews')
      .select('id, rating, comment, created_at')
      .eq('contractor_id', contractorId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(REVIEWS_LIMIT);

    if (error) {
      console.error('getReviews: query failed', error.message);
      return [];
    }
    return (data as Review[]) ?? [];
  } catch (err) {
    console.error('getReviews: Supabase not reachable/configured', err);
    return [];
  }
}
