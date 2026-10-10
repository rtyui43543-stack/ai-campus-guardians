import * as THREE from 'three';
import type { Mode } from '../domain/types';
import { getUltimateSpell } from '../content/ultimateSpells';

export const NORMAL_CAST_SECONDS = 2.05;
export const ULTIMATE_CAST_SECONDS = 3;
export const SPELL_IMPACT_SECONDS = .9;
const ORDINARY_LAUNCH_SECONDS = .48;
export const normalSpellNames = ['守護城堡封印', '雷霆書頁', '森葉分類拼圖', '破偽鏡刃', '烈焰火羽', '霜晶冰矛'];
export const ultimateSpellNames = ['守護城堡', '雷霆索引', '萬葉歸位', '鏡界破偽', '智慧火鳳', '寒晶冰矛'];
export const enemySpellNames = {
  starter: ['魔盒鎖鏈', '迷言紙頁', '混淆印章', '幻面碎片', '紙翼突襲', '失序齒片'],
  advanced: ['窺密蛛網', '倒時沙雨', '偏心藤鞭', '偽聲尾影', '捷徑墨滴', '急速雲拳'],
} as const;

export interface SpellFrame {
  time: number;
  success: boolean;
  ultimate: boolean;
  blocked: boolean;
  enemyCritical?: boolean;
  missed?: boolean;
  start: THREE.Vector3;
  target: THREE.Vector3;
  hero: THREE.Vector3;
  enemy: THREE.Vector3;
  scale: number;
  reducedMotion: boolean;
  camera: THREE.Camera;
}
interface Variant { root: THREE.Group; update: (frame: SpellFrame) => void }
const limit = (v: number, low = 0, high = 1) => Math.max(low, Math.min(high, v));
const smooth = (v: number) => { const p = limit(v); return p * p * (3 - 2 * p); };
export const heroSpellColors = [0x32cda8, 0xffce64, 0x80c971, 0xc19df7, 0xff762d, 0x79dfff];
export const heroSpellElements = ['castle-seal', 'book-lightning', 'forest-puzzle', 'mirror', 'fire', 'ice'] as const;
const cream = 0xfff3cb, ink = 0x173a42;

/** Opaque, outlined objects retain their silhouette against a bright campus.
 * No full-screen bloom, white flash, shared light ball or shared laser beam. */
function material(color: number, metal = 0, opacity = 1) {
  return new THREE.MeshStandardMaterial({ color, roughness: .4, metalness: metal,
    emissive: color, emissiveIntensity: .18, side: THREE.DoubleSide,
    transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
}
function group(parent: THREE.Object3D, name: string) {
  const result = new THREE.Group(); result.name = name; parent.add(result); return result;
}
function body(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: number,
  x = 0, y = 0, z = 0, metal = 0, opacity = 1) {
  const result = new THREE.Mesh(geometry, material(color, metal, opacity));
  result.position.set(x, y, z); result.castShadow = false; parent.add(result); return result;
}
function box(parent: THREE.Object3D, width: number, height: number, depth: number, color: number,
  x = 0, y = 0, z = 0, metal = 0, opacity = 1) {
  return body(parent, new THREE.BoxGeometry(width, height, depth), color, x, y, z, metal, opacity);
}
function polygon(parent: THREE.Object3D, points: number[][], color: number, depth = .045) {
  const shape = new THREE.Shape(); points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2); return body(parent, geometry, color);
}
function tube(parent: THREE.Object3D, points: number[][], radius: number, color: number) {
  return body(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z))),
    Math.max(8, points.length * 5), radius, 5, false), color);
}
function leaf(parent: THREE.Object3D, color: number, size = 1) {
  const result = group(parent, 'leaf');
  polygon(result, [[0, -.2], [-.12, -.08], [-.16, .1], [0, .37], [.14, .16], [.12, -.05]], color);
  box(result, .018, .38, .024, cream, 0, .06, .032); result.scale.setScalar(size); return result;
}
function shield(parent: THREE.Object3D, color: number) {
  const result = group(parent, 'faceted-shield');
  polygon(result, [[-.32, .32], [0, .45], [.32, .32], [.26, -.2], [0, -.43], [-.26, -.2]], cream, .10);
  const face = polygon(result, [[-.24, .26], [0, .35], [.24, .26], [.18, -.15], [0, -.32], [-.18, -.15]], color, .09);
  face.position.z = .075;
  tube(result, [[-.13, 0, .13], [-.03, -.11, .13], [.16, .16, .13]], .025, cream);
  return result;
}
function padlock(parent: THREE.Object3D, size = 1) {
  const result = group(parent, 'padlock');
  box(result, .52, .43, .15, 0xf3be4e, 0, -.1, 0, .55);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-.18, .1, 0), new THREE.Vector3(-.18, .38, 0),
    new THREE.Vector3(0, .49, 0), new THREE.Vector3(.18, .38, 0), new THREE.Vector3(.18, .1, 0)]);
  body(result, new THREE.TubeGeometry(curve, 18, .055, 7, false), cream, 0, 0, 0, .5);
  body(result, new THREE.CylinderGeometry(.065, .065, .023, 9), ink, 0, -.05, .09).rotation.x = Math.PI / 2;
  box(result, .06, .12, .022, ink, 0, -.12, .096);
  result.scale.setScalar(size); return result;
}
function chainLink(parent: THREE.Object3D, color: number) {
  const result = group(parent, 'chain-link');
  tube(result, [[-.11, -.05], [-.11, .05], [0, .12], [.11, .05], [.11, -.05], [0, -.12], [-.11, -.05]], .025, color);
  return result;
}
function card(parent: THREE.Object3D, color: number, symbol = 0) {
  const result = group(parent, 'classification-card');
  box(result, .32, .43, .06, cream);
  box(result, .27, .36, .025, color, 0, 0, .045);
  if (symbol % 3 === 0) body(result, new THREE.CircleGeometry(.075, 12), cream, 0, .07, .065);
  else if (symbol % 3 === 1) box(result, .12, .12, .02, cream, 0, .07, .065);
  else { const triangle = polygon(result, [[-.08, 0], [.08, 0], [0, .14]], cream); triangle.position.set(0, .02, .065); }
  box(result, .17, .025, .02, cream, 0, -.105, .065); return result;
}
function thunderPage(parent: THREE.Object3D) {
  const result = group(parent, 'thunder-book-page');
  box(result, .34, .46, .04, cream);
  for (let i = 0; i < 3; i++) box(result, .18, .018, .012, 0xb99668, 0, .09 - i * .08, .03);
  lightning(result, .62).position.set(.18, 0, .075);
  return result;
}
function puzzleLeaf(parent: THREE.Object3D, color: number, symbol = 0) {
  const result = group(parent, 'leaf-puzzle-piece');
  // The projecting tab reads as a jigsaw piece; the leaf connects the ordinary
  // classification spell to its forest-themed ultimate rather than a blue orb.
  polygon(result, [[-.17, -.22], [.17, -.22], [.17, -.07], [.25, -.07], [.28, 0],
    [.25, .07], [.17, .07], [.17, .22], [-.17, .22]], color, .06);
  const sprout = leaf(result, cream, .45); sprout.position.set(0, -.05, .05);
  const mark = card(result, color, symbol); mark.scale.setScalar(.32); mark.position.set(-.14, -.16, .085);
  return result;
}
function mirrorShard(parent: THREE.Object3D, index = 0) {
  const result = group(parent, 'mirror-blade');
  polygon(result, [[-.13, -.32], [-.22, .12], [.02, .37], [.2, .11], [.1, -.23]], 0xbacced, .10);
  const face = polygon(result, [[-.08, -.24], [-.15, .1], [.025, .29], [.135, .09], [.06, -.17]], index % 2 ? 0xe5d2ff : 0xc5f8ee);
  face.position.z = .075;
  tube(result, [[-.10, -.06, .10], [.04, .15, .10]], .018, 0xffffff); return result;
}
function feather(parent: THREE.Object3D, color: number, size = 1) {
  const result = group(parent, 'flame-feather');
  polygon(result, [[0, -.36], [-.15, -.1], [-.19, .13], [-.08, .37], [0, .56], [.13, .29], [.14, .06]], color);
  tube(result, [[0, -.42, .045], [.03, 0, .045], [0, .45, .045]], .022, cream);
  for (let i = 0; i < 4; i++) tube(result, [[.02, -.08 + i * .1, .045], [-.1, i * .1, .045]], .01, 0xffcf68);
  result.scale.setScalar(size); return result;
}
function flame(parent: THREE.Object3D, size = 1) {
  const result = group(parent, 'flame-tongue');
  polygon(result, [[0, -.4], [-.23, -.2], [-.27, .09], [-.15, .36], [-.10, .03],
    [.05, .58], [.14, .32], [.27, .07], [.20, -.2]], 0xf66a22, .07);
  const core = polygon(result, [[0, -.31], [-.12, -.12], [-.09, .06], [.025, .29],
    [.12, .10], [.14, -.09]], 0xffdc62, .045);
  core.position.z = .065;
  result.scale.setScalar(size); return result;
}
function iceShard(parent: THREE.Object3D, size = 1) {
  const result = group(parent, 'ice-crystal-shard');
  polygon(result, [[0, -.32], [-.15, -.03], [-.11, .21], [0, .43], [.15, .11], [.11, -.15]], 0x70caed, .09);
  const facet = polygon(result, [[0, -.32], [0, .43], [.15, .11], [.11, -.15]], 0xbaf3ff, .045);
  facet.position.z = .065;
  tube(result, [[-.10, .16, .10], [0, .43, .10], [.14, .11, .10]], .018, 0xeffbff);
  result.scale.setScalar(size); return result;
}
function iceSpear(parent: THREE.Object3D, size = 1) {
  const result = group(parent, 'frost-crystal-spear');
  polygon(result, [[-.68, -.06], [.38, -.08], [.82, 0], [.38, .08], [-.68, .06], [-.84, 0]], 0x7bd6f4, .10);
  const facet = polygon(result, [[-.84, 0], [.82, 0], [.38, .08], [-.68, .06]], 0xe4faff, .035);
  facet.position.z = .073;
  for (let i = 0; i < 3; i++) { const crystal = iceShard(result, .27); crystal.position.set(-.35 + i * .20, 0, .075); crystal.rotation.z = -Math.PI / 2; }
  result.scale.setScalar(size); return result;
}
/** A left-facing, upright nine-head apparition belongs only to the final boss. */
function spectralHydra(parent: THREE.Object3D) {
  const result = group(parent, 'spectral-dragon-charge');
  result.userData.headCount = 9; result.userData.facing = 'left';
  polygon(result, [[.12, -.20], [.30, .16], [.57, .04], [.73, -.20], [.30, -.36]], 0x7751a5, .12);
  polygon(result, [[.28, -.03], [.78, .56], [.68, .16], [.94, .24], [.68, -.16]], 0xa784d6, .04);
  for (let i = 0; i < 9; i++) {
    const x = -.40 + (i % 3) * .23, y = (Math.floor(i / 3) - 1) * .32;
    tube(result, [[.33, -.17, -.02], [x + .25, y -.08, -.02], [x + .08, y, -.02]], .037, i % 2 ? 0x8a60b9 : 0xb286d8);
    const head = group(result, 'spectral-dragon-head-' + i); head.position.set(x, y, .07 + i % 3 * .025);
    polygon(head, [[.11, -.07], [.13, .08], [-.02, .12], [-.12, .035], [-.23, .005], [-.16, -.08]], i % 2 ? 0xc5a0ed : 0x9f77cd, .055);
    polygon(head, [[.02, .10], [.10, .24], [.13, .07]], 0xf4dfb0, .04);
    box(head, .034, .022, .014, 0xffe78b, -.055, .043, .041);
    tube(head, [[-.20, -.015, .047], [-.11, -.025, .047]], .008, 0x402458);
  }
  return result;
}
function iceBurst(parent: THREE.Object3D, shardCount: number) {
  const result = group(parent, 'frost-shatter-impact');
  const crystals = Array.from({ length: shardCount }, (_, i) => iceShard(result, .50 + (i % 3) * .12));
  const mist = Array.from({ length: 4 }, (_, i) => {
    const patch = body(result, new THREE.CircleGeometry(.45, 18), i % 2 ? 0xc0f0ff : 0x80cbea, 0, 0, -.02, 0, .23);
    patch.name = 'frost-mist'; return patch;
  });
  return { root: result, update(spread: number, reducedMotion: boolean) {
    crystals.forEach((piece, i) => {
      const a = i * 2.4, radius = .13 + spread * (.42 + i % 3 * .08);
      piece.position.set(Math.cos(a) * radius, Math.sin(a) * radius * .75 + spread * .1, .055);
      piece.rotation.z = reducedMotion ? a : a + spread * .75;
      piece.scale.setScalar((.50 + i % 3 * .12) * (1 - spread * .24));
    });
    mist.forEach((piece, i) => { piece.position.set((i - 1.5) * (.15 + spread * .13), -.22 + i % 2 * .10 + spread * .12, -.03);
      piece.scale.set(.8 + spread * .65, .36 + spread * .24, 1); });
  } };
}
function openBook(parent: THREE.Object3D) {
  const result = group(parent, 'open-learning-book');
  for (const side of [-1, 1]) {
    const page = group(result, 'book-page'); page.position.x = side * .22; page.rotation.y = -side * .22;
    box(page, .43, .56, .06, 0xc96a36); box(page, .4, .51, .03, cream, 0, 0, .055);
    for (let i = 0; i < 3; i++) box(page, .26, .021, .01, 0xab875f, 0, .1 - i * .1, .075);
  }
  return result;
}
function branch(parent: THREE.Object3D, color = 0x816246) {
  const result = group(parent, 'growing-branch');
  tube(result, [[0, 0], [.05, .3], [-.05, .6], [.03, .94]], .053, color);
  for (const side of [-1, 1]) {
    tube(result, [[0, .38], [side * .2, .53], [side * .32, .72]], .035, color);
    const sprout = leaf(result, side < 0 ? 0x53bfa0 : 0x9ed27a, .75); sprout.position.set(side * .3, .65, .06); sprout.rotation.z = -side * .48;
  }
  return result;
}
function castle(parent: THREE.Object3D) {
  const result = group(parent, 'guardian-castle');
  box(result, 1.65, .36, .15, 0x246f70, 0, .20, 0, .2);
  for (const x of [-.72, 0, .72]) {
    box(result, .36, x === 0 ? .90 : .73, .25, 0x51cbb2, x, .4, 0, .2);
    for (const offset of [-.13, .13]) box(result, .1, .15, .25, cream, x + offset, x === 0 ? .92 : .82);
    box(result, .09, .19, .02, ink, x, .5, .14);
  }
  const gate = polygon(result, [[-.2, -.01], [-.2, .30], [0, .43], [.2, .30], [.2, -.01]], cream, .03);
  gate.position.z = .15; padlock(result, .45).position.set(0, .17, .2); return result;
}
function lightning(parent: THREE.Object3D, height = 1) {
  const result = polygon(parent, [[-.06, .5], [.20, .5], [.02, .12], [.20, .12], [-.17, -.5], [-.02, -.05], [-.20, -.05]], 0xffcf53, .075);
  result.name = 'branching-lightning'; result.scale.setScalar(height); return result;
}
function mask(parent: THREE.Object3D) {
  const result = group(parent, 'false-mask');
  polygon(result, [[-.37, .16], [-.18, .30], [0, .15], [.18, .3], [.37, .16], [.24, -.13], [0, -.3], [-.24, -.13]], 0xa977c9, .09);
  for (const side of [-1, 1]) box(result, .10, .046, .03, ink, side * .18, .08, .08).rotation.z = side * .22;
  return result;
}
function note(parent: THREE.Object3D, color: number) {
  const result = group(parent, 'voice-note');
  body(result, new THREE.CircleGeometry(.09, 10), color, -.08, -.17, 0);
  box(result, .042, .38, .04, color, 0, .005);
  box(result, .19, .05, .04, color, .07, .2).rotation.z = -.2;
  return result;
}
function droplet(parent: THREE.Object3D, color: number) {
  const result = group(parent, 'ink-drop');
  polygon(result, [[0, .24], [-.12, -.03], [-.1, -.15], [0, -.2], [.13, -.13], [.12, -.03]], color, .08);
  box(result, .025, .08, .01, 0x9585af, -.04, -.055, .052); return result;
}
function cloudFist(parent: THREE.Object3D) {
  const result = group(parent, 'cloud-fist');
  for (let i = 0; i < 5; i++) {
    const puff = body(result, new THREE.IcosahedronGeometry(.19, 1), 0xd7f0ff, (i % 3 - 1) * .20, i < 3 ? .10 : -.12, 0);
    puff.scale.set(1, .95, .8);
  }
  box(result, .19, .23, .11, 0xe9f6ff, .26, -.03, .09); return result;
}
function gear(parent: THREE.Object3D) {
  const result = group(parent, 'gear-fragment');
  body(result, new THREE.CylinderGeometry(.22, .22, .07, 10), 0xe2b65c).rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) { const tooth = box(result, .10, .11, .08, 0xffd579, Math.cos(i * Math.PI / 4) * .23, Math.sin(i * Math.PI / 4) * .23); tooth.rotation.z = i * Math.PI / 4; }
  body(result, new THREE.CircleGeometry(.095, 10), ink, 0, 0, .05); return result;
}

