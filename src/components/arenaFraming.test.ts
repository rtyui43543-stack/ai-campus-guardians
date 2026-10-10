import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCoverHeroSprite, type HeroSpritePose } from './coverHeroSprite';
import { createMissionEnemy, type MissionEnemyRig } from './advancedBossSprite';
import { createFinalBossSprite } from './finalBossSprite';
import { createBattleFrameTracker, fitBattleActors, fitStoryActors, measureActorFraming } from './arenaFraming';

function view(width = 8, height = 8.8, y = 1.8, elevation = 4.7, x = 0, zoom = 1) {
  const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, .1, 60);
  camera.position.set(x, y + elevation, 15); camera.lookAt(x, y, 0); camera.zoom = zoom;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  return camera;
}

function projectedBounds(actor: { root: THREE.Group }, camera: THREE.Camera) {
  actor.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  const sprite = actor.root.getObjectByName('cover-identity-hero-atlas') as THREE.Mesh | undefined;
  const collect = (object: THREE.Object3D) => {
    if (!(object instanceof THREE.Mesh) || (!sprite && !object.visible)) return;
    const positions = object.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) bounds.expandByPoint(new THREE.Vector3()
      .fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(camera));
  };
  if (sprite) collect(sprite); else actor.root.traverse(collect);
  return bounds;
}

const poses: HeroSpritePose[] = ['idle', 'windup', 'release', 'hurt'];
const cases = [
  { name: 'starter first boss', make: () => createMissionEnemy(1, 'starter') },
  { name: 'starter wings', make: () => createMissionEnemy(5, 'starter') },
  { name: 'spider', make: () => createMissionEnemy(1, 'advanced', false, { loadTexture: () => undefined }) },
  { name: 'fox', make: () => createMissionEnemy(4, 'advanced', false, { loadTexture: () => undefined }) },
  { name: 'cloud giant', make: () => createMissionEnemy(6, 'advanced', false, { loadTexture: () => undefined }) },
  { name: 'starter final', make: () => createFinalBossSprite('starter', { loadTexture: () => undefined }) },
  { name: 'nine-head final', make: () => createFinalBossSprite('advanced', { loadTexture: () => undefined }) },
];

