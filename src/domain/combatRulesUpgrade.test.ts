import { afterEach, describe, expect, it, vi } from 'vitest';
import { getQuestions } from '../content';
import {
  advanceSession, applySession, battleHealth, chooseAction, createProgress, currentQuestion, demonstrate,
  enemyBurnDamagePerTurn, expireQuestion, finishSession, remainingFrostGuardCharges,
  remainingLightningHintQuestions, remainingMirrorGuardCharges, restartBattle, retryQuestion,
  selectUltimate, startFinalBossSession, startSession, submitAction, tickQuestion,
} from './engine';
import { finalBossDamage, scoreSession } from './scoring';
import { exportBackup, parseBackup, validateProgress } from './storage';
import type { Mode, Progress, Session } from './types';

afterEach(() => vi.restoreAllMocks());

function unlocked(mode: Mode): Progress {
  const progress = createProgress();
  progress.ultimateCards = Array.from({ length: 6 }, (_, index) => ({ ultimateId: index + 1,
    unlockedAt: progress.updatedAt, sessionId: `earned-${mode}-${index + 1}`,
    questionId: getQuestions(index + 1 + (mode === 'advanced' ? 6 : 0))[3].id }));
  return progress;
}
function solve(session: Session, spell = 2): Session {
  const ready = session.energy === 3 && session.levelId > 12 ? selectUltimate(session, spell) : session;
  return submitAction(chooseAction(ready, Number(Object.keys(currentQuestion(ready).valid)[0])));
}
function wrong(session: Session): Session {
  const q = currentQuestion(session);
  return submitAction(chooseAction(session, q.choices.findIndex((_, index) => !q.valid[index]?.length)));
}
function reach(mode: Mode, index: number, spell = 2): Session {
  let session = startFinalBossSession(unlocked(mode), mode);
  while (session.index < index) session = advanceSession(solve(session, spell)).session!;
  return session;
}
function restore(session: Session): Session {
  return parseBackup(exportBackup(applySession(unlocked(session.mode), session))).active!;
}

describe('full castle blocks and twelve main-boss pursuits', () => {
  it.each(Array.from({ length: 12 }, (_, index) => index + 1))('adds exactly 10 HP from the second wrong answer in main mission %i', levelId => {
    let session = startSession(levelId, levelId > 6 ? 'advanced' : 'starter');
    for (let attack = 1; attack <= 5; attack++) {
      session = restore(wrong(session));
      expect(session).toMatchObject({ combatRulesVersion: 3, wrongStreak: attack, retries: attack,
        lastEnemyCritical: attack >= 2, lastEnemyDamage: attack === 1 ? 12 : 22,
        shield: Math.max(0, 100 - 12 - (attack - 1) * 22), step: attack === 5 ? 'defeat' : 'feedback' });
      expect(submitAction(session)).toBe(session);
      expect(expireQuestion(session)).toBe(session);
      expect(tickQuestion(session, 30_000)).toBe(session);
      session = retryQuestion(session);
    }
    expect(wrong(session)).toBe(session);
    expect(() => advanceSession(session)).toThrow('挑戰已結束');
  });

  it.each([7, 8, 9, 10, 11, 12])('timeout interrupts the consecutive-wrong sequence without triggering pursuit in mission %i', levelId => {
    const twice = wrong(retryQuestion(wrong(startSession(levelId, 'advanced'))));
    const expired = restore(tickQuestion(retryQuestion(twice), 30_000));
    expect(expired).toMatchObject({ shield: 54, wrongStreak: 0, lastEnemyDamage: 12, lastEnemyCritical: false, timedOut: true });
    expect(wrong(advanceSession(expired).session!)).toMatchObject({ shield: 42, wrongStreak: 1, lastEnemyDamage: 12 });
  });

  it.each(['starter', 'advanced'] as const)('blocks the complete 30-HP final combo with one/two %s castle charges and preserves retaliation damage', mode => {
    const castle = restore(solve(reach(mode, 3), 1));
    expect(castle.enemyBonusDamage).toBe(mode === 'advanced' ? 10 : 5);
    let next = advanceSession(castle).session!;
    next = { ...next, wrongStreak: 1, shield: 1 };
    const hits = mode === 'advanced' ? 2 : 1;
    for (let hit = 0; hit < hits; hit++) {
      const blocked = restore(wrong(next));
      expect(blocked).toMatchObject({ shield: 1, lastEnemyDamage: 0, lastEnemyCritical: true,
        preventedDamage: true, barrierCharges: hits - hit - 1, enemyBonusDamage: mode === 'advanced' ? 10 : 5 });
      next = retryQuestion(blocked);
    }
    expect(restore(wrong(next))).toMatchObject({ shield: 0, lastEnemyDamage: 1, preventedDamage: false, step: 'defeat' });
  });

  it('a correct answer or demonstration clears pursuit without altering the current question retry count', () => {
    const twice = wrong(retryQuestion(wrong(startSession(1, 'starter'))));
    const corrected = solve(retryQuestion(twice));
    expect(corrected).toMatchObject({ wrongStreak: 0, retries: 2, shield: 66 });
    expect(wrong(advanceSession(corrected).session!)).toMatchObject({ wrongStreak: 1, lastEnemyDamage: 12, shield: 54 });
    expect(demonstrate(retryQuestion(twice))).toMatchObject({ wrongStreak: 0, retries: 2, shield: 66 });
  });
});

