/**
 * Issue #44 — downloads a Graph-API-returned post image, validates and
 * re-optimizes it, and stores our own copy in Supabase Storage. Mirrors
 * Issue #42's original refreshArticleCoverImage.ts pipeline (now
 * removed along with the HTML scraper it served) but the source is a
 * `full_picture` URL Graph API itself returned for a post our own Page
 * token can read — never a client-supplied URL, never HTML scraped/
 * parsed.
 *
 * Security requirement (Issue #44): "Restrict imported remote media to
 * URLs returned by the trusted Graph API flow; retain existing image
 * magic-byte/decode/size validation before storage" — enforced in that
 * exact order below: host allowlist -> SSRF-safe fetch -> magic-byte
 * sniff -> sharp decode/re-encode -> Storage upload. Never trusts a
 * claimed Content-Type from the HTTP response for anything.
 */
import { isAllowedFacebookImageHost } from '../articles/facebookUrl';
import { ssrfSafeFetch } from '../net/ssrfSafeFetch';
import { sniffImageType } from '../uploads/imageValidation';
import { generateArticleCoverVariant } from '../uploads/imageOptimization';
import { generateArticleCoverPath, uploadContractorImage } from '../storage/contractorMedia';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type ImportImageOutcome =
  | { status: 'success'; publicUrl: string }
  | { status: 'no-image' }
  | { status: 'failed'; error: string };

export async function importArticleCoverFromGraphApi(
  adminClient: SupabaseClient,
  imageUrlRaw: string | undefined
): Promise<ImportImageOutcome> {
  if (!imageUrlRaw) {
    return { status: 'no-image' };
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(imageUrlRaw);
  } catch {
    console.error('importArticleCoverFromGraphApi: full_picture was not a valid URL', { imageUrlRaw });
    return { status: 'failed', error: 'Facebook ส่ง URL รูปภาพที่ไม่ถูกต้องมาให้' };
  }
  if (imageUrl.protocol !== 'https:' || !isAllowedFacebookImageHost(imageUrl.hostname)) {
    console.error('importArticleCoverFromGraphApi: full_picture host not allowed', { hostname: imageUrl.hostname });
    return { status: 'failed', error: 'แหล่งที่มาของรูปภาพจาก Facebook ไม่น่าเชื่อถือ' };
  }

  const fetchResult = await ssrfSafeFetch(imageUrl, isAllowedFacebookImageHost, MAX_IMAGE_BYTES);
  if (!fetchResult.ok) {
    console.error('importArticleCoverFromGraphApi: image fetch failed', fetchResult.error);
    return { status: 'failed', error: 'ไม่สามารถดาวน์โหลดรูปภาพจากโพสต์ได้' };
  }

  if (!sniffImageType(fetchResult.bytes)) {
    return { status: 'failed', error: 'รูปภาพจากโพสต์ไม่ใช่ไฟล์รูปภาพที่รองรับ (JPEG, PNG หรือ WebP)' };
  }

  const optimized = await generateArticleCoverVariant(fetchResult.bytes);
  if (!optimized.ok) {
    return { status: 'failed', error: optimized.error };
  }

  try {
    const path = generateArticleCoverPath(optimized.extension);
    const publicUrl = await uploadContractorImage(adminClient, path, optimized.bytes, optimized.contentType);
    return { status: 'success', publicUrl };
  } catch (err) {
    console.error('importArticleCoverFromGraphApi: storage upload failed', err);
    return { status: 'failed', error: 'ไม่สามารถบันทึกรูปภาพได้' };
  }
}
