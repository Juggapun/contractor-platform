import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  DETAIL_SPEC,
  PROFILE_SPEC,
  THUMBNAIL_SPEC,
  generatePortfolioVariants,
  generateProfileVariant,
} from '../src/lib/uploads/imageOptimization';

/** A large, real (not synthetic-flat) image so the encoder has actual
 * work to do and the quality step-down loop is exercised, not just
 * returning the minimum-quality encode immediately. A noise pattern
 * compresses far worse than a flat color, closer to a real photo.
 * Encoded as JPEG here only because it needs SOME real container
 * format as decode input — the pipeline under test always re-encodes
 * its output as WebP regardless of this. */
async function makeLargeNoisyJpeg(width: number, height: number): Promise<Buffer> {
  const channels = 3;
  const pixels = Buffer.alloc(width * height * channels);
  for (let i = 0; i < pixels.length; i++) pixels[i] = Math.floor(Math.random() * 256);
  return sharp(pixels, { raw: { width, height, channels } }).jpeg({ quality: 95 }).toBuffer();
}

async function makeFlatColorPng(width: number, height: number, alpha = false): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: alpha ? 4 : 3,
      background: alpha ? { r: 10, g: 120, b: 200, alpha: 0.4 } : { r: 10, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

async function makeSmallWebp(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 50, b: 50 } } })
    .webp()
    .toBuffer();
}

/** RIFF....WEBP — real WebP magic bytes, not just the claimed contentType. */
function expectWebpMagicBytes(bytes: Buffer): void {
  expect(bytes[0]).toBe(0x52); // R
  expect(bytes[1]).toBe(0x49); // I
  expect(bytes[2]).toBe(0x46); // F
  expect(bytes[3]).toBe(0x46); // F
  expect(bytes[8]).toBe(0x57); // W
  expect(bytes[9]).toBe(0x45); // E
  expect(bytes[10]).toBe(0x42); // B
  expect(bytes[11]).toBe(0x50); // P
}

