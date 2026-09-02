/**
 * Phase 8 — admin detail view for one contractor application, any
 * status (unlike the public profile route, which only ever resolves
 * `status = 'approved'` — see app/contractors/[slug]/page.tsx). Admin-
 * only; see app/api/admin/_lib/requireAdmin.ts.
 */
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '../../_lib/requireAdmin';
import { mapAdminContractorRow } from '../../_lib/mapContractorRow';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const adminClient = getSupabaseAdminClient();
  const { data, error } = await adminClient
    .from('contractors')
    .select(
      `id, user_id, business_name, slug, description, phone, line_id, facebook_url, website_url,
       address, years_experience, status, verification_status, created_at,
       provinces(id,name_th,slug),
       districts(id,name_th,slug),
       contractor_categories(categories(id,name_th,slug))`
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('admin contractor detail: query failed', error);
    return NextResponse.json({ ok: false, error: 'ไม่สามารถโหลดข้อมูลได้' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'ไม่พบใบสมัครนี้' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, contractor: mapAdminContractorRow(data) });
}
