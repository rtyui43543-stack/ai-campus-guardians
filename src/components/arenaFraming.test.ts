import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCoverHeroSprite, type HeroSpritePose } from './coverHeroSprite';
import { createMissionEnemy, type MissionEnemyRig } from './advancedBossSprite';
import { createFinalBossSprite } from './finalBossSprite';
import { contactReaction, enemyCastMotion } from './combatChoreography';
import { createBattleFrameTracker, fitBattleActors, fitStoryActors, measureActorFraming, reframeLaunchOrigin,
  type BattleFrameLayout } from './arenaFraming';

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
  if (sprite) {
    collect(sprite);
    const headEnergy = actor.root.getObjectByName('final-nine-head-charge');
    if (headEnergy?.visible) headEnergy.traverse(collect);
  } else actor.root.traverse(collect);
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

// Actual CSS content-box measurements from the five 60/40 landscape viewports.
const landscape6040Cases = [
  { width: 490.667, height: 320.667, minHeroHeight: 150, minEnemyHeight: 90 },
  { width: 539.865, height: 358.667, minHeroHeight: 150, minEnemyHeight: 90 },
  { width: 598.667, height: 530.667, minHeroHeight: 200, minEnemyHeight: 140 },
  { width: 589.0625, height: 682.667, minHeroHeight: 200, minEnemyHeight: 140 },
  { width: 691.0625, height: 748.667, minHeroHeight: 200, minEnemyHeight: 140 },
];
// Desktop allocations subtract the full-width HUD, safe padding, and pane gap.
// Exercise every silhouette against the complete 60% pane, not the old full
// screen camera whose question and answers overlaid the actors.
const desktop6040Cases = [
  { width: 793.6, height: 682, minHeroHeight: 250, minEnemyHeight: 170 }, // 1366 × 768
  { width: 826, height: 778, minHeroHeight: 250, minEnemyHeight: 170 }, // 1440 × 900
  { width: 1114, height: 958, minHeroHeight: 300, minEnemyHeight: 200 }, // 1920 × 1080
];
const dedicated6040Cases = [...landscape6040Cases, ...desktop6040Cases];

