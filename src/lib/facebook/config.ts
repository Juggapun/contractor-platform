/**
 * Issue #44 — server-only config for the Facebook Page Graph API
 * importer. Deliberately non-throwing (unlike src/lib/env.ts's
 * `requireEnv()`): this codebase's `npm run build` must keep succeeding
 * with no Facebook Page configured (there is no default value that
 * would make sense here — no fallback Page exists), and the admin UI
 * must show a clear, specific Thai message rather than a 500 when the
 * Owner hasn't set these up yet. Every call site checks `.ok` and shows
 * `getFacebookPageConfig()`'s own error text directly.
 *
 * `FACEBOOK_PAGE_ACCESS_TOKEN` is the one genuinely sensitive value
 * here — never `NEXT_PUBLIC_`-prefixed (that prefix is exactly what
 * would make Next.js inline it into the browser bundle), never logged,
 * never echoed back in any API response body (see graphApi.ts's own
 * error-mapping, which always substitutes a fixed Thai message and
 * never the raw Graph API error object that could otherwise leak
 * request/response metadata).
 */

const DEFAULT_GRAPH_API_VERSION = 'v21.0';

export type FacebookPageConfig = {
  pageId: string;
  pageAccessToken: string;
  graphApiVersion: string;
};

export type FacebookPageConfigResult = { ok: true; config: FacebookPageConfig } | { ok: false; error: string };

export function getFacebookPageConfig(): FacebookPageConfigResult {
  const pageId = process.env.FACEBOOK_PAGE_ID?.trim();
  const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();
  const graphApiVersion = process.env.FACEBOOK_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_API_VERSION;

  if (!pageId || !pageAccessToken) {
    return {
      ok: false,
      error:
        'ยังไม่ได้ตั้งค่าการเชื่อมต่อ Facebook Page (FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN) กรุณาติดต่อผู้ดูแลระบบเพื่อตั้งค่าก่อนใช้งานฟีเจอร์นี้',
    };
  }

  return { ok: true, config: { pageId, pageAccessToken, graphApiVersion } };
}
