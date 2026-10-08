import { afterEach, describe, expect, it, vi } from 'vitest';
import { getQuestions, getQuestionsForHistory } from '../content';
import {
  advanceSession, applySession, battleHealth, chooseAction, createProgress, currentQuestion,
  demonstrate, finishSession, restartBattle, retryQuestion, selectUltimate, startFinalBossSession,
  startSession, submitAction, tickQuestion,
} from './engine';
import { finalBossDamage, reconstructRuns, scoreSession } from './scoring';
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
function solve(session: Session, id = 2): Session {
  const ready = session.energy === 3 && session.levelId > 12 ? selectUltimate(session, id) : session;
  return submitAction(chooseAction(ready, Number(Object.keys(currentQuestion(ready).valid)[0])));
}
function wrong(session: Session): Session {
  const q = currentQuestion(session);
  return submitAction(chooseAction(session, q.choices.findIndex((_, index) => !q.valid[index]?.length)));
}
function reach(mode: Mode, index: number, id = 2): Session {
  let session = startFinalBossSession(unlocked(mode), mode);
  while (session.index < index) session = advanceSession(solve(session, id)).session!;
  return session;
}
function saved(session: Session): Session {
  const progress = applySession(unlocked(session.mode), session);
  const restored = parseBackup(exportBackup(progress));
  expect(restored.active).toEqual(session);
  return restored.active!;
}

describe('final-boss attacks and consecutive mistakes', () => {
  it.each(['starter', 'advanced'] as const)('uses 20 then 30 HP for repeated %s mistakes and resets on a correct answer', mode => {
    let session = startFinalBossSession(unlocked(mode), mode);
    session = saved(wrong(session));
    expect(session).toMatchObject({ shield: 80, wrongStreak: 1, lastEnemyDamage: 20, lastEnemyCritical: false });
    session = saved(wrong(retryQuestion(session)));
    expect(session).toMatchObject({ shield: 50, wrongStreak: 2, lastEnemyDamage: 30, lastEnemyCritical: true });
    session = saved(wrong(retryQuestion(session)));
    expect(session).toMatchObject({ shield: 20, wrongStreak: 3, lastEnemyDamage: 30 });
    const correct = solve(retryQuestion(session));
    expect(correct.wrongStreak).toBe(0);
    const next = wrong(advanceSession(correct).session!);
    expect(next).toMatchObject({ shield: 0, wrongStreak: 1, lastEnemyDamage: 20, lastEnemyCritical: false, step: 'defeat' });
  });

  it('keeps ordinary attacks at 12 HP regardless of the mistake streak', () => {
    let session = startSession(1, 'starter');
    for (let count = 1; count <= 3; count++) {
      session = wrong(session);
      expect(session).toMatchObject({ shield: 100 - 12 * count, lastEnemyDamage: 12, lastEnemyCritical: false });
      session = retryQuestion(session);
    }
  });

  it('timeout uses only the 20 HP basic attack and interrupts the streak; demonstration also interrupts it', () => {
    let session = wrong(startFinalBossSession(unlocked('advanced'), 'advanced'));
    session = wrong(retryQuestion(session));
    expect(session.shield).toBe(50);
    const expired = saved(tickQuestion(retryQuestion(session), 30_000));
    expect(expired).toMatchObject({ shield: 30, wrongStreak: 0, lastEnemyDamage: 20, lastEnemyCritical: false });
    const next = wrong(advanceSession(expired).session!);
    expect(next).toMatchObject({ shield: 10, wrongStreak: 1, lastEnemyDamage: 20 });
    const demo = demonstrate(retryQuestion(next));
    expect(demo.wrongStreak).toBe(0);
  });
});

