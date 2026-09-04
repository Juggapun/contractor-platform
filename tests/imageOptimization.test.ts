import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  DETAIL_SPEC,
  PROFILE_SPEC,
  THUMBNAIL_SPEC,
  generatePortfolioVariants,
  generateProfileVariant,
} from '../src/lib/uploads/imageOptimization';

/** A large, real (not synthetic-flat) image so JPEG compression has
 * actual work to do and the quality step-down loop is exercised, not
 * just returning the minimum-quality encode immediately. A noise
 * pattern compresses far worse than a flat color, closer to a real
 * photo. */
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

describe('generatePortfolioVariants', () => {
  it('produces a real JPEG thumbnail and detail variant, both sniffable/decodable', async () => {
    const input = await makeLargeNoisyJpeg(2400, 1800);
    const result = await generatePortfolioVariants(new Uint8Array(input));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.thumbnail.contentType).toBe('image/jpeg');
    expect(result.detail.contentType).toBe('image/jpeg');
    // Real JPEG magic bytes (FF D8 FF) — not just trusting the claimed contentType.
    expect(result.thumbnail.bytes[0]).toBe(0xff);
    expect(result.thumbnail.bytes[1]).toBe(0xd8);
    expect(result.thumbnail.bytes[2]).toBe(0xff);
    expect(result.detail.bytes[0]).toBe(0xff);
    expect(result.detail.bytes[1]).toBe(0xd8);
    expect(result.detail.bytes[2]).toBe(0xff);

    const thumbMeta = await sharp(result.thumbnail.bytes).metadata();
    const detailMeta = await sharp(result.detail.bytes).metadata();
    expect(thumbMeta.format).toBe('jpeg');
    expect(detailMeta.format).toBe('jpeg');
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

  it('flattens a transparent PNG onto white instead of crashing', async () => {
    const input = await makeFlatColorPng(600, 400, true);
    const result = await generatePortfolioVariants(new Uint8Array(input));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meta = await sharp(result.detail.bytes).metadata();
    expect(meta.hasAlpha).toBe(false);
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
});

describe('generateProfileVariant', () => {
  it('produces a single JPEG capped at PROFILE_SPEC.maxDimension', async () => {
    const input = await makeLargeNoisyJpeg(2000, 2000);
    const result = await generateProfileVariant(new Uint8Array(input));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contentType).toBe('image/jpeg');
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
