import { describe, expect, it } from 'vitest';
import {
  advanceSession, applySession, battleHealth, chooseAction, createProgress, currentQuestion,
  demonstrate, expireQuestion, finishSession, restartBattle, retryQuestion, startSession,
  submitAction, tickQuestion, useHint,
} from './engine';
import { describeAttempt, scoreRecord, scoreSession } from './scoring';
import { exportBackup, parseBackup, validateProgress } from './storage';
import type { Progress, Session } from './types';
import { getUltimateCardKey, getUltimateCardMode } from '../content/ultimateSpells';

function solve(session: Session): Session {
  return submitAction(chooseAction(session, Number(Object.keys(currentQuestion(session).valid)[0])));
}
function wrong(session: Session): Session {
  const q = currentQuestion(session);
  return submitAction(chooseAction(session, q.choices.findIndex((_, i) => !q.valid[i]?.length)));
}
function reachQuestion(levelId: number, count: number): Session {
  let session = startSession(levelId, 'starter');
  while (session.index < count - 1) session = advanceSession(solve(session)).session!;
  return session;
}
function roundTrip(session: Session, progress = createProgress()): Progress {
  const saved = applySession(progress, session);
  expect(parseBackup(exportBackup(saved))).toEqual(saved);
  return parseBackup(exportBackup(saved));
}

