import { afterEach, describe, expect, it, vi } from 'vitest';
import { allUltimateSpells } from '../content/ultimateSpells';
import { CARD_PLAQUES, CARD_TITLE_FONT, composeUltimateCard, getUltimateCardLayout } from './ultimateCardLayout';

describe('audited collectible plaques', () => {
  it('covers every active card illustration exactly once, including the two replacement ice cards', () => {
    expect(Object.keys(CARD_PLAQUES).sort()).toEqual(allUltimateSpells.map(spell => spell.name).sort());
    expect(new Set(Object.values(CARD_PLAQUES).map(layout => layout.artPath)).size).toBe(12);
    for (const spell of allUltimateSpells) expect(getUltimateCardLayout(spell.name).artPath).toBe(spell.artPath);
  });
  it('reserves border clearance around each complete title and keeps all safe areas inside the artwork', () => {
    for (const spell of allUltimateSpells) {
      const layout = getUltimateCardLayout(spell.name);
      expect(layout.safeX).toBeGreaterThan(0);
      expect(layout.safeY).toBeGreaterThan(0);
      expect(layout.safeX + layout.safeWidth).toBeLessThan(layout.width);
      expect(layout.safeY + layout.safeHeight).toBeLessThan(layout.height);
      const halfTextWidth = Array.from(spell.name).length * layout.titleSize / 2;
      expect(layout.titleX - halfTextWidth - 1).toBeGreaterThan(layout.safeX);
      expect(layout.titleX + halfTextWidth + 1).toBeLessThan(layout.safeX + layout.safeWidth);
      // Conservative ideograph-ink envelope plus its one-pixel outline, at the explicit baseline.
      expect(layout.titleY - layout.titleSize * .9 - 1).toBeGreaterThan(layout.safeY);
      expect(layout.titleY + layout.titleSize * .14 + 1).toBeLessThan(layout.safeY + layout.safeHeight);
    }
  });
  it('uses the higher plaques for the leaf and mirror illustrations, and requires an audit for new cards', () => {
    expect(getUltimateCardLayout('萬葉歸位').titleCenterY).toBe(1414);
    expect(getUltimateCardLayout('鏡界破偽').titleCenterY).toBe(1418);
    expect(getUltimateCardLayout('雷霆索引').titleCenterY).toBe(1440);
    expect(() => getUltimateCardLayout('尚未審核的新卡')).toThrow('尚未設定文字排版');
  });
});

describe('titled collectible export', () => {
  afterEach(() => vi.unstubAllGlobals());
  function setup() {
    const bitmap = { close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
    const png = new Blob(['PNG with artwork and title'], { type: 'image/png' });
    const context = { drawImage: vi.fn(), strokeText: vi.fn(), fillText: vi.fn(), font: '', textAlign: '', textBaseline: '', lineWidth: 0, strokeStyle: '', fillStyle: '' };
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => context), toBlob: vi.fn((callback: (blob: Blob) => void) => callback(png)) };
    const fonts = { ready: Promise.resolve(), load: vi.fn(async () => []) };
    vi.stubGlobal('document', { fonts, createElement: vi.fn(() => canvas) });
    return { bitmap, canvas, context, png, fonts };
  }
  it('downloads the offline illustration together with a bounded title as a portable PNG', async () => {
    const { bitmap, canvas, context, png, fonts } = setup();
    expect(await composeUltimateCard(new Blob(['webp']), '萬卷雷霆陣', new AbortController().signal)).toBe(png);
    expect([canvas.width, canvas.height]).toEqual([1024, 1536]);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1024, 1536);
    const layout = getUltimateCardLayout('萬卷雷霆陣');
    expect(context.fillText).toHaveBeenCalledWith('萬卷雷霆陣', layout.titleX, layout.titleY, layout.titleMaxWidth);
    expect(context.textBaseline).toBe('alphabetic');
    expect(fonts.load).toHaveBeenCalledWith(`900 ${layout.titleSize}px ${CARD_TITLE_FONT}`, '萬卷雷霆陣');
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });
  it.each(allUltimateSpells)('exports $name at the same plaque baseline and font as its screen overlay', async spell => {
    const { context } = setup();
    const layout = getUltimateCardLayout(spell.name);
    await composeUltimateCard(new Blob(['webp']), spell.name, new AbortController().signal);
    expect(context.font).toBe(`900 ${layout.titleSize}px ${CARD_TITLE_FONT}`);
    expect(context.textBaseline).toBe('alphabetic');
    expect(context.strokeText).toHaveBeenCalledWith(spell.name, layout.titleX, layout.titleY, layout.titleMaxWidth);
    expect(context.fillText).toHaveBeenCalledWith(spell.name, layout.titleX, layout.titleY, layout.titleMaxWidth);
  });
  it('closes decoded resources and emits no image after a cancelled export', async () => {
    const { bitmap, canvas } = setup();
    const controller = new AbortController();
    vi.stubGlobal('document', { fonts: { ready: Promise.resolve().then(() => controller.abort()) }, createElement: vi.fn(() => canvas) });
    await expect(composeUltimateCard(new Blob(['webp']), '守護城堡', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(canvas.toBlob).not.toHaveBeenCalled();
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });
  it('does not emit a card when cancellation happens during explicit title-font loading', async () => {
    const { bitmap, canvas, fonts } = setup();
    const controller = new AbortController();
    fonts.load.mockImplementationOnce(async () => { controller.abort(); return []; });
    await expect(composeUltimateCard(new Blob(['webp']), '寒晶冰矛', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(canvas.toBlob).not.toHaveBeenCalled();
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });
});
