/**
 * Phase 8 — admin detail view for one contractor application, any
 * status (unlike the public profile route, which only ever resolves
 * `status = 'approved'` — see app/contractors/[slug]/page.tsx). Admin-
 * only; see app/api/admin/_lib/requireAdmin.ts.
 *
 * Phase 10: also returns `profile_view_count` (denormalized column,
 * 0016_contact_events_analytics.sql) and a per-event_type tally of
 * contact_events, so the admin detail page can show basic usage
 * analytics. Deliberately minimal per Issue #8 — a tally, not a
 * dashboard: no new page/route, no time-series, no admin-wide listing.
 */
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '../../_lib/requireAdmin';
import { mapAdminContractorRow } from '../../_lib/mapContractorRow';
import type { ContactEventType } from '@/lib/data/contactEvents';

type ContactEventTally = Record<ContactEventType, number>;

function emptyTally(): ContactEventTally {
  return { phone: 0, line: 0, facebook: 0, website: 0, profile_view: 0 };
}

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
       address, years_experience, status, verification_status, created_at, profile_view_count,
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

  const contactEventsTally = emptyTally();
  const { data: eventRows, error: eventsError } = await adminClient
    .from('contact_events')
    .select('event_type')
    .eq('contractor_id', id);

  if (eventsError) {
    // Non-fatal: the contractor detail itself loaded fine. The analytics
    // section degrades to all-zero counts rather than failing the whole
    // page — an admin reviewing/approving an application must never be
    // blocked by a usage-stats query.
    console.error('admin contractor detail: contact_events tally failed', eventsError);
  } else {
    for (const row of eventRows ?? []) {
      const eventType = row.event_type as ContactEventType;
      if (eventType in contactEventsTally) {
        contactEventsTally[eventType] += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    contractor: mapAdminContractorRow(data),
    profileViewCount: data.profile_view_count as number,
    contactEventsTally,
  });
}