function ritualRing(parent: THREE.Object3D, name: string, color: number, radius = .8) {
  const result = group(parent, name);
  const points = Array.from({ length: 17 }, (_, i) => [Math.cos(i * Math.PI / 8) * radius,
    Math.sin(i * Math.PI / 8) * radius, .025]);
  tube(result, points, .023, color);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const rune = box(result, .095, .045, .03, cream, Math.cos(a) * radius, Math.sin(a) * radius, .045);
    rune.rotation.z = a;
  }
  return result;
}

function impactWave(parent: THREE.Object3D, name: string, color: number) {
  const result = group(parent, name);
  for (let i = 0; i < 3; i++) {
    const radius = .38 + i * .15;
    const points = Array.from({ length: 17 }, (_, n) => [Math.cos(n * Math.PI / 8) * radius,
      Math.sin(n * Math.PI / 8) * radius * .32, .025]);
    tube(result, points, .025, i === 1 ? cream : color);
  }
  return result;
}

function anchor(object: THREE.Object3D, point: THREE.Vector3, frame: SpellFrame, size = 1) {
  object.position.copy(point); object.position.z = .85;
  object.quaternion.copy(frame.camera.quaternion); object.scale.setScalar(frame.scale * size);
}
function path(frame: SpellFrame, output = new THREE.Vector3(), offset = 0) {
  const p = smooth((frame.time - .42 - offset) / (.48 - offset));
  output.copy(frame.start).lerp(frame.target, p);
  output.y += Math.sin(p * Math.PI) * .20 * frame.scale;
  output.y = Math.min(output.y, 2.70 * frame.scale);
  return output;
}
/** Ordinary projectiles gain speed into contact; ultimate choreography retains its own path. */
function ordinaryPath(frame: SpellFrame, output = new THREE.Vector3(), offset = 0) {
  const p = frame.reducedMotion ? frame.time < ORDINARY_LAUNCH_SECONDS ? 0 : 1
    : Math.pow(limit((frame.time - ORDINARY_LAUNCH_SECONDS - offset) / (SPELL_IMPACT_SECONDS - ORDINARY_LAUNCH_SECONDS - offset)), 1.55);
  output.copy(frame.start).lerp(frame.target, p);
  output.y += Math.sin(p * Math.PI) * .13 * frame.scale;
  output.y = Math.min(output.y, 2.70 * frame.scale);
  return output;
}
function heldOrdinaryFrame(frame: SpellFrame): SpellFrame {
  // Keep one static pose per phase instead of racing the new secondary motion.
  return frame.reducedMotion ? { ...frame, time: frame.time < ORDINARY_LAUNCH_SECONDS ? .20 : frame.time < .9 ? .70 : 1.28 } : frame;
}
function impactAge(frame: SpellFrame, end = 1.72) { return limit((frame.time - SPELL_IMPACT_SECONDS) / (end - SPELL_IMPACT_SECONDS)); }
function visibleDuring(frame: SpellFrame, from: number, end: number) { return frame.time >= from && frame.time < end; }
function animateOrbit(pieces: THREE.Group[], frame: SpellFrame, center: THREE.Vector3, radius: number, spin: number,
  birth = .05, death = 1.65) {
  pieces.forEach((piece, i) => {
    piece.visible = visibleDuring(frame, birth, death);
    const a = i * Math.PI * 2 / pieces.length + (frame.reducedMotion ? 0 : frame.time * spin);
    const point = center.clone(); point.x += Math.cos(a) * radius * frame.scale; point.y += Math.sin(a) * radius * frame.scale;
    anchor(piece, point, frame); if (!frame.reducedMotion) piece.rotateZ(a * .28);
  });
}

type AttackMotif = 'seal' | 'lightning' | 'leaf' | 'mirror' | 'ember' | 'ice' | 'paper' | 'sand' | 'ink' | 'cloud' | 'gear' | 'web';
const attackMotifs: Record<AttackMotif, number[][]> = {
  seal: [[-.10, -.13], [.10, -.13], [.10, .08], [.05, .15], [-.05, .15], [-.10, .08]],
  lightning: [[-.04, -.19], [.11, .035], [.025, .035], [.08, .19], [-.11, -.02], [-.025, -.02]],
  leaf: [[0, -.17], [-.11, -.04], [-.08, .09], [.02, .20], [.10, .06], [.09, -.06]],
  mirror: [[-.07, -.20], [-.12, .06], [.045, .18], [.13, -.015]],
  ember: [[0, -.15], [-.11, -.04], [-.10, .10], [-.02, .025], [.05, .23], [.12, .02], [.09, -.09]],
  ice: [[0, -.23], [-.095, -.035], [-.055, .16], [.025, .26], [.095, .015]],
  paper: [[-.13, -.15], [.11, -.11], [.15, .14], [-.09, .18]],
  sand: [[0, -.11], [-.10, 0], [0, .13], [.10, 0]],
  ink: [[0, .20], [-.105, -.015], [-.085, -.115], [.02, -.15], [.115, -.05]],
  cloud: [[-.15, -.075], [-.17, .03], [-.095, .105], [-.025, .075], [.04, .145], [.14, .08], [.17, -.055], [.09, -.12]],
  gear: [[-.07, -.14], [.055, -.14], [.055, -.06], [.14, -.06], [.14, .06], [.06, .06], [.06, .14], [-.06, .14], [-.06, .06], [-.14, .06], [-.14, -.06], [-.07, -.06]],
  web: [[0, -.18], [-.055, -.05], [-.18, 0], [-.055, .05], [0, .18], [.055, .05], [.18, 0], [.055, -.05]],
};

/** Pooled accents make an ordinary cast read as charge → flight → contact.
 * Stronger local trails and contact rays retain the elemental silhouette,
 * without lights, screen flashes, per-frame geometry or changes to hit timing. */
