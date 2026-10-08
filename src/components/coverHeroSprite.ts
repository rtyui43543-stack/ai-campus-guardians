import * as THREE from 'three';
import type { CoverHeroRig } from './coverHero';
import { poseMage } from './magePose';
import { appAssetUrl } from '../platform/urls';

export type HeroSpritePose = 'idle' | 'windup' | 'release' | 'hurt';
export const HERO_SPRITE_FRAMES: Readonly<Record<HeroSpritePose, number>> = { idle: 0, windup: 1, release: 2, hurt: 3 };
export interface ImageAnchor { x: number; y: number }
export interface HeroSpritePixelRect { x: number; y: number; width: number; height: number }
export interface HeroSpriteFrameCalibration {
  /** Top-left image coordinates normalized within this frame's safe rectangle. */
  foot: ImageAnchor;
  gem: ImageAnchor;
  /** The hat top, excluding magic particles extending above the character. */
  hatTopY: number;
  /** Original atlas pixel coordinates, allowing unequal artist-composed frame regions. */
  rect?: HeroSpritePixelRect;
}
export interface HeroSpriteCalibration {
  frames: Readonly<Record<HeroSpritePose, HeroSpriteFrameCalibration>>;
  actorHeight?: number;
  atlasWidth?: number;
  atlasHeight?: number;
}
function measuredFrame(rect: HeroSpritePixelRect, foot: readonly [number, number],
  gem: readonly [number, number], hatTopY: number): HeroSpriteFrameCalibration {
  return { rect, foot: { x: (foot[0] - rect.x) / rect.width, y: (foot[1] - rect.y) / rect.height },
    gem: { x: (gem[0] - rect.x) / rect.width, y: (gem[1] - rect.y) / rect.height },
    hatTopY: (hatTopY - rect.y) / rect.height };
}
export const DEFAULT_HERO_SPRITE_CALIBRATION: HeroSpriteCalibration = {
  actorHeight: 3.82, atlasWidth: 1254, atlasHeight: 1254,
  frames: {
    // Safe regions measured from the final, unmodified RGBA atlas at alpha > 20.
    idle: measuredFrame({ x: 48, y: 0, width: 542, height: 650 }, [323.5, 641], [506.97, 107.79], 23),
    windup: measuredFrame({ x: 690, y: 0, width: 564, height: 650 }, [975, 647], [766.31, 138.62], 26),
    release: measuredFrame({ x: 36, y: 650, width: 654, height: 604 }, [290, 1228], [603.18, 815.95], 658),
    hurt: measuredFrame({ x: 690, y: 650, width: 564, height: 604 }, [1006.5, 1234], [1160.53, 766.05], 654),
  },
};
export interface HeroSpriteState {
  camera: THREE.Camera;
  /** Seconds from the existing battle effect clock. Missing/undefined means idle. */
  attackTime?: number;
  success?: boolean;
  reducedMotion: boolean;
  greeting?: boolean;
  /** Explicit frame for cinematic shots, overrides the battle clock. */
  pose?: HeroSpritePose;
}
export type HeroSpriteTextureLoader = (url: string, loaded: (texture: THREE.Texture) => void,
  failed: (error: unknown) => void) => THREE.Texture | undefined;
export interface CoverHeroSpriteOptions {
  onReady?: () => void;
  onError?: (error: unknown) => void;
  calibration?: HeroSpriteCalibration;
  contactShadow?: boolean;
  /** Injectable local loading boundary for lifecycle tests; production uses TextureLoader/appAssetUrl. */
  loadTexture?: HeroSpriteTextureLoader;
  resolveAssetUrl?: (path: string) => string;
  /** Allows other local actors to use the same calibrated rendering and lifecycle boundary. */
  assetPath?: string;
  identity?: string;
}
export interface CoverHeroSpriteRig extends CoverHeroRig {
  updateVisual: (state: HeroSpriteState) => void;
  setCalibration: (calibration: HeroSpriteCalibration) => void;
  disposeVisual: () => void;
}

