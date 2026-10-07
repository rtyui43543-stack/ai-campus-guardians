import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { CoverGuardianRig } from './coverGuardian';

type Surface = THREE.MeshStandardMaterial;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function cloth(color: number, roughness = .76) { return new THREE.MeshStandardMaterial({ color, roughness }); }
function polished(color: number, metalness = .25) {
  return new THREE.MeshPhysicalMaterial({ color, metalness, roughness: .33, clearcoat: .55, clearcoatRoughness: .3 });
}
function attach(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: Surface,
  x = 0, y = 0, z = 0, name = '') {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.name = name;
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function oval(parent: THREE.Object3D, radius: number, material: Surface, x = 0, y = 0, z = 0,
  scale: readonly [number, number, number] = [1, 1, 1], name = '') {
  const mesh = attach(parent, new THREE.SphereGeometry(radius, 32, 24), material, x, y, z, name);
  mesh.scale.set(...scale); return mesh;
}
function rounded(parent: THREE.Object3D, w: number, h: number, d: number, material: Surface,
  x = 0, y = 0, z = 0, radius = .06, name = '') {
  return attach(parent, new RoundedBoxGeometry(w, h, d, 3, radius), material, x, y, z, name);
}
function tube(parent: THREE.Object3D, points: readonly THREE.Vector3[], radius: number, material: Surface,
  name = '', closed = false) {
  return attach(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([...points], closed, 'catmullrom', .35),
    Math.max(20, points.length * 3), radius, 10, closed), material, 0, 0, 0, name);
}
function ring(parent: THREE.Object3D, radius: number, thickness: number, material: Surface,
  x = 0, y = 0, z = 0, name = '') {
  return attach(parent, new THREE.TorusGeometry(radius, thickness, 12, 56), material, x, y, z, name);
}
function starGeometry(radius: number) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? radius * .45 : radius;
    if (!i) shape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    else shape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: true, bevelSize: .007,
    bevelThickness: .007, bevelSegments: 3 }); geometry.translate(0, 0, -.0125); return geometry;
}
function eyes(parent: THREE.Group, y: number, z: number, x = .235, glowing = false) {
  const ivory = cloth(0xfff3d6, .45), iris = polished(0x87522e, .05), pupil = polished(0x3f231d, .02);
  if (glowing) { iris.emissive.setHex(0xb77531); iris.emissiveIntensity = .35; }
  for (const side of [-1, 1]) {
    oval(parent, .155, ivory, side * x, y, z, [.92, 1.1, .3], 'magic-boss-eye-white');
    oval(parent, .105, iris, side * x + .004, y, z + .050, [.94, 1.15, .32], 'magic-boss-eye-iris');
    oval(parent, .064, pupil, side * x + .006, y, z + .087, [.88, 1.13, .28], 'magic-boss-eye-pupil');
    oval(parent, .022, ivory, side * x - .027, y + .046, z + .113, [1, 1, .24], 'magic-boss-eye-catchlight');
    oval(parent, .009, ivory, side * x + .029, y - .025, z + .108, [1, 1, .25]);
  }
}
function smile(parent: THREE.Group, y: number, z: number, material: Surface, radius = .16) {
  tube(parent, Array.from({ length: 11 }, (_, i) => {
    const t = i / 10; return V(-radius + radius * 2 * t, y - .075 * Math.sin(t * Math.PI), z);
  }), .023, material, 'magic-boss-friendly-smile');
}

