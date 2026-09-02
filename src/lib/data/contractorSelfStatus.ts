/**
 * Phase 12 (Issue #10) fix: a contractor who registered (Phase 7) had no
 * way to check their application's status after the one-time success
 * message — confirmed via a real browser test that a logged-in pending
 * OR approved contractor saw nothing anywhere indicating their status or
 * linking to their own public profile once approved. Issue #10 requires
 * "pending, rejected, and suspended states are understandable" and that
 * "contractor registration communicates the approval process clearly" —
 * this closes that gap with a small, existing-data read, not a new
 * dashboard/feature.
 *
 * No RLS change needed: `contractors_select_approved_public`
 * (0013_rls_policies.sql) already lets a contractor read their OWN row
 * regardless of status (`user_id = auth.uid()`), unused by any UI until
 * now. Same anon-key-client, RLS-is-the-boundary posture as every other
 * public data read in this codebase — no service_role, no new policy.
 */
import { getSupabaseClient } from '../supabase/client';

export interface MyContractorApplication {
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  slug: string;
  businessName: string;
}

interface RawRow {
  status: MyContractorApplication['status'];
  slug: string;
  business_name: string;
}

export async function getMyContractorApplication(userId: string): Promise<MyContractorApplication | null> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('contractors')
      .select('status, slug, business_name')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as RawRow;
    return { status: row.status, slug: row.slug, businessName: row.business_name };
  } catch (err) {
    console.error('getMyContractorApplication: Supabase not reachable/configured', err);
    return null;
  }
}