function ordinaryAttackAccents(parent: THREE.Object3D, color: number, motif: AttackMotif) {
  const root = group(parent, 'ordinary-attack-accents');
  root.userData.motif = motif;
  const charge = group(root, 'ordinary-charge'), trail = group(root, 'ordinary-trail');
  const impact = group(root, 'ordinary-contact');
  const template = polygon(charge, attackMotifs[motif], color, .025);
  template.material.emissiveIntensity = .42;
  const charges = [template, ...Array.from({ length: 5 }, () => {
    const part = new THREE.Mesh(template.geometry, template.material); charge.add(part); return part;
  })];
  const streakGeometry = new THREE.PlaneGeometry(.42, .065);
  const streakMaterial = material(color, 0, .72);
  const streaks = Array.from({ length: 6 }, () => {
    const part = new THREE.Mesh(streakGeometry, streakMaterial); trail.add(part); return part;
  });
  const fragments = Array.from({ length: 12 }, () => {
    const part = new THREE.Mesh(template.geometry, template.material); impact.add(part); return part;
  });
  const waveMaterial = material(color, 0, .7);
  const waveGeometry = new THREE.TorusGeometry(.48, .027, 4, 24, Math.PI * 1.65);
  const waves = Array.from({ length: 2 }, () => {
    const part = new THREE.Mesh(waveGeometry, waveMaterial); impact.add(part); return part;
  });
  const emphasis = group(impact, 'ordinary-hit-rays');
  const rayGeometry = new THREE.PlaneGeometry(.54, .08);
  const rayMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const rays = Array.from({ length: 8 }, () => {
    const part = new THREE.Mesh(rayGeometry, rayMaterial); emphasis.add(part); return part;
  });
  const chargeHalo = new THREE.Mesh(new THREE.TorusGeometry(.32, .025, 4, 24), rayMaterial);
  chargeHalo.name = 'ordinary-charge-halo'; charge.add(chargeHalo);
  // Reused scratch vectors avoid per-frame vector allocation in the accent layer.
  const flightPoint = new THREE.Vector3(), direction = new THREE.Vector3();
  return { root, update(f: SpellFrame) {
    const ordinary = !f.enemyCritical;
    // The existing enemy critical choreography keeps its original accent size.
    template.material.emissiveIntensity = ordinary ? .7 : .42;
    const prepare = f.reducedMotion ? .6 : smooth(f.time / ORDINARY_LAUNCH_SECONDS);
    anchor(charge, f.start, f); charge.visible = visibleDuring(f, .02, .50);
    charges.forEach((part, i) => {
      const angle = i * Math.PI / 3 + (f.reducedMotion ? 0 : f.time * 1.2);
      const radius = .50 - prepare * .21;
      part.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, -.03);
      part.rotation.z = angle; part.scale.setScalar((.65 + prepare * .55) * (ordinary ? 1.18 : 1));
    });
    chargeHalo.visible = ordinary;
    chargeHalo.scale.setScalar(f.reducedMotion ? 1.3 : 1.55 - prepare * .4);
    chargeHalo.position.z = -.05;
    trail.visible = !f.reducedMotion && visibleDuring(f, ORDINARY_LAUNCH_SECONDS, SPELL_IMPACT_SECONDS);
    ordinaryPath(f, flightPoint); direction.copy(f.target).sub(f.start).normalize();
    const angle = Math.atan2(direction.y, direction.x);
    streaks.forEach((part, i) => {
      const lag = .22 + Math.floor(i / 2) * .25;
      const side = (i % 2 ? 1 : -1) * (.11 + Math.floor(i / 2) * .055);
      part.position.copy(flightPoint).addScaledVector(direction, -lag * f.scale);
      part.position.x -= direction.y * side * f.scale; part.position.y += direction.x * side * f.scale;
      part.position.z = .81; part.quaternion.copy(f.camera.quaternion); part.rotateZ(angle);
      part.scale.set(f.scale * (1.05 - i * .06) * (ordinary ? 1.55 : 1),
        f.scale * (1 - i * .06) * (ordinary ? 1.45 : 1), f.scale);
    });
    const spread = f.reducedMotion ? .62 : smooth((f.time - SPELL_IMPACT_SECONDS) / .62);
    anchor(impact, f.target, f); impact.visible = visibleDuring(f, SPELL_IMPACT_SECONDS, 1.88);
    fragments.forEach((part, i) => {
      const angle = i * Math.PI / 6 + .15, radius = .22 + spread * (.52 + i % 3 * .08) * (ordinary ? 1.3 : 1);
      part.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * .78, .03);
      part.rotation.z = angle + (f.reducedMotion ? 0 : spread * .45);
      part.scale.setScalar((i % 2 ? .80 : 1.12) * (1 - spread * .35) * (ordinary ? 1.25 : 1));
    });
    waves.forEach((part, i) => {
      const scale = (.62 + spread * 1.45 + i * .20) * (ordinary ? 1.18 : 1);
      part.scale.set(scale, scale * .72, 1); part.rotation.z = i * Math.PI;
      part.position.z = -.035 - i * .012;
    });
    emphasis.visible = ordinary && !f.blocked && !f.missed && visibleDuring(f, SPELL_IMPACT_SECONDS, f.reducedMotion ? 1.88 : 1.55);
    const contact = f.reducedMotion ? .4 : smooth((f.time - SPELL_IMPACT_SECONDS) / .48);
    rays.forEach((part, i) => {
      const angle = i * Math.PI / 4 + .12, radius = .20 + contact * .86;
      part.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * .83, .075);
      part.rotation.z = angle; part.scale.set(1.1 - contact * .2, 1 - contact * .5, 1);
    });
    rayMaterial.blending = f.reducedMotion ? THREE.NormalBlending : THREE.AdditiveBlending;
    rayMaterial.opacity = f.reducedMotion ? .35 : .9 * (1 - contact);
    waveMaterial.opacity = f.reducedMotion ? .38 : .7 * (1 - smooth((f.time - 1.25) / .6));
  } };
}

function normalVariant(parent: THREE.Object3D, theme: number): Variant {
  const root = group(parent, `normal-${theme}`); root.userData.identity = normalSpellNames[theme - 1];
  root.userData.element = heroSpellElements[theme - 1];
  const accents = ordinaryAttackAccents(root, heroSpellColors[theme - 1],
    (['seal', 'lightning', 'leaf', 'mirror', 'ember', 'ice'] as const)[theme - 1]);
  const moving = group(root, 'normal-projectile'), landing = group(root, 'normal-impact');
  let update: Variant['update'];
  if (theme === 1) {
    moving.userData.role = 'lead';
    const keep = castle(moving); keep.scale.setScalar(.55); keep.position.y = -.12;
    padlock(moving, .78).position.set(0, .05, .21);
    const seals = [padlock(landing, .75), padlock(landing, .65), padlock(landing, .65)];
    seals[1].position.set(-.45, .17, -.03); seals[2].position.set(.45, .17, -.03);
    const chain = Array.from({ length: 14 }, () => chainLink(root, 0xebc368));
    update = f => {
      anchor(moving, ordinaryPath(f), f, 1.10); moving.visible = visibleDuring(f, .08, .9);
      anchor(landing, f.target, f); landing.visible = visibleDuring(f, .9, 1.78); landing.scale.multiplyScalar(.65 + smooth((f.time - .9) / .25) * .65);
      const p = f.reducedMotion ? 1 : smooth((f.time - .9) / .24);
      chain.forEach((link, i) => { link.visible = visibleDuring(f, .9, 1.65); const a = i * Math.PI * 2 / chain.length;
        const point = f.target.clone(); point.x += Math.cos(a) * (.86 - .25 * p) * f.scale;
        point.y += Math.sin(a) * (.72 - .18 * p) * f.scale; anchor(link, point, f); link.rotateZ(a); });
    };
  } else if (theme === 2) {
    const pages = Array.from({ length: 5 }, () => thunderPage(root));
    openBook(landing).scale.setScalar(1.05);
    const bolts = Array.from({ length: 3 }, () => lightning(landing, .75));
    bolts.forEach((piece, i) => piece.position.set((i - 1) * .34, .25, .1 + i * .025));
    update = f => {
      pages.forEach((piece, i) => { piece.visible = visibleDuring(f, .15 + i * .035, 1.08);
        const point = ordinaryPath(f, new THREE.Vector3(), i * .025);
        point.x -= i * .12 * f.scale; point.y += (i === 0 ? 0 : (i % 2 ? 1 : -1) * (.13 + i * .035)) * f.scale;
        anchor(piece, point, f, i === 0 ? 1.05 : .52); piece.userData.role = i === 0 ? 'lead' : 'companion';
        piece.rotateZ(i === 0 ? -.08 : (i % 2 ? 1 : -1) * .22); });
      anchor(landing, f.target, f, 1.2); landing.visible = visibleDuring(f, .9, 1.82);
      landing.scale.multiplyScalar(.75 + .25 * smooth((f.time - .9) / .15));
      moving.visible = false;
    };
  } else if (theme === 3) {
    const cards = Array.from({ length: 9 }, (_, i) => puzzleLeaf(root, [0x54b68d, 0xf1ba58, 0x8dca70][i % 3], i));
    const leaves = Array.from({ length: 6 }, (_, i) => leaf(root, i % 2 ? 0x68bf8e : 0xb2d96d, .64));
    for (let i = 0; i < 3; i++) { box(landing, .5, .10, .16, [0x54b68d, 0xf1ba58, 0x8dca70][i], (i - 1) * .52, -.5); }
    update = f => {
      const settled = smooth((f.time - .9) / .18), center = ordinaryPath(f);
      cards.forEach((piece, i) => { piece.visible = visibleDuring(f, .05, 1.82);
        const point = center.clone(), row = Math.ceil(i / 2);
        point.x += THREE.MathUtils.lerp(-row * .15, (i % 3 - 1) * .36, settled) * f.scale;
        point.y += THREE.MathUtils.lerp(i === 0 ? 0 : (i % 2 ? 1 : -1) * row * .10, Math.floor(i / 3) * .26 - .26, settled) * f.scale;
        anchor(piece, point, f, i === 0 ? .93 : .53); piece.userData.role = i === 0 ? 'lead' : 'companion';
        piece.rotateZ((1 - settled) * (i % 2 ? .18 : -.18));
      });
      animateOrbit(leaves, f, center, .48, .7, .1, 1.82);
      anchor(landing, f.target, f); landing.visible = visibleDuring(f, .9, 1.86); moving.visible = false;
    };
  } else if (theme === 4) {
    const blades = Array.from({ length: 5 }, (_, i) => mirrorShard(root, i));
    const falseFace = mask(landing);
    update = f => {
      const p = impactAge(f), center = ordinaryPath(f);
      blades.forEach((piece, i) => { piece.visible = visibleDuring(f, .1, 1.85);
        const a = i * Math.PI * 2 / blades.length, point = center.clone();
        point.x += (f.time < .9 ? -i * .12 : Math.cos(a) * (.2 + p * .60)) * f.scale;
        point.y += (f.time < .9 ? i === 0 ? 0 : (i % 2 ? 1 : -1) * .13 : Math.sin(a) * (.2 + p * .60)) * f.scale;
        anchor(piece, point, f, i === 0 ? 1.05 : .52); piece.userData.role = i === 0 ? 'lead' : 'companion';
        piece.rotateZ(f.time < .9 ? -Math.PI / 2 : a + p * .7); });
      anchor(landing, f.target, f, 1.40); landing.visible = visibleDuring(f, .9, 1.60);
      falseFace.scale.set(1 + p * .7, 1 - p * .75, 1); falseFace.rotation.z = f.reducedMotion ? 0 : p * .5;
      moving.visible = false;
    };
  } else if (theme === 5) {
    const flight = Array.from({ length: 7 }, (_, i) => {
      const plume = group(root, 'flaming-feather-projectile');
      feather(plume, i % 2 ? 0xffbd45 : 0xf5712d, .82).rotation.z = -Math.PI / 2;
      const tongue = flame(plume, .65); tongue.position.set(-.32, .015, -.04); tongue.rotation.z = -Math.PI / 2;
      return plume;
    });
    const scorch = group(landing, 'fire-feather-impact');
    const flames = Array.from({ length: 8 }, () => flame(scorch, .68));
    const cinders = Array.from({ length: 10 }, (_, i) => feather(landing, i % 2 ? 0xffc34f : 0xf36c23, .35));
    update = f => {
      const spread = impactAge(f, 1.86);
      flight.forEach((piece, i) => { piece.visible = visibleDuring(f, .06 + i * .035, .97);
        const point = ordinaryPath(f, new THREE.Vector3(), i * .025);
        point.x -= i * .09 * f.scale; point.y += Math.sin(i * .8) * .16 * f.scale;
        anchor(piece, point, f, i === 0 ? 1.02 : .50); piece.userData.role = i === 0 ? 'lead' : 'companion';
        piece.rotateZ(i === 0 ? 0 : (i - 3) * .075); });
      anchor(landing, f.target, f); landing.visible = visibleDuring(f, .9, 1.88);
      flames.forEach((piece, i) => {
        const a = i * Math.PI * 2 / flames.length;
        piece.position.set(Math.cos(a) * (.15 + spread * .40), Math.sin(a) * (.17 + spread * .40) + spread * .26, .04);
        piece.rotation.z = -a + Math.PI / 2;
        piece.scale.setScalar(.45 + (1 - spread) * .55);
      });
      cinders.forEach((piece, i) => {
        const a = i * 2.4;
        piece.position.set(Math.cos(a) * (.30 + spread * .6), Math.sin(a) * (.28 + spread * .42) + spread * .38, .1);
        piece.rotation.z = a; piece.scale.setScalar(.34 * (1 - spread * .55));
      });
      moving.visible = false;
    };
  } else {
    const spears = Array.from({ length: 5 }, () => iceSpear(root, .72));
    const shatter = iceBurst(landing, 12);
    update = f => {
      spears.forEach((piece, i) => { piece.visible = visibleDuring(f, .08 + i * .035, .98);
        const point = ordinaryPath(f, new THREE.Vector3(), i * .025);
        point.x -= i * .12 * f.scale; point.y += (i === 0 ? 0 : (i % 2 ? 1 : -1) * (.12 + i * .025)) * f.scale;
        anchor(piece, point, f, i === 0 ? .75 : .47); piece.userData.role = i === 0 ? 'lead' : 'companion'; });
      anchor(landing, f.target, f); landing.visible = visibleDuring(f, .9, 1.88);
      shatter.update(f.reducedMotion ? .65 : impactAge(f, 1.88), f.reducedMotion); moving.visible = false;
    };
  }
  return { root, update(frame) { const f = heldOrdinaryFrame(frame); update(f); accents.update(f); } };
}

