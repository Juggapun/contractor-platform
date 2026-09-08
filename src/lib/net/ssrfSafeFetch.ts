/**
 * Generic SSRF-safe fetch helper. Originally built for Issue #42's
 * Facebook post/og:image HTML scraper; that scraper was removed in
 * Issue #44 (replaced by a proper Graph API importer — see
 * src/lib/facebook/), but this mechanics-only function is unrelated to
 * *what* it fetches and is reused by the Graph API client (Graph API
 * calls to graph.facebook.com, and downloading a post's image from
 * *.fbcdn.net) — hence living under src/lib/net/ rather than
 * src/lib/articles/ or src/lib/facebook/.
 *
 * Layered defenses:
 *   1. Hostname allowlist (caller-supplied `isAllowedHost`) — checked
 *      before any network call, and again on every redirect hop.
 *   2. DNS resolution check (ssrfGuard.ts) — the resolved address must
 *      be a real public IP, not private/loopback/link-local/reserved.
 *   3. Redirects are never auto-followed (`redirect: 'manual'`) — each
 *      hop's `Location` is parsed and re-validated against the same two
 *      checks before being followed, up to MAX_REDIRECTS times.
 *   4. A request timeout (AbortController) and a response-size cap
 *      (aborted mid-stream once exceeded) on every fetch.
 */
import { resolvesToPublicAddressOnly } from './ssrfGuard';

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const USER_AGENT = 'Mozilla/5.0 (compatible; HaChangBot/1.0; +https://hachang.example/about)';

export type SsrfSafeFetchResult =
  | { ok: true; bytes: Uint8Array; contentType: string | null }
  | { ok: false; error: string };

/**
 * Fetches `url`, refusing to proceed unless the hostname passes
 * `isAllowedHost` AND `checkPublicAddress` — re-checked on every
 * redirect hop, never just the first URL. `maxBytes` bounds how much of
 * the response body is ever read into memory.
 *
 * `checkPublicAddress` defaults to the real DNS-based public-IP check
 * (ssrfGuard.ts) and every production call site relies on that default —
 * it's a parameter (not a hardcoded import) solely so this function's
 * actual fetch/redirect/streaming/size-cap mechanics can be exercised in
 * a unit test against a local test server (which necessarily resolves
 * to a loopback address the real check would correctly refuse) without
 * ever touching, weakening, or bypassing the production SSRF guard
 * itself — see ssrfSafeFetch.test.ts.
 */
export async function ssrfSafeFetch(
  url: URL,
  isAllowedHost: (hostname: string) => boolean,
  maxBytes: number,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  checkPublicAddress: (hostname: string) => Promise<boolean> = resolvesToPublicAddressOnly
): Promise<SsrfSafeFetchResult> {
  let currentUrl = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedHost(currentUrl.hostname)) {
      return { ok: false, error: `hostname not allowed: ${currentUrl.hostname}` };
    }
    if (!(await checkPublicAddress(currentUrl.hostname))) {
      return { ok: false, error: `hostname does not resolve to a public address: ${currentUrl.hostname}` };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,image/*;q=0.8,*/*;q=0.5' },
      });
    } catch (err) {
      return { ok: false, error: `fetch failed: ${err instanceof Error ? err.message : String(err)}` };
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return { ok: false, error: `redirect with no Location header (status ${response.status})` };
      let nextUrl: URL;
      try {
        nextUrl = new URL(location, currentUrl);
      } catch {
        return { ok: false, error: 'redirect Location header is not a valid URL' };
      }
      // No protocol downgrade (https -> http) on a redirect hop — must
      // stay on the same protocol the request started with. Compared
      // against `currentUrl`'s own protocol rather than hardcoding
      // 'https:' so this same mechanics/redirect-handling logic is
      // exercisable against a plain local http test server without
      // weakening the real guarantee: every production entry point only
      // ever calls ssrfSafeFetch with an https URL to begin with, so
      // currentUrl's protocol is always 'https:' in production
      // regardless.
      if (nextUrl.protocol !== currentUrl.protocol) {
        return { ok: false, error: 'redirect target protocol does not match the original request' };
      }
      currentUrl = nextUrl;
      continue; // re-validate the new host at the top of the loop
    }

    if (!response.ok) {
      return { ok: false, error: `unexpected status ${response.status}` };
    }
    if (!response.body) {
      return { ok: false, error: 'empty response body' };
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, error: `response exceeded ${maxBytes} bytes` };
      }
      chunks.push(value);
    }
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, bytes: combined, contentType: response.headers.get('content-type') };
  }

  return { ok: false, error: 'too many redirects' };
}
