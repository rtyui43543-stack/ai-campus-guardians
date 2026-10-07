import * as THREE from 'three';
import { poseMage, type MageArticulation } from './magePose';

export interface CoverHeroRig extends MageArticulation {
  root: THREE.Group;
  head: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  tip: THREE.Object3D;
  glow: THREE.MeshStandardMaterial;
}

type Surface = THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;

function material(color: THREE.ColorRepresentation, roughness = .62, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function add(parent: THREE.Object3D, geometry: THREE.BufferGeometry, surface: Surface,
  x = 0, y = 0, z = 0, name = '') {
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.position.set(x, y, z); mesh.name = name;
  mesh.castShadow = true; mesh.receiveShadow = surface instanceof THREE.MeshStandardMaterial;
  parent.add(mesh); return mesh;
}

function sphere(parent: THREE.Object3D, radius: number, surface: Surface,
  x = 0, y = 0, z = 0, scale: readonly [number, number, number] = [1, 1, 1], name = '') {
  const mesh = add(parent, new THREE.SphereGeometry(radius, 32, 24), surface, x, y, z, name);
  mesh.scale.set(...scale); return mesh;
}

function tube(parent: THREE.Object3D, points: readonly THREE.Vector3[], radius: number, surface: Surface,
  name = '', closed = false, segments = 40) {
  const curve = new THREE.CatmullRomCurve3([...points], closed, 'catmullrom', .3);
  return add(parent, new THREE.TubeGeometry(curve, segments, radius, 10, closed), surface, 0, 0, 0, name);
}

function torus(parent: THREE.Object3D, radius: number, thickness: number, surface: Surface,
  x = 0, y = 0, z = 0, name = '') {
  return add(parent, new THREE.TorusGeometry(radius, thickness, 12, 64), surface, x, y, z, name);
}

function star(radius: number) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5, length = radius * (i % 2 ? .44 : 1);
    const x = Math.cos(angle) * length, y = Math.sin(angle) * length;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .026, bevelEnabled: true,
    bevelSize: .008, bevelThickness: .008, bevelSegments: 3, curveSegments: 8 });
  geometry.translate(0, 0, -.013); return geometry;
}

