import type { Mode } from '../domain/types';
import { getBossForTheme } from '../content/missionBosses';
import { ADVANCED_BOSS_ART } from '../content/advancedBossArt';
import { createChapterBoss } from './chapterBoss';
import { createCoverGuardian, type CoverGuardianRig } from './coverGuardian';
import { createCoverHeroSprite, type CoverHeroSpriteOptions, type CoverHeroSpriteRig,
  type HeroSpriteCalibration, type HeroSpriteFrameCalibration, type HeroSpritePose } from './coverHeroSprite';

export interface MissionEnemyRig extends CoverGuardianRig {
  updateVisual?: CoverHeroSpriteRig['updateVisual'];
  disposeVisual?: CoverHeroSpriteRig['disposeVisual'];
}

/** The alpha-safe pixel regions come from the actual generated atlas, not an assumed 2×2 grid. */
export function getAdvancedBossArt(chapterId: number) {
  const theme = getBossForTheme(chapterId, 'advanced').chapterId;
  const art = ADVANCED_BOSS_ART.find(item => item.chapterId === theme);
  if (!art) throw new Error('找不到進階魔王的角色圖集錨點。');
  return art;
}

export function advancedBossCalibration(chapterId: number): HeroSpriteCalibration {
  const art = getAdvancedBossArt(chapterId);
  const frames = {} as Record<HeroSpritePose, HeroSpriteFrameCalibration>;
  for (const pose of ['idle', 'windup', 'release', 'hurt'] as const) {
    const frame = art.frames[pose], { rect } = frame;
    frames[pose] = {
      rect,
      foot: { x: (frame.foot[0] - rect.x) / rect.width, y: (frame.foot[1] - rect.y) / rect.height },
      gem: { x: (frame.emitter[0] - rect.x) / rect.width, y: (frame.emitter[1] - rect.y) / rect.height },
      hatTopY: (frame.topY - rect.y) / rect.height,
    };
  }
  return { actorHeight: [3.05, 3.25, 3.45, 3.2, 3.05, 3.8][art.chapterId - 1],
    atlasWidth: art.width, atlasHeight: art.height, frames };
}

/** Right-hand actors need room for every pose's tail, legs and raised hand on phones. */
export function advancedBossOuterExtent(chapterId: number): number {
  const art = getAdvancedBossArt(chapterId), height = advancedBossCalibration(chapterId).actorHeight!;
  const units = height / (art.frames.idle.foot[1] - art.frames.idle.topY);
  return Math.max(...Object.values(art.frames).map(frame =>
    (frame.rect.x + frame.rect.width - frame.foot[0]) * units));
}

/** Advanced opponents have their own four rendered poses. Hero success means the boss is hit. */
export function createAdvancedBossSprite(chapterId: number,
  options: Omit<CoverHeroSpriteOptions, 'assetPath' | 'identity'> = {}): CoverHeroSpriteRig {
  const boss = getBossForTheme(chapterId, 'advanced');
  const rig = createCoverHeroSprite({ ...options, calibration: options.calibration ?? advancedBossCalibration(chapterId),
    assetPath: boss.artPath, identity: boss.id });
  rig.root.userData.character = boss.id; rig.root.userData.missionBossId = boss.id;
  rig.root.userData.mode = 'advanced'; rig.root.userData.chapterId = boss.chapterId;
  rig.root.userData.outerRightExtent = advancedBossOuterExtent(chapterId);
  const update = rig.updateVisual;
  rig.updateVisual = state => update({ ...state,
    success: state.attackTime === undefined ? state.success : !state.success });
  return rig;
}

/** Opening always introduces Mimi; difficulty never turns that companion into an opponent. */
export function createMissionEnemy(chapterId: number, mode: Mode, companion = false,
  options: Omit<CoverHeroSpriteOptions, 'assetPath' | 'identity'> = {}): MissionEnemyRig {
  if (companion) {
    const rig = createCoverGuardian(1); rig.root.userData.missionBossId = 'mimi-companion'; return rig;
  }
  if (mode === 'advanced') return createAdvancedBossSprite(chapterId, options);
  const boss = getBossForTheme(chapterId, mode), rig = createChapterBoss(boss.chapterId);
  rig.root.userData.missionBossId = boss.id; rig.root.userData.mode = mode; return rig;
}