describe('two-use advanced statuses', () => {
  it('rolls mirror exactly once for each of two attacks, persists each outcome, and preserves landed-hit guards on a miss', () => {
    const mirror = solve(reach('advanced', 3), 4);
    const guarded = { ...advanceSession(mirror).session!, frostGuard: true, frostGuardCharges: 2, barrier: true, barrierCharges: 2 };
    const roll = vi.spyOn(Math, 'random').mockReturnValueOnce(0.49999).mockReturnValueOnce(0.5);
    const first = restore(wrong(guarded));
    expect(first).toMatchObject({ shield: 100, mirrorGuardCharges: 1, mirrorGuard: true, lastEnemyMissed: true,
      frostGuardCharges: 2, barrierCharges: 2 });
    expect(roll).toHaveBeenCalledTimes(1);
    expect(submitAction(restore(first))).toBeTypeOf('object');
    expect(roll).toHaveBeenCalledTimes(1);
    const second = restore(wrong(retryQuestion(first)));
    expect(second).toMatchObject({ shield: 100, mirrorGuardCharges: 0, mirrorGuard: false, lastEnemyMissed: false,
      frostGuardCharges: 1, barrierCharges: 1, lastEnemyCritical: true });
    expect(roll).toHaveBeenCalledTimes(2);
    const third = restore(wrong(retryQuestion(second)));
    expect(third).toMatchObject({ shield: 100, frostGuardCharges: 0, barrierCharges: 0, lastEnemyDamage: 0 });
    expect(roll).toHaveBeenCalledTimes(2);
    expect(wrong(retryQuestion(third))).toMatchObject({ shield: 70, lastEnemyDamage: 30 });
  });

  it('ice halves two landed attacks while a missed attack consumes neither ice charge', () => {
    const ice = solve(reach('advanced', 3), 6);
    let next: Session = { ...advanceSession(ice).session!, mirrorGuard: true, mirrorGuardCharges: 1 };
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const missed = restore(wrong(next));
    expect(missed).toMatchObject({ shield: 100, frostGuardCharges: 2, lastEnemyMissed: true });
    next = retryQuestion(missed);
    const first = restore(wrong(next));
    expect(first).toMatchObject({ shield: 85, frostGuardCharges: 1, frostGuard: true, lastEnemyDamage: 15 });
    const second = restore(wrong(retryQuestion(first)));
    expect(second).toMatchObject({ shield: 70, frostGuardCharges: 0, frostGuard: false, lastEnemyDamage: 15 });
    expect(wrong(retryQuestion(second))).toMatchObject({ shield: 40, lastEnemyDamage: 30 });
  });

  it('an advanced timeout is a landed attack and spends one ice charge, but never pursuit damage', () => {
    const ice = solve(reach('advanced', 3), 6);
    const expired = restore(tickQuestion(advanceSession(ice).session!, 30_000));
    expect(expired).toMatchObject({ shield: 90, frostGuardCharges: 1, lastEnemyDamage: 10, lastEnemyCritical: false });
    expect(wrong(advanceSession(expired).session!)).toMatchObject({ shield: 80, frostGuardCharges: 0, lastEnemyDamage: 10 });
  });

  it('advanced lightning highlights two distinct following questions and never spends another charge on retry/reload', () => {
    const cast = restore(solve(reach('advanced', 3), 2));
    expect(remainingLightningHintQuestions(cast)).toBe(2);
    const first = restore(advanceSession(cast).session!);
    expect(remainingLightningHintQuestions(first)).toBe(1);
    const retried = restore(retryQuestion(restore(wrong(first))));
    expect(retried.lightningHintChoices).toEqual(first.lightningHintChoices);
    expect(remainingLightningHintQuestions(retried)).toBe(1);
    const second = restore(advanceSession(solve(retried)).session!);
    expect(second.index).toBe(first.index + 1);
    expect(second.lightningHintChoices).toHaveLength(2);
    expect(second.lightningHintChoices!.some(index => currentQuestion(second).valid[index]?.length)).toBe(true);
    expect(second).toMatchObject({ hintUsed: false, lightningHintQueued: false, lightningHintQuestions: 0 });
    const third = restore(advanceSession(solve(second)).session!);
    expect(third.lightningHintChoices).toEqual([]);
  });

  it('a skipped timed question spends exactly one highlighted question and retains the second', () => {
    const cast = solve(reach('advanced', 3), 2);
    const first = advanceSession(cast).session!;
    const expired = restore(tickQuestion(first, 30_000));
    expect(remainingLightningHintQuestions(expired)).toBe(1);
    const second = restore(advanceSession(expired).session!);
    expect(second.lightningHintChoices).toHaveLength(2);
    expect(remainingLightningHintQuestions(second)).toBe(0);
  });

  it('restarting a battle clears all counts and selecting a later different spell preserves unused counts', () => {
    const ice = solve(reach('advanced', 3), 6);
    let next = advanceSession(ice).session!;
    while (next.index < 7) next = advanceSession(solve(next)).session!;
    const later = restore(solve(next, 2));
    expect(later).toMatchObject({ frostGuardCharges: 2, lightningHintQuestions: 2, mirrorGuardCharges: 0 });
    const restarted = restartBattle(applySession(unlocked('advanced'), later)).active!;
    expect(restarted).toMatchObject({ frostGuardCharges: 0, mirrorGuardCharges: 0, lightningHintQuestions: 0,
      frostGuard: false, mirrorGuard: false, lightningHintQueued: false, lightningHintChoices: [] });
  });
});

