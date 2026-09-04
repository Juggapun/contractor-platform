/**
 * Issue #23 — server-side image upload validation. Server-only (reads
 * raw file bytes) and the ONLY thing that actually gates what reaches
 * Storage — "Reject invalid/malformed uploads server-side; client-side
 * validation is only UX" is not a suggestion, it's the whole reason this
 * module exists separately from any `<input accept="image/*">` hint in
 * the form. A claimed MIME type or file extension is attacker-controlled
 * and checked nowhere here; only the file's own magic bytes decide what
 * it actually is.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export type SniffedImageType = 'image/jpeg' | 'image/png' | 'image/webp';

const EXTENSION_BY_TYPE: Record<SniffedImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Reads only the fixed-size magic-byte signature every format defines
 * at a known offset — never the claimed Content-Type, never the
 * filename/extension the client sent (both are attacker-controlled and
 * exist purely for display; see requireContractorOwner.ts and the
 * upload routes for why the filename is never persisted at all).
 */
export function sniffImageType(bytes: Uint8Array): SniffedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export type ValidatedImage = {
  ok: true;
  bytes: Uint8Array;
  contentType: SniffedImageType;
  extension: string;
};
export type RejectedImage = { ok: false; error: string };

/**
 * `file` must already be a real `File`/`Blob` (from `FormData`, never
 * from a client-supplied URL/path string — see the upload routes' own
 * comments on why a client can never name where its own file lands).
 */
export async function validateImageUpload(file: File): Promise<ValidatedImage | RejectedImage> {
  if (file.size === 0) {
    return { ok: false, error: 'ไฟล์ว่างเปล่า' };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `ไฟล์มีขนาดใหญ่เกินไป (สูงสุด ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB)` };
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageType(buffer);
  if (!sniffed) {
    return { ok: false, error: 'รองรับเฉพาะไฟล์รูปภาพ JPEG, PNG หรือ WebP เท่านั้น' };
  }

  return { ok: true, bytes: buffer, contentType: sniffed, extension: EXTENSION_BY_TYPE[sniffed] };
}
