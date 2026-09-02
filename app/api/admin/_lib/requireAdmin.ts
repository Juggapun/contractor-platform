/**
 * Phase 8 — admin authorization boundary for every route under
 * app/api/admin/**. This is the actual security enforcement Issue #6
 * asks for ("Enforce authorization server-side; do not rely on hiding
 * UI controls" / "Verify admin authorization on the server/API/database
 * boundary") — the admin UI pages (app/admin/**) are plain client
 * components with no way to gate themselves server-side (this codebase
 * has no cookie-based session — see app/api/contractors/register/route.ts's
 * header comment for why), so every byte of real protection lives here,
 * not in the page.
 *
 * Two independent checks, neither trusting anything the client asserts:
 *   1. The bearer token is verified against the auth provider itself
 *      (`auth.getUser(token)` — a real network round-trip to GoTrue in
 *      production, not a local decode) to prove it's a live session for
 *      a real user.
 *   2. That user's role is read fresh from `profiles` via the
 *      service_role client — never from a claim inside the token, never
 *      from anything the request body/headers say about who's calling.
 *      `profiles.role` is itself un-spoofable by the user in question:
 *      `trg_profiles_lock_role` (0004_profiles.sql) refuses a self-
 *      service role change for any non-trusted caller.
 *
 * The actual "is this role allowed" decision is delegated to
 * src/lib/auth/guards.ts's `requireAdmin()` (Phase 3) rather than
 * reimplemented here — that module's own header comment already
 * anticipated exactly this: "server-side route/handler code (later
 * phases) can fail fast... before even attempting a query." This is
 * that later phase.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { ForbiddenError, requireAdmin as requireAdminRole } from '@/lib/auth/guards';
import type { CurrentUser, Profile } from '@/lib/auth/types';
import { createOneOffAuthClient } from '../../_lib/authClients';

export type RequireAdminResult = { ok: true; adminId: string } | { ok: false; status: number; error: string };

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function requireAdmin(
  request: Request,
  adminClient: SupabaseClient = getSupabaseAdminClient(),
  authClient: Pick<SupabaseClient['auth'], 'getUser'> = createOneOffAuthClient().auth
): Promise<RequireAdminResult> {
  const token = extractBearerToken(request);
  if (!token) {
    return { ok: false, status: 401, error: 'กรุณาเข้าสู่ระบบ' };
  }

  const { data: userData, error: userError } = await authClient.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: 'เซสชันไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่' };
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false, status: 403, error: 'ไม่มีสิทธิ์เข้าถึงส่วนนี้' };
  }

  const currentUser: CurrentUser = {
    id: userData.user.id,
    email: userData.user.email ?? null,
    profile: profile as Profile,
  };

  try {
    requireAdminRole(currentUser);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, status: 403, error: 'ไม่มีสิทธิ์เข้าถึงส่วนนี้' };
    }
    throw err;
  }

  return { ok: true, adminId: currentUser.id };
}
