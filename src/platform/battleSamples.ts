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
  /** Only remove a synthetic layer when this cue's decoded buffer is ready. */
  replaces: (voice: BattleSoundVoice) => boolean;
}

type BattlePlan = ReturnType<typeof buildBattleSound>;
const impactBody = (voice: BattleSoundVoice) => voice.phase === 'impact'
  && (voice.kind === 'triangle' || voice.kind === 'noise' && !voice.layer);

/** Contact samples begin at .9 s; launch sounds follow the projectile at .48 s. */
export function buildBattleSampleCues(plan: BattlePlan, reducedMotion = false): BattleSampleCue[] {
  const cues: BattleSampleCue[] = [], speed = reducedMotion ? 6 : 1;
  const sourcePan = plan.voices.find(voice => voice.phase === 'charge')?.pan ?? -.55;
  const targetPan = -sourcePan;
  const add = (id: BattleSampleId, at: number, duration: number, gain: number,
    pan: number, replaces: BattleSampleCue['replaces'], panTo?: number, offset = 0) => {
    const begins = at / speed;
    // The last fade finishes before the arena becomes ready for the next question.
    const length = Math.min(duration / speed, plan.duration - begins - .015);
    if (length > .01) cues.push({ id, at: begins, duration: length, offset,
      gain: gain * (reducedMotion ? .8 : 1), pan, panTo, replaces });
  };
  const launch = (voice: BattleSoundVoice) => voice.phase === 'launch';
  const hasDamage = plan.voices.some(voice => voice.phase === 'impact' && voice.kind === 'triangle');

  if (plan.voices.some(voice => voice.creature === 'phoenix'))
    add('phoenix-call', .08, .77, .46, sourcePan, voice => voice.creature === 'phoenix', targetPan * .35);
  if (plan.voices.some(voice => voice.creature === 'dragon'))
    add('ice-dragon-roar', .055, .8, .48, sourcePan, voice => voice.creature === 'dragon', targetPan * .35);

  if (plan.profile === 'fire') {
    add('fire-feather', .48, .4, .36, sourcePan, launch, targetPan);
    if (hasDamage) add('explosion', .9, .78, plan.enhanced ? .52 : .38, targetPan,
      voice => impactBody(voice) || voice.layer === 'explosion' || voice.layer === 'fire-crackle');
  }
  if (plan.profile === 'ice' || plan.profile === 'spectral-dragon') {
    add('frost-arrow', .48, .44, .39, sourcePan, launch, targetPan);
    if (plan.enhanced && hasDamage) add('explosion', .9, .78, .38, targetPan,
      voice => impactBody(voice) || voice.layer === 'ice-explosion');
  }
  if (['castle-seal', 'box-chain', 'confusing-stamp', 'disorder-gears', 'storm-fist'].includes(plan.profile)
    && hasDamage) {
    add('heavy-impact', .9, .56, plan.enhanced ? .46 : .40, targetPan,
      voice => impactBody(voice) || voice.layer === 'seal-slam');
  }
  return cues;
}
