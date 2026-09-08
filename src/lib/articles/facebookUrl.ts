/**
 * Issue #42 (Articles, comment 5582752011) — validates that an
 * admin-supplied string is a real Facebook post URL before it is ever
 * passed to `fetch()` server-side. This is the first, primary SSRF
 * defense (see ssrfGuard.ts for the second, DNS-based one used
 * alongside it): a strict, literal hostname allowlist means an attacker
 * cannot get e.g. `http://169.254.169.254/` or `http://localhost/`
 * (AWS/GCP metadata endpoints, internal services) past this check no
 * matter how it's disguised — there is no pattern-matching or substring
 * check here for something to bypass, only an exact `Set` membership
 * test against a fixed list of real Facebook hostnames that are not
 * attacker-controlled.
 *
 * Pure/synchronous — no network access — so it's fully unit-testable.
 */

const ALLOWED_FACEBOOK_HOSTS = new Set(['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com']);

const MAX_URL_LENGTH = 2000; // matches the DB's articles_facebook_post_url_length check

export type ParsedFacebookUrl = { ok: true; url: URL } | { ok: false; error: string };

export function parseFacebookPostUrl(input: string): ParsedFacebookUrl {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: 'กรุณาระบุ URL ของโพสต์ Facebook' };
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, error: 'URL ยาวเกินไป' };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: 'รูปแบบ URL ไม่ถูกต้อง' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, error: 'URL ต้องเป็น https เท่านั้น' };
  }
  if (!ALLOWED_FACEBOOK_HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, error: 'ต้องเป็น URL ของโพสต์ Facebook เท่านั้น (facebook.com)' };
  }

  return { ok: true, url };
}

/** Exported for ssrfGuard/ogImageFetch to reuse the same host set when
 * validating a same-host redirect target, and for unit tests. */
export function isAllowedFacebookHost(hostname: string): boolean {
  return ALLOWED_FACEBOOK_HOSTS.has(hostname.toLowerCase());
}

/** The extracted og:image URL is served from Facebook's CDN
 * (`*.fbcdn.net`), not facebook.com itself — a separate, deliberately
 * narrower allowlist for the second fetch (the image download), not the
 * same set used for the post-page fetch above. */
export function isAllowedFacebookImageHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === 'fbcdn.net' || lower.endsWith('.fbcdn.net') || ALLOWED_FACEBOOK_HOSTS.has(lower);
}
