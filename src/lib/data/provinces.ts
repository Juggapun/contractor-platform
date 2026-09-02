/**
 * Reads public.provinces (supabase/migrations/0002_geography.sql)
 * through the anon-key client, for the Home Page's search-entry province
 * selector. Same RLS/error-handling posture as getCategories() — see
 * that file's header comment.
 */
import { getSupabaseClient } from '../supabase/client';

export interface Province {
  id: number;
  name_th: string;
  slug: string;
}

export async function getProvinces(): Promise<Province[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('provinces')
      .select('id, name_th, slug')
      .order('id', { ascending: true });

    if (error) {
      console.error('getProvinces: query failed', error.message);
      return [];
    }
    return (data as Province[]) ?? [];
  } catch (err) {
    console.error('getProvinces: Supabase not reachable/configured', err);
    return [];
  }
}
