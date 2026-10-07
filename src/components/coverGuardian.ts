import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** The same joint contract as the battle guardian, with entirely local geometry. */
export interface CoverGuardianRig {
  root: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  tip: THREE.Object3D;
  glow: THREE.MeshStandardMaterial;
}

const themeColors = [0xf6a642, 0x36b8c5, 0x6d91e5, 0x9c70d8, 0xe67970, 0x637dda];
type Surface = THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial;

function metal(color: number, options: THREE.MeshPhysicalMaterialParameters = {}) {
  return new THREE.MeshPhysicalMaterial({ color, metalness: .48, roughness: .29,
    clearcoat: .65, clearcoatRoughness: .22, ...options });
}

function attach(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: Surface,
  x = 0, y = 0, z = 0, name = '') {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.name = name;
  object.castShadow = !material.transparent;
  object.receiveShadow = material instanceof THREE.MeshPhysicalMaterial;
  parent.add(object);
  return object;
}

function oval(parent: THREE.Object3D, radius: number, surface: Surface,
  x = 0, y = 0, z = 0, name = '') {
  return attach(parent, new THREE.SphereGeometry(radius, 28, 20), surface, x, y, z, name);
}

function rounded(parent: THREE.Object3D, w: number, h: number, d: number, surface: Surface,
  x = 0, y = 0, z = 0, radius = .12, name = '') {
  return attach(parent, new RoundedBoxGeometry(w, h, d, 5, radius), surface, x, y, z, name);
}

function headFront(radius: number, x: number, y: number) {
  return radius * .78 * Math.sqrt(Math.max(.025,
    1 - (x / radius) ** 2 - (y / (radius * .85)) ** 2));
}

function facePanel(parent: THREE.Object3D, w: number, h: number, depth: number,
  surface: Surface, y: number, headRadius: number, lift: number, name: string) {
  // A densely sampled oval follows the ellipsoid at every point, including its
  // centre. Bending only an extruded outline would leave large flat triangles
  // across the middle and allow the spherical head to poke through the visor.
  const segments = 64, rings = 10, vertices: number[] = [], indices: number[] = [];
  for (const offset of [lift, lift - depth]) {
    vertices.push(0, 0, headFront(headRadius, 0, y) + offset);
    for (let radial = 1; radial <= rings; radial++) {
      for (let segment = 0; segment < segments; segment++) {
        const angle = segment * Math.PI * 2 / segments;
        const x = w / 2 * radial / rings * Math.cos(angle);
        const localY = h / 2 * radial / rings * Math.sin(angle);
        vertices.push(x, localY, headFront(headRadius, x, localY + y) + offset);
      }
    }
  }
  const layerSize = 1 + rings * segments;
  for (let layer = 0; layer < 2; layer++) {
    const base = layer * layerSize;
    const triangle = (a: number, b: number, c: number) => {
      indices.push(...(layer === 0 ? [base + a, base + b, base + c] : [base + c, base + b, base + a]));
    };
    for (let segment = 0; segment < segments; segment++) triangle(0, 1 + segment, 1 + (segment + 1) % segments);
    for (let radial = 2; radial <= rings; radial++) {
      const inner = 1 + (radial - 2) * segments, outer = inner + segments;
      for (let segment = 0; segment < segments; segment++) {
        const next = (segment + 1) % segments;
        triangle(inner + segment, outer + segment, outer + next);
        triangle(inner + segment, outer + next, inner + next);
      }
    }
  }
  const edge = 1 + (rings - 1) * segments;
  for (let segment = 0; segment < segments; segment++) {
    const a = edge + segment, b = edge + (segment + 1) % segments;
    indices.push(a, a + layerSize, b + layerSize, a, b + layerSize, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return attach(parent, geometry, surface, 0, y, 0, name);
}

function ring(parent: THREE.Object3D, radius: number, tube: number, surface: Surface,
  x = 0, y = 0, z = 0, name = '') {
  return attach(parent, new THREE.TorusGeometry(radius, tube, 10, 48), surface, x, y, z, name);
}

function cylinder(parent: THREE.Object3D, top: number, bottom: number, height: number,
  surface: Surface, x = 0, y = 0, z = 0, name = '') {
  return attach(parent, new THREE.CylinderGeometry(top, bottom, height, 24), surface, x, y, z, name);
}

function capsule(parent: THREE.Object3D, radius: number, length: number, surface: Surface,
  x = 0, y = 0, z = 0, name = '') {
  return attach(parent, new THREE.CapsuleGeometry(radius, length, 6, 14), surface, x, y, z, name);
}

function starGeometry(radius: number) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI / 5 + Math.PI / 2;
    const r = i % 2 ? radius * .46 : radius;
    if (i === 0) shape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    else shape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .035, bevelEnabled: true,
    bevelSize: .014, bevelThickness: .014, bevelSegments: 3, curveSegments: 6 });
  geometry.translate(0, 0, -.0175);
  return geometry;
}

