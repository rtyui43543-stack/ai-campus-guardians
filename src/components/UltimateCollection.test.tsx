import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UltimateCollection, UltimateCardTitle, createUltimateCardDownloader, unlockedUltimateIds } from './UltimateCollection';
import { allUltimateSpells, ultimateSpells } from '../content/ultimateSpells';
import { composeUltimateCard, getUltimateCardLayout } from './ultimateCardLayout';

vi.mock('../platform/urls', () => ({ appAssetUrl: (path: string) => `/ai-campus-guardians${path}` }));
vi.mock('./ultimateCardLayout', async importOriginal => ({ ...await importOriginal<typeof import('./ultimateCardLayout')>(), composeUltimateCard: vi.fn(async () => new Blob(['titled PNG card'], { type: 'image/png' })) }));

describe('ultimate collection visibility', () => {
  it('does not expose locked artwork or download controls before a spell is actually cast', () => {
    const html = renderToStaticMarkup(createElement(UltimateCollection, { cards: [] }));
    expect(html).toContain('我的必殺技收藏卡');
    expect(html.match(/尚未解鎖/g)).toHaveLength(12);
    expect(html).not.toContain('ultimate-1-v1.webp');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('download=');
    expect(html).not.toContain('查看收藏卡：');
  });
  it('unlocks only known recorded spells, deduplicates repeated casts and does not leak other card URLs', () => {
    const cards = [
      { ultimateId: 2, unlockedAt: '2026-10-08T04:00:00Z' },
      { ultimateId: 2, unlockedAt: '2026-10-08T05:00:00Z' },
      { ultimateId: 99, unlockedAt: '2026-10-08T05:00:00Z' },
    ];
    expect([...unlockedUltimateIds(cards)]).toEqual([2]);
    const html = renderToStaticMarkup(createElement(UltimateCollection, { cards }));
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).toContain('/ai-campus-guardians/art/ultimate-2-v1.webp');
    expect(html).toContain('aria-label="查看收藏卡：雷霆索引"');
    expect(html).not.toContain('ultimate-1-v1.webp');
    expect(html).not.toContain('ultimate-3-v1.webp');
  });
  it('explains energy reset, separate reward points, and repeat-cast rewards without presenting an unearned card', () => {
    const html = renderToStaticMarkup(createElement(UltimateCollection, { cards: [] }));
    expect(html).toContain('答錯保留能量，進階超時扣 1 點');
    expect(html).toContain('下一題答對');
    expect(html).toContain('另外加 10 分');
    expect(html).toContain('每關能量從 0 開始');
    expect(html).toContain('同一張卡只收藏一次');
  });
  it('keeps each earned tier separate and presents upgrade ancestry without unlocking the other tier', () => {
    const cards = [{ ultimateId: 2, mode: 'advanced' as const, unlockedAt: '2026-10-08T04:00:00Z' }];
    expect([...unlockedUltimateIds(cards)]).toEqual([]);
    expect([...unlockedUltimateIds(cards, 'advanced')]).toEqual([2]);
    const html = renderToStaticMarkup(createElement(UltimateCollection, { cards, initialMode: 'advanced' }));
    expect(html).toContain('／12 張');
    expect(html).toContain('查看收藏卡：萬卷雷霆陣');
    expect(html).toContain('升級自：雷霆索引');
    expect(html).toContain('ultimate-advanced-2-v1.webp');
    expect(html).not.toContain('src="/ai-campus-guardians/art/ultimate-2-v1.webp"');
  });
  it.each(allUltimateSpells)('anchors $name at its audited artwork baseline used by exported PNGs', spell => {
    const html = renderToStaticMarkup(createElement(UltimateCardTitle, { name: spell.name }));
    const layout = getUltimateCardLayout(spell.name);
    expect(html).toContain('viewBox="0 0 1024 1536"');
    expect(html).toContain(`x="${layout.titleX}" y="${layout.titleY}"`);
    expect(html).toContain(`font-size="${layout.titleSize}"`);
    expect(html).toContain('dominant-baseline="alphabetic"');
    expect(html).toContain('text-anchor="middle"');
  });
});

