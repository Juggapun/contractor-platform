/**
 * Search Intelligence MVP (Issue #40) — turns a keyword search that found
 * zero results into a single, explicit "did you mean" suggestion the
 * user can click, without ever silently rewriting their query or
 * auto-applying a filter on their behalf (the issue's own hard
 * constraint). Only ever called for a `q` search that is ALREADY zero
 * results — a query that finds real matches never reaches this, so it
 * cannot second-guess a keyword search that's actually working.
 *
 * Three tiers, checked in order, first hit wins:
 *   1. Exact synonym hit — the whole (normalized) query is a known
 *      informal phrase (CATEGORY_SYNONYMS), e.g. "ช่างไฟ" -> "ไฟฟ้า".
 *   2. Exact category name typed as a keyword — `q` matches a real
 *      category's name_th exactly. searchContractors() only ever
 *      ILIKEs `q` against business_name/description, never against a
 *      category name, so typing a category name as free text (rather
 *      than picking the category filter) legitimately finds nothing even
 *      though the user's intent is completely unambiguous.
 *   3. Fuzzy typo match — Levenshtein distance, relative to the longer
 *      of the two strings, against every category name AND every
 *      synonym key, keeping only the closest match and only if it's
 *      close enough (MAX_RELATIVE_DISTANCE) to be a plausible typo
 *      rather than a coincidental resemblance to unrelated text.
 *      0.34 was picked by hand-checking the issue's own three example
 *      typos of "ต่อเติม" (ต่อเดิม/ต่อเติ่ม/ต่อเต้ม), each exactly one
 *      edit away — relative distance ~0.125-0.143 — against clearly
 *      unrelated free text, which lands at 0.7+ for this catalog. See
 *      tests/searchSuggestion.test.ts.
 */
import { levenshteinDistance } from './levenshtein';
import { CATEGORY_SYNONYMS } from './categorySynonyms';
import { normalizeSearchText } from './textNormalize';

const MAX_RELATIVE_DISTANCE = 0.34;

export interface SearchSuggestionCategory {
  name_th: string;
  slug: string;
}

export interface SearchSuggestion {
  categoryNameTh: string;
  categorySlug: string;
  matchedTerm: string;
  confidence: number;
  reason: 'synonym' | 'fuzzy';
}

function relativeDistance(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return levenshteinDistance(a, b) / maxLen;
}

export function getSearchSuggestion(
  rawQuery: string,
  categories: SearchSuggestionCategory[]
): SearchSuggestion | null {
  const query = normalizeSearchText(rawQuery);
  if (!query || categories.length === 0) return null;

  const byName = new Map(categories.map((c) => [c.name_th, c]));

  // Tier 1: exact synonym hit.
  const synonymTarget = CATEGORY_SYNONYMS[query];
  if (synonymTarget) {
    const category = byName.get(synonymTarget);
    if (category) {
      return {
        categoryNameTh: category.name_th,
        categorySlug: category.slug,
        matchedTerm: query,
        confidence: 1,
        reason: 'synonym',
      };
    }
  }

  // Tier 2: the query IS a real category name, just typed as a keyword.
  const exactCategory = byName.get(query);
  if (exactCategory) {
    return {
      categoryNameTh: exactCategory.name_th,
      categorySlug: exactCategory.slug,
      matchedTerm: query,
      confidence: 1,
      reason: 'synonym',
    };
  }

  // Tier 3: fuzzy match against every category name and every synonym
  // key, keeping only the single closest candidate overall.
  let best: { category: SearchSuggestionCategory; term: string; relDist: number } | null = null;

  for (const category of categories) {
    const relDist = relativeDistance(query, category.name_th);
    if (!best || relDist < best.relDist) {
      best = { category, term: category.name_th, relDist };
    }
  }
  for (const [synonymKey, targetName] of Object.entries(CATEGORY_SYNONYMS)) {
    const category = byName.get(targetName);
    if (!category) continue;
    const relDist = relativeDistance(query, synonymKey);
    if (!best || relDist < best.relDist) {
      best = { category, term: synonymKey, relDist };
    }
  }

  if (best && best.relDist > 0 && best.relDist <= MAX_RELATIVE_DISTANCE) {
    return {
      categoryNameTh: best.category.name_th,
      categorySlug: best.category.slug,
      matchedTerm: best.term,
      confidence: 1 - best.relDist,
      reason: 'fuzzy',
    };
  }

  return null;
}
