import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getQuestions, getQuestionsForHistory, legacyFiveQuestionQuestions, questionBank } from '../content';
import { advanceSession, applySession, battleHealth, chooseAction, createProgress, currentQuestion,
  demonstrate, finishSession, retryQuestion, startSession, submitAction } from './engine';
import { scoreSession } from './scoring';
import { exportBackup, parseBackup } from './storage';
import type { Session } from './types';

const solve = (s: Session) => submitAction(chooseAction(s, Number(Object.keys(currentQuestion(s).valid)[0])));
const restore = (s: Session) => parseBackup(exportBackup(applySession(createProgress(), s))).active!;

describe('four-question starter missions and original editions', () => {
  it('removes only the selected difficult question and preserves every retained word and answer', () => {
    const removedSlots = [5, 5, 3, 5, 5, 5];
    for (let level = 1; level <= 6; level++) {
      const original = legacyFiveQuestionQuestions.filter(q => q.levelId === level && q.slot !== removedSlots[level - 1]);
      const current = getQuestions(level);
      expect(current).toHaveLength(4);
      current.forEach((q, index) => {
        expect(q.id).toBe(`V5L${String(level).padStart(2, '0')}Q${String(index + 1).padStart(2, '0')}`);
        expect({ ...q, id: original[index].id, slot: original[index].slot }).toEqual(original[index]);
      });
    }
    const digest = (qs: typeof questionBank.questions) => createHash('sha256').update(JSON.stringify(qs)).digest('hex');
    expect(digest(questionBank.questions.filter(q => q.levelId >= 7 && q.levelId <= 12))).toBe('8666d83340b3ff72800a2109aa876645d1948b4c1d5ae5d01c95601d7061142a');
    expect(digest(questionBank.questions.filter(q => q.levelId >= 13))).toBe('a3b392af6b47f31648460025aa8c4ad4cc892a9eb6f236d8ddfaa8226315e2b7');
  });

  it.each([1, 2, 3, 4, 5, 6])('finishes starter mission %i in four hits, including the final ultimate, without a fifth record', level => {
    let s = startSession(level, 'starter');
    for (let index = 0; index < 4; index++) {
      expect(battleHealth(s).enemyHp).toBe(100 - index * 25);
      const answered = restore(solve(s));
      expect(battleHealth(answered).enemyHp).toBe(Math.max(0, 100 - (index + 1) * 25 - (answered.enemyBonusDamage ?? 0)));
      expect(scoreSession(answered).score).toBe((index + 1) * 25);
      expect(answered.ultimateUsed).toBe(index === 3);
      expect(submitAction(answered)).toBe(answered);
      const next = advanceSession(answered);
      expect(next.finished).toBe(index === 3);
      if (next.session) s = restore(next.session);
      else {
        const finished = finishSession(createProgress(), answered);
        expect(finished.runs![0].records).toHaveLength(4);
        expect(finished.ultimateCards).toHaveLength(1);
        expect(scoreSession(finished.runs![0])).toMatchObject({ score: 100, bonusScore: 10, perfect: true });
        expect(parseBackup(exportBackup(finished))).toEqual(finished);
        expect(finishSession(finished, answered)).toBe(finished);
      }
    }
  });

  it.each([1, 2, 3, 4, 5, 6])('does not invent a fifth chance or free ultimate after a demonstration in starter mission %i', level => {
    let s = advanceSession(demonstrate(startSession(level, 'starter'))).session!;
    while (s.index < 3) s = advanceSession(solve(s)).session!;
    const answered = restore(solve(s));
    expect(answered).toMatchObject({ energy: 3, ultimateUsed: false, bonusPoints: 0 });
    expect(battleHealth(answered).enemyHp).toBe(0);
    expect(advanceSession(answered)).toMatchObject({ finished: true, session: null });
    const finished = finishSession(createProgress(), answered);
    expect(scoreSession(finished.runs![0])).toMatchObject({ score: 75, bonusScore: 0, demos: 1, perfect: false });
    expect(finished.ultimateCards).toEqual([]);
  });

  it.each([1, 2, 3, 4, 5, 6])('preserves an original five-question mission %i at every restored checkpoint', level => {
    let s = { ...startSession(level, 'starter'), questionIds: getQuestionsForHistory(level, false, `V4L${String(level).padStart(2, '0')}Q01`).map(q => q.id) };
    for (let index = 0; index < 5; index++) {
      s = restore(s);
      expect(s.questionIds).toHaveLength(5);
      expect(scoreSession(s).questionCount).toBe(5);
      const answered = restore(solve(s));
      expect(scoreSession(answered).score).toBe((index + 1) * 20);
      const next = advanceSession(answered);
      if (next.session) s = next.session;
      else {
        expect(index).toBe(4);
        expect(finishSession(createProgress(), answered).attempts).toHaveLength(5);
      }
    }
  });

  it('keeps the ready final ultimate through a mistake and applies only one 25 HP basic hit after retry', () => {
    let s = startSession(2, 'starter');
    for (let index = 0; index < 3; index++) s = advanceSession(solve(s)).session!;
    const q = currentQuestion(s);
    const wrong = submitAction(chooseAction(s, q.choices.findIndex((_, i) => !q.valid[i]?.length)));
    expect(battleHealth(wrong).enemyHp).toBe(25);
    expect(wrong.energy).toBe(3);
    const answered = restore(solve(retryQuestion(restore(wrong))));
    expect(answered).toMatchObject({ ultimateUsed: true, bonusPoints: 10, energy: 0 });
    expect(scoreSession(answered)).toMatchObject({ score: 95, bonusScore: 10, wrongAnswers: 1 });
    expect(battleHealth(answered).enemyHp).toBe(0);
    expect(advanceSession(answered).finished).toBe(true);
  });
});