/** Insets keep linear filtering inside the cell; mipmaps are disabled on this atlas. */
export function heroSpriteUvRect(pose: HeroSpritePose, atlasWidth: number, atlasHeight: number,
  insetPixels = 1, safeRect?: HeroSpritePixelRect) {
  const frame = HERO_SPRITE_FRAMES[pose], column = frame % 2, row = Math.floor(frame / 2);
  const width = Math.max(8, atlasWidth), height = Math.max(8, atlasHeight);
  const rect = safeRect ?? { x: column * width / 2, y: row * height / 2, width: width / 2, height: height / 2 };
  const insetU = Math.min(rect.width / 4, Math.max(0, insetPixels)) / width;
  const insetV = Math.min(rect.height / 4, Math.max(0, insetPixels)) / height;
  return { left: rect.x / width + insetU, right: (rect.x + rect.width) / width - insetU,
    bottom: 1 - (rect.y + rect.height) / height + insetV, top: 1 - rect.y / height - insetV };
}

function choosePose(state: HeroSpriteState): HeroSpritePose {
  if (state.pose) return state.pose;
  const time = state.attackTime;
  if (time === undefined || !Number.isFinite(time) || time < 0 || time >= 1.5) return 'idle';
  if (!state.success) return time >= .9 && time < 1.45 ? 'hurt' : 'idle';
  if (state.reducedMotion) return 'release';
  return time < .42 ? 'windup' : 'release';
}

function validateCalibration(value: HeroSpriteCalibration) {
  if (!Number.isFinite(value.actorHeight ?? 3.82) || (value.actorHeight ?? 3.82) <= 0) throw new Error('角色高度必須是正數。');
  for (const size of [value.atlasWidth, value.atlasHeight]) {
    if (size !== undefined && (!Number.isFinite(size) || size < 8)) throw new Error('角色圖集大小必須至少為 8 像素。');
  }
  for (const key of Object.keys(HERO_SPRITE_FRAMES) as HeroSpritePose[]) {
    const frame = value.frames[key];
    if (!frame) throw new Error('角色圖集必須包含四種姿勢。');
    if (frame.rect) {
      const { x, y, width, height } = frame.rect;
      if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width < 4 || height < 4
        || (value.atlasWidth !== undefined && x + width > value.atlasWidth)
        || (value.atlasHeight !== undefined && y + height > value.atlasHeight)) {
        throw new Error('角色姿勢的安全矩形必須位於圖集內。');
      }
    }
    for (const anchor of [frame.foot, frame.gem]) {
      if (![anchor.x, anchor.y].every(coordinate => Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 1)) {
        throw new Error('角色圖片錨點必須位於同一格圖片內。');
      }
    }
    if (!Number.isFinite(frame.hatTopY) || frame.hatTopY < 0 || frame.foot.y - frame.hatTopY < .15) {
      throw new Error('帽頂與腳底必須提供有效的角色高度。');
    }
  }
}

function contactShadowTexture() {
  const size = 48, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1);
    const offset = (y * size + x) * 4;
    pixels[offset] = 28; pixels[offset + 1] = 54; pixels[offset + 2] = 42;
    pixels[offset + 3] = Math.round(255 * Math.pow(Math.max(0, 1 - radius), 1.5));
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false; texture.needsUpdate = true;
  return texture;
}

