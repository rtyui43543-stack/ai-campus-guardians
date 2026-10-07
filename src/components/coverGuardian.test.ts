import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCoverGuardian } from './coverGuardian';

function dispose(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
  });
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
}

describe('rounded cover guardian compatibility', () => {
  it('preserves all six identities and fits the original grounded animation rig', () => {
    const colors = [0xf6a642, 0x36b8c5, 0x6d91e5, 0x9c70d8, 0xe67970, 0x637dda];
    const marks = ['guardian-magnifier', 'guardian-library-cap', 'guardian-sorting-lights',
      'guardian-mask', 'guardian-book', 'guardian-triple-antenna'];
    for (let theme = 1; theme <= 6; theme++) {
      const guardian = createCoverGuardian(theme);
      expect(guardian.glow).toBeInstanceOf(THREE.MeshPhysicalMaterial);
      expect(guardian.glow.color.getHex()).toBe(colors[theme - 1]);
      expect(guardian.head.position.y).toBe(2.17);
      expect(guardian.leftArm.position.y).toBe(1.65);
      expect(guardian.rightArm.position.y).toBe(1.65);
      expect(guardian.root.getObjectByName(marks[theme - 1])).toBeDefined();
      const head = guardian.root.getObjectByName('guardian-metal-head') as THREE.Mesh<THREE.SphereGeometry>;
      expect(head.geometry).toBeInstanceOf(THREE.SphereGeometry);
      guardian.root.updateMatrixWorld(true);
      // The actual face mesh must stay outside the ellipsoid even in the centre,
      // where a sparsely bent outline would otherwise intersect the round head.
      const visor = guardian.root.getObjectByName('guardian-glass-visor') as THREE.Mesh;
      const position = visor.geometry.getAttribute('position');
      const radius = head.geometry.parameters.radius;
      for (let point = 0; point < position.count / 2; point++) {
        const local = head.worldToLocal(visor.localToWorld(new THREE.Vector3().fromBufferAttribute(position, point)));
        expect(local.length()).toBeGreaterThan(radius);
      }
      // Visibility is checked against the real meshes rather than only z values.
      const ray = new THREE.Raycaster();
      for (const x of [-.235, .235]) {
        ray.set(new THREE.Vector3(x, 2.17 + .065, 10), new THREE.Vector3(0, 0, -1));
        expect(ray.intersectObjects(guardian.head.children, true)[0]?.object.name).toBe('guardian-warm-eye');
      }
      ray.set(new THREE.Vector3(0, 2.17 - .25, 10), new THREE.Vector3(0, 0, -1));
      expect(ray.intersectObjects(guardian.head.children, true)[0]?.object.name).toBe('guardian-friendly-smile');
      const bounds = new THREE.Box3().setFromObject(guardian.root);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-.001);
      expect(bounds.max.y).toBeLessThan(3.25);
      let triangles = 0;
      guardian.root.traverse(object => {
        if (object instanceof THREE.Mesh) triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
      });
      expect(triangles).toBeLessThan(110_000);
      dispose(guardian.root);
    }
  });

  it('keeps the glove and spell source attached and clear of the torso through the legacy arm animation', () => {
    const guardian = createCoverGuardian(1);
    const palm = guardian.root.getObjectByName('guardian-left-hand')!;
    for (let step = 0; step <= 30; step++) {
      const amount = step / 30;
      guardian.leftArm.rotation.set(0, 0, -.26 - 1.65 * amount);
      guardian.rightArm.rotation.set(Math.sin(step) * .14, 0, .26 + .70 * amount);
      guardian.root.updateMatrixWorld(true);
      for (const side of ['left', 'right']) {
        const center = guardian.root.getObjectByName(`guardian-${side}-hand`)!.getWorldPosition(new THREE.Vector3());
        expect(Math.hypot(center.x, center.z)).toBeGreaterThan(.52 + .16);
      }
      const grip = palm.getWorldPosition(new THREE.Vector3());
      const source = guardian.tip.getWorldPosition(new THREE.Vector3());
      expect(source.distanceTo(grip)).toBeCloseTo(Math.hypot(.018, .145), 8);
    }
    expect(guardian.root.getObjectByName('guardian-friendly-smile')).toBeDefined();
    const fingers: THREE.Object3D[] = [];
    guardian.root.traverse(object => { if (object.name === 'guardian-finger') fingers.push(object); });
    expect(fingers).toHaveLength(8);
    dispose(guardian.root);
  });
});
