/**
 * Phase 8 — admin approval queue listing. Admin-only (requireAdmin);
 * see app/api/admin/_lib/requireAdmin.ts for what "admin-only" actually
 * enforces here. Reads via the service_role admin client — safe because
 * every caller already passed requireAdmin's independent verification,
 * not because this route trusts RLS to filter for it.
 */
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '../_lib/requireAdmin';
import { mapAdminContractorRow } from '../_lib/mapContractorRow';

const ALLOWED_STATUSES = new Set(['pending', 'approved', 'rejected', 'suspended']);

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status') ?? 'pending';
  if (!ALLOWED_STATUSES.has(statusParam)) {
    return NextResponse.json({ ok: false, error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();
  const { data, error } = await adminClient
    .from('contractors')
    .select(
      `id, user_id, business_name, slug, description, phone, line_id, facebook_url, website_url,
       address, years_experience, status, verification_status, created_at, profile_image_url,
       provinces(id,name_th,slug),
       districts(id,name_th,slug),
       contractor_categories(categories(id,name_th,slug))`
    )
    .eq('status', statusParam)
    .order('created_at', { ascending: true })
    // Bounded, not unbounded — matches this project's established
    // convention (see src/lib/data/contractors.ts's page-size fixed
    // limit). 200 is a generous cap for a review queue; if the pending
    // backlog ever legitimately exceeds that, this route needs real
    // pagination, not a silent truncation — flagged as a limitation in
    // docs/PHASE8-ADMIN-APPROVAL-REPORT.md rather than built here.
    .range(0, 199);

  if (error) {
    console.error('admin contractors list: query failed', error);
    return NextResponse.json({ ok: false, error: 'ไม่สามารถโหลดรายการได้' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, contractors: (data ?? []).map(mapAdminContractorRow) });
}