describe('versioned upgrades preserve old saves and historical damage', () => {
  it.each([['frostGuard', 'frostGuardCharges', 6], ['mirrorGuard', 'mirrorGuardCharges', 4],
    ['lightningHintQueued', 'lightningHintQuestions', 2]] as const)('restores old %s as one remaining use without upgrading it to two', (enabled, counter, spell) => {
    const cast = solve(reach('advanced', 3), spell);
    const legacy = { ...cast, combatRulesVersion: 2 as const,
      records: cast.records.map(record => ({ ...record, combatRulesVersion: 2 as const })) };
    delete legacy[counter];
    expect(legacy[enabled]).toBe(true);
    const restored = restore(legacy);
    expect(restored[counter]).toBe(1);
    expect(restored.records).toEqual(legacy.records);
    expect(restored.shield).toBe(legacy.shield);
  });

  it('helpers retain the one-use interpretation of boolean-only effects without mutating the old session', () => {
    expect(remainingFrostGuardCharges({ frostGuard: true })).toBe(1);
    expect(remainingMirrorGuardCharges({ mirrorGuard: true })).toBe(1);
    expect(remainingLightningHintQuestions({ lightningHintQueued: true })).toBe(1);
    expect(remainingFrostGuardCharges({ frostGuard: false })).toBe(0);
    expect(remainingMirrorGuardCharges({ mirrorGuard: false })).toBe(0);
    expect(remainingLightningHintQuestions({ lightningHintQueued: false })).toBe(0);
  });

  it('keeps historical 4-HP advanced-final ticks untouched and records the following new turn as 6 HP once', () => {
    const cast = solve(reach('advanced', 3), 5);
    const newTick = solve(advanceSession(cast).session!);
    const historical = { ...newTick, combatRulesVersion: 2 as const, enemyBurnDamage: 4, lastTurnBurnDamage: 4,
      records: newTick.records.map(record => ({ ...record, combatRulesVersion: 2 as const })) };
    const old = restore(historical);
    expect(old).toMatchObject({ combatRulesVersion: 2, enemyBurnDamage: 4, lastTurnBurnDamage: 4 });
    expect(submitAction(old)).toBe(old);
    expect(scoreSession(old).rows.at(-1)?.record).toMatchObject({ combatRulesVersion: 2, turnBurnDamage: 4 });
    const next = advanceSession(old);
    expect(next.record).toMatchObject({ combatRulesVersion: 2, turnBurnDamage: 4 });
    const completed = restore(solve(next.session!));
    expect(completed).toMatchObject({ combatRulesVersion: 3, enemyBurnDamage: 10, lastTurnBurnDamage: 6 });
    expect(scoreSession(completed).rows.at(-1)?.record).toMatchObject({ combatRulesVersion: 3, turnBurnDamage: 6 });
    const damage = battleHealth(completed).enemyHp;
    expect(submitAction(completed)).toBe(completed);
    expect(battleHealth(restore(completed)).enemyHp).toBe(damage);
    const records = [...completed.records, advanceSession(completed).record];
    expect(records.at(-2)?.turnBurnDamage).toBe(4);
    expect(records.at(-1)?.turnBurnDamage).toBe(6);
    expect(finalBossDamage(records)).toBe(145);
  });

  it('preserves a completed historical advanced-final run and its score when a new-rule battle is saved beside it', () => {
    let session = startFinalBossSession(unlocked('advanced'), 'advanced');
    while (true) {
      const before = session;
      session = solve(session, 5);
      session = { ...session, combatRulesVersion: 2,
        enemyBurnDamage: (before.enemyBurnDamage ?? 0) + (before.enemyBurning ? 4 : 0),
        lastTurnBurnDamage: before.enemyBurning ? 4 : 0 };
      const next = advanceSession(session);
      if (next.finished) break;
      session = next.session!;
    }
    const historical = finishSession(unlocked('advanced'), session);
    const score = scoreSession(historical.runs![0]);
    expect(historical.runs![0].records.filter(record => record.turnBurnDamage).every(record => record.turnBurnDamage === 4)).toBe(true);
    expect(historical.runs![0].records.every(record => record.combatRulesVersion === 2)).toBe(true);
    const combined = applySession(historical, solve(startSession(7, 'advanced')));
    const restored = parseBackup(exportBackup(combined));
    expect(restored.runs).toEqual(historical.runs);
    expect(restored.attempts).toEqual(historical.attempts);
    expect(scoreSession(restored.runs![0])).toEqual(score);
    expect(restored.active?.combatRulesVersion).toBe(3);
  });

  it.each([1, 5, 6, 7, 11, 12, 13, 14])('selects 6 HP burning only for advanced final boss %i', levelId => {
    expect(enemyBurnDamagePerTurn({ levelId, mode: levelId > 6 && levelId !== 13 ? 'advanced' : 'starter' })).toBe(levelId === 14 ? 6 : 4);
  });

  it('keeps advanced main phoenix burning at 4 HP and retains 15 HP initial spell damage', () => {
    let session = startSession(11, 'advanced');
    while (session.index < 3) session = advanceSession(solve(session)).session!;
    const cast = restore(solve(session));
    expect(cast).toMatchObject({ enemyBurnDamage: 0, enemyBonusDamage: 15 });
    const fifth = restore(solve(advanceSession(cast).session!));
    expect(fifth).toMatchObject({ enemyBurnDamage: 4, lastTurnBurnDamage: 4 });
    const completed = finishSession(createProgress(), fifth);
    expect(parseBackup(exportBackup(completed))).toEqual(completed);
  });

  it.each([{ mirrorGuardCharges: 3 }, { frostGuardCharges: -1 }, { lightningHintQuestions: 2, lightningHintQueued: false },
    { mirrorGuardCharges: 1, mirrorGuard: false }, { frostGuardCharges: 0, frostGuard: true }])('rejects impossible status counts or flags %j', patch => {
    const session = startSession(7, 'advanced');
    expect(() => validateProgress(applySession(createProgress(), { ...session, ...patch }))).toThrow('備份格式');
  });

  it('rejects the upgraded burn amount on historical version 2 and on starter final boss', () => {
    for (const mode of ['starter', 'advanced'] as const) {
      const cast = solve(reach(mode, 3), 5);
      const tick = solve(advanceSession(cast).session!);
      const forged = { ...tick, combatRulesVersion: mode === 'advanced' ? 2 as const : 3 as const,
        enemyBurnDamage: 6, lastTurnBurnDamage: 6 };
      expect(() => validateProgress(applySession(unlocked(mode), forged))).toThrow('active.lastTurnBurnDamage');
    }
  });
});
