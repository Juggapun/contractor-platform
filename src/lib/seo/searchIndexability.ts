/**
 * Decides whether a given /search filter combination is indexable, and
 * what its canonical URL should be — Phase 11 (Issue #9): "Ensure
 * province/category landing/filter pages can have unique indexable
 * URLs/content where the current routing supports them" and "Avoid
 * duplicate-content problems from query-string/filter variants; use
 * canonicalization or noindex appropriately."
 *
 * The current routing only supports filtering via /search's query
 * string (no dedicated /categories/[slug] or /provinces/[slug] routes —
 * inventing those would be new-route scope beyond what Issue #9 asks
 * for, since it says "where the current routing supports them"). So:
 *
 * - No filters, or exactly one of (a real, known category slug) / (a
 *   real, known province slug), on page 1: a legitimate, unique,
 *   worthwhile landing page — indexable, canonical to itself.
 * - Everything else — a free-text keyword (`q`), category+province
 *   combined, page > 1, or a slug that doesn't match any real
 *   category/province — noindex. These are either near-infinite
 *   combinatorial variants (the "hundreds of thin doorway pages" Issue
 *   #9 explicitly says not to create) or duplicate/broken content, not
 *   pages worth sending a crawler to.
 *
 * Pure and synchronous — the caller (app/search/page.tsx) already has
 * the real category/province lists in hand from the same
 * getCategories()/getProvinces() calls it needs for the filter UI, so
 * this never fetches anything itself.
 */
import type { ParsedSearchParams } from '../search/params';

export interface SearchIndexability {
  indexable: boolean;
  /** Path + query string, relative — the caller resolves it against `metadataBase`. */
  canonicalPath: string;
}

export function getSearchIndexability(
  parsed: ParsedSearchParams,
  knownCategorySlugs: ReadonlySet<string>,
  knownProvinceSlugs: ReadonlySet<string>
): SearchIndexability {
  const hasCategory = Boolean(parsed.category);
  const hasProvince = Boolean(parsed.province);

  const categoryKnown = hasCategory && knownCategorySlugs.has(parsed.category as string);
  const provinceKnown = hasProvince && knownProvinceSlugs.has(parsed.province as string);

  const isCleanSingleFilter =
    (!hasCategory && !hasProvince) || // no filters at all
    (categoryKnown && !hasProvince) || // category only, and it's real
    (provinceKnown && !hasCategory); // province only, and it's real

  const indexable = isCleanSingleFilter && !parsed.q && parsed.page === 1;

  const params = new URLSearchParams();
  if (hasCategory) params.set('category', parsed.category as string);
  if (hasProvince) params.set('province', parsed.province as string);
  const query = params.toString();
  const canonicalPath = query ? `/search?${query}` : '/search';

  return { indexable, canonicalPath };
}
