/**
 * SERVER-ONLY Supabase client using the `service_role` key.
 *
 * service_role BYPASSES ROW LEVEL SECURITY ENTIRELY. Every table this
 * key touches is fully readable/writable regardless of any RLS policy
 * in supabase/migrations/0013_rls_policies.sql — see
 * docs/PHASE2-EXECUTION-REPORT.md and public.is_trusted_context() for
 * why that's intentional for trusted server-side operations only.
 *
 * Rules enforced here:
 *   - This module must only ever run in a server/Node process that has
 *     SUPABASE_SERVICE_ROLE_KEY in its (non-public) environment — it is
 *     never set in a browser build's env, and getServiceRoleSupabaseConfig()
 *     throws if `window` exists.
 *   - `eslint.config.js` flags any import of this file's relative path
 *     from client-facing code as a lint error (no-restricted-imports).
 *   - Never log, return, or embed the service_role key or this client
 *     in any response sent to a browser.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceRoleSupabaseConfig } from '../env.js';

let cachedAdminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient;

  const { url, serviceRoleKey } = getServiceRoleSupabaseConfig();
  cachedAdminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedAdminClient;
}

/** Test-only: reset the cached singleton so tests can inject a fresh mock. */
export function __resetSupabaseAdminClientForTests(): void {
  cachedAdminClient = null;
}
