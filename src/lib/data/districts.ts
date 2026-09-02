/**
 * Reads public.districts (supabase/migrations/0002_geography.sql) through
 * the anon-key client, for the Phase 7 registration form's province ->
 * district cascading selector. Same RLS/error-handling posture as
 * getProvinces()/getCategories() — `districts_select_all` (0013) makes
 * every row readable by anyone, no protected data touched here. Always
 * scoped to one `province_id` — the table has ~928 rows nationwide, so
 * this deliberately never fetches the whole table.
 */
import { getSupabaseClient } from '../supabase/client';

export interface District {
  id: number;
  name_th: string;
  slug: string;
}

export async function getDistrictsByProvince(provinceId: number): Promise<District[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('districts')
      .select('id, name_th, slug')
      .eq('province_id', provinceId)
      .order('name_th', { ascending: true });

    if (error) {
      console.error('getDistrictsByProvince: query failed', error.message);
      return [];
    }
    return (data as District[]) ?? [];
  } catch (err) {
    console.error('getDistrictsByProvince: Supabase not reachable/configured', err);
    return [];
  }
}
