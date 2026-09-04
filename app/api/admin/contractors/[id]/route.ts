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
 *
 * Issue #25 — also returns `profile_image_url` (now selected — it
 * wasn't before, which was the actual bug: an applicant's uploaded
 * images existed in Storage/DB the whole time, an admin just had no
 * way to see them before deciding) and every portfolio_images row for
 * this contractor, via the same service_role client already used for
 * everything else on this route. This is intentionally the SAME
 * authorization boundary as the rest of this route (requireAdmin() —
 * verified above, before any of this runs) — not a new one — so a
 * pending/rejected/suspended applicant's images are visible here for
 * exactly the same reason their name/phone/description already are,
 * and for no wider audience: this JSON only ever reaches an admin's
 * own authenticated fetch (src/lib/data/adminContractors.ts), never
 * the public profile/search path (app/contractors/[slug]/page.tsx,
 * src/lib/data/contractors.ts), which is untouched by this change.
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
       profile_image_url,
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

  // Issue #25: every portfolio image this applicant has submitted,
  // regardless of the parent contractor's status — this route already
  // serves pending/rejected/suspended applicants' data to the admin
  // (unlike the public profile route), so the same boundary applies
  // here. Non-fatal on failure, same posture as the contact_events
  // tally below: an admin must never be blocked from approving/
  // rejecting by a secondary query failing.
  let portfolioImages: Array<{ id: string; imageUrl: string; thumbnailUrl: string; projectName: string | null }> = [];
  const { data: portfolioRows, error: portfolioError } = await adminClient
    .from('portfolio_images')
    .select('id, image_url, thumbnail_url, project_name')
    .eq('contractor_id', id)
    .order('sort_order', { ascending: true });
  if (portfolioError) {
    console.error('admin contractor detail: portfolio_images query failed', portfolioError);
  } else {
    portfolioImages = (portfolioRows ?? []).map((row) => ({
      id: row.id as string,
      imageUrl: row.image_url as string,
      thumbnailUrl: row.thumbnail_url as string,
      projectName: row.project_name as string | null,
    }));
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
    portfolioImages,
  });
}
