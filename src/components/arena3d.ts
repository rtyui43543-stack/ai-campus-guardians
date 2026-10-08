import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCoverHero } from './coverHero';
import { createCoverHeroSprite } from './coverHeroSprite';
import { createMissionEnemy } from './advancedBossSprite';
import type { Mode } from '../domain/types';
import { poseMage, type MageArticulation } from './magePose';
export type CinemaShot = 'wide' | 'hero' | 'enemy' | 'resolve';

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

export function createHero(): Rig & MageArticulation {
  return createCoverHero();
}

function makeCourtyard(scene: THREE.Scene) {
  // The cover-matched campus artwork sits behind the transparent WebGL layer.
  // A true 3D receiving plane keeps animated feet and shadows on that courtyard.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(45, 35),
    new THREE.ShadowMaterial({ color: 0x29453a, opacity: .22 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.045;
  floor.receiveShadow = true;
  scene.add(floor);
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
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      const card = roundBox(flight, .33, .43, .05, solid([0x8ee4c4, 0xffce71, 0x90a8ff, 0xefadb9][i]),
        Math.cos(angle) * .32, Math.sin(angle) * .32, i * .025, .03);
      card.rotation.z = angle + .25;
      ball(card, .060, solid(0xffffff), 0, .075, .055);
      box(card, .15, .032, .014, solid(0xffffff), 0, -.095, .053);
    }
    ring(flight, .52, .028, bright);
    ring(flight, .36, .014, white).rotation.y = .7;
  } else if (theme === 4) {
    const prismMaterial = solid(0xc4a2ef, .45);
    prismMaterial.emissive.setHex(0x7b46ae); prismMaterial.emissiveIntensity = .45;
    mesh(flight, new THREE.OctahedronGeometry(.35), prismMaterial);
    ring(flight, .48, .033, white).rotation.y = .8;
    ring(flight, .48, .028, bright).rotation.x = .8;
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3;
      ball(flight, .095, luminous([0x8becdf, 0xffdc7f, 0xe99eff][i]),
        Math.cos(angle) * .52, Math.sin(angle) * .52, .12);
    }
  } else if (theme === 5) {
    for (const side of [-1, 1]) {
      const page = roundBox(flight, .31, .44, .035, solid(0xfff5dc), side * .16, 0, .055, .01);
      const cover = box(flight, .34, .47, .045, solid(0x56b9a3), side * .17, 0, 0);
      page.rotation.y = cover.rotation.y = -side * .3;
      for (let i = 0; i < 3; i++) box(flight, .17, .019, .015, solid(0xb6946c), side * .16, -.08 + i * .08, .091);
    }
    mesh(flight, starGeometry(.12), bright, 0, .31, .09);
    ring(flight, .53, .028, white);
  } else if (theme === 6) {
    mesh(flight, starGeometry(.30), white, 0, 0, .10);
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3;
      mesh(flight, starGeometry(.15), luminous([0xffd379, 0x8cebd7, 0xbea2ff][i]),
        Math.cos(angle) * .48, Math.sin(angle) * .48, 0);
    }
    ring(flight, .49, .029, luminous(0x9bdcc6, .85));
    ring(flight, .57, .017, bright).rotation.x = .65;
  } else if (theme === 2) {
    ring(flight, .36, .055, bright);
    ring(flight, .49, .021, white);
    const handle = mesh(flight, new THREE.CylinderGeometry(.035, .035, .29, 8), white, -.32, -.32, 0);
    handle.rotation.z = -.7;
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const mark = box(flight, .16, .024, .03, white, Math.cos(angle) * .27, Math.sin(angle) * .27);
      mark.rotation.z = angle;
    }
    ball(flight, .27, luminous(0xe1fbfd, .23));
  } else {
    // A protective orb, rather than a physical shield attack.
    const core = mesh(flight, new THREE.IcosahedronGeometry(.28, 0), bright);
    core.rotation.z = .20;
    mesh(flight, starGeometry(.17), white, 0, 0, .30);
    ring(flight, .44, .043, bright).rotation.y = .45;
    ring(flight, .44, .030, white).rotation.x = .70;
  }
  const glowBall = ball(flight, .59, luminous(color, .17)); glowBall.castShadow = false;
  flight.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = false; });
  const beam = mesh(root, new THREE.CylinderGeometry(.12, .12, 1, 9), luminous(color, .48), 0, 0, 0, false);
  const beamCore = mesh(root, new THREE.CylinderGeometry(.036, .036, 1, 8), luminous(0xfffae5, .92), 0, 0, 0, false);
  const groundRing = ring(root, .67, .030, luminous(color, .80)); groundRing.rotation.x = Math.PI / 2;
  const groundInner = ring(root, .44, .022, luminous(0xfff2c5, .72)); groundInner.rotation.x = Math.PI / 2;
  const runeGeometry = starGeometry(.075);
  const groundRunes = Array.from({ length: 6 }, (_, i) => {
    const rune = mesh(root, runeGeometry, luminous(i % 2 ? color : 0xfff2c5, .75), 0, 0, 0, false);
    rune.rotation.x = -Math.PI / 2;
    return rune;
  });
  const hitRing = ring(root, .30, .065, luminous(0xffe8a6, .95));
  const secondRing = ring(root, .27, .038, luminous(color, .90)); secondRing.rotation.y = .65;
  const thirdRing = ring(root, .23, .025, luminous(color, .85)); thirdRing.rotation.x = .85;
  const impactCore = ball(root, .40, luminous(0xfff7ce, .75)); impactCore.castShadow = false;
  const charge = ring(root, .25, .037, luminous(color, .85)); charge.rotation.y = .2;
  const chargeInner = ring(root, .19, .022, luminous(0xfff5cf, .90)); chargeInner.rotation.x = .6;
  const chargeCore = ball(root, .17, luminous(color, .50)); chargeCore.castShadow = false;
  const orbitGeometry = new THREE.OctahedronGeometry(.05);
  const gathering = Array.from({ length: 10 }, (_, i) => mesh(root, orbitGeometry,
    luminous(i % 2 ? color : 0xfff5cf, .85), 0, 0, 0, false));
  const waveRings = Array.from({ length: 3 }, () => ring(root, .24, .021, luminous(color, .70)));
  const trailGeometry = new THREE.SphereGeometry(.09, 7, 5);
  const trail = Array.from({ length: 24 }, (_, i) => mesh(root, trailGeometry,
    luminous(i % 3 ? color : 0xfff6d7, .74), 0, 0, 0, false));
  const sparkGeometry = new THREE.OctahedronGeometry(.073);
  const sparks = Array.from({ length: 32 }, (_, i) => mesh(root, sparkGeometry,
    luminous(i % 2 ? color : 0xffe6a1, .95), 0, 0, 0, false));
  return { root, flight, beam, beamCore, groundRing, groundInner, groundRunes,
    hitRing, secondRing, thirdRing, impactCore, charge, chargeInner, chargeCore,
    gathering, waveRings, trail, sparks };
}