describe('battle framing', () => {
  it('ignores hidden feedback and the added explanation footer until a visible question or viewport changes', () => {
    const hero = createCoverHeroSprite({ loadTexture: () => undefined });
    const boss = createMissionEnemy(1, 'starter');
    const camera = view();
    const heroBounds = measureActorFraming(hero, camera), enemyBounds = measureActorFraming(boss, camera);
    const track = createBattleFrameTracker();
    const waiting = fitBattleActors(track({ width: 390, height: 844, questionBottom: 286, answersTop: 625, resolving: false }), heroBounds, enemyBounds);
    const cast = fitBattleActors(track({ width: 390, height: 844, questionBottom: 424, answersTop: 573, resolving: true }), heroBounds, enemyBounds);
    const feedback = fitBattleActors(track({ width: 390, height: 844, questionBottom: 445, answersTop: 573, resolving: true }), heroBounds, enemyBounds);
    expect(cast).toEqual(waiting); expect(feedback).toEqual(waiting);
    // These are the actual projected atlas dimensions, not a CSS snapshot.
    const heights = [waiting, cast, feedback].map(fit => {
      const camera = view(fit.viewWidth, fit.viewHeight, fit.lookY, fit.elevation);
      hero.root.scale.setScalar(fit.scale); hero.root.position.x = fit.heroX;
      hero.updateVisual({ camera, pose: 'idle', reducedMotion: true });
      const bounds = projectedBounds(hero, camera);
      return (bounds.max.y - bounds.min.y) * 844 / 2;
    });
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(.01);
    const rotated = track({ width: 844, height: 390, questionBottom: 280, answersTop: 220, resolving: true });
    expect(rotated.width).toBe(844); expect(rotated.height).toBe(390);
    expect(rotated.questionBottom / rotated.height).toBeCloseTo(286 / 844);
    const next = track({ width: 844, height: 390, questionBottom: 180, answersTop: 280, resolving: false });
    expect(next.questionBottom).toBe(180); expect(next.answersTop).toBe(280);
    hero.disposeVisual();
  });

  describe.each([[360, 800], [390, 844], [768, 1024], [1024, 768], [1440, 900]])('%s × %s', (width, height) => {
    it.each(cases)('keeps every $name pose within the actor slot and horizontal margins', ({ make }) => {
      const hero = createCoverHeroSprite({ loadTexture: () => undefined });
      const enemy = make();
      const measuringCamera = view();
      const fit = fitBattleActors({ width, height, questionBottom: height * .36, answersTop: height * .78, resolving: false },
        measureActorFraming(hero, measuringCamera), measureActorFraming(enemy, measuringCamera));
      const camera = view(fit.viewWidth, fit.viewHeight, fit.lookY, fit.elevation);
      for (const pose of poses) for (const reaction of [false, true]) {
        hero.root.scale.setScalar(fit.scale); enemy.root.scale.setScalar(fit.scale * (reaction ? 1.09 : 1));
        hero.root.position.set(fit.heroX - (reaction ? .30 * fit.scale : 0), -.09, 0);
        enemy.root.position.set(fit.enemyX + (reaction ? .48 * fit.scale : 0), reaction ? .16 * fit.scale : 0, 0);
        enemy.leftArm.rotation.z = reaction ? -2.36 : -.26;
        enemy.rightArm.rotation.z = reaction ? .96 : .26;
        enemy.head.rotation.z = reaction ? -.21 : 0;
        hero.updateVisual({ camera, pose, reducedMotion: true });
        enemy.updateVisual?.({ camera, pose, reducedMotion: true });
        for (const actor of [hero, enemy]) {
          const bounds = projectedBounds(actor, camera);
          expect((bounds.min.x + 1) * width / 2).toBeGreaterThanOrEqual(width <= 600 ? 13 : 23);
          expect((bounds.max.x + 1) * width / 2).toBeLessThanOrEqual(width - (width <= 600 ? 13 : 23));
          expect((1 - bounds.max.y) * height / 2).toBeGreaterThanOrEqual(fit.top - 3);
          expect((1 - bounds.min.y) * height / 2).toBeLessThanOrEqual(fit.bottom + 12);
        }
      }
      hero.disposeVisual(); enemy.disposeVisual?.();
    });
  });
});

describe.each([.65, 1, 1.5, 16 / 9, 3])('story camera at aspect %s', aspect => {
  it.each(cases)('keeps $name and the complete hero visible in every shot and entrance', ({ make }) => {
    const hero = createCoverHeroSprite({ loadTexture: () => undefined });
    const enemy: MissionEnemyRig = make();
    const viewHeight = 6, viewWidth = viewHeight * aspect;
    const heroX = -Math.min(3.35, viewWidth * .235), enemyX = -heroX;
    const camera = view(viewWidth, viewHeight, 1.55, 3.8);
    const actors = { heroX, enemyX, hero: measureActorFraming(hero, camera), enemy: measureActorFraming(enemy, camera) };
    for (const x of [0, heroX, enemyX]) for (const zoom of [1, 1.3, 1.6]) for (const arrival of [0, .65]) {
      const fit = fitStoryActors(viewWidth, viewHeight, { x, y: x === heroX ? 2.05 : 1.55, zoom }, actors, 3.8);
      camera.zoom = fit.zoom; camera.position.set(fit.x, fit.y + 3.8, 15); camera.lookAt(fit.x, fit.y, 0);
      camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      hero.root.position.x = heroX - arrival; enemy.root.position.x = enemyX;
      enemy.rightArm.rotation.z = x === enemyX ? .96 : .26;
      hero.updateVisual({ camera, reducedMotion: true }); enemy.updateVisual?.({ camera, reducedMotion: true });
      for (const actor of [hero, enemy]) {
        const bounds = projectedBounds(actor, camera);
        expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x))).toBeLessThan(.93);
        expect(Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y))).toBeLessThan(.93);
      }
    }
    hero.disposeVisual(); enemy.disposeVisual?.();
  });
});
