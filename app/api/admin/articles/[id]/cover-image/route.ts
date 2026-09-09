/**
 * Issue #45 — Owner Decision: replace automated Facebook image fetching
 * (both the old HTML/og:image scraper from Issue #42 and the Graph API
 * importer from Issue #44, comment 5599969267: "ตอนนี้ Articles ใช้วิธี
 * Admin อัปโหลดรูปเอง... ห้ามเริ่มงาน Facebook Automation... จนกว่า Owner
 * จะสั่งให้กลับมาทำ") with a plain manual upload, mirroring the exact
 * same authorization/validation/storage pattern already used for
 * contractor profile images (app/api/contractors/me/profile-image/route.ts) —
 * admin-only here instead of contractor-owner, and updates `articles`
 * instead of `contractors`, but otherwise the same shape: validate ->
 * optimize (ARTICLE_COVER_SPEC's fixed 1200x1200 square crop, see
 * imageOptimization.ts) -> upload -> update the row -> best-effort
 * delete of whatever image this one replaces.
 */
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '../../../_lib/requireAdmin';
import { validateImageUpload } from '@/lib/uploads/imageValidation';
import { generateArticleCoverVariant } from '@/lib/uploads/imageOptimization';
import {
  deleteContractorImageBestEffort,
  extractContractorMediaPath,
  generateArticleCoverPath,
  uploadContractorImage,
} from '@/lib/storage/contractorMedia';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  const file = formData.get('image');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'กรุณาเลือกไฟล์รูปภาพ' }, { status: 400 });
  }

  const validated = await validateImageUpload(file);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const variant = await generateArticleCoverVariant(validated.bytes);
  if (!variant.ok) {
    return NextResponse.json({ ok: false, error: variant.error }, { status: 400 });
  }

  const path = generateArticleCoverPath(variant.extension);
  let imageUrl: string;
  try {
    imageUrl = await uploadContractorImage(adminClient, path, variant.bytes, variant.contentType);
  } catch (err) {
    console.error('admin article cover-image upload: storage upload failed', err, { articleId: id });
    return NextResponse.json({ ok: false, error: 'อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }

  const { error: updateError } = await adminClient
    .from('articles')
    .update({ cover_image_url: imageUrl, cover_image_status: 'success', cover_image_error: null })
    .eq('id', id);
  if (updateError) {
    console.error('admin article cover-image upload: article update failed', updateError, { articleId: id });
    return NextResponse.json({ ok: false, error: 'บันทึกรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }

  const oldPath = existing.cover_image_url ? extractContractorMediaPath(existing.cover_image_url) : null;
  if (oldPath) {
    await deleteContractorImageBestEffort(adminClient, oldPath);
  }

  // Same immediate-visibility requirement as every other article
  // mutation (Issue #42 comment 5584109190, point 2) — see the manual
  // create/edit routes' identical comment.
  revalidatePath('/');

  return NextResponse.json({ ok: true, coverImageUrl: imageUrl });
}
