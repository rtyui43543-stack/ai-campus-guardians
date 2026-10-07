import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createCoverHeroSprite, heroSpriteUvRect, type CoverHeroSpriteRig,
  DEFAULT_HERO_SPRITE_CALIBRATION, type HeroSpriteCalibration, type HeroSpriteTextureLoader, type HeroSpritePose } from './coverHeroSprite';
import { poseMage } from './magePose';

const calibration: HeroSpriteCalibration = {
  actorHeight: 4, atlasWidth: 1254, atlasHeight: 1254,
  frames: {
    idle: { foot: { x: .5, y: .9 }, gem: { x: .75, y: .25 }, hatTopY: .1 },
    windup: { foot: { x: .48, y: .91 }, gem: { x: .64, y: .1 }, hatTopY: .04 },
    release: { foot: { x: .5, y: .85 }, gem: { x: .82, y: .36 }, hatTopY: .16 },
    hurt: { foot: { x: .51, y: .92 }, gem: { x: .67, y: .27 }, hatTopY: .12 },
  },
};
const owned: CoverHeroSpriteRig[] = [];
afterEach(() => { owned.splice(0).forEach(rig => rig.disposeVisual()); });

function loadingBoundary() {
  const placeholder = new THREE.Texture();
  let loaded!: (texture: THREE.Texture) => void, failed!: (error: unknown) => void;
  const load: HeroSpriteTextureLoader = vi.fn((_url, onLoaded, onFailed) => {
    loaded = onLoaded; failed = onFailed; return placeholder;
  });
  const onReady = vi.fn(), onError = vi.fn();
  const rig = createCoverHeroSprite({ calibration, loadTexture: load, onReady, onError,
    resolveAssetUrl: path => `/ai-campus-guardians${path}` });
  owned.push(rig);
  return { rig, placeholder, load, onReady, onError,
    finish: (texture = placeholder) => loaded(texture), fail: (error: unknown) => failed(error) };
}
function atlasMesh(rig: CoverHeroSpriteRig) {
  return rig.root.getObjectByName('cover-identity-hero-atlas') as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
}
function camera() {
  const view = new THREE.OrthographicCamera(-6, 6, 4.4, -4.4, .1, 60);
  view.position.set(3, 7, 15); view.lookAt(0, 1.7, 0); view.updateMatrixWorld(true); return view;
}

