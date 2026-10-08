import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createThemedSpellEffects, NORMAL_CAST_SECONDS, SPELL_IMPACT_SECONDS, ULTIMATE_CAST_SECONDS,
  enemySpellNames, normalSpellNames, ultimateSpellNames, type SpellFrame } from './themedSpellEffects';
import { getUltimateSpell } from '../content/ultimateSpells';

const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 5, 15); camera.lookAt(0, 1.8, 0);
const frame = (changes: Partial<SpellFrame> = {}): SpellFrame => ({ time: .7, success: true, ultimate: false, blocked: false,
  start: new THREE.Vector3(-2.3, 2.3, .5), target: new THREE.Vector3(2.8, 1.49, .5),
  hero: new THREE.Vector3(-2.8, 0, 0), enemy: new THREE.Vector3(2.8, 0, 0), scale: 1, reducedMotion: false, camera, ...changes });
const nodes = (object: THREE.Object3D) => { const result: THREE.Object3D[] = []; object.traverse(node => result.push(node)); return result; };
const visibleMeshes = (object: THREE.Object3D) => nodes(object).filter(node => {
  if (!(node instanceof THREE.Mesh)) return false;
  let parent: THREE.Object3D | null = node;
  while (parent) { if (!parent.visible) return false; parent = parent.parent; }
  return true;
});

