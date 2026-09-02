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
 *
 * Uses the `NEXT_PUBLIC_` prefix and **literal, static**
 * `process.env.NEXT_PUBLIC_...` property access deliberately — Next.js
 * only inlines `NEXT_PUBLIC_*` variables into a browser bundle when it
 * can statically find that exact member-access expression at build
 * time; a dynamic `process.env[name]` lookup (like requireEnv() above,
 * which is fine for server-only code) is invisible to that static
 * analysis and would silently resolve to `undefined` in the browser.
 * This is a real bug that existed from Phase 3 through Phase 5 — every
 * client-side Supabase call (the Phase 3/4 header auth-state widget,
 * this phase's contact-click tracking) was silently failing in an
 * actual browser bundle and falling back to its error path, which for
 * the auth widget looked like a correct "logged out" state and went
 * unnoticed until Phase 6 surfaced it as a visible console error — see
 * docs/PHASE6-CONTRACTOR-PROFILE-REPORT.md.
 */
export function getPublicSupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL and/or ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY. See .env.example.'
    );
  }
  return { url, anonKey };
}

/**
 * Server-only config: the `service_role` key bypasses Row Level Security
 * entirely. This function — and anything that calls it — must never run
 * in browser-bundled code. See src/lib/supabase/admin.ts. Deliberately
 * NOT `NEXT_PUBLIC_`-prefixed — that prefix is exactly what would make
 * Next.js inline it into the browser bundle, which must never happen.
 */
export function getServiceRoleSupabaseConfig(): { url: string; serviceRoleKey: string } {
  if (typeof window !== 'undefined') {
    throw new Error(
      'getServiceRoleSupabaseConfig() was called in a browser context. ' +
        'The service_role key must never be loaded client-side.'
    );
  }
  return {
    url: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  };
}
