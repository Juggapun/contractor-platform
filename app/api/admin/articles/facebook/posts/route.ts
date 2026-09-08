/**
 * Issue #44 — GET latest posts from our configured Facebook Page, for
 * the admin "ดึงโพสต์ล่าสุดจาก Facebook" preview list. Admin-only
 * (requireAdmin). Read-only: never writes anything — the actual import
 * happens at POST /api/admin/articles/facebook/import.
 */
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '../../../_lib/requireAdmin';
import { fetchLatestPagePosts, deriveTitleCandidate } from '@/lib/facebook/graphApi';

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const result = await fetchLatestPagePosts();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  // A plain bounded select + in-memory Set lookup rather than `.in()` —
  // this project's local-dev PostgREST shim only implements the `eq.`
  // filter operator generically (see supabase/local-dev/postgrest-shim.mjs),
  // and at most DEFAULT_POSTS_LIMIT (20) ids ever need checking here
  // anyway, so there's no real cost to keeping this simple rather than
  // adding a new operator to the shim for one call site.
  const adminClient = getSupabaseAdminClient();
  const { data: existingRows, error: existingError } = await adminClient
    .from('articles')
    .select('facebook_post_id')
    .not('facebook_post_id', 'is', null)
    .range(0, 199);
  if (existingError) {
    console.error('admin articles facebook posts: dedup lookup failed', existingError);
  }
  const alreadyImportedIds = new Set((existingRows ?? []).map((row) => row.facebook_post_id as string));

  const posts = result.posts.map((post) => ({
    id: post.id,
    createdTime: post.created_time,
    permalinkUrl: post.permalink_url,
    imageUrl: post.full_picture ?? null,
    titleCandidate: deriveTitleCandidate(post),
    alreadyImported: alreadyImportedIds.has(post.id),
  }));

  return NextResponse.json({ ok: true, posts });
}
