import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCoverHero } from './coverHero';
import { poseMage } from './magePose';

describe('cover mage geometry and battle articulation', () => {
  it('fits the existing full-body camera and has finite, bounded geometry', () => {
    const mage = createCoverHero(); mage.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(mage.root);
    expect(bounds.min.y).toBeGreaterThan(0);
    expect(bounds.min.y).toBeLessThan(.10);
    expect(bounds.max.y).toBeGreaterThan(3.55);
    expect(bounds.max.y).toBeLessThan(3.95);
    let vertices = 0;
    mage.root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.getAttribute('position'); vertices += positions.count;
      for (let index = 0; index < positions.count; index++) {
        expect(Number.isFinite(positions.getX(index))).toBe(true);
        expect(Number.isFinite(positions.getY(index))).toBe(true);
        expect(Number.isFinite(positions.getZ(index))).toBe(true);
      }
    });
    // The detailed native model stays small enough to share a scene with a guardian on mobile.
    expect(vertices).toBeLessThan(120_000);
  });

  it('builds a smoothly curved outward-facing hat and keeps the robe neckline narrow', () => {
    const mage = createCoverHero();
    const hat = mage.root.getObjectByName('cover-hero-soft-bent-hat') as THREE.Mesh;
    const positions = hat.geometry.getAttribute('position'), normals = hat.geometry.getAttribute('normal');
    const probe = 4 * 65;
    const radial = new THREE.Vector3(positions.getX(probe), 0, positions.getZ(probe)).normalize();
    const normal = new THREE.Vector3(normals.getX(probe), 0, normals.getZ(probe)).normalize();
    expect(normal.dot(radial)).toBeGreaterThan(.8);
    expect(hat.geometry.getAttribute('position').count).toBeGreaterThan(3000);
    const robe = mage.root.getObjectByName('cover-hero-open-robe') as THREE.Mesh;
    const robePositions = robe.geometry.getAttribute('position');
    let topRadius = 0, bottomRadius = 0;
    for (let index = 0; index < robePositions.count; index++) {
      const radius = Math.hypot(robePositions.getX(index), robePositions.getZ(index));
      if (robePositions.getY(index) > 1.73) topRadius = Math.max(topRadius, radius);
      if (robePositions.getY(index) < .66) bottomRadius = Math.max(bottomRadius, radius);
    }
    expect(topRadius).toBeLessThan(.28);
    expect(bottomRadius).toBeGreaterThan(.50);
  });

  it('keeps the shaft clear of the robe throughout greetings, casts, and defensive movements', () => {
    const mage = createCoverHero();
    for (let step = 0; step <= 24; step++) {
      const value = step / 24;
      for (const pose of [{ greeting: value, sway: Math.sin(step) }, { cast: value, windup: 1 },
        { windup: value }, { defense: value }]) {
        poseMage(mage, pose); mage.root.updateMatrixWorld(true);
        for (const side of ['left', 'right']) {
          const palm = mage.root.getObjectByName(`mage-${side}-hand`)!;
          const center = palm.getWorldPosition(new THREE.Vector3());
          expect(Math.hypot(center.x, center.z), JSON.stringify(pose)).toBeGreaterThan(.605);
          expect(center.z).toBeGreaterThan(.16);
        }
        for (let probe = 0; probe <= 30; probe++) {
          const position = mage.staff.localToWorld(new THREE.Vector3(0, -.30 + probe / 30 * 1.30, 0));
          if (position.y >= .65 && position.y <= 1.75) {
            expect(Math.hypot(position.x, position.z), JSON.stringify(pose)).toBeGreaterThan(.557);
          }
        }
      }
    }
  });

  it('keeps the grip attached to the palm and restores the original spell origin after movement', () => {
    const mage = createCoverHero(); mage.root.updateMatrixWorld(true);
    const restingTip = mage.tip.getWorldPosition(new THREE.Vector3());
    for (let step = 0; step <= 20; step++) {
      poseMage(mage, { cast: step / 20, windup: 1 }); mage.root.updateMatrixWorld(true);
      const palm = mage.staff.parent!.getWorldPosition(new THREE.Vector3());
      const grip = mage.staff.getWorldPosition(new THREE.Vector3());
      const crystal = mage.tip.getWorldPosition(new THREE.Vector3());
      expect(grip.distanceTo(palm)).toBeCloseTo(.065, 8);
      expect(crystal.x).toBeGreaterThan(grip.x + .30);
      expect(crystal.y).toBeGreaterThan(grip.y + .50);
    }
    poseMage(mage); mage.root.updateMatrixWorld(true);
    expect(mage.tip.getWorldPosition(new THREE.Vector3()).distanceTo(restingTip)).toBeLessThan(1e-8);
  });
});
