/**
 * Real contractor search (Phase 5). Reads public.contractors through the
 * anon-key client only — RLS's `contractors_select_approved_public`
 * policy (0013_rls_policies.sql) is what actually restricts results to
 * `status = 'approved'` rows; the explicit `.eq('status', 'approved')`
 * below is a defense-in-depth/index-usage choice (matches
 * idx_contractors_status_province), not the security boundary. No
 * service_role, no admin-only table, no column beyond what a public
 * result card needs.
 *
 * Query design (see docs/PHASE5-SEARCH-REPORT.md for the full writeup):
 * one single request per search, using PostgREST's embedded-resource
 * select/filter syntax (standard supabase-js usage, not a workaround):
 *   - province filter: `provinces!inner(...)` + `.eq('provinces.slug', x)`
 *   - category filter: `contractor_categories!inner(categories!inner(...))`
 *     + `.eq('contractor_categories.categories.slug', x)`
 *   - keyword: `.or('business_name.ilike.%x%,description.ilike.%x%')` —
 *     an unindexed ILIKE scan on existing columns (no schema change);
 *     see the report for why that's an acceptable, documented
 *     limitation at MVP scale rather than a blocker.
 *   - pagination: `.range(from, to)` with `{ count: 'exact' }`, a fixed
 *     page size — never an unbounded fetch.
 *   - deterministic order: business_name, then id as a stable tiebreak
 *     (no ranking/matching logic, per Phase 5 scope).
 *
 * Never throws for "no results" or "unknown filter value" — those are
 * legitimate empty states. Only throws for a genuine query failure,
 * which the page renders as an explicit error state (never silently
 * swallowed, never shown as if it were "zero matches").
 */
import { getSupabaseClient } from '../supabase/client';

export const CONTRACTORS_PAGE_SIZE = 12;

export interface ContractorCategoryRef {
  id: number;
  name_th: string;
  slug: string;
}

export interface ContractorSummary {
  id: string;
  business_name: string;
  slug: string;
  description: string | null;
  profile_image_url: string | null;
  rating_avg: number;
  review_count: number;
  verification_status: 'unverified' | 'verified';
  province: { id: number; name_th: string; slug: string } | null;
  district: { id: number; name_th: string; slug: string } | null;
  categories: ContractorCategoryRef[];
}

export interface SearchContractorsInput {
  /** Category slug, already validated/trimmed by the caller. */
  category?: string | undefined;
  /** Province slug, already validated/trimmed by the caller. */
  province?: string | undefined;
  /** Free-text keyword, already validated/trimmed by the caller. */
  q?: string | undefined;
  /** 1-based page number, already clamped to >= 1 by the caller. */
  page: number;
}

export type SearchContractorsResult =
  | {
      ok: true;
      results: ContractorSummary[];
      totalCount: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }
  | { ok: false; message: string };

// PostgREST rejects a raw `%`/`,`/`)` inside an ilike/or value in ways
// that would otherwise let a crafted keyword alter the filter's
// structure. Escape the ilike wildcard characters and strip the
// characters `or=(...)` syntax treats specially, rather than
// interpolating the keyword unescaped into that mini-language.
function sanitizeKeywordForIlike(raw: string): string {
  return raw
    .replace(/[%_]/g, '\\$&') // escape ILIKE wildcards so they're literal
    .replace(/[(),]/g, ' ') // strip characters meaningful to PostgREST's or= syntax
    .trim();
}

interface RawContractorRow {
  id: string;
  business_name: string;
  slug: string;
  description: string | null;
  profile_image_url: string | null;
  rating_avg: number | string;
  review_count: number | string;
  verification_status: 'unverified' | 'verified';
  provinces: { id: number; name_th: string; slug: string } | null;
  districts: { id: number; name_th: string; slug: string } | null;
  contractor_categories: Array<{ categories: ContractorCategoryRef | null }> | null;
}

function mapRow(row: RawContractorRow): ContractorSummary {
  const categories: ContractorCategoryRef[] = Array.isArray(row.contractor_categories)
    ? row.contractor_categories
        .map((cc) => cc.categories)
        .filter((c): c is ContractorCategoryRef => Boolean(c))
    : [];

  return {
    id: row.id,
    business_name: row.business_name,
    slug: row.slug,
    description: row.description,
    profile_image_url: row.profile_image_url,
    rating_avg: Number(row.rating_avg),
    review_count: Number(row.review_count),
    verification_status: row.verification_status,
    province: row.provinces ?? null,
    district: row.districts ?? null,
    categories,
  };
}

export async function searchContractors(
  input: SearchContractorsInput
): Promise<SearchContractorsResult> {
  const page = Number.isFinite(input.page) && input.page >= 1 ? Math.floor(input.page) : 1;
  const from = (page - 1) * CONTRACTORS_PAGE_SIZE;
  const to = from + CONTRACTORS_PAGE_SIZE - 1;

  try {
    const client = getSupabaseClient();

    const provinceEmbed = input.province ? 'provinces!inner(id,name_th,slug)' : 'provinces(id,name_th,slug)';
    const categoryEmbed = input.category
      ? 'contractor_categories!inner(categories!inner(id,name_th,slug))'
      : 'contractor_categories(categories(id,name_th,slug))';

    let query = client
      .from('contractors')
      .select(
        `id, business_name, slug, description, profile_image_url, rating_avg, review_count, verification_status,
         ${provinceEmbed},
         districts(id,name_th,slug),
         ${categoryEmbed}`,
        { count: 'exact' }
      )
      .eq('status', 'approved');

    if (input.province) {
      query = query.eq('provinces.slug', input.province);
    }
    if (input.category) {
      query = query.eq('contractor_categories.categories.slug', input.category);
    }
    if (input.q) {
      const kw = sanitizeKeywordForIlike(input.q);
      if (kw) {
        query = query.or(`business_name.ilike.%${kw}%,description.ilike.%${kw}%`);
      }
    }

    query = query.order('business_name', { ascending: true }).order('id', { ascending: true }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('searchContractors: query failed', error.message);
      return { ok: false, message: error.message };
    }

    const totalCount = count ?? 0;
    // The untyped Supabase client can't know a belongs-to embed
    // (provinces/districts) resolves to a single row rather than an
    // array — it infers the same shape it would for a to-many
    // relationship. Cast through `unknown` once, here, rather than
    // fighting that inference; mapRow is the single place that
    // interprets the real (verified via the search smoke tests) runtime
    // shape.
    const rawRows = (data ?? []) as unknown as RawContractorRow[];
    return {
      ok: true,
      results: rawRows.map(mapRow),
      totalCount,
      page,
      pageSize: CONTRACTORS_PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(totalCount / CONTRACTORS_PAGE_SIZE)),
    };
  } catch (err) {
    console.error('searchContractors: Supabase not reachable/configured', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Just enough to give the Phase 6 placeholder profile page (see
 * app/contractors/[slug]/page.tsx) a real, RLS-respecting existence
 * check — NOT a preview of the profile itself. Returns null on any
 * error or when no approved contractor has this slug (both cases the
 * placeholder page treats identically: "not found").
 */
export async function getContractorNameBySlug(slug: string): Promise<string | null> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('contractors')
      .select('business_name')
      .eq('status', 'approved')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) return null;
    return data.business_name as string;
  } catch (err) {
    console.error('getContractorNameBySlug: Supabase not reachable/configured', err);
    return null;
  }
}
