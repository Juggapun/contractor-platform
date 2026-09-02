/**
 * Shared approve/reject logic (app/api/admin/contractors/[id]/{approve,reject}/route.ts).
 *
 * Concurrency: the UPDATE is conditional on the row still being
 * `status = 'pending'` (`.eq('status', 'pending')` below), so two
 * simultaneous decisions on the same application can't both succeed —
 * whichever request's UPDATE commits first changes the row; the second
 * matches zero rows and this returns `conflict: true` instead of
 * silently double-applying or clobbering the first decision. This also
 * naturally covers "decide on an already-decided/rejected/suspended
 * contractor" and "decide on a missing id" the same way: a 404 check
 * runs first only to give a clearer error message, but the UPDATE
 * itself is what's actually safe against races even if that check were
 * skipped or stale by the time the UPDATE runs.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type DecideResult =
  | { outcome: 'ok'; businessName: string; slug: string; status: string }
  | { outcome: 'not_found' }
  | { outcome: 'conflict'; currentStatus: string }
  | { outcome: 'error'; message: string };

export async function decideContractor(
  adminClient: SupabaseClient,
  contractorId: string,
  targetStatus: 'approved' | 'rejected',
  adminId: string,
  action: 'approve_contractor' | 'reject_contractor',
  notes: string | null
): Promise<DecideResult> {
  const { data: existing, error: fetchError } = await adminClient
    .from('contractors')
    .select('id, status')
    .eq('id', contractorId)
    .maybeSingle();

  if (fetchError) {
    return { outcome: 'error', message: fetchError.message };
  }
  if (!existing) {
    return { outcome: 'not_found' };
  }
  if (existing.status !== 'pending') {
    return { outcome: 'conflict', currentStatus: existing.status };
  }

  const { data: updated, error: updateError } = await adminClient
    .from('contractors')
    .update({ status: targetStatus })
    .eq('id', contractorId)
    .eq('status', 'pending')
    .select('id, business_name, slug, status')
    .single();

  if (updateError || !updated) {
    // Lost the race between the pre-check above and this UPDATE — some
    // other request already decided it in between. Re-check to report
    // an accurate current status rather than a generic error.
    const { data: nowRow } = await adminClient.from('contractors').select('status').eq('id', contractorId).maybeSingle();
    return { outcome: 'conflict', currentStatus: nowRow?.status ?? 'unknown' };
  }

  const { error: auditError } = await adminClient.from('admin_actions').insert({
    admin_id: adminId,
    action,
    target_type: 'contractor',
    target_id: contractorId,
    notes,
  });
  if (auditError) {
    // The status change already happened and is correct — an audit-log
    // write failure shouldn't roll it back or block the response
    // (there's nothing unsafe left half-done: the contractor's new
    // status is exactly what was requested). Logged loudly since losing
    // an audit row is itself worth knowing about.
    console.error('decideContractor: admin_actions insert failed', auditError, { contractorId, action, adminId });
  }

  return { outcome: 'ok', businessName: updated.business_name, slug: updated.slug, status: updated.status };
}
