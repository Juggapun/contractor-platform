/**
 * Issue #29 — client-side pre-upload image normalization. Browser-only
 * (canvas/createImageBitmap); never imported by server code.
 *
 * Root cause this exists for: every image upload in this app (portfolio
 * add, profile image, registration) sends the raw file bytes through a
 * Next.js Route Handler running as a Vercel serverless function, which
 * enforces its own platform-level request-body size ceiling independent
 * of anything this app's own server-side validation does
 * (imageValidation.ts's MAX_IMAGE_BYTES, raised to 20MB by Issue #27,
 * governs what the SERVER accepts once a request arrives — it has no
 * effect on whether the request arrives at all). A real Canva PNG
 * export reproduced this exactly: 1200x1200, 7.81MB, rejected before
 * ever reaching this app's own code, while the identical visual content
 * as a ~98KB JPEG succeeded. Raising the server-side cap again (as #27
 * did) cannot fix this — the fix has to happen before the request ever
 * leaves the browser.
 *
 * This function is a payload-size optimization only, never a security
 * boundary: every file it produces (or passes through unchanged) still
 * goes through the exact same server-side magic-byte sniff, decode, and
 * size/dimension validation as before (imageValidation.ts,
 * imageOptimization.ts) — those are what actually gate what reaches
 * Storage. If canvas processing fails for any reason (unsupported
 * format, decode error, no canvas support), this falls back to the
 * original file untouched and lets server-side validation do its job —
 * never silently drops the user's selection, never weakens what the
 * server checks.
 */

/** Issue's own target: "preferably <= 2 MB". Files at or under this are
 * left completely untouched (format, transparency, everything) — this
 * is a fix for the OVERSIZED case, not a blanket recompression of every
 * upload. */
const SKIP_BELOW_BYTES = 2 * 1024 * 1024;
const TARGET_MAX_BYTES = 2 * 1024 * 1024;

/** Generously larger than imageOptimization.ts's own DETAIL_SPEC.maxDimension
 * (1600px) — the server never keeps more than that anyway, so capping
 * here at 2000px trims pixels/bytes before the request leaves the
 * browser without ever being the thing that visibly limits quality
 * (the server's own resize already would, identically, if this were
 * skipped entirely). */
const MAX_DIMENSION = 2000;

const INITIAL_QUALITY = 0.9;
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.1;

/**
 * Returns `file` unchanged if it's already small enough (or isn't an
 * image, or normalization fails/doesn't help) — otherwise returns a new
 * JPEG File, resized to fit within MAX_DIMENSION and quality-stepped
 * down to fit within TARGET_MAX_BYTES where practical. Aspect ratio is
 * always preserved; a source already smaller than MAX_DIMENSION is
 * never upscaled.
 */
export async function normalizeImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= SKIP_BELOW_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Decode failed client-side (unsupported/corrupt/etc.) — fall back
    // to the original bytes; server-side validation is the real gate
    // and will reject a genuinely malformed file cleanly on its own.
    return file;
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // JPEG has no alpha channel — an oversized PNG with transparency
    // that reaches this path (only PNGs already under 2MB keep their
    // transparency untouched, per SKIP_BELOW_BYTES above) gets a white
    // background instead of an undefined/black one.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = INITIAL_QUALITY;
    let blob: Blob | null = null;
    for (;;) {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob || blob.size <= TARGET_MAX_BYTES || quality <= MIN_QUALITY) break;
      quality -= QUALITY_STEP;
    }

    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^./\\]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}
