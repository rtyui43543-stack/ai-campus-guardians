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
});
