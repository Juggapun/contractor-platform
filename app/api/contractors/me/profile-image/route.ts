/**
 * Issue #23 — upload/replace the caller's own contractor profile image.
 * Not required at registration (that flow is optional and handled
 * inline by app/api/contractors/register/route.ts); this route is the
 * post-approval "replace it later" path the issue explicitly asks for.
 *
 * Authorization: requireContractorOwner() — same boundary as the
 * portfolio routes in this directory.
 *
 * Image Optimization follow-up: the validated upload is re-encoded by
 * generateProfileVariant() (src/lib/uploads/imageOptimization.ts)
 * before it ever reaches Storage — the raw upload is never persisted.
 */
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireContractorOwner } from '../../_lib/requireContractorOwner';
import { validateImageUpload } from '@/lib/uploads/imageValidation';
import { generateProfileVariant } from '@/lib/uploads/imageOptimization';
import {
  deleteContractorImageBestEffort,
  extractContractorMediaPath,
  generateContractorMediaPath,
  uploadContractorImage,
} from '@/lib/storage/contractorMedia';

export async function PUT(request: Request): Promise<NextResponse> {
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

  const validated = await validateImageUpload(file);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const variant = await generateProfileVariant(validated.bytes);
  if (!variant.ok) {
    return NextResponse.json({ ok: false, error: variant.error }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();

  const { data: existing, error: existingError } = await adminClient
    .from('contractors')
    .select('profile_image_url')
    .eq('id', auth.contractorId)
    .maybeSingle();
  if (existingError) {
    console.error('profile-image upload: existing lookup failed', existingError, { contractorId: auth.contractorId });
    return NextResponse.json({ ok: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }

  const path = generateContractorMediaPath(auth.contractorId, 'profile', variant.extension);
  let imageUrl: string;
  try {
    imageUrl = await uploadContractorImage(adminClient, path, variant.bytes, variant.contentType);
  } catch (err) {
    console.error('profile-image upload: storage upload failed', err, { contractorId: auth.contractorId });
    return NextResponse.json({ ok: false, error: 'อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }

  const { error: updateError } = await adminClient
    .from('contractors')
    .update({ profile_image_url: imageUrl })
    .eq('id', auth.contractorId);

  if (updateError) {
    console.error('profile-image upload: contractor update failed', updateError, { contractorId: auth.contractorId });
    return NextResponse.json({ ok: false, error: 'บันทึกรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }

  const oldPath = existing?.profile_image_url ? extractContractorMediaPath(existing.profile_image_url) : null;
  if (oldPath) {
    await deleteContractorImageBestEffort(adminClient, oldPath);
  }

  return NextResponse.json({ ok: true, profileImageUrl: imageUrl });
}
