/**
 * Issue #12 Beta debugging aid: this session has no access to Vercel's
 * dashboard, deployment logs, or the live Supabase project, which turned
 * every round of "why is X broken in Production" into a blind guess-and-
 * wait cycle. This route lets the owner (or anyone) check the actual
 * Production runtime's config/connectivity in one request.
 *
 * Deliberately public and deliberately narrow: booleans for whether the
 * two NEXT_PUBLIC_ vars are present, plus a live row count for the two
 * public reference tables (provinces/categories) already shown to every
 * visitor via the search/registration dropdowns. Never touches
 * SUPABASE_SERVICE_ROLE_KEY or any table gated beyond public RLS.
 */
import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const supabaseUrlConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKeyConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

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
    provinceCount,
    categoryCount,
    queryError,
  });
}
