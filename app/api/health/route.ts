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
 * Production and Preview -- classic symptom of a deployment that was
 * built *before* the variable was saved there (Vercel only injects an
 * env var into deployments created after it's set; existing deployments
 * never pick up a later change without a fresh deploy). This endpoint
 * only ever calls Boolean(...) and, to actually prove the key
 * constructs a working client (not just that the string exists),
 * getSupabaseAdminClient() -- client construction alone makes no network
 * call, so this stays side-effect-free. The key's VALUE is never read,
 * logged, or returned; only whether the env var is present and whether
 * building a client from it throws.
 */
import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const supabaseUrlConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKeyConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

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
    serviceRoleKeyConfigured,
    serviceRoleKeyError,
    provinceCount,
    categoryCount,
    queryError,
  });
}
