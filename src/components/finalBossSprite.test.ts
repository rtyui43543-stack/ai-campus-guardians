import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import type { Mode } from '../domain/types';
import { createFinalBossSprite, finalBossCastShape, getFinalBossArt } from './finalBossSprite';
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
  it('constructs a different final boss identity from the locally packaged image', () => {
    const { rig, art, load, loaded, onReady, mesh } = boundary(mode);
    expect(atlasDimensions(art.assetPath)).toEqual({ width: art.width, height: art.height });
    expect(art.width).toBeGreaterThanOrEqual(art.height);
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
    if (mode === 'starter') {
      expect(art.frames.idle.rect).not.toEqual(art.frames.release.rect);
      expect(art.frames.hurt.rect).not.toEqual(art.frames.release.rect);
    } else {
      // One reviewed nine-head silhouette is retained throughout cast/recoil transforms.
      expect(art.frames.idle.rect).toEqual(art.frames.release.rect);
      expect(art.frames.hurt.rect).toEqual(art.frames.release.rect);
    }
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

  it('visibly compresses back then leans left from the same grounded artwork, without accumulated deformation', () => {
    const { rig, camera, mesh, loaded } = boundary(mode); loaded();
    const geometry = mesh.geometry.getAttribute('position');
    const coordinates = () => Array.from({length: geometry.count}, (_, index) => [geometry.getX(index), geometry.getY(index), geometry.getZ(index)]);
    rig.updateVisual({camera, attackTime:.3, success:false, reducedMotion:false});
    const windup = coordinates();
    expect(rig.root.userData.castShape).toMatchObject({ compression: expect.any(Number), lean: expect.any(Number) });
    expect(rig.root.userData.castShape.compression).toBeGreaterThan(0);
    expect(rig.root.userData.castShape.lean).toBeGreaterThan(0);
    const tip = rig.tip.position.toArray();
    for (let index = 0; index < 12; index++) rig.updateVisual({camera, attackTime:.3, success:false, reducedMotion:false});
    expect(coordinates()).toEqual(windup);
    expect(rig.tip.position.toArray()).toEqual(tip);
    rig.updateVisual({camera, attackTime:.7, success:false, reducedMotion:false});
    expect(rig.root.userData.castShape.lean).toBeLessThan(0);
    expect(rig.root.getObjectByName('cover-hero-image-sole')!.position.toArray()).toEqual([0,.02,0]);
    // Top two vertices remain above the feet and the atlas never flips upside down.
    expect(geometry.getY(0)).toBeGreaterThan(geometry.getY(2));
    expect(geometry.getY(1)).toBeGreaterThan(geometry.getY(3));
    rig.updateVisual({camera, attackTime:.7, success:false, reducedMotion:true});
    expect(rig.root.userData.castShape).toEqual({ compression:0, lean:0, headEnergy:0 });
    rig.updateVisual({camera, reducedMotion:false});
    const idle = coordinates();
    rig.updateVisual({camera, attackTime:.3, success:false, reducedMotion:false});
    rig.updateVisual({camera, reducedMotion:false});
    expect(coordinates()).toEqual(idle);
  });
});

it('shows nine calibrated energy rings only while the nine-head boss gathers a real counterattack', () => {
  const { rig, camera, loaded } = boundary('advanced'); loaded();
  const energy = rig.root.getObjectByName('final-nine-head-charge')!;
  expect(energy.children).toHaveLength(9);
  const update = (attackTime: number | undefined, success = false, reducedMotion = false) => rig.updateVisual({camera,attackTime,success,reducedMotion});
  update(.25); expect(energy.visible).toBe(true);
  const positions = energy.children.map(head => head.position.toArray());
  expect(new Set(positions.map(point => point.join(','))).size).toBe(9);
  update(.25); expect(energy.children.map(head => head.position.toArray())).toEqual(positions);
  update(.8); expect(energy.visible).toBe(false);
  update(.25,true); expect(energy.visible).toBe(false);
  update(.25,false,true); expect(energy.visible).toBe(false);
  update(undefined); expect(energy.visible).toBe(false);
  const ring = energy.children[0].children[0] as THREE.Mesh;
  const disposeGeometry = vi.spyOn(ring.geometry,'dispose'), disposeMaterial = vi.spyOn(ring.material as THREE.Material,'dispose');
  rig.disposeVisual(); rig.disposeVisual();
  expect(disposeGeometry).toHaveBeenCalledTimes(1); expect(disposeMaterial).toHaveBeenCalledTimes(1);
});

it('does not invent dragon head landmarks for the starter grimoire king or animate invalid clocks', () => {
  const {rig,camera,loaded}=boundary('starter'); loaded();
  rig.updateVisual({camera,attackTime:.25,success:false,reducedMotion:false});
  expect(rig.root.getObjectByName('final-nine-head-charge')).toBeUndefined();
  for (const time of [undefined,NaN,Infinity,-1,1.5,2.05]) {
    expect(finalBossCastShape(time,true,false)).toEqual({ compression:0,lean:0,headEnergy:0 });
  }
  expect(finalBossCastShape(.25,false,false)).toEqual({compression:0,lean:0,headEnergy:0});
  expect(finalBossCastShape(.25,true,true)).toEqual({compression:0,lean:0,headEnergy:0});
});

it('retains all nine visually reviewed heads inside every advanced portrait and battle frame', () => {
  const art = getFinalBossArt('advanced');
  expect(art.assetPath).toBe('/art/final-dragon-v2.webp');
  if (!('headCenters' in art)) throw new Error('Missing nine-head visual-review landmarks.');
  expect(art.headCenters).toHaveLength(9);
  expect(new Set(art.headCenters.map(point => point.join(','))).size).toBe(9);
  const centerX = art.headCenters[0][0];
  expect(art.headCenters.slice(1).filter(([x]) => x < centerX)).toHaveLength(4);
  expect(art.headCenters.slice(1).filter(([x]) => x > centerX)).toHaveLength(4);
  for (const frame of Object.values(art.frames)) {
    expect(frame.rect).toEqual({ x: 0, y: 0, width: art.width, height: art.height });
    for (const [x, y] of art.headCenters) {
      expect(x).toBeGreaterThan(frame.rect.x); expect(x).toBeLessThan(frame.rect.x + frame.rect.width);
      expect(y).toBeGreaterThan(frame.rect.y); expect(y).toBeLessThan(frame.rect.y + frame.rect.height);
    }
  }
  expect(getFinalBossArt('starter').assetPath).toBe('/art/final-bosses-v1.webp');
});
