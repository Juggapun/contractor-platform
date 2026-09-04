/**
 * Issue #23 — authorization boundary for every contractor self-service
 * write route (portfolio add/delete, profile-image replace): the same
 * two-check trust model as app/api/admin/_lib/requireAdmin.ts and
 * resolveRequestingUser.ts (bearer token verified against the real auth
 * provider, then the caller's own contractors row looked up fresh via
 * the service_role client — never trusted from anything the request
 * asserts). Unlike resolveRequestingUser.ts, a missing/invalid token or
 * a missing contractor row is ALWAYS an error here: there is no "new
 * user" mode for these routes, only an existing, verified owner acting
 * on their own data.
 *
 * Deliberately does not gate on `status` — RLS's `portfolio_images_owner_write`
 * / `contractors_update_own` policies (0013_rls_policies.sql) let a
 * contractor manage their own portfolio/profile image regardless of
 * pending/approved/rejected/suspended status; this mirrors that
 * boundary rather than inventing a narrower one. Only PUBLIC visibility
 * (what an anonymous visitor can read) is status-gated, never the
 * owner's own write access to their own data.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { createOneOffAuthClient, extractBearerToken } from '../../_lib/authClients';

export type RequireContractorOwnerResult =
  | { ok: true; contractorId: string; userId: string }
  | { ok: false; status: number; error: string };

const SESSION_ERROR = 'เซสชันไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่';

export async function requireContractorOwner(
  request: Request,
  adminClient: SupabaseClient = getSupabaseAdminClient(),
  authClient: Pick<SupabaseClient['auth'], 'getUser'> = createOneOffAuthClient().auth
): Promise<RequireContractorOwnerResult> {
  const token = extractBearerToken(request);
  if (!token) {
    return { ok: false, status: 401, error: 'กรุณาเข้าสู่ระบบ' };
  }

  const { data: userData, error: userError } = await authClient.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: SESSION_ERROR };
  }

  const { data: contractor, error: contractorError } = await adminClient
    .from('contractors')
    .select('id')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (contractorError) {
    return { ok: false, status: 500, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง' };
  }
  if (!contractor) {
    return { ok: false, status: 403, error: 'ไม่พบโปรไฟล์ผู้รับเหมาของบัญชีนี้' };
  }

  return { ok: true, contractorId: contractor.id as string, userId: userData.user.id };
}