describe('offline collectible Blob downloads', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  function setupDocument() {
    const anchor = { href: '', download: '', style: { display: '' }, click: vi.fn(), remove: vi.fn() };
    const body = { appendChild: vi.fn() };
    const modal = { appendChild: vi.fn() };
    vi.stubGlobal('document', { body, createElement: vi.fn(() => anchor) });
    vi.stubGlobal('window', { setTimeout: globalThis.setTimeout });
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:offline-collectible');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    return { anchor, body, modal, createUrl, revokeUrl };
  }
  it('fetches the packaged URL through the service worker and downloads a Blob inside the open modal', async () => {
    vi.useFakeTimers();
    const doc = setupDocument();
    const bytes = new Blob(['complete offline image bytes'], { type: 'image/webp' });
    const fetchImage = vi.fn().mockResolvedValue(new Response(bytes));
    vi.stubGlobal('fetch', fetchImage);
    const downloader = createUltimateCardDownloader(ultimateSpells[1]);
    await downloader.download(doc.modal as unknown as HTMLElement);
    expect(fetchImage).toHaveBeenCalledWith('/ai-campus-guardians/art/ultimate-2-v1.webp', { signal: expect.any(AbortSignal) });
    const downloadedBlob = doc.createUrl.mock.calls[0][0] as Blob;
    expect(composeUltimateCard).toHaveBeenCalledWith(bytes, '雷霆索引', expect.any(AbortSignal));
    expect(await downloadedBlob.text()).toBe('titled PNG card');
    expect(downloadedBlob.type).toBe('image/png');
    expect(doc.modal.appendChild).toHaveBeenCalledWith(doc.anchor);
    expect(doc.body.appendChild).not.toHaveBeenCalled();
    expect(doc.anchor.href).toBe('blob:offline-collectible');
    expect(doc.anchor.download).toBe('小羽收藏卡-初階-雷霆索引.png');
    expect(doc.anchor.click).toHaveBeenCalledTimes(1);
    expect(doc.anchor.remove).toHaveBeenCalledTimes(1);
    expect(doc.revokeUrl).not.toHaveBeenCalled();
    vi.advanceTimersByTime(15000);
    expect(doc.revokeUrl).toHaveBeenCalledWith('blob:offline-collectible');
  });
  it('shares pending work for repeated clicks and allows a fresh retry after failure', async () => {
    const doc = setupDocument();
    let finish!: (response: Response) => void;
    const fetchImage = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }))
      .mockResolvedValueOnce(new Response(new Blob(['image bytes'], { type: 'image/webp' })));
    vi.stubGlobal('fetch', fetchImage);
    const downloader = createUltimateCardDownloader(ultimateSpells[0]);
    const first = downloader.download();
    const duplicate = downloader.download();
    expect(first).toBe(duplicate);
    expect(fetchImage).toHaveBeenCalledTimes(1);
    finish(new Response('unavailable', { status: 503 }));
    await expect(first).rejects.toThrow('尚未準備好');
    expect(doc.createUrl).not.toHaveBeenCalled();
    await downloader.download();
    expect(fetchImage).toHaveBeenCalledTimes(2);
    expect(doc.anchor.click).toHaveBeenCalledTimes(1);
  });
  it('rejects empty or non-image fallback bodies without downloading an error page', async () => {
    const doc = setupDocument();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(new Blob([], { type: 'image/webp' })))
      .mockResolvedValueOnce(new Response('<html>offline error page</html>', { headers: { 'Content-Type': 'text/html' } })));
    const downloader = createUltimateCardDownloader(ultimateSpells[0]);
    await expect(downloader.download()).rejects.toThrow('未能完整讀取');
    await expect(downloader.download()).rejects.toThrow('未能完整讀取');
    expect(doc.createUrl).not.toHaveBeenCalled();
    expect(doc.anchor.click).not.toHaveBeenCalled();
  });
  it('cancels pending reads when the dialog closes without starting an unwanted download', async () => {
    const doc = setupDocument();
    vi.stubGlobal('fetch', vi.fn((_url, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')));
    })));
    const downloader = createUltimateCardDownloader(ultimateSpells[0]);
    const task = downloader.download();
    downloader.cancel();
    await expect(task).rejects.toMatchObject({ name: 'AbortError' });
    expect(doc.anchor.click).not.toHaveBeenCalled();
    expect(doc.createUrl).not.toHaveBeenCalled();
  });
});