describe('elemental and support ultimate effects', () => {
  it.each(['starter', 'advanced'] as const)('fire burns once on each later completed %s question, never on a retry or the cast turn', mode => {
    const cast = saved(solve(reach(mode, 3), 5));
    expect(cast).toMatchObject({ enemyBurning: true, enemyBurnDamage: 0, lastTurnBurnDamage: 0 });
    let next = advanceSession(cast).session!;
    const initialHp = battleHealth(next).enemyHp;
    const mistake = saved(wrong(next));
    expect(mistake.enemyBurnDamage).toBe(0);
    expect(battleHealth(mistake).enemyHp).toBe(initialHp);
    next = saved(solve(retryQuestion(mistake)));
    expect(next).toMatchObject({ enemyBurnDamage: 4, lastTurnBurnDamage: 4 });
    expect(submitAction(next)).toBe(next);
    expect(demonstrate(next)).toBe(next);
    const advanced = advanceSession(next);
    expect(advanced.record).toMatchObject({ turnBurnDamage: 4, combatRulesVersion: 2 });
    const demo = saved(demonstrate(advanced.session!));
    expect(demo).toMatchObject({ enemyBurnDamage: 8, lastTurnBurnDamage: 4 });
    const nextAgain = advanceSession(demo).session!;
    if (mode === 'advanced') expect(saved(tickQuestion(nextAgain, 30_000))).toMatchObject({ enemyBurnDamage: 12, lastTurnBurnDamage: 4 });
    else expect(saved(solve(nextAgain))).toMatchObject({ enemyBurnDamage: 12, lastTurnBurnDamage: 4 });
  });

  it('recasting fire does not stack its per-question damage and burning can finish a boss early', () => {
    const progress = unlocked('starter');
    let session = startFinalBossSession(progress, 'starter');
    while (true) {
      session = saved(solve(session, 5));
      expect(session.lastTurnBurnDamage).toBe(session.index > 3 ? 4 : 0);
      const next = advanceSession(session);
      if (next.finished) break;
      session = next.session!;
    }
    expect(session.index).toBe(11);
    expect(session.enemyBurnDamage).toBe(32);
    const finished = finishSession(progress, session);
    expect(finished.runs![0]).toMatchObject({ passed: true });
    expect(finalBossDamage(finished.runs![0].records)).toBe(302);
    expect(scoreSession(finished.runs![0])).toMatchObject({ score: 100, perfect: true, questionCount: 12 });
    expect(parseBackup(exportBackup(finished))).toEqual(finished);
    expect(reconstructRuns(finished.attempts)[0].records).toHaveLength(12);
  });

  it.each(['starter', 'advanced'] as const)('lightning marks exactly two next-question choices including an answer in %s without a hint penalty', mode => {
    const cast = solve(reach(mode, 3), 2);
    expect(cast.lightningHintChoices).toEqual([]);
    const next = saved(advanceSession(cast).session!);
    expect(next.lightningHintChoices).toHaveLength(2);
    const q = currentQuestion(next);
    expect(next.lightningHintChoices!.filter(index => q.valid[index]?.length)).toHaveLength(1);
    expect(next.hintUsed).toBe(false);
    const retried = retryQuestion(saved(wrong(next)));
    expect(retried.lightningHintChoices).toEqual(next.lightningHintChoices);
    const correct = solve(retried);
    const record = advanceSession(correct).record;
    expect(record.hintUsed).toBe(false);
    expect(advanceSession(correct).session!.lightningHintChoices).toEqual([]);
  });

  it.each(['starter', 'advanced'] as const)('ice halves only the next attack that hits in %s', mode => {
    const cast = saved(solve(reach(mode, 3), 6));
    expect(cast.frostGuard).toBe(true);
    const next = advanceSession(cast).session!;
    const hit = saved(wrong(next));
    expect(hit).toMatchObject({ shield: 90, frostGuard: false, lastEnemyDamage: 10 });
    const critical = wrong(retryQuestion(hit));
    expect(critical).toMatchObject({ shield: 60, lastEnemyDamage: 30 });
  });

  it('halves a 30 HP combo to 15 and applies the castle flat 12 HP reduction afterwards', () => {
    const combo = wrong({ ...reach('starter', 4), wrongStreak: 1, frostGuard: true });
    expect(combo).toMatchObject({ shield: 85, lastEnemyDamage: 15 });
    const combined = wrong({ ...reach('starter', 4), wrongStreak: 1, frostGuard: true, barrier: true, barrierCharges: 1 });
    expect(combined).toMatchObject({ shield: 97, lastEnemyDamage: 3, barrierCharges: 0, frostGuard: false });
    const castleOnly = wrong({ ...reach('starter', 4), barrier: true, barrierCharges: 1 });
    expect(castleOnly).toMatchObject({ shield: 92, lastEnemyDamage: 8 });
  });

  it('mirror misses at 50%, consumes its chance, preserves ice/castle, and does not redraw after restoration', () => {
    const roll = vi.spyOn(Math, 'random').mockReturnValue(0.4999);
    const cast = solve(reach('starter', 3), 4);
    const next = { ...advanceSession(cast).session!, frostGuard: true, barrier: true, barrierCharges: 1 };
    const missed = saved(wrong(next));
    expect(missed).toMatchObject({ shield: 100, lastEnemyDamage: 0, lastEnemyMissed: true, mirrorGuard: false, frostGuard: true, barrierCharges: 1 });
    expect(roll).toHaveBeenCalledTimes(1);
    const restored = saved(missed);
    expect(submitAction(restored)).toBe(restored);
    expect(roll).toHaveBeenCalledTimes(1);
    const hit = wrong(retryQuestion(restored));
    expect(hit).toMatchObject({ shield: 97, lastEnemyDamage: 3, lastEnemyMissed: false, frostGuard: false, barrierCharges: 0 });
    expect(roll).toHaveBeenCalledTimes(1);
  });

  it('the upper half of mirror chances hits normally and consumes the mirror', () => {
    const cast = solve(reach('advanced', 3), 4);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const hit = saved(wrong(advanceSession(cast).session!));
    expect(hit).toMatchObject({ shield: 80, lastEnemyDamage: 20, lastEnemyMissed: false, mirrorGuard: false });
  });

  it.each(['starter', 'advanced'] as const)('recovery heals immediately, then 4 HP per later completed %s question, capped at 100', mode => {
    const cast = saved(solve({ ...reach(mode, 3), shield: 50 }, 3));
    expect(cast).toMatchObject({ shield: mode === 'advanced' ? 74 : 62, playerRegeneration: true, lastTurnHealing: 0 });
    let next = advanceSession(cast).session!;
    const mistake = wrong(next);
    expect(mistake.lastTurnHealing).toBe(0);
    next = saved(solve(retryQuestion(mistake)));
    expect(next.lastTurnHealing).toBe(4);
    expect(next.shield).toBe(mode === 'advanced' ? 58 : 46);
    const capped = solve({ ...advanceSession(next).session!, shield: 99 });
    expect(capped).toMatchObject({ shield: 100, lastTurnHealing: 1 });
    const demo = saved(demonstrate(advanceSession(capped).session!));
    expect(demo).toMatchObject({ shield: 100, lastTurnHealing: 0 });
  });

  it('regeneration and burn cannot revive a defeated player or tick after lethal timeout', () => {
    const cast = solve(reach('advanced', 3), 3);
    const next = { ...advanceSession(cast).session!, shield: 10 };
    const defeated = saved(tickQuestion(next, 30_000));
    expect(defeated).toMatchObject({ shield: 0, step: 'defeat', lastTurnHealing: 0 });
    const burned = solve(reach('advanced', 3), 5);
    const burnedDefeat = saved(tickQuestion({ ...advanceSession(burned).session!, shield: 10 }, 30_000));
    expect(burnedDefeat).toMatchObject({ shield: 0, enemyBurnDamage: 0, lastTurnBurnDamage: 0 });
  });

  it.each(['starter', 'advanced'] as const)('continues fire and regeneration together across saves and later %s ultimate choices', mode => {
    const progress = unlocked(mode);
    let session = startFinalBossSession(progress, mode);
    for (let index = 0; index < 15; index++) {
      if (index === 4) session = retryQuestion(saved(wrong(session)));
      session = saved(solve(session, index === 3 ? 5 : index === 7 ? 3 : 6));
      if (index === 7) expect(session).toMatchObject({ enemyBurning: true, playerRegeneration: true, lastTurnBurnDamage: 4, lastTurnHealing: 0 });
      if (index > 7) expect(session.lastTurnBurnDamage).toBe(4);
      const next = advanceSession(session);
      if (next.finished) break;
      session = saved(next.session!);
    }
    expect(battleHealth(session).enemyHp).toBe(0);
    const finished = finishSession(progress, session);
    expect(finished.runs![0].passed).toBe(true);
    expect(parseBackup(exportBackup(finished))).toEqual(finished);
  });

  it('resets every status on a restarted or different battle', () => {
    const cast = solve(reach('starter', 3), 5);
    const active = advanceSession(cast).session!;
    const restarted = restartBattle(applySession(unlocked('starter'), active)).active!;
    expect(restarted).toMatchObject({ wrongStreak: 0, enemyBurning: false, enemyBurnDamage: 0, playerRegeneration: false,
      frostGuard: false, mirrorGuard: false, lightningHintQueued: false, lightningHintChoices: [] });
    expect(startSession(1, 'starter')).toMatchObject({ enemyBurning: false, playerRegeneration: false, frostGuard: false, mirrorGuard: false });
  });
});

