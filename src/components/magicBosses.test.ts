import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBookSpirit, createMagicChest, createMaskPhantom } from './magicBosses';

const characters = [
  { create: createMagicChest, theme: 1, identity: 'magic-chest', color: 0xf6a642, eyeY: .018, eyeX: .235, smileY: -.201 },
  { create: createBookSpirit, theme: 2, identity: 'book-spirit', color: 0x36b8c5, eyeY: -.01, eyeX: .235, smileY: -.302 },
  { create: createMaskPhantom, theme: 4, identity: 'mask-phantom', color: 0x9c70d8, eyeY: .07, eyeX: .20, smileY: -.335 },
] as const;

describe('distinct native magic bosses', () => {
  it('keeps unique non-mechanical silhouettes inside the existing camera bounds', () => {
    for (const character of characters) {
      const rig = character.create(); rig.root.updateMatrixWorld(true);
      expect(rig.root.name).toBe('original-theme-guardian-' + character.theme);
      expect(rig.root.userData.character).toBe(character.identity);
      expect(rig.glow).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(rig.glow.color.getHex()).toBe(character.color);
      expect(rig.head.position.y).toBe(2.17);
      expect(rig.leftArm.position.y).toBe(1.65);
      expect(rig.rightArm.position.y).toBe(1.65);
      expect(rig.root.getObjectByName('guardian-metal-head')).toBeUndefined();
      const bounds = new THREE.Box3().setFromObject(rig.root);
      expect(bounds.min.y).toBeGreaterThanOrEqual(0);
      expect(bounds.max.y).toBeLessThanOrEqual(3.25);
      expect(bounds.max.x - bounds.min.x).toBeLessThanOrEqual(2.4);
      let vertices = 0;
      rig.root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const positions = object.geometry.getAttribute('position'); vertices += positions.count;
        for (let i = 0; i < positions.count; i++) {
          expect(Number.isFinite(positions.getX(i)) && Number.isFinite(positions.getY(i)) && Number.isFinite(positions.getZ(i))).toBe(true);
        }
      });
      expect(vertices).toBeLessThan(95_000);
    }
    expect(createMagicChest().root.getObjectByName('magic-chest-vaulted-lid')).toBeDefined();
    expect(createBookSpirit().root.getObjectByName('book-spirit-thick-page-block')).toBeDefined();
    expect(createBookSpirit().root.getObjectByName('book-spirit-paper-wing')).toBeDefined();
    expect(createMaskPhantom().root.getObjectByName('mask-phantom-theater-mask')).toBeDefined();
    expect(createMaskPhantom().root.getObjectByName('mask-phantom-floating-cloak')).toBeDefined();
  });

  it('exposes both expressive eyes and the smile to the actual front-view raycaster', () => {
    const ray = new THREE.Raycaster();
    for (const character of characters) {
      const rig = character.create(); rig.root.updateMatrixWorld(true);
      for (const side of [-1, 1]) {
        ray.set(new THREE.Vector3(side * character.eyeX + .006, 2.17 + character.eyeY, 10), new THREE.Vector3(0, 0, -1));
        const first = ray.intersectObject(rig.root, true)[0]?.object;
        expect(first?.name, character.identity).toMatch(/^magic-boss-eye-/);
      }
      ray.set(new THREE.Vector3(0, 2.17 + character.smileY, 10), new THREE.Vector3(0, 0, -1));
      expect(ray.intersectObject(rig.root, true)[0]?.object.name, character.identity).toBe('magic-boss-friendly-smile');
    }
  });

  it('moves the spell source with the real left hand and keeps palms outside the bodies', () => {
    for (const character of characters) {
      const rig = character.create();
      const hand = rig.root.getObjectByName('guardian-left-hand')!;
      expect(rig.tip.parent).toBe(hand);
      for (let i = 0; i <= 30; i++) {
        const amount = i / 30;
        rig.leftArm.rotation.z = -.26 - 1.65 * amount;
        rig.rightArm.rotation.set(Math.sin(i) * .14, 0, .26 + .55 * amount);
        rig.root.updateMatrixWorld(true);
        const palm = hand.getWorldPosition(new THREE.Vector3());
        const source = rig.tip.getWorldPosition(new THREE.Vector3());
        expect(source.distanceTo(palm)).toBeCloseTo(Math.hypot(.018, .145), 8);
        for (const side of ['left', 'right']) {
          const center = rig.root.getObjectByName('guardian-' + side + '-hand')!.getWorldPosition(new THREE.Vector3());
          const bodyHalfWidth = character.theme === 4 ? .49 : character.theme === 1 ? .61 : .67;
          expect(Math.abs(center.x), character.identity).toBeGreaterThan(bodyHalfWidth + .09);
          expect(center.z, character.identity).toBeGreaterThan(.28);
        }
      }
    }
  });
});
