import * as THREE from 'three';

type Surface = THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
interface Rig {
  root: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  tip: THREE.Object3D;
  glow: THREE.MeshStandardMaterial;
}
const palettes = [0xf6a642, 0x36b8c5, 0x6d91e5, 0x9c70d8, 0xe67970, 0x637dda];
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const ease = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

function solid(color: THREE.ColorRepresentation, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: .62, metalness });
}
function luminous(color: THREE.ColorRepresentation, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
}
function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: Surface,
  x = 0, y = 0, z = 0, castShadow = true) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = castShadow;
  object.receiveShadow = material instanceof THREE.MeshStandardMaterial;
  parent.add(object);
  return object;
}
function ball(parent: THREE.Object3D, radius: number, material: Surface,
  x = 0, y = 0, z = 0) {
  return mesh(parent, new THREE.SphereGeometry(radius, 18, 12), material, x, y, z);
}
function box(parent: THREE.Object3D, w: number, h: number, d: number, material: Surface,
  x = 0, y = 0, z = 0) {
  return mesh(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);
}
function roundBox(parent: THREE.Object3D, w: number, h: number, d: number, material: Surface,
  x = 0, y = 0, z = 0, radius = .12) {
  const r = Math.min(radius, w / 3, h / 3);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true,
    bevelSegments: 2, steps: 1, bevelSize: .035, bevelThickness: .035, curveSegments: 3 });
  geometry.translate(0, 0, -d / 2);
  return mesh(parent, geometry, material, x, y, z);
}
function ring(parent: THREE.Object3D, radius: number, tube: number, material: Surface,
  x = 0, y = 0, z = 0) {
  return mesh(parent, new THREE.TorusGeometry(radius, tube, 6, 32), material, x, y, z, false);
}
function starGeometry(radius: number) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI / 5 + Math.PI / 2;
    const size = i % 2 ? radius * .46 : radius;
    const x = Math.cos(angle) * size, y = Math.sin(angle) * size;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .06, bevelEnabled: true,
    bevelSize: .015, bevelThickness: .015, bevelSegments: 1 });
  geometry.translate(0, 0, -.03);
  return geometry;
}

function leg(parent: THREE.Group, x: number, pants: Surface, shoe: Surface) {
  const pivot = new THREE.Group(); pivot.position.set(x, .84, 0); parent.add(pivot);
  mesh(pivot, new THREE.CapsuleGeometry(.15, .34, 4, 10), pants, 0, -.23, 0);
  const boot = roundBox(pivot, .35, .27, .46, shoe, 0, -.63, .08, .07);
  boot.castShadow = true;
  box(pivot, .36, .06, .47, solid(0xf5efdc), 0, -.74, .08);
  return pivot;
}
function arm(parent: THREE.Group, x: number, sleeve: Surface, hand: Surface) {
  const pivot = new THREE.Group(); pivot.position.set(x, 1.65, 0); parent.add(pivot);
  mesh(pivot, new THREE.CapsuleGeometry(.15, .28, 4, 10), sleeve, 0, -.24, 0);
  ball(pivot, .16, hand, 0, -.55, .02);
  return pivot;
}

