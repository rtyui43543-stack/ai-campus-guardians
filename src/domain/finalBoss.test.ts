import { describe, expect, it } from 'vitest';
import { getQuestions } from '../content';
import { getUltimateCardKey, getUltimateSpell } from '../content/ultimateSpells';
import {
  advanceSession, applySession, battleHealth, chooseAction, createProgress, currentQuestion, demonstrate,
  finalBossUnlocked, finishSession, restartBattle, retryQuestion, selectUltimate, startFinalBossSession,
  startSession, submitAction, tickQuestion,
} from './engine';
import { finalBossDamage, reconstructRuns, scoreSession } from './scoring';
import { exportBackup, parseBackup, validateProgress } from './storage';
import type { Mode, Progress, Session } from './types';

function unlocked(mode: Mode): Progress {
  const progress = createProgress();
  progress.ultimateCards = Array.from({ length: 6 }, (_, index) => ({ ultimateId: index + 1, unlockedAt: progress.updatedAt,
    sessionId: `earned-${mode}-${index + 1}`, questionId: getQuestions(index + 1 + (mode === 'advanced' ? 6 : 0))[3].id }));
  return progress;
}

function solve(session: Session, ultimateId = 2): Session {
  const prepared = session.energy === 3 ? selectUltimate(session, ultimateId) : session;
  return submitAction(chooseAction(prepared, Number(Object.keys(currentQuestion(prepared).valid)[0])));
}

function wrong(session: Session): Session {
  const q = currentQuestion(session);
  return submitAction(chooseAction(session, q.choices.findIndex((_, index) => !q.valid[index]?.length)));
}

function checkpoint(progress: Progress, session: Session): Session {
  const saved = applySession(progress, session);
  const restored = parseBackup(exportBackup(saved));
  expect(restored.active).toEqual(session);
  return restored.active!;
}

function reach(mode: Mode, index: number, ultimateId = 2): { progress: Progress; session: Session } {
  const progress = unlocked(mode);
  let session = startFinalBossSession(progress, mode);
  while (session.index < index) session = advanceSession(solve(session, ultimateId)).session!;
  return { progress, session };
}

