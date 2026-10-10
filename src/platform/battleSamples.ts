import type { BattleSoundVoice, buildBattleSound } from './battleSoundDesign';

/** Short, locally bundled excerpts supplied for the visible combat materials. */
export const battleSampleAssets = {
  'frost-arrow': '/sfx/frost-arrow.mp3',
  'heavy-impact': '/sfx/heavy-impact.mp3',
  'fire-feather': '/sfx/fire-feather.mp3',
  explosion: '/sfx/explosion.mp3',
  'phoenix-call': '/sfx/phoenix-call.mp3',
  'ice-dragon-roar': '/sfx/ice-dragon-roar.mp3',
} as const;

export type BattleSampleId = keyof typeof battleSampleAssets;
export interface BattleSampleCue {
  id: BattleSampleId;
  at: number;
  duration: number;
  offset: number;
  gain: number;
  pan: number;
  panTo?: number;
  /** Shape the same physical impact into wood, metal, glass or a pressure hit. */
  filter?: { type: BiquadFilterType; from: number; to: number; resonance?: number };
  /** Only remove a synthetic layer when this cue's decoded buffer is ready. */
  replaces: (voice: BattleSoundVoice) => boolean;
}

type BattlePlan = ReturnType<typeof buildBattleSound>;
const impactBody = (voice: BattleSoundVoice) => voice.phase === 'impact'
  && (voice.layer === 'impact-body' || voice.layer === 'impact-air'
    || !voice.layer && (voice.kind === 'triangle' || voice.kind === 'noise'));

/** Contact samples begin at .9 s; launch sounds follow the projectile at .48 s. */
export function buildBattleSampleCues(plan: BattlePlan, reducedMotion = false): BattleSampleCue[] {
  const cues: BattleSampleCue[] = [], speed = reducedMotion ? 6 : 1;
  const sourcePan = plan.voices.find(voice => voice.phase === 'charge')?.pan ?? -.55;
  const targetPan = -sourcePan;
  const add = (id: BattleSampleId, at: number, duration: number, gain: number,
    pan: number, replaces: BattleSampleCue['replaces'], panTo?: number, offset = 0, filter?: BattleSampleCue['filter']) => {
    const begins = at / speed;
    // The last fade finishes before the arena becomes ready for the next question.
    const length = Math.min(duration / speed, plan.duration - begins - .015);
    if (length > .01) cues.push({ id, at: begins, duration: length, offset,
      gain: gain * (reducedMotion ? .8 : 1), pan, panTo, replaces, ...(filter ? { filter } : {}) });
  };
  const launch = (voice: BattleSoundVoice) => voice.phase === 'launch';
  const hasDamage = plan.voices.some(voice => voice.phase === 'impact' && voice.kind === 'triangle');

  if (plan.voices.some(voice => voice.creature === 'phoenix'))
    add('phoenix-call', .08, .77, .46, sourcePan, voice => voice.creature === 'phoenix', targetPan * .35);
  if (plan.voices.some(voice => voice.creature === 'dragon'))
    add('ice-dragon-roar', .055, .8, .48, sourcePan, voice => voice.creature === 'dragon', targetPan * .35);

  // Short, filtered body layers support every physical hit. Identity remains in
  // the material snap/decay above this layer, including when assets are offline.
  // Hero summons keep their established samples and original mix below.
  const materialAttack = plan.voices.some(voice => voice.layer === 'impact-body');
  const bodies: Record<string, { from: number; to: number; duration: number; gain: number; type: BiquadFilterType }> = {
    'castle-seal': { from: 1800, to: 800, duration: .46, gain: .38, type: 'lowpass' },
    'book-lightning': { from: 1650, to: 580, duration: .30, gain: .30, type: 'lowpass' },
    'forest-puzzle': { from: 650, to: 320, duration: .25, gain: .32, type: 'bandpass' },
    mirror: { from: 1550, to: 850, duration: .20, gain: .28, type: 'bandpass' },
    ice: { from: 1800, to: 850, duration: .29, gain: .32, type: 'bandpass' },
    'box-chain': { from: 1550, to: 650, duration: .35, gain: .35, type: 'bandpass' },
    'deceptive-pages': { from: 1300, to: 580, duration: .21, gain: .31, type: 'bandpass' },
    'confusing-stamp': { from: 900, to: 450, duration: .30, gain: .36, type: 'lowpass' },
    'mask-shards': { from: 1350, to: 740, duration: .25, gain: .31, type: 'bandpass' },
    'paper-wing': { from: 1050, to: 500, duration: .22, gain: .31, type: 'bandpass' },
    'disorder-gears': { from: 1900, to: 800, duration: .32, gain: .34, type: 'bandpass' },
    'spider-web': { from: 900, to: 470, duration: .23, gain: .31, type: 'bandpass' },
    'hourglass-sand': { from: 1250, to: 510, duration: .31, gain: .32, type: 'lowpass' },
    'vine-whip': { from: 750, to: 390, duration: .21, gain: .34, type: 'bandpass' },
    'mimic-shadow': { from: 970, to: 420, duration: .23, gain: .31, type: 'bandpass' },
    'ink-burst': { from: 930, to: 350, duration: .25, gain: .34, type: 'lowpass' },
    'storm-fist': { from: 1600, to: 480, duration: .40, gain: .33, type: 'lowpass' },
    'chaos-grimoire': { from: 1150, to: 410, duration: .42, gain: .35, type: 'lowpass' },
    'spectral-dragon': { from: 1600, to: 520, duration: .38, gain: .34, type: 'lowpass' },
  };
  const body = bodies[plan.profile];
  if (materialAttack && body && !(plan.profile === 'spectral-dragon' && plan.enhanced)) {
    add('heavy-impact', .9, body.duration, body.gain * (plan.enhanced ? 1.08 : 1), targetPan, impactBody,
      undefined, 0, { type: body.type, from: body.from, to: body.to, resonance: .7 });
  }

  if (plan.profile === 'fire') {
    add('fire-feather', .48, .4, .36, sourcePan, launch, targetPan);
    if (hasDamage) add('explosion', .9, .78, plan.enhanced ? .52 : .38, targetPan,
      voice => impactBody(voice) || voice.layer === 'explosion' || voice.layer === 'fire-crackle');
  }
  if (plan.profile === 'ice' || plan.profile === 'spectral-dragon') {
    // Short casts finish their flight before contact, leaving headroom for the
    // new physical ice impact. Preserve the established hero summon excerpt.
    add('frost-arrow', .48, plan.profile === 'ice' && plan.enhanced ? .44 : .4, .39, sourcePan, launch, targetPan);
    if (plan.enhanced && hasDamage) add('explosion', .9, .78, .38, targetPan,
      voice => impactBody(voice) || voice.layer === 'ice-explosion');
  }
  if (!materialAttack && ['castle-seal', 'box-chain', 'confusing-stamp', 'disorder-gears', 'storm-fist'].includes(plan.profile)
    && hasDamage) {
    add('heavy-impact', .9, .56, plan.enhanced ? .46 : .40, targetPan,
      voice => impactBody(voice) || voice.layer === 'seal-slam');
  }
  return cues;
}