function createHero(): Rig {
  const root = new THREE.Group(); root.name = 'original-student-guardian';
  const jacket = solid(0x258c85), skin = solid(0xf4bb91), navy = solid(0x26394c);
  const orange = solid(0xed9851), hair = solid(0x493838), white = solid(0xf9f5e4);
  const glow = solid(0x79e7d4, .35); glow.emissive.setHex(0x2e9181); glow.emissiveIntensity = .45;
  mesh(root, new THREE.CapsuleGeometry(.39, .38, 4, 14), jacket, 0, 1.29, 0);
  roundBox(root, .32, .51, .06, white, 0, 1.38, .36, .04);
  const scarf = box(root, .11, .4, .075, orange, .04, 1.42, .4); scarf.rotation.z = -.11;
  ring(root, .30, .07, orange, 0, 1.74, 0).rotation.x = Math.PI / 2;
  roundBox(root, .64, .61, .28, orange, 0, 1.38, -.43, .08);
  roundBox(root, .45, .12, .1, navy, 0, .98, .36, .035);
  const head = new THREE.Group(); head.position.y = 2.2; root.add(head);
  const face = ball(head, .62, skin); face.scale.set(1, .94, .9);
  const cap = ball(head, .635, hair, 0, .27, -.10); cap.scale.set(1, .65, .91);
  for (let i = 0; i < 4; i++) {
    const tuft = ball(head, .20, hair, -.39 + i * .21, .43 - Math.abs(i - 1.5) * .055, .36);
    tuft.scale.set(1, .75, .6);
  }
  ball(head, .115, skin, -.59, -.01, 0); ball(head, .115, skin, .59, -.01, 0);
  for (const x of [-.21, .21]) {
    const eyeWhite = ball(head, .094, white, x, .07, .52); eyeWhite.scale.set(.82, 1.13, .45);
    const pupil = ball(head, .052, navy, x + .018, .07, .572); pupil.scale.set(.72, 1.25, .45);
    ball(head, .014, white, x + .028, .092, .60);
    const brow = box(head, .13, .045, .03, hair, x, .24, .53); brow.rotation.z = x < 0 ? -.1 : .1;
    const blush = ball(head, .058, solid(0xe99385), x * 1.65, -.08, .495); blush.scale.set(1.3, .48, .3);
  }
  ball(head, .065, skin, .018, -.07, .60);
  const smile = mesh(head, new THREE.TorusGeometry(.105, .014, 5, 20, Math.PI), hair, 0, -.17, .55);
  smile.rotation.z = Math.PI;
  const badge = roundBox(head, .38, .12, .08, jacket, -.13, .48, .49, .03); badge.rotation.z = -.12;
  mesh(head, starGeometry(.05), white, -.12, .485, .547);
  const leftArm = arm(root, -.47, jacket, skin), rightArm = arm(root, .47, jacket, skin);
  leftArm.rotation.z = -.18; rightArm.rotation.z = .24;
  const shield = new THREE.Group(); shield.position.set(0, -.42, .24); leftArm.add(shield);
  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(0, .45); shieldShape.lineTo(.31, .26); shieldShape.lineTo(.27, -.2);
  shieldShape.lineTo(0, -.43); shieldShape.lineTo(-.27, -.2); shieldShape.lineTo(-.31, .26); shieldShape.closePath();
  mesh(shield, new THREE.ExtrudeGeometry(shieldShape, { depth: .10, bevelEnabled: true,
    bevelSegments: 2, bevelSize: .06, bevelThickness: .06 }), orange);
  const inner = mesh(shield, new THREE.ShapeGeometry(shieldShape), jacket, 0, 0, .175); inner.scale.setScalar(.83);
  mesh(shield, starGeometry(.14), white, 0, .03, .20);
  const staff = new THREE.Group(); staff.position.set(0, -.55, .10); rightArm.add(staff);
  mesh(staff, new THREE.CylinderGeometry(.046, .046, .58, 9), navy, 0, -.25, 0);
  ring(staff, .19, .035, orange, 0, -.57, 0);
  mesh(staff, new THREE.OctahedronGeometry(.125), glow, 0, -.57, 0);
  const tip = new THREE.Object3D(); tip.position.set(0, -.6, .07); staff.add(tip);
  return { root, head, leftArm, rightArm, leftLeg: leg(root, -.22, navy, orange),
    rightLeg: leg(root, .22, navy, orange), tip, glow };
}

