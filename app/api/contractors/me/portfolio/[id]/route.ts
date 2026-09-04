/**
 * Issue #23 — delete one of the caller's own portfolio images.
 *
 * Authorization: requireContractorOwner() resolves the caller's OWN
 * contractor id server-side; the row being deleted is looked up and
 * matched against THAT id, never against anything the client claims —
 * a contractor cannot delete another contractor's image by guessing/
 * passing a different id in the URL, because the DELETE below is
 * scoped `.eq('contractor_id', auth.contractorId)` in addition to
 * `.eq('id', imageId)`. This is the app-layer half of the boundary;
 * RLS's portfolio_images_owner_write policy (0013_rls_policies.sql)
 * would reject a cross-owner delete even if this route had a bug, since
 * this still runs as service_role — the real enforcement for a direct
 * REST attempt bypassing this route entirely is RLS, verified directly
 * (not assumed) during this issue's testing.
 */
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireContractorOwner } from '../../../_lib/requireContractorOwner';
import { deleteContractorImageBestEffort, extractContractorMediaPath } from '@/lib/storage/contractorMedia';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireContractorOwner(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const adminClient = getSupabaseAdminClient();

  const { data: deleted, error } = await adminClient
    .from('portfolio_images')
    .delete()
    .eq('id', id)
    .eq('contractor_id', auth.contractorId)
    .select('image_url')
    .maybeSingle();

  if (error) {
    console.error('portfolio delete: failed', error, { id, contractorId: auth.contractorId });
    return NextResponse.json({ ok: false, error: 'ลบรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }
  if (!deleted) {
    return NextResponse.json({ ok: false, error: 'ไม่พบรูปภาพนี้ หรือคุณไม่มีสิทธิ์ลบรูปนี้' }, { status: 404 });
  }

  const path = extractContractorMediaPath(deleted.image_url as string);
  if (path) {
    await deleteContractorImageBestEffort(adminClient, path);
  }

  return NextResponse.json({ ok: true });
}