describe('per-run energy and ultimate rewards', () => {
  it('keeps both review questions at zero energy without ultimate bonuses or collectible cards', () => {
    for (const levelId of [1, 8]) {
      let session = startSession(levelId, 'advanced', true);
      expect(session.energy).toBe(0);
      const mistake = wrong({ ...session, energy: 3 });
      expect(mistake.energy).toBe(0);
      expect(demonstrate({ ...session, energy: 3 }).energy).toBe(0);
      for (let index = 0; index < 2; index++) {
        session = solve(session);
        expect(session).toMatchObject({ energy: 0, ultimateUsed: false, bonusPoints: 0 });
        expect(roundTrip(session).ultimateCards).toEqual([]);
        if (index === 0) session = advanceSession(session).session!;
      }
      const finished = finishSession(createProgress(), session);
      expect(scoreSession(finished.runs![0])).toMatchObject({ score: 100, bonusScore: 0, ultimateUses: 0 });
      expect(finished.ultimateCards).toEqual([]);
    }
  });

  it('prepares after three answers and releases only on the following correct answer, exactly once', () => {
    let session = startSession(1, 'starter');
    for (let count = 1; count <= 3; count++) {
      session = solve(session);
      expect(session).toMatchObject({ energy: count, ultimateUsed: false, bonusPoints: 0 });
      expect(scoreSession(session).bonusScore).toBe(0);
      session = advanceSession(session).session!;
    }
    const released = solve(session);
    expect(released).toMatchObject({ energy: 0, ultimateUsed: true, ultimateId: 1, barrier: true, bonusPoints: 10 });
    expect(submitAction(released)).toBe(released);
    expect(demonstrate(released)).toBe(released);
    expect(scoreSession(released)).toMatchObject({ score: 80, bonusScore: 10, totalScore: 90, ultimateUses: 1 });
    const next = advanceSession(released);
    expect(next.record).toMatchObject({ ultimateUsed: true, ultimateId: 1 });
    expect(next.session).toMatchObject({ energy: 0, ultimateUsed: false, bonusPoints: 10, barrier: true });
    expect(next.session?.ultimateId).toBeUndefined();
    const finished = finishSession(createProgress(), solve(next.session!));
    expect(scoreSession(finished.runs![0])).toMatchObject({ score: 100, bonusScore: 10, totalScore: 110, perfect: true });
  });

  it('uses accumulated points rather than an additional consecutive-answer requirement', () => {
    let session = reachQuestion(2, 3);
    expect(session.energy).toBe(2);
    const mistake = wrong(session);
    expect(mistake.energy).toBe(1);
    session = advanceSession(solve(retryQuestion(mistake))).session!;
    expect(session.energy).toBe(2);
    session = advanceSession(solve(session)).session!;
    expect(session.energy).toBe(3);
    // There has been an error in this run; the fifth correct answer still releases.
    const last = solve(session);
    expect(last).toMatchObject({ ultimateUsed: true, energy: 0, ultimateId: 2, bonusPoints: 10 });
    expect(scoreSession(last)).toMatchObject({ score: 96, bonusScore: 10, totalScore: 106, wrongAnswers: 1 });
  });

  it('removes a prepared point on an error and does not release while merely recharging', () => {
    const ready = reachQuestion(2, 4);
    expect(ready.energy).toBe(3);
    const mistake = wrong(ready);
    expect(mistake).toMatchObject({ energy: 2, ultimateUsed: false, bonusPoints: 0 });
    const corrected = solve(retryQuestion(mistake));
    expect(corrected).toMatchObject({ energy: 3, ultimateUsed: false, bonusPoints: 0 });
    const final = solve(advanceSession(corrected).session!);
    expect(final).toMatchObject({ energy: 0, ultimateUsed: true });
    let depleted = startSession(1, 'starter');
    for (let i = 0; i < 3; i++) depleted = retryQuestion(wrong(depleted));
    expect(depleted.energy).toBe(0);
  });

  it('allows hints to charge energy while demonstrations never charge or spend a prepared ultimate', () => {
    const hinted = solve(useHint(startSession(1, 'starter')));
    expect(hinted.energy).toBe(1);
    expect(scoreSession(hinted).score).toBe(16);
    const ready = reachQuestion(1, 4);
    const demo = demonstrate(ready);
    expect(demo).toMatchObject({ energy: 3, ultimateUsed: false, bonusPoints: 0 });
    expect(scoreSession(demo).bonusScore).toBe(0);
    const fifth = solve(advanceSession(demo).session!);
    expect(fifth).toMatchObject({ ultimateUsed: true, energy: 0 });
    expect(scoreSession(fifth)).toMatchObject({ score: 80, bonusScore: 10, demos: 1 });
  });

  it.each([1, 6, 7, 12])('uses defensive mission %i to absorb one attack only, including a saved checkpoint', levelId => {
    const released = solve(reachQuestion(levelId, 4));
    let fifth = roundTrip(advanceSession(released).session!).active!;
    const protectedHit = wrong(fifth);
    expect(protectedHit).toMatchObject({ shield: 100, preventedDamage: true, barrier: false, retries: 1 });
    expect(protectedHit.energy).toBe(0);
    fifth = roundTrip(retryQuestion(protectedHit)).active!;
    const secondHit = wrong(fifth);
    expect(secondHit).toMatchObject({ shield: 88, preventedDamage: false, barrier: false, retries: 2 });
  });

  it.each([2, 4, 5, 8, 10, 11])('uses offensive mission %i to add damage without skipping a question', levelId => {
    const fourth = solve(reachQuestion(levelId, 4));
    expect(fourth).toMatchObject({ enemyBonusDamage: 10, bonusPoints: 10 });
    expect(battleHealth(fourth).enemyHp).toBe(10);
    const next = advanceSession(fourth);
    expect(next.finished).toBe(false);
    expect(next.session?.index).toBe(4);
    expect(battleHealth(next.session!).enemyHp).toBe(10);
    const final = solve(next.session!);
    expect(battleHealth(final).enemyHp).toBe(0);
    expect(final.enemyBonusDamage).toBe(10);
  });

  it.each([3, 9])('uses support mission %i to heal 12 HP up to the 100 HP limit', levelId => {
    const ready = reachQuestion(levelId, 4);
    expect(solve({ ...ready, shield: 76 })).toMatchObject({ shield: 88, enemyBonusDamage: 0, bonusPoints: 10 });
    expect(solve({ ...ready, shield: 96 }).shield).toBe(100);
    expect(solve(ready).shield).toBe(100);
  });

  it('keeps earned cards after defeat or a restart but resets all new-battle resources', () => {
    const fourth = solve(reachQuestion(2, 4));
    const saved = roundTrip(fourth);
    expect(saved.ultimateCards).toHaveLength(1);
    expect(saved.ultimateCards![0]).toMatchObject({ ultimateId: 2, sessionId: fourth.id, questionId: fourth.questionIds[3] });
    expect(applySession(saved, fourth).ultimateCards).toEqual(saved.ultimateCards);
    const fifth = { ...advanceSession(fourth).session!, shield: 4 };
    const defeated = applySession(saved, wrong(fifth));
    expect(defeated.active?.step).toBe('defeat');
    const restarted = restartBattle(roundTrip(defeated.active!, defeated));
    expect(restarted.ultimateCards).toEqual(saved.ultimateCards);
    expect(restarted.active).toMatchObject({ energy: 0, bonusPoints: 0, enemyBonusDamage: 0, barrier: false, shield: 100 });
    expect(parseBackup(exportBackup(restarted))).toEqual(restarted);
    const anotherLevel = applySession(restarted, startSession(3, 'starter'));
    expect(anotherLevel.active?.energy).toBe(0);
    expect(anotherLevel.ultimateCards).toEqual(saved.ultimateCards);
  });

  it('unlocks the starter and advanced form independently while keeping repeat releases as one card per tier', () => {
    const basic = solve(reachQuestion(2, 4));
    let progress = applySession(createProgress(), basic);
    const originalCard = progress.ultimateCards![0];
    const upgraded = solve(reachQuestion(8, 4));
    progress = roundTrip(upgraded, progress);
    expect(progress.ultimateCards!.map(getUltimateCardKey)).toEqual(['starter:2', 'advanced:2']);
    expect(progress.ultimateCards![0]).toEqual(originalCard);
    const secondAdvanced = solve(reachQuestion(8, 4));
    expect(applySession(progress, secondAdvanced).ultimateCards).toEqual(progress.ultimateCards);
    expect(scoreSession(upgraded)).toMatchObject({ score: 80, bonusScore: 10, totalScore: 90 });
    expect(battleHealth(upgraded).enemyHp).toBe(10);
    expect(startSession(8, 'advanced').energy).toBe(0);
  });

  it('lets an advanced-only player earn an upgrade without inventing the unplayed starter card', () => {
    const progress = roundTrip(solve(reachQuestion(7, 4)));
    expect(progress.ultimateCards).toHaveLength(1);
    expect(getUltimateCardMode(progress.ultimateCards![0])).toBe('advanced');
  });
});