function arm(root: THREE.Group, side: number, sleeve: Surface, handMaterial: Surface,
  trim: Surface, shoulderX: number) {
  const shoulder = new THREE.Group(); shoulder.name = side < 0 ? 'guardian-left-arm' : 'guardian-right-arm';
  shoulder.position.set(side * shoulderX, 1.65, .22); root.add(shoulder);
  attach(shoulder, new THREE.CapsuleGeometry(.095, .12, 8, 24), sleeve, 0, -.105, 0);
  const elbow = new THREE.Group(); elbow.position.set(0, -.20, .035); elbow.rotation.x = -.16; shoulder.add(elbow);
  attach(elbow, new THREE.CapsuleGeometry(.09, .11, 8, 24), sleeve, 0, -.095, 0);
  ring(elbow, .094, .018, trim, 0, -.195, 0).rotation.x = Math.PI / 2;
  const hand = new THREE.Group(); hand.name = side < 0 ? 'guardian-left-hand' : 'guardian-right-hand';
  hand.position.set(0, -.27, .045); elbow.add(hand);
  oval(hand, .118, handMaterial, 0, 0, 0, [.92, .96, .83], 'magic-boss-palm');
  for (const x of [-.055, -.018, .020, .057]) {
    const finger = attach(hand, new THREE.CapsuleGeometry(.027, .06, 5, 12), handMaterial,
      x, -.090, .025, 'magic-boss-finger'); finger.rotation.z = x * -1.2;
  }
  oval(hand, .044, handMaterial, side < 0 ? .085 : -.085, .005, .057, [.9, 1.2, .85], 'magic-boss-thumb');
  shoulder.rotation.z = side * .26;
  return { shoulder, hand };
}
function leg(root: THREE.Group, x: number, material: Surface, trim: Surface) {
  const group = new THREE.Group(); group.position.set(x, .67, 0); root.add(group);
  attach(group, new THREE.CapsuleGeometry(.12, .20, 8, 24), material, 0, -.20, 0);
  oval(group, .17, trim, 0, -.49, .055, [1.03, .73, 1.3], 'magic-boss-soft-foot');
  return group;
}
function finish(root: THREE.Group, head: THREE.Group, left: ReturnType<typeof arm>, right: ReturnType<typeof arm>,
  leftLeg: THREE.Group, rightLeg: THREE.Group, glow: Surface): CoverGuardianRig {
  const tip = new THREE.Object3D(); tip.name = 'guardian-spell-tip'; tip.position.set(0, -.018, .145); left.hand.add(tip);
  return { root, head, leftArm: left.shoulder, rightArm: right.shoulder, leftLeg, rightLeg, tip, glow };
}
function start(theme: number, identity: string) {
  const root = new THREE.Group(); root.name = 'original-theme-guardian-' + theme;
  root.userData.character = identity;
  const head = new THREE.Group(); head.name = 'magic-boss-head'; head.position.y = 2.17; root.add(head);
  return { root, head };
}

/** An enchanted wooden treasure chest, with a vaulted lid and arms emerging outside the box. */
export function createMagicChest(): CoverGuardianRig {
  const { root, head } = start(1, 'magic-chest');
  const glow = polished(0xf6a642, .30), gold = polished(0xeac778, .48);
  const wood = cloth(0x99603a, .65), darkWood = cloth(0x653c27, .77), ivory = cloth(0xfff2d9, .54);
  rounded(root, 1.22, 1.04, .83, wood, 0, 1.36, 0, .10, 'magic-chest-wooden-body');
  for (const y of [1.045, 1.31, 1.575]) rounded(root, 1.06, .20, .025, wood, 0, y, .432, .025, 'magic-chest-front-plank');
  for (const x of [-.46, .46]) rounded(root, .082, 1.01, .05, glow, x, 1.365, .445, .023, 'magic-chest-gold-binding');
  for (const y of [.87, 1.85]) rounded(root, 1.255, .085, .87, gold, 0, y, 0, .035, 'magic-chest-rim');
  for (const y of [1.165, 1.435]) {
    tube(root, [V(-.48, y, .452), V(-.22, y + .015, .458), V(.1, y - .005, .458), V(.47, y + .010, .452)], .006,
      darkWood, 'magic-chest-wood-grain');
  }
  // A half-cylinder along X creates a rounded wooden roof rather than a robot head.
  const vault = attach(head, new THREE.CylinderGeometry(.43, .43, 1.245, 64, 1, false, 0, Math.PI), wood,
    0, -.15, 0, 'magic-chest-vaulted-lid'); vault.rotation.z = Math.PI / 2;
  for (const x of [-.47, .47]) {
    const arc = Array.from({ length: 31 }, (_, i) => {
      const angle = i / 30 * Math.PI; return V(x, -.15 + Math.sin(angle) * .438, Math.cos(angle) * .438);
    });
    tube(head, arc, .026, glow, 'magic-chest-vault-binding');
  }
  rounded(head, 1.21, .070, .88, gold, 0, -.155, 0, .025, 'magic-chest-lid-edge');
  eyes(head, .018, .425);
  smile(head, -.126, .465, darkWood, .17);
  const lock = rounded(root, .30, .34, .055, gold, 0, 1.39, .474, .075, 'magic-chest-lock-plate'); lock.rotation.z = .05;
  oval(root, .059, darkWood, 0, 1.45, .514, [1, 1, .15], 'magic-chest-keyhole');
  rounded(root, .05, .085, .013, darkWood, 0, 1.39, .524, .012);
  for (const side of [-1, 1]) {
    const card = new THREE.Group(); card.position.set(side * .44, .52, -.17);
    card.rotation.set(-.10, side * .20, side * -.20); head.add(card);
    rounded(card, .32, .40, .034, ivory, 0, 0, 0, .025, 'magic-chest-floating-data-card');
    oval(card, .04, glow, -.066, .078, .033, [1, 1, .22]);
    for (const y of [.01, -.07]) rounded(card, .18, .015, .01, glow, .02, y, .025, .004);
    attach(card, starGeometry(.031), gold, .087, .13, .031);
  }
  const left = arm(root, -1, wood, glow, gold, .72), right = arm(root, 1, wood, glow, gold, .72);
  return finish(root, head, left, right, leg(root, -.24, darkWood, gold), leg(root, .24, darkWood, gold), glow);
}

