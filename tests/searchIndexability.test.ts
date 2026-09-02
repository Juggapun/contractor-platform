import { describe, expect, it } from 'vitest';
import { getSearchIndexability } from '../src/lib/seo/searchIndexability';
import type { ParsedSearchParams } from '../src/lib/search/params';

const CATEGORIES = new Set(['electrical', 'plumbing']);
const PROVINCES = new Set(['bangkok', 'chiang-mai']);

function params(overrides: Partial<ParsedSearchParams> = {}): ParsedSearchParams {
  return { page: 1, ...overrides };
}

describe('getSearchIndexability', () => {
  it('indexes /search with no filters, canonical to itself', () => {
    const result = getSearchIndexability(params(), CATEGORIES, PROVINCES);
    expect(result).toEqual({ indexable: true, canonicalPath: '/search' });
  });

  it('indexes a real category-only filter, canonical to itself', () => {
    const result = getSearchIndexability(params({ category: 'electrical' }), CATEGORIES, PROVINCES);
    expect(result).toEqual({ indexable: true, canonicalPath: '/search?category=electrical' });
  });

  it('indexes a real province-only filter, canonical to itself', () => {
    const result = getSearchIndexability(params({ province: 'bangkok' }), CATEGORIES, PROVINCES);
    expect(result).toEqual({ indexable: true, canonicalPath: '/search?province=bangkok' });
  });

  it('does not index an unknown category slug', () => {
    const result = getSearchIndexability(params({ category: 'not-a-real-category' }), CATEGORIES, PROVINCES);
    expect(result.indexable).toBe(false);
  });

  it('does not index an unknown province slug', () => {
    const result = getSearchIndexability(params({ province: 'not-a-real-province' }), CATEGORIES, PROVINCES);
    expect(result.indexable).toBe(false);
  });

  it('does not index a combined category + province filter', () => {
    const result = getSearchIndexability(
      params({ category: 'electrical', province: 'bangkok' }),
      CATEGORIES,
      PROVINCES
    );
    expect(result.indexable).toBe(false);
  });

  it('does not index a free-text keyword search', () => {
    const result = getSearchIndexability(params({ q: 'ช่างไฟ' }), CATEGORIES, PROVINCES);
    expect(result.indexable).toBe(false);
  });

  it('does not index a keyword search even with an otherwise-clean single filter', () => {
    const result = getSearchIndexability(params({ category: 'electrical', q: 'ด่วน' }), CATEGORIES, PROVINCES);
    expect(result.indexable).toBe(false);
  });

  it('does not index page 2 and beyond', () => {
    const result = getSearchIndexability(params({ page: 2 }), CATEGORIES, PROVINCES);
    expect(result.indexable).toBe(false);
  });

  it('does not index page 2 of an otherwise-clean single filter', () => {
    const result = getSearchIndexability(params({ province: 'bangkok', page: 2 }), CATEGORIES, PROVINCES);
    expect(result.indexable).toBe(false);
  });
});
