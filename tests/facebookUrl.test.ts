import { describe, expect, it } from 'vitest';
import { isAllowedFacebookHost, isAllowedFacebookImageHost, parseFacebookPostUrl } from '../src/lib/articles/facebookUrl';

describe('parseFacebookPostUrl', () => {
  it('accepts a real facebook.com post URL', () => {
    const result = parseFacebookPostUrl('https://www.facebook.com/somepage/posts/12345');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url.hostname).toBe('www.facebook.com');
  });

  it('accepts the bare facebook.com host', () => {
    expect(parseFacebookPostUrl('https://facebook.com/somepage/posts/12345').ok).toBe(true);
  });

  it('accepts m.facebook.com', () => {
    expect(parseFacebookPostUrl('https://m.facebook.com/somepage/posts/12345').ok).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    const result = parseFacebookPostUrl('  https://www.facebook.com/a/posts/1  ');
    expect(result.ok).toBe(true);
  });

  it('rejects an empty string', () => {
    const result = parseFacebookPostUrl('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('กรุณาระบุ');
  });

  it('rejects whitespace-only input', () => {
    expect(parseFacebookPostUrl('   ').ok).toBe(false);
  });

  it('rejects a malformed URL', () => {
    const result = parseFacebookPostUrl('not a url at all');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('รูปแบบ URL');
  });

  it('rejects http:// (not https)', () => {
    const result = parseFacebookPostUrl('http://www.facebook.com/a/posts/1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('https');
  });

  it('rejects a non-Facebook host', () => {
    const result = parseFacebookPostUrl('https://evil.example.com/');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('facebook.com');
  });

  // The core SSRF-relevant cases: a hostname that merely CONTAINS
  // "facebook.com" as a substring (a classic allowlist-bypass trick)
  // must still be rejected — parseFacebookPostUrl checks exact hostname
  // equality via a Set, never `.includes()`/`.endsWith()` against the
  // whole URL string.
  it('rejects a lookalike host that merely contains "facebook.com"', () => {
    expect(parseFacebookPostUrl('https://facebook.com.evil.example/').ok).toBe(false);
  });

  it('rejects a lookalike host with facebook.com as a subdomain prefix trick', () => {
    expect(parseFacebookPostUrl('https://www.facebook.com.attacker.net/').ok).toBe(false);
  });

  it('rejects userinfo-based confusion (https://facebook.com@evil.example/)', () => {
    // In a real URL, the actual host here is evil.example — confirm the
    // URL parser resolves it that way and this gets rejected.
    const result = parseFacebookPostUrl('https://facebook.com@evil.example/');
    expect(result.ok).toBe(false);
  });

  it('rejects an internal/metadata-service-shaped host', () => {
    expect(parseFacebookPostUrl('https://169.254.169.254/latest/meta-data/').ok).toBe(false);
    expect(parseFacebookPostUrl('https://localhost/').ok).toBe(false);
    expect(parseFacebookPostUrl('https://127.0.0.1/').ok).toBe(false);
  });

  it('rejects a URL over the length cap', () => {
    const long = 'https://www.facebook.com/' + 'a'.repeat(2000);
    const result = parseFacebookPostUrl(long);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('ยาวเกินไป');
  });

  it('is case-insensitive on the hostname', () => {
    expect(parseFacebookPostUrl('https://WWW.FACEBOOK.COM/a/posts/1').ok).toBe(true);
  });
});

describe('isAllowedFacebookHost', () => {
  it('allows the exact known Facebook hosts', () => {
    expect(isAllowedFacebookHost('facebook.com')).toBe(true);
    expect(isAllowedFacebookHost('www.facebook.com')).toBe(true);
    expect(isAllowedFacebookHost('m.facebook.com')).toBe(true);
    expect(isAllowedFacebookHost('web.facebook.com')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isAllowedFacebookHost('evil.example.com')).toBe(false);
    expect(isAllowedFacebookHost('facebook.com.evil.example')).toBe(false);
    expect(isAllowedFacebookHost('notfacebook.com')).toBe(false);
    expect(isAllowedFacebookHost('scontent.xx.fbcdn.net')).toBe(false);
  });
});

describe('isAllowedFacebookImageHost', () => {
  it('allows fbcdn.net and its subdomains', () => {
    expect(isAllowedFacebookImageHost('fbcdn.net')).toBe(true);
    expect(isAllowedFacebookImageHost('scontent.xx.fbcdn.net')).toBe(true);
    expect(isAllowedFacebookImageHost('scontent-bkk1-1.xx.fbcdn.net')).toBe(true);
  });

  it('also allows the facebook.com hosts themselves', () => {
    expect(isAllowedFacebookImageHost('www.facebook.com')).toBe(true);
  });

  it('rejects a lookalike domain', () => {
    expect(isAllowedFacebookImageHost('fbcdn.net.evil.example')).toBe(false);
    expect(isAllowedFacebookImageHost('notfbcdn.net')).toBe(false);
  });
});