function createEnemy(theme: number): Rig {
  const root = new THREE.Group(); root.name = 'original-theme-guardian-' + theme;
  const primary = solid(palettes[theme - 1], .2), trim = solid(0x33485e, .3);
  const white = solid(0xf8f3df), visor = solid(0x233d52, .45), gold = solid(0xffd57c, .15);
  const glow = primary;
  glow.emissive.setHex(0x000000);
  if (theme === 5) {
    roundBox(root, .87, .94, .61, primary, 0, 1.31, 0, .10);
    for (const x of [-.24, .24]) {
      const page = roundBox(root, .42, .63, .09, white, x, 1.35, .39, .035);
      page.rotation.y = x < 0 ? -.3 : .3;
      for (let i = 0; i < 3; i++) box(root, .22, .025, .015, trim, x, 1.22 + i * .11, .48);
    }
  } else if (theme === 3) {
    roundBox(root, .92, .48, .64, primary, 0, 1.07, 0);
    roundBox(root, .81, .36, .58, solid(0x72c8a8), 0, 1.50, 0);
    for (const x of [-.23, 0, .23]) ball(root, .07, x === 0 ? gold : white, x, 1.06, .37);
  } else {
    roundBox(root, .89, .98, .67, primary, 0, 1.28, 0);
    roundBox(root, .53, .45, .07, gold, 0, 1.32, .385, .08);
    if (theme === 1) {
      ring(root, .14, .035, trim, 0, 1.40, .45);
      box(root, .07, .13, .05, trim, 0, 1.23, .45);
    } else if (theme === 4) {
      mesh(root, new THREE.OctahedronGeometry(.19), solid(0xded2fa, .35), 0, 1.34, .48);
    } else {
      mesh(root, starGeometry(.19), trim, 0, 1.32, .47);
    }
  }
  const head = new THREE.Group(); head.position.y = 2.17; root.add(head);
  const headShell = ball(head, theme === 6 ? .63 : .58, primary);
  headShell.scale.set(1, .87, .79);
  const face = roundBox(head, .78, .41, .16, visor, 0, -.02, .46, .12);
  face.rotation.x = -.02;
  for (const x of [-.19, .19]) {
    const eye = ball(head, .075, gold, x, .015, .58); eye.scale.set(.6, 1.2, .35);
    ball(head, .023, white, x - .007, .04, .605);
  }
  const smile = mesh(head, new THREE.TorusGeometry(.09, .014, 5, 20, Math.PI), gold, 0, -.12, .57);
  smile.rotation.z = Math.PI;
  for (const x of [-.55, .55]) {
    const ear = mesh(head, new THREE.CylinderGeometry(.13, .13, .13, 10), trim, x, 0, .02);
    ear.rotation.z = Math.PI / 2;
    ball(head, .075, gold, x * 1.08, 0, .03);
  }
  if (theme === 4) {
    const halo = ring(head, .76, .028, luminous(0xc5adff, .72), 0, .04, -.1);
    halo.rotation.y = .28; halo.rotation.x = .12;
    const mask = roundBox(head, .30, .20, .04, white, -.40, -.17, .51, .08); mask.rotation.z = -.3;
  } else if (theme === 2) {
    const cap = roundBox(head, .89, .13, .69, gold, 0, .48, 0, .06); cap.rotation.z = .08;
    box(head, .08, .21, .06, gold, .35, .32, .28);
  } else if (theme === 5) {
    mesh(head, new THREE.CylinderGeometry(.046, .046, .45, 8), gold, .16, .55, 0).rotation.z = -.3;
    mesh(head, new THREE.ConeGeometry(.047, .15, 8), trim, .23, .82, 0).rotation.z = -.3;
  } else {
    const antennaCount = theme === 6 ? 3 : 1;
    for (let i = 0; i < antennaCount; i++) {
      const x = (i - (antennaCount - 1) / 2) * .24;
      mesh(head, new THREE.CylinderGeometry(.03, .03, .21, 8), trim, x, .55, 0);
      ball(head, .095, gold, x, .69, 0);
    }
  }
  const leftArm = arm(root, -.51, primary, trim), rightArm = arm(root, .51, primary, trim);
  leftArm.rotation.z = -.26; rightArm.rotation.z = .26;
  ring(leftArm, .14, .035, gold, 0, -.40, .07);
  ring(rightArm, .14, .035, gold, 0, -.40, .07);
  if (theme === 5) {
    for (const side of [-1, 1]) {
      const helperArm = arm(root, side * .48, trim, gold);
      helperArm.position.y = 1.16; helperArm.rotation.z = side * .8;
      helperArm.scale.setScalar(.67);
    }
  }
  const tip = new THREE.Object3D(); tip.position.set(0, -.57, .08); leftArm.add(tip);
  return { root, head, leftArm, rightArm, leftLeg: leg(root, -.22, trim, primary),
    rightLeg: leg(root, .22, trim, primary), tip, glow };
}

