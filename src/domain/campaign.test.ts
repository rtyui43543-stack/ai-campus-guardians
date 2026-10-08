import { describe, expect, it } from 'vitest';
import { getQuestions, questions } from '../content';
import { levels } from '../content/levels';
import {
  advanceSession, applySession, battleHealth, chooseAction, createProgress, currentQuestion,
  finishSession, retryQuestion, startSession, submitAction,
} from './engine';
import { exportBackup, parseBackup } from './storage';
import type { AttemptRecord, Progress, Session } from './types';
const ordinaryLevels = levels.filter(level => !level.finalBoss);

function roundTrip(progress: Progress, session: Session): Session {
  const restored = parseBackup(exportBackup(applySession(progress, session)));
  expect(restored.active).toEqual(session);
  return restored.active!;
}
function solve(session: Session, action?: number): Session {
  const question = currentQuestion(session);
  const next = submitAction(chooseAction(session, action ?? Number(Object.keys(question.valid)[0])));
  expect(next).toMatchObject({ step: 'feedback', success: true, reason: null });
  expect(next.feedback).toContain(question.explanation);
  return next;
}
function completeLevel(progress: Progress, levelId: number, review = false) {
  let session = startSession(levelId, 'starter', review);
  const records: AttemptRecord[] = [];
  while (true) {
    session = roundTrip(progress, solve(session));
    const next = advanceSession(session);
    records.push(next.record);
    expect(battleHealth(session).enemyHp).toBe(Math.max(0, 100 - records.length * 100 / session.questionIds.length - (session.enemyBonusDamage ?? 0)));
    if (next.finished) return { progress: finishSession(progress, session), session, records };
    expect(battleHealth(next.session!)).toEqual(battleHealth(session));
    session = roundTrip(progress, next.session!);
  }
}

describe('complete twelve-level campaign', () => {
  it.each(ordinaryLevels.map(level => [level.id, level.title] as const))('completes level %i (%s), accepts each permitted option and restores every checkpoint', (levelId) => {
    let session = startSession(levelId, 'starter');
    const progress = createProgress();
    expect(session.questionIds).toHaveLength(5);
    for (let slot = 1; slot <= 5; slot++) {
      const question = currentQuestion(session);
      expect(question.slot).toBe(slot);
      for (const action of Object.keys(question.valid).map(Number)) {
        const answer = roundTrip(progress, solve(session, action));
        expect(answer.success).toBe(true);
        expect(battleHealth(answer).enemyHp).toBe(Math.max(0, 100 - slot * 20 - (answer.enemyBonusDamage ?? 0)));
      }
      session = solve(session);
      const next = advanceSession(session);
      expect(next.record).toMatchObject({ status: 'first', questionId: question.id, mode: session.mode, reason: null });
      if (next.session) session = next.session;
      else {
        const completed = finishSession(progress, session);
        expect(completed.completed).toEqual([levelId]);
        expect(completed.attempts).toHaveLength(5);
        expect(completed.active).toBeNull();
        expect(parseBackup(exportBackup(completed))).toEqual(completed);
        expect(finishSession(completed, session)).toBe(completed);
      }
    }
  });

  it('finishes six beginner and six advanced missions as sixty distinct learning records', () => {
    expect(ordinaryLevels).toHaveLength(12);
    let progress = createProgress();
    for (const level of ordinaryLevels) progress = completeLevel(progress, level.id).progress;
    expect(progress.completed).toEqual(ordinaryLevels.map(level => level.id));
    expect(progress.attempts).toHaveLength(60);
    expect(new Set(progress.attempts.map(record => record.questionId)).size).toBe(60);
    expect(progress.attempts.filter(record => record.mode === 'starter')).toHaveLength(30);
    expect(progress.attempts.filter(record => record.mode === 'advanced')).toHaveLength(30);
    expect(progress.attempts.every(record => record.status === 'first' && record.reason === null)).toBe(true);
    expect(parseBackup(exportBackup(progress))).toEqual(progress);
  });

  it('rejects every distractor, preserves its explanation and permits supported correction', () => {
    let rejected = 0;
    for (const question of questions.filter(q => !levels.find(level => level.id === q.levelId)?.finalBoss)) {
      let checkpoint = startSession(question.levelId, 'starter');
      while (currentQuestion(checkpoint).slot < question.slot) checkpoint = advanceSession(solve(checkpoint)).session!;
      for (let action = 0; action < question.choices.length; action++) {
        if (question.valid[action]?.length) continue;
        rejected++;
        const wrong = submitAction(chooseAction(checkpoint, action));
        expect(wrong).toMatchObject({ success: false, step: 'feedback', retries: 1, shield: checkpoint.barrier ? 100 : 88 });
        expect(wrong.feedback).toBe(question.choices[action].feedback);
        expect(battleHealth(wrong).enemyHp).toBe(battleHealth(checkpoint).enemyHp);
        expect(submitAction(wrong)).toBe(wrong);
        expect(() => advanceSession(wrong)).toThrow('完成目前題目');
        const retry = retryQuestion(roundTrip(createProgress(), wrong));
        expect(retry).toMatchObject({ step: 'action', retries: 1 });
        expect(advanceSession(solve(retry)).record.status).toBe('supported');
      }
    }
    expect(rejected).toBeGreaterThan(150);
  });

  it('reads all twenty-four historical review variants without creating new play entries', () => {
    let progress = completeLevel(createProgress(), 1).progress;
    for (const level of ordinaryLevels) {
      const records: AttemptRecord[] = getQuestions(level.id, true).map(q => ({ questionId: q.id, mode: level.mode,
        action: Number(Object.keys(q.valid)[0]), reason: null, status: 'first', retries: 0, hintUsed: false, at: progress.updatedAt }));
      progress = { ...progress, attempts: [...progress.attempts, ...records], runs: [...progress.runs!, {
        sessionId: `legacy-review-${level.id}`, levelId: level.id, mode: level.mode, review: true, records, at: progress.updatedAt,
      }] };
      expect(() => startSession(level.id, level.mode, true)).toThrow('練習已移除');
      expect(progress.completed).toEqual([1]);
    }
    expect(progress.attempts).toHaveLength(29);
    expect(parseBackup(exportBackup(progress))).toEqual(progress);
  });

  it('backs up all five final mission decisions as the learner’s AI-use commitment', () => {
    const result = completeLevel(createProgress(), 12);
    const progress: Progress = {
      ...result.progress,
      proposals: [{
        at: result.progress.updatedAt, mode: 'advanced', reflection: '我會保護同學、查證資訊，並自己理解作業。',
        decisions: result.records.map(record => {
          const question = questions.find(item => item.id === record.questionId)!;
          return { questionId: record.questionId, action: question.choices[record.action!].text, reason: '' };
        }),
      }],
    };
    const restored = parseBackup(exportBackup(progress));
    expect(restored.proposals).toEqual(progress.proposals);
    expect(restored.proposals[0].decisions.map(decision => decision.questionId)).toEqual(getQuestions(12).map(question => question.id));
  });
});