function screw(parent: THREE.Object3D, trim: Surface, dark: Surface, x: number, y: number, z: number) {
  const cap = cylinder(parent, .036, .036, .018, trim, x, y, z, 'guardian-screw');
  cap.rotation.x = Math.PI / 2; cap.castShadow = false;
  const slot = rounded(parent, .040, .009, .010, dark, x, y, z + .012, .003);
  slot.rotation.z = -.35; slot.castShadow = false;
}

function makeArm(parent: THREE.Group, side: number, shell: Surface, gold: Surface, joint: Surface) {
  // The animation still rotates one shoulder along local -Y. The elbow's small
  // permanent forward bend leaves the glove visible rather than inside the torso.
  const shoulder = new THREE.Group();
  shoulder.name = side < 0 ? 'guardian-left-arm' : 'guardian-right-arm';
  shoulder.position.set(side * .55, 1.65, .12); parent.add(shoulder);
  oval(shoulder, .175, joint);
  const shoulderCap = oval(shoulder, .17, shell, side * .055, .012, .035);
  shoulderCap.scale.set(.78, .94, .88);
  capsule(shoulder, .12, .12, shell, 0, -.14, .02);
  const elbow = new THREE.Group(); elbow.position.set(0, -.29, .035);
  elbow.rotation.x = -.14; shoulder.add(elbow);
  oval(elbow, .12, joint);
  const jointPin = cylinder(elbow, .055, .055, .245, gold);
  jointPin.rotation.z = Math.PI / 2;
  capsule(elbow, .13, .10, shell, 0, -.16, .01);
  const cuff = cylinder(elbow, .145, .155, .075, joint, 0, -.28, .01);
  cuff.name = 'guardian-wrist-joint';
  ring(elbow, .145, .015, gold, 0, -.255, .01).rotation.x = Math.PI / 2;
  const hand = new THREE.Group();
  hand.name = side < 0 ? 'guardian-left-hand' : 'guardian-right-hand';
  hand.position.set(0, -.37, .045); elbow.add(hand);
  const palm = oval(hand, .16, shell, 0, 0, 0, 'guardian-palm');
  palm.scale.set(1, 1.05, .76);
  for (const x of [-.105, -.035, .035, .105]) {
    const finger = capsule(hand, .039, .070, shell, x, -.13, .015, 'guardian-finger');
    finger.rotation.x = -.18;
  }
  const thumb = capsule(hand, .054, .065, shell, side * .165, -.015, .055, 'guardian-thumb');
  thumb.rotation.z = side * .65;
  shoulder.rotation.z = side * .26;
  return { shoulder, hand };
}

function makeLeg(parent: THREE.Group, x: number, shell: Surface, gold: Surface, joint: Surface) {
  const pivot = new THREE.Group(); pivot.position.set(x, .84, 0); parent.add(pivot);
  oval(pivot, .14, joint, 0, -.02, 0);
  capsule(pivot, .115, .12, joint, 0, -.17, .01);
  oval(pivot, .125, shell, 0, -.31, .065);
  ring(pivot, .117, .017, gold, 0, -.31, .025).rotation.x = Math.PI / 2;
  rounded(pivot, .45, .41, .59, shell, 0, -.59, .09, .15, 'guardian-rounded-boot');
  const toe = oval(pivot, .18, shell, 0, -.62, .25); toe.scale.set(1.14, .68, .80);
  rounded(pivot, .47, .085, .61, joint, 0, -.7975, .10, .04, 'guardian-sole');
  rounded(pivot, .47, .027, .60, gold, 0, -.751, .10, .012);
  return pivot;
}

