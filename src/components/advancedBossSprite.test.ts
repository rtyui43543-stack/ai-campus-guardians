import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { getBossForTheme } from '../content/missionBosses';
import { createAdvancedBossSprite, createMissionEnemy, advancedBossCalibration, advancedBossOuterExtent, getAdvancedBossArt,
  type MissionEnemyRig } from './advancedBossSprite';
import { Arena, GuardianPortrait } from './Arena';
import type { HeroSpriteTextureLoader } from './coverHeroSprite';

const owned: MissionEnemyRig[] = [];
afterEach(() => {
  for (const rig of owned.splice(0)) {
    if (rig.disposeVisual) rig.disposeVisual();
    else {
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      rig.root.traverse(object => { if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      } });
      geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
    }
  }
  vi.unstubAllGlobals();
});

function boundary(chapterId = 1) {
  const texture = new THREE.Texture();
  let loaded!: (texture: THREE.Texture) => void;
  const load: HeroSpriteTextureLoader = vi.fn((_url, ready) => { loaded = ready; return texture; });
  const onReady = vi.fn(), rig = createAdvancedBossSprite(chapterId, { loadTexture: load, onReady,
    resolveAssetUrl: path => '/ai-campus-guardians' + path });
  owned.push(rig);
  const camera = new THREE.OrthographicCamera(-6, 6, 4.4, -4.4, .1, 60);
  camera.position.set(0, 6.5, 15); camera.lookAt(0, 1.8, 0); camera.updateMatrixWorld(true);
  return { rig, texture, load, loaded: () => loaded(texture), onReady, camera };
}