describe('final mission entry and selected ultimate state', () => {
  it('requires all six earned cards of the requested tier and cannot bypass the gate through startSession', () => {
    const empty = createProgress();
    expect(finalBossUnlocked(empty, 'starter')).toBe(false);
    expect(() => startFinalBossSession(empty, 'starter')).toThrow('六張');
    expect(() => startSession(13, 'starter')).toThrow('六張');
    expect(() => startSession(14, 'advanced', false, unlocked('starter'))).toThrow('六張');
    const partial = unlocked('starter');
    partial.ultimateCards!.pop();
    expect(finalBossUnlocked(partial, 'starter')).toBe(false);
    const mixed = unlocked('starter');
    mixed.ultimateCards![5] = unlocked('advanced').ultimateCards![5];
    expect(finalBossUnlocked(mixed, 'starter')).toBe(false);
    for (const mode of ['starter', 'advanced'] as const) {
      const progress = unlocked(mode);
      expect(finalBossUnlocked(progress, mode)).toBe(true);
      expect(finalBossUnlocked(progress, mode === 'starter' ? 'advanced' : 'starter')).toBe(false);
      const session = startFinalBossSession(progress, mode);
      expect(session).toMatchObject({ levelId: mode === 'starter' ? 13 : 14, mode, shield: 100, energy: 0, timed: mode === 'advanced', index: 0 });
      expect(session.questionIds).toHaveLength(15);
      expect(battleHealth(session)).toEqual({ playerHp: 100, enemyHp: 300 });
      checkpoint(progress, session);
    }
  });

  it('requires selection at three energy, preserves it through a wrong answer, and spends it only on a correct answer', () => {
    const { progress, session: ready } = reach('starter', 3);
    expect(ready.energy).toBe(3);
    const correctIndex = Number(Object.keys(currentQuestion(ready).valid)[0]);
    const blocked = submitAction(chooseAction(ready, correctIndex));
    expect(blocked).toMatchObject({ step: 'action', energy: 3, success: false, selected: correctIndex });
    expect(blocked.feedback).toContain('先選擇');
    for (const id of [0, 7, 1.5]) expect(selectUltimate(ready, id)).toBe(ready);
    expect(selectUltimate(startSession(1, 'starter'), 1).preparedUltimateId).toBeUndefined();
    expect(selectUltimate(startFinalBossSession(progress, 'starter'), 1).preparedUltimateId).toBeUndefined();
    const selected = checkpoint(progress, selectUltimate(ready, 5));
    expect(selected.preparedUltimateId).toBe(5);
    const mistake = checkpoint(progress, wrong(selected));
    expect(mistake).toMatchObject({ energy: 3, preparedUltimateId: 5, shield: 88, ultimateUsed: false });
    expect(selectUltimate(mistake, 2)).toBe(mistake);
    const answered = checkpoint(progress, solve(retryQuestion(mistake), 5));
    expect(answered).toMatchObject({ energy: 0, ultimateUsed: true, ultimateId: 5, bonusPoints: 10, enemyBonusDamage: 10 });
    expect(answered.preparedUltimateId).toBeUndefined();
    expect(battleHealth(answered).enemyHp).toBe(210);
    expect(submitAction(answered)).toBe(answered);
    const next = checkpoint(progress, advanceSession(answered).session!);
    expect(next).toMatchObject({ energy: 0, repaired: 80 });
    expect(next.preparedUltimateId).toBeUndefined();
  });

  it('clears a selected spell and loses one energy on advanced timeout, then allows a new selection after recharge', () => {
    const { progress, session } = reach('advanced', 3);
    const expired = checkpoint(progress, tickQuestion(selectUltimate(session, 6), 30_000));
    expect(expired).toMatchObject({ energy: 2, shield: 88, timedOut: true, bonusPoints: 0 });
    expect(expired.preparedUltimateId).toBeUndefined();
    expect(submitAction(expired)).toBe(expired);
    const next = advanceSession(expired).session!;
    expect(selectUltimate(next, 2)).toBe(next);
    const charged = solve(next);
    expect(charged.energy).toBe(3);
    const chosen = selectUltimate(advanceSession(charged).session!, 4);
    expect(chosen.preparedUltimateId).toBe(4);
    checkpoint(progress, chosen);
  });

  it.each(['starter', 'advanced'] as const)('round-trips chosen castle and recovery effects for %s', mode => {
    const { progress, session } = reach(mode, 3);
    const castle = checkpoint(progress, solve(session, 1));
    expect(castle.enemyBonusDamage).toBe(getUltimateSpell(1, mode)!.extraDamage);
    expect(castle.barrierCharges).toBe(mode === 'advanced' ? 2 : 1);
    let current = advanceSession(castle).session!;
    for (let hit = 0; hit < (mode === 'advanced' ? 2 : 1); hit++) {
      current = wrong(current);
      expect(current.shield).toBe(100);
      expect(current.preventedDamage).toBe(true);
      current = retryQuestion(checkpoint(progress, current));
    }
    current = wrong(current);
    expect(current.shield).toBe(88);
    current = retryQuestion(checkpoint(progress, current));
    while (current.index < 7) current = advanceSession(solve(current)).session!;
    const restored = checkpoint(progress, solve(current, 3));
    expect(restored).toMatchObject({ ultimateId: 3, energy: 0, bonusPoints: 20, shield: 100 });
    // A separate naturally damaged checkpoint verifies the full 12/24-HP recovery amount.
    let damaged = selectUltimate(reach(mode, 3).session, 3);
    damaged = retryQuestion(wrong(damaged));
    damaged = retryQuestion(wrong(damaged));
    const healed = checkpoint(progress, solve(damaged, 3));
    expect(healed.shield).toBe(mode === 'advanced' ? 100 : 88);
  });
});

