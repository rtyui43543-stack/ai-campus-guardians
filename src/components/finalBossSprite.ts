import type { Mode } from '../domain/types';
import { FINAL_BOSS_ART } from '../content/finalBossArt';
import { createCoverHeroSprite, type CoverHeroSpriteOptions, type HeroSpriteCalibration, type HeroSpriteFrameCalibration, type HeroSpritePose } from './coverHeroSprite';

export function getFinalBossArt(mode: Mode) {
  const art = FINAL_BOSS_ART.find(item => item.mode === mode);
  if (!art) throw new Error('最終魔王圖集尚未準備好。');
  return art;
}

export function createFinalBossSprite(mode: Mode, options: Omit<CoverHeroSpriteOptions, 'assetPath' | 'identity'> = {}) {
  const art = getFinalBossArt(mode);
  const frames = {} as Record<HeroSpritePose, HeroSpriteFrameCalibration>;
  for (const pose of ['idle', 'windup', 'release', 'hurt'] as HeroSpritePose[]) {
    const frame = art.frames[pose], { rect } = frame;
    frames[pose] = { rect, foot: { x: (frame.foot[0] - rect.x) / rect.width, y: (frame.foot[1] - rect.y) / rect.height },
      gem: { x: (frame.emitter[0] - rect.x) / rect.width, y: (frame.emitter[1] - rect.y) / rect.height }, hatTopY: (frame.topY - rect.y) / rect.height };
  }
  const actorHeight = mode === 'advanced' ? 3.7 : 3.45;
  const calibration: HeroSpriteCalibration = { actorHeight, atlasWidth: art.width, atlasHeight: art.height, frames };
  const identity = mode === 'starter' ? 'chaos-grimoire-king' : 'illusion-nine-dragon';
  const rig = createCoverHeroSprite({ ...options, calibration, assetPath: art.assetPath, identity });
  rig.root.userData.missionBossId = identity;
  rig.root.userData.character = identity;
  rig.root.userData.mode = mode;
  rig.root.userData.finalBoss = true;
  const units = actorHeight / (art.frames.idle.foot[1] - art.frames.idle.topY);
  rig.root.userData.outerLeftExtent = Math.max(...Object.values(art.frames).map(frame => (frame.foot[0] - frame.rect.x) * units));
  rig.root.userData.outerRightExtent = Math.max(...Object.values(art.frames).map(frame => (frame.rect.x + frame.rect.width - frame.foot[0]) * units));
  const update = rig.updateVisual;
  rig.updateVisual = state => update({ ...state, success: state.attackTime === undefined ? state.success : !state.success });
  return rig;
}