describe('cover-identity actor atlas', () => {
  it('selects top-left, top-right, bottom-left, bottom-right with a two-pixel sampling margin', () => {
    const poses: HeroSpritePose[] = ['idle', 'windup', 'release', 'hurt'];
    const expectedCenters = [[.25, .75], [.75, .75], [.25, .25], [.75, .25]];
    poses.forEach((pose, index) => {
      const rectangle = heroSpriteUvRect(pose, 1254, 1254, 2);
      expect((rectangle.left + rectangle.right) / 2).toBe(expectedCenters[index][0]);
      expect((rectangle.bottom + rectangle.top) / 2).toBe(expectedCenters[index][1]);
      expect(rectangle.right - rectangle.left).toBeCloseTo(.5 - 4 / 1254, 10);
      expect(rectangle.top - rectangle.bottom).toBeCloseTo(.5 - 4 / 1254, 10);
    });
    expect(heroSpriteUvRect('windup', 1254, 1254, 2).left - heroSpriteUvRect('idle', 1254, 1254, 2).right)
      .toBeCloseTo(4 / 1254, 10);
    expect(heroSpriteUvRect('idle', 1254, 1254, 2).bottom - heroSpriteUvRect('release', 1254, 1254, 2).top)
      .toBeCloseTo(4 / 1254, 10);
  });

  it('preserves rendered colours, local deployment paths and transparent silhouettes', () => {
    const boundary = loadingBoundary(), mesh = atlasMesh(boundary.rig);
    expect(boundary.load).toHaveBeenCalledWith('/ai-campus-guardians/art/hero-poses-v3.webp', expect.any(Function), expect.any(Function));
    expect(mesh.visible).toBe(false); boundary.placeholder.image = { width: 1254, height: 1254 }; boundary.finish();
    expect(mesh.visible).toBe(true); expect(boundary.rig.root.userData.spriteStatus).toBe('ready');
    expect(mesh.material.toneMapped).toBe(false); expect(mesh.material.transparent).toBe(true);
    expect(mesh.material.depthWrite).toBe(false); expect(mesh.material.alphaTest).toBe(.08);
    expect(mesh.castShadow).toBe(false);
    expect(boundary.placeholder.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(boundary.placeholder.generateMipmaps).toBe(false);
    expect(boundary.placeholder.minFilter).toBe(THREE.LinearFilter);
    expect(boundary.onReady).toHaveBeenCalledTimes(1);
    boundary.finish(); expect(boundary.onReady).toHaveBeenCalledTimes(1);
  });

  it('faces the whole pitched camera despite root yaw/recoil and keeps the gem attached to image coordinates', () => {
    const { rig } = loadingBoundary(), view = camera(), mesh = atlasMesh(rig);
    rig.root.position.set(-2.8, .018, -.2); rig.root.scale.setScalar(.72);
    rig.root.rotation.set(.09, 1.34, .23);
    poseMage(rig, { cast: 1, windup: 1 });
    rig.updateVisual({ camera: view, reducedMotion: false, pose: 'idle' });
    const imageRotation = mesh.getWorldQuaternion(new THREE.Quaternion()), viewRotation = view.getWorldQuaternion(new THREE.Quaternion());
    expect(Math.abs(imageRotation.dot(viewRotation))).toBeCloseTo(1, 10);
    const origin = rig.root.getWorldPosition(new THREE.Vector3()), sole = rig.root.getObjectByName('cover-hero-image-sole')!;
    const expectedSole = new THREE.Vector3(0, .02, 0).multiplyScalar(.72).applyQuaternion(viewRotation).add(origin);
    expect(sole.getWorldPosition(new THREE.Vector3()).distanceTo(expectedSole)).toBeLessThan(1e-8);
    const expectedGem = new THREE.Vector3(1.25, 3.27, .025).multiplyScalar(.72).applyQuaternion(viewRotation).add(origin);
    expect(rig.tip.getWorldPosition(new THREE.Vector3()).distanceTo(expectedGem)).toBeLessThan(1e-8);
    // No camera-pitch correction changes the anatomy's image scale.
    const vertices = mesh.geometry.getAttribute('position');
    const topLeft = mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, 0));
    const topRight = mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, 1));
    const bottomLeft = mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, 2));
    const width = topRight.sub(topLeft), height = bottomLeft.sub(topLeft);
    expect(width.length()).toBeCloseTo(height.length(), 6);
    expect(width.dot(height)).toBeCloseTo(0, 7);
    expect(height.length()).toBeCloseTo(5 * (1 - 4 / 1254) * .72, 6);
  });

  it('uses one anatomy scale across poses and grounds each foot rather than fitting every alpha bounding box', () => {
    const { rig } = loadingBoundary(), view = camera(), mesh = atlasMesh(rig);
    let restingWidth = 0;
    for (const pose of ['idle', 'windup', 'release', 'hurt'] as HeroSpritePose[]) {
      rig.updateVisual({ camera: view, reducedMotion: false, pose });
      const positions = mesh.geometry.getAttribute('position'), width = positions.getX(1) - positions.getX(0);
      if (pose === 'idle') restingWidth = width;
      else expect(width).toBeCloseTo(restingWidth, 6);
      const sole = rig.root.getObjectByName('cover-hero-image-sole')!;
      expect(sole.position.y).toBe(.02);
      for (let index = 0; index < positions.count; index++) {
        expect([positions.getX(index), positions.getY(index), positions.getZ(index)].every(Number.isFinite)).toBe(true);
      }
      expect(rig.tip.getWorldPosition(new THREE.Vector3()).toArray().every(Number.isFinite)).toBe(true);
    }
    rig.updateVisual({ camera: view, reducedMotion: false, pose: 'release' });
    expect(rig.tip.position.x).toBeCloseTo(1.6, 10); expect(rig.tip.position.y).toBeCloseTo(2.47, 10);
  });

  it('selects attack and hurt frames from the current clock and returns to idle when the attack ends', () => {
    const { rig } = loadingBoundary(), view = camera();
    const update = (attackTime?: number, success = true, reducedMotion = false) => {
      rig.updateVisual({ camera: view, attackTime, success, reducedMotion }); return rig.root.userData.pose;
    };
    expect(update(.2)).toBe('windup'); expect(update(.48)).toBe('release');
    expect(update(.2, true, true)).toBe('release'); expect(update(1, false)).toBe('hurt');
    expect(update(.3, false)).toBe('idle'); expect(update(1.5)).toBe('idle');
    expect(update(.5)).toBe('release');
    rig.updateVisual({ camera: view, reducedMotion: false }); expect(rig.root.userData.pose).toBe('idle');
    rig.updateVisual({ camera: view, reducedMotion: false, pose: 'hurt', attackTime: .2, success: true });
    expect(rig.root.userData.pose).toBe('hurt'); expect(update(Number.NaN)).toBe('idle');
  });

  it('samples unequal safe regions without moving soles or rescaling the same anatomy pixels', () => {
    const { rig } = loadingBoundary(), view = camera();
    // Artist layout: idle is 400x500, release extends into a wider 550x400 region.
    rig.setCalibration({ ...calibration, actorHeight: 4,
      frames: { ...calibration.frames,
        idle: { foot: { x: .5, y: .9 }, gem: { x: .75, y: .25 }, hatTopY: .1,
          rect: { x: 20, y: 30, width: 400, height: 500 } },
        release: { foot: { x: .4, y: .8 }, gem: { x: .8, y: .3 }, hatTopY: .12,
          rect: { x: 60, y: 650, width: 550, height: 400 } },
      } });
    rig.updateVisual({ camera: view, reducedMotion: false, pose: 'release' });
    const mesh = atlasMesh(rig), positions = mesh.geometry.getAttribute('position'), uvs = mesh.geometry.getAttribute('uv');
    expect(uvs.getX(0)).toBeCloseTo(61 / 1254, 7); expect(uvs.getX(1)).toBeCloseTo(609 / 1254, 7);
    expect(uvs.getY(0)).toBeCloseTo(1 - 651 / 1254, 7); expect(uvs.getY(2)).toBeCloseTo(1 - 1049 / 1254, 7);
    // 4 world units / 400 anatomy pixels = .01 world units for every pose.
    expect(positions.getX(1) - positions.getX(0)).toBeCloseTo(5.48, 6);
    expect(positions.getY(0) - positions.getY(2)).toBeCloseTo(3.98, 6);
    expect(rig.tip.position.x).toBeCloseTo(2.2, 10); expect(rig.tip.position.y).toBeCloseTo(2.02, 10);
    const sole = rig.root.getObjectByName('cover-hero-image-sole')!;
    expect(sole.position.toArray()).toEqual([0, .02, 0]);
    const frameRotation = view.getWorldQuaternion(new THREE.Quaternion());
    expect(rig.tip.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(2.2, 2.02, .025).applyQuaternion(frameRotation)))
      .toBeLessThan(1e-8);
    rig.updateVisual({ camera: view, reducedMotion: false, pose: 'idle' });
    expect(rig.tip.position.x).toBeCloseTo(1, 10); expect(rig.tip.position.y).toBeCloseTo(3.27, 10);
  });

  it('keeps the final atlas feet and extended release gem inside the measured safe regions', () => {
    const { rig } = loadingBoundary(), view = camera();
    rig.setCalibration(DEFAULT_HERO_SPRITE_CALIBRATION);
    rig.updateVisual({ camera: view, reducedMotion: false, pose: 'release' });
    const mesh = atlasMesh(rig), uvs = mesh.geometry.getAttribute('uv');
    // The release gem crosses the nominal half-atlas boundary and must not be clipped there.
    expect(uvs.getX(1)).toBeGreaterThan(.5);
    expect(rig.tip.position.x).toBeCloseTo((603.18 - 290) * 3.82 / 618, 10);
    expect(rig.tip.position.y).toBeCloseTo((1228 - 815.95) * 3.82 / 618 + .02, 10);
    for (const frame of Object.values(DEFAULT_HERO_SPRITE_CALIBRATION.frames)) {
      expect(frame.foot.x).toBeGreaterThan(0); expect(frame.foot.x).toBeLessThan(1);
      expect(frame.foot.y).toBeLessThan(1); expect(frame.gem.x).toBeGreaterThan(0); expect(frame.gem.x).toBeLessThan(1);
      expect(frame.gem.y).toBeGreaterThan(0); expect(frame.gem.y).toBeLessThan(1);
    }
    rig.updateVisual({ camera: view, reducedMotion: false, pose: 'idle' });
    const normalizedHeight = (DEFAULT_HERO_SPRITE_CALIBRATION.frames.idle.foot.y
      - DEFAULT_HERO_SPRITE_CALIBRATION.frames.idle.hatTopY) * 650 * 3.82 / 618;
    expect(normalizedHeight).toBeCloseTo(3.82, 10);
  });

  it('cancels late texture callbacks and removes managed visuals before scene-wide disposal', () => {
    const boundary = loadingBoundary(), mesh = atlasMesh(boundary.rig);
    const disposePlaceholder = vi.spyOn(boundary.placeholder, 'dispose'), disposeGeometry = vi.spyOn(mesh.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(mesh.material, 'dispose');
    boundary.rig.disposeVisual(); boundary.rig.disposeVisual();
    expect(disposePlaceholder).toHaveBeenCalledTimes(1); expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(disposeMaterial).toHaveBeenCalledTimes(1);
    expect(boundary.rig.root.getObjectByName('cover-identity-hero-atlas')).toBeUndefined();
    expect(boundary.rig.root.getObjectByName('cover-hero-contact-shadow')).toBeUndefined();
    boundary.finish(); boundary.fail(new Error('late network failure'));
    const late = new THREE.Texture(), disposeLate = vi.spyOn(late, 'dispose');
    boundary.finish(late); boundary.finish(late);
    expect(disposeLate).toHaveBeenCalledTimes(1); expect(disposePlaceholder).toHaveBeenCalledTimes(1);
    expect(boundary.onReady).not.toHaveBeenCalled(); expect(boundary.onError).not.toHaveBeenCalled();
    expect(boundary.rig.root.userData.spriteStatus).toBe('disposed'); expect(mesh.material.map).toBeNull();
  });

  it('rejects invalid calibration before changing the live frame', () => {
    const { rig } = loadingBoundary(), positions = atlasMesh(rig).geometry.getAttribute('position');
    const before = [...positions.array];
    expect(() => rig.setCalibration({ ...calibration, atlasWidth: Number.NaN })).toThrow();
    expect(() => rig.setCalibration({ ...calibration, frames: { ...calibration.frames,
      idle: { ...calibration.frames.idle, foot: { x: .5, y: .11 } } } })).toThrow();
    expect([...positions.array]).toEqual(before);
  });
});