describe('difficulty-specific advanced enemies', () => {
  it('reserves horizontal space for the outer edge of every pose on a narrow phone', () => {
    const viewWidth = 8.8 * 390 / 844, rootX = viewWidth * .235;
    for (let chapter = 1; chapter <= 6; chapter++) {
      const art = getAdvancedBossArt(chapter), height = advancedBossCalibration(chapter).actorHeight!;
      const units = height / (art.frames.idle.foot[1] - art.frames.idle.topY);
      const extent = advancedBossOuterExtent(chapter), scale = Math.min(.8, (viewWidth * .265 - .10) / Math.max(2, extent));
      for (const frame of Object.values(art.frames)) {
        const right = (frame.rect.x + frame.rect.width - frame.foot[0]) * units;
        expect(extent).toBeGreaterThanOrEqual(right);
        expect(rootX + right * scale).toBeLessThanOrEqual(viewWidth / 2 - .099);
      }
    }
  });
  it('uses the measured atlas for each distinct species and each difficulty independently', () => {
    for (let chapter = 1; chapter <= 6; chapter++) {
      const native = createMissionEnemy(chapter, 'starter'); owned.push(native);
      const advanced = boundary(chapter);
      expect(native.updateVisual).toBeUndefined();
      expect(native.root.userData.missionBossId).toBe(getBossForTheme(chapter, 'starter').id);
      expect(advanced.rig.root.userData.missionBossId).toBe(getBossForTheme(chapter, 'advanced').id);
      expect(advanced.rig.root.userData.missionBossId).not.toBe(native.root.userData.missionBossId);
      expect(advanced.load).toHaveBeenCalledWith(`/ai-campus-guardians/art/advanced-boss-${chapter}-v1.webp`,
        expect.any(Function), expect.any(Function));
      expect(advanced.rig.root.getObjectByName('mage-staff')?.children).toHaveLength(0);
    }
  });

  it('keeps the opening companion independent of a selected advanced difficulty', () => {
    const loadTexture = vi.fn(), mimi = createMissionEnemy(6, 'advanced', true, { loadTexture }); owned.push(mimi);
    expect(mimi.root.userData.missionBossId).toBe('mimi-companion');
    expect(mimi.updateVisual).toBeUndefined(); expect(loadTexture).not.toHaveBeenCalled();
  });

  it('casts when the student misses, reacts to a hit when the student succeeds and supports reduced motion', () => {
    const { rig, camera } = boundary();
    const pose = (attackTime?: number, success = false, reducedMotion = false) => {
      rig.updateVisual({ camera, attackTime, success, reducedMotion }); return rig.root.userData.pose;
    };
    expect(pose(.2, false)).toBe('windup'); expect(pose(.55, false)).toBe('release');
    expect(pose(1, true)).toBe('hurt'); expect(pose(.3, true)).toBe('idle');
    expect(pose(.2, false, true)).toBe('release'); expect(pose(1, true, true)).toBe('hurt');
    expect(pose()).toBe('idle'); expect(pose(1.6, false)).toBe('idle');
  });

  it('grounds all four alpha-safe frames, keeps their pixels at one scale and anchors effects to visible emitters', () => {
    for (let chapter = 1; chapter <= 6; chapter++) {
      const { rig, camera } = boundary(chapter), art = getAdvancedBossArt(chapter), calibration = advancedBossCalibration(chapter);
      rig.root.position.set(2.8, .03, 0); rig.root.rotation.set(.02, -.4, -.12); rig.root.scale.setScalar(.7);
      const mesh = rig.root.getObjectByName('cover-identity-hero-atlas') as THREE.Mesh;
      const reference = art.frames.idle, units = calibration.actorHeight! / (reference.foot[1] - reference.topY);
      for (const pose of ['idle', 'windup', 'release', 'hurt'] as const) {
        rig.updateVisual({ camera, reducedMotion: false, pose });
        const frame = art.frames[pose], uvs = mesh.geometry.getAttribute('uv');
        expect(uvs.getX(0)).toBeCloseTo((frame.rect.x + 1) / art.width, 6);
        expect(uvs.getY(0)).toBeCloseTo(1 - (frame.rect.y + 1) / art.height, 6);
        expect(uvs.getX(1)).toBeCloseTo((frame.rect.x + frame.rect.width - 1) / art.width, 6);
        expect(rig.tip.position.x).toBeCloseTo((frame.emitter[0] - frame.foot[0]) * units, 8);
        expect(rig.tip.position.y).toBeCloseTo((frame.foot[1] - frame.emitter[1]) * units + .02, 8);
        expect(rig.root.getObjectByName('cover-hero-image-sole')!.position.toArray()).toEqual([0, .02, 0]);
        expect(Math.abs(mesh.getWorldQuaternion(new THREE.Quaternion()).dot(camera.getWorldQuaternion(new THREE.Quaternion()))))
          .toBeCloseTo(1, 10);
      }
    }
  });

  it('loads and disposes an advanced actor exactly once, including a late callback', () => {
    const { rig, texture, loaded, onReady, camera } = boundary(4), dispose = vi.spyOn(texture, 'dispose');
    const art = getAdvancedBossArt(4); texture.image = { width: art.width, height: art.height }; loaded(); loaded();
    expect(onReady).toHaveBeenCalledTimes(1); expect(rig.root.userData.spriteStatus).toBe('ready');
    rig.updateVisual({ camera, reducedMotion: false, attackTime: .55, success: false });
    expect(rig.root.userData.pose).toBe('release'); rig.disposeVisual(); rig.disposeVisual(); loaded();
    expect(dispose).toHaveBeenCalledTimes(1); expect(rig.root.userData.spriteStatus).toBe('disposed');
    expect(rig.root.getObjectByName('cover-identity-hero-atlas')).toBeUndefined();
  });

  it('shows a single idle pose in map cards and labels the actual mode-selected opponent in scene markup', () => {
    vi.stubGlobal('document', { baseURI: 'https://example.test/ai-campus-guardians/' });
    for (let chapter = 1; chapter <= 6; chapter++) {
      const advanced = getBossForTheme(chapter, 'advanced'), art = getAdvancedBossArt(chapter), rect = art.frames.idle.rect;
      const portrait = renderToStaticMarkup(createElement(GuardianPortrait, { chapter, mode: 'advanced' }));
      expect(portrait).toContain(`data-boss="${advanced.id}"`);
      expect(portrait).toContain(`viewBox="${rect.x} ${rect.y} ${rect.width} ${rect.height}"`);
      expect(portrait).toContain(advanced.artPath!); expect(portrait).not.toContain('boss-portraits-v2.webp');
      const nativePortrait = renderToStaticMarkup(createElement(GuardianPortrait, { chapter, mode: 'starter' }));
      expect(nativePortrait).toContain('boss-portraits-v2.webp'); expect(nativePortrait).not.toContain(advanced.artPath!);
      const arena = renderToStaticMarkup(createElement(Arena, { chapter, mode: 'advanced', guardian: advanced.name,
        enemyHp: 100, playerHp: 100, reducedMotion: true, cue: '' }));
      expect(arena).toContain(`data-boss="${advanced.id}"`); expect(arena).toContain(advanced.name);
      expect(arena).toContain('data-boss-mode="advanced"');
    }
    const opening = renderToStaticMarkup(createElement(Arena, { chapter: 6, mode: 'advanced', guardian: '米米',
      companion: true, enemyHp: 100, playerHp: 100, reducedMotion: true, cue: '' }));
    expect(opening).toContain('data-boss="mimi-companion"'); expect(opening).toContain('data-boss-mode="companion"');
  });
});