describe('final HP, early completion and actual-question scoring', () => {
  it.each(['starter', 'advanced'] as const)('ends %s as soon as HP reaches zero and saves an ordered prefix with repeat-cast rewards', mode => {
    const progress = unlocked(mode);
    let session = startFinalBossSession(progress, mode);
    let count = 0;
    while (true) {
      session = checkpoint(progress, solve(session, 2));
      count++;
      expect(battleHealth(session).enemyHp).toBe(Math.max(0, 300 - count * 20 - (session.enemyBonusDamage ?? 0)));
      const next = advanceSession(session);
      if (next.finished) break;
      expect(battleHealth(next.session!)).toEqual(battleHealth(session));
      session = checkpoint(progress, next.session!);
    }
    expect(count).toBe(mode === 'advanced' ? 13 : 14);
    const completed = finishSession(progress, session);
    expect(completed.completed).toEqual([session.levelId]);
    expect(completed.runs![0]).toMatchObject({ passed: true, review: false });
    expect(completed.runs![0].records).toHaveLength(count);
    expect(scoreSession(completed.runs![0])).toMatchObject({ score: 100, totalScore: 130, bonusScore: 30, ultimateUses: 3, perfect: true, questionCount: count });
    expect(parseBackup(exportBackup(completed))).toEqual(completed);
    expect(finishSession(completed, session)).toBe(completed);
    const recovered = reconstructRuns(completed.attempts);
    expect(recovered[0]).toMatchObject({ passed: true, levelId: session.levelId });
    expect(recovered[0].records).toHaveLength(count);
    expect(reconstructRuns([...completed.attempts, ...completed.attempts])).toHaveLength(2);
    expect(finalBossDamage(completed.runs![0].records)).toBeGreaterThanOrEqual(300);
  });

  it('can defeat the advanced boss after one timeout without incorrectly applying ordinary timeout failure', () => {
    const progress = unlocked('advanced');
    let session = advanceSession(tickQuestion(startFinalBossSession(progress, 'advanced'), 30_000)).session!;
    while (true) {
      session = solve(session, 6);
      const next = advanceSession(session);
      if (next.finished) break;
      session = next.session!;
    }
    const finished = finishSession(progress, session);
    expect(finished.runs![0]).toMatchObject({ passed: true });
    expect(finished.completed).toEqual([14]);
    expect(scoreSession(finished.runs![0])).toMatchObject({ questionCount: 14, score: 92.86, bonusScore: 30, timeouts: 1, perfect: false });
    expect(parseBackup(exportBackup(finished))).toEqual(finished);
  });

  it('saves a failed fifteen-question run if timeouts leave HP above zero and resets all battle resources on retry', () => {
    const progress = unlocked('advanced');
    let session = startFinalBossSession(progress, 'advanced');
    for (let index = 0; index < 3; index++) session = advanceSession(tickQuestion(session, 30_000)).session!;
    while (true) {
      session = checkpoint(progress, solve(session, 4));
      const next = advanceSession(session);
      if (next.finished) break;
      session = next.session!;
    }
    expect(session.index).toBe(14);
    expect(battleHealth(session)).toEqual({ enemyHp: 15, playerHp: 64 });
    const finished = finishSession(progress, session);
    expect(finished.completed).toEqual([]);
    expect(finished.runs![0].passed).toBe(false);
    expect(scoreSession(finished.runs![0])).toMatchObject({ score: 80, bonusScore: 30, totalScore: 110, timeouts: 3, questionCount: 15 });
    expect(parseBackup(exportBackup(finished))).toEqual(finished);
    const restarted = restartBattle(applySession(finished, session));
    expect(restarted.active).toMatchObject({ index: 0, energy: 0, bonusPoints: 0, enemyBonusDamage: 0, barrierCharges: 0, shield: 100, records: [] });
    expect(battleHealth(restarted.active!)).toEqual({ enemyHp: 300, playerHp: 100 });
    expect(restarted.runs).toEqual(finished.runs);
    expect(restarted.ultimateCards).toEqual(finished.ultimateCards);
  });

  it('keeps low-health defeat and premature-final-completion guards', () => {
    const { progress, session } = reach('advanced', 3);
    expect(() => finishSession(progress, solve(session))).toThrow('尚未完成');
    const defeated = checkpoint(progress, wrong({ ...selectUltimate(session, 1), shield: 4 }));
    expect(defeated).toMatchObject({ step: 'defeat', shield: 0, energy: 3, preparedUltimateId: 1 });
    expect(() => advanceSession(defeated)).toThrow('挑戰已結束');
    const restarted = restartBattle(applySession(progress, defeated));
    expect(restarted.active?.preparedUltimateId).toBeUndefined();
    expect(restarted.active?.energy).toBe(0);
  });

  it('does not charge or cast for a demonstration and retains prepared selection for the next real answer', () => {
    const { progress, session } = reach('starter', 3);
    const demo = checkpoint(progress, demonstrate(selectUltimate(session, 5)));
    expect(demo).toMatchObject({ energy: 3, preparedUltimateId: 5, ultimateUsed: false, enemyBonusDamage: 0 });
    const next = advanceSession(demo).session!;
    const cast = checkpoint(progress, submitAction(chooseAction(next, Number(Object.keys(currentQuestion(next).valid)[0]))));
    expect(cast).toMatchObject({ ultimateUsed: true, ultimateId: 5, energy: 0 });
  });
});

