/**
 * Client-safe wrappers around the Phase 8 admin API
 * (app/api/admin/contractors/**). These are plain authenticated `fetch`
 * calls, not Supabase queries — the actual data access and authorization
 * happen server-side (app/api/admin/_lib/requireAdmin.ts); this module
 * just carries the bearer token and shapes the response for
 * AdminContractorQueue/AdminContractorDetail.
 */

export interface AdminGeoRef {
  id: number;
  name_th: string;
  slug: string;
}

export interface AdminCategoryRef {
  id: number;
  name_th: string;
  slug: string;
}

export interface AdminContractor {
  id: string;
  userId: string;
  businessName: string;
  slug: string;
  description: string | null;
  phone: string | null;
  lineId: string | null;
  facebookUrl: string | null;
  websiteUrl: string | null;
  address: string | null;
  yearsExperience: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  verificationStatus: 'unverified' | 'verified';
  profileImageUrl: string | null;
  province: AdminGeoRef | null;
  district: AdminGeoRef | null;
  categories: AdminCategoryRef[];
  createdAt: string;
}

// Issue #25 — one submitted portfolio image, as returned by
// GET /api/admin/contractors/[id] for admin approval review. Same
// image_url/thumbnail_url pair every other part of this app already
// uses (see src/lib/data/portfolio.ts) — image_url is the larger
// variant, thumbnail_url the smaller one; the review UI decides which
// to show where, this is just the data shape.
export interface AdminPortfolioImage {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  projectName: string | null;
}

// Phase 10: event_type keys match public.contact_events' CHECK constraint
// (0016_contact_events_analytics.sql) — 'profile_view' is tallied here too
// for completeness, even though it's also separately available as the
// denormalized `profileViewCount` field below.
export interface AdminContactEventTally {
  phone: number;
  line: number;
  facebook: number;
  website: number;
  profile_view: number;
}

export interface AdminContractorDetailResult {
  contractor: AdminContractor;
  profileViewCount: number;
  contactEventsTally: AdminContactEventTally;
  portfolioImages: AdminPortfolioImage[];
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

export async function fetchAdminContractors(
  status: string,
  token: string
): Promise<AdminApiResult<AdminContractor[]>> {
  const response = await authedFetch(`/api/admin/contractors?status=${encodeURIComponent(status)}`, token);
  const body = await response.json();
  if (!response.ok || !body.ok) {
    return { ok: false, status: response.status, error: body.error ?? 'เกิดข้อผิดพลาด' };
  }
  return { ok: true, data: body.contractors as AdminContractor[] };
}

export async function fetchAdminContractorDetail(
  id: string,
  token: string
): Promise<AdminApiResult<AdminContractorDetailResult>> {
  const response = await authedFetch(`/api/admin/contractors/${encodeURIComponent(id)}`, token);
  const body = await response.json();
  if (!response.ok || !body.ok) {
    return { ok: false, status: response.status, error: body.error ?? 'เกิดข้อผิดพลาด' };
  }
  return {
    ok: true,
    data: {
      contractor: body.contractor as AdminContractor,
      profileViewCount: body.profileViewCount as number,
      contactEventsTally: body.contactEventsTally as AdminContactEventTally,
      portfolioImages: body.portfolioImages as AdminPortfolioImage[],
    },
  };
}

export async function approveContractor(
  id: string,
  token: string
): Promise<AdminApiResult<{ businessName: string; slug: string; status: string }>> {
  const response = await authedFetch(`/api/admin/contractors/${encodeURIComponent(id)}/approve`, token, {
    method: 'POST',
  });
  const body = await response.json();
  if (!response.ok || !body.ok) {
    return { ok: false, status: response.status, error: body.error ?? 'เกิดข้อผิดพลาด' };
  }
  return { ok: true, data: body };
}

export async function rejectContractor(
  id: string,
  reason: string,
  token: string
): Promise<AdminApiResult<{ businessName: string; slug: string; status: string }>> {
  const response = await authedFetch(`/api/admin/contractors/${encodeURIComponent(id)}/reject`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  const body = await response.json();
  if (!response.ok || !body.ok) {
    return { ok: false, status: response.status, error: body.error ?? 'เกิดข้อผิดพลาด' };
  }
  return { ok: true, data: body };
}
