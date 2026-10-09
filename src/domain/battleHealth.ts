import { getLevel } from '../content/levels';
import type { CompletedRun, Session } from './types';

/** New battles use the current tier balance; ordinary guardians are unchanged. */
export function initialEnemyHp(levelId: number): number {
  const level = getLevel(levelId);
  return level.finalBoss ? level.mode === 'starter' ? 200 : 300 : 100;
}

/** Preserve the target of an existing run, including unversioned 300-HP saves. */
export function battleEnemyMaxHp(value: Pick<Session | CompletedRun, 'levelId' | 'enemyMaxHp'>): number {
  return getLevel(value.levelId).finalBoss ? value.enemyMaxHp ?? 300 : 100;
}
