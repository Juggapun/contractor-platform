/**
 * Client-safe wrappers around the admin Articles API
 * (app/api/admin/articles/**), for Issue #42's admin-managed Home
 * "บทความ & เคล็ดลับ" entries. Plain authenticated `fetch` calls, not
 * Supabase queries — matches the same shape as
 * src/lib/data/adminContractors.ts's own wrappers, including its
 * per-module `authedFetch` helper (this codebase doesn't share one
 * across admin data modules — see that file).
 */

export interface AdminArticle {
  id: string;
  facebook_post_url: string;
  title: string;
  cover_image_url: string | null;
  cover_image_status: 'pending' | 'success' | 'failed';
  cover_image_error: string | null;
  created_at: string;
  updated_at: string;
}

export type AdminApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function authedFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchAdminArticles(token: string): Promise<AdminApiResult<AdminArticle[]>> {
  const response = await authedFetch('/api/admin/articles', token);
  const body = await response.json();
  if (!response.ok || !body.ok) {
    return { ok: false, status: response.status, error: body.error ?? 'เกิดข้อผิดพลาด' };
  }
  return { ok: true, data: body.articles as AdminArticle[] };
}

export async function createAdminArticle(
  facebookPostUrl: string,
  title: string,
  token: string
): Promise<AdminApiResult<AdminArticle>> {
  const response = await authedFetch('/api/admin/articles', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ facebookPostUrl, title }),
  });
  const body = await response.json();
  if (!response.ok || !body.ok) {
    return { ok: false, status: response.status, error: body.error ?? 'เกิดข้อผิดพลาด' };
  }
  return { ok: true, data: body.article as AdminArticle };
}

export async function updateAdminArticle(
  id: string,
  fields: { facebookPostUrl?: string; title?: string },
  token: string
): Promise<AdminApiResult<AdminArticle>> {
  const response = await authedFetch(`/api/admin/articles/${encodeURIComponent(id)}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  const body = await response.json();
  if (!response.ok || !body.ok) {
    return { ok: false, status: response.status, error: body.error ?? 'เกิดข้อผิดพลาด' };
  }
  return { ok: true, data: body.article as AdminArticle };
}

export async function deleteAdminArticle(id: string, token: string): Promise<AdminApiResult<null>> {
  const response = await authedFetch(`/api/admin/articles/${encodeURIComponent(id)}`, token, { method: 'DELETE' });
  const body = await response.json();
  if (!response.ok || !body.ok) {
    return { ok: false, status: response.status, error: body.error ?? 'เกิดข้อผิดพลาด' };
  }
  return { ok: true, data: null };
}