function makeCourtyard(scene: THREE.Scene) {
  const cream = solid(0xf2dec0), lightStone = solid(0xf6ecd7), darkStone = solid(0xcfc0a9);
  const teal = solid(0x3e9492), orange = solid(0xdc9260), leaves = solid(0x82b6a0);
  const floor = mesh(scene, new THREE.PlaneGeometry(45, 35), cream, 0, -.045, 0, false);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  const tileGeometry = new THREE.BoxGeometry(1.10, .018, .71);
  for (let row = 0; row < 6; row++) {
    for (let col = -7; col <= 7; col++) {
      const tile = mesh(scene, tileGeometry, (row + col) % 3 ? lightStone : cream,
        col * 1.16 + (row % 2 ? .55 : 0), -.027, row * .79 - 1.5, false);
      tile.receiveShadow = true;
    }
  }
  roundBox(scene, 18, 4.9, .7, lightStone, 0, 2.37, -5.7, .2);
  box(scene, 19, .38, 1.2, teal, 0, 4.78, -5.7);
  box(scene, 18, .12, .92, darkStone, 0, .07, -5.27);
  roundBox(scene, 2.45, 3.07, .18, darkStone, 0, 1.57, -5.25, .8);
  roundBox(scene, 2.10, 2.80, .14, orange, 0, 1.39, -5.08, .75);
  box(scene, .055, 2.35, .04, cream, 0, 1.25, -4.98);
  for (const x of [-.38, .38]) ball(scene, .065, teal, x, 1.16, -4.93);
  for (const x of [-6.5, -3.6, 3.6, 6.5]) {
    box(scene, .48, 3.91, .88, cream, x, 2.03, -5.20);
    roundBox(scene, .79, .32, 1.12, darkStone, x, .23, -5.16, .05);
    roundBox(scene, .8, .25, 1.13, darkStone, x, 3.98, -5.16, .05);
    const window = roundBox(scene, 1.0, 1.0, .08, solid(0x98cbd0), x + (x < 0 ? .9 : -.9), 2.66, -5.27, .15);
    window.castShadow = false;
    box(scene, .04, .91, .05, cream, window.position.x, 2.66, -5.18);
  }
  for (const x of [-7.5, 7.5]) {
    mesh(scene, new THREE.CylinderGeometry(.18, .28, 1.6, 9), solid(0x957859), x, .78, -2.9);
    const tree = ball(scene, 1.1, leaves, x, 2.40, -2.9); tree.scale.set(.83, 1.25, .9);
    ball(scene, .82, solid(0xa2c7a3), x + .45, 2.5, -3.2);
    roundBox(scene, 1.12, .52, 1.04, orange, x, .22, -2.9, .1);
  }
  for (const x of [-4.7, 4.7]) {
    const banner = mesh(scene, new THREE.PlaneGeometry(.74, 1.26), solid(0x66bbb1), x, 3.65, -5.08);
    banner.material.side = THREE.DoubleSide;
    mesh(scene, starGeometry(.18), lightStone, x, 3.66, -5.01);
  }
}

function createDrone(scene: THREE.Scene) {
  const drone = new THREE.Group(); drone.name = 'helper-drone'; scene.add(drone);
  const teal = solid(0x6bcbc1, .2), white = solid(0xf9f2df), dark = solid(0x264351);
  const body = ball(drone, .23, white); body.scale.set(1.25, .85, .83);
  roundBox(drone, .29, .14, .055, dark, 0, .005, .19, .045);
  for (const x of [-.067, .067]) ball(drone, .023, luminous(0x93efcb), x, .018, .23);
  for (const x of [-.30, .30]) {
    ball(drone, .10, teal, x, .04, 0);
    ring(drone, .13, .018, white, x, .10, 0).rotation.x = Math.PI / 2;
  }
  mesh(drone, new THREE.ConeGeometry(.09, .15, 9), luminous(0x8eefdc, .40), 0, -.19, 0).rotation.z = Math.PI;
  return drone;
}

