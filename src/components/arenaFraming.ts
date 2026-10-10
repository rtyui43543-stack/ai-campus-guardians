import * as THREE from 'three';
import type { HeroSpriteState } from './coverHeroSprite';

export interface ActorFramingBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

type FramedActor = { root: THREE.Group; updateVisual?: (state: HeroSpriteState) => void };
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Measure the rendered atlas planes, including every attack pose's cape/tail. */
export function measureActorFraming(actor: FramedActor, camera: THREE.Camera): ActorFramingBounds {
  const inverseView = camera.getWorldQuaternion(new THREE.Quaternion()).invert();
  const origin = actor.root.getWorldPosition(new THREE.Vector3());
  const bounds = new THREE.Box3();
  const sprite = actor.root.getObjectByName('cover-identity-hero-atlas') as THREE.Mesh | undefined;
  if (sprite && actor.updateVisual) {
    for (const pose of ['idle', 'windup', 'release', 'hurt'] as const) {
      actor.updateVisual({ camera, reducedMotion: true, pose });
      actor.root.updateMatrixWorld(true);
      const positions = sprite.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(positions, i)
          .applyMatrix4(sprite.matrixWorld).sub(origin).applyQuaternion(inverseView));
      }
    }
    actor.updateVisual({ camera, reducedMotion: true, pose: 'idle' });
  } else {
    const world = new THREE.Box3().setFromObject(actor.root);
    for (const x of [world.min.x, world.max.x]) for (const y of [world.min.y, world.max.y])
      for (const z of [world.min.z, world.max.z]) {
        bounds.expandByPoint(new THREE.Vector3(x, y, z).sub(origin).applyQuaternion(inverseView));
      }
    // Articulated opponents raise an arm during their cast and greeting.
    bounds.expandByScalar(.22);
  }
  return { minX: bounds.min.x, maxX: bounds.max.x, minY: bounds.min.y, maxY: bounds.max.y };
}

export interface BattleFrameLayout {
  width: number;
  height: number;
  questionBottom: number;
  answersTop: number;
  resolving: boolean;
}

/** Hidden feedback still has layout: preserve the last visible question's slot. */
export function createBattleFrameTracker() {
  let previous: BattleFrameLayout | undefined;
  return (layout: BattleFrameLayout): BattleFrameLayout => {
    if (!previous || !layout.resolving) previous = { ...layout };
    else if (layout.width !== previous.width || layout.height !== previous.height) {
      // An orientation change must fit the new viewport without measuring hidden
      // feedback text or the post-cast explanation buttons as a new question.
      previous = { ...layout,
        questionBottom: previous.questionBottom / previous.height * layout.height,
        answersTop: previous.answersTop / previous.height * layout.height };
    }
    return previous;
  };
}

export function fitBattleActors(layout: BattleFrameLayout, hero: ActorFramingBounds, enemy: ActorFramingBounds,
  explanationReserve = 52) {
  const { width, height } = layout;
  const viewHeight = 8.8, viewWidth = viewHeight * width / height;
  const portrait = width / height < .85, elevation = portrait ? 3.9 : 4.7;
  const heroX = -Math.min(3.35, viewWidth * .235), enemyX = -heroX;
  const edge = (width <= 600 ? 14 : 24) / width * viewWidth;
  const top = Math.max(height * .27, layout.questionBottom + 12);
  // The explanation actions appear after a cast; their space is reserved before
  // casting so they neither cover the boots nor resize either actor afterwards.
  const bottom = Math.min(height * .76, layout.answersTop - 10) - explanationReserve;
  const actorTop = Math.max(hero.maxY, enemy.maxY * 1.09) + .18;
  const actorBottom = Math.min(hero.minY, enemy.minY * 1.09, -.16);
  let scale = Math.min(portrait ? .8 : 1,
    Math.max(1, bottom - top) / height * viewHeight / (actorTop - actorBottom));
  // Include the actual hurt/dodge step, boss recoil and critical enlargement.
  // Height alone cannot protect a pointed hat or a wide cloud giant on phones.
  scale = Math.min(scale,
    (viewWidth / 2 + heroX - edge) / (-hero.minX + .30),
    (viewWidth / 2 - heroX - edge - .20) / hero.maxX,
    (viewWidth / 2 + enemyX - edge) / (-enemy.minX * 1.09),
    (viewWidth / 2 - enemyX - edge) / (enemy.maxX * 1.09 + .48));
  scale = Math.max(.01, scale);
  const cosPitch = 15 / Math.hypot(15, elevation);
  const lookY = ((bottom / height - .5) * viewHeight + actorBottom * scale) / cosPitch;
  return { viewWidth, viewHeight, heroX, enemyX, scale, lookY, elevation, top, bottom };
}

/** Fit both full silhouettes throughout wide shots, greetings and close-up pans. */
export function fitStoryActors(viewWidth: number, viewHeight: number,
  requested: { x: number; y: number; zoom: number },
  actors: { heroX: number; enemyX: number; hero: ActorFramingBounds; enemy: ActorFramingBounds },
  elevation: number) {
  // Keep one envelope across shots; the entrance walks .65 world units left.
  const minX = Math.min(actors.heroX + actors.hero.minX - .65, actors.enemyX + actors.enemy.minX);
  const maxX = Math.max(actors.heroX + actors.hero.maxX, actors.enemyX + actors.enemy.maxX);
  const minY = Math.min(actors.hero.minY, actors.enemy.minY) - .04;
  const maxY = Math.max(actors.hero.maxY, actors.enemy.maxY) + .04;
  const usable = .88;
  const zoom = Math.min(requested.zoom, viewWidth * usable / (maxX - minX), viewHeight * usable / (maxY - minY));
  const halfWidth = viewWidth / (2 * zoom), halfHeight = viewHeight / (2 * zoom);
  const padX = halfWidth * (1 - usable), padY = halfHeight * (1 - usable);
  const cosPitch = 15 / Math.hypot(15, elevation);
  return {
    x: clamp(requested.x, maxX - halfWidth + padX, minX + halfWidth - padX),
    y: clamp(requested.y * cosPitch, maxY - halfHeight + padY, minY + halfHeight - padY) / cosPitch,
    zoom,
  };
}
