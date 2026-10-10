import * as THREE from 'three';
import type { Mode } from '../domain/types';
import { FINAL_BOSS_ART } from '../content/finalBossArt';
import { createCoverHeroSprite, type CoverHeroSpriteOptions, type HeroSpriteCalibration, type HeroSpriteFrameCalibration, type HeroSpritePose } from './coverHeroSprite';

export function getFinalBossArt(mode: Mode) {
  const art = FINAL_BOSS_ART.find(item => item.mode === mode);
  if (!art) throw new Error('最終魔王圖集尚未準備好。');
  return art;
}

/** A calibrated image is kept upright while its upper body compresses back,
 * then leans toward the player. Root yaw/roll is cancelled by the billboard,
 * so deform the visible quad rather than invisible logical arms. */
export function finalBossCastShape(time: number | undefined, attacking: boolean, reducedMotion: boolean) {
  if (!attacking || reducedMotion || time === undefined || !Number.isFinite(time) || time < 0 || time >= 1.5) {
    return { compression: 0, lean: 0, headEnergy: 0 };
  }
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const charge = Math.sin(clamp(time / .48) * Math.PI / 2);
  const release = clamp((time - .48) / .16);
  const recovery = 1 - clamp((time - .92) / .58);
  return { compression: .055 * charge * (1 - release),
    lean: (.052 * charge * (1 - release) - .068 * release) * recovery,
    headEnergy: charge * (1 - clamp((time - .48) / .22)) };
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
  const image = rig.root.getObjectByName('cover-identity-hero-atlas') as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  const imageVisual = rig.root.getObjectByName('cover-identity-hero')!;
  // Nine rings use the reviewed face landmarks of the one existing silhouette.
  // They are not alternative atlas poses and do not cover the face centers.
  const energy = new THREE.Group(); energy.name = 'final-nine-head-charge'; energy.visible = false;
  const ringGeometry = new THREE.RingGeometry(.074, .105, 20), coreGeometry = new THREE.CircleGeometry(.039, 12);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xe1b6f1, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xffe6af, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const headPoints = 'headCenters' in art ? art.headCenters : [];
  if (mode === 'advanced') {
    headPoints.forEach(([x, y], index) => {
      const head = new THREE.Group(); head.name = `final-head-energy-${index + 1}`;
      head.position.set((x - art.frames.idle.foot[0]) * units, (art.frames.idle.foot[1] - y) * units + .20, .045);
      const ring = new THREE.Mesh(ringGeometry, ringMaterial), core = new THREE.Mesh(coreGeometry, coreMaterial);
      ring.renderOrder = core.renderOrder = 2; head.add(ring, core); energy.add(head);
    });
    imageVisual.add(energy);
  }
  const baseVertices: number[][] = [], baseTip = new THREE.Vector3(); let measuredPose: HeroSpritePose | undefined;
  const update = rig.updateVisual;
  rig.updateVisual = state => {
    if (rig.root.userData.spriteStatus === 'disposed') return;
    // The base renderer restores a fresh calibrated rectangle on pose changes.
    const priorPose = rig.root.userData.pose as HeroSpritePose;
    if (measuredPose === priorPose) {
      const vertices = image.geometry.getAttribute('position');
      baseVertices.forEach(([x, y, z], index) => vertices.setXYZ(index, x, y, z));
      rig.tip.position.copy(baseTip);
    }
    update({ ...state, success: state.attackTime === undefined ? state.success : !state.success });
    const pose = rig.root.userData.pose as HeroSpritePose;
    const vertices = image.geometry.getAttribute('position');
    if (measuredPose !== pose) {
      baseVertices.splice(0, baseVertices.length, ...Array.from({length: vertices.count}, (_, index) => [vertices.getX(index), vertices.getY(index), vertices.getZ(index)]));
      baseTip.copy(rig.tip.position);
      measuredPose = pose;
    }
    const shape = finalBossCastShape(state.attackTime, !state.success, state.reducedMotion);
    baseVertices.forEach(([x, y, z], index) => vertices.setXYZ(index, x + (y - .02) * shape.lean, .02 + (y - .02) * (1 - shape.compression), z));
    vertices.needsUpdate = true; image.geometry.computeBoundingSphere(); image.geometry.computeBoundingBox();
    // Keep the emission tip on the visibly leaning atlas, while the sole is fixed.
    rig.tip.position.x += (rig.tip.position.y - .02) * shape.lean;
    rig.tip.position.y = .02 + (rig.tip.position.y - .02) * (1 - shape.compression);
    rig.root.userData.castShape = shape;
    energy.visible = mode === 'advanced' && shape.headEnergy > .01;
    ringMaterial.opacity = shape.headEnergy * .86; coreMaterial.opacity = shape.headEnergy * .74;
    energy.children.forEach((head, index) => {
      const [x, y] = headPoints[index];
      const baseX = (x - art.frames.idle.foot[0]) * units, baseY = (art.frames.idle.foot[1] - y) * units + .20;
      head.position.set(baseX + (baseY - .02) * shape.lean, .02 + (baseY - .02) * (1 - shape.compression), .045);
      head.scale.setScalar(.66 + shape.headEnergy * .34);
    });
    rig.root.updateMatrixWorld(true);
  };
  const dispose = rig.disposeVisual; let disposed = false;
  rig.disposeVisual = () => {
    if (disposed) return; disposed = true;
    energy.removeFromParent(); ringGeometry.dispose(); coreGeometry.dispose(); ringMaterial.dispose(); coreMaterial.dispose();
    dispose();
  };
  return rig;
}
