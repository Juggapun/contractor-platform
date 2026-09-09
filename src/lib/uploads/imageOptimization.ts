/**
 * Follow-up to Issue #23 — "Image Optimization / Cost Control." The
 * `MAX_IMAGE_BYTES` cap in imageValidation.ts (raised to 20MB by Issue
 * #27 — see that constant's own comment) is the maximum ACCEPTED upload
 * size, never the target STORED/SERVED size — every
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
 * from client code). Every variant is re-encoded to **WebP**
 * (`image/webp`) regardless of the input format — the owner's own
 * follow-up explicitly asked for "an appropriate image format
 * (WebP/AVIF where compatible ...) while preserving a safe fallback if
 * necessary." WebP over AVIF: AVIF compresses marginally better but
 * encodes noticeably slower and (as of this writing) still has gaps in
 * older browser/email-client support that WebP does not — for a
 * public-facing Thai contractor-search site, broad, fast, boring
 * compatibility wins over a few extra percent of compression. No
 * separate fallback format is generated: every image in this codebase
 * is already rendered through a plain `<img src>` (no `<picture>`/
 * content-negotiation infrastructure exists anywhere, and adding one
 * would itself be exactly the "unnecessary duplicate variant" this
 * task's own cost-control goal argues against) — WebP alone is
 * accepted browser-support risk that near-universal modern browser
 * support long since retired.
 *
 * Unlike the previous JPEG-based version of this pipeline, transparent
 * PNGs are no longer flattened onto white — WebP natively supports an
 * alpha channel at no extra format cost, so preserving it is strictly
 * better (nothing forces a lossy edit that JPEG's lack of alpha used
 * to require). `sharp().rotate()` still bakes in any EXIF orientation
 * before the pixels are touched (so a phone-camera photo doesn't come
 * out sideways once EXIF is stripped); NOT calling `.withMetadata()`
 * is what strips all EXIF/GPS/ICC metadata by default — sharp's own
 * documented behavior, and the actual mechanism satisfying "avoid
 * exposing private/... data in public image metadata" (a phone photo's
 * EXIF can carry the exact GPS coordinates it was taken at; that must
 * never reach a public bucket).
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
  contentType: 'image/webp';
  extension: 'webp';
  width: number;
  height: number;
};
export type OptimizationFailure = { ok: false; error: string };

interface VariantSpec {
  /** `inside` (the default for every variant except the article cover):
   * longest edge capped to `maxDimension`, aspect ratio preserved,
   * never cropped. `cover` (Issue #45's article cover, below): resize
   * AND crop to exactly `width`x`height`, so every stored image has the
   * same fixed aspect ratio regardless of what the admin uploaded —
   * `object-fit: cover` in ArticlesSection.tsx already made an
   * arbitrary source ratio *display* correctly, but normalizing the
   * stored asset itself to the target ratio is what Issue #45 actually
   * asked for ("ใช้มาตรฐานภาพโพสต์ Facebook แบบแนวนอน 1.91:1 เป็น
   * target"). `withoutEnlargement` means a smaller source image is
   * never upscaled beyond its own resolution. */
  resize: { width: number; height: number; fit: 'inside' | 'cover' };
  targetMaxBytes: number;
  initialQuality: number;
  minQuality: number;
}

function insideSpec(
  maxDimension: number,
  targetMaxBytes: number,
  initialQuality: number,
  minQuality: number
): VariantSpec {
  return { resize: { width: maxDimension, height: maxDimension, fit: 'inside' }, targetMaxBytes, initialQuality, minQuality };
}

/** Search issue's target: "~100-200 KB where practical" for grid/list
 * thumbnails. 480px covers this project's largest actual thumbnail box
 * (300x200 CSS, app/contractors/[slug]/page.tsx) at up to ~1.6x pixel
 * density without ever needing to serve anything bigger there. This is
 * the variant Search/Grid views actually load — see
 * src/lib/data/portfolio.ts's `thumbnail_url` and the migration's own
 * "used in listing/search — never serve image_url there" comment. */
export const THUMBNAIL_SPEC: VariantSpec = insideSpec(480, 200 * 1024, 72, 35);

/** Issue's target: "~300 KB-1 MB where practical" for the detail
 * variant. `portfolio_images.image_url` is not rendered anywhere in
 * this codebase today (only `thumbnail_url` is) but the column exists
 * for a future larger/lightbox view, so this variant is sized larger
 * than the thumbnail rather than reused from it. */
export const DETAIL_SPEC: VariantSpec = insideSpec(1600, 1000 * 1024, 80, 40);

/** contractors.profile_image_url has only ONE variant (no separate
 * thumbnail column on that table — adding one would be a schema change
 * beyond what this cost-control task asked for) and is never rendered
 * larger than 96x96 (profile detail page) or a 400x300 CSS box (search
 * card) anywhere in this codebase (verified directly against
 * app/contractors/[slug]/page.tsx and ContractorCard.tsx) — 800px
 * comfortably covers both at high pixel density. This is the ONLY
 * variant the profile page and every search card load — there is no
 * separate profile thumbnail. Deliberately smaller than the portfolio
 * detail target: generating a ~1MB file for something never displayed
 * past 400px would be pure storage cost with no visible benefit, which
 * is the opposite of what this task asks for. */
