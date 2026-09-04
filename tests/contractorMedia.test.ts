import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CONTRACTOR_MEDIA_BUCKET,
  deleteContractorImageBestEffort,
  extractContractorMediaPath,
  generateContractorMediaPath,
  uploadContractorImage,
} from '../src/lib/storage/contractorMedia';

const CONTRACTOR_ID = '11111111-1111-1111-1111-111111111111';

function mockAdminClient(overrides: { uploadError?: unknown; removeError?: unknown } = {}) {
  const upload = vi.fn(async () => ({ error: overrides.uploadError ?? null }));
  const remove = vi.fn(async () => ({ error: overrides.removeError ?? null }));
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/${CONTRACTOR_MEDIA_BUCKET}/${path}` },
  }));
  const from = vi.fn(() => ({ upload, remove, getPublicUrl }));
  const client = { storage: { from } } as unknown as SupabaseClient;
  return { client, upload, remove, getPublicUrl, from };
}

describe('generateContractorMediaPath', () => {
  it('never uses a client-derivable value — path is contractorId/kind-<uuid>.<extension>', () => {
    const path = generateContractorMediaPath(CONTRACTOR_ID, 'profile', 'jpg');
    expect(path).toMatch(
      new RegExp(`^${CONTRACTOR_ID}/profile-[0-9a-f-]{36}\\.jpg$`)
    );
  });

  it('produces a different, unguessable path on every call (no sequential/predictable component)', () => {
    const paths = new Set(
      Array.from({ length: 20 }, () => generateContractorMediaPath(CONTRACTOR_ID, 'portfolio-detail', 'png'))
    );
    expect(paths.size).toBe(20);
  });

  it('embeds the requested kind and extension exactly, and keeps thumbnail/detail paths distinct', () => {
    const detailPath = generateContractorMediaPath(CONTRACTOR_ID, 'portfolio-detail', 'jpg');
    expect(detailPath.startsWith(`${CONTRACTOR_ID}/portfolio-detail-`)).toBe(true);
    expect(detailPath.endsWith('.jpg')).toBe(true);

    const thumbnailPath = generateContractorMediaPath(CONTRACTOR_ID, 'portfolio-thumbnail', 'jpg');
    expect(thumbnailPath.startsWith(`${CONTRACTOR_ID}/portfolio-thumbnail-`)).toBe(true);
    expect(thumbnailPath).not.toBe(detailPath);
  });
});

describe('uploadContractorImage', () => {
  it('uploads with upsert:false and the given content type, then returns the public URL', async () => {
    const { client, upload, from } = mockAdminClient();
    const bytes = new Uint8Array([1, 2, 3]);
    const url = await uploadContractorImage(client, 'abc/profile-x.jpg', bytes, 'image/jpeg');

    expect(from).toHaveBeenCalledWith(CONTRACTOR_MEDIA_BUCKET);
    expect(upload).toHaveBeenCalledWith('abc/profile-x.jpg', bytes, { contentType: 'image/jpeg', upsert: false });
    expect(url).toBe(`https://project.supabase.co/storage/v1/object/public/${CONTRACTOR_MEDIA_BUCKET}/abc/profile-x.jpg`);
  });

  it('throws (does not silently swallow) when Storage returns an error', async () => {
    const { client } = mockAdminClient({ uploadError: new Error('storage unreachable') });
    await expect(uploadContractorImage(client, 'abc/profile-x.jpg', new Uint8Array([1]), 'image/jpeg')).rejects.toThrow(
      'storage unreachable'
    );
  });
});

describe('deleteContractorImageBestEffort', () => {
  it('calls remove([path]) on the bucket', async () => {
    const { client, remove } = mockAdminClient();
    await deleteContractorImageBestEffort(client, 'abc/profile-x.jpg');
    expect(remove).toHaveBeenCalledWith(['abc/profile-x.jpg']);
  });

  it('never throws even when Storage reports an error (best-effort)', async () => {
    const { client } = mockAdminClient({ removeError: new Error('object not found') });
    await expect(deleteContractorImageBestEffort(client, 'abc/profile-x.jpg')).resolves.toBeUndefined();
  });

  it('never throws even when the Storage call itself rejects', async () => {
    const client = {
      storage: {
        from: () => ({
          remove: async () => {
            throw new Error('network down');
          },
        }),
      },
    } as unknown as SupabaseClient;
    await expect(deleteContractorImageBestEffort(client, 'abc/profile-x.jpg')).resolves.toBeUndefined();
  });
});

describe('extractContractorMediaPath', () => {
  it('extracts the object path from a public URL this module generated', () => {
    const url = `https://project.supabase.co/storage/v1/object/public/${CONTRACTOR_MEDIA_BUCKET}/abc/profile-x.jpg`;
    expect(extractContractorMediaPath(url)).toBe('abc/profile-x.jpg');
  });

  it('returns null for a legacy/seed URL that never came from this bucket', () => {
    expect(extractContractorMediaPath('https://picsum.photos/seed/1/400')).toBeNull();
  });

  it('returns null for a URL pointing at a different bucket', () => {
    const url = 'https://project.supabase.co/storage/v1/object/public/some-other-bucket/abc/profile-x.jpg';
    expect(extractContractorMediaPath(url)).toBeNull();
  });

  it('returns null for a completely unrelated string', () => {
    expect(extractContractorMediaPath('not-a-url-at-all')).toBeNull();
  });
});
