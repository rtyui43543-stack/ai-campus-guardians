import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../platform/urls', () => ({ appAssetUrl: (path: string) => `/ai-campus-guardians${path}` }));

function testImage() {
  return {
    src: '', onload: null as HTMLImageElement['onload'], onerror: null as HTMLImageElement['onerror'],
    decoding: 'auto' as HTMLImageElement['decoding'], fetchPriority: 'auto' as HTMLImageElement['fetchPriority'],
    decode: vi.fn(() => Promise.resolve()),
  };
}

describe('card-derived creature readiness', () => {
  beforeEach(() => vi.resetModules());

  it('preloads the starter phoenix, the selected advanced creature and relevant final-battle choices', async () => {
    const { battleSummonKinds } = await import('./ultimateSummons');
    expect(battleSummonKinds({ mode: 'advanced', chapterId: 5 })).toEqual(['phoenix']);
    expect(battleSummonKinds({ mode: 'advanced', chapterId: 6 })).toEqual(['iceDragon']);
    expect(battleSummonKinds({ mode: 'advanced', chapterId: 7, finalBoss: true })).toEqual(['phoenix', 'iceDragon']);
    for (const mode of ['starter', 'advanced'] as const) {
      for (const chapterId of [1, 2, 3, 4]) expect(battleSummonKinds({ mode, chapterId })).toEqual([]);
    }
    expect(battleSummonKinds({ mode: 'starter', chapterId: 5 })).toEqual(['phoenix']);
    expect(battleSummonKinds({ mode: 'starter', chapterId: 6 })).toEqual([]);
    expect(battleSummonKinds({ mode: 'starter', chapterId: 7, finalBoss: true })).toEqual(['phoenix']);
  });

  it('waits for loading and decoding, uses a project-scoped URL, and shares a successful preload across battles', async () => {
    const { preloadUltimateSummons } = await import('./ultimateSummons');
    const image = testImage();
    const factory = vi.fn(() => image);
    const level = { mode: 'advanced' as const, chapterId: 5 };
    let ready = false;
    const first = preloadUltimateSummons(level, factory).then(() => { ready = true; });
    const concurrent = preloadUltimateSummons(level, factory);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(image.src).toBe('/ai-campus-guardians/art/summon-phoenix-v1.png');
    expect(image.fetchPriority).toBe('high');
    expect(ready).toBe(false);
    (image.onload as () => void)();
    await Promise.all([first, concurrent]);
    expect(image.decode).toHaveBeenCalledTimes(1);
    expect(ready).toBe(true);
    await preloadUltimateSummons(level, factory);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('lets a failed asset retry on the next entry without failing or changing the battle', async () => {
    const { preloadUltimateSummons } = await import('./ultimateSummons');
    const image = testImage();
    const factory = vi.fn(() => image);
    const level = { mode: 'advanced' as const, chapterId: 6 };
    const failed = preloadUltimateSummons(level, factory);
    (image.onerror as () => void)();
    await failed;
    const retry = preloadUltimateSummons(level, factory);
    expect(factory).toHaveBeenCalledTimes(2);
    (image.onload as () => void)();
    await retry;
  });

  it('loads both selectable summons before declaring the advanced final battle preload ready', async () => {
    const { preloadUltimateSummons } = await import('./ultimateSummons');
    const images = [testImage(), testImage()];
    let index = 0;
    let ready = false;
    const request = preloadUltimateSummons({ mode: 'advanced', chapterId: 7, finalBoss: true }, () => images[index++]).then(() => { ready = true; });
    expect(index).toBe(2);
    expect(images.map(image => image.src)).toEqual(['/ai-campus-guardians/art/summon-phoenix-v1.png', '/ai-campus-guardians/art/summon-ice-dragon-v1.png']);
    (images[0].onload as () => void)();
    await Promise.resolve();
    expect(ready).toBe(false);
    (images[1].onload as () => void)();
    await request;
    expect(ready).toBe(true);
  });

  it('retries a loaded but undecodable creature instead of permanently treating it as ready', async () => {
    const { preloadUltimateSummons } = await import('./ultimateSummons');
    const bad = testImage(), good = testImage();
    bad.decode.mockRejectedValue(new Error('transient decode failure'));
    const factory = vi.fn().mockReturnValueOnce(bad).mockReturnValueOnce(good);
    const level = { mode: 'advanced' as const, chapterId: 6 };
    const first = preloadUltimateSummons(level, factory);
    (bad.onload as () => void)();
    await first;
    const retry = preloadUltimateSummons(level, factory);
    expect(factory).toHaveBeenCalledTimes(2);
    (good.onload as () => void)();
    await retry;
    await preloadUltimateSummons(level, factory);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it.each(['phoenix', 'iceDragon'] as const)('has bundled transparent %s art before any network request', async kind => {
    const { summonImageSource, ULTIMATE_SUMMON_ART } = await import('./ultimateSummons');
    const source = summonImageSource(kind);
    expect(source).toMatch(/^data:image\/webp;base64,/);
    expect(source).not.toContain(ULTIMATE_SUMMON_ART[kind].path);
    const imageBytes = Buffer.from(source.split(',')[1], 'base64');
    expect(imageBytes.toString('ascii', 0, 4)).toBe('RIFF');
    expect(imageBytes.toString('ascii', 8, 12)).toBe('WEBP');
    expect(imageBytes.toString('ascii', 12, 16)).toBe('VP8X');
    expect(imageBytes[20] & 0x10).toBe(0x10); // Extended WebP alpha flag.
    expect(imageBytes.length).toBeLessThan(120_000);
  });

  it.each([
    { kind: 'phoenix' as const, mode: 'starter' as const, chapterId: 5 },
    { kind: 'phoenix' as const, mode: 'advanced' as const, chapterId: 5 },
    { kind: 'iceDragon' as const, mode: 'advanced' as const, chapterId: 6 },
  ])('keeps $mode chapter $chapterId on bundled art until download AND decoding finish', async ({ kind, mode, chapterId }) => {
    const { preloadUltimateSummons, summonImageSource, ULTIMATE_SUMMON_ART } = await import('./ultimateSummons');
    const image = testImage();
    let finishDecode!: () => void;
    image.decode.mockImplementation(() => new Promise(resolve => { finishDecode = resolve; }));
    const coldSource = summonImageSource(kind);
    const ready = preloadUltimateSummons({ mode, chapterId }, () => image);
    expect(summonImageSource(kind)).toBe(coldSource);
    (image.onload as () => void)();
    await Promise.resolve();
    expect(summonImageSource(kind)).toBe(coldSource);
    finishDecode();
    await ready;
    expect(summonImageSource(kind)).toBe(`/ai-campus-guardians${ULTIMATE_SUMMON_ART[kind].path}`);
    // The source already selected for the ongoing cue remains the bundled one.
    expect(coldSource).toMatch(/^data:image\/webp;base64,/);
  });

  it('recovers a later rendered-image failure with bundled art and retries full resolution', async () => {
    const { preloadUltimateSummons, summonImageSource, recoverSummonImageSource, ULTIMATE_SUMMON_ART } = await import('./ultimateSummons');
    const firstImage = testImage(), retryImage = testImage();
    const level = { mode: 'advanced' as const, chapterId: 6 };
    const preload = preloadUltimateSummons(level, () => firstImage);
    (firstImage.onload as () => void)();
    await preload;
    expect(summonImageSource('iceDragon')).toBe(`/ai-campus-guardians${ULTIMATE_SUMMON_ART.iceDragon.path}`);
    const recovery = recoverSummonImageSource('iceDragon', () => retryImage);
    expect(recovery).toMatch(/^data:image\/webp;base64,/);
    expect(summonImageSource('iceDragon')).toBe(recovery);
    const retry = preloadUltimateSummons(level, () => { throw new Error('request should already be shared'); });
    (retryImage.onload as () => void)();
    await retry;
    expect(summonImageSource('iceDragon')).toBe(`/ai-campus-guardians${ULTIMATE_SUMMON_ART.iceDragon.path}`);
  });
});