function createEffects(scene: THREE.Scene, theme: number) {
  const root = new THREE.Group(); root.name = 'attack-effects'; root.visible = false; scene.add(root);
  const flight = new THREE.Group(); root.add(flight);
  const color = theme === 1 ? 0xffc96d : palettes[theme - 1];
  const bright = luminous(color, .92), white = luminous(0xfff3c2, .92);
  if (theme === 3) {
    for (let i = 0; i < 3; i++) {
      const card = roundBox(flight, .30, .38, .05, solid([0x8ee4c4, 0xffce71, 0x90a8ff][i]),
        (i - 1) * .25, Math.abs(i - 1) * .10, i * .04, .03);
      card.rotation.z = (i - 1) * -.35;
      ball(card, .049, solid(0xffffff), 0, .065, .055);
      box(card, .12, .026, .014, solid(0xffffff), 0, -.085, .053);
    }
  } else if (theme === 4) {
    mesh(flight, new THREE.OctahedronGeometry(.26), solid(0xc4a2ef, .45));
    ring(flight, .36, .025, white).rotation.y = .8;
    ring(flight, .36, .025, bright).rotation.x = .8;
  } else if (theme === 5) {
    for (const side of [-1, 1]) {
      const page = roundBox(flight, .25, .35, .035, solid(0xfff5dc), side * .125, 0, .055, .01);
      const cover = box(flight, .27, .38, .045, solid(0x56b9a3), side * .135, 0, 0);
      page.rotation.y = cover.rotation.y = -side * .3;
    }
    ring(flight, .40, .020, white);
  } else if (theme === 6) {
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3;
      mesh(flight, starGeometry(.18), solid(0xffd379), Math.cos(angle) * .21, Math.sin(angle) * .21, 0);
    }
    ring(flight, .38, .015, luminous(0x9bdcc6, .85));
  } else if (theme === 2) {
    ring(flight, .26, .05, bright);
    const handle = mesh(flight, new THREE.CylinderGeometry(.025, .025, .25, 8), white, -.24, -.24, 0);
    handle.rotation.z = -.7;
    ball(flight, .14, luminous(0xe1fbfd, .4));
  } else {
    mesh(flight, new THREE.OctahedronGeometry(.21), white);
    ring(flight, .35, .04, bright);
  }
  const glowBall = ball(flight, .41, luminous(color, .16)); glowBall.castShadow = false;
  const beam = mesh(root, new THREE.CylinderGeometry(.045, .045, 1, 9), luminous(color, .68), 0, 0, 0, false);
  beam.visible = false;
  const groundRing = ring(root, .28, .025, luminous(color, .75)); groundRing.rotation.x = Math.PI / 2;
  const hitRing = ring(root, .26, .055, luminous(0xffe8a6, .95));
  const secondRing = ring(root, .20, .02, luminous(color, .85)); secondRing.rotation.y = .35;
  const charge = ring(root, .20, .025, luminous(color, .75)); charge.rotation.y = .2;
  const trailGeometry = new THREE.SphereGeometry(.08, 7, 5);
  const trail = Array.from({ length: 15 }, (_, i) => mesh(root, trailGeometry,
    luminous(i % 2 ? color : 0xfff6d7, .66), 0, 0, 0, false));
  const sparkGeometry = new THREE.OctahedronGeometry(.055);
  const sparks = Array.from({ length: 22 }, (_, i) => mesh(root, sparkGeometry,
    luminous(i % 2 ? color : 0xffe6a1, .95), 0, 0, 0, false));
  return { root, flight, beam, groundRing, hitRing, secondRing, charge, trail, sparks };
}

function disposeScene(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  scene.clear();
}

