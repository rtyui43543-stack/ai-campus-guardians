import { afterEach, describe, expect, it, vi } from 'vitest';
import { composeUltimateCard } from './ultimateCardLayout';

describe('titled collectible export', () => {
  afterEach(() => vi.unstubAllGlobals());
  function setup() {
    const bitmap = { close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
    const png = new Blob(['PNG with artwork and title'], { type: 'image/png' });
    const context = { drawImage: vi.fn(), strokeText: vi.fn(), fillText: vi.fn(), font: '', textAlign: '', textBaseline: '', lineWidth: 0, strokeStyle: '', fillStyle: '' };
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => context), toBlob: vi.fn((callback: (blob: Blob) => void) => callback(png)) };
    vi.stubGlobal('document', { fonts: { ready: Promise.resolve() }, createElement: vi.fn(() => canvas) });
    return { bitmap, canvas, context, png };
  }
  it('downloads the offline illustration together with a bounded title as a portable PNG', async () => {
    const { bitmap, canvas, context, png } = setup();
    expect(await composeUltimateCard(new Blob(['webp']), '萬卷雷霆陣', new AbortController().signal)).toBe(png);
    expect([canvas.width, canvas.height]).toEqual([1024, 1536]);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1024, 1536);
    expect(context.fillText).toHaveBeenCalledWith('萬卷雷霆陣', 512, 1446, 540);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });
  it('closes decoded resources and emits no image after a cancelled export', async () => {
    const { bitmap, canvas } = setup();
    const controller = new AbortController();
    vi.stubGlobal('document', { fonts: { ready: Promise.resolve().then(() => controller.abort()) }, createElement: vi.fn(() => canvas) });
    await expect(composeUltimateCard(new Blob(['webp']), '守護城堡', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(canvas.toBlob).not.toHaveBeenCalled();
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });
});
