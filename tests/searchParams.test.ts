import { describe, expect, it } from 'vitest';
import { parseSearchParams } from '../src/lib/search/params';

describe('parseSearchParams', () => {
  it('passes through clean values', () => {
    expect(parseSearchParams({ category: 'ไฟฟ้า', province: 'นนทบุรี', q: 'ต่อเติม', page: '2' })).toEqual({
      category: 'ไฟฟ้า',
      province: 'นนทบุรี',
      q: 'ต่อเติม',
      page: 2,
    });
  });

  it('defaults to page 1 and undefined filters when nothing is given', () => {
    expect(parseSearchParams({})).toEqual({
      category: undefined,
      province: undefined,
      q: undefined,
      page: 1,
    });
  });

  it('treats an empty/whitespace-only filter as absent', () => {
    expect(parseSearchParams({ q: '   ' })).toMatchObject({ q: undefined });
  });

  it('trims whitespace around filter values', () => {
    expect(parseSearchParams({ category: '  ไฟฟ้า  ' })).toMatchObject({ category: 'ไฟฟ้า' });
  });

  it('caps filter value length instead of passing an arbitrarily long string through', () => {
    const long = 'a'.repeat(500);
    const result = parseSearchParams({ q: long });
    expect(result.q?.length).toBe(100);
  });

  it('takes the first value when a param is repeated (array)', () => {
    expect(parseSearchParams({ category: ['a', 'b'] })).toMatchObject({ category: 'a' });
  });

  describe('page sanitization', () => {
    it('rejects non-numeric page, defaulting to 1', () => {
      expect(parseSearchParams({ page: 'abc' }).page).toBe(1);
    });

    it('rejects zero/negative page, defaulting to 1', () => {
      expect(parseSearchParams({ page: '0' }).page).toBe(1);
      expect(parseSearchParams({ page: '-5' }).page).toBe(1);
    });

    it('clamps an absurdly large page instead of passing it through unbounded', () => {
      expect(parseSearchParams({ page: '99999999999' }).page).toBe(100_000);
    });

    it('accepts a normal page number', () => {
      expect(parseSearchParams({ page: '3' }).page).toBe(3);
    });

    it('truncates a decimal page to an integer offset via parseInt semantics', () => {
      expect(parseSearchParams({ page: '2.9' }).page).toBe(2);
    });
  });
});
