import * as THREE from 'three';
import type { CoverGuardianRig } from './coverGuardian';

type Surface = THREE.MeshStandardMaterial;
const coral = 0xe67970, indigo = 0x637dda;

function material(color: number, options: THREE.MeshPhysicalMaterialParameters = {}): Surface {
  return new THREE.MeshPhysicalMaterial({ color, roughness: .68, metalness: 0,
    clearcoat: .08, clearcoatRoughness: .55, ...options });
}
function put(parent: THREE.Object3D, geometry: THREE.BufferGeometry, surface: Surface,
  x = 0, y = 0, z = 0, name = '') {
  const object = new THREE.Mesh(geometry, surface); object.position.set(x, y, z); object.name = name;
  object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
}
function oval(parent: THREE.Object3D, radius: number, surface: Surface,
  x = 0, y = 0, z = 0, name = '', scale: [number, number, number] = [1, 1, 1]) {
  const object = put(parent, new THREE.SphereGeometry(radius, 28, 20), surface, x, y, z, name);
  object.scale.set(...scale); return object;
}
function capsule(parent: THREE.Object3D, radius: number, length: number, surface: Surface,
  x = 0, y = 0, z = 0, name = '') {
  return put(parent, new THREE.CapsuleGeometry(radius, length, 6, 14), surface, x, y, z, name);
}
function stroke(parent: THREE.Object3D, points: THREE.Vector3[], surface: Surface, radius = .014, name = '') {
  return put(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, radius, 8, false), surface, 0, 0, 0, name);
}
function ring(parent: THREE.Object3D, radius: number, tube: number, surface: Surface, x = 0, y = 0, z = 0) {
  return put(parent, new THREE.TorusGeometry(radius, tube, 10, 40), surface, x, y, z);
}
function gearGeometry(radius: number, holeRadius: number, depth: number) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 48; i++) {
    const angle = i * Math.PI * 2 / 48, r = i % 4 === 1 || i % 4 === 2 ? radius : radius * .80;
    if (!i) shape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    else shape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  shape.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, holeRadius, 0, Math.PI * 2, true); shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true,
    bevelSize: .008, bevelThickness: .008, bevelSegments: 3, curveSegments: 12 });
  geometry.translate(0, 0, -depth / 2); return geometry;
}

function eyes(head: THREE.Group, irisColor: number, x: number, faceZ: number) {
  const white = material(0xfff5de, { roughness: .32, clearcoat: .45 });
  const iris = material(irisColor, { roughness: .30, clearcoat: .5 });
  const pupil = material(0x251d20, { roughness: .23, clearcoat: .65 });
  for (const side of [-1, 1]) {
    oval(head, .136, white, side * x, .085, faceZ, 'beast-eye-white', [.88, 1.13, .43]);
    oval(head, .084, iris, side * x + .008, .085, faceZ + .055, 'beast-brown-iris', [.86, 1.06, .37]);
    oval(head, .048, pupil, side * x + .012, .085, faceZ + .082, 'beast-pupil', [.86, 1.14, .35]);
    oval(head, .020, white, side * x - .014, .122, faceZ + .102, 'beast-eye-catchlight');
    oval(head, .009, white, side * x + .034, .064, faceZ + .103);
  }
}

