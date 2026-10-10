/** The summoned creatures use artwork derived from their collection cards.
 * Presentation shares the battle's existing 900 ms hit and 3 s end markers. */
import phoenixFallback from '../assets/summon-phoenix-fallback.webp?inline';
import iceDragonFallback from '../assets/summon-ice-dragon-fallback.webp?inline';
import type { Level } from '../domain/types';
import { appAssetUrl } from '../platform/urls';

export const ULTIMATE_SUMMON_TIMING = {
  durationMs: 3000,
  impactMs: 900,
} as const;

export const ULTIMATE_SUMMON_ART = {
  phoenix: {
    path: '/art/summon-phoenix-v1.png',
    label: '金紅羽翼的智慧烈焰鳳',
    width: 1536,
    height: 1024,
  },
  iceDragon: {
    path: '/art/summon-ice-dragon-v1.png',
    label: '冰晶鱗甲與巨大雙翼的極寒冰龍',
    width: 1536,
    height: 1024,
  },
} as const;

export type UltimateSummonKind = keyof typeof ULTIMATE_SUMMON_ART;

type SummonBattle = Pick<Level, 'mode' | 'chapterId' | 'finalBoss'>;
type SummonImage = Pick<HTMLImageElement, 'src' | 'onload' | 'onerror' | 'decode' | 'decoding' | 'fetchPriority'>;
// Keep the decoded image alive, not only a resolved promise. Mobile browsers can
// discard an unreferenced preload and decode it again during the short flight.
const preloaded = new Map<string, { image: SummonImage; ready: Promise<boolean>; decoded: boolean }>();
const fallbackImages: Record<UltimateSummonKind, string> = { phoenix: phoenixFallback, iceDragon: iceDragonFallback };

/** The short flight cannot wait for a network image. Its bundled thumbnail is
 * the same creature, with transparency, and needs no second network request. */
export function summonImageSource(kind: UltimateSummonKind): string {
  const url = appAssetUrl(ULTIMATE_SUMMON_ART[kind].path);
  return preloaded.get(url)?.decoded ? url : fallbackImages[kind];
}

/** An image can fail again after a successful preload was evicted. Keep this
 * cast on its bundled art while retrying full resolution for a later cast. */
export function recoverSummonImageSource(kind: UltimateSummonKind, createImage: () => SummonImage = () => new Image()): string {
  preloaded.delete(appAssetUrl(ULTIMATE_SUMMON_ART[kind].path));
  void preloadSummon(kind, createImage);
  return fallbackImages[kind];
}

export function battleSummonKinds(level: SummonBattle): readonly UltimateSummonKind[] {
  if (level.mode !== 'advanced') return level.finalBoss || level.chapterId === 5 ? ['phoenix'] : [];
  if (level.finalBoss) return ['phoenix', 'iceDragon'];
  return level.chapterId === 5 ? ['phoenix'] : level.chapterId === 6 ? ['iceDragon'] : [];
}

/** Load and decode before the three-second presentation starts. Failed loads
 * can retry on the next battle; this never changes the battle or its timer. */
export async function preloadUltimateSummons(level: SummonBattle, createImage: () => SummonImage = () => new Image()): Promise<void> {
  await Promise.all(battleSummonKinds(level).map(kind => preloadSummon(kind, createImage)));
}

function preloadSummon(kind: UltimateSummonKind, createImage: () => SummonImage): Promise<boolean> {
  const url = appAssetUrl(ULTIMATE_SUMMON_ART[kind].path);
  const cached = preloaded.get(url);
  if (cached) return cached.ready;
  const image = createImage();
  const ready = new Promise<boolean>(resolve => {
    image.decoding = 'async'; image.fetchPriority = 'high';
    image.onload = () => { void image.decode().then(() => resolve(true), () => resolve(false)); };
    image.onerror = () => resolve(false);
    image.src = url;
  });
  const entry = { image, ready, decoded: false };
  preloaded.set(url, entry);
  void ready.then(success => {
    // A failed rendered image may have begun a fresh request meanwhile.
    if (preloaded.get(url) !== entry) return;
    if (success) entry.decoded = true;
    else preloaded.delete(url);
  });
  return ready;
}