describe('advanced time challenge boundaries and timeout transitions', () => {
  it('times only new advanced main challenges; beginner and all review questions stay untimed', () => {
    for (let levelId = 1; levelId <= 12; levelId++) {
      const main = startSession(levelId, 'advanced');
      expect(main.timed).toBe(levelId > 6);
      const review = startSession(levelId, 'advanced', true);
      expect(review.timed).toBe(false);
      expect(tickQuestion(review, 90_000)).toBe(review);
      if (levelId <= 6) expect(tickQuestion(main, 90_000)).toBe(main);
    }
  });

  it.each([[0, 20], [10_000, 20], [10_001, 16], [20_000, 16], [20_001, 12], [29_999, 12]])('caps an answer at %i ms to %i points', (elapsedMs, points) => {
    const answered = solve(tickQuestion(startSession(7, 'advanced'), elapsedMs));
    const record = advanceSession(answered).record;
    expect(record).toMatchObject({ timed: true, elapsedMs, timedOut: false });
    expect(scoreRecord(record, 5)).toBe(points);
    expect(scoreSession(answered).rows[0].timeLimitPoints).toBe(points);
    expect(roundTrip(answered).active).toEqual(answered);
  });

  it('combines elapsed time, hints and retries by taking the lowest cap instead of adding penalties', () => {
    const timed = tickQuestion(startSession(7, 'advanced'), 15_000);
    const hinted = solve(useHint(timed));
    expect(scoreSession(hinted).score).toBe(16);
    let session = tickQuestion(startSession(7, 'advanced'), 24_000);
    session = retryQuestion(wrong(session));
    expect(scoreSession(solve(session)).score).toBe(12);
    session = retryQuestion(wrong(session));
    session = retryQuestion(wrong(session));
    expect(scoreSession(solve(session)).score).toBe(8);
  });

  it('retains time on retry, freezes finished feedback and resets only when advancing', () => {
    const before = tickQuestion(startSession(7, 'advanced'), 9_750);
    const rejected = wrong(before);
    expect(tickQuestion(rejected, 8_000)).toBe(rejected);
    const retry = retryQuestion(rejected);
    expect(retry).toMatchObject({ remainingMs: 20_250, elapsedMs: 9_750 });
    const answered = solve(tickQuestion(retry, 5_500));
    expect(tickQuestion(answered, 90_000)).toBe(answered);
    const next = advanceSession(answered).session!;
    expect(next).toMatchObject({ elapsedMs: 0, remainingMs: 30_000, timedOut: false });
  });

  it('expires exactly at zero, attacks once and rejects late selected answers or repeated callbacks', () => {
    const initial = startSession(7, 'advanced');
    const selected = chooseAction(initial, Number(Object.keys(currentQuestion(initial).valid)[0]));
    const expired = tickQuestion(selected, 30_000);
    expect(expired).toMatchObject({ step: 'feedback', success: false, selected: null, timedOut: true, shield: 88, energy: 0 });
    expect(submitAction(expired)).toBe(expired);
    expect(chooseAction(expired, 0)).toBe(expired);
    expect(expireQuestion(expired)).toBe(expired);
    expect(tickQuestion(expired, 1)).toBe(expired);
    expect(retryQuestion(expired)).toBe(expired);
    expect(useHint(expired)).toBe(expired);
    expect(demonstrate(expired)).toBe(expired);
    expect(scoreSession(expired)).toMatchObject({ score: 0, timeouts: 1, firstTryCorrect: 0, wrongAnswers: 0 });
    const record = advanceSession(expired).record;
    expect(record).toMatchObject({ action: null, status: 'timeout', timed: true, elapsedMs: 30_000, timedOut: true });
    expect(describeAttempt(record)).toBe('超時未作答');
    expect(roundTrip(expired).active).toEqual(expired);
    for (const answer of [chooseAction({ ...initial, remainingMs: 0, elapsedMs: 30_000 }, 0), submitAction({ ...selected, remainingMs: 0, elapsedMs: 30_000 })]) {
      expect(answer).toMatchObject({ success: false, timedOut: true, shield: 88 });
    }
  });

  it('allows timeout advancement without repairing enemy HP and saves a failed scored run', () => {
    let session = tickQuestion(startSession(8, 'advanced'), 30_000);
    expect(advanceSession(session).finished).toBe(false);
    session = advanceSession(session).session!;
    expect(session).toMatchObject({ index: 1, repaired: 0, shield: 88 });
    expect(battleHealth(session).enemyHp).toBe(100);
    while (session.index < 4) session = advanceSession(solve(session)).session!;
    const final = solve(session);
    const finished = finishSession(createProgress(), final);
    expect(finished.completed).toEqual([]);
    expect(finished.runs?.[0].passed).toBe(false);
    expect(finished.attempts).toHaveLength(5);
    expect(scoreSession(finished.runs![0])).toMatchObject({ score: 80, timeouts: 1, bonusScore: 10, totalScore: 90 });
    expect(parseBackup(exportBackup(finished))).toEqual(finished);
    expect(finishSession(finished, final)).toBe(finished);
    expect(battleHealth(final).enemyHp).toBe(10);
  });

  it('finishes a last-question timeout with a score while retaining earlier completed status and cards', () => {
    const fourth = solve(reachQuestion(8, 4));
    const saved = applySession({ ...createProgress(), completed: [8] }, fourth);
    const final = tickQuestion(advanceSession(fourth).session!, 30_000);
    expect(final).toMatchObject({ step: 'feedback', shield: 88, timedOut: true });
    expect(advanceSession(final)).toMatchObject({ finished: true, session: null });
    const finished = finishSession(saved, final);
    expect(finished.completed).toEqual([8]);
    expect(finished.runs![0].passed).toBe(false);
    expect(finished.ultimateCards).toEqual(saved.ultimateCards);
    expect(scoreSession(finished.runs![0])).toMatchObject({ score: 80, bonusScore: 10, timeouts: 1 });
    expect(parseBackup(exportBackup(finished))).toEqual(finished);
  });

  it('consumes defensive protection on timeout, still records zero points and can die on a later timeout', () => {
    const fourth = solve(reachQuestion(7, 4));
    const protectedExpiry = tickQuestion(advanceSession(fourth).session!, 30_000);
    expect(protectedExpiry).toMatchObject({ shield: 100, barrier: false, preventedDamage: true, timedOut: true });
    expect(advanceSession(protectedExpiry).record.preventedDamage).toBe(true);
    const low = { ...startSession(7, 'advanced'), shield: 4, energy: 2 };
    const defeated = tickQuestion(low, 30_000);
    expect(defeated).toMatchObject({ step: 'defeat', shield: 0, energy: 1, timedOut: true });
    expect(() => advanceSession(defeated)).toThrow('挑戰已結束');
    expect(() => finishSession(createProgress(), defeated)).toThrow('挑戰已結束');
    expect(roundTrip(defeated).active).toEqual(defeated);
  });

  it('ignores invalid timer deltas without mutating a valid snapshot', () => {
    const initial = startSession(7, 'advanced');
    for (const delta of [0, -1, NaN, Infinity]) expect(tickQuestion(initial, delta)).toBe(initial);
    expect(initial.elapsedMs).toBe(0);
    expect(tickQuestion(initial, 100_000)).toMatchObject({ elapsedMs: 30_000, remainingMs: 0, shield: 88 });
  });
});