describe('themed spell performances', () => {
  it('selects the upgraded identity for advanced casts without changing normal attack timing', () => {
    for (let chapter = 1; chapter <= 6; chapter++) {
      const fx = createThemedSpellEffects(new THREE.Scene(), chapter, 'advanced');
      fx.update(frame({ ultimate: true, time: 1.2 }));
      expect(fx.root.userData.spell).toBe(getUltimateSpell(chapter, 'advanced')?.name);
      expect(fx.root.userData.spell).not.toBe(ultimateSpellNames[chapter - 1]);
      expect(fx.root.getObjectByName(`ultimate-${chapter}`)?.userData.tier).toBe('advanced');
      fx.update(frame()); expect(fx.root.userData.spell).toBe(normalSpellNames[chapter - 1]);
      fx.dispose();
    }
  });
  it('constructs six concrete hero silhouettes and six separately recognizable ultimate formations', () => {
    const normalShapes = ['padlock', 'tracking-arrow', 'classification-card', 'mirror-blade', 'flame-feather', 'growing-branch'];
    const ultimateShapes = ['guardian-castle', 'branching-lightning', 'leaf', 'false-mask', 'wisdom-phoenix', 'faceted-shield'];
    for (let chapter = 1; chapter <= 6; chapter++) {
      const scene = new THREE.Scene(), fx = createThemedSpellEffects(scene, chapter, 'starter');
      fx.update(frame());
      const normal = fx.root.getObjectByName(`normal-${chapter}`)!;
      const special = fx.root.getObjectByName(`ultimate-${chapter}`)!;
      expect(normal.getObjectByName(normalShapes[chapter - 1])).toBeDefined();
      expect(special.getObjectByName(ultimateShapes[chapter - 1])).toBeDefined();
      expect(fx.root.userData.spell).toBe(normalSpellNames[chapter - 1]);
      expect(visibleMeshes(fx.root).length).toBeGreaterThan(3);
      // A renamed copy of the same orb/beam is not a different spell.
      expect(nodes(normal).some(node => node instanceof THREE.Mesh && node.geometry.type === 'SphereGeometry')).toBe(false);
      fx.update(frame({ ultimate: true, time: 1.15 }));
      expect(fx.root.userData.spell).toBe(ultimateSpellNames[chapter - 1]);
      expect(special.visible).toBe(true); expect(normal.visible).toBe(false);
      expect(visibleMeshes(fx.root).length).toBeGreaterThan(10);
      fx.dispose();
    }
  });

  it('matches 12 counterattacks to the boss species instead of firing the hero projectile backward', () => {
    const silhouettes = {
      starter: ['chain-link', 'classification-card', 'classification-stamp', 'false-mask', 'paper-wing', 'gear-fragment'],
      advanced: ['spider-web', 'hourglass-sand', 'growing-branch', 'voice-note', 'ink-drop', 'cloud-fist'],
    } as const;
    const identities = new Set<string>();
    for (const mode of ['starter', 'advanced'] as const) for (let chapter = 1; chapter <= 6; chapter++) {
      const fx = createThemedSpellEffects(new THREE.Scene(), chapter, mode);
      fx.update(frame({ success: false }));
      const enemy = fx.root.getObjectByName(`enemy-${chapter}-${mode}`)!;
      expect(enemy.getObjectByName(silhouettes[mode][chapter - 1])).toBeDefined();
      expect(fx.root.userData.spell).toBe(enemySpellNames[mode][chapter - 1]); identities.add(fx.root.userData.spell);
      expect(fx.root.getObjectByName(`normal-${chapter}`)!.visible).toBe(false);
      expect(visibleMeshes(fx.root).length).toBeGreaterThan(0); fx.dispose();
    }
    expect(identities.size).toBe(12);
  });

  it('switches charge, flight and impact at contact, holds the ultimate after a normal cast finishes', () => {
    const fx = createThemedSpellEffects(new THREE.Scene(), 5, 'advanced');
    fx.update(frame({ time: .1 })); expect(fx.root.userData.phase).toBe('prepare');
    fx.update(frame({ time: .6 })); expect(fx.root.userData.phase).toBe('travel');
    fx.update(frame({ time: SPELL_IMPACT_SECONDS })); expect(fx.root.userData.phase).toBe('impact');
    fx.update(frame({ time: NORMAL_CAST_SECONDS })); expect(fx.root.visible).toBe(false);
    fx.update(frame({ time: 2.4, ultimate: true })); expect(fx.root.visible).toBe(true); expect(visibleMeshes(fx.root).length).toBeGreaterThan(10);
    fx.update(frame({ time: ULTIMATE_CAST_SECONDS, ultimate: true })); expect(fx.root.visible).toBe(false);
    fx.dispose();
  });

  it('keeps the distinct objects in reduced motion without additive full-screen flashes', () => {
    for (let chapter = 1; chapter <= 6; chapter++) {
      const fx = createThemedSpellEffects(new THREE.Scene(), chapter, 'advanced');
      fx.update(frame({ time: 1, reducedMotion: true }));
      expect(visibleMeshes(fx.root).length).toBeGreaterThan(0);
      for (const node of visibleMeshes(fx.root)) {
        const mesh = node as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        expect(materials.every(mat => mat.blending !== THREE.AdditiveBlending)).toBe(true);
      }
      fx.update(frame({ time: 1.4, reducedMotion: true, ultimate: true }));
      expect(visibleMeshes(fx.root).length).toBeGreaterThan(8); fx.dispose();
    }
  });

  it('intercepts a counterattack with a concrete shield only for a blocked hit', () => {
    const fx = createThemedSpellEffects(new THREE.Scene(), 1, 'advanced');
    fx.update(frame({ time: 1, success: false, blocked: true }));
    expect(fx.root.userData.kind).toBe('enemy'); expect(fx.root.userData.blocked).toBe(true);
    expect(fx.root.getObjectByName('blocked-defense')!.getObjectByName('faceted-shield')).toBeDefined();
    fx.update(frame({ time: 1, success: false, blocked: false })); expect(fx.root.getObjectByName('blocked-defense')!.visible).toBe(false);
    fx.update(frame({ time: 1, success: true, ultimate: true, blocked: true })); expect(fx.root.userData.blocked).toBe(false);
    fx.dispose();
  });

  it('scales all formations with the actors so a narrow screen keeps the effects inside the arena gap', () => {
    for (let chapter = 1; chapter <= 6; chapter++) {
      const fx = createThemedSpellEffects(new THREE.Scene(), chapter, 'advanced');
      const small = frame({ ultimate: true, time: 1.2, scale: .42, start: new THREE.Vector3(-1.2, 1.0, .5),
        target: new THREE.Vector3(1.2, .63, .5), hero: new THREE.Vector3(-1.2, 0, 0), enemy: new THREE.Vector3(1.2, 0, 0) });
      fx.update(small); fx.root.updateMatrixWorld(true);
      for (const object of visibleMeshes(fx.root)) {
        const bounds = new THREE.Box3().setFromObject(object);
        expect(bounds.max.x).toBeLessThan(2.10); expect(bounds.min.x).toBeGreaterThan(-2.10);
        expect(bounds.max.y).toBeLessThan(1.7); expect(bounds.min.y).toBeGreaterThan(-.6);
      }
      fx.dispose();
    }
  });

  it('clears a replay and disposes every owned geometry/material exactly once, with no retained scene children', () => {
    const scene = new THREE.Scene(), fx = createThemedSpellEffects(scene, 6, 'advanced');
    const geometrySpies = new Map<THREE.BufferGeometry, ReturnType<typeof vi.spyOn>>();
    const materialSpies = new Map<THREE.Material, ReturnType<typeof vi.spyOn>>();
    for (const node of nodes(fx.root)) if (node instanceof THREE.Mesh) {
      if (!geometrySpies.has(node.geometry)) geometrySpies.set(node.geometry, vi.spyOn(node.geometry, 'dispose'));
      for (const mat of Array.isArray(node.material) ? node.material : [node.material]) if (!materialSpies.has(mat)) materialSpies.set(mat, vi.spyOn(mat, 'dispose'));
    }
    fx.update(frame()); fx.clear(); expect(fx.root.visible).toBe(false);
    fx.update(frame({ ultimate: true, time: 1.1 })); expect(fx.root.visible).toBe(true);
    fx.dispose(); fx.dispose(); fx.update(frame());
    expect(fx.root.userData.disposed).toBe(true); expect(scene.children).toHaveLength(0);
    for (const spy of [...geometrySpies.values(), ...materialSpies.values()]) expect(spy).toHaveBeenCalledTimes(1);
  });
});
