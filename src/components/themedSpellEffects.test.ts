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
  it('retains the collection material through charge, travel and contact without repainting ordinary attacks', () => {
    const expected = ['transparent-crystal-gold', 'navy-leather-gold-ivory-pages', 'gold-edged-leaf-crystal', 'beveled-gold-prism-mirror'];
    for (const mode of ['starter', 'advanced'] as const) for (let chapter=1;chapter<=4;chapter++) {
      const fx=createThemedSpellEffects(new THREE.Scene(),chapter,mode);
      const family=chapter===1 && mode==='advanced'?'ivory-gold-sky-dome':expected[chapter-1];
      for (const time of [.15,.60,1.4]) {
        fx.update(frame({ultimate:true,time}));
        const matching=visibleMeshes(fx.root).filter(mesh => {
          let object:THREE.Object3D|null=mesh;
          while(object) { if(object.userData.cardMaterial===family) return true; object=object.parent; }
          return false;
        }) as THREE.Mesh[];
        expect(matching.length).toBeGreaterThan(2);
        // Card rims reflect metallic highlights while the form keeps a solid
        // silhouette. No added additive blend or flashing material is used.
        expect(matching.some(mesh=>(mesh.material as THREE.MeshStandardMaterial).metalness>.4)).toBe(true);
        expect(matching.every(mesh=>(mesh.material as THREE.Material).blending===THREE.NormalBlending)).toBe(true);
      }
      const normal=fx.root.getObjectByName(`normal-${chapter}`)!;
      expect(nodes(normal).some(node=>node.userData.cardMaterial)).toBe(false);
      fx.dispose();
    }
  });

  it('replays the richer card forms with pooled resources and disposes their transparent and metallic meshes once', () => {
    for (const mode of ['starter','advanced'] as const) for(let chapter=1;chapter<=4;chapter++) {
      const scene=new THREE.Scene(),fx=createThemedSpellEffects(scene,chapter,mode);
      const meshes=nodes(fx.root).filter((node):node is THREE.Mesh=>node instanceof THREE.Mesh);
      const geometryIds=meshes.map(mesh=>mesh.geometry.uuid);
      const materials=[...new Set(meshes.flatMap(mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material]))];
      const geometries=[...new Set(meshes.map(mesh=>mesh.geometry))];
      const spies=[...materials,...geometries].map(resource=>vi.spyOn(resource,'dispose'));
      for(let replay=0;replay<3;replay++) {
        for(const time of [.15,.60,1.4,ULTIMATE_CAST_SECONDS]) fx.update(frame({ultimate:true,time}));
        expect(fx.root.visible).toBe(false);fx.clear();
      }
      expect(meshes.map(mesh=>mesh.geometry.uuid)).toEqual(geometryIds);
      fx.dispose();fx.dispose();
      expect(scene.children).toHaveLength(0);
      for(const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    }
  });

  it('gives both sides a bounded charge, directional trail and contact burst without an early hit or extra replay resources', () => {
    for (const mode of ['starter', 'advanced'] as const) for (let chapter = 1; chapter <= 6; chapter++) {
      const fx = createThemedSpellEffects(new THREE.Scene(), chapter, mode);
      for (const success of [true, false]) {
        const cast = frame({ success, start: new THREE.Vector3(success ? -2.3 : 2.3, 2.0, .5),
          target: new THREE.Vector3(success ? 2.8 : -2.8, 1.49, .5) });
        const active = fx.root.getObjectByName(success ? `normal-${chapter}` : `enemy-${chapter}-${mode}`)!;
        const accents = active.getObjectByName('ordinary-attack-accents')!;
        const charge = accents.getObjectByName('ordinary-charge')!;
        const trail = accents.getObjectByName('ordinary-trail')!;
        const impact = accents.getObjectByName('ordinary-contact')!;
        const meshes = nodes(accents).filter((node): node is THREE.Mesh => node instanceof THREE.Mesh);
        const geometryIds = meshes.map(mesh => mesh.geometry.uuid);
        expect(meshes.length).toBeLessThanOrEqual(36);
        fx.update({ ...cast, time: .15 });
        expect(charge.visible).toBe(true); expect(trail.visible).toBe(false); expect(impact.visible).toBe(false);
        expect(charge.position.x).toBe(cast.start.x);
        fx.update({ ...cast, time: .7 });
        expect(charge.visible).toBe(false); expect(trail.visible).toBe(true); expect(impact.visible).toBe(false);
        for (const part of trail.children) {
          expect(part.position.x).toBeGreaterThan(Math.min(cast.start.x, cast.target.x));
          expect(part.position.x).toBeLessThan(Math.max(cast.start.x, cast.target.x));
        }
        fx.update({ ...cast, time: SPELL_IMPACT_SECONDS });
        expect(trail.visible).toBe(false); expect(impact.visible).toBe(true);
        expect(impact.getObjectByName('ordinary-hit-rays')!.visible).toBe(true);
        expect(impact.position.x).toBe(cast.target.x); expect(impact.position.y).toBe(cast.target.y);
        const initialSpread = impact.children[0].position.length();
        fx.update({ ...cast, time: 1.4 });
        expect(impact.children[0].position.length()).toBeGreaterThan(initialSpread * 2);
        fx.clear(); fx.update({ ...cast, time: .15 });
        expect(meshes.map(mesh => mesh.geometry.uuid)).toEqual(geometryIds);
        expect(impact.visible).toBe(false);
        fx.update({ ...cast, time: NORMAL_CAST_SECONDS }); expect(fx.root.visible).toBe(false);
      }
      fx.update(frame({ ultimate: true, time: 1.2 }));
      expect(fx.root.getObjectByName(`ultimate-${chapter}`)!.getObjectByName('ordinary-attack-accents')).toBeUndefined();
      fx.dispose();
    }
  });

  it('keeps the added accents static in reduced motion, with no trails, additive blend or enlarged screen coverage', () => {
    for (const mode of ['starter', 'advanced'] as const) for (let chapter = 1; chapter <= 6; chapter++) {
      const fx = createThemedSpellEffects(new THREE.Scene(), chapter, mode);
      for (const success of [true, false]) {
        const cast = frame({ success, reducedMotion: true, scale: .42,
          start: new THREE.Vector3(success ? -1.1 : 1.1, 1.0, .5), target: new THREE.Vector3(success ? 1.1 : -1.1, .63, .5) });
        const active = fx.root.getObjectByName(success ? `normal-${chapter}` : `enemy-${chapter}-${mode}`)!;
        const accents = active.getObjectByName('ordinary-attack-accents')!;
        fx.update({ ...cast, time: .7 });
        expect(accents.getObjectByName('ordinary-trail')!.visible).toBe(false);
        fx.update({ ...cast, time: 1.1 }); fx.root.updateMatrixWorld(true);
        const before = visibleMeshes(accents).map(mesh => mesh.matrixWorld.elements.slice());
        fx.update({ ...cast, time: 1.7 }); fx.root.updateMatrixWorld(true);
        expect(visibleMeshes(accents).map(mesh => mesh.matrixWorld.elements.slice())).toEqual(before);
        for (const object of visibleMeshes(accents)) {
          const bounds = new THREE.Box3().setFromObject(object);
          expect(bounds.max.x).toBeLessThan(1.7); expect(bounds.min.x).toBeGreaterThan(-1.7);
          expect(bounds.max.y).toBeLessThan(1.3); expect(bounds.min.y).toBeGreaterThan(.1);
          expect(((object as THREE.Mesh).material as THREE.Material).blending).toBe(THREE.NormalBlending);
        }
      }
      fx.dispose();
    }
  });

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
  it('adds ordinary accents to both final bosses, follows a missed target and excludes critical attacks', () => {
    for (const mode of ['starter', 'advanced'] as const) {
      const fx = createThemedSpellEffects(new THREE.Scene(), 5, mode, true);
      const accents = fx.root.getObjectByName(`final-enemy-${mode}`)!.getObjectByName('ordinary-attack-accents')!;
      const contact = accents.getObjectByName('ordinary-contact')!;
      expect(accents.userData.motif).toBe(mode === 'starter' ? 'paper' : 'ice');
      fx.update(frame({ time: .15, success: false }));
      expect(accents.visible).toBe(true); expect(accents.getObjectByName('ordinary-charge')!.visible).toBe(true);
      expect(contact.visible).toBe(false);
      fx.update(frame({ time: .7, success: false }));
      expect(accents.getObjectByName('ordinary-trail')!.visible).toBe(true);
      fx.update(frame({ time: SPELL_IMPACT_SECONDS, success: false, missed: true }));
      expect(contact.visible).toBe(true);
      expect(contact.position.x).toBeCloseTo(frame().target.x - .65);
      expect(contact.position.y).toBeCloseTo(frame().target.y - .55);
      fx.update(frame({ time: 1.1, success: false, enemyCritical: true }));
      expect(accents.visible).toBe(false); expect(visibleMeshes(accents)).toHaveLength(0);
      expect(fx.root.getObjectByName('final-boss-critical-bolt-0')!.visible).toBe(true);
      fx.update(frame({ time: 1.1, success: false, reducedMotion: true })); fx.root.updateMatrixWorld(true);
      expect(accents.visible).toBe(true);
      expect(accents.getObjectByName('ordinary-trail')!.visible).toBe(false);
      expect(contact.position.x).toBe(frame().target.x);
      const before = visibleMeshes(accents).map(mesh => mesh.matrixWorld.elements.slice());
      fx.update(frame({ time: 1.7, success: false, reducedMotion: true })); fx.root.updateMatrixWorld(true);
      expect(visibleMeshes(accents).map(mesh => mesh.matrixWorld.elements.slice())).toEqual(before);
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
    const ultimateShapes = ['guardian-castle', 'branching-lightning', 'leaf', 'false-mask', 'phoenix-fire-impact', 'ice-crystal-shard'];
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

  it('gives starter thunder and mirror a giant travelling object followed by a separate fragment impact', () => {
    const cases = [
      { chapter: 2, normal: 'thunder-book-page', formation: 'thunder-index-summoning-array',
        projectile: 'colossal-thunder-index', impact: 'thunder-index-impact', wave: 'thunder-index-page-wave' },
      { chapter: 4, normal: 'mirror-blade', formation: 'mirror-summoning-array',
        projectile: 'colossal-mirror-cleaver', impact: 'mirror-mask-shatter-impact', wave: 'mirror-cleaver-ripple' },
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

  it('keeps card-matched supporting meshes, heals beside the hero and leaves the phoenix creature to its card sprite', () => {
    for (const mode of ['starter','advanced'] as const) {
      const forest=createThemedSpellEffects(new THREE.Scene(),3,mode);
      forest.update(frame({ultimate:true,time:1.3,reducedMotion:true}));
      const special=forest.root.getObjectByName('ultimate-3')!;
      expect(special.getObjectByName('classification-card')).toBeUndefined();
      const puzzle=special.getObjectByName('card-botanical-puzzle')!;
      expect(puzzle.position.x).toBeLessThan(0);
      forest.root.updateMatrixWorld(true); const before=visibleMeshes(special).map(mesh=>mesh.matrixWorld.elements.slice());
      forest.update(frame({ultimate:true,time:1.8,reducedMotion:true})); forest.root.updateMatrixWorld(true);
      expect(visibleMeshes(special).map(mesh=>mesh.matrixWorld.elements.slice())).toEqual(before);
      forest.dispose();
    }
    const phoenix=createThemedSpellEffects(new THREE.Scene(),5,'starter');
    phoenix.update(frame({ultimate:true,time:.7}));
    expect(phoenix.root.getObjectByName('wisdom-phoenix')).toBeUndefined();
    expect(phoenix.root.getObjectByName('ultimate-strike')!.visible).toBe(false);
    phoenix.update(frame({ultimate:true,time:SPELL_IMPACT_SECONDS}));
    expect(phoenix.root.getObjectByName('phoenix-fire-impact')!.visible).toBe(true);
    phoenix.dispose();
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
