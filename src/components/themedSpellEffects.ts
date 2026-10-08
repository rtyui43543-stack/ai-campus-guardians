import * as THREE from 'three';
import type { Mode } from '../domain/types';
import { getUltimateSpell } from '../content/ultimateSpells';

export const NORMAL_CAST_SECONDS = 2.05;
export const ULTIMATE_CAST_SECONDS = 3;
export const SPELL_IMPACT_SECONDS = .9;
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
function iceDragon(parent: THREE.Object3D) {
  const result = group(parent, 'frost-ice-dragon');
  tube(result, [[-.90, -.35], [-.58, -.16], [-.34, .10], [.1, -.05], [.43, .10], [.64, .16]], .14, 0x89d9f3);
  const head = polygon(result, [[.44, .09], [.52, .36], [.77, .40], [.89, .23], [1.15, .17], [1.03, .03], [.78, -.04], [.55, -.06]], 0xb5efff, .15);
  head.name = 'ice-dragon-head';
  const horns = group(result, 'ice-dragon-horns');
  polygon(horns, [[.56, .33], [.45, .72], [.73, .40]], 0xdafaff, .08);
  polygon(horns, [[.73, .36], [.73, .65], [.91, .27]], 0x65bce5, .06);
  box(result, .068, .045, .02, 0x173d65, .86, .18, .12);
  for (const side of [-1, 1]) {
    const wing = group(result, 'ice-dragon-wing');
    wing.position.z = side < 0 ? -.11 : .14;
    polygon(wing, [[-.24, .06], [-.88, .86], [-.56, .59], [-.47, 1.03], [-.12, .70], [.16, .86], [.04, .29]], side < 0 ? 0x62b6dc : 0xbaefff, .05);
    tube(wing, [[-.24, .06, .08], [-.47, 1.03, .08]], .027, 0xf1fdff);
    tube(wing, [[-.24, .06, .08], [-.88, .86, .08]], .026, 0xe0f8ff);
  }
  for (let i = 0; i < 4; i++) { const crest = iceShard(result, .32); crest.position.set(-.45 + i * .22, .21, .13); crest.rotation.z = -.25; }
  for (const x of [-.32, .24]) {
    tube(result, [[x, -.01, .09], [x + .08, -.29, .09], [x + .21, -.24, .09]], .04, 0xb9f0ff);
    polygon(result, [[x + .13, -.23], [x + .33, -.22], [x + .22, -.30]], 0xf2fcff, .04);
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
function phoenix(parent: THREE.Object3D) {
  const result = group(parent, 'wisdom-phoenix');
  polygon(result, [[0, -.25], [-.17, .05], [-.11, .42], [0, .61], [.13, .41], [.18, .04]], 0xffce66, .10);
  polygon(result, [[.06, .41], [.31, .32], [.13, .26]], 0xf47734);
  for (const side of [-1, 1]) {
    const wing = group(result, 'phoenix-wing'); wing.position.set(side * .12, .16, 0);
    polygon(wing, [[0, -.08], [side * .45, .02], [side * .85, .48], [side * .72, .02], [side * .96, .14], [side * .50, -.33]], 0xf58535, .07);
    for (let i = 0; i < 4; i++) {
      const plume = feather(wing, i % 2 ? 0xffad3c : 0xffdf7a, .45 + i * .03);
      plume.position.set(side * (.24 + i * .13), -.12 + i * .045, .07); plume.rotation.z = -side * (1.05 + i * .17);
    }
  }
  for (let i = -1; i <= 1; i++) { const tail = feather(result, 0xf27b3b, .8); tail.position.set(i * .16, -.5, -.01); tail.rotation.z = i * .22; }
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

function normalVariant(parent: THREE.Object3D, theme: number): Variant {
  const root = group(parent, `normal-${theme}`); root.userData.identity = normalSpellNames[theme - 1];
  root.userData.element = heroSpellElements[theme - 1];
  const moving = group(root, 'normal-projectile'), landing = group(root, 'normal-impact');
  let update: Variant['update'];
  if (theme === 1) {
    const keep = castle(moving); keep.scale.setScalar(.55); keep.position.y = -.12;
    padlock(moving, .78).position.set(0, .05, .21);
    const seals = [padlock(landing, .75), padlock(landing, .65), padlock(landing, .65)];
    seals[1].position.set(-.45, .17, -.03); seals[2].position.set(.45, .17, -.03);
    const chain = Array.from({ length: 14 }, () => chainLink(root, 0xebc368));
    update = f => {
      anchor(moving, f.reducedMotion ? f.target : path(f), f); moving.visible = visibleDuring(f, .08, .9);
      anchor(landing, f.target, f); landing.visible = visibleDuring(f, .9, 1.78); landing.scale.multiplyScalar(.65 + smooth((f.time - .9) / .25) * .65);
      const p = f.reducedMotion ? 1 : smooth((f.time - .55) / .35);
      chain.forEach((link, i) => { link.visible = visibleDuring(f, .55, 1.65); const a = i * Math.PI * 2 / chain.length;
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
        const point = f.reducedMotion ? f.target.clone() : path(f, new THREE.Vector3(), i * .035);
        point.y += (i - 2) * .18 * f.scale; anchor(piece, point, f, .88);
        piece.rotateZ((i - 2) * .18 + (f.reducedMotion ? 0 : Math.sin(f.time * 8 + i) * .12)); });
      anchor(landing, f.target, f, 1.2); landing.visible = visibleDuring(f, .9, 1.82);
      landing.scale.multiplyScalar(.75 + .25 * smooth((f.time - .9) / .15));
      moving.visible = false;
    };
  } else if (theme === 3) {
    const cards = Array.from({ length: 9 }, (_, i) => puzzleLeaf(root, [0x54b68d, 0xf1ba58, 0x8dca70][i % 3], i));
    const leaves = Array.from({ length: 6 }, (_, i) => leaf(root, i % 2 ? 0x68bf8e : 0xb2d96d, .64));
    for (let i = 0; i < 3; i++) { box(landing, .5, .10, .16, [0x54b68d, 0xf1ba58, 0x8dca70][i], (i - 1) * .52, -.5); }
    update = f => {
      const settled = smooth((f.time - .9) / .35), center = f.reducedMotion ? f.target.clone() : path(f);
      cards.forEach((piece, i) => { piece.visible = visibleDuring(f, .05, 1.82);
        const a = i * 2.4 + (f.reducedMotion ? 0 : f.time * 7), point = center.clone();
        const orbitX = Math.cos(a) * (.22 + i % 3 * .10), orbitY = (i / cards.length - .5) * 1.25;
        point.x += THREE.MathUtils.lerp(orbitX, (i % 3 - 1) * .47, settled) * f.scale;
        point.y += THREE.MathUtils.lerp(orbitY, Math.floor(i / 3) * .15 - .35, settled) * f.scale;
        anchor(piece, point, f, .72); if (!f.reducedMotion) piece.rotateZ((1 - settled) * Math.sin(a) * .8);
      });
      animateOrbit(leaves, f, center, .62, 1.9, .1, 1.82);
      anchor(landing, f.target, f); landing.visible = visibleDuring(f, .9, 1.86); moving.visible = false;
    };
  } else if (theme === 4) {
    const blades = Array.from({ length: 5 }, (_, i) => mirrorShard(root, i));
    const falseFace = mask(landing);
    update = f => {
      const p = impactAge(f), center = f.reducedMotion ? f.target : path(f);
      blades.forEach((piece, i) => { piece.visible = visibleDuring(f, .1, 1.85);
        const a = i * Math.PI * 2 / blades.length, point = center.clone();
        point.x += Math.cos(a) * (.30 + p * .55) * f.scale; point.y += Math.sin(a) * (.3 + p * .55) * f.scale;
        anchor(piece, point, f); piece.rotateZ(a + (f.reducedMotion ? 0 : f.time * 2)); });
      anchor(landing, f.target, f, 1.40); landing.visible = visibleDuring(f, .65, 1.60);
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
        const point = f.reducedMotion ? f.target.clone() : path(f, new THREE.Vector3(), i * .025);
        point.x -= i * .075 * f.scale; point.y += Math.sin(i * .8) * .23 * f.scale;
        anchor(piece, point, f, .88); piece.rotateZ((i - 3) * .11); });
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
        const point = f.reducedMotion ? f.target.clone() : path(f, new THREE.Vector3(), i * .025);
        point.y += (i - 2) * .15 * f.scale; anchor(piece, point, f, .72); });
      anchor(landing, f.target, f); landing.visible = visibleDuring(f, .9, 1.88);
      shatter.update(f.reducedMotion ? .65 : impactAge(f, 1.88), f.reducedMotion); moving.visible = false;
    };
  }
  return { root, update };
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
    const fortress = castle(formation); fortress.name = 'summoned-castle-shield';
    const shields = Array.from({ length: mode === 'advanced' ? 7 : 5 }, () => shield(root, 0x49bda0));
    const crest = group(strike, 'castle-emblem-projectile');
    shield(crest, 0x2ab99c).scale.setScalar(1.55);
    const flyingKeep = castle(crest); flyingKeep.scale.setScalar(.46); flyingKeep.position.set(0, -.10, .23);
    padlock(crest, .58).position.set(0, -.20, .32);
    const impact = group(root, 'castle-seal-impact');
    const seal = padlock(impact, 1.4);
    const fragments = Array.from({ length: mode === 'advanced' ? 16 : 12 }, (_, i) => {
      const token = group(impact, 'castle-crest-fragment');
      shield(token, i % 2 ? 0x5bc9b0 : 0x319ca0).scale.setScalar(.30);
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
    const book = openBook(formation); book.scale.setScalar(1.45);
    const array = ritualRing(formation, 'thunder-index-summoning-array', 0xe3bb5a, .78);
    const index = group(strike, 'colossal-thunder-index');
    openBook(index).scale.setScalar(2.0);
    const scrolls = Array.from({ length: 5 }, () => thunderPage(index));
    scrolls.forEach((page, i) => {
      page.position.set(-.55 - i * .12, (i - 2) * .19, .14);
      page.rotation.z = (i - 2) * .25; page.scale.setScalar(1.25);
    });
    const impact = group(root, 'thunder-index-impact');
    const bolts = Array.from({ length: 7 }, (_, i) => lightning(impact, i === 0 ? 1.75 : 1.05));
    bolts.forEach((bolt, i) => {
      bolt.position.set((i % 3 - 1) * .40, Math.floor(i / 3) * .31 - .25, i * .018);
      bolt.rotation.z = (i % 3 - 1) * .65;
    });
    const pages = Array.from({ length: 18 }, () => thunderPage(impact));
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
    const pages = Array.from({ length: 8 }, (_, i) => card(root, i % 2 ? 0x32b3be : 0xc89b4b, i));
    const bolts = Array.from({ length: 7 }, (_, i) => lightning(strike, i === 0 ? 1.7 : .9));
    bolts.forEach((bolt, i) => { bolt.position.set((i % 3 - 1) * .46, Math.floor(i / 3) * .43 - .45, i * .015); bolt.rotation.z = (i % 3 - 1) * .35; });
    openBook(formation);
    update = f => {
      const center = f.reducedMotion ? f.target.clone() : path(f); animateOrbit(pages, f, center, .80, 2.6, .04, 2.65);
      anchor(formation, f.start, f, 1.4); formation.visible = visibleDuring(f, .02, .80);
      anchor(strike, f.target, f); strike.visible = visibleDuring(f, .9, 2.60);
      strike.scale.multiplyScalar(.75 + smooth((f.time - .9) / .22) * .45);
      // Lightning holds a solid tree-shaped silhouette instead of strobing.
    };
  } else if (theme === 3) {
    const cards = Array.from({ length: 12 }, (_, i) => card(root, [0x64bc9f, 0xffc967, 0x88a5e6][i % 3], i));
    const leaves = Array.from({ length: 8 }, (_, i) => leaf(root, i % 2 ? 0x62bc8b : 0x9bd276));
    for (let i = -1; i <= 1; i++) { const shoot = branch(formation); shoot.position.x = i * .45; shoot.scale.setScalar(.9); }
    update = f => {
      const settle = f.reducedMotion ? 1 : smooth((f.time - .5) / .60), center = f.target.clone();
      cards.forEach((piece, i) => { piece.visible = visibleDuring(f, .05, 2.80); const a = i * 1.6 + f.time * 1.3;
        const point = center.clone(); point.x += THREE.MathUtils.lerp(Math.cos(a) * 1.0, (i % 4 - 1.5) * .37, settle) * f.scale;
        point.y += THREE.MathUtils.lerp(Math.sin(a) * .7, (Math.floor(i / 4) - 1) * .43, settle) * f.scale;
        anchor(piece, point, f); if (!f.reducedMotion) piece.rotateZ((1 - settle) * Math.sin(a)); });
      animateOrbit(leaves, f, center, 1.05, .7, .4, 2.8);
      const ground = f.hero.clone(); ground.y += .1 * f.scale; anchor(formation, ground, f, 1.10); formation.visible = visibleDuring(f, .9, 2.8);
      strike.visible = false;
    };
  } else if (theme === 4 && mode === 'starter') {
    root.userData.sequence = 'mirror-array-charge-cleaver-flight-mask-shatter';
    ritualRing(formation, 'mirror-summoning-array', 0xc4a0e9, .76);
    const orbit = Array.from({ length: 8 }, (_, i) => mirrorShard(formation, i));
    orbit.forEach((piece, i) => {
      const a = i * Math.PI / 4; piece.position.set(Math.cos(a) * .74, Math.sin(a) * .74, .06);
      piece.rotation.z = a; piece.scale.setScalar(.64);
    });
    const cleaver = group(strike, 'colossal-mirror-cleaver');
    const blade = mirrorShard(cleaver); blade.scale.setScalar(2.65); blade.rotation.z = -Math.PI / 2;
    blade.position.x = -.98;
    for (const side of [-1, 1]) {
      const facet = mirrorShard(cleaver, 1); facet.position.set(-1.10, side * .34, -.05);
      facet.rotation.z = side * .45 - Math.PI / 2; facet.scale.setScalar(1.20);
    }
    const brokenMasks = Array.from({ length: 3 }, () => mask(root));
    const impact = group(root, 'mirror-mask-shatter-impact');
    const fragments = Array.from({ length: 24 }, (_, i) => mirrorShard(impact, i));
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
    const mirrors = Array.from({ length: 10 }, (_, i) => mirrorShard(root, i));
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
    const bird = phoenix(strike); bird.position.x = -.31;
    const impact = group(root, 'phoenix-fire-impact');
    const flames = Array.from({ length: 14 }, () => flame(impact, .8));
    const cinders = Array.from({ length: 24 }, (_, i) => feather(impact, i % 2 ? 0xffc957 : 0xf47230, .52));
    const wave = impactWave(root, 'phoenix-fire-shockwave', 0xf39138);
    update = f => {
      anchor(formation, f.start, f, 1.10); formation.visible = visibleDuring(f, .03, .70);
      if (!f.reducedMotion) formation.rotateZ(-f.time * .75);
      anchor(strike, f.reducedMotion ? f.target : path(f), f, 1.85);
      strike.visible = visibleDuring(f, .25, 1.04);
      bird.children.filter(piece => piece.name === 'phoenix-wing').forEach((wing, i) => {
        wing.rotation.z = f.reducedMotion ? 0 : (i ? -1 : 1) * Math.sin(f.time * 8) * .25;
      });
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
    const bird = phoenix(strike);
    const ignition = Array.from({ length: 5 }, () => flame(formation, .70));
    ignition.forEach((piece, i) => { piece.position.set((i - 2) * .13, (i % 2) * .18, 0); piece.rotation.z = (i - 2) * .18; });
    const fireImpact = group(root, 'phoenix-fire-impact');
    const impactFlames = Array.from({ length: 10 }, () => flame(fireImpact, .80));
    const feathers = Array.from({ length: 10 }, (_, i) => feather(root, i % 2 ? 0xffdc71 : 0xf6823e, .65));
    update = f => {
      const center = f.reducedMotion ? f.target.clone() : path(f);
      anchor(strike, center, f, 1.5); strike.visible = visibleDuring(f, .25, mode === 'advanced' ? 1.08 : 2.75);
      bird.children.filter(o => o.name === 'phoenix-wing').forEach((wing, i) => { wing.rotation.z = f.reducedMotion ? 0 : (i ? -1 : 1) * Math.sin(f.time * 7) * .18; });
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
    const dragon = mode === 'advanced' ? iceDragon(strike) : null;
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
      if (dragon) {
        const center = f.reducedMotion ? f.target.clone() : path(f);
        anchor(strike, center, f, 1.45); strike.visible = visibleDuring(f, .18, 1.08);
        dragon.children.filter(piece => piece.name === 'ice-dragon-wing').forEach((wing, i) => {
          wing.rotation.x = f.reducedMotion ? 0 : Math.sin(f.time * 8) * (i ? -.18 : .18);
        });
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
  return { root, update(f) {
    const hit = smooth((f.time - .9) / .35);
    pieces.forEach((piece, i) => {
      piece.visible = visibleDuring(f, .10 + i % 3 * .04, 1.7);
      const point = f.reducedMotion ? f.target.clone() : path(f, new THREE.Vector3(), i % 3 * .025);
      if (theme === 1 && !advanced) { const p = i / Math.max(1, pieces.length - 1); point.copy(f.start).lerp(f.reducedMotion ? f.target : path(f), p); point.y += Math.sin(p * Math.PI * 2) * .13 * f.scale; }
      else if (theme === 2 && advanced) { point.x += ((i % 6) - 2.5) * .17 * f.scale; point.y += (Math.floor(i / 6) - 1) * .3 * f.scale - hit * .45 * f.scale; }
      else if (theme === 3 && advanced) { const p = i / pieces.length; point.copy(f.start).lerp(f.reducedMotion ? f.target : path(f), p); point.y -= .50 * f.scale; }
      else if (pieces.length > 1) { point.x += (i % 3 - 1) * .24 * f.scale; point.y += (Math.floor(i / 3) - Math.floor(pieces.length / 6)) * .22 * f.scale; }
      anchor(piece, point, f, theme === 6 && advanced ? 1.20 : theme === 4 && !advanced ? .8 : 1);
      if (!f.reducedMotion && !((theme === 1 || theme === 3) && advanced)) piece.rotateZ(Math.sin(f.time * 4 + i) * .22 + (theme === 6 && !advanced ? f.time * 4 : 0));
    });
    anchor(landing, f.target, f, 1.1); landing.visible = visibleDuring(f, .9, 1.83);
    landing.scale.multiplyScalar(.65 + .35 * hit);
  } };
}

/** Final bosses cast their own grimoire/dragon magic, independent of the spell
 * the learner chose. A consecutive-error attack expands that same silhouette. */
function finalEnemyVariant(parent: THREE.Object3D, mode: Mode): Variant {
  const root = group(parent, `final-enemy-${mode}`);
  root.userData.identity = mode === 'starter' ? '混沌魔典衝擊' : '九龍幻焰衝擊';
  const summon = ritualRing(root, 'final-boss-summoning-seal', 0xe67aa7, .65);
  const projectile = group(root, 'final-boss-projectile');
  if (mode === 'starter') {
    const book = openBook(projectile); book.scale.setScalar(1.08);
    const crest = padlock(projectile, .50); crest.position.set(0, -.1, .13);
  } else {
    const dragon = iceDragon(projectile); dragon.name = 'spectral-dragon-charge'; dragon.rotation.z = Math.PI;
    dragon.traverse(node => {
      if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshStandardMaterial) {
        node.material.color.setHex(0x895bb8); node.material.emissive.setHex(0x895bb8);
      }
    });
  }
  const fragments = Array.from({ length: 9 }, (_, i) => mode === 'starter' ? card(root, i % 2 ? 0xa95279 : 0x6a518c, i) : flame(root, .46));
  if (mode === 'advanced') fragments.forEach(part => part.traverse(node => {
    if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshStandardMaterial) {
      node.material.color.setHex(0xb27af0); node.material.emissive.setHex(0xb27af0);
    }
  }));
  const impact = impactWave(root, 'final-boss-impact-wave', 0xef80ac);
  const chase = Array.from({ length: 6 }, (_, i) => lightning(root, .5 + i % 2 * .16));
  chase.forEach((bolt, i) => { bolt.name = 'final-boss-critical-bolt-' + i; });
  return { root, update(f) {
    const critical = !!f.enemyCritical;
    const strength = critical ? 1.65 : 1;
    root.userData.critical = critical;
    root.userData.identity = critical ? mode === 'starter' ? '魔典王 · 混沌追擊必殺' : '九頭龍 · 幻焰追擊必殺' : mode === 'starter' ? '混沌魔典衝擊' : '九龍幻焰衝擊';
    anchor(summon, f.start, f, strength); summon.visible = visibleDuring(f, .02, .60);
    anchor(projectile, f.reducedMotion ? f.target : path(f), f, strength);
    projectile.visible = visibleDuring(f, .15, 1.01);
    const impactAge = smooth((f.time - .9) / .65);
    anchor(impact, f.target, f, strength * (.65 + impactAge * .9));
    impact.visible = visibleDuring(f, .9, 1.9);
    fragments.forEach((part, i) => {
      const p = (i + .5) / fragments.length, angle = i * 2.4 + (f.reducedMotion ? 0 : f.time);
      const radius = f.time < .9 ? .18 + p * .45 : .28 + impactAge * (.35 + p * .50);
      const center = f.time < .9 ? f.reducedMotion ? f.target.clone() : path(f, new THREE.Vector3(), i % 3 * .02) : f.target.clone();
      center.x += Math.cos(angle) * radius * strength * f.scale;
      center.y += Math.sin(angle) * radius * strength * f.scale;
      anchor(part, center, f, critical ? .72 : .45);
      part.visible = visibleDuring(f, .12, 1.88);
      if (!f.reducedMotion) part.rotateZ(angle * .35);
    });
    chase.forEach((bolt, i) => {
      const angle = i * Math.PI / 3;
      const center = f.target.clone(); center.x += Math.cos(angle) * (.3 + impactAge * .7) * f.scale;
      center.y += Math.sin(angle) * (.3 + impactAge * .7) * f.scale;
      anchor(bolt, center, f, 1.15); bolt.rotation.z = angle;
      bolt.visible = critical && visibleDuring(f, .9, 1.90);
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
      root.userData.phase = frame.time < .42 ? 'prepare' : frame.time < .9 ? 'travel' : 'impact';
      // A missed attack lands beside the learner, rather than visually striking
      // a character whose HP did not change.
      const shownFrame = frame.missed && !frame.success ? { ...frame, target: frame.target.clone().add(new THREE.Vector3(-.65 * frame.scale, -.55 * frame.scale, 0)) } : frame;
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