describe('battle framing', () => {
  it.each(dedicated6040Cases)('keeps both actors readable and apart in a 60/40 landscape pane at $width × $height',
    ({ width, height, minHeroHeight, minEnemyHeight }) => {
    const hero = createCoverHeroSprite({ loadTexture: () => undefined });
    for (const mode of ['starter', 'advanced'] as const) for (const chapter of [1, 2, 3, 4, 5, 6, 'final'] as const) {
      const enemy = chapter === 'final' ? createFinalBossSprite(mode, { loadTexture: () => undefined })
        : createMissionEnemy(chapter, mode, false, { loadTexture: () => undefined });
      const fit = fitBattleActors({ width, height, viewport: 'dedicated', questionBottom: 0, answersTop: height, resolving: false },
        measureActorFraming(hero, view()), measureActorFraming(enemy, view()));
      const camera = view(fit.viewWidth, fit.viewHeight, fit.lookY, fit.elevation);
      hero.root.scale.setScalar(fit.scale); hero.root.position.set(fit.heroX, 0, 0);
      enemy.root.scale.setScalar(fit.scale); enemy.root.position.set(fit.enemyX, 0, 0);
      hero.updateVisual({ camera, pose: 'idle', reducedMotion: true });
      enemy.updateVisual?.({ camera, reducedMotion: true });
      const heroBounds = projectedBounds(hero, camera), enemyBounds = projectedBounds(enemy, camera);
      const heroHeight = (heroBounds.max.y - heroBounds.min.y) * height / 2;
      const enemyHeight = (enemyBounds.max.y - enemyBounds.min.y) * height / 2;
      const gap = (enemyBounds.min.x - heroBounds.max.x) * width / 2;
      expect(gap, `${mode}/${chapter}`).toBeGreaterThanOrEqual(8);
      expect(heroHeight, `${mode}/${chapter}`).toBeGreaterThanOrEqual(minHeroHeight);
      expect(enemyHeight, `${mode}/${chapter}`).toBeGreaterThanOrEqual(minEnemyHeight);
      enemy.disposeVisual?.();
    }
    hero.disposeVisual();
  });

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

  it('fits the allocated pane rather than hidden question and answer geometry during a cast or rotation', () => {
    const hero = createCoverHeroSprite({ loadTexture: () => undefined });
    const enemy = createMissionEnemy(1, 'starter');
    const track = createBattleFrameTracker();
    const heroBounds = measureActorFraming(hero, view()), enemyBounds = measureActorFraming(enemy, view());
    const waiting = fitBattleActors(track({ width: 370, height: 330, questionBottom: 0, answersTop: 330,
      resolving: false, viewport: 'dedicated' }), heroBounds, enemyBounds);
    const casting = fitBattleActors(track({ width: 370, height: 330, questionBottom: 290, answersTop: 60,
      resolving: true, viewport: 'dedicated' }), heroBounds, enemyBounds);
    expect(casting).toEqual(waiting);
    const rotated = fitBattleActors(track({ width: 976, height: 300, questionBottom: 200, answersTop: 230,
      resolving: true, viewport: 'dedicated' }), heroBounds, enemyBounds);
    expect(rotated.scale).toBeGreaterThan(1);
    expect(rotated.top).toBe(40); expect(rotated.bottom).toBe(286);
    const portrait = track({ width: 390, height: 844, questionBottom: 286, answersTop: 625, resolving: true });
    expect(portrait.questionBottom).toBe(286); expect(portrait.answersTop).toBe(625);
    hero.disposeVisual();
  });

  it.each([true, false])('keeps the original caster-relative launch point when rotating mid-flight (hero=%s)', success => {
    const previous = { heroX: -2.7, enemyX: 2.7, scale: .7 };
    const current = { heroX: -8.4, enemyX: 8.4, scale: 1.6 };
    const previousX = success ? previous.heroX : previous.enemyX;
    const currentX = success ? current.heroX : current.enemyX;
    const origin = new THREE.Vector3(previousX + .85 * previous.scale, 2.5 * previous.scale, .5 * previous.scale);
    const reframed = reframeLaunchOrigin(origin, success, previous, current);
    expect((reframed.x - currentX) / current.scale).toBeCloseTo(.85);
    expect(reframed.y / current.scale).toBeCloseTo(2.5);
    expect(reframed.z / current.scale).toBeCloseTo(.5);
    expect(reframeLaunchOrigin(reframed, success, current, previous).distanceTo(origin)).toBeLessThan(.0001);
    expect(reframeLaunchOrigin(origin, success, previous, previous)).toEqual(origin);
  });

  describe.each<Pick<BattleFrameLayout, 'width' | 'height' | 'viewport'>>([
    { width: 360, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 1024 },
    { width: 1024, height: 768 }, { width: 1440, height: 900 },
    { width: 328, height: 320, viewport: 'dedicated' },
    { width: 370, height: 330, viewport: 'dedicated' }, { width: 417, height: 368, viewport: 'dedicated' },
    { width: 450, height: 532, viewport: 'dedicated' },
    ...dedicated6040Cases.map(({ width, height }) => ({ width, height, viewport: 'dedicated' as const })),
    { width: 976, height: 240, viewport: 'dedicated' }, { width: 1024, height: 300, viewport: 'dedicated' },
  ])('$width × $height $viewport', ({ width, height, viewport }) => {
    it.each(['starter', 'advanced'] as const)('fits the actual %s final-boss cast deformation and contact responses', mode => {
      const hero = createCoverHeroSprite({ loadTexture: () => undefined });
      const enemy = createFinalBossSprite(mode, { loadTexture: () => undefined });
      const fit = fitBattleActors({ width, height, viewport, questionBottom: height * .36, answersTop: height * .78, resolving: false },
        measureActorFraming(hero, view()), measureActorFraming(enemy, view()));
      const camera = view(fit.viewWidth, fit.viewHeight, fit.lookY, fit.elevation);
      const cameraPosition = camera.position.clone(), cameraRotation = camera.quaternion.clone(), projection = camera.projectionMatrix.clone();
      const smooth = (value: number) => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
      const clamp = (value: number) => Math.max(0, Math.min(1, value));
      const outcomes = ['hero-hit', 'enemy-hit', 'enemy-critical', 'enemy-missed', 'enemy-blocked'] as const;
      // Sample release, maximum anticipation, contact hold and recovery instead of
      // forcing reduced-motion poses, which bypasses the visible atlas deformation.
      const times = [0, .2, .34, .42, .48, .52, .64, .8, .9, .97, 1.03, 1.2, 1.45, 1.7, 2.05];
      let sawCompression = false, sawForwardLean = false;
      for (const reducedMotion of [false, true]) for (const outcome of outcomes) for (const time of times) {
        const success = outcome === 'hero-hit', critical = outcome === 'enemy-critical';
        const missed = outcome === 'enemy-missed', blocked = outcome === 'enemy-blocked';
        hero.root.position.set(fit.heroX, 0, 0); enemy.root.position.set(fit.enemyX, 0, 0);
        hero.root.scale.setScalar(fit.scale); enemy.root.scale.setScalar(fit.scale);
        hero.root.rotation.set(0, .13, 0); enemy.root.rotation.set(0, -.15, 0);
        const cast = smooth((time - .25) / .28) * (1 - smooth((time - 1.2) / .45));
        const recoil = contactReaction(time, reducedMotion, missed);
        // Match the existing bounded arena root movement while exercising the
        // actual sprite updater below; the bounds assertion remains independent.
        if (!reducedMotion) {
          if (success) {
            hero.root.position.x += .20 * cast;
            hero.root.position.y -= Math.sin(clamp(time / .44) * Math.PI) * .09;
            hero.root.rotation.z = -.055 * Math.sin(clamp(time / .34) * Math.PI / 2) * (1 - cast);
            hero.root.rotation.y += .30 * cast;
            enemy.root.position.x += recoil * .48 * fit.scale;
            enemy.root.rotation.z -= recoil * .23;
            enemy.root.scale.y *= 1 - recoil * .045;
          } else {
            const motion = enemyCastMotion(time);
            enemy.root.position.x += (.10 * motion.anticipation - .10 * motion.release) * fit.scale;
            enemy.root.position.y -= .06 * motion.anticipation * fit.scale;
            enemy.root.rotation.y -= .14 * cast;
            if (critical) {
              enemy.root.position.y += Math.sin(clamp(time / .8) * Math.PI) * .16 * fit.scale;
              enemy.root.scale.setScalar(fit.scale * (1 + Math.sin(clamp(time / 1.65) * Math.PI) * .09));
            }
            if (missed) hero.root.position.x -= smooth((time - .35) / .4) * (1 - smooth((time - 1.2) / .55)) * .30 * fit.scale;
            else {
              hero.root.position.x -= recoil * (blocked ? .035 : critical ? .29 : .19) * fit.scale;
              hero.root.rotation.z += recoil * (blocked ? .025 : critical ? .15 : .10);
              hero.root.scale.y *= 1 - recoil * (blocked ? .008 : .035);
            }
          }
        }
        hero.updateVisual({ camera, attackTime: time, success, reducedMotion, pose: missed || blocked ? 'idle' : undefined });
        enemy.updateVisual({ camera, attackTime: time, success, reducedMotion });
        const shape = enemy.root.userData.castShape as { compression: number; lean: number; headEnergy: number };
        if (reducedMotion || success) expect(shape).toEqual({ compression: 0, lean: 0, headEnergy: 0 });
        else { sawCompression ||= shape.compression > .04; sawForwardLean ||= shape.lean < -.06; }
        for (const [name, actor] of [['hero', hero], ['enemy', enemy]] as const) {
          const bounds = projectedBounds(actor, camera), label = `${mode}/${outcome}/${time}/${reducedMotion}/${name}`;
          expect((bounds.min.x + 1) * width / 2, label).toBeGreaterThanOrEqual(width <= 600 ? 13 : 23);
          expect((bounds.max.x + 1) * width / 2, label).toBeLessThanOrEqual(width - (width <= 600 ? 13 : 23));
          expect((1 - bounds.max.y) * height / 2, label).toBeGreaterThanOrEqual(fit.top - 3);
          expect((1 - bounds.min.y) * height / 2, label).toBeLessThanOrEqual(fit.bottom + 12);
        }
      }
      expect(sawCompression).toBe(true); expect(sawForwardLean).toBe(true);
      expect(camera.position.equals(cameraPosition)).toBe(true); expect(camera.quaternion.equals(cameraRotation)).toBe(true);
      expect(camera.projectionMatrix).toEqual(projection);
      hero.disposeVisual(); enemy.disposeVisual();
    });

    it.each(['starter', 'advanced'] as const)('fits all six %s ordinary-boss anticipation and release poses', mode => {
      const hero = createCoverHeroSprite({ loadTexture: () => undefined });
      for (let chapter = 1; chapter <= 6; chapter++) {
        const enemy = createMissionEnemy(chapter, mode, false, { loadTexture: () => undefined });
        const fit = fitBattleActors({ width, height, viewport, questionBottom: height * .36, answersTop: height * .78, resolving: false },
          measureActorFraming(hero, view()), measureActorFraming(enemy, view()));
        const camera = view(fit.viewWidth, fit.viewHeight, fit.lookY, fit.elevation);
        if (viewport === 'dedicated' && width / height < 1.2) {
          hero.root.scale.setScalar(fit.scale); hero.root.position.set(fit.heroX, 0, 0);
          enemy.root.scale.setScalar(fit.scale); enemy.root.position.set(fit.enemyX, 0, 0);
          hero.updateVisual({ camera, pose: 'idle', reducedMotion: true });
          enemy.updateVisual?.({ camera, reducedMotion: true });
          const waitingHero = projectedBounds(hero, camera), waitingEnemy = projectedBounds(enemy, camera);
          expect((waitingEnemy.min.x - waitingHero.max.x) * width / 2).toBeGreaterThanOrEqual(8);
          expect((waitingHero.max.y - waitingHero.min.y) * height / 2).toBeGreaterThanOrEqual(width === 450 ? 160 : 110);
        }
        const parts: { object: THREE.Object3D; rotation: THREE.Euler }[] = [];
        enemy.root.traverse(object => {
          if (['book-spirit-paper-wing', 'paper-dragon-left-wing', 'paper-dragon-right-wing', 'lion-gear-crown'].includes(object.name)) {
            parts.push({ object, rotation: object.rotation.clone() });
          }
        });
        for (const time of [.2, .34, .42, .52, .64, .9, 1.2]) {
          const motion = enemyCastMotion(time), p = Math.max(0, Math.min(1, (time - .25) / .28)), cast = p * p * (3 - 2 * p);
          enemy.root.scale.setScalar(fit.scale);
          enemy.root.position.set(fit.enemyX + (.10 * motion.anticipation - .10 * motion.release) * fit.scale,
            -.06 * motion.anticipation * fit.scale, 0);
          enemy.root.rotation.set(0, -.15 - .14 * cast, 0);
          enemy.head.rotation.set(-.12 * motion.anticipation + .10 * motion.release, 0, 0);
          enemy.leftArm.rotation.set(0, 0, -.26 - 1.65 * cast); enemy.rightArm.rotation.set(0, 0, .26);
          for (const part of parts) {
            part.object.rotation.copy(part.rotation);
            if (part.object.name === 'lion-gear-crown') part.object.rotation.z += motion.anticipation * .22;
            else {
              const side = part.object.position.x < 0 ? -1 : 1;
              part.object.rotation.y += side * (.22 * motion.anticipation - .30 * motion.release);
              part.object.rotation.z += side * (.12 * motion.anticipation + .16 * motion.release);
            }
          }
          enemy.updateVisual?.({ camera, attackTime: time, success: false, reducedMotion: false });
          const bounds = projectedBounds(enemy, camera), label = `${mode}/${chapter}/${time}`;
          expect((bounds.min.x + 1) * width / 2, label).toBeGreaterThanOrEqual(width <= 600 ? 13 : 23);
          expect((bounds.max.x + 1) * width / 2, label).toBeLessThanOrEqual(width - (width <= 600 ? 13 : 23));
          expect((1 - bounds.max.y) * height / 2, label).toBeGreaterThanOrEqual(fit.top - 3);
          expect((1 - bounds.min.y) * height / 2, label).toBeLessThanOrEqual(fit.bottom + 12);
        }
        enemy.disposeVisual?.();
      }
      hero.disposeVisual();
    });

    it.each(cases)('keeps every $name pose within the actor slot and horizontal margins', ({ make }) => {
      const hero = createCoverHeroSprite({ loadTexture: () => undefined });
      const enemy = make();
      const measuringCamera = view();
      const fit = fitBattleActors({ width, height, viewport, questionBottom: height * .36, answersTop: height * .78, resolving: false },
        measureActorFraming(hero, measuringCamera), measureActorFraming(enemy, measuringCamera));
      const camera = view(fit.viewWidth, fit.viewHeight, fit.lookY, fit.elevation);
      if (viewport === 'dedicated' && width / height < 1.2) {
        hero.root.scale.setScalar(fit.scale); hero.root.position.set(fit.heroX, 0, 0);
        enemy.root.scale.setScalar(fit.scale); enemy.root.position.set(fit.enemyX, 0, 0);
        hero.updateVisual({ camera, pose: 'idle', reducedMotion: true });
        enemy.updateVisual?.({ camera, reducedMotion: true });
        const visibleHero = projectedBounds(hero, camera), visibleEnemy = projectedBounds(enemy, camera);
        expect((visibleEnemy.min.x - visibleHero.max.x) * width / 2).toBeGreaterThanOrEqual(8);
        expect((visibleHero.max.y - visibleHero.min.y) * height / 2).toBeGreaterThanOrEqual(width === 450 ? 160 : 110);
      }
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