/** Locally packaged pre-rendered 3D actor in an articulated native Three scene. */
export function createCoverHeroSprite(options: CoverHeroSpriteOptions = {}): CoverHeroSpriteRig {
  let calibration = options.calibration ?? DEFAULT_HERO_SPRITE_CALIBRATION;
  validateCalibration(calibration);
  let disposed = false, pose: HeroSpritePose = 'idle', lastCamera: THREE.Camera | null = null;
  let atlasWidth = calibration.atlasWidth ?? 2048, atlasHeight = calibration.atlasHeight ?? 2048;
  const root = new THREE.Group(); root.name = options.identity ?? 'original-campus-mage';
  root.userData.design = options.identity ? 'cover-matched-boss-sprite-v1' : 'cover-hero-sprite-v3';
  root.userData.spriteStatus = 'loading'; root.userData.pose = pose;
  const head = new THREE.Group(); head.position.y = 2.2; root.add(head);
  head.name = 'cover-sprite-logical-head';
  const makeArm = (side: number) => {
    const shoulder = new THREE.Group(), elbow = new THREE.Group(), hand = new THREE.Group();
    shoulder.position.set(side * .47, 1.65, .12); elbow.position.y = -.29; hand.position.set(0, -.385, .035);
    hand.name = side < 0 ? 'mage-left-hand' : 'mage-right-hand';
    root.add(shoulder); shoulder.add(elbow); elbow.add(hand); return { shoulder, elbow, hand };
  };
  const left = makeArm(-1), right = makeArm(1);
  const staff = new THREE.Group(); staff.name = 'mage-staff'; staff.position.z = .065; right.hand.add(staff);
  const leftLeg = new THREE.Group(), rightLeg = new THREE.Group();
  leftLeg.position.set(-.22, .84, 0); rightLeg.position.set(.22, .84, 0); root.add(leftLeg, rightLeg);
  const glow = new THREE.MeshStandardMaterial({ color: 0x71ead2, emissive: 0x43c4b0, emissiveIntensity: .65 });
  const visual = new THREE.Group(); visual.name = 'cover-identity-hero'; root.add(visual);
  const geometry = new THREE.PlaneGeometry(1, 1);
  // The original atlas has a faint transparent fringe; reject alpha <= 20/255 so neighboring poses cannot leak in.
  const surface = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, alphaTest: .08,
    depthWrite: false, depthTest: true, toneMapped: false });
  const image = new THREE.Mesh(geometry, surface); image.name = 'cover-identity-hero-atlas';
  image.castShadow = false; image.receiveShadow = false; image.visible = false; visual.add(image);
  const tip = new THREE.Object3D(); tip.name = 'cover-hero-spell-origin'; visual.add(tip);
  const sole = new THREE.Object3D(); sole.name = 'cover-hero-image-sole'; visual.add(sole);
  const managedTextures = new Set<THREE.Texture>(), disposedTextures = new Set<THREE.Texture>();
  const disposeTexture = (texture: THREE.Texture) => {
    if (!disposedTextures.has(texture)) { disposedTextures.add(texture); texture.dispose(); }
  };
  let shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  if (options.contactShadow !== false) {
    const texture = contactShadowTexture(); managedTextures.add(texture);
    shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .54), new THREE.MeshBasicMaterial({
      map: texture, transparent: true, opacity: .3, depthWrite: false, toneMapped: false }));
    shadow.name = 'cover-hero-contact-shadow'; shadow.castShadow = false; shadow.receiveShadow = false;
    shadow.renderOrder = -1; root.add(shadow);
  }
  const worldQuaternion = new THREE.Quaternion(), cameraQuaternion = new THREE.Quaternion(),
    floorQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const worldPosition = new THREE.Vector3();

  const applyFrame = () => {
    const frame = calibration.frames[pose], reference = calibration.frames.idle;
    const frameRectangle = (key: HeroSpritePose): HeroSpritePixelRect => calibration.frames[key].rect ?? {
      x: (HERO_SPRITE_FRAMES[key] % 2) * atlasWidth / 2,
      y: Math.floor(HERO_SPRITE_FRAMES[key] / 2) * atlasHeight / 2,
      width: atlasWidth / 2, height: atlasHeight / 2,
    };
    const rectangle = frameRectangle(pose), referenceRectangle = frameRectangle('idle');
    // Every pose shares one pixel/world scale. Raised staffs or bent hats cannot resize the face.
    const pixelsToWorld = (calibration.actorHeight ?? 3.82) / ((reference.foot.y - reference.hatTopY) * referenceRectangle.height);
    const height = rectangle.height * pixelsToWorld, width = rectangle.width * pixelsToWorld;
    const uv = heroSpriteUvRect(pose, atlasWidth, atlasHeight, 1, rectangle), positions = geometry.getAttribute('position'), uvs = geometry.getAttribute('uv');
    const insetX = (uv.left * atlasWidth - rectangle.x) / rectangle.width;
    const insetY = ((1 - uv.top) * atlasHeight - rectangle.y) / rectangle.height;
    // PlaneGeometry's vertices are top-left, top-right, bottom-left, bottom-right.
    for (let index = 0; index < 4; index++) {
      const rightSide = index % 2 === 1, topSide = index < 2;
      positions.setXYZ(index, ((rightSide ? 1 - insetX : insetX) - frame.foot.x) * width,
        (frame.foot.y - (topSide ? insetY : 1 - insetY)) * height + .02, 0);
      uvs.setXY(index, rightSide ? uv.right : uv.left, topSide ? uv.top : uv.bottom);
    }
    positions.needsUpdate = true; uvs.needsUpdate = true; geometry.computeBoundingSphere(); geometry.computeBoundingBox();
    sole.position.set(0, .02, 0);
    tip.position.set((frame.gem.x - frame.foot.x) * width, (frame.foot.y - frame.gem.y) * height + .02, .025);
    root.userData.pose = pose; root.userData.frame = HERO_SPRITE_FRAMES[pose];
  };
  const align = (camera: THREE.Camera) => {
    root.updateWorldMatrix(true, false); camera.updateWorldMatrix(true, false);
    root.getWorldQuaternion(worldQuaternion).invert(); camera.getWorldQuaternion(cameraQuaternion);
    // Compensate yaw, recoil roll and camera pitch with one quaternion, rather than stretching Y.
    visual.quaternion.copy(worldQuaternion).multiply(cameraQuaternion);
    if (shadow) {
      shadow.quaternion.copy(worldQuaternion).multiply(floorQuaternion);
      root.getWorldPosition(worldPosition); worldPosition.y = .008;
      root.worldToLocal(worldPosition); shadow.position.copy(worldPosition);
    }
    root.updateMatrixWorld(true);
  };
  applyFrame();
  const rig: CoverHeroSpriteRig = {
    root, head, leftArm: left.shoulder, rightArm: right.shoulder, leftElbow: left.elbow, rightElbow: right.elbow,
    staff, leftLeg, rightLeg, tip, glow,
    updateVisual(state) {
      if (disposed) return;
      const next = choosePose(state);
      if (pose !== next) { pose = next; applyFrame(); }
      lastCamera = state.camera; align(state.camera);
    },
    setCalibration(next) {
      if (disposed) return;
      validateCalibration(next); calibration = next;
      atlasWidth = next.atlasWidth ?? atlasWidth; atlasHeight = next.atlasHeight ?? atlasHeight;
      applyFrame(); if (lastCamera) align(lastCamera);
    },
    disposeVisual() {
      if (disposed) return;
      disposed = true; lastCamera = null; root.userData.spriteStatus = 'disposed';
      visual.removeFromParent(); shadow?.removeFromParent();
      surface.map = null; geometry.dispose(); surface.dispose(); glow.dispose();
      shadow?.geometry.dispose(); shadow?.material.dispose();
      managedTextures.forEach(disposeTexture); managedTextures.clear();
    },
  };
  poseMage(rig);
  const ready = (texture: THREE.Texture) => {
    if (disposed) { disposeTexture(texture); return; }
    if (surface.map === texture && root.userData.spriteStatus === 'ready') return;
    managedTextures.add(texture);
    texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = true;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false;
    const imageSize = texture.image as { width?: number; height?: number } | undefined;
    if (imageSize?.width && imageSize.height) { atlasWidth = imageSize.width; atlasHeight = imageSize.height; }
    texture.needsUpdate = true; surface.map = texture; surface.needsUpdate = true; image.visible = true;
    root.userData.spriteStatus = 'ready'; applyFrame(); if (lastCamera) align(lastCamera); options.onReady?.();
  };
  const failed = (error: unknown) => {
    if (disposed || root.userData.spriteStatus === 'error') return;
    root.userData.spriteStatus = 'error'; options.onError?.(error);
  };
  try {
    const load = options.loadTexture ?? ((url, loaded, error) => new THREE.TextureLoader().load(url, loaded, undefined, error));
    const texture = load((options.resolveAssetUrl ?? appAssetUrl)(options.assetPath ?? '/art/hero-poses-v3.webp'), ready, failed);
    if (texture) { if (disposed) disposeTexture(texture); else managedTextures.add(texture); }
  } catch (error) { failed(error); }
  return rig;
}
