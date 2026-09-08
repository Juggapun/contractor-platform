/**
 * Issue #42 (Articles) — the actual "fetch this post's og:image and
 * store our own copy" pipeline, shared by both the create (POST) and
 * edit-URL (PATCH) admin routes so the logic exists in exactly one
 * place. Every failure path writes `cover_image_status: 'failed'` with
 * a short admin-facing `cover_image_error` rather than throwing — the
 * calling route already inserted/updated the row before this runs, so
 * a failure here must still leave a real, visible row behind (the
 * Owner's explicit "does not create fake content" requirement is about
 * the IMAGE, not about hiding the admin's own entry when the image step
 * fails).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseFacebookPostUrl } from './facebookUrl';
import { fetchFacebookOgImage } from './ogImageFetch';
import { sniffImageType } from '../uploads/imageValidation';
import { generateArticleCoverVariant } from '../uploads/imageOptimization';
import {
  deleteContractorImageBestEffort,
  extractContractorMediaPath,
  generateArticleCoverPath,
  uploadContractorImage,
} from '../storage/contractorMedia';

async function markFailed(adminClient: SupabaseClient, articleId: string, error: string): Promise<void> {
  const { error: updateError } = await adminClient
    .from('articles')
    .update({ cover_image_status: 'failed', cover_image_error: error, cover_image_url: null })
    .eq('id', articleId);
  if (updateError) {
    console.error('refreshArticleCoverImage: failed to record failure status', updateError, { articleId });
  }
}

/**
 * Fetches `facebookPostUrl`'s og:image, optimizes it, uploads it to our
 * own Storage, and updates `articles` row `articleId` with the result —
 * always leaves the row in either 'success' or 'failed' status, never
 * throws. `previousCoverImageUrl` (if any) is best-effort deleted only
 * AFTER the new image is successfully stored, so a failed re-fetch never
 * leaves an article with no image at all when it previously had one.
 */
export async function refreshArticleCoverImage(
  adminClient: SupabaseClient,
  articleId: string,
  facebookPostUrl: string,
  previousCoverImageUrl: string | null
): Promise<void> {
  const parsed = parseFacebookPostUrl(facebookPostUrl);
  if (!parsed.ok) {
    await markFailed(adminClient, articleId, parsed.error);
    return;
  }

  const fetchResult = await fetchFacebookOgImage(parsed.url);
  if (!fetchResult.ok) {
    await markFailed(adminClient, articleId, fetchResult.error);
    return;
  }

  if (!sniffImageType(fetchResult.bytes)) {
    await markFailed(adminClient, articleId, 'รูปภาพจากโพสต์ไม่ใช่ไฟล์รูปภาพที่รองรับ (JPEG, PNG หรือ WebP)');
    return;
  }

  const optimized = await generateArticleCoverVariant(fetchResult.bytes);
  if (!optimized.ok) {
    await markFailed(adminClient, articleId, optimized.error);
    return;
  }

  let publicUrl: string;
  try {
    const path = generateArticleCoverPath(optimized.extension);
    publicUrl = await uploadContractorImage(adminClient, path, optimized.bytes, optimized.contentType);
  } catch (err) {
    console.error('refreshArticleCoverImage: storage upload failed', err, { articleId });
    await markFailed(adminClient, articleId, 'ไม่สามารถบันทึกรูปภาพได้');
    return;
  }

  const { error: successUpdateError } = await adminClient
    .from('articles')
    .update({ cover_image_status: 'success', cover_image_error: null, cover_image_url: publicUrl })
    .eq('id', articleId);
  if (successUpdateError) {
    console.error('refreshArticleCoverImage: failed to record success status', successUpdateError, { articleId });
  }

  if (previousCoverImageUrl) {
    const oldPath = extractContractorMediaPath(previousCoverImageUrl);
    if (oldPath) await deleteContractorImageBestEffort(adminClient, oldPath);
  }
}
