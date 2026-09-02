/**
 * Reads public.categories (supabase/migrations/0003_categories.sql)
 * through the anon-key client. RLS's `categories_select_all` policy
 * (0013_rls_policies.sql) makes every category row readable by anyone —
 * no protected/admin-only data is touched here.
 *
 * If Supabase isn't configured (no NEXT_PUBLIC_SUPABASE_URL/
 * NEXT_PUBLIC_SUPABASE_ANON_KEY — the
 * expected state until a real hosted project exists, see
 * docs/AUTHENTICATION.md) or the request fails for any reason, this
 * returns an empty array rather than throwing or inventing rows, so the
 * Home Page can render a real "no categories yet" empty state instead
 * of fabricated data — see docs/PHASE4-HOME-PAGE-REPORT.md.
 */
import { getSupabaseClient } from '../supabase/client';

export interface Category {
  id: number;
  name_th: string;
  name_en: string;
  slug: string;
  icon: string | null;
}

export async function getCategories(): Promise<Category[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('categories')
      .select('id, name_th, name_en, slug, icon')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('getCategories: query failed', error.message);
      return [];
    }
    return (data as Category[]) ?? [];
  } catch (err) {
    console.error('getCategories: Supabase not reachable/configured', err);
    return [];
  }
}
