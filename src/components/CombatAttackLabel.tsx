import { Sparkles, Swords } from 'lucide-react';
import type { Mode } from '../domain/types';
import { getUltimateSpell } from '../content/ultimateSpells';
import { normalSpellNames } from './themedSpellEffects';
import { enemyAttackName } from './combatChoreography';

export function CombatAttackLabel({ success, ultimate, critical, finalBoss, mode, chapter }: {
  success: boolean; ultimate: boolean; critical: boolean; finalBoss: boolean; mode: Mode; chapter: number;
}) {
  // Advanced hero summons already carry their own cinematic title.
  if (success && ultimate && mode === 'advanced') return null;
  const name = success ? ultimate ? getUltimateSpell(chapter, mode)?.name : normalSpellNames[chapter - 1]
    : enemyAttackName(mode, chapter, finalBoss, critical);
  return <div className={'duel-attack-name' + ((success && ultimate || !success && critical) ? ' is-ultimate' : '') + (!success ? ' is-enemy' : '')}>
    {success ? <Sparkles size={18} /> : <Swords size={18} />}
    <span className="duel-attack-skill">{!success && <small>魔王出招 · </small>}{name}</span>
    {success && ultimate && <span className="duel-attack-reward">· 獎勵＋10分</span>}
  </div>;
}