function disposeScene(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  scene.clear();
}

/** Cover-derived actor art, articulated 3D bosses and local 3D spell effects. */
export function createArenaScene(host: HTMLDivElement, chapter: number, reducedMotion: boolean,
  onPhase: (phase: string) => void, initialShot?: CinemaShot, companion = false, mode: Mode = 'starter') {
  const theme = clamp(chapter, 1, 6);
  const scene = new THREE.Scene();
  scene.background = null;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04;
  renderer.setClearColor(0x000000, 0);
  const room = new RoomEnvironment();
  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  const environment = environmentGenerator.fromScene(room, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .48;
  room.dispose(); environmentGenerator.dispose();
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.setAttribute('data-scene', 'cover-matched-3d-campus');
  host.appendChild(renderer.domElement);
  const camera = new THREE.OrthographicCamera(-6, 6, 4.4, -4.4, .1, 60);
  camera.position.set(0, 6.5, 15); camera.lookAt(0, 1.8, 0);
  scene.add(new THREE.HemisphereLight(0xe7f6ff, 0x8eaa78, 1.55));
  const sun = new THREE.DirectionalLight(0xffe6b2, 3.2);
  sun.position.set(-4.5, 10, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536); sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 24; sun.shadow.normalBias = .03;
  sun.shadow.bias = -.00015; sun.shadow.radius = 3; scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc9efff, 1.25); fill.position.set(4, 3, -2); scene.add(fill);
  makeCourtyard(scene);
  let alive = true, dirty = true;
  renderer.domElement.setAttribute('data-hero', 'cover-poses-v3');
  renderer.domElement.setAttribute('data-hero-status', 'loading');
  const hero = createCoverHeroSprite({
    onReady: () => { if (alive) { dirty = true; renderer.domElement.setAttribute('data-hero-status', 'ready'); } },
    onError: () => { if (alive) { dirty = true; renderer.domElement.setAttribute('data-hero-status', 'unavailable'); } },
  });
  renderer.domElement.setAttribute('data-boss-status', !companion && mode === 'advanced' ? 'loading' : 'ready');
  const enemy = createMissionEnemy(theme, mode, companion, {
    onReady: () => { if (alive) { dirty = true; renderer.domElement.setAttribute('data-boss-status', 'ready'); } },
    onError: () => { if (alive) { dirty = true; renderer.domElement.setAttribute('data-boss-status', 'unavailable'); } },
  });
  scene.add(hero.root, enemy.root);
  renderer.domElement.setAttribute('data-guardian', enemy.root.userData.missionBossId);
  renderer.domElement.setAttribute('data-boss', enemy.root.userData.missionBossId);
  renderer.domElement.setAttribute('data-boss-mode', companion ? 'companion' : mode);
  hero.root.rotation.y = .13; enemy.root.rotation.y = -.15;
  const drone = createDrone(scene), effects = createEffects(scene, theme);
  const cinemaMagic = new THREE.Group(); scene.add(cinemaMagic);
  const cinemaHalo = ring(cinemaMagic, .95, .025, luminous(0x70f5dd, .65), 0, .05, 0);
  cinemaHalo.rotation.x = Math.PI / 2;
  const cinemaStars = Array.from({ length: 12 }, (_, i) => mesh(cinemaMagic, starGeometry(.075), luminous(i % 2 ? 0xffda79 : 0x70f5dd, .7), 0, 0, 0, false));
  let cinemaShot = initialShot, cinemaPaused = false, cinemaTime = 0, cinemaStarted = 0;
  let shotFromX = 0, shotFromZoom = 1, shotFromY = 1.55, shotLookX = 0, shotLookY = 1.55;
  let framingY = 1.8, framingElevation = 4.7;
  let raf = 0, lastFrame = 0, heroX = -2.8, enemyX = 2.8, modelScale = 1;
  let enemyHp = 100, playerHp = 100, requestedEnemyHp = 100, requestedPlayerHp = 100;
  let attack: { started: number; success: boolean; launchOrigin?: THREE.Vector3 } | null = null;
  let reportedPhase = '';
  const start = new THREE.Vector3(), target = new THREE.Vector3(), moving = new THREE.Vector3();
  const direction = new THREE.Vector3(), midpoint = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  const baseHeroRotation = .13, baseEnemyRotation = -.15;
  const stage = host.closest('.duel-stage');
  const bubble = stage?.querySelector<HTMLElement>('.duel-bubble');
  const answers = stage?.querySelector<HTMLElement>('.duel-answer-area');
  const emitPhase = (phase: string) => {
    if (phase !== reportedPhase && alive) { reportedPhase = phase; onPhase(phase); }
  };
  const resize = () => {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    const aspect = width / height, viewHeight = cinemaShot ? 6 : 8.8, viewWidth = viewHeight * aspect;
    camera.left = -viewWidth / 2; camera.right = viewWidth / 2;
    camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
    const portrait = aspect < .85;
    modelScale = portrait ? .8 : 1;
    let lookY = portrait ? 1.30 : 1.80;
    const elevation = portrait ? 3.9 : 4.7;
    if (!cinemaShot && bubble && answers) {
      // Frame the complete pointed hat and boots inside the playable gap.
      // Short phones and extra hint text change this gap without covering the answers.
      const bounds = host.getBoundingClientRect();
      const top = Math.max(height * .27, bubble.getBoundingClientRect().bottom - bounds.top + 12);
      const bottom = Math.min(height * .76, answers.getBoundingClientRect().top - bounds.top - 10);
      const cosPitch = 15 / Math.hypot(15, elevation);
      const available = Math.max(height * .16, bottom - top);
      // The hero's camera-facing art keeps its full projected height at any pitch.
      modelScale = clamp(available / height * viewHeight / 3.82, .40, portrait ? .8 : 1);
      lookY = (bottom / height - .5) * viewHeight / cosPitch;
    }
    if (!cinemaShot && portrait && mode === 'advanced' && !companion) {
      // Wider advanced species also need a horizontal limit; height alone cuts off
      // the cloud giant's fist or the fox's tail at the edge of a narrow phone.
      const outerExtent = Math.max(2, Number(enemy.root.userData.outerRightExtent) || 2);
      modelScale = Math.min(modelScale, (viewWidth * .265 - .10) / outerExtent);
    }
    camera.position.set(0, lookY + elevation, 15);
    camera.lookAt(0, lookY, 0); camera.updateProjectionMatrix();
    framingY = lookY; framingElevation = elevation;
    if (cinemaShot) { modelScale = 1; framingY = 1.55; framingElevation = 3.8; }
    else camera.zoom = 1;
    heroX = -Math.min(3.35, viewWidth * .235); enemyX = -heroX;
    hero.root.scale.setScalar(modelScale); enemy.root.scale.setScalar(modelScale);
    hero.root.position.x = heroX; enemy.root.position.x = enemyX;
    drone.scale.setScalar(modelScale);
    renderer.setSize(width, height, false); dirty = true;
  };
  const observer = new ResizeObserver(() => { if (!attack) resize(); });
  observer.observe(host);
  if (bubble) observer.observe(bubble);
  if (answers) observer.observe(answers);
  resize();
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
    if (cinemaShot && cinemaPaused && !attack && !dirty) return;
    const frameDelta = lastFrame ? Math.min((now - lastFrame) / 1000, .10) : 0;
    lastFrame = now; dirty = false;
    if (!cinemaPaused) cinemaTime += frameDelta;
    const effectClock = attack ? (now - attack.started) / 1000 * (reducedMotion ? 6 : 1) : Infinity;
    // Health restoration has no animation delay. A new hit takes effect at contact;
    // a restored save without an active cast shows its health on this first frame.
    if (!attack || effectClock >= .9) {
      enemyHp = requestedEnemyHp;
      playerHp = requestedPlayerHp;
    }
    const idle = cinemaShot ? cinemaTime : now / 1000;
    const idleBob = reducedMotion ? 0 : Math.sin(idle * 2.4) * .018;
    hero.root.position.set(heroX, idleBob, 0);
    enemy.root.position.set(enemyX, idleBob * .65 + (enemyHp === 0 ? -.10 : 0), 0);
    hero.root.rotation.set(0, baseHeroRotation, 0);
    enemy.root.rotation.set(0, baseEnemyRotation, enemyHp === 0 ? .055 : 0);
    hero.head.rotation.set(0, 0, reducedMotion ? 0 : Math.sin(idle * 1.5) * .017);
    enemy.head.rotation.z = reducedMotion ? 0 : Math.sin(idle * 1.7 + 1) * .025;
    poseMage(hero);
    enemy.leftArm.rotation.set(0, 0, -.26); enemy.rightArm.rotation.set(0, 0, .26);
    for (const part of [hero.leftLeg, hero.rightLeg, enemy.leftLeg, enemy.rightLeg]) part.rotation.set(0, 0, 0);
    enemy.glow.emissive.setHex(enemyHp === 0 ? 0x1e614d : 0x000000);
    enemy.glow.emissiveIntensity = enemyHp === 0 ? .18 : 0;
    hero.glow.emissiveIntensity = .65;
    // Keep the helper clear of the cover actor's wider hat, hair and face.
    drone.position.set(heroX - modelScale * 1.45, modelScale * (3.30 + (reducedMotion ? 0 : Math.sin(idle * 3) * .08)), -.1);
    drone.rotation.y = reducedMotion ? 0 : Math.sin(idle * 1.5) * .12;
    cinemaMagic.visible = Boolean(cinemaShot);
    if (cinemaShot) {
      const elapsed = cinemaTime - cinemaStarted;
      // Pausing at a scene change must still frame that scene's speaker, rather than
      // freezing midway between two close-ups and cutting the character off-screen.
      const travel = reducedMotion || cinemaPaused ? 1 : ease(elapsed / 1.3);
      const desiredX = cinemaShot === 'hero' ? heroX : cinemaShot === 'enemy' ? enemyX : 0;
      const desiredY = cinemaShot === 'hero' ? 2.05 : cinemaShot === 'enemy' ? 1.75 : framingY;
      const desiredZoom = cinemaShot === 'hero' || cinemaShot === 'enemy' ? 1.6 : 1;
      shotLookX = THREE.MathUtils.lerp(shotFromX, desiredX, travel);
      shotLookY = THREE.MathUtils.lerp(shotFromY, desiredY, travel);
      camera.zoom = THREE.MathUtils.lerp(shotFromZoom, desiredZoom, travel);
      camera.position.set(shotLookX, shotLookY + framingElevation, 15);
      camera.lookAt(shotLookX, shotLookY, 0); camera.updateProjectionMatrix();
      if (!reducedMotion) {
        const arrival = 1 - ease(elapsed / 1.5);
        if (cinemaShot === 'wide') {
          hero.root.position.x -= arrival * .65;
          hero.leftLeg.rotation.x = Math.sin(elapsed * 8) * .16 * arrival;
          hero.rightLeg.rotation.x = -hero.leftLeg.rotation.x;
          enemy.head.rotation.z = Math.sin(idle * 2) * .08;
        }
        if (cinemaShot === 'hero' || cinemaShot === 'resolve') {
          poseMage(hero, { greeting: ease(elapsed / .8), sway: Math.sin(idle * 2) });
          hero.head.rotation.y = -.08;
          hero.glow.emissiveIntensity = 1 + Math.sin(idle * 2) * .35;
        }
        if (cinemaShot === 'enemy') {
          enemy.rightArm.rotation.z = .26 + .7 * ease(elapsed / .8);
          enemy.rightArm.rotation.x = Math.sin(idle * 3) * .14;
          drone.position.y += Math.sin(idle * 4) * .12;
        }
      }
      cinemaMagic.position.x = cinemaShot === 'enemy' ? enemyX : heroX;
      const magicStrength = cinemaShot === 'resolve' ? 1 : .45;
      cinemaHalo.scale.setScalar(1 + (reducedMotion ? 0 : Math.sin(idle * 2) * .06));
      (cinemaHalo.material as THREE.MeshBasicMaterial).opacity = magicStrength * .65;
      for (let i = 0; i < cinemaStars.length; i++) {
        const a = i * Math.PI / 6 + (reducedMotion ? 0 : idle * .35);
        cinemaStars[i].position.set(Math.cos(a) * 1.05, .8 + (i % 4) * .54 + (reducedMotion ? 0 : Math.sin(idle * 1.5 + i) * .16), Math.sin(a) * .6);
        cinemaStars[i].rotation.z = reducedMotion ? 0 : idle * .4 + i;
        (cinemaStars[i].material as THREE.MeshBasicMaterial).opacity = magicStrength * .8;
      }
      emitPhase(cinemaPaused ? '劇情暫停' : '劇情演出');
    }
    effects.root.visible = !!attack;
    if (attack) {
      // Reduced-motion mode completes its fixed flash before the UI unlocks at 450 ms.
      // Scale only the effect clock; the ordinary cast still impacts at 900 ms.
      const t = effectClock;
      const success = attack.success;
      emitPhase(t < .34 ? '魔力匯聚' : t < .48 ? '揮杖施法' : t < .9 ? '法術飛行' : t < 1.45 ? '法術命中' : '收杖');
      const windup = Math.sin(clamp(t / .34) * Math.PI / 2);
      const recovery = 1 - ease((t - 1.2) / .45);
      const cast = ease((t - .25) / .28) * recovery;
      const recoil = Math.sin(clamp((t - .9) / .45) * Math.PI) * (1 - clamp((t - .9) / .55));
      if (!reducedMotion) {
        if (success) {
          hero.root.position.y -= Math.sin(clamp(t / .44) * Math.PI) * .09;
          hero.root.rotation.z = -.055 * windup * (1 - cast);
          hero.root.rotation.y += .30 * cast;
          // Draw the staff back, then aim the gem toward the enemy; the free hand casts.
          poseMage(hero, { cast, windup });
          hero.root.position.x += .20 * cast;
          hero.leftLeg.rotation.z = .16 * cast;
          hero.rightLeg.rotation.z = -.18 * cast;
          hero.glow.emissiveIntensity = .65 + 1.2 * (1 - clamp((t - .48) / .6));
          enemy.root.position.x += recoil * .48 * modelScale;
          enemy.root.rotation.z += recoil * -.23;
          enemy.head.rotation.z -= recoil * .19;
          enemy.leftArm.rotation.z -= recoil * .55;
          enemy.rightArm.rotation.z += recoil * .55;
        } else {
          enemy.leftArm.rotation.z = -.26 - 1.65 * cast;
          enemy.root.rotation.y -= .14 * cast;
          hero.root.position.x -= recoil * .19 * modelScale;
          hero.root.rotation.z += recoil * .10;
          poseMage(hero, { defense: cast });
        }
      }
      // Select the cover-derived pose before sampling its visible crystal tip.
      hero.updateVisual({ camera, attackTime: t, success, reducedMotion });
      enemy.updateVisual?.({ camera, attackTime: t, success, reducedMotion });
      scene.updateMatrixWorld(true);
      if (success) {
        hero.tip.getWorldPosition(start);
        target.set(enemyX - .2 * modelScale, 1.49 * modelScale, .50);
      } else {
        enemy.tip.getWorldPosition(start);
        target.set(heroX + .07 * modelScale, 1.40 * modelScale, .50);
      }
      // A launched projectile no longer follows later actor pose changes.
      if (t >= .48) {
        attack.launchOrigin ??= start.clone();
        start.copy(attack.launchOrigin);
      }
      const fly = ease((t - .48) / .42);
      const burst = clamp((t - .9) / .55);
      const inFlight = t >= .48 && t < .9;
      moving.copy(start).lerp(target, fly);
      moving.y += Math.sin(fly * Math.PI) * (theme === 3 ? .50 : .18) * modelScale;
      effects.flight.visible = inFlight && !reducedMotion;
      effects.flight.position.copy(moving);
      effects.flight.scale.setScalar(modelScale * (reducedMotion ? .85 : 1.10));
      effects.flight.rotation.z = reducedMotion ? 0 : t * (theme === 3 ? 8 : theme === 6 ? 4 : 1.8);
      effects.flight.rotation.y = reducedMotion ? 0 : Math.sin(t * 5) * .25;
      const gathering = clamp(t / .48);
      for (const [i, charge] of [effects.charge, effects.chargeInner, effects.chargeCore].entries()) {
        charge.visible = t < .48 && !reducedMotion;
        charge.position.copy(start);
        charge.scale.setScalar(modelScale * (.65 + gathering * 1.6));
        if (i < 2) charge.rotation.z = t * (i ? -6 : 5);
        (charge.material as THREE.MeshBasicMaterial).opacity = .5 + gathering * .35;
      }
      for (let i = 0; i < effects.gathering.length; i++) {
        const particle = effects.gathering[i]; particle.visible = t < .48 && !reducedMotion;
        const angle = i * Math.PI * 2 / effects.gathering.length + t * 6;
        const radius = (.70 * (1 - gathering) + .13) * modelScale;
        particle.position.copy(start);
        particle.position.x += Math.cos(angle) * radius;
        particle.position.y += Math.sin(angle) * radius;
        particle.position.z += Math.sin(angle * 2) * radius * .25;
        particle.scale.setScalar(modelScale * (.55 + gathering * .65));
      }
      const beamVisible = inFlight && !reducedMotion && (theme === 2 || theme === 4 || !success);
      effects.beam.visible = beamVisible; effects.beamCore.visible = beamVisible;
      if (beamVisible) {
        direction.copy(moving).sub(start); midpoint.copy(start).add(moving).multiplyScalar(.5);
        const length = direction.length(); direction.normalize();
        for (const beam of [effects.beam, effects.beamCore]) {
          beam.position.copy(midpoint); beam.scale.set(modelScale, length, modelScale);
          beam.quaternion.setFromUnitVectors(yAxis, direction);
        }
        (effects.beam.material as THREE.MeshBasicMaterial).color.setHex(success ? 0x64dbe2 : 0xf5b172);
      }
      const circleScale = modelScale * (.85 + windup * .65);
      for (const [i, circle] of [effects.groundRing, effects.groundInner].entries()) {
        circle.visible = t < .9 && !reducedMotion;
        circle.position.set(success ? hero.root.position.x : enemyX, .025 + i * .005, .10);
        circle.scale.setScalar(circleScale);
        (circle.material as THREE.MeshBasicMaterial).opacity = .80 * (1 - fly);
      }
      for (let i = 0; i < effects.groundRunes.length; i++) {
        const rune = effects.groundRunes[i], angle = i * Math.PI / 3 + t * .8;
        rune.visible = t < .9 && !reducedMotion;
        rune.position.set((success ? hero.root.position.x : enemyX) + Math.cos(angle) * circleScale * .55,
          .035, .1 + Math.sin(angle) * circleScale * .55);
        rune.scale.setScalar(modelScale);
        rune.rotation.z = angle;
        (rune.material as THREE.MeshBasicMaterial).opacity = .85 * (1 - fly);
      }
      for (let i = 0; i < effects.waveRings.length; i++) {
        const wave = effects.waveRings[i]; wave.visible = inFlight && !reducedMotion && theme !== 3;
        const p = clamp(fly - .10 - i * .12);
        wave.position.copy(start).lerp(target, p);
        wave.position.y += Math.sin(p * Math.PI) * .18 * modelScale;
        wave.rotation.y = Math.PI / 2;
        wave.scale.setScalar(modelScale * (.60 + (i + 1) * .45));
        (wave.material as THREE.MeshBasicMaterial).opacity = (.55 - i * .10) * fly;
      }
      for (let i = 0; i < effects.trail.length; i++) {
        const particle = effects.trail[i]; particle.visible = inFlight && !reducedMotion;
        const p = clamp(fly - i * .018);
        particle.position.copy(start).lerp(target, p);
        particle.position.y += Math.sin(p * Math.PI) * (theme === 3 ? .50 : .18) * modelScale;
        particle.position.y += Math.sin(t * 12 + i) * .045 * modelScale;
        particle.position.z += Math.sin(t * 8 + i) * .06;
        particle.scale.setScalar(modelScale * (1.30 - i / 26));
        (particle.material as THREE.MeshBasicMaterial).opacity = .78 * (1 - i / 30);
      }
      for (const [i, effect] of [effects.hitRing, effects.secondRing, effects.thirdRing].entries()) {
        effect.visible = t >= .9 && t < 1.45;
        effect.position.copy(target);
        effect.scale.setScalar(modelScale * (reducedMotion ? 2 : .75 + burst * (4.5 + i * .35)));
        (effect.material as THREE.MeshBasicMaterial).opacity = (1 - burst) * .95;
      }
      effects.secondRing.position.z -= .15;
      effects.thirdRing.position.z += .15;
      effects.impactCore.visible = t >= .9 && t < 1.22 && !reducedMotion;
      effects.impactCore.position.copy(target);
      effects.impactCore.scale.setScalar(modelScale * (.7 + Math.sin(burst * Math.PI) * 1.8));
      (effects.impactCore.material as THREE.MeshBasicMaterial).opacity = .78 * (1 - clamp(burst * 2));
      for (let i = 0; i < effects.sparks.length; i++) {
        const spark = effects.sparks[i]; spark.visible = t >= .9 && t < 1.45 && !reducedMotion;
        const angle = i * Math.PI * 2 / effects.sparks.length;
        const radius = burst * (1.20 + (i % 3) * .26) * modelScale;
        spark.position.copy(target);
        spark.position.x += Math.cos(angle) * radius;
        spark.position.y += Math.sin(angle) * radius - burst * burst * .28;
        spark.position.z += Math.sin(i * 1.7) * radius * .42;
        spark.rotation.set(t * 2, i + t * 3, angle);
        spark.scale.setScalar(modelScale * (1.1 - burst * .7));
        (spark.material as THREE.MeshBasicMaterial).opacity = 1 - burst;
      }
      if (success && t >= .9) {
        enemy.glow.emissive.setHex(0xffb64d); enemy.glow.emissiveIntensity = (1 - burst) * .65;
      }
      if (t > 1.67) { attack = null; effects.root.visible = false; emitPhase('待命'); resize(); }
    } else if (!cinemaShot) emitPhase(enemyHp === 0 ? '敵方退場' : playerHp === 0 ? '伙伴守護中' : '待命');
    if (!attack) {
      hero.updateVisual({ camera, reducedMotion, greeting: cinemaShot === 'hero' || cinemaShot === 'resolve' });
      enemy.updateVisual?.({ camera, reducedMotion });
    }
    renderer.domElement.setAttribute('data-hero-pose', String(hero.root.userData.pose ?? 'idle'));
    renderer.domElement.setAttribute('data-boss-pose', String(enemy.root.userData.pose ?? 'native'));
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);
  return {
    shot(next?: CinemaShot) {
      if (!alive || next === cinemaShot) return;
      shotFromX = shotLookX; shotFromY = shotLookY; shotFromZoom = camera.zoom;
      cinemaShot = next; cinemaStarted = cinemaTime - (cinemaPaused ? 1.3 : 0); resize();
    },
    pauseCinema(paused: boolean) { if (cinemaPaused !== paused) lastFrame = performance.now(); cinemaPaused = paused; dirty = true; },
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
      hero.disposeVisual();
      enemy.disposeVisual?.();
      disposeScene(scene); environment.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
