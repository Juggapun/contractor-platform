import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, sniffImageType, validateImageUpload } from '../src/lib/uploads/imageValidation';

const JPEG_MAGIC = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_MAGIC = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP_MAGIC = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

function file(bytes: Uint8Array, name = 'upload.bin', type = 'application/octet-stream'): File {
  return new File([bytes] as BlobPart[], name, { type });
}

describe('sniffImageType', () => {
  it('recognizes a real JPEG signature', () => {
    expect(sniffImageType(JPEG_MAGIC)).toBe('image/jpeg');
  });

  it('recognizes a real PNG signature', () => {
    expect(sniffImageType(PNG_MAGIC)).toBe('image/png');
  });

  it('recognizes a real WebP (RIFF....WEBP) signature', () => {
    expect(sniffImageType(WEBP_MAGIC)).toBe('image/webp');
  });

  it('rejects a RIFF container that is not WEBP (e.g. a WAV file)', () => {
    const wav = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
    expect(sniffImageType(wav)).toBeNull();
  });

  it('rejects plain text / non-image bytes', () => {
    expect(sniffImageType(new TextEncoder().encode('<?php system($_GET["c"]); ?>'))).toBeNull();
  });

  it('rejects an empty buffer', () => {
    expect(sniffImageType(new Uint8Array(0))).toBeNull();
  });

  it('rejects a truncated signature shorter than the format needs', () => {
    expect(sniffImageType(Uint8Array.from([0x89, 0x50]))).toBeNull();
  });

  it('is not fooled by a claimed image extension on non-image bytes', () => {
    // sniffImageType itself never looks at a filename — this just
    // documents that the function's contract is bytes-only.
    expect(sniffImageType(new TextEncoder().encode('not-an-image'))).toBeNull();
  });
});

describe('validateImageUpload', () => {
  it('accepts a real JPEG regardless of its claimed name/type', () => {
    return validateImageUpload(file(JPEG_MAGIC, 'totally-safe.txt', 'text/plain')).then((result) => {
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.contentType).toBe('image/jpeg');
        expect(result.extension).toBe('jpg');
        expect(result.bytes.length).toBe(JPEG_MAGIC.length);
      }
    });
  });

  it('accepts a real PNG', async () => {
    const result = await validateImageUpload(file(PNG_MAGIC, 'a.png', 'image/png'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.extension).toBe('png');
  });

  it('accepts a real WebP', async () => {
    const result = await validateImageUpload(file(WEBP_MAGIC, 'a.webp', 'image/webp'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.extension).toBe('webp');
  });

  it('rejects an empty file', async () => {
    const result = await validateImageUpload(file(new Uint8Array(0)));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('ว่างเปล่า');
  });

  it('rejects a file over the size limit even with a valid signature', async () => {
    const oversized = new Uint8Array(MAX_IMAGE_BYTES + 1);
    oversized.set(PNG_MAGIC);
    const result = await validateImageUpload(file(oversized, 'big.png', 'image/png'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('ขนาดใหญ่เกินไป');
  });

  it('accepts a file exactly at the size limit', async () => {
    const atLimit = new Uint8Array(MAX_IMAGE_BYTES);
    atLimit.set(PNG_MAGIC);
    const result = await validateImageUpload(file(atLimit, 'exact.png', 'image/png'));
    expect(result.ok).toBe(true);
  });

  // Issue #27 — a legitimate PNG (lossless) of real photographic content
  // routinely lands well over the old 5 MB cap for the exact same visual
  // content that comfortably fits under 5 MB as a JPEG (lossy); this
  // isn't a corrupt/malformed file, just a bigger one. Locking in the
  // raised MAX_IMAGE_BYTES here at the validation layer (the
  // imageOptimization.test.ts full-pipeline test covers the same
  // scenario end-to-end, including the actual WebP re-encode).
  it('accepts a realistic large PNG (e.g. a lossless photo re-save) that would have failed the old 5 MB cap', async () => {
    const twelveMb = new Uint8Array(12 * 1024 * 1024);
    twelveMb.set(PNG_MAGIC);
    expect(twelveMb.length).toBeGreaterThan(5 * 1024 * 1024);
    expect(twelveMb.length).toBeLessThan(MAX_IMAGE_BYTES);
    const result = await validateImageUpload(file(twelveMb, 'large-photo.png', 'image/png'));
    expect(result.ok).toBe(true);
  });

  it('rejects a file claiming to be image/jpeg whose bytes are not actually an image (spoofed MIME type)', async () => {
    const phpPayload = new TextEncoder().encode('<?php system($_GET["c"]); ?>');
    const result = await validateImageUpload(file(phpPayload, 'innocent.jpg', 'image/jpeg'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('JPEG, PNG หรือ WebP');
  });

  it('rejects an SVG (not in the allowlist, even though browsers treat it as an image)', async () => {
    const svg = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
    const result = await validateImageUpload(file(svg, 'a.svg', 'image/svg+xml'));
    expect(result.ok).toBe(false);
  });

  it('rejects a GIF (not in the allowlist)', async () => {
    const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    const result = await validateImageUpload(file(gif, 'a.gif', 'image/gif'));
    expect(result.ok).toBe(false);
  });
});