describe('final save validation and removed practice migration', () => {
  it('rejects unearned final entries and inconsistent choices, energy, damage or completion', () => {
    const { progress, session } = reach('advanced', 3);
    const selected = applySession(progress, selectUltimate(session, 6));
    const missingCards = { ...selected, ultimateCards: selected.ultimateCards!.slice(0, 5) };
    expect(() => validateProgress(missingCards)).toThrow('尚未解鎖');
    for (const changes of [{ preparedUltimateId: 7 }, { energy: 2 }, { enemyBonusDamage: 10 }, { preparedUltimateId: 6, timedOut: true }]) {
      expect(() => validateProgress({ ...selected, active: { ...selected.active!, ...changes } })).toThrow('備份格式不正確');
    }
    const wrongTier = { ...selected, active: { ...selected.active!, mode: 'starter' as const } };
    expect(() => validateProgress(wrongTier)).toThrow('模式與關卡不符');
    let final = startFinalBossSession(progress, 'advanced');
    while (true) {
      final = solve(final);
      const next = advanceSession(final);
      if (next.finished) break;
      final = next.session!;
    }
    const complete = finishSession(progress, final);
    const forged = structuredClone(complete);
    forged.runs![0].passed = false;
    expect(() => validateProgress(forged)).toThrow('最終魔王通關狀態');
    const truncated = structuredClone(complete);
    truncated.runs![0].records.pop();
    truncated.attempts.pop();
    expect(() => validateProgress(truncated)).toThrow('最終魔王通關狀態');
    const wrongCast = structuredClone(complete);
    wrongCast.runs![0].records[0].ultimateUsed = true;
    wrongCast.runs![0].records[0].ultimateId = 2;
    wrongCast.attempts = wrongCast.runs![0].records;
    expect(() => validateProgress(wrongCast)).toThrow('必殺技');
  });

  it('keeps a complete old review score while dropping an old active review route', () => {
    const progress = unlocked('starter');
    const at = progress.updatedAt;
    const oldQuestions = getQuestions(1, true);
    const records = oldQuestions.map(q => ({ questionId: q.id, mode: 'starter' as const, action: Number(Object.keys(q.valid)[0]),
      reason: null, status: 'first' as const, retries: 0, hintUsed: false, at }));
    progress.attempts = records;
    progress.runs = [{ sessionId: 'old-complete-review', levelId: 1, mode: 'starter', review: true, records, at }];
    progress.active = { ...startSession(1, 'starter'), questionIds: oldQuestions.map(q => q.id), review: true, timed: false };
    const restored = parseBackup(JSON.stringify(progress));
    expect(restored.active).toBeNull();
    expect(restored.runs).toEqual(progress.runs);
    expect(restored.attempts).toEqual(records);
    expect(restored.ultimateCards!.map(getUltimateCardKey)).toEqual(progress.ultimateCards!.map(getUltimateCardKey));
    expect(scoreSession(restored.runs![0])).toMatchObject({ score: 100, questionCount: 2, bonusScore: 0 });
    expect(() => startSession(1, 'starter', true)).toThrow('練習已移除');
  });
});
