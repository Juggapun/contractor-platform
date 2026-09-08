/**
 * Issue #42 (Articles, comment 5582752011) — server-side, SSRF-safe
 * fetch of a Facebook post's og:image. Server-only (uses `node:dns`).
 *
 * Layered defenses, applied to BOTH the post-page fetch and the
 * extracted-image fetch:
 *   1. Hostname allowlist (facebookUrl.ts) — checked before any network
 *      call, and again on every redirect hop.
 *   2. DNS resolution check (ssrfGuard.ts) — the resolved address must
 *      be a real public IP, not private/loopback/link-local/reserved.
 *   3. Redirects are never auto-followed (`redirect: 'manual'`) — each
 *      hop's `Location` is parsed and re-validated against the same two
 *      checks before being followed, up to MAX_REDIRECTS times.
 *   4. A request timeout (AbortController) and a response-size cap
 *      (aborted mid-stream once exceeded) on every fetch.
 *
 * No caller ever passes a URL that skipped facebookUrl.ts's validation —
 * `fetchFacebookOgImage()` still re-validates internally rather than
 * trusting the caller, since a future call site forgetting that step
 * would otherwise silently reopen the whole SSRF surface.
 */
import { isAllowedFacebookHost, isAllowedFacebookImageHost } from './facebookUrl';
import { resolvesToPublicAddressOnly } from './ssrfGuard';
import { extractOgImageUrl, looksLikeFacebookLoginWall } from './ogImageParser';

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 3 * 1024 * 1024; // og:image lives in <head>, no need to read a whole large page
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
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
 * itself — see ogImageFetch.test.ts.
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
      // exercisable against a plain local http test server (see
      // ogImageFetch.test.ts) without weakening the real guarantee: every
      // production entry point (fetchFacebookOgImage) only ever calls
      // ssrfSafeFetch with an https URL to begin with, so currentUrl's
      // protocol is always 'https:' in production regardless.
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

export type OgImageResult =
  | { ok: true; bytes: Uint8Array; contentType: string | null; sourceImageUrl: string }
  | { ok: false; error: string };

/**
 * `postUrl` must already have passed `parseFacebookPostUrl()` — this
 * function still re-validates the host itself (see header comment)
 * before making any request.
 */
export async function fetchFacebookOgImage(postUrl: URL): Promise<OgImageResult> {
  if (!isAllowedFacebookHost(postUrl.hostname)) {
    return { ok: false, error: 'ไม่ใช่ URL ของ Facebook ที่อนุญาต' };
  }

  const pageResult = await ssrfSafeFetch(postUrl, isAllowedFacebookHost, MAX_HTML_BYTES);
  if (!pageResult.ok) {
    console.error('fetchFacebookOgImage: post page fetch failed', pageResult.error, { postUrl: postUrl.toString() });
    // Distinct, honest reasons instead of one generic message — this is
    // exactly what a Production admin needs to tell "the link is dead"
    // apart from "Facebook timed out us out" apart from "our own
    // network/allowlist refused this" (see comment 5584109190, point 1:
    // "ต้องแยก failure reason ให้ชัดเจน ไม่หลอกว่าดึงสำเร็จ").
    if (pageResult.error.includes('unexpected status 404')) {
      return { ok: false, error: 'ไม่พบโพสต์นี้ (404) — โพสต์อาจถูกลบหรือ URL ไม่ถูกต้อง' };
    }
    if (/unexpected status (401|403)/.test(pageResult.error)) {
      return { ok: false, error: 'Facebook ปฏิเสธการเข้าถึงโพสต์นี้ — อาจเป็นโพสต์ส่วนตัวหรือต้องเข้าสู่ระบบจึงจะดูได้' };
    }
    if (pageResult.error.startsWith('fetch failed') || pageResult.error.includes('aborted')) {
      return { ok: false, error: 'เชื่อมต่อ Facebook ไม่สำเร็จหรือหมดเวลา กรุณาลองใหม่อีกครั้ง' };
    }
    return { ok: false, error: 'ไม่สามารถเข้าถึงโพสต์ Facebook ได้ กรุณาตรวจสอบ URL' };
  }

  const html = new TextDecoder('utf-8', { fatal: false }).decode(pageResult.bytes);
  const imageUrlRaw = extractOgImageUrl(html);
  if (!imageUrlRaw) {
    if (looksLikeFacebookLoginWall(html)) {
      return {
        ok: false,
        error: 'Facebook ต้องเข้าสู่ระบบเพื่อดูโพสต์นี้ ระบบไม่สามารถดึงรูปจากโพสต์ที่ต้องล็อกอิน/โพสต์ส่วนตัวได้ กรุณาใช้โพสต์ที่เปิดเป็นสาธารณะ',
      };
    }
    return { ok: false, error: 'ไม่พบรูปภาพในโพสต์นี้ (ไม่มี og:image)' };
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(imageUrlRaw);
  } catch {
    return { ok: false, error: 'รูปแบบ URL รูปภาพจากโพสต์ไม่ถูกต้อง' };
  }
  if (imageUrl.protocol !== 'https:' || !isAllowedFacebookImageHost(imageUrl.hostname)) {
    return { ok: false, error: 'แหล่งที่มาของรูปภาพไม่น่าเชื่อถือ' };
  }

  const imageResult = await ssrfSafeFetch(imageUrl, isAllowedFacebookImageHost, MAX_IMAGE_BYTES);
  if (!imageResult.ok) {
    console.error('fetchFacebookOgImage: image fetch failed', imageResult.error, { imageUrl: imageUrl.toString() });
    return { ok: false, error: 'ไม่สามารถดาวน์โหลดรูปภาพจากโพสต์ได้' };
  }

  return {
    ok: true,
    bytes: imageResult.bytes,
    contentType: imageResult.contentType,
    sourceImageUrl: imageUrl.toString(),
  };
}
