/**
 * Issue #12 Beta debugging aid: this session has no access to Vercel's
 * dashboard, deployment logs, or the live Supabase project, which turned
 * every round of "why is X broken in Production" into a blind guess-and-
 * wait cycle. This route lets the owner (or anyone) check the actual
 * Production runtime's config/connectivity in one request.
 *
 * Deliberately public and deliberately narrow: booleans for whether the
 * required env vars are present, plus a live row count for the two
 * public reference tables (provinces/categories) already shown to every
 * visitor via the search/registration dropdowns.
 *
 * Issue #16 added `serviceRoleKeyConfigured`. Registration (Issue #14)
 * kept failing with the service-role key reported "missing" even though
 * the owner could see it configured in Vercel's dashboard for
 * Production and Preview. First theory (a deployment built *before* the
 * variable was saved -- Vercel snapshots env vars at build time) was
 * disproven directly: a fresh deployment built *after* the fix still
 * reported it missing, while the two NEXT_PUBLIC_ vars -- read the exact
 * same way, in the exact same request -- worked fine. That rules out
 * every code-level explanation (name typo, build-time inlining, route
 * caching) and points at something Vercel-dashboard-specific to this one
 * variable: added under the wrong project, a stray character in the
 * name, or a scope that excludes whatever's actually deployed.
 *
 * `serviceRoleKeyConfigured` (via getSupabaseAdminClient() -- client
 * construction alone makes no network call, so this stays side-effect-
 * free) answers "does building a client from it throw". That alone
 * can't distinguish "the var isn't in process.env at all" from "it's in
 * process.env as an empty string" -- requireEnv() (src/lib/env.ts)
 * treats both identically. `serviceRoleKeyPresent` /
 * `serviceRoleKeyLength` make that distinction directly against
 * process.env, without requireEnv() in the way. The key's VALUE is
 * never read out, logged, or returned -- only presence, its length (a
 * character *count*, not the characters), and whether a client can be
 * built from it.
 */
import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const supabaseUrlConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKeyConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceRoleKeyPresent = rawServiceRoleKey !== undefined;
  const serviceRoleKeyLength = rawServiceRoleKey?.length ?? 0;

  // Env var NAMES are not secret (only values are) -- if the dashboard
  // shows "SUPABASE_SERVICE_ROLE_KEY" configured but it's actually
  // landing in process.env under a subtly different key (trailing
  // space, different case, a stray character from a copy/paste), this
  // is the one thing that would catch it directly, since
  // `process.env.SUPABASE_SERVICE_ROLE_KEY` requires an exact match.
  const envVarNamesMatchingSupabase = Object.keys(process.env)
    .filter((name) => name.toUpperCase().includes('SUPABASE'))
    .sort();

  let serviceRoleKeyConfigured = false;
  let serviceRoleKeyError: string | null = null;
  try {
    getSupabaseAdminClient();
    serviceRoleKeyConfigured = true;
  } catch (err) {
    serviceRoleKeyError = err instanceof Error ? err.message : 'Unknown error';
  }

  let provinceCount: number | null = null;
  let categoryCount: number | null = null;
  let queryError: string | null = null;

  if (supabaseUrlConfigured && supabaseAnonKeyConfigured) {
    try {
      const client = getSupabaseClient();
      const [provinces, categories] = await Promise.all([
        client.from('provinces').select('id'),
        client.from('categories').select('id'),
      ]);

      if (provinces.error) {
        queryError = provinces.error.message;
      } else {
        provinceCount = provinces.data.length;
      }

      if (categories.error) {
        queryError = queryError ?? categories.error.message;
      } else {
        categoryCount = categories.data.length;
      }
    } catch (err) {
      queryError = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  return NextResponse.json({
    supabaseUrlConfigured,
    supabaseAnonKeyConfigured,
    serviceRoleKeyPresent,
    serviceRoleKeyLength,
    serviceRoleKeyConfigured,
    serviceRoleKeyError,
    envVarNamesMatchingSupabase,
    provinceCount,
    categoryCount,
    queryError,
  });
}