describe('versioned effects and historical final questions', () => {
  it('resumes a wholly legacy final sequence and retains old completed histories without retroactive burns', () => {
    const legacy = getQuestionsForHistory(13, false, 'V2L13Q01');
    expect(legacy[0].id.startsWith('V2L13')).toBe(true);
    let session = startFinalBossSession(unlocked('starter'), 'starter');
    session.questionIds = legacy.map(q => q.id);
    delete session.combatRulesVersion;
    let current = saved(session);
    expect(current.questionIds).toEqual(session.questionIds);
    for (let index = 0; index < 3; index++) current = advanceSession(solve(current)).session!;
    const cast = solve(current, 5);
    const oldCast = { ...cast };
    delete oldCast.combatRulesVersion;
    delete oldCast.enemyBurning;
    delete oldCast.enemyBurnDamage;
    delete oldCast.resolvedTurnIndex;
    oldCast.records = oldCast.records.map(record => {
      const copy = { ...record }; delete copy.combatRulesVersion; delete copy.turnBurnDamage; delete copy.turnHealing; return copy;
    });
    const resumed = advanceSession(saved(oldCast)).session!;
    expect(solve(resumed).lastTurnBurnDamage).toBe(0);
    let completed = resumed;
    while (true) {
      completed = solve(completed);
      const next = advanceSession(completed);
      if (next.finished) break;
      completed = next.session!;
    }
    const history = finishSession(unlocked('starter'), completed);
    expect(parseBackup(exportBackup(history))).toEqual(history);
    expect(reconstructRuns(history.attempts)[0].records[0].questionId).toBe('V2L13Q01');
    expect(startFinalBossSession(unlocked('starter'), 'starter').questionIds[0]).not.toBe(legacy[0].id);
  });

  it('rejects forged burn amounts and invalid lightning candidates before replacing progress', () => {
    const cast = solve(reach('starter', 3), 5);
    const good = applySession(unlocked('starter'), solve(advanceSession(cast).session!));
    expect(() => validateProgress({ ...good, active: { ...good.active!, enemyBurnDamage: 8 } })).toThrow('燃燒');
    const invalidChoices = Object.keys(currentQuestion(good.active!).choices).map(Number).filter(index => !currentQuestion(good.active!).valid[index]?.length).slice(0, 2);
    expect(() => validateProgress({ ...good, active: { ...good.active!, lightningHintChoices: invalidChoices } })).toThrow('雷光');
  });
});
