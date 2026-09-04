/**
 * Issue #23 — Supabase Storage access for contractor profile/portfolio
 * images. Server-only: every call site passes the service_role admin
 * client (src/lib/supabase/admin.ts), the same trust boundary already
 * used for every other privileged write in this route family
 * (contractors row insert, role promotion) — a contractor's upload is
 * authorized by requireContractorOwner()/resolveRequestingUser() first
 * (verified bearer token, ownership confirmed against real DB rows),
 * then executed here with elevated Storage access, never with the
 * caller's own anon-key session. This mirrors how every other
 * server-side write in app/api/contractors/** already works.
 *
 * Bucket is PUBLIC (world-readable by URL) — the only storage model
 * this schema has ever used for images (contractors.profile_image_url /
 * portfolio_images.image_url are always plain public URL strings, no
 * signing/expiry concept anywhere in this codebase). A pending/rejected/
 * suspended contractor's image objects therefore remain fetchable by
 * anyone who has the exact URL, even though the DB row referencing them
 * is correctly hidden by RLS — accepted, not overlooked: every path
 * component below the bucket is a server-generated, unguessable
 * crypto.randomUUID() segment (never the contractor's slug, sort_order,
 * or anything else a visitor could enumerate), and that URL is never
 * linked anywhere public until the contractor is approved (the profile
 * page 404s pre-approval — app/contractors/[slug]/page.tsx). This is
 * the same "public bucket + unguessable path, not per-object ACLs"
 * trade-off most Supabase apps make for exactly this kind of public
 * image gallery; a stricter model (signed URLs, authenticated Storage
 * RLS) would also break the plain `<img src>` rendering approved
 * profiles rely on for logged-out visitors, which is the actual common
 * case this table exists to serve.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

export const CONTRACTOR_MEDIA_BUCKET = 'contractor-media';

export type ContractorMediaKind = 'profile' | 'portfolio';

/** Never derived from anything client-supplied (filename, project name,
 * sort order) — see this file's header comment on why the path itself
 * must stay unguessable, and imageValidation.ts on why the extension
 * comes from the sniffed magic bytes, never the client's claimed one. */
export function generateContractorMediaPath(
  contractorId: string,
  kind: ContractorMediaKind,
  extension: string
): string {
  return `${contractorId}/${kind}-${randomUUID()}.${extension}`;
}

export async function uploadContractorImage(
  adminClient: SupabaseClient,
  path: string,
  bytes: Uint8Array,
  contentType: string
): Promise<string> {
  const { error } = await adminClient.storage
    .from(CONTRACTOR_MEDIA_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;

  const { data } = adminClient.storage.from(CONTRACTOR_MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Best-effort — a failed delete (object already gone, Storage
 * temporarily unreachable) must never block the DB-side operation
 * (row delete, or the new upload that's replacing this one) that
 * called it. Matches this codebase's established posture for every
 * other non-critical side effect (e.g. recordContactEvent). */
export async function deleteContractorImageBestEffort(adminClient: SupabaseClient, path: string): Promise<void> {
  try {
    const { error } = await adminClient.storage.from(CONTRACTOR_MEDIA_BUCKET).remove([path]);
    if (error) {
      console.error('deleteContractorImageBestEffort: remove failed', error.message, { path });
    }
  } catch (err) {
    console.error('deleteContractorImageBestEffort: Storage not reachable', err, { path });
  }
}

/** Derives the storage object path from a public URL this module
 * itself generated (getPublicUrl's own path suffix) — used only to
 * find what to delete when replacing/removing an image; never trusts
 * a client-supplied path directly. Returns null for anything that
 * doesn't look like one of this bucket's own URLs (e.g. a legacy/seed
 * URL from before this feature existed), so a delete attempt on it is
 * safely skipped rather than misparsed. */
export function extractContractorMediaPath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${CONTRACTOR_MEDIA_BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return publicUrl.slice(index + marker.length);
}
