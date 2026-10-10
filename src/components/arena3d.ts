import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCoverHero } from './coverHero';
import { createCoverHeroSprite } from './coverHeroSprite';
import { createMissionEnemy } from './advancedBossSprite';
import { createFinalBossSprite } from './finalBossSprite';
import { createBattleFrameTracker, fitBattleActors, fitStoryActors, measureActorFraming } from './arenaFraming';
import type { Mode } from '../domain/types';
import { poseMage, type MageArticulation } from './magePose';
import { createThemedSpellEffects, heroSpellColors, NORMAL_CAST_SECONDS, ULTIMATE_CAST_SECONDS } from './themedSpellEffects';
import { contactReaction, enemyAttackName, enemyCastMotion } from './combatChoreography';
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
  onPhase: (phase: string) => void, initialShot?: CinemaShot, companion = false, mode: Mode = 'starter', finalBoss = false) {
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
  renderer.domElement.setAttribute('data-boss-status', !companion && (mode === 'advanced' || finalBoss) ? 'loading' : 'ready');
  const enemyOptions = {
    onReady: () => { if (alive) { dirty = true; renderer.domElement.setAttribute('data-boss-status', 'ready'); } },
    onError: () => { if (alive) { dirty = true; renderer.domElement.setAttribute('data-boss-status', 'unavailable'); } },
  };
  const enemy = finalBoss ? createFinalBossSprite(mode, enemyOptions) : createMissionEnemy(theme, mode, companion, enemyOptions);
  scene.add(hero.root, enemy.root);
  renderer.domElement.setAttribute('data-guardian', enemy.root.userData.missionBossId);
  renderer.domElement.setAttribute('data-boss', enemy.root.userData.missionBossId);
  renderer.domElement.setAttribute('data-boss-mode', companion ? 'companion' : mode);
  hero.root.rotation.y = .13; enemy.root.rotation.y = -.15;
  const heroFraming = measureActorFraming(hero, camera);
  const enemyFraming = measureActorFraming(enemy, camera);
  const trackBattleFrame = createBattleFrameTracker();
  const drone = createDrone(scene);
  let effectTheme = theme;
  let effects = createThemedSpellEffects(scene, effectTheme, mode, finalBoss);
  const cinemaMagic = new THREE.Group(); scene.add(cinemaMagic);
  const cinemaHalo = ring(cinemaMagic, .95, .025, luminous(0x70f5dd, .65), 0, .05, 0);
  cinemaHalo.rotation.x = Math.PI / 2;
  const cinemaStars = Array.from({ length: 12 }, (_, i) => mesh(cinemaMagic, starGeometry(.075), luminous(i % 2 ? 0xffda79 : 0x70f5dd, .7), 0, 0, 0, false));
  let cinemaShot = initialShot, cinemaPaused = false, cinemaTime = 0, cinemaStarted = 0;
  let shotFromX = 0, shotFromZoom = 1, shotFromY = 1.55, shotLookX = 0, shotLookY = 1.55;
  let framingY = 1.8, framingElevation = 4.7;
  let raf = 0, lastFrame = 0, heroX = -2.8, enemyX = 2.8, modelScale = 1;
  let enemyHp = 100, playerHp = 100, requestedEnemyHp = 100, requestedPlayerHp = 100;
  let attack: { started: number; success: boolean; ultimate: boolean; blocked: boolean; critical: boolean; missed: boolean; launchOrigin?: THREE.Vector3 } | null = null;
  let reportedPhase = '';
  const start = new THREE.Vector3(), target = new THREE.Vector3(), moving = new THREE.Vector3();
  const baseHeroRotation = .13, baseEnemyRotation = -.15;
  const stage = host.closest('.duel-stage');
  const bubble = stage?.querySelector<HTMLElement>('.duel-bubble');
  const answers = stage?.querySelector<HTMLElement>('.duel-answer-area');
  const castingParts: { object: THREE.Object3D; rotation: THREE.Euler }[] = [];
  enemy.root.traverse(object => {
    if (['book-spirit-paper-wing', 'paper-dragon-left-wing', 'paper-dragon-right-wing', 'lion-gear-crown'].includes(object.name)) {
      castingParts.push({ object, rotation: object.rotation.clone() });
    }
  });
  const emitPhase = (phase: string) => {
    if (phase !== reportedPhase && alive) { reportedPhase = phase; onPhase(phase); }
  };
  const resize = () => {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    const aspect = width / height, viewHeight = cinemaShot ? 6 : 8.8, viewWidth = viewHeight * aspect;
    camera.left = -viewWidth / 2; camera.right = viewWidth / 2;
    camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
    const portrait = aspect < .85;
    modelScale = 1;
    let lookY = 1.55, elevation = 3.8;
    heroX = -Math.min(3.35, viewWidth * .235); enemyX = -heroX;
    if (!cinemaShot && stage && bubble && answers) {
      const bounds = host.getBoundingClientRect();
      const explanation = answers?.querySelector<HTMLElement>('.duel-explanation-actions');
      const extraFooter = explanation
        ? explanation.getBoundingClientRect().height + parseFloat(getComputedStyle(explanation).marginTop || '0') : 0;
      const layout = trackBattleFrame({ width, height,
        questionBottom: bubble.getBoundingClientRect().bottom - bounds.top,
        answersTop: answers.getBoundingClientRect().top - bounds.top + extraFooter,
        resolving: bubble.classList.contains('is-resolving') });
      const fitted = fitBattleActors(layout, heroFraming, enemyFraming);
      modelScale = fitted.scale; lookY = fitted.lookY; elevation = fitted.elevation;
      heroX = fitted.heroX; enemyX = fitted.enemyX; camera.zoom = 1;
      if (stage instanceof HTMLElement) {
        stage.style.setProperty('--combat-top', `${fitted.top}px`);
        stage.style.setProperty('--combat-bottom', `${Math.max(fitted.top + 1, fitted.bottom)}px`);
      }
      const hud = stage?.querySelector<HTMLElement>('.duel-hud');
      if (hud && stage instanceof HTMLElement) {
        stage.style.setProperty('--duel-skill-top', `${hud.getBoundingClientRect().bottom - bounds.top + 12}px`);
      }
    } else if (!cinemaShot) {
      // Welcome/banner Arenas retain their existing presentation.
      modelScale = portrait ? .8 : 1;
      lookY = portrait ? 1.30 : 1.80; elevation = portrait ? 3.9 : 4.7;
      camera.zoom = 1;
    }
    camera.position.set(0, lookY + elevation, 15);
    camera.lookAt(0, lookY, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    framingY = lookY; framingElevation = elevation;
    hero.root.scale.setScalar(modelScale); enemy.root.scale.setScalar(modelScale);
    hero.root.position.x = heroX; enemy.root.position.x = enemyX;
    if (!cinemaShot && stage instanceof HTMLElement) {
      const heroAnchor = new THREE.Vector3(heroX, 1.4 * modelScale, .5).project(camera);
      const enemyAnchor = new THREE.Vector3(enemyX, 1.5 * modelScale, .5).project(camera);
      const missAnchor = new THREE.Vector3(heroX - .58 * modelScale, .85 * modelScale, .5).project(camera);
      const guardAnchor = new THREE.Vector3(heroX + .25 * modelScale, 1.4 * modelScale, .5).project(camera);
      stage.style.setProperty('--hero-lane-x', `${(heroAnchor.x + 1) * 50}%`);
      stage.style.setProperty('--enemy-lane-x', `${(enemyAnchor.x + 1) * 50}%`);
      stage.style.setProperty('--enemy-miss-x', `${(missAnchor.x + 1) * 50}%`);
      stage.style.setProperty('--enemy-miss-y', `${(1 - missAnchor.y) * 50}%`);
      stage.style.setProperty('--enemy-guard-x', `${(guardAnchor.x + 1) * 50}%`);
      stage.style.setProperty('--actor-cast-y', `${(1 - enemyAnchor.y) * 50}%`);
      stage.style.setProperty('--actor-impact-y', `${(1 - heroAnchor.y) * 50}%`);
    }
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
    hero.root.scale.setScalar(modelScale); enemy.root.scale.setScalar(modelScale);
    hero.root.rotation.set(0, baseHeroRotation, 0);
    enemy.root.rotation.set(0, baseEnemyRotation, enemyHp === 0 ? .055 : 0);
    hero.head.rotation.set(0, 0, reducedMotion ? 0 : Math.sin(idle * 1.5) * .017);
    enemy.head.rotation.set(0, 0, reducedMotion ? 0 : Math.sin(idle * 1.7 + 1) * .025);
    for (const part of castingParts) part.object.rotation.copy(part.rotation);
    poseMage(hero);
    enemy.leftArm.rotation.set(0, 0, -.26); enemy.rightArm.rotation.set(0, 0, .26);
    for (const part of [hero.leftLeg, hero.rightLeg, enemy.leftLeg, enemy.rightLeg]) part.rotation.set(0, 0, 0);
    enemy.glow.emissive.setHex(enemyHp === 0 ? 0x1e614d : 0x000000);
    enemy.glow.emissiveIntensity = enemyHp === 0 ? .18 : 0;
    hero.glow.emissiveIntensity = .65;
    hero.glow.emissive.setHex(heroSpellColors[effectTheme - 1]);
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
      const requestedShot = {
        x: THREE.MathUtils.lerp(shotFromX, desiredX, travel),
        y: THREE.MathUtils.lerp(shotFromY, desiredY, travel),
        zoom: THREE.MathUtils.lerp(shotFromZoom, desiredZoom, travel),
      };
      const safeShot = fitStoryActors(camera.right - camera.left, camera.top - camera.bottom, requestedShot,
        { heroX, enemyX, hero: heroFraming, enemy: enemyFraming }, framingElevation);
      shotLookX = safeShot.x; shotLookY = safeShot.y; camera.zoom = safeShot.zoom;
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
      // Reduced-motion mode shows the same recognizable object with a short hold.
      // Scale only the effect clock; ordinary motion contacts at 900 ms.
      const t = effectClock;
      const success = attack.success;
      const phoenixCast = success && effectTheme === 5;
      const iceCast = success && effectTheme === 6;
      emitPhase(!success && attack.missed && t >= .9 ? '鏡像閃避 · 魔王落空'
        : !success && attack.critical ? t < .42 ? '魔王追擊必殺蓄勢' : t < .9 ? '魔王追擊必殺飛襲' : t < 1.75 ? '魔王追擊必殺命中' : '魔王追擊收勢'
        : attack.ultimate
        ? phoenixCast ? t < .42 ? '烈焰鳳召喚' : t < .9 ? '烈焰鳳飛襲' : t < 2.65 ? '烈焰命中燃燒' : '烈焰收勢'
        : iceCast ? t < .42 ? '寒晶凝結' : t < .9 ? mode === 'advanced' ? '極寒冰龍飛襲' : '冰矛飛襲' : t < 2.65 ? '碎冰寒霜蔓延' : '寒霜收勢'
        : t < .42 ? mode === 'advanced' ? '升級必殺蓄勢' : '必殺蓄勢' : t < .9 ? mode === 'advanced' ? '全場魔法展開' : '必殺技展開' : t < 2.65 ? '專屬魔法成形' : '必殺收勢'
        : attack.blocked && t >= .9 && t < 1.75 ? '守護盾攔截'
        : !success ? `${enemyAttackName(mode, theme, finalBoss)} · ${t < .34 ? '蓄力' : t < .48 ? '出手' : t < .9 ? '飛襲' : t < 1.75 ? '命中' : '收勢'}`
        : phoenixCast ? t < .34 ? '火羽匯聚' : t < .48 ? '揮杖施火' : t < .9 ? '火羽飛襲' : t < 1.75 ? '火焰迸裂' : '收杖'
        : iceCast ? t < .34 ? '霜晶凝結' : t < .48 ? '揮杖施冰' : t < .9 ? '冰矛飛襲' : t < 1.75 ? '碎冰霜霧' : '收杖'
        : t < .34 ? '魔力匯聚' : t < .48 ? '揮杖施法' : t < .9 ? '法術飛行' : t < 1.75 ? '法術命中' : '收杖');
      const windup = Math.sin(clamp(t / .34) * Math.PI / 2);
      const recovery = 1 - ease((t - 1.2) / .45);
      const cast = ease((t - .25) / .28) * recovery;
      const recoil = attack.ultimate
        ? Math.sin(clamp((t - .9) / .45) * Math.PI) * (1 - clamp((t - .9) / .55))
        : contactReaction(t, reducedMotion, attack.missed);
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
          if (!attack.ultimate) enemy.root.scale.y *= 1 - recoil * .045;
          enemy.head.rotation.z -= recoil * .19;
          enemy.leftArm.rotation.z -= recoil * .55;
          enemy.rightArm.rotation.z += recoil * .55;
        } else {
          const motion = enemyCastMotion(t, reducedMotion);
          enemy.root.position.x += (.10 * motion.anticipation - .10 * motion.release) * modelScale;
          enemy.root.position.y -= .06 * motion.anticipation * modelScale;
          enemy.leftArm.rotation.z = -.26 - (attack.critical ? 2.1 : 1.65) * cast;
          enemy.root.rotation.y -= .14 * cast;
          enemy.head.rotation.x = -.12 * motion.anticipation + .10 * motion.release;
          for (const part of castingParts) {
            if (part.object.name === 'lion-gear-crown') part.object.rotation.z += motion.anticipation * .22;
            else {
              const side = part.object.position.x < 0 ? -1 : 1;
              part.object.rotation.y += side * (.22 * motion.anticipation - .30 * motion.release);
              part.object.rotation.z += side * (.12 * motion.anticipation + .16 * motion.release);
            }
          }
          if (attack.critical) { enemy.root.position.y += Math.sin(clamp(t / .8) * Math.PI) * .16 * modelScale; enemy.root.scale.setScalar(modelScale * (1 + Math.sin(clamp(t / 1.65) * Math.PI) * .09)); }
          // A mirror dodge visibly steps aside, without a false hit reaction.
          if (attack.missed) hero.root.position.x -= ease((t - .35) / .4) * (1 - ease((t - 1.2) / .55)) * .30 * modelScale;
          else {
            hero.root.position.x -= recoil * (attack.blocked ? .035 : attack.critical ? .29 : .19) * modelScale;
            hero.root.rotation.z += recoil * (attack.blocked ? .025 : attack.critical ? .15 : .10);
            hero.root.scale.y *= 1 - recoil * (attack.blocked ? .008 : .035);
          }
          poseMage(hero, { defense: cast });
        }
      }
      // Select the cover-derived pose before sampling its visible crystal tip.
      hero.updateVisual({ camera, attackTime: t, success, reducedMotion,
        pose: !success && (attack.missed || attack.blocked) ? 'idle' : undefined });
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
      const burst = clamp((t - .9) / .55);
      effects.update({ time: t, success, ultimate: attack.ultimate, blocked: attack.blocked, enemyCritical: attack.critical, missed: attack.missed,
        start, target, hero: hero.root.position, enemy: enemy.root.position,
        scale: modelScale, reducedMotion, camera });
      renderer.domElement.setAttribute('data-spell', String(effects.root.userData.spell));
      renderer.domElement.setAttribute('data-spell-kind', String(effects.root.userData.kind));
      renderer.domElement.setAttribute('data-spell-element', String(effects.root.userData.element));
      renderer.domElement.setAttribute('data-spell-phase', String(effects.root.userData.phase));
      renderer.domElement.setAttribute('data-enemy-critical', String(attack.critical));
      renderer.domElement.setAttribute('data-enemy-missed', String(attack.missed));
      if (success && t >= .9) {
        enemy.glow.emissive.setHex(heroSpellColors[effectTheme - 1]); enemy.glow.emissiveIntensity = (1 - burst) * .65;
      }
      if (t >= (attack.ultimate ? ULTIMATE_CAST_SECONDS : NORMAL_CAST_SECONDS)) { attack = null; enemy.root.scale.setScalar(modelScale); effects.clear(); emitPhase('待命'); resize(); }
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
    play(success: boolean, ultimate = false, blocked = false, spellChapter = theme, outcome: { critical?: boolean; missed?: boolean } = {}) {
      if (!alive) return;
      const nextTheme = clamp(spellChapter, 1, 6);
      if (nextTheme !== effectTheme) { scene.remove(effects.root); effects.dispose(); effectTheme = nextTheme; effects = createThemedSpellEffects(scene, effectTheme, mode, finalBoss); }
      attack = { started: performance.now(), success, ultimate: success && ultimate, blocked: !success && blocked,
        critical: !success && !!outcome.critical, missed: !success && !!outcome.missed }; dirty = true;
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
      effects.dispose(); disposeScene(scene); environment.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
