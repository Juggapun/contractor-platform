/**
 * Follow-up to Issue #23 — "Image Optimization / Cost Control." The
 * 5MB `MAX_IMAGE_BYTES` cap in imageValidation.ts is the maximum
 * ACCEPTED upload size, never the target STORED/SERVED size — every
 * validated upload passes through here before it ever reaches
 * contractorMedia.ts's Storage upload, and only the re-encoded output
 * of this module is ever written to Storage. The raw validated bytes
 * (`ValidatedImage.bytes`) are used as decode input only and never
 * persisted anywhere — this is also what keeps "avoid unnecessary
 * duplicate originals" true: `portfolio_images.original_url` stays
 * unpopulated, exactly as it already was before this change (see
 * 0006_portfolio_images.sql's own "kept for future use, never served
 * directly to users" comment).
 *
 * Server-only (uses `sharp`, a native Node addon — never importable
 * from client code). Every variant is re-encoded to JPEG regardless of
 * the input format: this project's own portfolio/profile images are
 * real-world photos (construction work, business avatars), not
 * illustrations needing an alpha channel, so JPEG's much better
 * photographic compression at a given quality is the right trade — a
 * PNG with real transparency gets flattened onto white, a deliberate,
 * acceptable loss for this content type. `sharp().rotate()` bakes in
 * any EXIF orientation before the pixels are touched (so a
 * phone-camera photo doesn't come out sideways once EXIF is stripped);
 * NOT calling `.withMetadata()` is what strips all EXIF/GPS/ICC
 * metadata by default — sharp's own documented behavior, and the
 * actual mechanism satisfying "avoid exposing private/... data in
 * public image metadata" (a phone photo's EXIF can carry the exact GPS
 * coordinates it was taken at; that must never reach a public bucket).
 *
 * Sizing targets are dimension caps + a target byte ceiling with a
 * step-down quality search (no single sharp() call can target a byte
 * count directly) — landing near, not exactly at, the requested bands;
 * `minQuality` is a floor so a huge/complex photo that can't hit the
 * target without visibly destroying it still produces a reasonable
 * image rather than degrading indefinitely.
 */
import sharp, { type OutputInfo } from 'sharp';

export type OptimizedImage = {
  ok: true;
  bytes: Buffer;
  contentType: 'image/jpeg';
  extension: 'jpg';
  width: number;
  height: number;
};
export type OptimizationFailure = { ok: false; error: string };

interface VariantSpec {
  /** Longest edge is capped to this; `withoutEnlargement` means a
   * smaller source image is never upscaled. */
  maxDimension: number;
  targetMaxBytes: number;
  initialQuality: number;
  minQuality: number;
}

/** Search issue's target: "~100-200 KB where practical" for grid/list
 * thumbnails. 480px covers this project's largest actual thumbnail box
 * (300x200 CSS, app/contractors/[slug]/page.tsx) at up to ~1.6x pixel
 * density without ever needing to serve anything bigger there. */
export const THUMBNAIL_SPEC: VariantSpec = {
  maxDimension: 480,
  targetMaxBytes: 200 * 1024,
  initialQuality: 75,
  minQuality: 40,
};

/** Issue's target: "~300 KB-1 MB where practical" for the detail
 * variant. `portfolio_images.image_url` is not rendered anywhere in
 * this codebase today (only `thumbnail_url` is — see
 * src/lib/data/portfolio.ts and the migration's own "never serve
 * image_url [in listings]" comment) but the column exists for a future
 * larger/lightbox view, so this variant is sized larger than the
 * thumbnail rather than reused from it. */
export const DETAIL_SPEC: VariantSpec = {
  maxDimension: 1600,
  targetMaxBytes: 1000 * 1024,
  initialQuality: 82,
  minQuality: 45,
};

/** contractors.profile_image_url has only ONE variant (no separate
 * thumbnail column on that table — adding one would be a schema change
 * beyond what this cost-control task asked for) and is never rendered
 * larger than 96x96 (profile detail page) or a 400x300 CSS box (search
 * card) anywhere in this codebase (verified directly against
 * app/contractors/[slug]/page.tsx and ContractorCard.tsx) — 800px
 * comfortably covers both at high pixel density. Deliberately smaller
 * than the portfolio detail target: generating a ~1MB file for
 * something never displayed past 400px would be pure storage cost with
 * no visible benefit, which is the opposite of what this task asks for. */
export const PROFILE_SPEC: VariantSpec = {
  maxDimension: 800,
  targetMaxBytes: 300 * 1024,
  initialQuality: 80,
  minQuality: 45,
};

async function encodeJpegVariant(bytes: Uint8Array, spec: VariantSpec): Promise<OptimizedImage | OptimizationFailure> {
  try {
    const pipeline = sharp(Buffer.from(bytes))
      .rotate()
      .resize({ width: spec.maxDimension, height: spec.maxDimension, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' });

    let quality = spec.initialQuality;
    let data: Buffer;
    let info: OutputInfo;
    for (;;) {
      const result = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer({ resolveWithObject: true });
      data = result.data;
      info = result.info;
      if (data.length <= spec.targetMaxBytes || quality <= spec.minQuality) break;
      quality -= 10;
    }

    return { ok: true, bytes: data, contentType: 'image/jpeg', extension: 'jpg', width: info.width, height: info.height };
  } catch (err) {
    // A file can pass imageValidation.ts's magic-byte sniff (a valid
    // header) yet still be truncated/corrupt past that point — sharp's
    // decoder is the thing that actually reads the whole image, so this
    // is a real, reachable failure case, not defensive-only code.
    console.error('image optimization: sharp failed to process the upload', err);
    return { ok: false, error: 'ไม่สามารถประมวลผลไฟล์รูปภาพได้ กรุณาลองใหม่ด้วยไฟล์อื่น' };
  }
}

export async function generatePortfolioVariants(
  bytes: Uint8Array
): Promise<{ ok: true; thumbnail: OptimizedImage; detail: OptimizedImage } | OptimizationFailure> {
  const thumbnail = await encodeJpegVariant(bytes, THUMBNAIL_SPEC);
  if (!thumbnail.ok) return thumbnail;
  const detail = await encodeJpegVariant(bytes, DETAIL_SPEC);
  if (!detail.ok) return detail;
  return { ok: true, thumbnail, detail };
}

export async function generateProfileVariant(bytes: Uint8Array): Promise<OptimizedImage | OptimizationFailure> {
  return encodeJpegVariant(bytes, PROFILE_SPEC);
}