export const PROFILE_SPEC: VariantSpec = insideSpec(800, 300 * 1024, 78, 40);

/** Issue #45 — the admin's manually uploaded article cover image,
 * displayed at roughly 45% of a ~300px-wide card (ArticlesSection.tsx),
 * never shown larger anywhere in this codebase. Unlike every other
 * variant above, this one crops to a FIXED aspect ratio rather than
 * just capping the longest edge — originally 1.91:1 (Facebook's own
 * landscape link-preview ratio), changed to a plain SQUARE (1:1) after
 * the Owner's own live Production QA (Issue #45, comment 5600382106)
 * found the landscape-shaped stored asset left visible letterbox gaps
 * inside the now-square display card (ArticlesSection.tsx's own
 * `aspect-square` box + `object-contain`, from that same round) — with
 * the stored asset's own shape now matching the display box exactly,
 * every upload fills the card completely with zero letterbox and no
 * further cropping happens at display time either. `fit: 'cover'`
 * still center-crops whatever ratio the admin's upload actually has
 * down to this exact square, same mechanism as before, just square
 * dimensions instead of landscape ones. 1200x1200 is small enough
 * already that no quality-stepping is usually needed to hit 300KB. */
export const ARTICLE_COVER_SPEC: VariantSpec = { resize: { width: 1200, height: 1200, fit: 'cover' }, targetMaxBytes: 300 * 1024, initialQuality: 80, minQuality: 45 };

async function encodeVariant(bytes: Uint8Array, spec: VariantSpec): Promise<OptimizedImage | OptimizationFailure> {
  try {
    const pipeline = sharp(Buffer.from(bytes))
      .rotate()
      .resize({ width: spec.resize.width, height: spec.resize.height, fit: spec.resize.fit, withoutEnlargement: true });

    let quality = spec.initialQuality;
    let data: Buffer;
    let info: OutputInfo;
    for (;;) {
      const result = await pipeline.clone().webp({ quality, effort: 4 }).toBuffer({ resolveWithObject: true });
      data = result.data;
      info = result.info;
      if (data.length <= spec.targetMaxBytes || quality <= spec.minQuality) break;
      quality -= 10;
    }

    return { ok: true, bytes: data, contentType: 'image/webp', extension: 'webp', width: info.width, height: info.height };
  } catch (err) {
    // A file can pass imageValidation.ts's magic-byte sniff (a valid
    // header) yet still be truncated/corrupt past that point — sharp's
    // decoder is the thing that actually reads the whole image, so this
    // is a real, reachable failure case, not defensive-only code.
    //
    // Issue #26: a Production QA upload of a real PNG was rejected with
    // no way to tell why afterward — this module's only logged context
    // was the raw sharp error with nothing to correlate it against
    // (which file, what size, what variant). Verified locally that a
    // deliberately truncated PNG reproduces this exact failure shape
    // (`vipspng: libpng read error`) while every legitimate PNG variant
    // tried (RGBA, grayscale(+alpha), 16-bit, palette, interlaced, an
    // embedded ICC profile, a corrupted non-critical ancillary chunk, a
    // realistic full-resolution screenshot) decodes and re-encodes fine
    // — so this catch block is doing its job (a clean rejection instead
    // of a crash), the gap was purely in what got logged. Logging the
    // byte length and the spec name now (never the image bytes
    // themselves) so a future occurrence is diagnosable from the
    // server logs alone instead of needing the original file resent.
    console.error('image optimization: sharp failed to process the upload', {
      error: err instanceof Error ? err.message : String(err),
      byteLength: bytes.length,
      resize: spec.resize,
    });
    return { ok: false, error: 'ไม่สามารถประมวลผลไฟล์รูปภาพได้ ไฟล์อาจเสียหายหรือไม่สมบูรณ์ กรุณาลองบันทึกรูปใหม่แล้วอัปโหลดอีกครั้ง' };
  }
}

export async function generatePortfolioVariants(
  bytes: Uint8Array
): Promise<{ ok: true; thumbnail: OptimizedImage; detail: OptimizedImage } | OptimizationFailure> {
  const thumbnail = await encodeVariant(bytes, THUMBNAIL_SPEC);
  if (!thumbnail.ok) return thumbnail;
  const detail = await encodeVariant(bytes, DETAIL_SPEC);
  if (!detail.ok) return detail;
  return { ok: true, thumbnail, detail };
}

export async function generateProfileVariant(bytes: Uint8Array): Promise<OptimizedImage | OptimizationFailure> {
  return encodeVariant(bytes, PROFILE_SPEC);
}

export async function generateArticleCoverVariant(bytes: Uint8Array): Promise<OptimizedImage | OptimizationFailure> {
  return encodeVariant(bytes, ARTICLE_COVER_SPEC);
}
