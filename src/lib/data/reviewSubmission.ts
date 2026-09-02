/**
 * Review submission for approved contractor profiles (Phase 9). Unlike
 * Phase 7/8's Route Handlers, this never needs service_role: nothing
 * here is a privileged operation. A normal authenticated user inserting
 * their own review is exactly what RLS's `reviews_insert_authenticated`
 * policy (0013_rls_policies.sql, tightened by
 * supabase/migrations/0014_reviews_hardening.sql) already fully
 * authorizes — the database itself is the "server/database-side"
 * enforcement Issue #7 asks for, not an intermediary API layer. This
 * calls the anon-key client directly, using the browser's own
 * authenticated session (see src/lib/supabase/client.ts).
 *
 * `reviewer_id` is always derived fresh from `client.auth.getUser()` —
 * never accepted as a parameter — so there is no code path here that
 * could even be tempted to trust a caller-supplied identity. RLS would
 * reject a mismatch regardless (`auth.uid() = reviewer_id`), but
 * deriving it this way means there is nothing to mismatch in the first
 * place.
 */
import { getSupabaseClient } from '../supabase/client';

export type SubmitReviewResult =
  | { ok: true }
  | { ok: false; reason: 'unauthenticated' | 'duplicate' | 'not_eligible' | 'invalid' | 'error'; message: string };

export async function submitReview(
  contractorId: string,
  rating: number,
  comment: string
): Promise<SubmitReviewResult> {
  const client = getSupabaseClient();

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, reason: 'unauthenticated', message: 'กรุณาเข้าสู่ระบบก่อนเขียนรีวิว' };
  }

  const { error } = await client.from('reviews').insert({
    contractor_id: contractorId,
    reviewer_id: userData.user.id,
    rating,
    comment: comment.trim(),
  });

  if (!error) {
    return { ok: true };
  }

  // Postgres error codes, surfaced by the shim/PostgREST in the
  // response body's `code` field — see supabase/local-dev/postgrest-shim.mjs's
  // POST /rest/v1/reviews handler for exactly how these get there.
  switch (error.code) {
    case '23505': // unique_violation — reviews_contractor_id_reviewer_id_key
      return { ok: false, reason: 'duplicate', message: 'คุณได้รีวิวผู้รับเหมารายนี้ไปแล้ว' };
    case '42501': // insufficient_privilege — RLS WITH CHECK failed
      return {
        ok: false,
        reason: 'not_eligible',
        message: 'ไม่สามารถรีวิวผู้รับเหมารายนี้ได้ในขณะนี้',
      };
    case '23514': // check_violation — rating out of range or comment too long
      return { ok: false, reason: 'invalid', message: 'ข้อมูลรีวิวไม่ถูกต้อง กรุณาตรวจสอบคะแนนและความคิดเห็น' };
    default:
      return { ok: false, reason: 'error', message: error.message || 'ส่งรีวิวไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
  }
}

export interface MyReview {
  id: string;
  rating: number;
  comment: string | null;
  status: 'active' | 'flagged' | 'removed';
  created_at: string;
}

/** For UX gating only (show "already reviewed" instead of the form) —
 * RLS's `reviewer_id = auth.uid()` clause lets a signed-in user read
 * their own review regardless of status, exactly like every write
 * boundary here: real enforcement, not a hidden control. */
export async function getMyReviewForContractor(contractorId: string): Promise<MyReview | null> {
  try {
    const client = getSupabaseClient();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return null;

    const { data, error } = await client
      .from('reviews')
      .select('id, rating, comment, status, created_at')
      .eq('contractor_id', contractorId)
      .eq('reviewer_id', userData.user.id)
      .maybeSingle();

    if (error || !data) return null;
    return data as MyReview;
  } catch (err) {
    console.error('getMyReviewForContractor: Supabase not reachable/configured', err);
    return null;
  }
}