describe('new combat backup validation and legacy score preservation', () => {
  it('preserves old advanced run scores and lets an old active session resume without retroactive timing', () => {
    const newSession = reachQuestion(8, 3);
    const oldActive: Session = { ...newSession, records: newSession.records.map(record => {
      const clone = { ...record }; delete clone.timed; delete clone.elapsedMs; delete clone.timedOut; return clone;
    }) };
    for (const field of ['energy', 'ultimateUsed', 'ultimateId', 'barrier', 'bonusPoints', 'enemyBonusDamage', 'timed', 'remainingMs', 'elapsedMs', 'timedOut', 'preventedDamage'] as const) delete oldActive[field];
    const oldProgress: Progress = { ...createProgress(), active: oldActive };
    delete oldProgress.ultimateCards;
    const restored = parseBackup(JSON.stringify(oldProgress));
    expect(restored.active).toEqual(oldActive);
    expect(restored.active?.timed).toBeUndefined();
    expect(tickQuestion(restored.active!, 60_000)).toBe(restored.active);
    let finishedSession = restored.active!;
    while (finishedSession.index < 4) finishedSession = advanceSession(solve(finishedSession)).session!;
    const finished = finishSession(restored, solve(finishedSession));
    expect(scoreSession(finished.runs![0])).toMatchObject({ score: 100, bonusScore: 0, totalScore: 100, timeouts: 0 });
    expect(parseBackup(exportBackup(finished))).toEqual(finished);
  });

  it.each([
    { energy: 4 }, { timed: true, remainingMs: 0, elapsedMs: 30_000 },
    { timed: true, remainingMs: 30_000, elapsedMs: 20_000 },
    { timedOut: true }, { bonusPoints: 10 }, { enemyBonusDamage: 10 },
    { ultimateUsed: true, ultimateId: 2, energy: 0 },
  ])('rejects inconsistent active combat state %j before replacing a save', changes => {
    const raw = applySession(createProgress(), startSession(7, 'advanced'));
    raw.active = { ...raw.active!, ...changes };
    expect(() => validateProgress(raw)).toThrow('備份格式不正確');
  });

  it('rejects forged timeout answers, timed review rows, wrong-topic releases and duplicate cards', () => {
    const expired = tickQuestion(startSession(7, 'advanced'), 30_000);
    const failed = advanceSession(expired).session!;
    const original = roundTrip(failed);
    const malformed = structuredClone(original);
    malformed.active!.records[0].action = 0;
    expect(() => validateProgress(malformed)).toThrow('有效的作答或超時');
    const ready = solve(reachQuestion(8, 4));
    const saved = roundTrip(ready);
    saved.active!.ultimateId = 1;
    expect(() => validateProgress(saved)).toThrow('必殺技');
    const duplicate = roundTrip(ready);
    duplicate.ultimateCards!.push({ ...duplicate.ultimateCards![0] });
    expect(() => validateProgress(duplicate)).toThrow('重複收藏');
    const review = advanceSession(solve(startSession(7, 'advanced', true))).session!;
    review.records[0] = { ...review.records[0], timed: true, elapsedMs: 1_000 };
    expect(() => validateProgress(applySession(createProgress(), review))).toThrow('限時紀錄');
  });
});