/** Card-matched versions are ultimate-only: ordinary attacks retain their art. */
const cardGold = 0xe6c36b;
function polishCardObject<T extends THREE.Object3D>(root: T): T {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const m = node.material as THREE.MeshStandardMaterial;
    // The card's metal is a rim, not an opaque glow over the illustrated form.
    if (m.color.getHex() === cardGold) m.metalness = .65;
    m.roughness = m.metalness > .4 ? .22 : .34;
    m.emissiveIntensity = m.transparent ? .10 : .08;
  });
  return root;
}
function cardCastleSeal(parent: THREE.Object3D, advanced: boolean, size = 1) {
  const result = group(parent, 'card-castle-seal');
  result.userData.cardMaterial = advanced ? 'ivory-gold-sky-dome' : 'transparent-crystal-gold';
  polygon(result, [[-.32,.30],[0,.40],[.32,.30],[.27,-.16],[0,-.39],[-.27,-.16]], cardGold, .10);
  const face = polygon(result, [[-.25,.25],[0,.32],[.25,.25],[.20,-.12],[0,-.30],[-.20,-.12]], advanced ? 0x2d6883 : 0x83cabb, .04);
  face.position.z = .08;
  if (advanced) {
    const points = Array.from({length:10}, (_, i) => {
      const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .065 : .17;
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
    polygon(result, points, cream, .025).position.z = .12;
  } else {
    body(result, new THREE.CircleGeometry(.065, 12), 0x426659, 0, .045, .12);
    polygon(result, [[-.035,.025],[.035,.025],[.06,-.12],[-.06,-.12]], 0x426659, .025).position.z = .12;
  }
  result.scale.setScalar(size);
  return polishCardObject(result);
}
function cardCastle(parent: THREE.Object3D, advanced: boolean) {
  const result = group(parent, 'guardian-castle');
  result.userData.cardMaterial = advanced ? 'ivory-gold-sky-dome' : 'transparent-crystal-gold';
  box(result, 1.65, .40, .15, advanced ? 0xf2e2b6 : 0x73dece, 0, .2, 0, .15, advanced ? 1 : .46);
  tube(result,[[-.825,0,.10],[-.825,.40,.10],[.825,.40,.10],[.825,0,.10],[-.825,0,.10]],.012,cardGold);
  for (const x of [-.72, -.36, 0, .36, .72]) {
    const top = 1.08 - Math.abs(x)*.55;
    box(result, .30, top, .24, advanced ? 0xffebc1 : 0x72e4d6, x, top*.5, 0, .16, advanced ? 1 : .60);
    const roof = body(result, new THREE.ConeGeometry(.23, .42, 6), advanced ? 0x206c93 : 0x29b6cf, x, top+.20, 0, .45);
    roof.name = 'card-pointed-tower';
    tube(result,[[x-.15,0,.13],[x-.15,top,.13],[x+.15,top,.13],[x+.15,0,.13]],.011,cardGold);
    box(result,.018,top,.015,cream,x-.10,top*.5,.135);
    box(result,.30,.018,.018,cardGold,x,top*.42,.14,.65);
    box(result,.065,.18,.025,0x286679,x,top-.23,.15);
    body(result,new THREE.OctahedronGeometry(.035),cream,x,top+.43,0,.55);
    if (advanced) box(result,.075,.24,.012,0x15557f,x,top-.51,.15);
  }
  cardCastleSeal(result,advanced,.70).position.set(0,.42,.22);
  if (advanced) {
    const dome = body(result, new THREE.SphereGeometry(1.22,16,8,0,Math.PI*2,0,Math.PI/2),0x8de6ff,0,.05,0,0,.09);
    dome.name='card-sky-dome';
    const rim = body(result,new THREE.TorusGeometry(1.22,.012,4,24),0xc7f4ff,0,.05,0,0,.75); rim.rotation.x=Math.PI/2;
    for (const z of [-.50,.50]) {
      const r = Math.sqrt(1.22**2-z**2);
      tube(result,Array.from({length:13},(_,i)=>[Math.cos(i*Math.PI/12)*r,.05+Math.sin(i*Math.PI/12)*r,z]),.010,0xbcefff);
    }
    const island=polygon(result,[[-.90,0],[.90,0],[.65,-.22],[.28,-.20],[0,-.38],[-.32,-.21],[-.66,-.24]],0x739c8b,.18); island.position.y=-.06;
  }
  return polishCardObject(result);
}
function cardIndexBook(parent: THREE.Object3D) {
  const result = group(parent,'card-navy-index-book');
  result.userData.cardMaterial='navy-leather-gold-ivory-pages';
  for (const side of [-1,1]) {
    const page=group(result,'book-page');page.position.x=side*.22;page.rotation.y=-side*.22;
    box(page,.43,.56,.07,0x183960,0,0,0,.10);
    box(page,.40,.51,.05,0xf7e8c3,0,.01,.06);
    tube(page,[[-.20,-.26,.05],[-.20,.26,.05],[.20,.26,.05],[.20,-.26,.05],[-.20,-.26,.05]],.010,cardGold);
    for (let i=0;i<4;i++) box(page,.31,.009,.012,0xbb9b65,0,-.23+i*.012,.090);
    for (let i=0;i<4;i++) box(page,.26-i%2*.025,.012,.010,0xb8a07a,0,.14-i*.075,.095);
    const bookmark=box(page,.035,.08,.016,side<0?0x81b798:0xd49a49,side*.13,.28,.075);bookmark.rotation.z=-side*.13;
  }
  box(result,.022,.58,.08,cardGold,0,0,.07,.60);
  const lens=group(result,'card-book-magnifier');
  body(lens,new THREE.CircleGeometry(.09,16),0x609abb,0,0,.115,.15,.35);
  body(lens,new THREE.TorusGeometry(.105,.016,5,16),cardGold,0,0,.12,.65);
  box(lens,.03,.15,.02,cardGold,-.10,-.13,.12,.65).rotation.z=-.6;
  tube(lens,[[-.04,.03,.14],[.02,.065,.14],[.055,.035,.14]],.006,0xe9faff);
  lens.position.set(.20,-.03,.02);
  return polishCardObject(result);
}
function cardFramedMirror(parent: THREE.Object3D) {
  const result=group(parent,'card-gemmed-oval-mirror');
  result.userData.cardMaterial='beveled-gold-prism-mirror';
  const outer=body(result,new THREE.CircleGeometry(.33,24),cardGold,0,0,0,.68);outer.scale.y=1.7;
  const bevel=body(result,new THREE.TorusGeometry(.31,.016,5,24),cream,0,0,.025,.45);bevel.scale.y=1.7;
  const glass=body(result,new THREE.CircleGeometry(.285,24),0xa6ddee,0,0,.045,.20,.62);glass.scale.y=1.68;
  for(const [x,y] of [[0,-.52],[0,.52],[-.32,0],[.32,0]]) {
    const jewel=body(result,new THREE.OctahedronGeometry(.072),0xab87dd,x,y,.075,.34);jewel.scale.set(.8,1.35,.5);
  }
  tube(result,[[-.18,-.15,.07],[.12,.29,.07]],.009,0xf0fcff);
  tube(result,[[-.08,-.28,.07],[.21,.15,.07]],.007,0xe8ebff);
  tube(result,[[-.11,0,.09],[-.02,-.10,.09],[.15,.13,.09]],.022,cream);
  return polishCardObject(result);
}
function cardLeafPuzzle(parent: THREE.Object3D, index:number) {
  const result=group(parent,'card-botanical-puzzle');
  result.userData.cardMaterial='gold-edged-leaf-crystal';
  const points=[[-.2,-.2],[.2,-.2],[.2,-.06],[.28,-.06],[.30,0],[.28,.06],[.2,.06],[.2,.2],[.05,.2],[.05,.28],[-.05,.28],[-.05,.2],[-.2,.2]];
  polygon(result,points,cardGold,.035);
  const crystal=polygon(result,points.map(([x,y])=>[x*.88,y*.88]),index%3===2?0xdfc65e:0x80d6b0,.025);crystal.position.z=.025;
  const m=crystal.material as THREE.MeshStandardMaterial;m.transparent=true;m.opacity=.65;m.depthWrite=false;
  const sprout=leaf(result,index%3===2?0x97a148:0x39804a,.54);sprout.position.set(0,-.02,.05);
  for (const side of [-1,1]) tube(sprout,[[0,-.02,.055],[side*.065,.06,.055],[side*.09,.16,.055]],.010,cardGold);
  tube(result,[[-.17,.17,.052],[-.06,.17,.052]],.009,0xf0ffe6);
  return polishCardObject(result);
}
function cardMirrorShard(parent:THREE.Object3D,index=0) {
  const result=mirrorShard(parent,index);
  result.userData.cardMaterial='beveled-gold-prism-mirror';
  const meshes=result.children.filter(child=>child instanceof THREE.Mesh) as THREE.Mesh[];
  const rim=meshes[0].material as THREE.MeshStandardMaterial;rim.color.setHex(cardGold);rim.metalness=.65;
  const glass=meshes[1].material as THREE.MeshStandardMaterial;glass.transparent=true;glass.opacity=.72;glass.depthWrite=false;
  return polishCardObject(result);
}
function cardThunderPage(parent:THREE.Object3D) {
  const result=thunderPage(parent);
  result.userData.cardMaterial='navy-leather-gold-ivory-pages';
  box(result,.030,.08,.014,cardGold,.10,.21,.04,.55);
  result.traverse(node=> {if(node instanceof THREE.Mesh && node.name==='branching-lightning') {
    const m=node.material as THREE.MeshStandardMaterial;m.color.setHex(0xc4f1ff);m.emissive.setHex(0x77cfff);
  }});
  return polishCardObject(result);
}
function cardLightning(parent:THREE.Object3D,height=1) {
  const result=lightning(parent,height),m=result.material as THREE.MeshStandardMaterial;
  m.color.setHex(0xc4f1ff);m.emissive.setHex(0x77cfff);m.emissiveIntensity=.12;
  return result;
}

function ultimateVariant(parent: THREE.Object3D, theme: number, mode: Mode): Variant {
  const root = group(parent, `ultimate-${theme}`);
  root.userData.identity = getUltimateSpell(theme, mode)?.name ?? ultimateSpellNames[theme - 1];
  root.userData.tier = mode;
  root.userData.element = heroSpellElements[theme - 1];
  const formation = group(root, 'ultimate-formation'), strike = group(root, 'ultimate-strike');
  let update: Variant['update'];
  if (theme === 1) {
    root.userData.sequence = 'castle-shield-emblem-flight-seal-impact';
    const fortress = cardCastle(formation, mode === 'advanced'); fortress.name = 'summoned-castle-shield';
    const shields = Array.from({ length: mode === 'advanced' ? 7 : 5 }, () => shield(root, 0x49bda0));
    const crest = group(strike, 'castle-emblem-projectile');
    shield(crest, 0x2ab99c).scale.setScalar(1.55);
    const flyingKeep = cardCastle(crest, mode === 'advanced'); flyingKeep.scale.setScalar(.46); flyingKeep.position.set(0, -.10, .23);
    cardCastleSeal(crest, mode === 'advanced', .58).position.set(0, -.20, .32);
    const impact = group(root, 'castle-seal-impact');
    const seal = cardCastleSeal(impact, mode === 'advanced', 1.4);
    const fragments = Array.from({ length: mode === 'advanced' ? 16 : 12 }, (_, i) => {
      const token = group(impact, 'castle-crest-fragment');
      cardCastleSeal(token, mode === 'advanced', .30);
      return token;
    });
    const wave = impactWave(root, 'castle-seal-shockwave', 0x53bfa6);
    update = f => {
      const point = f.hero.clone(); point.y += .10 * f.scale; anchor(formation, point, f, mode === 'advanced' ? 1.30 : 1.15);
      formation.visible = visibleDuring(f, .04, 2.80); formation.scale.y *= f.reducedMotion ? 1 : .30 + .7 * smooth(f.time / .36);
      const center = f.hero.clone(); center.y += 1.3 * f.scale;
      animateOrbit(shields, f, center, mode === 'advanced' ? 1 : .90, .45, .10, 2.8);
      // The hero's fortress is established before the gate launches the crest.
      anchor(strike, f.reducedMotion ? f.target : path(f), f, mode === 'advanced' ? 1.45 : 1.20);
      strike.visible = visibleDuring(f, .42, 1.04);
      if (!f.reducedMotion) strike.rotateZ(Math.sin(limit((f.time - .42) / .48) * Math.PI) * -.18);
      const spread = f.reducedMotion ? .65 : smooth((f.time - .9) / .70);
      anchor(impact, f.target, f, mode === 'advanced' ? 1.25 : 1.10); impact.visible = visibleDuring(f, .9, 2.80);
      seal.scale.setScalar(1.20 - spread * .20);
      fragments.forEach((piece, i) => {
        const a = i * Math.PI * 2 / fragments.length, radius = .28 + spread * .80;
        piece.position.set(Math.cos(a) * radius, Math.sin(a) * radius * .75, .10);
        piece.rotation.z = a + (f.reducedMotion ? 0 : spread * .55);
      });
      const ground = f.target.clone(); ground.y -= .48 * f.scale;
      anchor(wave, ground, f, 1 + spread * .90); wave.visible = visibleDuring(f, .9, 2.80);
    };
  } else if (theme === 2 && mode === 'starter') {
    root.userData.sequence = 'thunder-book-charge-index-flight-lightning-impact';
    const book = cardIndexBook(formation); book.scale.setScalar(1.45);
    const array = ritualRing(formation, 'thunder-index-summoning-array', 0xe3bb5a, .78);
    const index = group(strike, 'colossal-thunder-index');
    cardIndexBook(index).scale.setScalar(2.0);
    const scrolls = Array.from({ length: 5 }, () => cardThunderPage(index));
    scrolls.forEach((page, i) => {
      page.position.set(-.55 - i * .12, (i - 2) * .19, .14);
      page.rotation.z = (i - 2) * .25; page.scale.setScalar(1.25);
    });
    const impact = group(root, 'thunder-index-impact');
    const bolts = Array.from({ length: 7 }, (_, i) => cardLightning(impact, i === 0 ? 1.75 : 1.05));
    bolts.forEach((bolt, i) => {
      bolt.position.set((i % 3 - 1) * .40, Math.floor(i / 3) * .31 - .25, i * .018);
      bolt.rotation.z = (i % 3 - 1) * .65;
    });
    const pages = Array.from({ length: 18 }, () => cardThunderPage(impact));
    const wave = impactWave(root, 'thunder-index-page-wave', 0xe6b94e);
    update = f => {
      anchor(formation, f.start, f, 1.10); formation.visible = visibleDuring(f, .02, .70);
      if (!f.reducedMotion) { array.rotation.z = f.time * .60; book.rotation.y = Math.sin(f.time * 4) * .20; }
      anchor(strike, f.reducedMotion ? f.target : path(f), f, 1.12);
      strike.visible = visibleDuring(f, .30, 1.04);
      if (!f.reducedMotion) strike.rotateZ(Math.sin(limit((f.time - .42) / .48) * Math.PI) * -.20);
      anchor(impact, f.target, f); impact.visible = visibleDuring(f, .9, 2.80);
      const spread = f.reducedMotion ? .60 : smooth((f.time - .9) / .75);
      bolts.forEach((bolt, i) => { bolt.scale.setScalar((i === 0 ? 1.75 : 1.05) * (.80 + .20 * (1 - spread))); });
      pages.forEach((page, i) => {
        const a = i * 2.4, radius = .22 + spread * (.66 + i % 3 * .08);
        page.position.set(Math.cos(a) * radius, Math.sin(a) * radius * .76, .12);
        page.rotation.z = f.reducedMotion ? a : a + spread * .80;
        page.scale.setScalar(.55 - spread * .12);
      });
      const ground = f.target.clone(); ground.y -= .48 * f.scale;
      anchor(wave, ground, f, .95 + spread * .95); wave.visible = visibleDuring(f, .9, 2.80);
    };
  } else if (theme === 2) {
    const pages = Array.from({ length: 8 }, () => cardIndexBook(root));
    const bolts = Array.from({ length: 7 }, (_, i) => cardLightning(strike, i === 0 ? 1.7 : .9));
    bolts.forEach((bolt, i) => { bolt.position.set((i % 3 - 1) * .46, Math.floor(i / 3) * .43 - .45, i * .015); bolt.rotation.z = (i % 3 - 1) * .35; });
    cardIndexBook(formation);
    update = f => {
      const center = f.reducedMotion ? f.target.clone() : path(f); animateOrbit(pages, f, center, .80, 2.6, .04, 2.65);
      anchor(formation, f.start, f, 1.4); formation.visible = visibleDuring(f, .02, .80);
      anchor(strike, f.target, f); strike.visible = visibleDuring(f, .9, 2.60);
      strike.scale.multiplyScalar(.75 + smooth((f.time - .9) / .22) * .45);
      // Lightning holds a solid tree-shaped silhouette instead of strobing.
    };
  } else if (theme === 3) {
    const cards = Array.from({ length: 12 }, (_, i) => cardLeafPuzzle(root, i));
    const leaves = Array.from({ length: 8 }, (_, i) => leaf(root, i % 2 ? 0x62bc8b : 0x9bd276));
    for (let i = -1; i <= 1; i++) { const shoot = branch(formation); shoot.position.x = i * .45; shoot.scale.setScalar(.9); }
    update = f => {
      const settle = f.reducedMotion ? 1 : smooth((f.time - .5) / .60), center = f.hero.clone(); center.y += 1.75*f.scale;
      cards.forEach((piece, i) => { piece.visible = visibleDuring(f, .05, 2.80); const a = i * 1.6 + (f.reducedMotion ? 0 : f.time * 1.3);
        const heartAngle = i * Math.PI*2 / cards.length;
        const settledX = mode === 'starter' ? Math.pow(Math.sin(heartAngle),3)*.76 : (i%4-1.5)*.43;
        const settledY = mode === 'starter' ? (13*Math.cos(heartAngle)-5*Math.cos(2*heartAngle)-2*Math.cos(3*heartAngle)-Math.cos(4*heartAngle))*.055 : (Math.floor(i/4)-1)*.44;
        const point = center.clone(); point.x += THREE.MathUtils.lerp(Math.cos(a) * 1.0, settledX, settle) * f.scale;
        point.y += THREE.MathUtils.lerp(Math.sin(a) * .7, settledY, settle) * f.scale;
        anchor(piece, point, f); if (!f.reducedMotion) piece.rotateZ((1 - settle) * Math.sin(a)); });
      animateOrbit(leaves, f, center, 1.05, .7, .4, 2.8);
      const ground = f.hero.clone(); ground.y += .1 * f.scale; anchor(formation, ground, f, 1.10); formation.visible = visibleDuring(f, .9, 2.8);
      strike.visible = false;
    };
  } else if (theme === 4 && mode === 'starter') {
    root.userData.sequence = 'mirror-array-charge-cleaver-flight-mask-shatter';
    ritualRing(formation, 'mirror-summoning-array', 0xc4a0e9, .76);
    const orbit = Array.from({ length: 8 }, () => cardFramedMirror(formation));
    orbit.forEach((piece, i) => {
      const a = i * Math.PI / 4; piece.position.set(Math.cos(a) * .74, Math.sin(a) * .74, .06);
      piece.rotation.z = a; piece.scale.setScalar(.64);
    });
    const cleaver = group(strike, 'colossal-mirror-cleaver');
    const blade = cardFramedMirror(cleaver); blade.scale.setScalar(2.65); blade.rotation.z = -Math.PI / 2;
    blade.position.x = -.98;
    for (const side of [-1, 1]) {
      const facet = cardMirrorShard(cleaver, 1); facet.position.set(-1.10, side * .34, -.05);
      facet.rotation.z = side * .45 - Math.PI / 2; facet.scale.setScalar(1.20);
    }
    const brokenMasks = Array.from({ length: 3 }, () => mask(root));
    const impact = group(root, 'mirror-mask-shatter-impact');
    const fragments = Array.from({ length: 24 }, (_, i) => cardMirrorShard(impact, i));
    const wave = impactWave(root, 'mirror-cleaver-ripple', 0xb590e1);
    update = f => {
      anchor(formation, f.start, f); formation.visible = visibleDuring(f, .03, .70);
      if (!f.reducedMotion) formation.rotateZ(f.time * .80);
      anchor(strike, f.reducedMotion ? f.target : path(f), f, 1.05); strike.visible = visibleDuring(f, .28, 1.04);
      if (!f.reducedMotion) strike.rotateZ(Math.sin(limit((f.time - .42) / .48) * Math.PI) * .34);
      const spread = f.reducedMotion ? .65 : smooth((f.time - .9) / .75);
      brokenMasks.forEach((piece, i) => {
        const center = f.target.clone(); center.x += (i - 1) * .36 * f.scale;
        anchor(piece, center, f, 1.10); piece.visible = visibleDuring(f, .9, 1.85);
        piece.scale.x *= 1 - spread * .80; if (!f.reducedMotion) piece.rotateZ((i - 1) * spread * .70);
      });
      anchor(impact, f.target, f); impact.visible = visibleDuring(f, .9, 2.80);
      fragments.forEach((piece, i) => {
        const a = i * 2.4, radius = .20 + spread * (.65 + i % 3 * .08);
        piece.position.set(Math.cos(a) * radius, Math.sin(a) * radius * .75, .10);
        piece.rotation.z = f.reducedMotion ? a : a + spread * .90;
        piece.scale.setScalar(.48 - spread * .12);
      });
      const ground = f.target.clone(); ground.y -= .48 * f.scale;
      anchor(wave, ground, f, 1 + spread * .90); wave.visible = visibleDuring(f, .9, 2.80);
    };
  } else if (theme === 4) {
    const mirrors = Array.from({ length: 10 }, () => cardFramedMirror(root));
    const masks = Array.from({ length: 3 }, () => mask(strike)); masks.forEach((m, i) => m.position.set((i - 1) * .48, (i % 2) * .35, .01));
    update = f => {
      const center = f.reducedMotion ? f.target.clone() : path(f), broken = smooth((f.time - .9) / .60);
      mirrors.forEach((piece, i) => { piece.visible = visibleDuring(f, .05, 2.8); const a = i * Math.PI * 2 / mirrors.length;
        const point = center.clone(); point.x += Math.cos(a) * (.65 + broken * .38) * f.scale; point.y += Math.sin(a) * (.65 + broken * .25) * f.scale;
        anchor(piece, point, f, i % 2 ? 1.1 : .8); piece.rotateZ(a + (f.reducedMotion ? 0 : broken * .6)); });
      anchor(strike, f.target, f, 1.3); strike.visible = visibleDuring(f, .62, 2.25);
      masks.forEach((m, i) => { m.rotation.z = f.reducedMotion ? 0 : (i - 1) * broken * .8; m.scale.set(1 - broken * .7, 1, 1); });
      formation.visible = false;
    };
  } else if (theme === 5 && mode === 'starter') {
    root.userData.sequence = 'fire-feather-charge-phoenix-flight-flame-impact';
    ritualRing(formation, 'phoenix-summoning-array', 0xf5ad45, .70);
    const feathers = Array.from({ length: 8 }, (_, i) => feather(formation, i % 2 ? 0xffd875 : 0xf88430, .65));
    feathers.forEach((piece, i) => {
      const a = i * Math.PI / 4; piece.position.set(Math.cos(a) * .70, Math.sin(a) * .70, .06);
      piece.rotation.z = a - Math.PI / 2;
    });
    // The card-derived phoenix is the only creature; retain arena-space embers.
    const impact = group(root, 'phoenix-fire-impact');
    const flames = Array.from({ length: 14 }, () => flame(impact, .8));
    const cinders = Array.from({ length: 24 }, (_, i) => feather(impact, i % 2 ? 0xffc957 : 0xf47230, .52));
    const wave = impactWave(root, 'phoenix-fire-shockwave', 0xf39138);
    update = f => {
      anchor(formation, f.start, f, 1.10); formation.visible = visibleDuring(f, .03, .70);
      if (!f.reducedMotion) formation.rotateZ(-f.time * .75);
      anchor(strike, f.reducedMotion ? f.target : path(f), f, 1.85);
      strike.visible = false;
      anchor(impact, f.target, f); impact.visible = visibleDuring(f, .9, 2.80);
      const spread = f.reducedMotion ? .65 : smooth((f.time - .9) / .75);
      flames.forEach((piece, i) => {
        const a = i * Math.PI * 2 / flames.length, radius = .20 + spread * .75;
        piece.position.set(Math.cos(a) * radius, Math.sin(a) * radius * .70 + spread * .12, .05);
        piece.rotation.z = Math.PI / 2 - a; piece.scale.setScalar(.60 - spread * .15);
      });
      cinders.forEach((piece, i) => {
        const a = i * 2.4, radius = .18 + spread * (.84 + i % 3 * .08);
        piece.position.set(Math.cos(a) * radius, Math.sin(a) * radius * .75 + spread * .18, .12);
        piece.rotation.z = f.reducedMotion ? a : a + spread * .70; piece.scale.setScalar(.45 - spread * .17);
      });
      const ground = f.target.clone(); ground.y -= .48 * f.scale;
      anchor(wave, ground, f, 1 + spread); wave.visible = visibleDuring(f, .9, 2.80);
    };
  } else if (theme === 5) {
    // The upgraded creature is rendered by the card-derived cinematic sprite.
    // Keep world-space ignition and contact particles, without a second low-detail bird.
    const ignition = Array.from({ length: 5 }, () => flame(formation, .70));
    ignition.forEach((piece, i) => { piece.position.set((i - 2) * .13, (i % 2) * .18, 0); piece.rotation.z = (i - 2) * .18; });
    const fireImpact = group(root, 'phoenix-fire-impact');
    const impactFlames = Array.from({ length: 10 }, () => flame(fireImpact, .80));
    const feathers = Array.from({ length: 10 }, (_, i) => feather(root, i % 2 ? 0xffdc71 : 0xf6823e, .65));
    update = f => {
      const center = f.reducedMotion ? f.target.clone() : path(f);
      strike.visible = false;
      anchor(formation, f.start, f, 1.3); formation.visible = visibleDuring(f, .02, .72);
      animateOrbit(feathers, f, center, .95, 1.2, .25, 2.8);
      anchor(fireImpact, f.target, f); fireImpact.visible = visibleDuring(f, .9, 2.8);
      const spread = f.reducedMotion ? .7 : smooth((f.time - .9) / .65);
      impactFlames.forEach((piece, i) => {
        const a = i * Math.PI * 2 / impactFlames.length;
        piece.position.set(Math.cos(a) * (.18 + spread * .48), Math.sin(a) * (.18 + spread * .40) + spread * .16, .035);
        piece.rotation.z = Math.PI / 2 - a;
        piece.scale.setScalar(.55 + Math.sin(spread * Math.PI) * .30);
      });
    };
  } else {
    const crystals = Array.from({ length: mode === 'starter' ? 12 : 7 }, () => iceShard(formation, .65));
    crystals.forEach((piece, i) => {
      if (mode === 'starter') {
        const a = i * Math.PI * 2 / crystals.length;
        piece.position.set(Math.cos(a) * .8, Math.sin(a) * .8, .04); piece.rotation.z = a - Math.PI / 2;
      } else { piece.position.set((i - 3) * .12, .08 + Math.sin(i * 1.7) * .22, .04); piece.rotation.z = (i - 3) * .18; }
    });
    let crystalArray: THREE.Group | null = null;
    if (mode === 'starter') {
      crystalArray = group(formation, 'frost-crystal-summoning-array');
      const ring = Array.from({ length: 13 }, (_, i) => [Math.cos(i * Math.PI / 6) * .76, Math.sin(i * Math.PI / 6) * .76, .02]);
      tube(crystalArray, ring, .035, 0xb9f4ff);
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, b = a + Math.PI * 2 / 3;
        tube(crystalArray, [[Math.cos(a) * .62, Math.sin(a) * .62, .03], [Math.cos(b) * .62, Math.sin(b) * .62, .03]], .018, 0x81d0ed); }
    }
    const lance = mode === 'starter' ? group(strike, 'colossal-frost-lance') : null;
    if (lance) {
      const main = iceSpear(lance, 1.85); main.position.x = -1.515;
      const collar = iceShard(lance, .72); collar.position.set(-1.20, 0, .12); collar.rotation.z = -Math.PI / 2;
      for (const side of [-1, 1]) {
        const fin = iceShard(lance, .72); fin.position.set(-.83, side * .24, .12); fin.rotation.z = side * .60 - Math.PI / 2;
      }
    }
    const shatter = iceBurst(root, mode === 'starter' ? 30 : 20);
    const frostWave = mode === 'starter' ? group(root, 'colossal-lance-frost-wave') : null;
    if (frostWave) {
      for (let i = 0; i < 3; i++) {
        const points = Array.from({ length: 13 }, (_, n) => [Math.cos(n * Math.PI / 6) * (.54 + i * .17), Math.sin(n * Math.PI / 6) * (.20 + i * .035), .025]);
        tube(frostWave, points, .035, i % 2 ? 0xcdf8ff : 0x78cdeb);
      }
    }
    update = f => {
      anchor(formation, f.start, f, 1.15); formation.visible = visibleDuring(f, .03, .7);
      if (crystalArray) crystalArray.rotation.z = f.reducedMotion ? 0 : f.time * .9;
      if (mode === 'advanced') {
        // One high-detail ice dragon comes from the cinematic; its shards still
        // land on the actual opponent in the arena at the shared contact time.
        strike.visible = false;
      } else {
        anchor(strike, f.reducedMotion ? f.target : path(f), f, 1.25);
        if (!f.reducedMotion) strike.scale.multiplyScalar(.45 + .55 * smooth((f.time - .24) / .18));
        strike.visible = visibleDuring(f, .24, 1.08);
      }
      anchor(shatter.root, f.target, f, mode === 'advanced' ? 1.25 : 1.45);
      shatter.root.visible = visibleDuring(f, .9, 2.8);
      const spread = f.reducedMotion ? .65 : smooth((f.time - .9) / .65);
      shatter.update(spread, f.reducedMotion);
      if (frostWave) {
        const ground = f.target.clone(); ground.y -= .45 * f.scale;
        anchor(frostWave, ground, f, 1.1 + spread * 1.15);
        frostWave.visible = visibleDuring(f, .9, 2.8);
      }
    };
  }
  return { root, update };
}

function enemyVariant(parent: THREE.Object3D, theme: number, mode: Mode): Variant {
  const root = group(parent, `enemy-${theme}-${mode}`); root.userData.identity = enemySpellNames[mode][theme - 1];
  const pieces: THREE.Group[] = [], landing = group(root, 'enemy-impact');
  const advanced = mode === 'advanced';
  const accents = ordinaryAttackAccents(root,
    (advanced ? [0xc4a3eb, 0xe8b962, 0x8eaa60, 0xae91dd, 0x71578a, 0xaedbf2]
      : [0xe4bb66, 0x9fafd8, 0x91acd8, 0xb28ace, 0xe5ca91, 0xedc66e])[theme - 1],
    (advanced ? ['web', 'sand', 'leaf', 'mirror', 'ink', 'cloud'] as const
      : ['seal', 'paper', 'seal', 'mirror', 'paper', 'gear'] as const)[theme - 1]);
  if (theme === 1 && advanced) {
    const web = group(root, 'spider-web'); pieces.push(web);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; tube(web, [[0, 0], [Math.cos(a) * .8, Math.sin(a) * .8]], .018, 0xeddaff); }
    for (let size = 1; size <= 3; size++) {
      const points = Array.from({ length: 9 }, (_, i) => [Math.cos(i * Math.PI / 4) * size * .24, Math.sin(i * Math.PI / 4) * size * .24]);
      tube(web, points, .018, 0xc4a3eb);
    }
    for (const side of [-1, 1]) { const lock = padlock(landing, .5); lock.position.set(side * .4, -.1, .05); }
  } else if (theme === 1) {
    for (let i = 0; i < 12; i++) pieces.push(chainLink(root, i % 2 ? 0xebc168 : 0x80ab93));
    padlock(landing, 1.05);
  } else if (theme === 2) {
    if (advanced) {
      for (let i = 0; i < 18; i++) { const grain = group(root, 'hourglass-sand'); body(grain, new THREE.OctahedronGeometry(.07), i % 2 ? 0xf4cc72 : 0xd79556); pieces.push(grain); }
      const dial = group(landing, 'wrong-time-dial'); body(dial, new THREE.CylinderGeometry(.4, .4, .05, 12), 0xb88c4a).rotation.x = Math.PI / 2;
      box(dial, .04, .32, .025, cream, 0, .1, .05); box(dial, .29, .04, .025, cream, .1, 0, .05);
    } else for (let i = 0; i < 8; i++) pieces.push(card(root, i % 2 ? 0x8596c6 : 0xcab579, i));
  } else if (theme === 3) {
    if (advanced) {
      for (let i = 0; i < 7; i++) { const vine = branch(root, 0x776344); vine.scale.setScalar(.8); pieces.push(vine); }
      for (let i = 0; i < 5; i++) { const l = leaf(landing, 0x6bb389); l.position.set((i - 2) * .25, .1 * (i % 2), 0); }
    } else {
      for (let i = 0; i < 3; i++) { const stamp = group(root, 'classification-stamp');
        box(stamp, .42, .15, .22, 0x4f698e, 0, -.1); box(stamp, .13, .3, .16, 0xdeb679, 0, .1); pieces.push(stamp); }
      for (let i = 0; i < 3; i++) { const print = card(landing, 0x819de1, i); print.position.x = (i - 1) * .36; print.rotation.z = .3; }
    }
  } else if (theme === 4) {
    if (advanced) {
      for (let i = 0; i < 8; i++) pieces.push(note(root, i % 2 ? 0xaf94da : 0x75bdd9));
      for (const side of [-1, 1]) { const tail = leaf(landing, 0x7baed1, 1.5); tail.rotation.z = side * .75; tail.position.x = side * .25; }
    } else { for (let i = 0; i < 5; i++) pieces.push(mask(root)); }
  } else if (theme === 5) {
    if (advanced) {
      for (let i = 0; i < 9; i++) pieces.push(droplet(root, i % 2 ? 0x443562 : 0x263752));
      for (let i = 0; i < 6; i++) { const splash = droplet(landing, 0x3d3654); splash.rotation.z = i * Math.PI / 3; splash.position.set(Math.cos(i * Math.PI / 3) * .28, Math.sin(i * Math.PI / 3) * .22, 0); }
    } else {
      for (let i = 0; i < 5; i++) { const paperWing = group(root, 'paper-wing'); polygon(paperWing, [[-.4, -.17], [0, .25], [.4, -.17], [0, -.05]], cream); pieces.push(paperWing); }
      openBook(landing);
    }
  } else if (advanced) { for (let i = 0; i < 3; i++) pieces.push(cloudFist(root)); }
  else { for (let i = 0; i < 6; i++) pieces.push(gear(root)); }

  // The caster's species now supplies a readable leading object, not just a
  // cloud of equally weighted particles. Charge/impact copies share resources.
  const projectile = group(root, 'enemy-signature-projectile');
  const charge = group(root, 'enemy-species-charge');
  let signature: THREE.Object3D;
  if (theme === 1) signature = advanced ? pieces[0].clone(true) : padlock(projectile, 1.10);
  else if (theme === 2 && !advanced) signature = openBook(projectile);
  else if (theme === 2) {
    signature = group(projectile, 'hourglass-sand-core');
    polygon(signature, [[-.27, .35], [.27, .35], [.09, .03], [.28, -.35], [-.28, -.35], [-.09, .03]], 0xe4ba66, .12);
    box(signature, .67, .08, .15, cream, 0, .38); box(signature, .67, .08, .15, cream, 0, -.38);
    tube(signature, [[0, .17, .10], [0, -.19, .10]], .036, 0xffe2a0);
  } else if (theme === 3) {
    signature = pieces[0].clone(true);
    if (advanced) { signature.rotation.z = Math.PI / 2; signature.position.x = .30; }
  } else if (theme === 4 && advanced) {
    signature = group(projectile, 'echo-tail-wave');
    for (let i = 0; i < 3; i++) {
      const tail = leaf(signature, i % 2 ? 0xbfa1e4 : 0x81bfdc, 1.25);
      tail.rotation.z = Math.PI / 2 + (i - 1) * .3; tail.position.set((i - 1) * .11, (i - 1) * .14, i * .015);
    }
    note(signature, 0xf0ddff).position.z = .12;
  } else signature = pieces[0].clone(true);
  if (signature.parent !== projectile) projectile.add(signature);
  signature.name = 'enemy-signature-' + mode + '-' + theme;
  const signatureScale = theme === 5 ? advanced ? 2.1 : 1.5 : theme === 6 ? advanced ? 1.32 : 1.6 : 1.2;
  signature.scale.multiplyScalar(signatureScale);
  const chargeForm = signature.clone(true); charge.add(chargeForm); chargeForm.name = 'enemy-charge-form';
  const debris: THREE.Object3D[] = [];
  const count = theme === 1 ? 6 : theme === 6 ? 8 : 7;
  for (let i = 0; i < count; i++) {
    let part: THREE.Object3D;
    if (theme === 1) part = advanced ? pieces[0].clone(true) : chainLink(landing, 0xe8be65);
    else if (theme === 4 && !advanced) part = mirrorShard(landing, i);
    else if (theme === 6 && advanced) {
      part = body(landing, new THREE.RingGeometry(.16, .205, 16), 0xcceeff, 0, 0, 0, 0, .72);
    } else part = pieces[i % pieces.length].clone(true);
    if (part.parent !== landing) landing.add(part);
    part.name = 'enemy-material-fragment'; debris.push(part);
  }
  // Every boss has a material landing: pages, mask fragments, gear teeth and
  // compressed air complete the previously empty impact groups.
  const collision = signature.clone(true); landing.add(collision); collision.name = 'enemy-contact-form';
  const ground = impactWave(root, 'enemy-local-pressure-wave', advanced ? 0xaaa0de : 0xd6b76f);
  const pursuit = group(root, 'enemy-species-pursuit');
  const pursuitForms = [-1, 1].map(side => {
    const copy = signature.clone(true); pursuit.add(copy);
    copy.name = 'enemy-pursuit-form-' + side; return copy;
  });
  const followUpWave = ground.clone(true); root.add(followUpWave); followUpWave.name = 'enemy-pursuit-contact';
  root.userData.sequence = 'species-charge-leading-projectile-material-contact';
  const flightPoint = new THREE.Vector3(), partPoint = new THREE.Vector3();
  return { root, update(frame) {
    const f = heldOrdinaryFrame(frame);
    const critical = !!f.enemyCritical;
    const strength = critical ? 1.24 : 1;
    root.userData.critical = critical;
    root.userData.identity = enemySpellNames[mode][theme - 1] + (critical ? '追擊' : '');
    root.userData.sequence = critical ? 'species-charge-leading-projectile-material-contact-paired-pursuit' : 'species-charge-leading-projectile-material-contact';
    accents.update(f);
    const hit = f.reducedMotion ? .62 : smooth((f.time - .9) / .40);
    const travel = limit((f.time - ORDINARY_LAUNCH_SECONDS) / (SPELL_IMPACT_SECONDS - ORDINARY_LAUNCH_SECONDS));
    ordinaryPath(f, flightPoint);
    anchor(charge, f.start, f, (.55 + smooth(f.time / ORDINARY_LAUNCH_SECONDS) * .32) * strength);
    charge.visible = visibleDuring(f, .02, ORDINARY_LAUNCH_SECONDS);
    if (!f.reducedMotion) charge.rotateZ((theme === 6 || theme === 2 ? -.20 : .10) * (1 - smooth(f.time / ORDINARY_LAUNCH_SECONDS)));
    anchor(projectile, f.reducedMotion ? f.target : flightPoint, f, strength);
    projectile.visible = visibleDuring(f, ORDINARY_LAUNCH_SECONDS, .98);
    if (!f.reducedMotion) {
      if (theme === 6 && !advanced) projectile.rotateZ(-travel * Math.PI * 1.5);
      else if (theme === 3 && !advanced) projectile.rotateZ(-.35 * (1 - travel));
      else if (theme === 5 && advanced) projectile.scale.set(f.scale * strength * (1 + travel * .25), f.scale * strength * (1 - travel * .12), f.scale * strength);
    }
    pieces.forEach((piece, i) => {
      piece.visible = visibleDuring(f, ORDINARY_LAUNCH_SECONDS, .97);
      const point = partPoint.copy(f.reducedMotion ? f.target : flightPoint);
      if ((theme === 1 && !advanced) || (theme === 3 && advanced)) {
        const p = (i + 1) / pieces.length;
        point.copy(f.start).lerp(f.reducedMotion ? f.target : flightPoint, p);
        point.y += Math.sin(p * Math.PI) * (theme === 3 ? -.18 : .12) * f.scale;
      } else {
        point.x += (.14 + i % 3 * .16) * f.scale;
        point.y += (i % 2 ? 1 : -1) * (.10 + Math.floor(i / 3) * .07) * f.scale;
      }
      anchor(piece, point, f, theme === 2 && advanced ? .85 : theme === 3 && advanced ? .44 : .55);
      if (theme === 3 && advanced) piece.rotateZ(Math.PI / 2);
      else if (!f.reducedMotion) piece.rotateZ((i % 2 ? .25 : -.25) * travel);
    });
    anchor(landing, f.target, f, critical ? 1.14 : 1); landing.visible = !f.blocked && visibleDuring(f, .9, 1.83);
    collision.visible = !f.missed;
    collision.scale.copy(signature.scale).multiplyScalar(.88 - hit * .55);
    if (theme === 3 && !advanced) collision.scale.y *= .5;
    debris.forEach((part, i) => {
      const angle = i * Math.PI * 2 / debris.length + .2;
      const radius = .17 + hit * (.48 + i % 2 * .15);
      part.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * .68, .10);
      part.rotation.z = angle + (f.reducedMotion ? 0 : hit * .4);
      const size = theme === 1 && advanced ? .30 : theme === 2 && advanced ? .90 : theme === 6 && advanced ? .8 + hit * .9 : .42;
      part.scale.setScalar(size * (1 - hit * .15));
    });
    const floor = partPoint.copy(f.target); floor.y -= .40 * f.scale;
    anchor(ground, floor, f, (.7 + hit * .70) * (critical ? 1.14 : 1));
    ground.visible = !f.blocked && !f.missed && visibleDuring(f, .9, 1.72);
    // One registered counterattack gets a visible material follow-up. The engine
    // applies its total damage once at .9; these pooled forms never change HP.
    const contact = !f.blocked && !f.missed;
    pursuit.visible = critical && contact && !f.reducedMotion && visibleDuring(f, 1.02, 1.30);
    const followTravel = limit((f.time - 1.02) / .20);
    ordinaryPath({ ...f, time: ORDINARY_LAUNCH_SECONDS + followTravel * (SPELL_IMPACT_SECONDS - ORDINARY_LAUNCH_SECONDS) }, flightPoint);
    pursuitForms.forEach((part, i) => {
      const point = partPoint.copy(flightPoint); point.y += (i ? 1 : -1) * .19 * f.scale * (1 - followTravel);
      anchor(part, point, f, .67);
      part.scale.multiply(signature.scale);
    });
    const followHit = f.reducedMotion ? .62 : smooth((f.time - 1.22) / .33);
    const followFloor = partPoint.copy(f.target); followFloor.y -= .36 * f.scale;
    anchor(followUpWave, followFloor, f, .84 + followHit * .83);
    followUpWave.visible = critical && contact && visibleDuring(f, f.reducedMotion ? .9 : 1.22, 1.90);
  } };
}

