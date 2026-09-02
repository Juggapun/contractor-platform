/**
 * Browser/client-safe Supabase client. Uses the `anon` (publishable) key
 * only — safe to bundle into frontend code. Session persistence is
 * handled by supabase-js itself (localStorage in a browser, memory in
 * Node) via `persistSession`/`autoRefreshToken` below, which is what
 * backs `authService.getSession()`/`onAuthStateChange()`.
 *
 * NEVER import src/lib/supabase/admin.ts from anything that also imports
 * this file's call sites in client-rendered code — see that file's
 * header comment.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicSupabaseConfig } from '../env.js';

let cachedClient: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client configured with the anon key.
 * Safe to call from both browser and server code — it never has access
 * to anything more privileged than what RLS already allows an
 * authenticated/anon caller to do.
 */
export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const { url, anonKey } = getPublicSupabaseConfig();
  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: typeof window !== 'undefined',
    },
  });
  return cachedClient;
}

/** Test-only: reset the cached singleton so tests can inject a fresh mock. */
export function __resetSupabaseClientForTests(): void {
  cachedClient = null;
}
