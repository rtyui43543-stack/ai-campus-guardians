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
  return enemySpellNames[mode][index];
}
