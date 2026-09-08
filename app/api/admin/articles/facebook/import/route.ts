/**
 * Issue #44 — POST import a single post from our configured Facebook
 * Page into the `articles` table. Admin-only (requireAdmin). The only
 * client input is `postId` (which of our own Page's posts to import)
 * and an optional `title` override — everything else (permalink,
 * message/title candidate, image URL) is re-fetched fresh from Graph
 * API here, never trusted from whatever the client's preview list last
 * showed, so a stale/tampered preview can never smuggle in fabricated
 * article content.
 *
 * Dedup (Issue #44 point 7): re-importing a post whose `facebook_post_id`
 * already has a row UPDATEs that row (title, permalink, re-fetched
 * cover image) instead of inserting a second one — the partial unique
 * index on `articles.facebook_post_id` (0025 migration) is the actual
 * database-level backstop for this, this check is just what lets a
 * re-import behave as an update rather than erroring.
 */
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '../../../_lib/requireAdmin';
import { fetchPostById, deriveTitleCandidate } from '@/lib/facebook/graphApi';
import { importArticleCoverFromGraphApi } from '@/lib/facebook/importImage';
import { deleteContractorImageBestEffort, extractContractorMediaPath } from '@/lib/storage/contractorMedia';

const ARTICLE_COLUMNS =
  'id, facebook_post_url, facebook_post_id, title, cover_image_url, cover_image_status, cover_image_error, created_at, updated_at';
const MAX_TITLE_LENGTH = 200;

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
  const { postId, title: titleOverride } = (body ?? {}) as { postId?: unknown; title?: unknown };

  if (typeof postId !== 'string' || !postId.trim()) {
    return NextResponse.json({ ok: false, error: 'กรุณาระบุโพสต์ที่ต้องการนำเข้า' }, { status: 400 });
  }
  if (titleOverride !== undefined && typeof titleOverride !== 'string') {
    return NextResponse.json({ ok: false, error: 'รูปแบบหัวข้อไม่ถูกต้อง' }, { status: 400 });
  }
  if (typeof titleOverride === 'string' && titleOverride.trim().length > MAX_TITLE_LENGTH) {
    return NextResponse.json({ ok: false, error: `หัวข้อยาวเกินไป (สูงสุด ${MAX_TITLE_LENGTH} ตัวอักษร)` }, { status: 400 });
  }

  const postResult = await fetchPostById(postId.trim());
  if (!postResult.ok) {
    return NextResponse.json({ ok: false, error: postResult.error }, { status: 502 });
  }
  const post = postResult.post;
  const title = typeof titleOverride === 'string' && titleOverride.trim() ? titleOverride.trim() : deriveTitleCandidate(post);

  const adminClient = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await adminClient
    .from('articles')
    .select('id, cover_image_url')
    .eq('facebook_post_id', post.id)
    .maybeSingle();
  if (existingError) {
    console.error('admin articles facebook import: dedup lookup failed', existingError);
    return NextResponse.json({ ok: false, error: 'ไม่สามารถตรวจสอบโพสต์ที่นำเข้าไปแล้วได้' }, { status: 500 });
  }

  let articleId: string;
  let previousCoverImageUrl: string | null = null;

  if (existing) {
    articleId = existing.id;
    previousCoverImageUrl = existing.cover_image_url;
    const { error: updateError } = await adminClient
      .from('articles')
      .update({ title, facebook_post_url: post.permalink_url })
      .eq('id', articleId);
    if (updateError) {
      console.error('admin articles facebook import: update failed', updateError);
      return NextResponse.json({ ok: false, error: 'ไม่สามารถอัปเดตบทความได้' }, { status: 500 });
    }
  } else {
    const { data: inserted, error: insertError } = await adminClient
      .from('articles')
      .insert({
        facebook_post_url: post.permalink_url,
        facebook_post_id: post.id,
        title,
        created_by: auth.adminId,
        cover_image_status: 'pending',
      })
      .select('id')
      .single();
    if (insertError || !inserted) {
      console.error('admin articles facebook import: insert failed', insertError);
      return NextResponse.json({ ok: false, error: 'ไม่สามารถเพิ่มบทความได้' }, { status: 500 });
    }
    articleId = inserted.id;
  }

  const imageOutcome = await importArticleCoverFromGraphApi(adminClient, post.full_picture);
  if (imageOutcome.status === 'success') {
    const { error: successUpdateError } = await adminClient
      .from('articles')
      .update({ cover_image_status: 'success', cover_image_error: null, cover_image_url: imageOutcome.publicUrl })
      .eq('id', articleId);
    if (successUpdateError) {
      console.error('admin articles facebook import: success status update failed', successUpdateError);
    }
    if (previousCoverImageUrl) {
      const oldPath = extractContractorMediaPath(previousCoverImageUrl);
      if (oldPath) await deleteContractorImageBestEffort(adminClient, oldPath);
    }
  } else {
    const errorMessage = imageOutcome.status === 'no-image' ? 'โพสต์นี้ไม่มีรูปภาพ' : imageOutcome.error;
    const { error: failUpdateError } = await adminClient
      .from('articles')
      .update({ cover_image_status: 'failed', cover_image_error: errorMessage, cover_image_url: null })
      .eq('id', articleId);
    if (failUpdateError) {
      console.error('admin articles facebook import: failure status update failed', failUpdateError);
    }
  }

  // Issue #44 point 8 — invalidate Home immediately, same as the manual
  // CRUD routes (see app/api/admin/articles/route.ts's identical comment).
  revalidatePath('/');

  const { data: finalRow, error: fetchError } = await adminClient
    .from('articles')
    .select(ARTICLE_COLUMNS)
    .eq('id', articleId)
    .single();
  if (fetchError || !finalRow) {
    console.error('admin articles facebook import: re-fetch after import failed', fetchError);
    return NextResponse.json({ ok: true, article: { id: articleId, title, facebook_post_url: post.permalink_url } });
  }
  return NextResponse.json({ ok: true, article: finalRow });
}
