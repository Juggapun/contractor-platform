import { describe, expect, it } from 'vitest';
import { cropRectangle } from '../src/lib/uploads/cropGeometry';
import { generateCoverVariant } from '../src/lib/uploads/imageOptimization';
import sharp from 'sharp';

describe('contractor image crop', () => {
  it('centers a square within a landscape photo', () => {
    expect(cropRectangle(1200, 600, 1, 1, .5, .5)).toEqual({ x: 300, y: 0, width: 600, height: 600 });
  });
  it('keeps portrait/landscape crops inside the source at every edge and zoom', () => {
    for (const [w,h] of [[400,1600],[1600,400],[720,720]] as const) for (const aspect of [1,1.5]) for (const zoom of [1,2,3]) for (const x of [-1,0,.5,1,2]) for (const y of [-1,0,.5,1,2]) {
      const r = cropRectangle(w,h,aspect,zoom,x,y);
      expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x+r.width).toBeLessThanOrEqual(w+.001); expect(r.y+r.height).toBeLessThanOrEqual(h+.001);
      expect(r.width/r.height).toBeCloseTo(aspect);
    }
  });
  it('encodes a cover using the same aspect as the crop UI and removes metadata', async () => {
    const input = await sharp({ create: { width: 1800, height: 1800, channels: 3, background: '#fdcc22' } }).jpeg().withMetadata().toBuffer();
    const output = await generateCoverVariant(input); expect(output.ok).toBe(true);
    if (!output.ok) return;
    const meta = await sharp(output.bytes).metadata();
    expect([meta.width,meta.height,meta.format]).toEqual([1080,720,'webp']); expect(meta.exif).toBeUndefined();
  });
});
