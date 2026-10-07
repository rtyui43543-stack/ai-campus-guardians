import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHero } from './arena3d';
import { poseMage } from './magePose';

describe('mage hand and staff clearance', () => {
  it('keeps both palms outside the robe throughout greetings, casts, and defense', () => {
    const mage = createHero();
    for (let step = 0; step <= 30; step++) {
      const progress = step / 30;
      for (const pose of [
        { greeting: progress, sway: Math.sin(step) },
        { cast: progress, windup: 1 },
        { cast: 0, windup: progress },
        { defense: progress },
      ]) {
        poseMage(mage, pose);
        mage.root.updateMatrixWorld(true);
        for (const side of ['left', 'right']) {
          const hand = mage.root.getObjectByName(`mage-${side}-hand`)!;
          const center = hand.getWorldPosition(new THREE.Vector3());
          // The robe's widest radius is .51; palms have a .145 radius.
          // At hand height the flared section is narrower than .46.
          expect(Math.hypot(center.x, center.z), JSON.stringify(pose)).toBeGreaterThan(.46 + .145);
          expect(center.z).toBeGreaterThan(.16);
          expect(side === 'left' ? center.x < -.47 : center.x > .47).toBe(true);
        }
        // Sample the actual shortened shaft, including its tail. No part may
        // pass through the .51-wide robe while it is at torso height.
        for (let probe = 0; probe <= 20; probe++) {
          const point = mage.staff.localToWorld(new THREE.Vector3(0, -.30 + 1.30 * probe / 20, 0));
          if (point.y >= .65 && point.y <= 1.75) {
            expect(Math.hypot(point.x, point.z), JSON.stringify(pose)).toBeGreaterThan(.51 + .053);
          }
        }
      }
    }
  });

  it('keeps the shaft in the hand and aims the gem outward as the elbow bends', () => {
    const mage = createHero();
    for (let step = 0; step <= 20; step++) {
      poseMage(mage, { cast: step / 20, windup: 1 });
      mage.root.updateMatrixWorld(true);
      const palm = mage.staff.parent!.getWorldPosition(new THREE.Vector3());
      const grip = mage.staff.getWorldPosition(new THREE.Vector3());
      const gem = mage.tip.getWorldPosition(new THREE.Vector3());
      expect(grip.distanceTo(palm)).toBeCloseTo(.065, 8);
      expect(gem.x).toBeGreaterThan(grip.x + .30);
      expect(gem.y).toBeGreaterThan(grip.y + .50);
    }
  });

  it('restores the same resting grip after a greeting or spell', () => {
    const mage = createHero();
    mage.root.updateMatrixWorld(true);
    const resting = mage.tip.getWorldPosition(new THREE.Vector3());
    poseMage(mage, { greeting: 1, cast: 1, defense: 1 });
    poseMage(mage);
    mage.root.updateMatrixWorld(true);
    expect(mage.tip.getWorldPosition(new THREE.Vector3()).distanceTo(resting)).toBeLessThan(1e-8);
  });
});
