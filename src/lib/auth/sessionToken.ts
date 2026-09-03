/**
 * Client-safe helper: reads the browser's current Supabase session
 * (anon-key client, localStorage-backed — see src/lib/supabase/client.ts)
 * and returns its access token, so a client component can send it as the
 * Authorization header on a server request that verifies it (never
 * trusted from anything else the client asserts). Originally built
 * (Phase 8) for AdminContractorQueue/AdminContractorDetail's calls to
 * app/api/admin/**, verified there by requireAdmin()
 * (app/api/admin/_lib/requireAdmin.ts); Issue #19 reuses it in
 * ContractorRegistrationForm.tsx for the same reason, verified there by
 * resolveRequestingUser() (app/api/contractors/_lib/). Either caller
 * treats a missing token as UX convenience only, not the authorization
 * boundary — that's always the server-side verification, never this.
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
