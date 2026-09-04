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
 * Issue #16 added `serviceRoleKeyConfigured`, plus (at the time) three
 * more fine-grained fields -- `serviceRoleKeyPresent`,
 * `serviceRoleKeyLength`, `envVarNamesMatchingSupabase`, and
 * `serviceRoleKeyError` -- to pin down why Vercel reported the
 * service-role key "missing" even though the dashboard showed it
 * configured. That investigation is long closed (Issue #17 found the
 * real cause: a missing table-level GRANT, not an env var problem at
 * all). Issue #21's security audit flagged those four fields as exactly
 * the "unnecessary internal details" it asks this project to check for:
 * this route has no auth check by design (that's the whole point --
 * self-diagnosis before an admin account even exists), so it was
 * handing any anonymous visitor the exact character length of a
 * privileged secret and a full listing of server env var names on
 * request. The key's VALUE was never exposed, but that's a higher bar
 * than "safe" -- removed now that the one-time diagnostic need they
 * served is over. `serviceRoleKeyConfigured` (via
 * getSupabaseAdminClient() -- client construction alone makes no
 * network call, so this stays side-effect-free) keeps the one signal
 * this route's stated purpose still needs: whether a service-role
 * client can be built at all, with no detail beyond yes/no.
 */
import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const supabaseUrlConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKeyConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  let serviceRoleKeyConfigured = false;
  try {
    getSupabaseAdminClient();
    serviceRoleKeyConfigured = true;
  } catch {
    // Deliberately not surfaced: see header comment -- the reason a
    // service-role client failed to build is not public information.
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
    serviceRoleKeyConfigured,
    provinceCount,
    categoryCount,
    queryError,
  });
}
