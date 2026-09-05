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

/**
 * Home Page "เสียงจากผู้ใช้งานจริง" testimonials (Issue #42) — REAL
 * reviews only, never fabricated names/quotes. Deliberately still does
 * NOT surface reviewer identity (see this file's own header comment on
 * why that's an architectural choice, not an oversight here): a
 * homepage testimonial card shows the real rating/comment plus which
 * REAL contractor it's for, with a generic "ลูกค้าที่ใช้บริการจริง"
 * label instead of a person's name/avatar — there is no public data
 * source for a reviewer's name (`profiles` has no public-read policy
 * for other users), and adding one is exactly the RLS/authorization
 * change Issue #42's Scope Guard says not to make just for a homepage
 * section.
 *
 * Restricted to `rating >= 4`: a "what people say about us" showcase
 * conventionally highlights genuinely positive real feedback, the same
 * way any review site's homepage does — this does not hide or alter the
 * real overall rating average shown elsewhere (getHomeStats() uses
 * every active review, not just these), it only decides which of the
 * real reviews are worth featuring as a testimonial card.
 */
const FEATURED_REVIEWS_LIMIT = 4;
const FEATURED_REVIEW_MIN_RATING = 4;

export interface FeaturedReview {
  id: string;
  rating: number;
  comment: string | null;
  contractorBusinessName: string;
  contractorSlug: string;
}

interface RawFeaturedReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  contractors: { business_name: string; slug: string } | null;
}

export async function getFeaturedReviews(): Promise<FeaturedReview[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('reviews')
      .select('id, rating, comment, contractors!inner(business_name, slug)')
      .eq('status', 'active')
      .eq('contractors.status', 'approved')
      .gte('rating', FEATURED_REVIEW_MIN_RATING)
      .order('rating', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(FEATURED_REVIEWS_LIMIT);

    if (error) {
      console.error('getFeaturedReviews: query failed', error.message);
      return [];
    }

    // Same untyped-embed caveat as searchContractors()'s own mapRow —
    // `contractors!inner(...)` resolves to a single row, not an array,
    // but the generic client can't express that; cast once, here.
    const rows = (data ?? []) as unknown as RawFeaturedReviewRow[];
    return rows
      .filter((row): row is RawFeaturedReviewRow & { contractors: NonNullable<RawFeaturedReviewRow['contractors']> } =>
        Boolean(row.contractors)
      )
      .map((row) => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        contractorBusinessName: row.contractors.business_name,
        contractorSlug: row.contractors.slug,
      }));
  } catch (err) {
    console.error('getFeaturedReviews: Supabase not reachable/configured', err);
    return [];
  }
}
