/**
 * Issue #44 — Meta Graph API client for our own Facebook Page. Only
 * ever calls `graph.facebook.com` with our server-held Page Access
 * Token (src/lib/facebook/config.ts) — never accepts a client-supplied
 * Page ID or token (see the admin routes: the only client input is a
 * bounded `limit` for the list call and a `postId` string for the
 * single-post call, both just addressing *which* of our own Page's
 * posts to read, never *whose* Page or *which* token).
 *
 * Reuses the same SSRF-safe fetch mechanics as the rest of this
 * codebase's outbound-fetch surface (src/lib/net/ssrfSafeFetch.ts) even
 * though graph.facebook.com is Meta's own trusted API host, not
 * attacker-influenced input — defense-in-depth, and it costs nothing to
 * reuse infrastructure that's already there and already tested.
 */
import { ssrfSafeFetch } from '../net/ssrfSafeFetch';
import { getFacebookPageConfig } from './config';
import {
  isGraphApiErrorResponse,
  isGraphApiPost,
  type GraphApiPost,
} from './types';

const GRAPH_API_HOST = 'graph.facebook.com';
const POST_FIELDS = 'id,message,created_time,permalink_url,full_picture';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const DEFAULT_POSTS_LIMIT = 20;

function isGraphApiHost(hostname: string): boolean {
  return hostname.toLowerCase() === GRAPH_API_HOST;
}

/**
 * Maps a raw Graph API error object to a fixed, honest Thai message —
 * never echoes `error.message`/`fbtrace_id` back to the client (those
 * can carry request metadata, and a raw upstream error string is not
 * something an Admin UI should have to interpret). Codes per Meta's
 * own documented error code reference.
 */
export function mapGraphApiError(code: number, type: string): string {
  // Specific codes checked before the generic OAuthException catch-all —
  // Meta's real permission errors (code 10 and some 200s) are
  // themselves usually typed 'OAuthException' too, so checking `type`
  // first would misreport a permission error as an expired token.
  if (code === 200 || code === 10) {
    return 'ไม่มีสิทธิ์เข้าถึงข้อมูลของเพจนี้ กรุณาตรวจสอบสิทธิ์ (permissions) ของ Access Token';
  }
  if (code === 4 || code === 17 || code === 32 || code === 613) {
    return 'Facebook จำกัดจำนวนคำขอชั่วคราว (rate limit) กรุณาลองใหม่อีกครั้งภายหลัง';
  }
  if (code === 100) {
    return 'คำขอไปยัง Facebook ไม่ถูกต้อง (พารามิเตอร์ผิดพลาด)';
  }
  if (type === 'OAuthException' || code === 190) {
    return 'โทเค็นการเชื่อมต่อ Facebook หมดอายุหรือไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบเพื่ออัปเดต Page Access Token';
  }
  return 'เกิดข้อผิดพลาดจาก Facebook กรุณาลองใหม่อีกครั้ง';
}

export type FetchPostsResult = { ok: true; posts: GraphApiPost[] } | { ok: false; error: string };
export type FetchPostResult = { ok: true; post: GraphApiPost } | { ok: false; error: string };

async function callGraphApi(path: string, extraParams: Record<string, string>): Promise<
  { ok: true; json: unknown } | { ok: false; error: string }
> {
  const configResult = getFacebookPageConfig();
  if (!configResult.ok) {
    return { ok: false, error: configResult.error };
  }
  const { pageAccessToken, graphApiVersion } = configResult.config;

  const url = new URL(`https://${GRAPH_API_HOST}/${graphApiVersion}/${path}`);
  for (const [key, value] of Object.entries(extraParams)) {
    url.searchParams.set(key, value);
  }
  // access_token is a URL param per Meta's own Graph API convention —
  // set last and never logged: ssrfSafeFetch's own error paths log the
  // failing hostname, never the full URL/query string.
  url.searchParams.set('access_token', pageAccessToken);

  const result = await ssrfSafeFetch(url, isGraphApiHost, MAX_RESPONSE_BYTES);
  if (!result.ok) {
    console.error('Facebook Graph API request failed', { path, reason: result.error });
    if (result.error.startsWith('fetch failed') || result.error.includes('aborted')) {
      return { ok: false, error: 'เชื่อมต่อ Facebook ไม่สำเร็จหรือหมดเวลา กรุณาลองใหม่อีกครั้ง' };
    }
    return { ok: false, error: 'ไม่สามารถเชื่อมต่อ Facebook Graph API ได้' };
  }

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder('utf-8', { fatal: false }).decode(result.bytes));
  } catch {
    return { ok: false, error: 'ได้รับข้อมูลจาก Facebook ในรูปแบบที่ไม่ถูกต้อง' };
  }

  if (isGraphApiErrorResponse(json)) {
    console.error('Facebook Graph API returned an error', {
      path,
      code: json.error.code,
      type: json.error.type,
      // Never logging json.error.message/fbtrace_id — see this file's
      // header comment on why raw upstream error text isn't surfaced.
    });
    return { ok: false, error: mapGraphApiError(json.error.code, json.error.type) };
  }

  return { ok: true, json };
}

