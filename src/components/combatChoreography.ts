import type { Mode } from '../domain/types';
import { enemySpellNames, NORMAL_CAST_SECONDS, SPELL_IMPACT_SECONDS } from './themedSpellEffects';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };

/** A visible contact hold, without freezing the audio, question or HP clock. */
export function contactReaction(time: number, reducedMotion = false, missed = false): number {
  if (reducedMotion || missed || !Number.isFinite(time) || time < SPELL_IMPACT_SECONDS || time >= NORMAL_CAST_SECONDS) return 0;
  const age = time - SPELL_IMPACT_SECONDS;
  if (age < .055) return smooth(age / .055);
  if (age < .13) return 1;
  return 1 - smooth((age - .13) / .34);
}

export interface ContactImpactOptions {
  reducedMotion?: boolean;
  missed?: boolean;
  blocked?: boolean;
  damage?: number;
  enhanced?: boolean;
  target?: 'hero' | 'enemy';
}

/** A contact-only camera kick. Values are pixels, independent of device pixel ratio. */
export function contactImpactMotion(time: number, options: ContactImpactOptions = {}) {
  const still = { active: false, x: 0, y: 0, scale: 1, recoil: 0, tremor: 0 };
  const prevented = options.missed || (options.damage === undefined ? options.blocked : options.damage <= 0);
  const age = time - SPELL_IMPACT_SECONDS;
  if (options.reducedMotion || prevented || !Number.isFinite(time) || age < 0 || age >= .47) return still;
  const recoil = contactReaction(time);
  // Hold the struck pose for 75 ms, then settle back; the game/audio clock keeps running.
  // The camera settles earlier than the actor and never accumulates an offset.
  const envelope = age < .36 ? (1 - age / .36) ** 2 : 0;
  const direction = options.target === 'hero' ? -1 : 1;
  const amplitude = options.enhanced ? 12 : 8;
  const wave = .72 * Math.cos(age * Math.PI * 2 * 27) + .28 * Math.cos(age * Math.PI * 2 * 43);
  return { active: envelope > 0, x: direction * amplitude * wave * envelope,
    y: amplitude * .48 * Math.sin(age * Math.PI * 2 * 33) * envelope,
    scale: 1 + .028 * envelope, recoil,
    tremor: Math.sin(age * Math.PI * 2 * 29) * envelope };
}

/** In-place anticipation and a small forward commitment fit the existing envelope. */
export function enemyCastMotion(time: number, reducedMotion = false) {
  if (reducedMotion || !Number.isFinite(time) || time < 0 || time >= NORMAL_CAST_SECONDS) return { anticipation: 0, release: 0 };
  const anticipation = smooth(time / .34) * (1 - smooth((time - .38) / .16));
  const release = smooth((time - .40) / .12) * (1 - smooth((time - .90) / .32));
  return { anticipation, release };
}

export function enemyAttackName(mode: Mode, chapter: number, finalBoss = false, critical = false): string {
  if (finalBoss) return critical
    ? mode === 'starter' ? '混沌魔典追擊' : '九首幻焰追擊'
    : mode === 'starter' ? '混沌魔典衝擊' : '九龍幻焰衝擊';
  const index = Math.max(0, Math.min(5, Math.trunc(Number.isFinite(chapter) ? chapter : 1) - 1));
  return enemySpellNames[mode][index] + (critical ? '追擊' : '');
}

/** A prevented pursuit is announced as a defense outcome, never a body hit. */
export function enemyPursuitPhase(time: number, blocked = false, missed = false): string {
  if (time >= SPELL_IMPACT_SECONDS && missed) return '鏡像閃避 · 魔王落空';
  if (time >= SPELL_IMPACT_SECONDS && time < 1.75 && blocked) return '守護盾攔截';
  return time < .42 ? '魔王追擊必殺蓄勢' : time < SPELL_IMPACT_SECONDS ? '魔王追擊必殺飛襲'
    : time < 1.75 ? '魔王追擊必殺命中' : '魔王追擊收勢';
}
