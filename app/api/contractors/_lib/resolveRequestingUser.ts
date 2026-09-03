/**
 * Issue #19 — contractor registration's "is this a brand-new signup, or
 * an already-logged-in existing user becoming a contractor" boundary.
 *
 * Before this, app/api/contractors/register/route.ts always called
 * Supabase Auth `signUp()`, regardless of whether the request came from
 * an authenticated session — an existing user submitting the contractor
 * form got `AuthApiError: User already registered`, since their email
 * was already taken. The fix is not to special-case that error; it's to
 * never call `signUp()` for a request that already carries a valid
 * session in the first place.
 *
 * Same trust model as app/api/admin/_lib/requireAdmin.ts: a bearer
 * token, if present, is verified against the real auth provider
 * (`auth.getUser(token)` — never locally decoded, never trusted from a
 * client-asserted claim) before its user id is used for anything, and
 * `profiles.role` is read fresh via the service_role client rather than
 * trusted from anything the request says. Unlike requireAdmin, a
 * *missing* token is not an error here — it means "new user signing
 * up", the pre-Issue-#19 flow, which stays fully supported.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { UserRole } from '@/lib/auth/types';
import { createOneOffAuthClient, extractBearerToken } from '../../_lib/authClients';

export type ResolveRequestingUserResult =
  | { mode: 'new' }
  | { mode: 'existing'; userId: string; role: UserRole }
  | { mode: 'error'; status: number; error: string };

const SESSION_ERROR = 'เซสชันไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่';

export async function resolveRequestingUser(
  request: Request,
  adminClient: SupabaseClient = getSupabaseAdminClient(),
  authClient: Pick<SupabaseClient['auth'], 'getUser'> = createOneOffAuthClient().auth
): Promise<ResolveRequestingUserResult> {
  const token = extractBearerToken(request);
  if (!token) {
    return { mode: 'new' };
  }

  const { data: userData, error: userError } = await authClient.getUser(token);
  if (userError || !userData.user) {
    return { mode: 'error', status: 401, error: SESSION_ERROR };
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { mode: 'error', status: 401, error: SESSION_ERROR };
  }

  return { mode: 'existing', userId: userData.user.id, role: (profile as { role: UserRole }).role };
}