function pawArm(root: THREE.Group, side: number, sleeve: Surface, pawSurface: Surface,
  accent: Surface, dragon: boolean) {
  const arm = new THREE.Group(); arm.position.set(side * .50, 1.65, .15); root.add(arm);
  arm.name = side < 0 ? 'beast-left-arm' : 'beast-right-arm';
  oval(arm, .15, sleeve, 0, -.015, 0);
  capsule(arm, .135, .12, sleeve, 0, -.16, .015);
  oval(arm, .12, pawSurface, 0, -.30, .035);
  capsule(arm, .12, .11, pawSurface, 0, -.38, .07);
  const palm = new THREE.Group(); palm.position.set(0, -.55, .105); arm.add(palm);
  palm.name = side < 0 ? 'beast-left-palm' : 'beast-right-palm';
  oval(palm, .16, pawSurface, 0, 0, 0, 'beast-paw', [1, 1.05, .85]);
  for (const x of [-.09, 0, .09]) {
    oval(palm, .064, pawSurface, x, -.115, .030, 'beast-toe');
    if (dragon) {
      const claw = put(palm, new THREE.ConeGeometry(.039, .11, 8), accent, x, -.128, .112, 'paper-dragon-claw');
      claw.rotation.x = Math.PI / 2;
    } else oval(palm, .026, accent, x, -.118, .085, 'lion-paw-pad', [1, 1, .45]);
  }
  if (!dragon) oval(palm, .066, accent, 0, -.010, .135, 'lion-palm-pad', [.85, 1, .40]);
  arm.rotation.z = side * .26;
  return { arm, palm };
}
function pawLeg(root: THREE.Group, x: number, fur: Surface, accent: Surface, dragon: boolean) {
  const leg = new THREE.Group(); leg.position.set(x, .84, 0); root.add(leg);
  capsule(leg, .14, .19, fur, 0, -.20, 0);
  oval(leg, .15, fur, 0, -.42, .02);
  oval(leg, .23, fur, 0, -.69, .10, 'beast-grounded-foot', [1.05, .65, 1.17]);
  for (const toe of [-.10, 0, .10]) {
    oval(leg, .075, fur, toe, -.68, .27, 'beast-foot-toe', [1, .80, 1]);
    if (dragon) {
      const claw = put(leg, new THREE.ConeGeometry(.036, .105, 8), accent, toe, -.69, .345);
      claw.rotation.x = Math.PI / 2;
    }
  }
  return leg;
}
function makeTip(palm: THREE.Group) {
  const tip = new THREE.Object3D(); tip.name = 'beast-spell-tip'; tip.position.set(0, -.018, .20); palm.add(tip); return tip;
}

function paperWing(root: THREE.Group, side: number, cream: Surface, pale: Surface, edge: Surface) {
  const wing = new THREE.Group(); wing.name = side < 0 ? 'paper-dragon-left-wing' : 'paper-dragon-right-wing';
  wing.position.set(side * .38, 1.46, -.17); root.add(wing);
  const outline = [[0, 0, 0], [.25, .35, -.035], [.64, .32, -.07], [.72, .10, -.02],
    [.63, -.18, -.075], [.27, -.26, -.015]];
  for (let page = 0; page < 2; page++) {
    const vertices: number[] = [], centre = [side * .28, .045, .085 - page * .045];
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      const points = [centre, [side * (a[0] + page * .017), a[1] - page * .025, a[2] - page * .045],
        [side * (b[0] + page * .017), b[1] - page * .025, b[2] - page * .045]];
      if (side < 0) points.reverse();
      vertices.push(...points.flat());
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    const surface = (page ? pale : cream).clone(); surface.side = THREE.DoubleSide; surface.flatShading = true;
    put(wing, geometry, surface, 0, 0, 0, 'paper-wing-folds');
  }
  for (const point of outline.slice(1)) {
    stroke(wing, [new THREE.Vector3(side * .28, .045, .096),
      new THREE.Vector3(side * point[0], point[1], point[2] + .012)], edge, .009, 'paper-wing-crease');
  }
}

