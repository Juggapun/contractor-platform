/**
 * Shared server-only Supabase client helper for Route Handlers under
 * app/api/**. A fresh, non-cached, non-persisting client per call —
 * never the module-level `getSupabaseClient()` singleton
 * (src/lib/supabase/client.ts), which caches one client instance across
 * every request this Node process serves. Reusing that singleton for a
 * server-side auth call (`signUp`, or verifying a client-supplied
 * session token) would let one request's in-memory session state leak
 * into a concurrent, unrelated request from a different visitor — the
 * singleton has no `window`/localStorage on the server to isolate it.
 * First needed in Phase 7 (the registration route's `signUp` call);
 * Phase 8 reuses it for verifying an admin's bearer token
 * (app/api/admin/_lib/requireAdmin.ts) — same hazard, same fix.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicSupabaseConfig } from '@/lib/env';

export function createOneOffAuthClient(): SupabaseClient {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Shared with app/api/admin/_lib/requireAdmin.ts and (Issue #19)
 * app/api/contractors/_lib/resolveRequestingUser.ts — both verify a
 * client-supplied bearer token against the real auth provider before
 * trusting the user id it resolves to; this just extracts it from the
 * header. */
export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
