import { describe, expect, it } from 'vitest';
import { isSafeRedirectPath, resolveRedirectPath } from '../src/lib/navigation/safeRedirect';

describe('isSafeRedirectPath', () => {
  it('accepts a plain relative path', () => {
    expect(isSafeRedirectPath('/contractors/chang-fai-somchai')).toBe(true);
  });

  it('accepts the root path', () => {
    expect(isSafeRedirectPath('/')).toBe(true);
  });

  it('accepts a path with a query string', () => {
    expect(isSafeRedirectPath('/search?category=electrical')).toBe(true);
  });

  it('rejects null/undefined/empty', () => {
    expect(isSafeRedirectPath(null)).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
    expect(isSafeRedirectPath('')).toBe(false);
  });

  it('rejects a value that does not start with /', () => {
    expect(isSafeRedirectPath('contractors/foo')).toBe(false);
    expect(isSafeRedirectPath('evil.com')).toBe(false);
  });

  it('rejects a protocol-relative URL (//evil.com)', () => {
    expect(isSafeRedirectPath('//evil.com')).toBe(false);
  });

  it('rejects a backslash-leading value that browsers may normalize like //', () => {
    expect(isSafeRedirectPath('/\\evil.com')).toBe(false);
  });

  it('rejects an absolute URL smuggled in after a leading slash', () => {
    expect(isSafeRedirectPath('/https://evil.com')).toBe(false);
    expect(isSafeRedirectPath('/http://evil.com')).toBe(false);
  });

  it('rejects a bare absolute URL', () => {
    expect(isSafeRedirectPath('https://evil.com')).toBe(false);
  });
});

describe('resolveRedirectPath', () => {
  it('returns the value when safe', () => {
    expect(resolveRedirectPath('/contractors/foo')).toBe('/contractors/foo');
  });

  it('falls back to / when unsafe or missing', () => {
    expect(resolveRedirectPath('//evil.com')).toBe('/');
    expect(resolveRedirectPath(null)).toBe('/');
    expect(resolveRedirectPath(undefined)).toBe('/');
  });
});
