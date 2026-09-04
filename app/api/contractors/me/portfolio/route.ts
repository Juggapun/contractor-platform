/**
 * Issue #23 — add one portfolio image to the caller's own contractor
 * profile. One file per request (the client loops this call once per
 * selected file for a multi-image upload) — keeps this route simple and
 * avoids partial-batch-failure handling.
 *
 * Authorization: requireContractorOwner() (verified bearer token, real
 * contractor-row lookup) — never the client-asserted contractor id, and
 * this route never accepts one in the request body/query at all.
 *
 * The hard "never exceed 20" cap is enforced by
 * trg_portfolio_images_enforce_limit (0019_portfolio_image_limit.sql)
 * regardless of what happens here — the count check below is a
 * courtesy, giving a clear field error instead of a raw trigger
 * exception for the common case, not the actual security boundary.
 *
 * Image Optimization follow-up: the validated upload is never stored
 * as-is — generatePortfolioVariants() (src/lib/uploads/imageOptimization.ts)
 * re-encodes it into a small thumbnail (for grid/list views) and a
 * larger detail variant, and only those two re-encoded objects reach
 * Storage. `original_url` is deliberately left unset, same as before
 * this change — see that column's own migration comment.
 */
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireContractorOwner } from '../../_lib/requireContractorOwner';
import { validateImageUpload } from '@/lib/uploads/imageValidation';
import { generatePortfolioVariants } from '@/lib/uploads/imageOptimization';
import { generateContractorMediaPath, uploadContractorImage } from '@/lib/storage/contractorMedia';

const PORTFOLIO_IMAGE_LIMIT = 20;
const MAX_PROJECT_NAME_LENGTH = 200;

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireContractorOwner(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
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

  const projectNameRaw = formData.get('projectName');
  const projectName =
    typeof projectNameRaw === 'string' && projectNameRaw.trim()
      ? projectNameRaw.trim().slice(0, MAX_PROJECT_NAME_LENGTH)
      : null;

  const adminClient = getSupabaseAdminClient();

  const { count, error: countError } = await adminClient
    .from('portfolio_images')
    .select('id', { count: 'exact', head: true })
    .eq('contractor_id', auth.contractorId);
  if (countError) {
    console.error('portfolio upload: count check failed', countError, { contractorId: auth.contractorId });
    return NextResponse.json({ ok: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }
  if ((count ?? 0) >= PORTFOLIO_IMAGE_LIMIT) {
    return NextResponse.json(
      { ok: false, error: `ผลงานครบจำนวนสูงสุดแล้ว (${PORTFOLIO_IMAGE_LIMIT} รูป) กรุณาลบรูปเก่าก่อนเพิ่มรูปใหม่` },
      { status: 409 }
    );
  }

  const validated = await validateImageUpload(file);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const variants = await generatePortfolioVariants(validated.bytes);
  if (!variants.ok) {
    return NextResponse.json({ ok: false, error: variants.error }, { status: 400 });
  }

  let thumbnailUrl: string;
  let imageUrl: string;
  try {
    const thumbnailPath = generateContractorMediaPath(auth.contractorId, 'portfolio-thumbnail', variants.thumbnail.extension);
    thumbnailUrl = await uploadContractorImage(adminClient, thumbnailPath, variants.thumbnail.bytes, variants.thumbnail.contentType);
    const detailPath = generateContractorMediaPath(auth.contractorId, 'portfolio-detail', variants.detail.extension);
    imageUrl = await uploadContractorImage(adminClient, detailPath, variants.detail.bytes, variants.detail.contentType);
  } catch (err) {
    console.error('portfolio upload: storage upload failed', err, { contractorId: auth.contractorId });
    return NextResponse.json({ ok: false, error: 'อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await adminClient
    .from('portfolio_images')
    .insert({
      contractor_id: auth.contractorId,
      project_name: projectName,
      image_url: imageUrl,
      thumbnail_url: thumbnailUrl,
    })
    .select('id, project_name, image_url, thumbnail_url')
    .single();

  if (insertError || !inserted) {
    // The file already landed in Storage at this point — a failed row
    // insert leaves an orphaned object rather than a half-written DB
    // row referencing nothing. Disclosed, not silently pretended away
    // (same posture as the registration route's own known-limitation
    // comment for the equivalent auth-account-without-contractor-row
    // case).
    console.error('portfolio upload: row insert failed', insertError, { contractorId: auth.contractorId, imageUrl, thumbnailUrl });
    const message =
      insertError?.code === 'P0001'
        ? `ผลงานครบจำนวนสูงสุดแล้ว (${PORTFOLIO_IMAGE_LIMIT} รูป) กรุณาลบรูปเก่าก่อนเพิ่มรูปใหม่`
        : 'บันทึกรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
    const status = insertError?.code === 'P0001' ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }

  return NextResponse.json({ ok: true, image: inserted }, { status: 201 });
}
