/** The summoned creatures use artwork derived from their collection cards.
 * Presentation shares the battle's existing 900 ms hit and 3 s end markers. */
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
import type { Level } from '../domain/types';
import { appAssetUrl } from '../platform/urls';


type SummonBattle = Pick<Level, 'mode' | 'chapterId' | 'finalBoss'>;
type SummonImage = Pick<HTMLImageElement, 'src' | 'onload' | 'onerror' | 'decode' | 'decoding' | 'fetchPriority'>;
const preloaded = new Map<string, Promise<boolean>>();

export function battleSummonKinds(level: SummonBattle): readonly UltimateSummonKind[] {
  if (level.mode !== 'advanced') return [];
  if (level.finalBoss) return ['phoenix', 'iceDragon'];
  return level.chapterId === 5 ? ['phoenix'] : level.chapterId === 6 ? ['iceDragon'] : [];
}

/** Load and decode before the three-second presentation starts. Failed loads
 * can retry on the next battle; this never changes the battle or its timer. */
export async function preloadUltimateSummons(level: SummonBattle, createImage: () => SummonImage = () => new Image()): Promise<void> {
  await Promise.all(battleSummonKinds(level).map(kind => {
    const url = appAssetUrl(ULTIMATE_SUMMON_ART[kind].path);
    const cached = preloaded.get(url);
    if (cached) return cached;
    const ready = new Promise<boolean>(resolve => {
      const image = createImage();
      image.decoding = 'async'; image.fetchPriority = 'high';
      image.onload = () => { void image.decode().then(() => resolve(true), () => resolve(true)); };
      image.onerror = () => resolve(false);
      image.src = url;
    });
    preloaded.set(url, ready);
    void ready.then(success => { if (!success) preloaded.delete(url); });
    return ready;
  }));
}
