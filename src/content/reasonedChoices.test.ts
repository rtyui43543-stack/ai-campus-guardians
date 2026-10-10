import { describe, expect, it } from 'vitest';
import { questions, legacyReasoningQuestions, legacyFiveQuestionQuestions, getQuestionsForHistory, questionById } from './index';
import { levels } from './levels';
import { advanceSession, applySession, chooseAction, createProgress, currentQuestion, finishSession, requiresReason, startSession, submitAction } from '../domain/engine';
import { validateProgress } from '../domain/storage';
import { reconstructRuns, scoreSession } from '../domain/scoring';
import type { Session } from '../domain/types';

const solve = (session: Session) => submitAction(chooseAction(session, Number(Object.keys(currentQuestion(session).valid)[0])));

describe('one-click action and rationale choices', () => {
  it('judges every current scenario directly without adding a second answer stage', () => {
    for (const q of questions) {
      const mode = levels.find(level => level.id === q.levelId)!.mode;
      const session = { ...startSession(mode === 'starter' ? 1 : 7, mode), levelId: q.levelId, questionIds: [q.id], index: 0 };
      expect(requiresReason(session), q.id).toBe(false);
      q.choices.forEach((choice, index) => {
        expect(choice.action?.trim(), q.id).toBeTruthy();
        expect(choice.rationale?.trim(), q.id).toBeTruthy();
        expect(choice.text, q.id).toBe(`${choice.action}，${choice.rationale}`);
        const judged = submitAction(chooseAction(session, index));
        expect(judged.step, q.id).toBe('feedback');
        expect(judged.reason, q.id).toBeNull();
        expect(judged.success, q.id + ' option ' + index).toBe(!!q.valid[index]?.length);
        expect(judged.feedback, q.id).toContain(q.valid[index]?.length ? q.explanation : choice.feedback);
      });
    }
  });

  it('keeps new contexts tied to the same objective and outside saved editorial editions', () => {
    for (const level of levels) {
      const current = questions.filter(q => q.levelId === level.id);
      const old = legacyReasoningQuestions.filter(q => q.levelId === level.id);
      const originalSlot = (q: typeof current[number]) => level.id <= 6
        ? legacyFiveQuestionQuestions.find(item => item.levelId === level.id && item.prompt === q.prompt)!.slot : q.slot;
      for (const q of current) {
        const previous = old.find(item => item.slot === originalSlot(q))!;
        expect(q.id).not.toBe(previous.id);
        expect(q.objective).toBe(previous.objective);
        expect(q.source).toEqual(previous.source);
        expect(Object.keys(q.valid)).toEqual(Object.keys(previous.valid));
        expect(q.choices.map(c => c.text)).not.toEqual(previous.choices.map(c => c.text));
      }
      expect(current.filter(q => q.prompt !== old.find(item => item.slot === originalSlot(q))!.prompt).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('rejects a mistaken rationale even when it proposes the same action', () => {
    for (const id of ['V5L01Q01', 'V5L02Q01']) {
      const q = questionById.get(id)!;
      const answer = Number(Object.keys(q.valid)[0]);
      const other = q.choices.findIndex((choice, index) => index !== answer && choice.action === q.choices[answer].action);
      expect(other, id).toBeGreaterThanOrEqual(0);
      const session = { ...startSession(q.levelId, 'starter'), questionIds: [id], index: 0 };
      expect(submitAction(chooseAction(session, answer)).success, id).toBe(true);
      expect(submitAction(chooseAction(session, other)).success, id).toBe(false);
    }
  });

  it('keeps each archived sequence and chosen text when continuing, importing or reconstructing scores', () => {
    let session = { ...startSession(1, 'starter'), questionIds: getQuestionsForHistory(1, false, 'V2L01Q01').map(q => q.id) };
    session = solve(session);
    const progress = applySession(createProgress(), session);
    const restored = validateProgress(JSON.parse(JSON.stringify(progress)));
    expect(currentQuestion(restored.active!).choices).toEqual(questionById.get('V2L01Q01')!.choices);
    expect(restored.active!.questionIds.every(id => id.startsWith('V2L'))).toBe(true);
    session = advanceSession(restored.active!).session!;
    while (session.index < session.questionIds.length - 1) session = advanceSession(solve(session)).session!;
    session = solve(session);
    const finished = finishSession(progress, session);
    const imported = validateProgress(JSON.parse(JSON.stringify(finished)));
    const recovered = reconstructRuns(imported.attempts);
    expect(recovered).toHaveLength(1);
    expect(recovered[0].records.map(record => record.questionId)).toEqual(getQuestionsForHistory(1, false, 'V2L01Q01').map(q => q.id));
    expect(scoreSession(recovered[0]).score).toBe(scoreSession(imported.runs![0]).score);
    expect(imported.completed).toContain(1);
    expect(startSession(1, 'starter').questionIds.every(id => id.startsWith('V5L'))).toBe(true);
  });
});