/** Entirely local procedural geometry. No model, font, texture or CDN fetch is required. */
export function createArenaScene(host: HTMLDivElement, chapter: number, reducedMotion: boolean,
  onPhase: (phase: string) => void) {
  const theme = clamp(chapter, 1, 6);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9ebe8);
  scene.fog = new THREE.Fog(0xd9ebe8, 18, 32);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.23;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.setAttribute('data-scene', 'procedural-3d-campus');
  host.appendChild(renderer.domElement);
  const camera = new THREE.OrthographicCamera(-6, 6, 4.4, -4.4, .1, 60);
  camera.position.set(0, 6.5, 15); camera.lookAt(0, 1.8, 0);
  scene.add(new THREE.HemisphereLight(0xf4fbff, 0xa8b2a2, 2.5));
  const sun = new THREE.DirectionalLight(0xffeed1, 3.3);
  sun.position.set(-4.5, 10, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 24; sun.shadow.normalBias = .03;
  sun.shadow.bias = -.00015; scene.add(sun);
  const fill = new THREE.DirectionalLight(0xb2e5eb, 1.0); fill.position.set(4, 3, -2); scene.add(fill);
  makeCourtyard(scene);
  const hero = createHero(), enemy = createEnemy(theme); scene.add(hero.root, enemy.root);
  hero.root.rotation.y = .13; enemy.root.rotation.y = -.15;
  const drone = createDrone(scene), effects = createEffects(scene, theme);
  let alive = true, raf = 0, lastFrame = 0, heroX = -2.8, enemyX = 2.8, modelScale = 1;
  let enemyHp = 100, playerHp = 100, requestedEnemyHp = 100, requestedPlayerHp = 100;
  let attack: { started: number; success: boolean } | null = null;
  let reportedPhase = '', dirty = true;
  const start = new THREE.Vector3(), target = new THREE.Vector3(), moving = new THREE.Vector3();
  const direction = new THREE.Vector3(), midpoint = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  const baseHeroRotation = .13, baseEnemyRotation = -.15;
  const emitPhase = (phase: string) => {
    if (phase !== reportedPhase && alive) { reportedPhase = phase; onPhase(phase); }
  };
  const resize = () => {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    const aspect = width / height, viewHeight = 8.8, viewWidth = viewHeight * aspect;
    camera.left = -viewWidth / 2; camera.right = viewWidth / 2;
    camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
    const portrait = aspect < .85;
    modelScale = portrait ? .8 : 1;
    camera.position.set(0, portrait ? 5.2 : 6.5, 15);
    camera.lookAt(0, portrait ? 1.30 : 1.80, 0); camera.updateProjectionMatrix();
    heroX = -Math.min(3.35, viewWidth * .235); enemyX = -heroX;
    hero.root.scale.setScalar(modelScale); enemy.root.scale.setScalar(modelScale);
    hero.root.position.x = heroX; enemy.root.position.x = enemyX;
    drone.scale.setScalar(modelScale);
    renderer.setSize(width, height, false); dirty = true;
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const visibility = () => { dirty = true; };
  document.addEventListener('visibilitychange', visibility);
  const contextLost = (event: Event) => { event.preventDefault(); emitPhase('3D 畫面暫停'); };
  const contextRestored = () => { dirty = true; emitPhase('待命'); };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  renderer.domElement.addEventListener('webglcontextrestored', contextRestored);

  function frame(now: number) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden || now - lastFrame < 1000 / 30) return;
    if (reducedMotion && !attack && !dirty) return;
    lastFrame = now; dirty = false;
    const effectClock = attack ? (now - attack.started) / 1000 * (reducedMotion ? 6 : 1) : Infinity;
    // Health restoration has no animation delay. A new hit takes effect at contact;
    // a restored save without an active cast shows its health on this first frame.
    if (!attack || effectClock >= .9) {
      enemyHp = requestedEnemyHp;
      playerHp = requestedPlayerHp;
    }
    const idle = now / 1000;
    const idleBob = reducedMotion ? 0 : Math.sin(idle * 2.4) * .018;
    hero.root.position.set(heroX, idleBob, 0);
    enemy.root.position.set(enemyX, idleBob * .65 + (enemyHp === 0 ? -.10 : 0), 0);
    hero.root.rotation.set(0, baseHeroRotation, 0);
    enemy.root.rotation.set(0, baseEnemyRotation, enemyHp === 0 ? .055 : 0);
    hero.head.rotation.z = reducedMotion ? 0 : Math.sin(idle * 1.5) * .017;
    enemy.head.rotation.z = reducedMotion ? 0 : Math.sin(idle * 1.7 + 1) * .025;
    hero.leftArm.rotation.set(0, 0, -.18); hero.rightArm.rotation.set(0, 0, .24);
    enemy.leftArm.rotation.set(0, 0, -.26); enemy.rightArm.rotation.set(0, 0, .26);
    for (const part of [hero.leftLeg, hero.rightLeg, enemy.leftLeg, enemy.rightLeg]) part.rotation.set(0, 0, 0);
    enemy.glow.emissive.setHex(enemyHp === 0 ? 0x1e614d : 0x000000);
    enemy.glow.emissiveIntensity = enemyHp === 0 ? .18 : 0;
    hero.glow.emissiveIntensity = .45;
    drone.position.set(heroX - modelScale * .75, modelScale * (2.68 + (reducedMotion ? 0 : Math.sin(idle * 3) * .08)), -.1);
    drone.rotation.y = reducedMotion ? 0 : Math.sin(idle * 1.5) * .12;
    effects.root.visible = !!attack;
    if (attack) {
      // Reduced-motion mode completes its fixed flash before the UI unlocks at 450 ms.
      // Scale only the effect clock; the ordinary cast still impacts at 900 ms.
      const t = effectClock;
      const success = attack.success, melee = success && theme === 1;
      emitPhase(t < .34 ? '蓄力' : t < .9 ? (melee ? '盾牌突進' : '法術飛行') : t < 1.45 ? '命中' : '返回');
      const windup = Math.sin(clamp(t / .34) * Math.PI / 2);
      const recovery = 1 - ease((t - 1.2) / .45);
      const cast = ease((t - .25) / .28) * recovery;
      const recoil = Math.sin(clamp((t - .9) / .45) * Math.PI) * (1 - clamp((t - .9) / .55));
      if (!reducedMotion) {
        if (success) {
          hero.root.position.y -= Math.sin(clamp(t / .44) * Math.PI) * .12;
          hero.root.rotation.z = -.075 * windup * (1 - cast);
          if (melee) {
            const dash = ease((t - .34) / .52) * (1 - ease((t - 1.03) / .55));
            const reach = Math.max(.25, enemyX - heroX - .85 * modelScale);
            hero.root.position.x += reach * dash;
            hero.root.rotation.y += .40 * dash;
            hero.leftArm.rotation.z = -.18 + 2.15 * cast;
            hero.rightArm.rotation.z = .24 + .65 * cast;
            hero.leftLeg.rotation.z = Math.sin(dash * Math.PI) * .7;
            hero.rightLeg.rotation.z = -Math.sin(dash * Math.PI) * .55;
          } else {
            hero.rightArm.rotation.z = .24 + 1.77 * cast;
            hero.leftArm.rotation.z = -.18 - .38 * cast;
            hero.root.position.x += .13 * cast;
            hero.rightLeg.rotation.z = -.12 * cast;
          }
          enemy.root.position.x += recoil * .28 * modelScale;
          enemy.root.rotation.z += recoil * -.15;
          enemy.head.rotation.z -= recoil * .13;
          enemy.leftArm.rotation.z -= recoil * .4;
          enemy.rightArm.rotation.z += recoil * .4;
        } else {
          enemy.leftArm.rotation.z = -.26 - 1.65 * cast;
          enemy.root.rotation.y -= .14 * cast;
          hero.root.position.x -= recoil * .19 * modelScale;
          hero.root.rotation.z += recoil * .10;
          hero.leftArm.rotation.z = -.18 + .55 * cast;
        }
      }
      scene.updateMatrixWorld(true);
      if (success) {
        hero.tip.getWorldPosition(start);
        target.set(enemyX - .2 * modelScale, 1.49 * modelScale, .50);
      } else {
        enemy.tip.getWorldPosition(start);
        target.set(heroX + .07 * modelScale, 1.40 * modelScale, .50);
      }
      const fly = ease((t - .48) / .42);
      const burst = clamp((t - .9) / .55);
      const inFlight = t >= .48 && t < .9 && !melee;
      moving.copy(start).lerp(target, fly);
      moving.y += Math.sin(fly * Math.PI) * (theme === 3 ? .50 : .18) * modelScale;
      effects.flight.visible = inFlight && !reducedMotion;
      effects.flight.position.copy(moving);
      effects.flight.scale.setScalar(modelScale * (reducedMotion ? .85 : 1));
      effects.flight.rotation.z = reducedMotion ? 0 : t * (theme === 3 ? 3 : 1.8);
      effects.flight.rotation.y = reducedMotion ? 0 : Math.sin(t * 5) * .25;
      effects.charge.visible = t < .48 && !reducedMotion;
      effects.charge.position.copy(start);
      effects.charge.scale.setScalar(modelScale * (.8 + Math.sin(clamp(t / .48) * Math.PI) * .65));
      (effects.charge.material as THREE.MeshBasicMaterial).opacity = .65;
      effects.beam.visible = inFlight && !reducedMotion && (theme === 2 || !success);
      if (effects.beam.visible) {
        direction.copy(moving).sub(start); midpoint.copy(start).add(moving).multiplyScalar(.5);
        effects.beam.position.copy(midpoint); effects.beam.scale.set(1, direction.length(), 1);
        effects.beam.quaternion.setFromUnitVectors(yAxis, direction.normalize());
        (effects.beam.material as THREE.MeshBasicMaterial).color.setHex(success ? 0x64dbe2 : 0xf5b172);
      }
      effects.groundRing.visible = t < .9 && !reducedMotion;
      effects.groundRing.position.set(success ? hero.root.position.x : enemyX, .025, .10);
      effects.groundRing.scale.setScalar(modelScale * (.65 + cast * 1.5));
      (effects.groundRing.material as THREE.MeshBasicMaterial).opacity = .75 * (1 - fly);
      for (let i = 0; i < effects.trail.length; i++) {
        const particle = effects.trail[i]; particle.visible = inFlight && !reducedMotion;
        const p = clamp(fly - i * .025);
        particle.position.copy(start).lerp(target, p);
        particle.position.y += Math.sin(p * Math.PI) * (theme === 3 ? .50 : .18) * modelScale;
        particle.position.z += Math.sin(t * 8 + i) * .05;
        particle.scale.setScalar(modelScale * (1 - i / 18));
      }
      for (const effect of [effects.hitRing, effects.secondRing]) {
        effect.visible = t >= .9 && t < 1.45;
        effect.position.copy(target);
        effect.scale.setScalar(modelScale * (reducedMotion ? 2 : .7 + burst * 4.0));
        (effect.material as THREE.MeshBasicMaterial).opacity = (1 - burst) * .95;
      }
      effects.secondRing.position.z -= .15;
      for (let i = 0; i < effects.sparks.length; i++) {
        const spark = effects.sparks[i]; spark.visible = t >= .9 && t < 1.45 && !reducedMotion;
        const angle = i * Math.PI * 2 / effects.sparks.length;
        const radius = burst * (1.0 + (i % 3) * .22) * modelScale;
        spark.position.copy(target);
        spark.position.x += Math.cos(angle) * radius;
        spark.position.y += Math.sin(angle) * radius - burst * burst * .28;
        spark.position.z += Math.sin(i * 1.7) * radius * .42;
        spark.rotation.set(t * 2, i + t * 3, angle);
        spark.scale.setScalar(modelScale * (1 - burst * .6));
        (spark.material as THREE.MeshBasicMaterial).opacity = 1 - burst;
      }
      if (success && t >= .9) {
        enemy.glow.emissive.setHex(0xffb64d); enemy.glow.emissiveIntensity = (1 - burst) * .65;
      }
      if (t > 1.67) { attack = null; effects.root.visible = false; emitPhase('待命'); }
    } else emitPhase(enemyHp === 0 ? '敵方停機' : playerHp === 0 ? '伙伴守護中' : '待命');
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);
  return {
    play(success: boolean) {
      if (!alive) return;
      attack = { started: performance.now(), success }; dirty = true;
    },
    health(enemy: number, player: number) {
      requestedEnemyHp = enemy; requestedPlayerHp = player;
      if (enemy > enemyHp) enemyHp = enemy;
      if (player > playerHp) playerHp = player;
      dirty = true;
    },
    dispose() {
      if (!alive) return;
      alive = false; cancelAnimationFrame(raf); observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', contextRestored);
      disposeScene(scene); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
