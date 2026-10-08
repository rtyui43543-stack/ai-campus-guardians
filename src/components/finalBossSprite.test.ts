import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import type { Mode } from '../domain/types';
import { createFinalBossSprite, getFinalBossArt } from './finalBossSprite';
import type { CoverHeroSpriteRig, HeroSpritePose, HeroSpriteTextureLoader } from './coverHeroSprite';

const owned: CoverHeroSpriteRig[] = [];
afterEach(() => owned.splice(0).forEach(rig => rig.disposeVisual()));

function atlasDimensions(assetPath: string) {
  const image = readFileSync(new URL('../../public' + assetPath, import.meta.url));
  expect(image.subarray(0, 4).toString()).toBe('RIFF');
  expect(image.subarray(8, 12).toString()).toBe('WEBP');
  for (let offset = 12; offset + 8 <= image.length;) {
    const type = image.subarray(offset, offset + 4).toString(), length = image.readUInt32LE(offset + 4);
    if (type === 'VP8X') return { width: image.readUIntLE(offset + 12, 3) + 1, height: image.readUIntLE(offset + 15, 3) + 1 };
    if (type === 'VP8L') {
      expect(image[offset + 8]).toBe(0x2f);
      const dimensions = image.readUInt32LE(offset + 9);
      return { width: (dimensions & 0x3fff) + 1, height: ((dimensions >>> 14) & 0x3fff) + 1 };
    }
    offset += 8 + length + (length % 2);
  }
  throw new Error('The final boss asset has no supported WebP canvas header.');
}

function boundary(mode: Mode) {
  const art = getFinalBossArt(mode), texture = new THREE.Texture();
  let loaded!: (texture: THREE.Texture) => void;
  const load: HeroSpriteTextureLoader = vi.fn((_url, ready) => { loaded = ready; return texture; });
  const onReady = vi.fn(), rig = createFinalBossSprite(mode, { loadTexture: load, onReady,
    resolveAssetUrl: path => '/ai-campus-guardians' + path });
  owned.push(rig);
  const camera = new THREE.OrthographicCamera(-6, 6, 4.4, -4.4, .1, 60);
  camera.position.set(0, 6.5, 15); camera.lookAt(0, 1.8, 0); camera.updateMatrixWorld(true);
  const mesh = rig.root.getObjectByName('cover-identity-hero-atlas') as THREE.Mesh;
  return { rig, art, texture, load, onReady, camera, mesh,
    loaded: () => { texture.image = atlasDimensions(art.assetPath); loaded(texture); } };
}

describe.each(['starter', 'advanced'] as const)('final %s boss rendering', mode => {
  it('constructs a different final boss identity from the locally packaged wide atlas', () => {
    const { rig, art, load, loaded, onReady, mesh } = boundary(mode);
    expect(atlasDimensions(art.assetPath)).toEqual({ width: art.width, height: art.height });
    expect(art.width).toBeGreaterThan(art.height);
    expect(load).toHaveBeenCalledWith('/ai-campus-guardians' + art.assetPath,
      expect.any(Function), expect.any(Function));
    expect(rig.root.userData).toMatchObject({ finalBoss: true, mode,
      missionBossId: mode === 'starter' ? 'chaos-grimoire-king' : 'illusion-nine-dragon' });
    expect(mesh.visible).toBe(false); loaded();
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(rig.root.userData.spriteStatus).toBe('ready'); expect(mesh.visible).toBe(true);
  });

  it('uses the cast cell only for an enemy attack and the hurt cell when the student hits it', () => {
    const { rig, camera, art, mesh, loaded } = boundary(mode); loaded();
    const check = (attackTime: number | undefined, success: boolean, pose: HeroSpritePose, reducedMotion = false) => {
      rig.updateVisual({ camera, attackTime, success, reducedMotion });
      expect(rig.root.userData.pose).toBe(pose);
      const rect = art.frames[pose].rect, uv = mesh.geometry.getAttribute('uv');
      expect(uv.getX(0)).toBeCloseTo((rect.x + 1) / art.width, 6);
      expect(uv.getY(0)).toBeCloseTo(1 - (rect.y + 1) / art.height, 6);
      expect(uv.getX(1)).toBeCloseTo((rect.x + rect.width - 1) / art.width, 6);
      expect(uv.getY(2)).toBeCloseTo(1 - (rect.y + rect.height - 1) / art.height, 6);
    };
    check(undefined, false, 'idle'); check(.2, false, 'windup'); check(.55, false, 'release');
    expect(art.frames.windup.rect).toEqual(art.frames.release.rect);
    expect(art.frames.idle.rect).not.toEqual(art.frames.release.rect);
    expect(art.frames.hurt.rect).not.toEqual(art.frames.release.rect);
    check(.3, true, 'idle'); check(1, true, 'hurt'); check(1.6, false, 'idle');
    check(.2, false, 'release', true); check(1, true, 'hurt', true);
  });

  it('keeps every pose grounded and the visible casting origin inside its own safe rectangle', () => {
    const { rig, art, camera, mesh } = boundary(mode);
    const height = mode === 'advanced' ? 3.7 : 3.45;
    const units = height / (art.frames.idle.foot[1] - art.frames.idle.topY);
    rig.root.position.set(2.8, .03, 0); rig.root.rotation.set(.02, -.4, -.12); rig.root.scale.setScalar(.7);
    for (const pose of ['idle', 'windup', 'release', 'hurt'] as const) {
      const frame = art.frames[pose], rect = frame.rect;
      expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(art.width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(art.height);
      expect(frame.emitter[0]).toBeGreaterThan(rect.x); expect(frame.emitter[0]).toBeLessThan(rect.x + rect.width);
      expect(frame.emitter[1]).toBeGreaterThan(rect.y); expect(frame.emitter[1]).toBeLessThan(rect.y + rect.height);
      expect(frame.topY).toBeLessThan(frame.foot[1]);
      rig.updateVisual({ camera, pose, reducedMotion: false });
      expect(rig.tip.position.x).toBeCloseTo((frame.emitter[0] - frame.foot[0]) * units, 8);
      expect(rig.tip.position.y).toBeCloseTo((frame.foot[1] - frame.emitter[1]) * units + .02, 8);
      expect(rig.root.getObjectByName('cover-hero-image-sole')!.position.toArray()).toEqual([0, .02, 0]);
      expect(Math.abs(mesh.getWorldQuaternion(new THREE.Quaternion()).dot(camera.getWorldQuaternion(new THREE.Quaternion()))))
        .toBeCloseTo(1, 10);
    }
  });

  it('releases its atlas and mesh once and cannot resurrect a disposed final actor', () => {
    const { rig, texture, mesh, loaded, onReady, camera } = boundary(mode);
    const disposeTexture = vi.spyOn(texture, 'dispose'), disposeGeometry = vi.spyOn(mesh.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(mesh.material as THREE.Material, 'dispose');
    loaded(); loaded(); expect(onReady).toHaveBeenCalledTimes(1);
    rig.disposeVisual(); rig.disposeVisual(); loaded();
    rig.updateVisual({ camera, attackTime: .55, success: false, reducedMotion: false });
    expect(disposeTexture).toHaveBeenCalledTimes(1); expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(disposeMaterial).toHaveBeenCalledTimes(1); expect(rig.root.userData.spriteStatus).toBe('disposed');
    expect(rig.root.getObjectByName('cover-identity-hero-atlas')).toBeUndefined();
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
