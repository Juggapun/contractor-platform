/**
 * Unit tests for Issue #40's Search Intelligence MVP: levenshteinDistance,
 * CATEGORY_SYNONYMS data integrity, and the getSearchSuggestion pipeline.
 * The category fixture below mirrors the 10 real seeded rows
 * (supabase/seed.sql / public.categories), confirmed live against the
 * local-dev Postgres instance — `slug` is literally each row's own
 * `name_th` value in this catalog, exactly as in production.
 */
import { describe, expect, it } from 'vitest';
import { levenshteinDistance } from '../src/lib/search/levenshtein';
import { CATEGORY_SYNONYMS } from '../src/lib/search/categorySynonyms';
import { getSearchSuggestion } from '../src/lib/search/searchSuggestion';

const REAL_CATEGORIES = [
  { name_th: 'สร้างบ้าน', slug: 'สร้างบ้าน' },
  { name_th: 'ต่อเติม', slug: 'ต่อเติม' },
  { name_th: 'รีโนเวท', slug: 'รีโนเวท' },
  { name_th: 'โครงสร้าง', slug: 'โครงสร้าง' },
  { name_th: 'ไฟฟ้า', slug: 'ไฟฟ้า' },
  { name_th: 'ประปา', slug: 'ประปา' },
  { name_th: 'หลังคา', slug: 'หลังคา' },
  { name_th: 'ถนน', slug: 'ถนน' },
  { name_th: 'งานระบบ', slug: 'งานระบบ' },
  { name_th: 'อื่นๆ', slug: 'อื่นๆ' },
];

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('ไฟฟ้า', 'ไฟฟ้า')).toBe(0);
  });

  it('returns the length of the other string when one is empty', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });

  it('counts a single substitution as distance 1', () => {
    expect(levenshteinDistance('ต่อเติม', 'ต่อเต้ม')).toBe(1);
  });

  it('counts a single insertion as distance 1', () => {
    expect(levenshteinDistance('ต่อเติม', 'ต่อเติ่ม')).toBe(1);
  });
});

describe('CATEGORY_SYNONYMS data integrity', () => {
  const realNames = new Set(REAL_CATEGORIES.map((c) => c.name_th));

  it('every synonym value matches a real category name_th', () => {
    for (const [key, value] of Object.entries(CATEGORY_SYNONYMS)) {
      expect(realNames.has(value), `synonym "${key}" -> "${value}" is not a real category`).toBe(true);
    }
  });

  it('has no synonym mapping to the "อื่นๆ" catch-all category', () => {
    expect(Object.values(CATEGORY_SYNONYMS)).not.toContain('อื่นๆ');
  });
});

describe('getSearchSuggestion', () => {
  it('suggests ไฟฟ้า for the informal synonym "ช่างไฟ"', () => {
    const suggestion = getSearchSuggestion('ช่างไฟ', REAL_CATEGORIES);
    expect(suggestion?.categoryNameTh).toBe('ไฟฟ้า');
    expect(suggestion?.reason).toBe('synonym');
  });

  it.each(['ต่อเดิม', 'ต่อเติ่ม', 'ต่อเต้ม'])(
    'suggests ต่อเติม for the one-edit-away typo "%s"',
    (typo) => {
      const suggestion = getSearchSuggestion(typo, REAL_CATEGORIES);
      expect(suggestion?.categoryNameTh).toBe('ต่อเติม');
      expect(suggestion?.reason).toBe('fuzzy');
    }
  );

  it('suggests the category itself when the exact category name is typed as a keyword', () => {
    const suggestion = getSearchSuggestion('หลังคา', REAL_CATEGORIES);
    expect(suggestion?.categoryNameTh).toBe('หลังคา');
    expect(suggestion?.categorySlug).toBe('หลังคา');
  });

  it('returns null for clearly unrelated free text', () => {
    expect(getSearchSuggestion('สวัสดีครับ ขอบคุณมาก', REAL_CATEGORIES)).toBeNull();
    expect(getSearchSuggestion('บ้านสวยราคาถูก', REAL_CATEGORIES)).toBeNull();
  });

  it('returns null for an empty or whitespace-only query', () => {
    expect(getSearchSuggestion('', REAL_CATEGORIES)).toBeNull();
    expect(getSearchSuggestion('   ', REAL_CATEGORIES)).toBeNull();
  });

  it('returns null when no categories are available', () => {
    expect(getSearchSuggestion('ช่างไฟ', [])).toBeNull();
  });

  it('trims and collapses whitespace before matching', () => {
    const suggestion = getSearchSuggestion('  ช่างไฟ  ', REAL_CATEGORIES);
    expect(suggestion?.categoryNameTh).toBe('ไฟฟ้า');
  });
});