describe('generatePortfolioVariants', () => {
  it('produces a real WebP thumbnail and detail variant, both sniffable/decodable', async () => {
    const input = await makeLargeNoisyJpeg(2400, 1800);
    const result = await generatePortfolioVariants(new Uint8Array(input));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.thumbnail.contentType).toBe('image/webp');
    expect(result.detail.contentType).toBe('image/webp');
    expectWebpMagicBytes(result.thumbnail.bytes);
    expectWebpMagicBytes(result.detail.bytes);

    const thumbMeta = await sharp(result.thumbnail.bytes).metadata();
    const detailMeta = await sharp(result.detail.bytes).metadata();
    expect(thumbMeta.format).toBe('webp');
    expect(detailMeta.format).toBe('webp');
  });

  it('caps the thumbnail to THUMBNAIL_SPEC.maxDimension on the long edge', async () => {
    const input = await makeLargeNoisyJpeg(2400, 1200);
    const result = await generatePortfolioVariants(new Uint8Array(input));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Math.max(result.thumbnail.width, result.thumbnail.height)).toBeLessThanOrEqual(THUMBNAIL_SPEC.maxDimension);
  });

  it('caps the detail variant to DETAIL_SPEC.maxDimension on the long edge, larger than the thumbnail', async () => {
    const input = await makeLargeNoisyJpeg(3000, 2000);
    const result = await generatePortfolioVariants(new Uint8Array(input));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Math.max(result.detail.width, result.detail.height)).toBeLessThanOrEqual(DETAIL_SPEC.maxDimension);
    expect(result.detail.width).toBeGreaterThan(result.thumbnail.width);
  });

  it('never upscales a source image smaller than the target dimensions', async () => {
    const input = await makeFlatColorPng(120, 90);
    const result = await generatePortfolioVariants(new Uint8Array(input));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.thumbnail.width).toBe(120);
    expect(result.thumbnail.height).toBe(90);
    expect(result.detail.width).toBe(120);
    expect(result.detail.height).toBe(90);
  });

  it('keeps the thumbnail near its target size band for a realistic large photo', async () => {
    const input = await makeLargeNoisyJpeg(2400, 1800);
    const result = await generatePortfolioVariants(new Uint8Array(input));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // "Where practical" per the issue — allow headroom above the target
    // for a worst-case noisy image, but it must still be dramatically
    // smaller than the uncompressed/unoptimized source and never balloon
    // past a sane ceiling.
    expect(result.thumbnail.bytes.length).toBeLessThan(400 * 1024);
    expect(result.thumbnail.bytes.length).toBeLessThan(input.length);
  });

  it('preserves alpha transparency (WebP supports it natively, unlike the JPEG this pipeline used to emit)', async () => {
    const input = await makeFlatColorPng(600, 400, true);
    const result = await generatePortfolioVariants(new Uint8Array(input));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meta = await sharp(result.detail.bytes).metadata();
    expect(meta.hasAlpha).toBe(true);
  });

  it('accepts a WebP source', async () => {
    const input = await makeSmallWebp(500, 500);
    const result = await generatePortfolioVariants(new Uint8Array(input));
    expect(result.ok).toBe(true);
  });

  it('strips EXIF/GPS metadata from the output', async () => {
    const withExif = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 5, g: 5, b: 5 } } })
      .withExif({
        IFD0: { Make: 'TestCam', GPSLatitude: '13/1 45/1 0/1', GPSLatitudeRef: 'N' },
      })
      .jpeg()
      .toBuffer();
    const result = await generatePortfolioVariants(new Uint8Array(withExif));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const detailMeta = await sharp(result.detail.bytes).metadata();
    expect(detailMeta.exif).toBeUndefined();
    const thumbMeta = await sharp(result.thumbnail.bytes).metadata();
    expect(thumbMeta.exif).toBeUndefined();
  });

  it('rejects a corrupt/malformed image that still starts with a valid JPEG signature', async () => {
    const corrupt = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from('this is not really a jpeg body, just garbage bytes after a real-looking header'.repeat(5)),
    ]);
    const result = await generatePortfolioVariants(new Uint8Array(corrupt));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.length).toBeGreaterThan(0);
  });

  // Issue #26 — a real Production QA upload (a PNG) was rejected while two
  // JPEGs in the same batch succeeded, with no way afterward to tell why.
  // Investigated locally by feeding a wide range of legitimate PNG
  // variants (below) plus deliberately corrupted ones through this exact
  // pipeline: every legitimate variant tried decodes and re-encodes fine
  // — imageValidation.ts's magic-byte sniff is not the bottleneck, and
  // neither is this module's PNG handling in general. The one genuine
  // failure mode found is a PNG that is truncated/corrupted *after* its
  // magic-byte header (which the sniff necessarily cannot see, since it
  // only reads the first 8 bytes) — sharp's decoder is the thing that
  // actually reads the whole file, so this is a real, reachable case, not
  // a hypothetical one. This already fails gracefully (a clear Thai
  // error, not a crash or an unhandled 500) — this test locks that
  // behavior in, and the diagnostic logging added alongside it in
  // encodeVariant()'s catch block is what makes a future occurrence like
  // this actually traceable from server logs.
  it('rejects a truncated PNG (valid header, cut off mid-stream) with a clear error, not a crash', async () => {
    const validPng = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 12, g: 34, b: 56 } } })
      .png()
      .toBuffer();
    const truncated = validPng.subarray(0, Math.floor(validPng.length * 0.6));
    const result = await generatePortfolioVariants(new Uint8Array(truncated));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.length).toBeGreaterThan(0);
  });

  // Issue #27 — the actual reported bug: a legitimate PNG rejected while
  // the SAME visual content converted to JPEG succeeded. Reproduced the
  // mechanism directly: a realistic phone-camera-resolution photo
  // (moderate noise, not a flat screenshot) re-encoded losslessly as PNG
  // landed at 10-12 MB in this project's own testing, while the
  // identical pixels as JPEG landed under 5 MB — so the PNG was being
  // rejected purely for being a bigger (but perfectly valid) file, not
  // for any real defect. This test locks in both halves of the fix:
  // the same visual content succeeds regardless of format now, and the
  // PNG output is not silently smaller/corrupted — it's a real,
  // decodable WebP like every other successful upload.
  it('accepts a realistic large photographic PNG (same visual content that used to only work as JPEG)', async () => {
    const width = 3000;
    const height = 4000;
    const pixels = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 3;
        const base = Math.floor((x / width) * 100 + (y / height) * 80 + 60);
        const noise = Math.floor((Math.random() - 0.5) * 40);
        pixels[idx] = Math.max(0, Math.min(255, base + noise));
        pixels[idx + 1] = Math.max(0, Math.min(255, base + 20 + noise));
        pixels[idx + 2] = Math.max(0, Math.min(255, base + 40 + noise));
      }
    }
    const png = await sharp(pixels, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 9 }).toBuffer();
    const jpeg = await sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();

    // The whole premise of the bug: same pixels, PNG is dramatically
    // bigger than JPEG (lossless vs lossy), and the PNG alone used to
    // exceed the old 5 MB cap.
    expect(png.length).toBeGreaterThan(5 * 1024 * 1024);
    expect(png.length).toBeGreaterThan(jpeg.length);

    const pngResult = await generatePortfolioVariants(new Uint8Array(png));
    const jpegResult = await generatePortfolioVariants(new Uint8Array(jpeg));
    expect(pngResult.ok).toBe(true);
    expect(jpegResult.ok).toBe(true);
    if (!pngResult.ok || !jpegResult.ok) return;

    expectWebpMagicBytes(pngResult.thumbnail.bytes);
    expectWebpMagicBytes(pngResult.detail.bytes);
    const thumbMeta = await sharp(pngResult.thumbnail.bytes).metadata();
    expect(thumbMeta.format).toBe('webp');
    expect(thumbMeta.width).toBeGreaterThan(0);
  });

  it.each([
    ['palette (indexed) PNG', () => sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 10, g: 200, b: 10 } } }).png({ palette: true }).toBuffer()],
    ['interlaced PNG', () => sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 10, g: 10, b: 200 } } }).png({ progressive: true }).toBuffer()],
    ['grayscale+alpha PNG', () => sharp(Buffer.alloc(200 * 150 * 2, 128), { raw: { width: 200, height: 150, channels: 2 } }).png().toBuffer()],
    ['PNG with an embedded sRGB ICC profile', () => sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 20, g: 120, b: 220 } } }).withMetadata({ icc: 'srgb' }).png().toBuffer()],
  ] as const)('accepts a legitimate %s (a real screenshot/photo could plausibly be one)', async (_label, makeBuffer) => {
    const input = await makeBuffer();
    const result = await generatePortfolioVariants(new Uint8Array(input));
    expect(result.ok).toBe(true);
  });
});

describe('generateProfileVariant', () => {
  it('produces a single WebP variant capped at PROFILE_SPEC.maxDimension', async () => {
    const input = await makeLargeNoisyJpeg(2000, 2000);
    const result = await generateProfileVariant(new Uint8Array(input));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contentType).toBe('image/webp');
    expectWebpMagicBytes(result.bytes);
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(PROFILE_SPEC.maxDimension);
  });

  it('stays well under the portfolio detail target, matching its smaller real-world display size', async () => {
    const input = await makeLargeNoisyJpeg(2000, 2000);
    const result = await generateProfileVariant(new Uint8Array(input));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bytes.length).toBeLessThan(DETAIL_SPEC.targetMaxBytes);
  });

  it('rejects a corrupt/malformed image', async () => {
    const corrupt = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('garbage'.repeat(10))]);
    const result = await generateProfileVariant(new Uint8Array(corrupt));
    expect(result.ok).toBe(false);
  });

  it('never upscales a small source image', async () => {
    const input = await makeFlatColorPng(64, 64);
    const result = await generateProfileVariant(new Uint8Array(input));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
  });
});
