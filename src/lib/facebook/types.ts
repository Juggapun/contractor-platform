/**
 * Issue #44 — typed shapes for the subset of the Graph API response
 * this app actually reads. Deliberately narrow (only the fields
 * requested — see graphApi.ts's own `fields=` query param) rather than
 * a full Graph API SDK type, matching this codebase's established
 * preference for typing exactly what's used over a generic client.
 */

export type GraphApiPost = {
  id: string;
  message?: string;
  created_time: string;
  permalink_url: string;
  full_picture?: string;
};

export type GraphApiError = {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

export type GraphApiPostsResponse = { data: GraphApiPost[] };
export type GraphApiErrorResponse = { error: GraphApiError };

/** Narrow runtime check — never trusts the Graph API response's shape
 * without verifying it, since this app parses it as untyped JSON.
 * Fields beyond `id`/`created_time`/`permalink_url` are optional in the
 * real API (a post can lack `message` or `full_picture`), so only those
 * three plus the right primitive types are required here. */
export function isGraphApiPost(value: unknown): value is GraphApiPost {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.created_time === 'string' &&
    typeof v.permalink_url === 'string' &&
    (v.message === undefined || typeof v.message === 'string') &&
    (v.full_picture === undefined || typeof v.full_picture === 'string')
  );
}

export function isGraphApiErrorResponse(value: unknown): value is GraphApiErrorResponse {
  if (typeof value !== 'object' || value === null) return false;
  const err = (value as Record<string, unknown>).error;
  if (typeof err !== 'object' || err === null) return false;
  const e = err as Record<string, unknown>;
  return typeof e.message === 'string' && typeof e.type === 'string' && typeof e.code === 'number';
}
