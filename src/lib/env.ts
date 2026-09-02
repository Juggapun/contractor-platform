/**
 * Centralized environment variable access. See .env.example for the full
 * list and docs/AUTHENTICATION.md#environment-variables for what's safe
 * to expose to a browser bundle vs. server-only.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`
    );
  }
  return value;
}

/**
 * Client-safe config: the Supabase project URL and the `anon`
 * (publishable) key. Both are DESIGNED to be shipped to a browser —
 * every authorization decision is enforced by RLS on the database side,
 * never by keeping this key secret.
 */
export function getPublicSupabaseConfig(): { url: string; anonKey: string } {
  return {
    url: requireEnv('SUPABASE_URL'),
    anonKey: requireEnv('SUPABASE_ANON_KEY'),
  };
}

/**
 * Server-only config: the `service_role` key bypasses Row Level Security
 * entirely. This function — and anything that calls it — must never run
 * in browser-bundled code. See src/lib/supabase/admin.ts.
 */
export function getServiceRoleSupabaseConfig(): { url: string; serviceRoleKey: string } {
  if (typeof window !== 'undefined') {
    throw new Error(
      'getServiceRoleSupabaseConfig() was called in a browser context. ' +
        'The service_role key must never be loaded client-side.'
    );
  }
  return {
    url: requireEnv('SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  };
}