/** Final bosses cast their own grimoire/dragon magic, independent of the spell
 * the learner chose. A consecutive-error attack expands that same silhouette. */
function finalEnemyVariant(parent: THREE.Object3D, mode: Mode): Variant {
  const root = group(parent, `final-enemy-${mode}`);
  root.userData.identity = mode === 'starter' ? '混沌魔典衝擊' : '九龍幻焰衝擊';
  const accents = ordinaryAttackAccents(root, mode === 'starter' ? 0xc67198 : 0xb27af0,
    mode === 'starter' ? 'paper' : 'ice');
  const summon = ritualRing(root, 'final-boss-summoning-seal', 0xe67aa7, .65);
  const projectile = group(root, 'final-boss-projectile');
  const fan: THREE.Group[] = [];
  if (mode === 'starter') {
    const book = openBook(projectile); book.scale.setScalar(1.08);
    const crest = padlock(projectile, .50); crest.position.set(0, -.1, .13);
    for (let i = 0; i < 5; i++) {
      const page = card(projectile, i % 2 ? 0xa95279 : 0x6a518c, i);
      page.position.set(.35 + Math.abs(i - 2) * .11, (i - 2) * .19, .04);
      page.rotation.z = (i - 2) * -.18; page.scale.setScalar(.60); fan.push(page);
    }
  } else {
    spectralHydra(projectile);
    for (let i = 0; i < 9; i++) {
      const jet = flame(projectile, .23); jet.name = 'spectral-breath-' + i;
      jet.position.set(-.59 + i % 3 * .23, (Math.floor(i / 3) - 1) * .32, .14);
      jet.rotation.z = Math.PI / 2; fan.push(jet);
      jet.traverse(node => { if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshStandardMaterial) {
        node.material.color.setHex(0xbb86e4); node.material.emissive.setHex(0xbb86e4);
      } });
    }
  }
  const chargeForm = projectile.clone(true); summon.add(chargeForm); chargeForm.name = 'final-boss-charge-form'; chargeForm.scale.setScalar(.54);
  const fragments = Array.from({ length: 9 }, (_, i) => mode === 'starter' ? card(root, i % 2 ? 0xa95279 : 0x6a518c, i) : flame(root, .46));
  if (mode === 'advanced') fragments.forEach(part => part.traverse(node => {
    if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshStandardMaterial) {
      node.material.color.setHex(0xb27af0); node.material.emissive.setHex(0xb27af0);
    }
  }));
  const impact = impactWave(root, 'final-boss-impact-wave', 0xef80ac);
  const seal = group(root, 'final-boss-material-contact');
  if (mode === 'starter') {
    padlock(seal, .75);
    for (let i = 0; i < 6; i++) {
      const page = card(seal, i % 2 ? 0x9a538e : 0x72569d, i), angle = i * Math.PI / 3;
      page.position.set(Math.cos(angle) * .46, Math.sin(angle) * .40, .04); page.rotation.z = angle; page.scale.setScalar(.70);
    }
  } else {
    for (let i = 0; i < 9; i++) {
      const fire = flame(seal, .42); fire.position.set(Math.cos(i * 2.4) * .34, Math.sin(i * 2.4) * .29, .05);
      fire.rotation.z = i * 2.4;
      fire.traverse(node => { if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshStandardMaterial) {
        node.material.color.setHex(0xb884e1); node.material.emissive.setHex(0xb884e1);
      } });
    }
  }
  const chase = Array.from({ length: 6 }, (_, i) => lightning(root, .5 + i % 2 * .16));
  chase.forEach((bolt, i) => { bolt.name = 'final-boss-critical-bolt-' + i; });
  return { root, update(frame) {
    const f = heldOrdinaryFrame(frame);
    const critical = !!f.enemyCritical;
    accents.root.visible = !critical;
    if (!critical) accents.update(f);
    const strength = critical ? 1.65 : 1;
    root.userData.critical = critical;
    root.userData.identity = critical ? mode === 'starter' ? '魔典王 · 混沌追擊必殺' : '九頭龍 · 幻焰追擊必殺' : mode === 'starter' ? '混沌魔典衝擊' : '九龍幻焰衝擊';
    anchor(summon, f.start, f, strength); summon.visible = visibleDuring(f, .02, .60);
    anchor(projectile, ordinaryPath(f), f, strength);
    projectile.visible = visibleDuring(f, ORDINARY_LAUNCH_SECONDS, 1.01);
    const impactAge = f.reducedMotion ? .62 : smooth((f.time - .9) / .65);
    fan.forEach((part, i) => {
      if (mode === 'starter') part.rotation.z = (i - 2) * (-.18 - limit((f.time - ORDINARY_LAUNCH_SECONDS) / (SPELL_IMPACT_SECONDS - ORDINARY_LAUNCH_SECONDS)) * .10);
      else part.scale.setScalar(.23 * (1 + (f.reducedMotion ? .3 : limit((f.time - ORDINARY_LAUNCH_SECONDS - i % 3 * .025) / .4)) * .4));
    });
    anchor(impact, f.target, f, strength * (.65 + impactAge * .9));
    impact.visible = !f.blocked && !f.missed && visibleDuring(f, .9, 1.9);
    anchor(seal, f.target, f, strength * (.55 + impactAge * .55));
    seal.visible = !f.blocked && !f.missed && visibleDuring(f, .9, 1.86);
    fragments.forEach((part, i) => {
      const p = (i + .5) / fragments.length, angle = i * 2.4 + (f.reducedMotion ? 0 : f.time);
      const radius = f.time < .9 ? .18 + p * .45 : .28 + impactAge * (.35 + p * .50);
      const center = f.time < .9 ? ordinaryPath(f, new THREE.Vector3(), i % 3 * .02) : f.target.clone();
      center.x += Math.cos(angle) * radius * strength * f.scale;
      center.y += Math.sin(angle) * radius * strength * f.scale;
      anchor(part, center, f, critical ? .72 : .45);
      part.visible = visibleDuring(f, ORDINARY_LAUNCH_SECONDS, f.blocked ? 1.02 : 1.88);
      if (!f.reducedMotion) part.rotateZ(angle * .35);
    });
    chase.forEach((bolt, i) => {
      const angle = i * Math.PI / 3;
      const center = f.target.clone(); center.x += Math.cos(angle) * (.3 + impactAge * .7) * f.scale;
      center.y += Math.sin(angle) * (.3 + impactAge * .7) * f.scale;
      anchor(bolt, center, f, 1.15); bolt.rotation.z = angle;
      bolt.visible = critical && !f.blocked && !f.missed && visibleDuring(f, .9, 1.90);
    });
  } };
}

