import { describe, expect, it } from 'vitest';
import { questions } from '../content';
import { levels } from '../content/levels';
import {
  advanceSession, applySession, battleHealth, chooseAction, chooseReason, createProgress, currentQuestion,
  demonstrate, finishSession, requiresReason, retryQuestion, sessionSummary, startSession,
  submitAction, submitReason, useHint,
} from './engine';
import type { Mode, Session } from './types';

function solve(session: Session, action?: number): Session {
  const q = currentQuestion(session);
  return submitAction(chooseAction(session, action ?? Number(Object.keys(q.valid)[0])));
}
function reachSlot(levelId: number, slot: number): Session {
  let session = startSession(levelId, 'starter', slot > 5);
  while (currentQuestion(session).slot < slot) session = advanceSession(solve(session)).session!;
  return session;
}
function wrongIndex(session: Session) {
  const q = currentQuestion(session);
  return q.choices.findIndex((_, index) => !q.valid[index]?.length);
}

describe('direct-answer battle engine', () => {
  it('binds each level to its actual curriculum rather than relabelling its difficulty', () => {
    expect(levels.filter(level => level.mode === 'starter')).toHaveLength(6);
    expect(levels.filter(level => level.mode === 'advanced')).toHaveLength(6);
    for (const level of levels) {
      const requested: Mode = level.mode === 'starter' ? 'advanced' : 'starter';
      expect(startSession(level.id, requested).mode).toBe(level.mode);
    }
    expect(() => startSession(13, 'starter')).toThrow('找不到');
    expect(() => startSession(1, 'easy' as Mode)).toThrow('有效');
  });

  it('processes a selected answer immediately without adding a reason stage', () => {
    const initial = startSession(7, 'advanced');
    const answered = solve(initial);
    expect(answered.step).toBe('feedback');
    expect(answered.success).toBe(true);
    expect(answered.reason).toBeNull();
    expect(initial.selected).toBeNull();
    expect(submitAction(initial).step).toBe('action');
    expect(submitAction(initial).feedback).toContain('直接點選');
    expect(chooseReason(answered, 0)).toBe(answered);
    expect(submitReason(answered)).toBe(answered);
  });

  it('uses direct answers for every main and review question in both curricula', () => {
    for (const question of questions) {
      const session = reachSlot(question.levelId, question.slot);
      expect(requiresReason(session)).toBe(false);
      expect(solve(session)).toMatchObject({ step: 'feedback', success: true, reason: null });
    }
  });

  it('does not charge repeated clicks or dispatch the same successful attack twice', () => {
    const answered = solve(startSession(1, 'starter'));
    expect(battleHealth(answered).enemyHp).toBe(80);
    expect(submitAction(answered)).toBe(answered);
    expect(chooseAction(answered, 3)).toBe(answered);
    expect(demonstrate(answered)).toBe(answered);
    const wrongSession = startSession(1, 'starter');
    const wrong = submitAction(chooseAction(wrongSession, wrongIndex(wrongSession)));
    expect(wrong.retries).toBe(1);
    expect(wrong.shield).toBe(88);
    expect(submitAction(wrong)).toBe(wrong);
    expect(battleHealth(wrong).enemyHp).toBe(100);
  });

  it('keeps the player alive after repeated errors and records correction as supported', () => {
    let session = startSession(1, 'starter');
    for (let i = 0; i < 12; i++) {
      session = submitAction(chooseAction(session, wrongIndex(session)));
      expect(battleHealth(session).enemyHp).toBe(100);
      session = retryQuestion(session);
    }
    expect(session.shield).toBe(8);
    expect(session.retries).toBe(12);
    const next = advanceSession(solve(useHint(session)));
    expect(next.record).toMatchObject({ status: 'supported', hintUsed: true, retries: 12 });
    expect(next.session).toMatchObject({ shield: 8, repaired: 20, retries: 0, hintUsed: false });
  });

  it('preserves specific wrong-answer feedback when help is requested and clears only on retry', () => {
    const scene = startSession(1, 'starter');
    const wrong = submitAction(chooseAction(scene, wrongIndex(scene)));
    const hinted = useHint(wrong);
    expect(hinted.feedback).toBe(wrong.feedback);
    expect(hinted.hintUsed).toBe(true);
    expect(retryQuestion(hinted)).toMatchObject({ step: 'action', selected: null, feedback: '', retries: 1, hintUsed: true });
    expect(advanceSession(solve(retryQuestion(hinted))).record.status).toBe('supported');
  });

  it('records demonstration as practice, attacks once and resets assistance on the next item', () => {
    const demo = demonstrate(startSession(7, 'advanced'));
    expect(demo).toMatchObject({ step: 'feedback', success: true, reason: null, demoUsed: true });
    expect(demo.feedback).toContain('需要再練習');
    expect(battleHealth(demo).enemyHp).toBe(80);
    expect(demonstrate(demo)).toBe(demo);
    const next = advanceSession(demo);
    expect(next.record).toMatchObject({ status: 'practice', hintUsed: true });
    expect(next.record.retries).toBeGreaterThanOrEqual(2);
    expect(next.session).toMatchObject({ hintUsed: false, retries: 0, demoUsed: false });
  });

  it('retains a successful action for restoration until the learner continues', () => {
    const answered = solve(reachSlot(8, 4));
    expect(applySession(createProgress(), answered).active).toEqual(answered);
    expect(answered.records).toHaveLength(3);
    expect(battleHealth(answered).enemyHp).toBe(20);
  });

  it('finishes once, permits a fresh replay and rejects premature completion', () => {
    let session = startSession(1, 'starter');
    expect(() => finishSession(createProgress(), session)).toThrow('尚未完成');
    for (let i = 0; i < 4; i++) session = advanceSession(solve(session)).session!;
    session = solve(session);
    expect(advanceSession(session)).toMatchObject({ session: null, finished: true });
    const progress = finishSession(createProgress(), session);
    expect(progress.completed).toEqual([1]);
    expect(progress.attempts).toHaveLength(5);
    expect(progress.active).toBeNull();
    expect(finishSession(progress, session)).toBe(progress);
    expect(sessionSummary(progress.attempts)).toEqual({ first: 5, supported: 0, practice: 0, total: 5 });
    expect(startSession(1, 'starter').id).not.toBe(session.id);
  });

  it('uses only two variations in review and does not mark a main level complete', () => {
    let session = startSession(3, 'starter', true);
    expect(session.questionIds).toEqual(['V2L03Q06', 'V2L03Q07']);
    expect(battleHealth(solve(session)).enemyHp).toBe(50);
    session = advanceSession(solve(session)).session!;
    session = solve(session);
    expect(battleHealth(session).enemyHp).toBe(0);
    const progress = finishSession(createProgress(), session);
    expect(progress.completed).toEqual([]);
    expect(progress.attempts).toHaveLength(2);
  });

  it('preserves health between questions and reaches zero enemy health at the last success', () => {
    let session = startSession(12, 'advanced');
    for (let index = 0; index < 5; index++) {
      expect(battleHealth(session).enemyHp).toBe(100 - index * 20);
      const answered = solve(session);
      expect(battleHealth(answered)).toEqual({ playerHp: 100, enemyHp: 100 - (index + 1) * 20 });
      const next = advanceSession(answered);
      expect(next.finished).toBe(index === 4);
      if (next.session) {
        expect(battleHealth(next.session)).toEqual(battleHealth(answered));
        session = next.session;
      }
    }
  });

  it('rejects a forged successful session rather than recording a wrong answer', () => {
    const scene = startSession(1, 'starter');
    const forged = { ...scene, step: 'feedback' as const, success: true, selected: wrongIndex(scene) };
    expect(() => advanceSession(forged)).toThrow('完成目前題目');
    const wrongMode = { ...startSession(7, 'advanced'), mode: 'starter' as const };
    expect(() => currentQuestion(wrongMode)).toThrow('模式不符');
  });
});