function makeBadge(root: THREE.Group, theme: number, gold: Surface, navy: Surface,
  ivory: Surface, lamp: Surface) {
  const badge = new THREE.Group(); badge.position.set(0, 1.28, .405); root.add(badge);
  badge.name = 'guardian-theme-badge-' + theme;
  if (theme === 5) {
    badge.name = 'guardian-book';
    for (const side of [-1, 1]) {
      const page = rounded(badge, .31, .48, .065, ivory, side * .16, .045, .055, .05);
      page.rotation.y = side * .12;
      for (let row = 0; row < 3; row++) {
        rounded(badge, .18, .018, .009, navy, side * .16, -.07 + row * .09, .105, .005);
      }
    }
    rounded(badge, .035, .50, .085, gold, 0, .04, .05, .015);
    return;
  }
  cylinder(badge, .305, .305, .042, ivory, 0, 0, .025).rotation.x = Math.PI / 2;
  ring(badge, .30, .030, gold, 0, 0, .052);
  if (theme === 1) {
    const magnifier = new THREE.Group(); magnifier.name = 'guardian-magnifier'; badge.add(magnifier);
    ring(magnifier, .14, .032, gold, -.025, .055, .071);
    capsule(magnifier, .035, .13, gold, .115, -.092, .073).rotation.z = Math.PI / 4;
  } else if (theme === 3) {
    const dots = new THREE.Group(); dots.name = 'guardian-sorting-lights'; badge.add(dots);
    for (const [x, surface] of [[-.16, navy], [0, lamp], [.16, gold]] as const) {
      oval(dots, .064, surface, x, .005, .092).scale.z = .55;
    }
  } else if (theme === 4) {
    attach(badge, new THREE.OctahedronGeometry(.18, 1), metal(0xded2fa, { metalness: .20, roughness: .15 }),
      0, .01, .095, 'guardian-truth-crystal');
  } else {
    attach(badge, starGeometry(.19), navy, 0, .005, .085, 'guardian-star-emblem');
  }
}