/** Each cast has a concrete, separately constructed silhouette, flight and outcome.
 * Groups are retained for replay; one final dispose releases every owned resource. */
export function createThemedSpellEffects(scene: THREE.Scene, chapter: number, mode: Mode, finalBoss = false) {
  const theme = Math.max(1, Math.min(6, Math.round(chapter)));
  const root = group(scene, 'themed-spell-effects'); root.visible = false;
  const normal = normalVariant(root, theme), ultimate = ultimateVariant(root, theme, mode), enemy = finalBoss ? finalEnemyVariant(root, mode) : enemyVariant(root, theme, mode);
  const guard = group(root, 'blocked-defense'); const guardShield = shield(guard, 0x48bba2); guardShield.scale.setScalar(1.55);
  const mirrorDodge = group(root, 'mirror-dodge');
  for (const x of [-.33, .33]) { const reflection = mirrorShard(mirrorDodge); reflection.position.x = x; reflection.scale.setScalar(1.4); }
  const resources = { geometries: new Set<THREE.BufferGeometry>(), materials: new Set<THREE.Material>() };
  root.traverse(object => { if (object instanceof THREE.Mesh) { resources.geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(item => resources.materials.add(item)); } });
  let disposed = false;
  return {
    root,
    update(frame: SpellFrame) {
      if (disposed) return;
      const selected = frame.success ? frame.ultimate ? ultimate : normal : enemy;
      const end = frame.ultimate ? ULTIMATE_CAST_SECONDS : NORMAL_CAST_SECONDS;
      root.visible = frame.time >= 0 && frame.time < end;
      normal.root.visible = selected === normal; ultimate.root.visible = selected === ultimate; enemy.root.visible = selected === enemy;
      root.userData.spell = selected.root.userData.identity;
      root.userData.kind = frame.success ? frame.ultimate ? 'ultimate' : 'normal' : frame.enemyCritical ? 'enemy-ultimate' : 'enemy';
      root.userData.element = frame.success ? selected.root.userData.element : 'boss';
      root.userData.phase = frame.time < (selected === ultimate ? .42 : ORDINARY_LAUNCH_SECONDS) ? 'prepare' : frame.time < .9 ? 'travel' : 'impact';
      // A missed attack lands beside the learner, rather than visually striking
      // a character whose HP did not change.
      const shownFrame = frame.missed && !frame.success
        ? { ...frame, target: frame.target.clone().add(new THREE.Vector3(-.65 * frame.scale, -.55 * frame.scale, 0)) }
        : frame.blocked && !frame.success
          ? { ...frame, target: frame.target.clone().add(new THREE.Vector3(.18 * frame.scale, 0, 0)) }
          : frame;
      selected.update(shownFrame);
      root.userData.spell = selected.root.userData.identity;
      guard.visible = frame.blocked && !frame.success && visibleDuring(frame, .35, 1.95);
      anchor(guard, frame.target, frame); guard.position.x += .18 * frame.scale;
      root.userData.blocked = guard.visible;
      mirrorDodge.visible = !!frame.missed && !frame.success && visibleDuring(frame, .35, 1.95);
      anchor(mirrorDodge, frame.hero.clone().add(new THREE.Vector3(0, 1.35 * frame.scale, 0)), frame);
      root.userData.missed = mirrorDodge.visible;
    },
    clear() { root.visible = false; },
    dispose() {
      if (disposed) return;
      disposed = true; root.removeFromParent(); root.clear();
      resources.geometries.forEach(geometry => geometry.dispose()); resources.materials.forEach(value => value.dispose());
      resources.geometries.clear(); resources.materials.clear(); root.userData.disposed = true;
    },
  };
}
