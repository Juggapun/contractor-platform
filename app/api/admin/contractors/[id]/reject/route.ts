/**
 * Phase 8 — reject a pending contractor application, with a reason
 * required for accountability ("appropriate status/reason", Issue #6).
 * The reason is stored in admin_actions.notes (audit log, see
 * 0010_admin_actions.sql) — no schema change was needed for this: that
 * column already exists for exactly this purpose. Admin-only; only ever
 * transitions pending -> rejected (see approve/route.ts's header comment
 * for why other-state transitions are out of scope here).
 */
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '../../../_lib/requireAdmin';
import { decideContractor } from '../../../_lib/decideContractor';

const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 1000;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
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
  const reason = typeof (body as Record<string, unknown>)?.reason === 'string' ? (body as { reason: string }).reason.trim() : '';
  if (reason.length < MIN_REASON_LENGTH || reason.length > MAX_REASON_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `กรุณาระบุเหตุผลการปฏิเสธ (${MIN_REASON_LENGTH}-${MAX_REASON_LENGTH} ตัวอักษร)` },
      { status: 400 }
    );
  }

  const { id } = await context.params;
  const adminClient = getSupabaseAdminClient();
  const result = await decideContractor(adminClient, id, 'rejected', auth.adminId, 'reject_contractor', reason);

  switch (result.outcome) {
    case 'ok':
      return NextResponse.json({ ok: true, businessName: result.businessName, slug: result.slug, status: result.status });
    case 'not_found':
      return NextResponse.json({ ok: false, error: 'ไม่พบใบสมัครนี้' }, { status: 404 });
    case 'conflict':
      return NextResponse.json(
        { ok: false, error: `ใบสมัครนี้ถูกตัดสินใจไปแล้ว (สถานะปัจจุบัน: ${result.currentStatus})` },
        { status: 409 }
      );
    case 'error':
      console.error('reject contractor: failed', result.message, { id, adminId: auth.adminId });
      return NextResponse.json({ ok: false, error: 'ไม่สามารถปฏิเสธได้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }
}