/** Bounded to at most `DEFAULT_POSTS_LIMIT` (20) — "fetch only the
 * latest bounded number of posts; do not create an unbounded feed
 * request" (Issue #44). `limit` is clamped, never trusted verbatim,
 * even though today's only caller passes a fixed constant. */
export async function fetchLatestPagePosts(limit: number = DEFAULT_POSTS_LIMIT): Promise<FetchPostsResult> {
  const configResult = getFacebookPageConfig();
  if (!configResult.ok) {
    return { ok: false, error: configResult.error };
  }
  const boundedLimit = Math.max(1, Math.min(limit, DEFAULT_POSTS_LIMIT));

  const result = await callGraphApi(`${configResult.config.pageId}/posts`, {
    fields: POST_FIELDS,
    limit: String(boundedLimit),
  });
  if (!result.ok) return result;

  const json = result.json as Record<string, unknown>;
  if (!Array.isArray(json.data) || !json.data.every(isGraphApiPost)) {
    console.error('Facebook Graph API posts response failed shape validation');
    return { ok: false, error: 'ได้รับข้อมูลโพสต์จาก Facebook ในรูปแบบที่ไม่ถูกต้อง' };
  }

  return { ok: true, posts: json.data };
}

/**
 * Re-fetches a single post by id directly from Graph API — used by the
 * import route so nothing about the post being imported (title
 * candidate, image URL, permalink) is ever trusted from client-echoed
 * data; only the id itself (which post to import) comes from the
 * client.
 *
 * Defense-in-depth: the Page Access Token can in practice only read
 * this configured Page's own posts, but this also checks the returned
 * post's own `id` starts with `${pageId}_` (Meta's own post-id
 * convention) as a belt-and-suspenders guard against parameter
 * confusion, rejecting anything else.
 */
export async function fetchPostById(postId: string): Promise<FetchPostResult> {
  const configResult = getFacebookPageConfig();
  if (!configResult.ok) {
    return { ok: false, error: configResult.error };
  }

  const result = await callGraphApi(postId, { fields: POST_FIELDS });
  if (!result.ok) return result;

  if (!isGraphApiPost(result.json)) {
    console.error('Facebook Graph API single-post response failed shape validation');
    return { ok: false, error: 'ได้รับข้อมูลโพสต์จาก Facebook ในรูปแบบที่ไม่ถูกต้อง' };
  }

  if (!result.json.id.startsWith(`${configResult.config.pageId}_`)) {
    console.error('Facebook Graph API single-post id did not match the configured Page', { postId });
    return { ok: false, error: 'โพสต์นี้ไม่ได้อยู่ในเพจที่กำหนดค่าไว้' };
  }

  return { ok: true, post: result.json };
}

const TITLE_MAX_LENGTH = 200; // matches articles_title_length (0024_articles.sql)

/** Derives a title candidate from a post's own text — the admin can
 * still edit this before/after import (Issue #44's own requirement).
 * Takes the first line (posts are often one short headline plus a
 * longer body) and falls back to a generic placeholder when the post
 * has no text at all (a photo-only post), never inventing content. */
export function deriveTitleCandidate(post: GraphApiPost): string {
  if (!post.message || !post.message.trim()) {
    return 'โพสต์จาก Facebook (ไม่มีข้อความ)';
  }
  const trimmedMessage = post.message.trim();
  const firstLine = (trimmedMessage.split('\n')[0] ?? '').trim();
  const candidate = firstLine || trimmedMessage;
  return candidate.length > TITLE_MAX_LENGTH ? `${candidate.slice(0, TITLE_MAX_LENGTH - 1)}…` : candidate;
}
