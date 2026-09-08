/**
 * Issue #42 (Articles) — edit/remove a single admin-managed article.
 * Admin-only (requireAdmin). PATCH only re-fetches the cover image when
 * the Facebook URL actually changed — editing just the title is a
 * simple field update, no reason to re-hit the network or re-optimize
 * an unchanged image.
 */
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '../../_lib/requireAdmin';
import { parseFacebookPostUrl } from '@/lib/articles/facebookUrl';
import { refreshArticleCoverImage } from '@/lib/articles/refreshArticleCoverImage';
import { deleteContractorImageBestEffort, extractContractorMediaPath } from '@/lib/storage/contractorMedia';

const ARTICLE_COLUMNS =
  'id, facebook_post_url, title, cover_image_url, cover_image_status, cover_image_error, created_at, updated_at';
const MAX_TITLE_LENGTH = 200;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
  const { facebookPostUrl, title } = (body ?? {}) as { facebookPostUrl?: unknown; title?: unknown };

  const adminClient = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await adminClient
    .from('articles')
    .select('id, facebook_post_url, cover_image_url')
    .eq('id', id)
    .maybeSingle();
  if (existingError || !existing) {
    return NextResponse.json({ ok: false, error: 'ไม่พบบทความนี้' }, { status: 404 });
  }

  const update: Record<string, string> = {};

  if (title !== undefined) {
    if (typeof title !== 'string') {
      return NextResponse.json({ ok: false, error: 'รูปแบบหัวข้อไม่ถูกต้อง' }, { status: 400 });
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return NextResponse.json({ ok: false, error: 'กรุณาระบุหัวข้อ' }, { status: 400 });
    }
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      return NextResponse.json({ ok: false, error: `หัวข้อยาวเกินไป (สูงสุด ${MAX_TITLE_LENGTH} ตัวอักษร)` }, { status: 400 });
    }
    update.title = trimmedTitle;
  }

  let newUrlNormalized: string | null = null;
  if (facebookPostUrl !== undefined) {
    if (typeof facebookPostUrl !== 'string') {
      return NextResponse.json({ ok: false, error: 'รูปแบบ URL ไม่ถูกต้อง' }, { status: 400 });
    }
    const parsedUrl = parseFacebookPostUrl(facebookPostUrl);
    if (!parsedUrl.ok) {
      return NextResponse.json({ ok: false, error: parsedUrl.error }, { status: 400 });
    }
    newUrlNormalized = parsedUrl.url.toString();
    update.facebook_post_url = newUrlNormalized;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'ไม่มีข้อมูลที่จะแก้ไข' }, { status: 400 });
  }

  const { error: updateError } = await adminClient.from('articles').update(update).eq('id', id);
  if (updateError) {
    console.error('admin articles update: failed', updateError);
    return NextResponse.json({ ok: false, error: 'ไม่สามารถแก้ไขบทความได้' }, { status: 500 });
  }

  // Only re-fetch the cover image when the URL actually changed to a
  // different value — an edit that only touches the title, or that
  // resubmits the same URL, must not re-hit the network or churn Storage.
  if (newUrlNormalized && newUrlNormalized !== existing.facebook_post_url) {
    await refreshArticleCoverImage(adminClient, id, newUrlNormalized, existing.cover_image_url);
  }

  // Comment 5584109190, point 2 — see the create route's identical comment.
  revalidatePath('/');

  const { data: finalRow, error: fetchError } = await adminClient
    .from('articles')
    .select(ARTICLE_COLUMNS)
    .eq('id', id)
    .single();
  if (fetchError || !finalRow) {
    console.error('admin articles update: re-fetch after update failed', fetchError);
    return NextResponse.json({ ok: false, error: 'ไม่สามารถโหลดข้อมูลที่แก้ไขแล้วได้' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, article: finalRow });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const adminClient = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await adminClient
    .from('articles')
    .select('id, cover_image_url')
    .eq('id', id)
    .maybeSingle();
  if (existingError || !existing) {
    return NextResponse.json({ ok: false, error: 'ไม่พบบทความนี้' }, { status: 404 });
  }

  const { error: deleteError } = await adminClient.from('articles').delete().eq('id', id);
  if (deleteError) {
    console.error('admin articles delete: failed', deleteError);
    return NextResponse.json({ ok: false, error: 'ไม่สามารถลบบทความได้' }, { status: 500 });
  }

  if (existing.cover_image_url) {
    const path = extractContractorMediaPath(existing.cover_image_url);
    if (path) await deleteContractorImageBestEffort(adminClient, path);
  }

  // Comment 5584109190, point 2 — see the create route's identical comment.
  revalidatePath('/');

  return NextResponse.json({ ok: true });
}
