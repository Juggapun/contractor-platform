/**
 * Client-safe helper for the Phase 8 admin pages: reads the browser's
 * current Supabase session (anon-key client, localStorage-backed — see
 * src/lib/supabase/client.ts) and returns its access token, so
 * AdminContractorQueue/AdminContractorDetail can send it as the
 * Authorization header on every call to app/api/admin/**. This is UX
 * convenience only — if there is no session, or the request comes back
 * 401/403, the component shows an access-denied state; it never renders
 * admin data on the strength of this check alone, since the actual
 * authorization boundary is requireAdmin() on the server
 * (app/api/admin/_lib/requireAdmin.ts), not this.
 */
import { getSupabaseClient } from '../supabase/client';

export async function getAccessTokenOrNull(): Promise<string | null> {
  try {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error || !data.session) return null;
    return data.session.access_token;
  } catch {
    return null;
  }
}
