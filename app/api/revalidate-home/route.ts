/**
 * Issue #42, Layer B round 4 (Testimonials — comment 5572081474, point
 * 4): the Home page has `export const revalidate = 3600` (Issue #11's
 * ISR staleness fix), which is the right tradeoff for the page as a
 * whole but meant a newly submitted, newly eligible review could sit
 * invisible in Testimonials for up to an hour — the Owner reported
 * exactly this after submitting a real review.
 *
 * `submitReview()` (reviewSubmission.ts) runs entirely client-side
 * (the browser's own authenticated session inserts directly, RLS is
 * the real enforcement — see that file's own header comment for why
 * there's deliberately no server route in the write path itself), so
 * it has no way to call `revalidatePath` itself. This route is that:
 * a plain POST that busts the Home page's cached render so the next
 * request rebuilds it, called by ReviewForm.tsx right after a
 * successful submission.
 *
 * Deliberately unauthenticated and narrow, matching this codebase's
 * `/api/health` precedent for small public utility routes: busting a
 * public page's render cache isn't a privileged action (it can't read
 * or change any data — `revalidatePath` only marks the cache stale),
 * so no auth/RLS concern applies here.
 */
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST() {
  revalidatePath('/');
  return NextResponse.json({ revalidated: true });
}