/** Coral origami dragon: paper fans, organic face, claws, and a hexagonal pencil tail. */
export function createPaperDragon(): CoverGuardianRig {
  const root = new THREE.Group(); root.name = 'original-theme-guardian-5';
  root.userData = { characterName: '代寫紙龍', creature: 'paper-dragon', theme: 5 };
  const shell = material(coral), cream = material(0xfff0d7, { roughness: .80 });
  const pale = material(0xf5c8ac, { roughness: .80 }), dark = material(0x6e3d42);
  oval(root, .46, shell, 0, 1.22, 0, 'paper-dragon-body', [.94, 1.29, .84]);
  oval(root, .36, cream, 0, 1.16, .295, 'paper-dragon-folded-belly', [.78, 1.22, .28]);
  for (let i = 0; i < 3; i++) {
    stroke(root, [new THREE.Vector3(-.20 + i * .015, .95 + i * .15, .376),
      new THREE.Vector3(0, .985 + i * .15, .403), new THREE.Vector3(.20 - i * .015, .95 + i * .15, .376)], pale, .009);
  }
  paperWing(root, -1, cream, pale, shell); paperWing(root, 1, cream, pale, shell);
  const tailPoints = [new THREE.Vector3(0, .88, -.19), new THREE.Vector3(.40, .85, -.25),
    new THREE.Vector3(.75, 1.08, -.24), new THREE.Vector3(.91, 1.31, -.19)];
  stroke(root, tailPoints, shell, .063, 'paper-dragon-tail');
  const pencil = new THREE.Group(); pencil.name = 'paper-dragon-pencil-tail';
  pencil.position.copy(tailPoints[3]); pencil.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
    tailPoints[3].clone().sub(tailPoints[2]).normalize()); root.add(pencil);
  put(pencil, new THREE.CylinderGeometry(.058, .058, .28, 6), shell, 0, .13, 0);
  put(pencil, new THREE.ConeGeometry(.058, .13, 6), cream, 0, .325, 0);
  put(pencil, new THREE.ConeGeometry(.029, .068, 6), dark, 0, .415, 0);
  ring(pencil, .058, .012, cream, 0, .015, 0).rotation.x = Math.PI / 2;

  const head = new THREE.Group(); head.position.y = 2.17; root.add(head);
  oval(head, .58, shell, 0, 0, 0, 'paper-dragon-head', [1, .94, .87]);
  eyes(head, 0xa76735, .215, .485);
  oval(head, .29, cream, 0, -.195, .457, 'paper-dragon-muzzle', [1.30, .70, .74]);
  for (const side of [-1, 1]) {
    oval(head, .026, dark, side * .12, -.112, .653, 'paper-dragon-nostril', [1, .80, .40]);
    const horn = put(head, new THREE.ConeGeometry(.095, .36, 6), cream, side * .34, .49, -.075, 'paper-dragon-paper-horn');
    horn.rotation.z = -side * .27;
    const ear = new THREE.BufferGeometry();
    ear.setAttribute('position', new THREE.Float32BufferAttribute([side * .46, .25, .01,
      side * .70, .38, -.06, side * .59, .065, .09], 3)); ear.computeVertexNormals();
    const paper = pale.clone(); paper.side = THREE.DoubleSide;
    put(head, ear, paper, 0, 0, 0, 'paper-dragon-folded-ear');
    stroke(head, [new THREE.Vector3(side * .31, .295, .406), new THREE.Vector3(side * .20, .325, .453),
      new THREE.Vector3(side * .11, .285, .475)], dark, .019, 'paper-dragon-brow');
  }
  stroke(head, [new THREE.Vector3(-.14, -.23, .657), new THREE.Vector3(-.07, -.30, .681),
    new THREE.Vector3(0, -.322, .682), new THREE.Vector3(.07, -.30, .681),
    new THREE.Vector3(.14, -.23, .657)], dark, .016, 'paper-dragon-smile');
  const left = pawArm(root, -1, shell, shell, cream, true), right = pawArm(root, 1, shell, shell, cream, true);
  return { root, head, leftArm: left.arm, rightArm: right.arm,
    leftLeg: pawLeg(root, -.21, shell, cream, true), rightLeg: pawLeg(root, .21, shell, cream, true),
    tip: makeTip(left.palm), glow: shell };
}

