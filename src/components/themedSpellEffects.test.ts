import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createThemedSpellEffects, NORMAL_CAST_SECONDS, SPELL_IMPACT_SECONDS, ULTIMATE_CAST_SECONDS,
  enemySpellNames, heroSpellElements, normalSpellNames, ultimateSpellNames, type SpellFrame } from './themedSpellEffects';
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
  it('gives final bosses their own projectiles and expands the consecutive-error ultimate', () => {
    for (const mode of ['starter', 'advanced'] as const) {
      const fx = createThemedSpellEffects(new THREE.Scene(), 5, mode, true);
      fx.update(frame({ time: .7, success: false }));
      const projectile = fx.root.getObjectByName('final-boss-projectile')!;
      expect(projectile).toBeDefined(); expect(projectile.visible).toBe(true);
      const basicSize = projectile.scale.x;
      expect(projectile.getObjectByName(mode === 'starter' ? 'open-learning-book' : 'spectral-dragon-charge')).toBeDefined();
      fx.update(frame({ time: .7, success: false, enemyCritical: true }));
      expect(projectile.scale.x).toBeGreaterThan(basicSize * 1.5);
      expect(fx.root.userData.kind).toBe('enemy-ultimate');
      expect(fx.root.userData.spell).toContain('追擊必殺');
      fx.update(frame({ time: 1.1, success: false, enemyCritical: true }));
      expect(fx.root.getObjectByName('final-boss-critical-bolt-0')!.visible).toBe(true);
      expect(fx.root.getObjectByName('final-boss-impact-wave')!.visible).toBe(true);
      fx.dispose();
    }
  });
  it('lands a mirrored attack beside the learner while showing mirror fragments, rather than a false hit', () => {
    const fx = createThemedSpellEffects(new THREE.Scene(), 6, 'advanced', true);
    const target = frame().target.clone();
    fx.update(frame({ time: 1, success: false, missed: true }));
    const impact = fx.root.getObjectByName('final-boss-impact-wave')!;
    expect(impact.position.x).toBeLessThan(target.x);
    expect(impact.position.y).toBeLessThan(target.y);
    expect(fx.root.getObjectByName('mirror-dodge')!.visible).toBe(true);
    expect(fx.root.userData.missed).toBe(true);
    fx.update(frame({ time: 1, success: false, missed: false }));
    expect(impact.position.x).toBe(target.x);
    expect(fx.root.getObjectByName('mirror-dodge')!.visible).toBe(false);
    fx.dispose();
  });
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
    const normalShapes = ['guardian-castle', 'thunder-book-page', 'leaf-puzzle-piece', 'mirror-blade', 'flame-feather', 'frost-crystal-spear'];
    const ultimateShapes = ['guardian-castle', 'branching-lightning', 'leaf', 'false-mask', 'wisdom-phoenix', 'ice-crystal-shard'];
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

  it('keeps every ordinary spell in the same element family as its starter and upgraded ultimate', () => {
    for (const mode of ['starter', 'advanced'] as const) for (let chapter = 1; chapter <= 6; chapter++) {
      const fx = createThemedSpellEffects(new THREE.Scene(), chapter, mode);
      fx.update(frame());
      expect(fx.root.userData.element).toBe(heroSpellElements[chapter - 1]);
      fx.update(frame({ ultimate: true, time: 1.15 }));
      expect(fx.root.userData.element).toBe(heroSpellElements[chapter - 1]);
      fx.dispose();
    }
  });

  it('throws only warm flame feathers in the fire chapter and erupts into flames at the enemy on contact', () => {
    for (const mode of ['starter', 'advanced'] as const) {
      const fx = createThemedSpellEffects(new THREE.Scene(), 5, mode);
      const normal = fx.root.getObjectByName('normal-5')!;
      expect(normal.getObjectByName('open-learning-book')).toBeUndefined();
      expect(normal.getObjectByName('flaming-feather-projectile')).toBeDefined();
      expect(normal.getObjectByName('flame-tongue')).toBeDefined();
      fx.update(frame({ time: .6 }));
      expect(normal.getObjectByName('normal-impact')!.visible).toBe(false);
      for (const node of visibleMeshes(normal)) {
        const value = (node as THREE.Mesh).material as THREE.MeshStandardMaterial;
        const hue = value.color.getHSL({ h: 0, s: 0, l: 0 });
        expect(hue.h).toBeGreaterThanOrEqual(0);
        expect(hue.h).toBeLessThan(.17);
      }
      fx.update(frame({ time: SPELL_IMPACT_SECONDS }));
      const impact = normal.getObjectByName('normal-impact')!;
      expect(impact.visible).toBe(true);
      expect(impact.getObjectByName('fire-feather-impact')).toBeDefined();
      expect(impact.position.x).toBe(frame().target.x);
      expect(impact.position.y).toBe(frame().target.y);
      fx.update(frame({ time: 1.3 }));
      expect(normal.getObjectByName('flaming-feather-projectile')!.visible).toBe(false);
      expect(visibleMeshes(impact).length).toBeGreaterThan(10);
      fx.dispose();
    }
  });

  it('keeps advanced fire particles on contact without duplicating the cinematic phoenix with a low-detail creature', () => {
    const fx = createThemedSpellEffects(new THREE.Scene(), 5, 'advanced');
    const special = fx.root.getObjectByName('ultimate-5')!;
    expect(special.getObjectByName('open-learning-book')).toBeUndefined();
    const bird = special.getObjectByName('ultimate-strike')!;
    const fire = special.getObjectByName('phoenix-fire-impact')!;
    expect(special.getObjectByName('wisdom-phoenix')).toBeUndefined();
    fx.update(frame({ ultimate: true, time: .6 }));
    expect(bird.visible).toBe(false); expect(fire.visible).toBe(false);
    fx.update(frame({ ultimate: true, time: SPELL_IMPACT_SECONDS }));
    expect(fire.visible).toBe(true);
    expect(fire.position.x).toBe(frame().target.x);
    fx.update(frame({ ultimate: true, time: 1.1 }));
    expect(bird.visible).toBe(false); expect(fire.visible).toBe(true);
    expect(visibleMeshes(fire).length).toBeGreaterThan(10);
    fx.dispose();
  });

  it('keeps starter ice spears and advanced contact frost without duplicating the high-detail cinematic ice dragon', () => {
    for (const mode of ['starter', 'advanced'] as const) {
      const fx = createThemedSpellEffects(new THREE.Scene(), 6, mode);
      const normal = fx.root.getObjectByName('normal-6')!, special = fx.root.getObjectByName('ultimate-6')!;
      for (const variant of [normal, special]) {
        expect(variant.getObjectByName('leaf')).toBeUndefined();
        expect(variant.getObjectByName('growing-branch')).toBeUndefined();
        expect(variant.getObjectByName('faceted-shield')).toBeUndefined();
      }
      fx.update(frame({ time: .7 }));
      expect(fx.root.userData.element).toBe('ice');
      expect(normal.getObjectByName('frost-crystal-spear')).toBeDefined();
      for (const node of visibleMeshes(normal)) {
        const value = (node as THREE.Mesh).material as THREE.MeshStandardMaterial;
        const hue = value.color.getHSL({ h: 0, s: 0, l: 0 });
        expect(hue.h).toBeGreaterThan(.45); expect(hue.h).toBeLessThan(.65);
      }
      fx.update(frame({ ultimate: true, time: .7 }));
      expect(special.getObjectByName('frost-ice-dragon')).toBeUndefined();
      if (mode === 'advanced') {
        expect(special.getObjectByName('ultimate-strike')!.visible).toBe(false);
        expect(special.getObjectByName('ice-dragon-head')).toBeUndefined();
      } else expect(special.getObjectByName('frost-crystal-spear')).toBeDefined();
      fx.update(frame({ ultimate: true, time: SPELL_IMPACT_SECONDS }));
      const impact = special.getObjectByName('frost-shatter-impact')!;
      expect(impact.visible).toBe(true);
      expect(impact.position.x).toBe(frame().target.x);
      expect(impact.getObjectByName('frost-mist')).toBeDefined();
      fx.update(frame({ ultimate: true, time: 1.2 }));
      expect(special.getObjectByName('ultimate-strike')!.visible).toBe(false);
      expect(visibleMeshes(impact).length).toBeGreaterThan(20);
      fx.dispose();
    }
  });

  it('makes the starter ice ultimate visibly larger than ordinary spears and expands a frost wave only on contact', () => {
    const fx = createThemedSpellEffects(new THREE.Scene(), 6, 'starter');
    fx.update(frame({ time: .7 })); fx.root.updateMatrixWorld(true);
    const ordinary = fx.root.getObjectByName('normal-6')!.getObjectByName('frost-crystal-spear')!;
    const ordinaryWidth = new THREE.Box3().setFromObject(ordinary).getSize(new THREE.Vector3()).x;
    const special = fx.root.getObjectByName('ultimate-6')!;
    fx.update(frame({ ultimate: true, time: .1 }));
    expect(special.getObjectByName('ultimate-formation')!.visible).toBe(true);
    expect(special.getObjectByName('frost-crystal-summoning-array')).toBeDefined();
    expect(special.getObjectByName('ultimate-strike')!.visible).toBe(false);
    fx.update(frame({ ultimate: true, time: .7 })); fx.root.updateMatrixWorld(true);
    const lance = special.getObjectByName('colossal-frost-lance')!;
    expect(lance).toBeDefined();
    const ultimateWidth = new THREE.Box3().setFromObject(lance).getSize(new THREE.Vector3()).x;
    expect(ultimateWidth).toBeGreaterThan(ordinaryWidth * 3);
    const wave = special.getObjectByName('colossal-lance-frost-wave')!;
    expect(wave.visible).toBe(false);
    fx.update(frame({ ultimate: true, time: SPELL_IMPACT_SECONDS }));
    expect(wave.visible).toBe(true);
    const contactScale = wave.scale.x;
    fx.update(frame({ ultimate: true, time: 1.6 }));
    expect(wave.scale.x).toBeGreaterThan(contactScale * 1.8);
    expect(special.getObjectByName('ultimate-strike')!.visible).toBe(false);
    expect(visibleMeshes(special.getObjectByName('frost-shatter-impact')!).length).toBeGreaterThan(50);
    fx.dispose();
  });

  it('establishes the castle shield before launching a crest, then seals the enemy at contact in both tiers', () => {
    for (const mode of ['starter', 'advanced'] as const) {
      const fx = createThemedSpellEffects(new THREE.Scene(), 1, mode);
      const special = fx.root.getObjectByName('ultimate-1')!;
      const fortress = special.getObjectByName('ultimate-formation')!;
      const projectile = special.getObjectByName('ultimate-strike')!;
      const impact = special.getObjectByName('castle-seal-impact')!;
      const wave = special.getObjectByName('castle-seal-shockwave')!;
      expect(special.userData.sequence).toBe('castle-shield-emblem-flight-seal-impact');
      fx.update(frame({ ultimate: true, time: .15 }));
      expect(fortress.visible).toBe(true); expect(projectile.visible).toBe(false);
      expect(impact.visible).toBe(false); expect(wave.visible).toBe(false);
      expect(fortress.getObjectByName('summoned-castle-shield')).toBeDefined();
      fx.update(frame({ ultimate: true, time: .6 }));
      expect(projectile.visible).toBe(true);
      expect(projectile.getObjectByName('castle-emblem-projectile')).toBeDefined();
      expect(projectile.position.x).toBeGreaterThan(frame().start.x);
      expect(projectile.position.x).toBeLessThan(frame().target.x);
      expect(impact.visible).toBe(false);
      fx.update(frame({ ultimate: true, time: SPELL_IMPACT_SECONDS }));
      expect(impact.visible).toBe(true); expect(wave.visible).toBe(true);
      expect(projectile.position.x).toBe(frame().target.x);
      expect(impact.position.x).toBe(frame().target.x);
      const contactScale = wave.scale.x;
      fx.update(frame({ ultimate: true, time: 1.6 }));
      expect(projectile.visible).toBe(false); expect(fortress.visible).toBe(true);
      expect(wave.scale.x).toBeGreaterThan(contactScale * 1.8);
      expect(visibleMeshes(impact).length).toBeGreaterThan(30);
      fx.dispose();
    }
  });

  it('gives starter thunder, mirror and phoenix a giant travelling object followed by a separate fragment impact', () => {
    const cases = [
      { chapter: 2, normal: 'thunder-book-page', formation: 'thunder-index-summoning-array',
        projectile: 'colossal-thunder-index', impact: 'thunder-index-impact', wave: 'thunder-index-page-wave' },
      { chapter: 4, normal: 'mirror-blade', formation: 'mirror-summoning-array',
        projectile: 'colossal-mirror-cleaver', impact: 'mirror-mask-shatter-impact', wave: 'mirror-cleaver-ripple' },
      { chapter: 5, normal: 'flaming-feather-projectile', formation: 'phoenix-summoning-array',
        projectile: 'wisdom-phoenix', impact: 'phoenix-fire-impact', wave: 'phoenix-fire-shockwave' },
    ];
    for (const example of cases) {
      const fx = createThemedSpellEffects(new THREE.Scene(), example.chapter, 'starter');
      const special = fx.root.getObjectByName(`ultimate-${example.chapter}`)!;
      fx.update(frame({ time: .7 })); fx.root.updateMatrixWorld(true);
      const ordinary = fx.root.getObjectByName(`normal-${example.chapter}`)!.getObjectByName(example.normal)!;
      const ordinarySize = new THREE.Box3().setFromObject(ordinary).getSize(new THREE.Vector3());
      const ordinarySpan = Math.max(ordinarySize.x, ordinarySize.y);
      fx.update(frame({ ultimate: true, time: .1 }));
      expect(special.getObjectByName('ultimate-formation')!.visible).toBe(true);
      expect(special.getObjectByName(example.formation)).toBeDefined();
      expect(special.getObjectByName('ultimate-strike')!.visible).toBe(false);
      const impact = special.getObjectByName(example.impact)!;
      const wave = special.getObjectByName(example.wave)!;
      expect(impact.visible).toBe(false); expect(wave.visible).toBe(false);
      fx.update(frame({ ultimate: true, time: .7 })); fx.root.updateMatrixWorld(true);
      const projectile = special.getObjectByName(example.projectile)!;
      expect(projectile).toBeDefined(); expect(special.getObjectByName('ultimate-strike')!.visible).toBe(true);
      const projectileSize = new THREE.Box3().setFromObject(projectile).getSize(new THREE.Vector3());
      expect(Math.max(projectileSize.x, projectileSize.y)).toBeGreaterThan(ordinarySpan * 2.8);
      expect(impact.visible).toBe(false);
      fx.update(frame({ ultimate: true, time: SPELL_IMPACT_SECONDS }));
      expect(impact.visible).toBe(true); expect(wave.visible).toBe(true);
      expect(impact.position.x).toBe(frame().target.x);
      expect(impact.position.y).toBe(frame().target.y);
      const contactScale = wave.scale.x;
      fx.update(frame({ ultimate: true, time: 1.7 }));
      expect(special.getObjectByName('ultimate-strike')!.visible).toBe(false);
      expect(wave.scale.x).toBeGreaterThan(contactScale * 1.8);
      expect(visibleMeshes(impact).length).toBeGreaterThan(50);
      fx.update(frame({ ultimate: true, time: 2.6 }));
      expect(impact.visible).toBe(true);
      fx.update(frame({ ultimate: true, time: ULTIMATE_CAST_SECONDS }));
      expect(fx.root.visible).toBe(false);
      fx.dispose();
    }
  });

  it('holds the new starter impacts still in reduced motion while retaining elemental silhouettes', () => {
    for (const chapter of [1, 2, 4, 5]) {
      const fx = createThemedSpellEffects(new THREE.Scene(), chapter, 'starter');
      fx.update(frame({ ultimate: true, time: 1.2, reducedMotion: true }));
      fx.root.updateMatrixWorld(true);
      const before = visibleMeshes(fx.root).map(mesh => mesh.matrixWorld.elements.slice());
      fx.update(frame({ ultimate: true, time: 1.7, reducedMotion: true })); fx.root.updateMatrixWorld(true);
      const after = visibleMeshes(fx.root).map(mesh => mesh.matrixWorld.elements.slice());
      expect(before.length).toBeGreaterThan(30);
      expect(after).toEqual(before);
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
