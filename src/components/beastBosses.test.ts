import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createPaperDragon, createGearKing } from './beastBosses';
import type { CoverGuardianRig } from './coverGuardian';

function dispose(rig: CoverGuardianRig) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  rig.root.traverse(object => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      for (const surface of Array.isArray(object.material) ? object.material : [object.material]) materials.add(surface);
    }
  });
  geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose());
}

describe('distinct living boss models', () => {
  it.each([
    { create: createPaperDragon, theme: 5, color: 0xe67970, name: '代寫紙龍', marks: ['paper-dragon-left-wing', 'paper-dragon-pencil-tail', 'paper-dragon-paper-horn'] },
    { create: createGearKing, theme: 6, color: 0x637dda, name: '全能齒輪王', marks: ['lion-fur-mane', 'lion-gear-crown', 'lion-royal-cape', 'lion-gear-medallion'] },
  ])('preserves $name identity and fits the existing arena', ({ create, theme, color, name, marks }) => {
    const rig = create(); rig.root.updateMatrixWorld(true);
    expect(rig.root.userData.characterName).toBe(name);
    expect(rig.root.userData.theme).toBe(theme);
    expect(rig.glow.color.getHex()).toBe(color);
    for (const mark of marks) expect(rig.root.getObjectByName(mark)).toBeDefined();
    expect(rig.root.getObjectByName('guardian-glass-visor')).toBeUndefined();
    const bounds = new THREE.Box3().setFromObject(rig.root);
    expect(bounds.min.y).toBeGreaterThanOrEqual(0);
    expect(bounds.max.y).toBeLessThanOrEqual(3.25);
    expect(bounds.max.x - bounds.min.x).toBeLessThanOrEqual(2.4);
    expect(rig.head.position.y).toBe(2.17);
    expect(rig.leftArm.position.y).toBe(1.65);
    const ray = new THREE.Raycaster();
    const eyeX = theme === 5 ? .215 : .20;
    for (const side of [-1, 1]) {
      ray.set(new THREE.Vector3(side * eyeX + .012, 2.17 + .085, 10), new THREE.Vector3(0, 0, -1));
      expect(ray.intersectObjects(rig.head.children, true)[0]?.object.name).toBe('beast-pupil');
    }
    dispose(rig);
  });

  it('uses actual noncoplanar paper folds instead of flat wing cards', () => {
    const rig = createPaperDragon();
    const fold = rig.root.getObjectByName('paper-wing-folds') as THREE.Mesh;
    const normal = fold.geometry.getAttribute('normal');
    const first = new THREE.Vector3().fromBufferAttribute(normal, 0);
    let spread = 0;
    for (let point = 3; point < normal.count; point += 3) spread = Math.max(spread,
      first.distanceTo(new THREE.Vector3().fromBufferAttribute(normal, point)));
    expect(spread).toBeGreaterThan(.15);
    expect((fold.material as THREE.MeshStandardMaterial).side).toBe(THREE.DoubleSide);
    dispose(rig);
  });

  it.each([createPaperDragon, createGearKing])('keeps the animated spell source attached to a real paw', create => {
    const rig = create(); const palm = rig.root.getObjectByName('beast-left-palm')!;
    const original = palm.localToWorld(new THREE.Vector3());
    let movement = 0;
    for (let step = 0; step <= 30; step++) {
      rig.leftArm.rotation.z = -.26 - 1.65 * step / 30;
      rig.rightArm.rotation.set(Math.sin(step) * .14, 0, .26 + .70 * step / 30);
      rig.head.rotation.z = Math.sin(step) * .08;
      rig.root.updateMatrixWorld(true);
      const paw = palm.getWorldPosition(new THREE.Vector3()), source = rig.tip.getWorldPosition(new THREE.Vector3());
      expect(source.distanceTo(paw)).toBeCloseTo(Math.hypot(.018, .20), 8);
      expect(Math.hypot(paw.x, paw.z)).toBeGreaterThan(.46 + .16);
      movement = Math.max(movement, paw.distanceTo(original));
    }
    expect(movement).toBeGreaterThan(.5);
    dispose(rig);
  });
});
