import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), admin: vi.fn(), upload: vi.fn(), remove: vi.fn(), update: vi.fn(), scope: vi.fn(), lookup: vi.fn() }));
vi.mock('../app/api/contractors/_lib/requireContractorOwner', () => ({ requireContractorOwner: mocks.auth }));
vi.mock('../src/lib/supabase/admin', () => ({ getSupabaseAdminClient: mocks.admin }));
vi.mock('../src/lib/storage/contractorMedia', () => ({ generateContractorMediaPath: () => 'owner/cover-new.webp', uploadContractorImage: mocks.upload, deleteContractorImageBestEffort: mocks.remove, extractContractorMediaPath: () => 'owner/cover-old.webp' }));
import { PUT } from '../app/api/contractors/me/cover-image/route';
const request = async (valid = true) => {
  const data = new FormData();
  const bytes = valid ? await sharp({ create: { width: 108, height: 60, channels: 3, background: 'blue' } }).png().toBuffer() : Buffer.from('not an image');
  data.set('image', new File([new Uint8Array(bytes)], 'cover.png', { type: 'image/png' }));
  return new Request('http://localhost/api/contractors/me/cover-image', { method: 'PUT', body: data });
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ ok: true, contractorId: 'owner', userId: 'user' });
  mocks.lookup.mockResolvedValue({ data: { cover_image_url: 'old-url' }, error: null });
  mocks.scope.mockResolvedValue({ error: null }); mocks.update.mockReturnValue({ eq: mocks.scope });
  mocks.admin.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.lookup }) }), update: mocks.update }) });
  mocks.upload.mockResolvedValue('new-url');
});
describe('cover upload ownership and replacement', () => {
  it('rejects unauthorized requests before touching files/storage', async () => {
    mocks.auth.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    expect((await PUT(await request())).status).toBe(403); expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('rejects fake image contents', async () => {
    expect((await PUT(await request(false))).status).toBe(400); expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('updates only the authenticated contractor, then removes their previous cover', async () => {
    const response = await PUT(await request());
    expect(await response.json()).toEqual({ ok: true, coverImageUrl: 'new-url' });
    expect(mocks.update).toHaveBeenCalledWith({ cover_image_url: 'new-url' }); expect(mocks.scope).toHaveBeenCalledWith('id', 'owner');
    expect(mocks.remove).toHaveBeenCalledWith(expect.anything(), 'owner/cover-old.webp');
  });
  it('removes the new object on database failure and preserves the old object', async () => {
    mocks.scope.mockResolvedValue({ error: { message: 'database unavailable' } });
    expect((await PUT(await request())).status).toBe(500);
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'owner/cover-new.webp');
  });
});