/** A living royal lion in an indigo coat: fur, mane, paws, cape, and a gear crown. */
export function createGearKing(): CoverGuardianRig {
  const root = new THREE.Group(); root.name = 'original-theme-guardian-6';
  root.userData = { characterName: '全能齒輪王', creature: 'royal-lion', theme: 6 };
  const robe = material(indigo), fur = material(0xead0a0), muzzle = material(0xffedce);
  const mane = material(0x9c633e), maneLight = material(0xb97a47), dark = material(0x653c2e);
  const gold = material(0xf2c66e, { metalness: .48, roughness: .29, clearcoat: .38 });
  oval(root, .46, robe, 0, 1.22, 0, 'lion-royal-coat', [1, 1.27, .83]);
  const capeSurface = material(0x354588); capeSurface.side = THREE.DoubleSide;
  put(root, new THREE.CylinderGeometry(.33, .54, 1.07, 30, 6, true, Math.PI * .6, Math.PI * .8),
    capeSurface, 0, 1.08, -.08, 'lion-royal-cape');
  for (let i = 0; i < 7; i++) {
    const angle = Math.PI * .62 + i * Math.PI * .76 / 6;
    oval(root, .095, muzzle, Math.sin(angle) * .34, 1.68, Math.cos(angle) * .34 - .04, 'lion-fur-collar');
  }
  put(root, gearGeometry(.22, .105, .045), gold, 0, 1.28, .413, 'lion-gear-medallion');
  oval(root, .09, robe, 0, 1.28, .424, 'lion-medallion-centre', [1, 1, .24]);
  for (const side of [-1, 1]) {
    stroke(root, [new THREE.Vector3(side * .22, 1.70, .175), new THREE.Vector3(side * .17, 1.48, .375),
      new THREE.Vector3(side * .115, 1.40, .44)], gold, .015, 'lion-medallion-chain');
  }
  stroke(root, [new THREE.Vector3(0, .85, -.19), new THREE.Vector3(.42, .78, -.33),
    new THREE.Vector3(.65, 1.00, -.30), new THREE.Vector3(.76, 1.10, -.26)], fur, .042, 'lion-tail');
  oval(root, .14, mane, .77, 1.11, -.26, 'lion-tail-tuft', [.78, 1.15, .83]);

  const head = new THREE.Group(); head.position.y = 2.17; root.add(head);
  const maneGroup = new THREE.Group(); maneGroup.name = 'lion-fur-mane'; head.add(maneGroup);
  for (let i = 0; i < 14; i++) {
    const angle = i * Math.PI * 2 / 14;
    const tuft = oval(maneGroup, .16, i % 3 ? mane : maneLight,
      Math.cos(angle) * .52, Math.sin(angle) * .49, -.12, 'lion-mane-tuft', [.92, 1.35, .88]);
    tuft.rotation.z = angle - Math.PI / 2;
  }
  oval(head, .52, fur, 0, 0, .025, 'lion-organic-head', [1, .96, .90]);
  for (const side of [-1, 1]) {
    oval(head, .165, fur, side * .43, .36, -.04, 'lion-rounded-ear', [1, 1.05, .55]);
    oval(head, .105, maneLight, side * .43, .36, .035, 'lion-inner-ear', [1, 1, .40]);
  }
  eyes(head, 0x8d522a, .20, .457);
  for (const side of [-1, 1]) {
    oval(head, .21, muzzle, side * .14, -.17, .45, 'lion-soft-muzzle', [1.16, .80, .74]);
    stroke(head, [new THREE.Vector3(side * .10, .29, .436), new THREE.Vector3(side * .20, .326, .414),
      new THREE.Vector3(side * .30, .285, .394)], mane, .023, 'lion-brow');
    for (let dot = 0; dot < 3; dot++) oval(head, .012, dark, side * (.20 + dot * .035), -.153 - dot * .024, .604, 'lion-whisker-dot');
    stroke(head, [new THREE.Vector3(0, -.14, .616), new THREE.Vector3(side * .05, -.235, .606),
      new THREE.Vector3(side * .115, -.245, .578)], dark, .015, 'lion-smile');
  }
  oval(head, .108, dark, 0, -.068, .603, 'lion-rounded-nose', [1.08, .74, .73]);
  ring(head, .29, .043, gold, 0, .57, .005).rotation.x = Math.PI / 2;
  const crown = new THREE.Group(); crown.name = 'lion-gear-crown'; head.add(crown);
  put(crown, gearGeometry(.205, .073, .04), gold, 0, .77, .26);
  oval(crown, .058, robe, 0, .77, .286, 'lion-crown-jewel', [.90, 1, .60]);
  for (const side of [-1, 1]) {
    const prong = put(crown, new THREE.ConeGeometry(.071, .17, 6), gold, side * .23, .675, .07);
    prong.rotation.z = -side * .12;
  }
  const left = pawArm(root, -1, robe, fur, dark, false), right = pawArm(root, 1, robe, fur, dark, false);
  return { root, head, leftArm: left.arm, rightArm: right.arm,
    leftLeg: pawLeg(root, -.21, fur, dark, false), rightLeg: pawLeg(root, .21, fur, dark, false),
    tip: makeTip(left.palm), glow: robe };
}
