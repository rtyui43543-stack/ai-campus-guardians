import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fitNineHeadStoryCamera } from './finalBossFraming';
import { createFinalBossSprite, getFinalBossArt } from './finalBossSprite';
import { createCoverHeroSprite } from './coverHeroSprite';

describe.each([3, 16 / 9, 1.5, .65])('nine-head story camera at aspect %s', aspect => {
  it('keeps every head, the full dragon and the cover hero in all shots and during pans', () => {
    const viewHeight = 6, viewWidth = viewHeight * aspect;
    const heroX = -Math.min(3.35, viewWidth * .235), enemyX = -heroX;
    const hero = createCoverHeroSprite({ loadTexture: () => undefined });
    const boss = createFinalBossSprite('advanced', { loadTexture: () => undefined });
    const art = getFinalBossArt('advanced');
    if (!('headCenters' in art)) throw new Error('Nine-head landmarks missing.');
    const frame = art.frames.idle, units = 3.7 / (frame.foot[1] - frame.topY);
    const camera = new THREE.OrthographicCamera(-viewWidth / 2, viewWidth / 2, 3, -3, .1, 60);
    hero.root.position.x = heroX; boss.root.position.x = enemyX;
    for (const x of [0, heroX, enemyX]) for (const zoom of [1, 1.3, 1.6]) {
      const shot = fitNineHeadStoryCamera(viewWidth, viewHeight, { x, y: x === heroX ? 2.05 : 1.55, zoom },
        { heroX, enemyX, enemyLeft: boss.root.userData.outerLeftExtent, enemyRight: boss.root.userData.outerRightExtent }, 3.8);
      camera.zoom = shot.zoom; camera.position.set(shot.x, shot.y + 3.8, 15);
      camera.lookAt(shot.x, shot.y, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      hero.updateVisual({ camera, reducedMotion: true }); boss.updateVisual({ camera, reducedMotion: true });
      for (const actor of [hero, boss]) {
        const plane = actor.root.getObjectByName('cover-identity-hero-atlas') as THREE.Mesh;
        const positions = plane.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
          const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(plane.matrixWorld).project(camera);
          expect(Math.abs(point.x)).toBeLessThan(.96); expect(Math.abs(point.y)).toBeLessThan(.96);
        }
      }
      const visual = boss.root.getObjectByName('cover-identity-hero')!;
      for (const [x, y] of art.headCenters) {
        const face = new THREE.Vector3((x - frame.foot[0]) * units, (frame.foot[1] - y) * units + .02, 0)
          .applyMatrix4(visual.matrixWorld).project(camera);
        expect(Math.abs(face.x)).toBeLessThan(.9); expect(Math.abs(face.y)).toBeLessThan(.9);
      }
    }
    hero.disposeVisual(); boss.disposeVisual();
  });
});
