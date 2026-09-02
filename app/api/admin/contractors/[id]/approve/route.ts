/**
 * Phase 8 — approve a pending contractor application. Admin-only (see
 * app/api/admin/_lib/requireAdmin.ts). Only ever transitions
 * pending -> approved; approving a contractor in any other state is
 * rejected as a conflict rather than silently allowed (see Issue #6:
 * "Handle duplicate submissions, invalid states, missing records, and
 * concurrent decisions safely" — un-suspending or re-approving a
 * previously-rejected contractor is a different, undescribed workflow,
 * deliberately not built here).
 */
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '../../../_lib/requireAdmin';
import { decideContractor } from '../../../_lib/decideContractor';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const adminClient = getSupabaseAdminClient();
  const result = await decideContractor(adminClient, id, 'approved', auth.adminId, 'approve_contractor', null);

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
      console.error('approve contractor: failed', result.message, { id, adminId: auth.adminId });
      return NextResponse.json({ ok: false, error: 'ไม่สามารถอนุมัติได้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }
}