/** Variable-radius soft volume following a curved centreline; no pointed cone primitive. */
function softVolume(points: readonly THREE.Vector3[], radii: readonly number[], depth = 1,
  rows = 40, radialSegments = 48, folds = 0) {
  const curve = new THREE.CatmullRomCurve3([...points], false, 'catmullrom', .35);
  const vertices: number[] = [], uvs: number[] = [], indices: number[] = [];
  const forward = new THREE.Vector3(0, 0, 1);
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, position = curve.getPoint(t), tangent = curve.getTangent(t);
    const axis = forward.clone().cross(tangent).normalize();
    const crossAxis = tangent.clone().cross(axis).normalize();
    const index = t * (radii.length - 1), lower = Math.min(radii.length - 2, Math.floor(index));
    const radius = THREE.MathUtils.lerp(radii[lower], radii[lower + 1], index - lower);
    for (let column = 0; column <= radialSegments; column++) {
      const angle = column / radialSegments * Math.PI * 2;
      const crease = folds * Math.sin(angle * 7 + t * 3) * Math.sin(Math.PI * t);
      const vertex = position.clone().addScaledVector(axis, Math.cos(angle) * (radius + crease))
        .addScaledVector(crossAxis, Math.sin(angle) * (radius + crease) * depth);
      vertices.push(vertex.x, vertex.y, vertex.z); uvs.push(column / radialSegments, t);
      if (row < rows && column < radialSegments) {
        const a = row * (radialSegments + 1) + column, b = a + radialSegments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

const robeProfile = [[.65, .515], [.86, .435], [1.07, .335], [1.38, .37], [1.61, .30], [1.74, .245]] as const;
function robeRadius(y: number) {
  const upper = robeProfile.findIndex(item => item[0] >= y);
  const row = Math.max(0, Math.min(robeProfile.length - 2, upper < 0 ? robeProfile.length - 2 : upper - 1));
  const [startY, startRadius] = robeProfile[row], [endY, endRadius] = robeProfile[row + 1];
  return THREE.MathUtils.lerp(startRadius, endRadius, THREE.MathUtils.clamp((y - startY) / (endY - startY), 0, 1));
}

function robeGap(y: number) { return .09 + .23 * Math.pow(Math.abs(y - 1.05) / .69, 1.5); }
function robePoint(y: number, theta: number, offset = 0) {
  const ripple = .010 * Math.sin(theta * 9 + y * 2) + .004 * Math.sin(theta * 17);
  const radius = robeRadius(y) + ripple + offset;
  return new THREE.Vector3(Math.sin(theta) * radius, y, Math.cos(theta) * radius);
}

function robeGeometry() {
  const rows = 30, columns = 64, positions: number[] = [], indices: number[] = [], uvs: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const y = .65 + row / rows * 1.09, gap = robeGap(y);
    for (let column = 0; column <= columns; column++) {
      const theta = gap + column / columns * (Math.PI * 2 - gap * 2);
      const position = robePoint(y, theta);
      positions.push(position.x, position.y, position.z); uvs.push(column / columns, row / rows);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + columns + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function createCape(parent: THREE.Group, navy: Surface, gold: Surface) {
  const positions: number[] = [], indices: number[] = [], rows = 22, columns = 48;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, y = .62 + t * 1.10;
    const radius = THREE.MathUtils.lerp(.65, .29, t) + .014 * Math.sin(t * Math.PI);
    for (let column = 0; column <= columns; column++) {
      const theta = 1.20 + column / columns * (Math.PI * 2 - 2.40);
      const fold = .024 * Math.sin(theta * 7) * (1 - t);
      positions.push(Math.sin(theta) * (radius + fold), y + .027 * Math.cos(theta * 5) * (1 - t),
        Math.cos(theta) * (radius + fold) - .10);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + columns + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  add(parent, geometry, navy, 0, 0, 0, 'cover-hero-star-cape');
  const hem = Array.from({ length: 41 }, (_, index) => {
    const theta = 1.20 + index / 40 * (Math.PI * 2 - 2.40), fold = .024 * Math.sin(theta * 7);
    return new THREE.Vector3(Math.sin(theta) * (.65 + fold), .62 + .027 * Math.cos(theta * 5), Math.cos(theta) * (.65 + fold) - .10);
  });
  tube(parent, hem, .023, gold, 'cover-hero-cape-hem', false, 64);
  for (const side of [-1, 1]) {
    const edge = Array.from({ length: 22 }, (_, index) => {
      const t = index / 21, theta = side > 0 ? 1.20 : Math.PI * 2 - 1.20;
      const radius = THREE.MathUtils.lerp(.65, .29, t) + .024 * Math.sin(theta * 7) * (1 - t);
      return new THREE.Vector3(Math.sin(theta) * radius, .62 + t * 1.10, Math.cos(theta) * radius - .10);
    });
    tube(parent, edge, .021, gold, 'cover-hero-cape-edge-' + side);
    for (const [y, x, radius] of [[.78, .595, .065], [1.02, .49, .048], [1.26, .397, .040]]) {
      const ornament = add(parent, star(radius), gold, side * x, y, .055, 'cover-hero-cape-star');
      ornament.rotation.y = side * .32; ornament.rotation.z = side * .2;
    }
  }
}

function makeLeg(parent: THREE.Group, x: number, cream: Surface, gold: Surface, leather: Surface) {
  const pivot = new THREE.Group(); pivot.position.set(x, .84, 0);
  pivot.name = x < 0 ? 'cover-hero-left-leg' : 'cover-hero-right-leg'; parent.add(pivot);
  add(pivot, new THREE.CapsuleGeometry(.15, .36, 8, 24), cream, 0, -.23, 0, 'cover-hero-cream-trousers');
  sphere(pivot, .19, gold, 0, -.64, .09, [1.04, .76, 1.43], 'cover-hero-gold-boot-toe');
  add(pivot, new THREE.CylinderGeometry(.168, .16, .28, 32), gold, 0, -.48, .01, 'cover-hero-gold-boot-shaft');
  torus(pivot, .17, .022, gold, 0, -.34, .01).rotation.x = Math.PI / 2;
  sphere(pivot, .20, leather, 0, -.76, .085, [1.07, .14, 1.44], 'cover-hero-boot-sole');
  const strap = torus(pivot, .165, .013, leather, 0, -.47, .01); strap.rotation.x = Math.PI / 2;
  const buckle = torus(pivot, .036, .010, gold, -.015, -.47, .178); buckle.scale.x = 1.2;
  return pivot;
}

function makeArm(parent: THREE.Group, x: number, cloth: Surface, skin: Surface, gold: Surface) {
  const shoulder = new THREE.Group(); shoulder.position.set(x, 1.65, .12); parent.add(shoulder);
  shoulder.name = x < 0 ? 'cover-hero-left-shoulder' : 'cover-hero-right-shoulder';
  add(shoulder, new THREE.CapsuleGeometry(.146, .15, 8, 24), cloth, 0, -.13, 0);
  const elbow = new THREE.Group(); elbow.position.y = -.29; shoulder.add(elbow);
  elbow.name = x < 0 ? 'cover-hero-left-elbow' : 'cover-hero-right-elbow';
  sphere(elbow, .132, cloth);
  add(elbow, new THREE.CapsuleGeometry(.132, .13, 8, 24), cloth, 0, -.12, 0);
  add(elbow, new THREE.CylinderGeometry(.146, .17, .16, 32), cloth, 0, -.23, 0);
  torus(elbow, .157, .022, gold, 0, -.30, 0).rotation.x = Math.PI / 2;
  const hand = new THREE.Group(); hand.name = x < 0 ? 'mage-left-hand' : 'mage-right-hand';
  hand.position.set(0, -.385, .035); elbow.add(hand);
  sphere(hand, .14, skin, 0, 0, 0, [.94, 1, .83], 'cover-hero-palm');
  if (x > 0) {
    // Individual bent fingers wrap in front of the shaft; the thumb closes the grip.
    for (const y of [-.105, -.049, .005]) {
      tube(hand, [new THREE.Vector3(-.082, y, .025), new THREE.Vector3(-.025, y - .01, .122),
        new THREE.Vector3(.070, y, .126), new THREE.Vector3(.108, y + .018, .067)], .031, skin, 'cover-hero-grip-finger', false, 12);
    }
    tube(hand, [new THREE.Vector3(-.10, .045, .065), new THREE.Vector3(-.063, .091, .115),
      new THREE.Vector3(.011, .089, .121)], .044, skin, 'cover-hero-grip-thumb', false, 12);
  } else {
    for (const [offset, length] of [[-.078, .13], [-.031, .19], [.019, .18], [.063, .14]]) {
      tube(hand, [new THREE.Vector3(offset, -.046, .030), new THREE.Vector3(offset * 1.35, -.12, .057),
        new THREE.Vector3(offset * 1.65, -length, .074)], .027, skin, 'cover-hero-open-finger', false, 12);
    }
    tube(hand, [new THREE.Vector3(.10, .021, .052), new THREE.Vector3(.17, -.020, .080),
      new THREE.Vector3(.188, -.065, .100)], .039, skin, 'cover-hero-open-thumb', false, 12);
  }
  return { shoulder, elbow, hand };
}

function createHair(head: THREE.Group, brown: Surface, highlight: Surface) {
  const cap = add(head, new THREE.SphereGeometry(.635, 48, 28, 0, Math.PI * 2, 0, Math.PI * .58), brown,
    0, .16, -.07, 'cover-hero-brown-hair-cap'); cap.scale.set(1, .82, .95);
  const tufts = [
    [[-.53, .31, .22], [-.43, .34, .40], [-.48, .20, .48], [-.53, .13, .40]],
    [[-.39, .45, .28], [-.25, .45, .44], [-.39, .29, .55], [-.43, .16, .52]],
    [[-.17, .50, .28], [-.03, .48, .44], [-.20, .31, .58], [-.28, .23, .57]],
    [[.07, .50, .28], [.15, .43, .44], [.045, .29, .58], [-.04, .235, .59]],
    [[.26, .44, .23], [.36, .39, .39], [.27, .27, .55], [.18, .19, .54]],
    [[.46, .34, .18], [.51, .29, .35], [.45, .18, .46], [.52, .115, .41]],
    [[-.59, .19, -.02], [-.61, .07, .08], [-.55, -.02, .18], [-.59, -.065, .10]],
    [[.59, .19, -.02], [.61, .07, .08], [.55, -.02, .18], [.59, -.065, .10]],
  ];
  for (const [index, coordinates] of tufts.entries()) {
    const points = coordinates.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    add(head, softVolume(points, [.095, .12, .076, .007], .72, 18, 20), brown, 0, 0, 0, 'cover-hero-curved-hair-lock');
    if (index < 6) tube(head, points.map(point => point.clone().add(new THREE.Vector3(0, .018, .044))),
      .007, highlight, 'cover-hero-hair-highlight', false, 18);
  }
}

function createFace(head: THREE.Group, skin: Surface, brown: Surface, ivory: Surface) {
  sphere(head, .62, skin, 0, 0, 0, [1, .94, .91], 'cover-hero-face');
  const blush = material(0xe99480, .72), eyeBrown = material(0x81502c, .24), darkBrown = material(0x39221b, .20);
  for (const side of [-1, 1]) {
    sphere(head, .118, skin, side * .585, -.015, -.002, [.88, 1.04, .74], 'cover-hero-ear');
    sphere(head, .063, blush, side * .635, -.005, .034, [.48, .93, .60]);
    const x = side * .22;
    sphere(head, .145, ivory, x, .035, .537, [.86, 1.18, .32], 'cover-hero-eye-white');
    sphere(head, .102, eyeBrown, x + .005, .032, .587, [.97, 1.17, .31], 'cover-hero-brown-iris');
    sphere(head, .063, darkBrown, x + .007, .032, .621, [.84, 1.15, .29], 'cover-hero-eye-pupil');
    sphere(head, .023, ivory, x - .025, .079, .646, [1, 1.03, .25], 'cover-hero-eye-catchlight');
    sphere(head, .010, ivory, x + .028, -.007, .643, [1, 1, .25]);
    tube(head, [new THREE.Vector3(x - .095, .230, .489), new THREE.Vector3(x, .266, .513),
      new THREE.Vector3(x + .089, .243, .498)], .023, brown, 'cover-hero-eyebrow', false, 18);
    sphere(head, .064, blush, side * .345, -.102, .482, [1.35, .42, .21], 'cover-hero-cheek');
  }
  sphere(head, .059, skin, 0, -.075, .599, [1.10, .76, 1], 'cover-hero-nose');
  const mouth = material(0x652b25, .72), tongue = material(0xe49179, .66);
  sphere(head, .098, mouth, 0, -.220, .515, [1.05, .73, .20], 'cover-hero-smile');
  sphere(head, .054, tongue, .013, -.252, .531, [1.1, .46, .16]);
  tube(head, [new THREE.Vector3(-.064, -.179, .534), new THREE.Vector3(0, -.187, .546),
    new THREE.Vector3(.064, -.179, .534)], .016, ivory, 'cover-hero-smile-teeth', false, 16);
  // Warm skin, glossy brown irises and separate tiny catchlights keep the face expressive in close-ups.
}

function createHat(head: THREE.Group, cloth: Surface, gold: Surface, ivory: Surface) {
  const brimGeometry = new THREE.LatheGeometry([new THREE.Vector2(.53, -.013), new THREE.Vector2(.74, -.034),
    new THREE.Vector2(.80, .004), new THREE.Vector2(.78, .052), new THREE.Vector2(.54, .088)], 96);
  const brim = add(head, brimGeometry, cloth, 0, .48, -.028, 'cover-hero-soft-hat-brim'); brim.scale.z = .93;
  const edge = Array.from({ length: 65 }, (_, index) => {
    const angle = index / 64 * Math.PI * 2;
    return new THREE.Vector3(Math.sin(angle) * .794, .487 + .018 * Math.cos(angle), Math.cos(angle) * .738 - .028);
  });
  tube(head, edge, .010, gold, 'cover-hero-hat-brim-stitch', true, 96);
  const points = [[0, .54, -.03], [0, .73, -.03], [-.025, .98, -.035], [-.08, 1.24, -.04],
    [-.15, 1.43, -.045], [-.265, 1.48, -.05], [-.39, 1.43, -.055], [-.49, 1.33, -.06]]
    .map(([x, y, z]) => new THREE.Vector3(x, y, z));
  add(head, softVolume(points, [.525, .43, .32, .22, .14, .095, .068, .009], .93, 56, 64, .009), cloth,
    0, 0, 0, 'cover-hero-soft-bent-hat');
  add(head, new THREE.CylinderGeometry(.449, .492, .105, 64), gold, 0, .672, -.03, 'cover-hero-gold-hat-band');
  sphere(head, .051, gold, -.49, 1.315, -.06, [1, 1.1, 1], 'cover-hero-hat-tip');
  const frame = add(head, star(.132), gold, -.025, .81, .370, 'cover-hero-hat-star-frame'); frame.rotation.z = -.10;
  const insert = add(head, star(.10), ivory, -.025, .81, .399, 'cover-hero-hat-star'); insert.rotation.z = -.10;
}

function createStaff(hand: THREE.Group, navy: Surface, gold: Surface, glow: THREE.MeshStandardMaterial) {
  const staff = new THREE.Group(); staff.name = 'mage-staff'; staff.position.set(0, 0, .065); hand.add(staff);
  add(staff, new THREE.CylinderGeometry(.040, .047, 1.30, 32), navy, 0, .35, 0, 'cover-hero-staff-shaft');
  for (const y of [-.24, .12, .58]) add(staff, new THREE.CylinderGeometry(.060, .060, .08, 32), gold, 0, y, 0);
  add(staff, new THREE.CylinderGeometry(.052, .090, .12, 32), gold, 0, .91, 0);
  const gem = add(staff, new THREE.OctahedronGeometry(.21), glow, 0, 1.08, 0, 'cover-hero-staff-crystal');
  gem.scale.set(.95, 1.14, .90); gem.rotation.z = .17;
  torus(staff, .29, .033, gold, 0, 1.08, 0, 'cover-hero-staff-gold-halo').rotation.y = .30;
  const halo = new THREE.MeshBasicMaterial({ color: 0x9af4e4, transparent: true, opacity: .38,
    depthWrite: false, blending: THREE.AdditiveBlending });
  const inner = torus(staff, .242, .009, halo, 0, 1.08, .02); inner.rotation.x = .73;
  const tip = new THREE.Object3D(); tip.name = 'cover-hero-spell-origin'; tip.position.set(0, 1.08, .06); staff.add(tip);
  return { staff, tip };
}

/** Original code-native model matching the title art; retains the existing battle articulation contract. */
export function createCoverHero(): CoverHeroRig {
  const root = new THREE.Group(); root.name = 'original-campus-mage'; root.userData.design = 'cover-hero-v1';
  const robe = material(0x196e76, .78), skin = material(0xf3bf95, .57), gold = material(0xe3b353, .34, .30);
  const hair = material(0x583727, .66), hairHighlight = material(0x80533a, .66), ivory = material(0xfff4dc, .54);
  const leather = material(0x65462f, .70), navy = material(0x183748, .73), cape = material(0x214958, .84);
  robe.side = THREE.DoubleSide; cape.side = THREE.DoubleSide;
  const glow = material(0x71ead2, .17, .18); glow.emissive.setHex(0x43c4b0); glow.emissiveIntensity = .65;
  createCape(root, cape, gold);
  add(root, new THREE.CapsuleGeometry(.29, .36, 8, 24), ivory, 0, 1.30, .023, 'cover-hero-cream-shirt');
  add(root, robeGeometry(), robe, 0, 0, 0, 'cover-hero-open-robe');
  for (const side of [-1, 1]) {
    const points = Array.from({ length: 32 }, (_, index) => {
      const y = .65 + index / 31 * 1.09;
      return robePoint(y, side > 0 ? robeGap(y) : Math.PI * 2 - robeGap(y), .009);
    });
    tube(root, points, .019, gold, 'cover-hero-gold-lapel-' + side, false, 48);
  }
  const hem = Array.from({ length: 65 }, (_, index) => robePoint(.65, robeGap(.65) + index / 64 * (Math.PI * 2 - robeGap(.65) * 2), .009));
  tube(root, hem, .019, gold, 'cover-hero-gold-robe-hem', false, 64);
  add(root, new THREE.CylinderGeometry(.346, .365, .103, 48), leather, 0, 1.045, 0, 'cover-hero-belt');
  const buckle = add(root, new THREE.CylinderGeometry(.095, .095, .035, 48), gold, 0, 1.045, .371, 'cover-hero-round-buckle');
  buckle.rotation.x = Math.PI / 2;
  torus(root, .075, .008, gold, 0, 1.045, .397);
  add(root, star(.033), ivory, 0, 1.045, .410);
  torus(root, .263, .034, gold, 0, 1.713, 0, 'cover-hero-collar-trim').rotation.x = Math.PI / 2;
  add(root, star(.112), gold, 0, 1.621, .328, 'cover-hero-collar-star-frame');
  add(root, star(.083), ivory, 0, 1.621, .359, 'cover-hero-collar-star');
  const head = new THREE.Group(); head.name = 'cover-hero-head'; head.position.y = 2.2; root.add(head);
  createFace(head, skin, hair, ivory); createHair(head, hair, hairHighlight); createHat(head, robe, gold, ivory);
  const left = makeArm(root, -.47, robe, skin, gold), right = makeArm(root, .47, robe, skin, gold);
  const { staff, tip } = createStaff(right.hand, navy, gold, glow);
  const rig: CoverHeroRig = { root, head, leftArm: left.shoulder, rightArm: right.shoulder,
    leftElbow: left.elbow, rightElbow: right.elbow, staff, leftLeg: makeLeg(root, -.22, ivory, gold, leather),
    rightLeg: makeLeg(root, .22, ivory, gold, leather), tip, glow };
  poseMage(rig); return rig;
}