/** Rounded title-cover robot, recoloured and marked for each of the six missions. */
export function createCoverGuardian(theme: number): CoverGuardianRig {
  const safeTheme = Math.max(1, Math.min(6, Math.trunc(theme) || 1));
  const root = new THREE.Group(); root.name = 'original-theme-guardian-' + safeTheme;
  const shell = metal(themeColors[safeTheme - 1]);
  const gold = metal(0xffce78, { metalness: .58, roughness: .25 });
  const navy = metal(0x24354c, { metalness: .30, roughness: .38 });
  const ivory = metal(0xfff3d8, { metalness: .15, roughness: .40 });
  const steel = metal(0x8197a9, { metalness: .65, roughness: .25 });
  const lamp = metal(0xffe69a, { metalness: .05, roughness: .22, emissive: 0xffbd4a,
    emissiveIntensity: 1.6, toneMapped: false });
  const glass = metal(0x112639, { metalness: .12, roughness: .13,
    clearcoat: 1, clearcoatRoughness: .08 });
  const glint = new THREE.MeshBasicMaterial({ color: 0xe8faff, transparent: true, opacity: .24, depthWrite: false });

  const body = oval(root, .52, shell, 0, 1.24, 0, 'guardian-body-shell');
  body.scale.set(1, 1.15, .77);
  const bodySeam = ring(root, .497, .023, gold, 0, 1.07, 0);
  bodySeam.rotation.x = Math.PI / 2; bodySeam.scale.y = .77;
  const collar = cylinder(root, .24, .27, .12, navy, 0, 1.82, 0); collar.name = 'guardian-neck-joint';
  ring(root, .245, .021, gold, 0, 1.88, 0).rotation.x = Math.PI / 2;
  if (safeTheme === 3) {
    const band = ring(root, .465, .034, metal(0x72c8a8), 0, 1.46, 0);
    band.rotation.x = Math.PI / 2; band.scale.y = .76;
  }
  makeBadge(root, safeTheme, gold, navy, ivory, lamp);
  for (const x of [-.32, .32]) screw(root, gold, navy, x, 1.55, .329);

  const head = new THREE.Group(); head.position.y = 2.17; root.add(head);
  const headRadius = safeTheme === 6 ? .72 : .69;
  const headShell = oval(head, headRadius, shell, 0, 0, 0, 'guardian-metal-head');
  headShell.scale.set(1, .85, .78);
  facePanel(head, 1.20, .79, .05, gold, -.035, headRadius, .049, 'guardian-visor-bezel');
  facePanel(head, 1.09, .685, .035, glass, -.035, headRadius, .075, 'guardian-glass-visor');
  for (const x of [-.235, .235]) {
    const front = headFront(headRadius, x, .065);
    const eye = oval(head, .115, lamp, x, .065, front + .116, 'guardian-warm-eye');
    eye.scale.set(.72, 1.25, .35); eye.castShadow = false;
    const normal = new THREE.Vector3(x / headRadius ** 2, .065 / (headRadius * .85) ** 2,
      front / (headRadius * .78) ** 2).normalize();
    eye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const reflection = oval(head, .018, ivory, x - .018, .114, headFront(headRadius, x - .018, .114) + .151);
    reflection.castShadow = false;
  }
  const mouth = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => {
    const amount = i / 8, x = -.15 + .30 * amount, y = -.115 - .135 * Math.sin(amount * Math.PI);
    return new THREE.Vector3(x, y, headFront(headRadius, x, y) + .111);
  }));
  const smile = attach(head, new THREE.TubeGeometry(mouth, 28, .026, 8, false), lamp, 0, 0, 0, 'guardian-friendly-smile');
  smile.castShadow = false;
  const reflectionCurve = new THREE.CatmullRomCurve3(Array.from({ length: 6 }, (_, i) => {
    const x = -.33 + i * .034, y = .20 + i * .008;
    return new THREE.Vector3(x, y, headFront(headRadius, x, y) + .086);
  }));
  const glassReflection = attach(head, new THREE.TubeGeometry(reflectionCurve, 16, .006, 6, false), glint);
  glassReflection.castShadow = false;
  for (const side of [-1, 1]) {
    const ear = cylinder(head, .17, .17, .13, navy, side * .728, -.018, -.015);
    ear.rotation.z = Math.PI / 2;
    const pin = cylinder(head, .098, .098, .015, gold, side * .802, -.018, -.015);
    pin.rotation.z = Math.PI / 2;
    for (const y of [-.225, .225]) screw(head, gold, navy, side * .575, y, headFront(headRadius, side * .575, y) + .018);
  }
  if (safeTheme === 4) {
    const light = new THREE.MeshBasicMaterial({ color: 0xc5adff, transparent: true, opacity: .72,
      depthWrite: false, blending: THREE.AdditiveBlending });
    const halo = ring(head, .85, .028, light, 0, .04, -.12, 'guardian-halo');
    halo.rotation.y = .28; halo.rotation.x = .12; halo.castShadow = false;
    const mask = rounded(head, .30, .20, .045, ivory, -.40, -.185,
      headFront(headRadius, -.40, -.185) + .095, .08, 'guardian-mask');
    mask.rotation.z = -.3;
  } else if (safeTheme === 2) {
    const cap = rounded(head, 1.11, .135, .78, gold, 0, .535, -.01, .055, 'guardian-library-cap');
    cap.rotation.z = .055;
    rounded(head, .07, .21, .06, gold, .405, .415, .335, .028);
  } else if (safeTheme === 5) {
    const pen = new THREE.Group(); pen.name = 'guardian-learning-pencil'; head.add(pen);
    pen.position.set(.19, .55, 0); pen.rotation.z = -.26;
    cylinder(pen, .045, .045, .39, gold, 0, .15, 0);
    attach(pen, new THREE.ConeGeometry(.046, .14, 16), navy, 0, .415, 0);
  } else {
    const antennas = new THREE.Group();
    antennas.name = safeTheme === 6 ? 'guardian-triple-antenna' : 'guardian-antenna'; head.add(antennas);
    const positions = safeTheme === 6 ? [-.25, 0, .25] : [0];
    for (const x of positions) {
      cylinder(antennas, .038, .042, .18, navy, x, .60, -.02);
      oval(antennas, .093, gold, x, .765, -.02);
    }
  }
  const left = makeArm(root, -1, shell, gold, navy);
  const right = makeArm(root, 1, shell, gold, navy);
  if (safeTheme === 5) {
    for (const side of [-1, 1]) {
      const helper = makeArm(root, side, gold, steel, navy);
      helper.shoulder.name = 'guardian-book-helper-arm';
      helper.shoulder.position.set(side * .45, 1.08, -.08);
      helper.shoulder.scale.setScalar(.52); helper.shoulder.rotation.z = side * .82;
    }
  }
  const tip = new THREE.Object3D(); tip.name = 'guardian-spell-tip';
  tip.position.set(0, -.018, .145); left.hand.add(tip);
  return { root, head, leftArm: left.shoulder, rightArm: right.shoulder,
    leftLeg: makeLeg(root, -.23, shell, gold, navy), rightLeg: makeLeg(root, .23, shell, gold, navy),
    tip, glow: shell };
}