function paperWing(head: THREE.Group, side: number, ivory: Surface, gold: Surface) {
  const wing = new THREE.Group(); wing.name = 'book-spirit-paper-wing'; wing.position.set(side * .59, -.21, -.02); head.add(wing);
  for (let leaf = 0; leaf < 4; leaf++) {
    const positions: number[] = [], indices: number[] = [], rows = 10, columns = 10;
    for (let row = 0; row <= rows; row++) {
      const v = row / rows;
      for (let column = 0; column <= columns; column++) {
        const u = column / columns;
        const x = side * (.50 * u + .010 * leaf), y = .17 * u + .29 * v - .024 * leaf;
        const z = -.035 * leaf + .08 * Math.sin(u * Math.PI) - .018 * v;
        positions.push(x, y, z);
        if (row < rows && column < columns) {
          const a = row * (columns + 1) + column, b = a + columns + 1;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); attach(wing, geometry, ivory, 0, 0, 0, 'book-spirit-curved-wing-page');
    tube(wing, [V(0, .29 - .024 * leaf, -.035 * leaf - .018), V(side * .24, .37 - .024 * leaf, .055 - .035 * leaf),
      V(side * (.50 + leaf * .01), .46 - .024 * leaf, -.035 * leaf - .018)], .006, gold, 'book-spirit-page-gilt');
  }
}

/** A thick leather-bound book with page wings and a face embossed into its front cover. */
export function createBookSpirit(): CoverGuardianRig {
  const { root, head } = start(2, 'book-spirit');
  const glow = polished(0x36b8c5, .08), leather = cloth(0x176c70, .70), gold = polished(0xe5c780, .40);
  const ivory = cloth(0xfff3d7, .82), pageShadow = cloth(0xd0bd93, .86), brown = cloth(0x715137, .67);
  ivory.side = THREE.DoubleSide;
  rounded(head, 1.13, 1.52, .34, ivory, .035, -.50, 0, .047, 'book-spirit-thick-page-block');
  rounded(head, 1.34, 1.70, .095, leather, 0, -.50, -.233, .075, 'book-spirit-back-cover');
  rounded(head, 1.34, 1.70, .10, glow, 0, -.50, .237, .075, 'book-spirit-leather-front-cover');
  rounded(head, .19, 1.70, .54, leather, -.619, -.50, 0, .075, 'book-spirit-rounded-spine');
  for (const y of [-1.26, -.73, -.22, .26]) rounded(head, .20, .064, .558, gold, -.619, y, 0, .023, 'book-spirit-spine-band');
  // Gilded borders lie outside the leather surface and match the title artwork.
  for (const x of [-.56, .56]) rounded(head, .035, 1.49, .02, gold, x, -.5, .301, .008, 'book-spirit-cover-gilt');
  for (const y of [-1.23, .23]) rounded(head, 1.12, .035, .02, gold, 0, y, .301, .008, 'book-spirit-cover-gilt');
  for (let line = 0; line < 10; line++) {
    rounded(head, .018, 1.37, .009, pageShadow, .608, -.51, -.135 + .030 * line, .003, 'book-spirit-page-edge');
  }
  eyes(head, -.01, .320);
  smile(head, -.227, .355, brown, .17);
  attach(head, starGeometry(.105), gold, 0, -.67, .318, 'book-spirit-story-star');
  for (const x of [-.37, .37]) {
    tube(head, [V(x, -.75, .319), V(x * .9, -.69, .327), V(x, -.59, .319)], .011, gold, 'book-spirit-leather-scroll');
  }
  paperWing(head, -1, ivory, gold); paperWing(head, 1, ivory, gold);
  const bookmark = rounded(head, .09, .29, .025, cloth(0xe79971), .30, -1.36, -.17, .025, 'book-spirit-bookmark');
  bookmark.rotation.z = -.13;
  const left = arm(root, -1, leather, glow, gold, .73), right = arm(root, 1, leather, glow, gold, .73);
  return finish(root, head, left, right, leg(root, -.25, brown, leather), leg(root, .25, brown, leather), glow);
}

function phantomCloak() {
  const positions: number[] = [], indices: number[] = [], rows = 32, columns = 64;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, y = .36 + t * 1.50;
    const radius = .56 * (1 - t) + .27 * t - .075 * Math.sin(t * Math.PI);
    for (let column = 0; column <= columns; column++) {
      const theta = column / columns * Math.PI * 2, fold = .026 * Math.sin(theta * 7) * (1 - t);
      positions.push(Math.sin(theta) * (radius + fold), y + .10 * Math.cos(theta * 5) * Math.pow(1 - t, 4),
        Math.cos(theta) * (radius + fold) - .045);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + columns + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
function theaterMask() {
  const shape = new THREE.Shape();
  shape.moveTo(0, .52); shape.bezierCurveTo(.23, .57, .48, .36, .46, .08);
  shape.bezierCurveTo(.43, -.28, .26, -.48, 0, -.59);
  shape.bezierCurveTo(-.26, -.48, -.43, -.28, -.46, .08);
  shape.bezierCurveTo(-.48, .36, -.23, .57, 0, .52); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .074, bevelEnabled: true, bevelSegments: 5,
    bevelThickness: .030, bevelSize: .027, curveSegments: 32 }); geometry.translate(0, 0, -.037); return geometry;
}

/** A floating purple cloak and expressive theatrical mask; no mechanical head, visor or joints. */
export function createMaskPhantom(): CoverGuardianRig {
  const { root, head } = start(4, 'mask-phantom');
  const glow = cloth(0x9c70d8, .83), shadow = cloth(0x443063, .89), gold = polished(0xe9c879, .43);
  const ivory = polished(0xffefd2, .05), brown = cloth(0x70412d, .58);
  glow.side = THREE.DoubleSide;
  attach(root, phantomCloak(), glow, 0, 0, 0, 'mask-phantom-floating-cloak');
  oval(head, .67, shadow, 0, .125, -.06, [1, 1.1, .87], 'mask-phantom-soft-hood');
  attach(head, theaterMask(), ivory, 0, .01, .570, 'mask-phantom-theater-mask');
  const edge = Array.from({ length: 49 }, (_, i) => {
    const theta = i / 48 * Math.PI * 2;
    return V(Math.sin(theta) * .527, .02 + Math.cos(theta) * .63, .465 - .035 * Math.cos(theta));
  });
  tube(head, edge, .023, gold, 'mask-phantom-hood-gold-edge', true);
  eyes(head, .07, .66, .20, true);
  smile(head, -.26, .66, brown, .125);
  for (const side of [-1, 1]) {
    tube(head, [V(side * .34, .27, .645), V(side * .23, .31, .648), V(side * .12, .28, .647)], .018,
      gold, 'mask-phantom-gold-eyebrow');
    attach(head, starGeometry(.060), gold, side * .35, -.16, .648, 'mask-phantom-mask-star');
  }
  const hem = Array.from({ length: 65 }, (_, i) => {
    const theta = i / 64 * Math.PI * 2, radius = .56 + .026 * Math.sin(theta * 7);
    return V(Math.sin(theta) * radius, .36 + .10 * Math.cos(theta * 5), Math.cos(theta) * radius - .045);
  });
  tube(root, hem, .018, gold, 'mask-phantom-floating-gold-hem', true);
  for (const side of [-1, 1]) {
    tube(root, [V(side * .16, 1.78, .234), V(side * .26, 1.28, .237), V(side * .46, .47, .298)], .020,
      gold, 'mask-phantom-cloak-trim');
    attach(root, starGeometry(.055), gold, side * .25, .74, .344, 'mask-phantom-cloak-star');
  }
  const left = arm(root, -1, glow, ivory, gold, .57), right = arm(root, 1, glow, ivory, gold, .57);
  const legs = [-1, 1].map(side => {
    const wisp = new THREE.Group(); wisp.position.set(side * .21, .35, -.02); root.add(wisp);
    tube(wisp, [V(0, .08, 0), V(side * .09, -.05, .045), V(side * .06, -.16, .03)], .050,
      glow, 'mask-phantom-floating-wisp');
    return wisp;
  });
  return finish(root, head, left, right, legs[0], legs[1], glow);
}
