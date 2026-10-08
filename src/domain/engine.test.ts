import { describe, expect, it } from 'vitest';
import { questions } from '../content';
import { levels } from '../content/levels';
import {
  advanceSession, applySession, battleHealth, chooseAction, chooseReason, createProgress, currentQuestion,
  demonstrate, finishSession, isDefeated, requiresReason, restartBattle, retryQuestion, sessionSummary, startSession,
  submitAction, submitReason, useHint,
} from './engine';
import type { Mode, Session } from './types';

function solve(session: Session, action?: number): Session {
  const q = currentQuestion(session);
  return submitAction(chooseAction(session, action ?? Number(Object.keys(q.valid)[0])));
}
function reachSlot(levelId: number, slot: number): Session {
  let session = startSession(levelId, 'starter');
  while (currentQuestion(session).slot < slot) session = advanceSession(solve(session)).session!;
  return session;
}
function wrongIndex(session: Session) {
  const q = currentQuestion(session);
  return q.choices.findIndex((_, index) => !q.valid[index]?.length);
}

describe('direct-answer battle engine', () => {
  it('binds each level to its actual curriculum rather than relabelling its difficulty', () => {
    expect(levels.filter(level => level.mode === 'starter' && !level.finalBoss)).toHaveLength(6);
    expect(levels.filter(level => level.mode === 'advanced' && !level.finalBoss)).toHaveLength(6);
    for (const level of levels.filter(level => !level.finalBoss)) {
      const requested: Mode = level.mode === 'starter' ? 'advanced' : 'starter';
      expect(startSession(level.id, requested).mode).toBe(level.mode);
    }
    expect(() => startSession(15, 'starter')).toThrow('找不到');
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

  it('uses direct answers for every ordinary main question in both curricula', () => {
    for (const question of questions.filter(q => !levels.find(level => level.id === q.levelId)?.finalBoss)) {
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

  it('permits correction below 8 HP and records it as supported before a lethal hit', () => {
    let session = startSession(1, 'starter');
    for (let i = 0; i < 8; i++) {
      session = submitAction(chooseAction(session, wrongIndex(session)));
      expect(battleHealth(session).enemyHp).toBe(100);
      expect(session.step).toBe('feedback');
      session = retryQuestion(session);
    }
    expect(session.shield).toBe(4);
    expect(session.retries).toBe(8);
    expect(isDefeated(session)).toBe(false);
    const next = advanceSession(solve(useHint(session)));
    expect(next.record).toMatchObject({ status: 'supported', hintUsed: true, retries: 8 });
    expect(next.session).toMatchObject({ shield: 4, repaired: 20, retries: 0, hintUsed: false });
  });

  it.each([[100, 88], [20, 8], [16, 4], [13, 1]])('subtracts 12 HP from %i without defeating a surviving player', (before, after) => {
    const session = { ...startSession(1, 'starter'), shield: before };
    const answered = submitAction(chooseAction(session, wrongIndex(session)));
    expect(answered).toMatchObject({ step: 'feedback', success: false, shield: after, retries: 1 });
    expect(isDefeated(answered)).toBe(false);
    expect(retryQuestion(answered).step).toBe('action');
  });

  it.each([12, 8, 4, 1])('clamps a lethal hit from %i HP to zero and keeps the wrong answer', before => {
    const session = { ...reachSlot(8, 3), shield: before };
    const selected = wrongIndex(session);
    const answered = submitAction(chooseAction(session, selected));
    expect(answered).toMatchObject({ step: 'defeat', success: false, shield: 0, selected, index: 2, retries: 1 });
    expect(answered.records).toEqual(session.records);
    expect(answered.questionIds).toEqual(session.questionIds);
    expect(answered.feedback).toBe(currentQuestion(session).choices[selected].feedback);
    expect(battleHealth(answered)).toEqual({ playerHp: 0, enemyHp: 60 });
    expect(isDefeated(answered)).toBe(true);
    expect(submitAction(answered)).toBe(answered);
    expect(chooseAction(answered, 0)).toBe(answered);
    expect(chooseReason(answered, 0)).toBe(answered);
    expect(submitReason(answered)).toBe(answered);
    expect(useHint(answered)).toBe(answered);
    expect(retryQuestion(answered)).toBe(answered);
    expect(demonstrate(answered)).toBe(answered);
    expect(() => advanceSession(answered)).toThrow('挑戰已結束');
    expect(() => finishSession(createProgress(), answered)).toThrow('挑戰已結束');
  });

  it('ends the ninth consecutive wrong answer instead of keeping the player at 8 HP', () => {
    let session = startSession(1, 'starter');
    for (let i = 0; i < 9; i++) {
      session = submitAction(chooseAction(session, wrongIndex(session)));
      if (i < 8) session = retryQuestion(session);
    }
    expect(session).toMatchObject({ step: 'defeat', shield: 0, retries: 9 });
  });

  it('restarts the same advanced challenge at full health without erasing existing progress', () => {
    let completedSession = startSession(1, 'starter');
    for (let i = 0; i < 4; i++) completedSession = advanceSession(solve(completedSession)).session!;
    const completed = finishSession(createProgress(), solve(completedSession));
    const prior = advanceSession(solve(startSession(8, 'advanced'))).session!;
    const depleted = { ...prior, shield: 8 };
    const defeated = submitAction(chooseAction(depleted, wrongIndex(depleted)));
    const original = applySession({ ...completed, settings: { ...completed.settings, music: false } }, defeated);
    const restarted = restartBattle(original);
    expect(restarted.active).toMatchObject({
      levelId: 8, mode: 'advanced', review: false, step: 'action', shield: 100,
      index: 0, repaired: 0, selected: null, feedback: '', retries: 0,
      hintUsed: false, demoUsed: false, records: [], success: false,
    });
    expect(battleHealth(restarted.active!)).toEqual({ playerHp: 100, enemyHp: 100 });
    expect(restarted.active!.id).not.toBe(defeated.id);
    expect(restarted.active!.questionIds).toEqual(defeated.questionIds);
    expect(restarted.completed).toEqual([1]);
    expect(restarted.attempts).toEqual(completed.attempts);
    expect(restarted.settings).toEqual(original.settings);
    expect(restarted.proposals).toEqual(original.proposals);
    expect(restarted.finishedSessionIds).toEqual(original.finishedSessionIds);
    expect(original.active).toBe(defeated);
    expect(original.active!.records).toHaveLength(1);
    expect(original.active!.shield).toBe(0);
    expect(() => restartBattle(createProgress())).toThrow('沒有可重新挑戰');
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
    expect(next.record).toMatchObject({ status: 'practice', hintUsed: true, demoUsed: true, retries: 0 });
    expect(next.session).toMatchObject({ hintUsed: false, retries: 0, demoUsed: false });
    expect(next.session).not.toHaveProperty('demoRetriesKnown');
  });

  it.each([0, 1, 3])('keeps the actual %i wrong answers when demonstration is used', retries => {
    const demo = demonstrate({ ...startSession(1, 'starter'), retries });
    expect(demo).toMatchObject({ demoUsed: true, demoRetriesKnown: true, retries });
    expect(advanceSession(demo).record).toMatchObject({ status: 'practice', demoUsed: true, retries });
  });

  it('retains a successful action for restoration until the learner continues', () => {
    const answered = solve(reachSlot(8, 4));
    expect(applySession(createProgress(), answered).active).toEqual(answered);
    expect(answered.records).toHaveLength(3);
    expect(battleHealth(answered).enemyHp).toBe(5);
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
    expect(progress.runs).toHaveLength(1);
    expect(progress.runs![0]).toMatchObject({ sessionId: session.id, levelId: 1, mode: 'starter', review: false });
    expect(progress.runs![0].records).toEqual(progress.attempts);
    expect(progress.active).toBeNull();
    expect(finishSession(progress, session)).toBe(progress);
    expect(finishSession({ ...progress, finishedSessionIds: [] }, session).runs).toHaveLength(1);
    expect(sessionSummary(progress.attempts)).toEqual({ first: 5, supported: 0, practice: 0, total: 5 });
    expect(startSession(1, 'starter').id).not.toBe(session.id);
  });

  it('rejects new two-question practice starts after the route is removed', () => {
    expect(() => startSession(3, 'starter', true)).toThrow('練習已移除');
    expect(() => startSession(8, 'advanced', true)).toThrow('練習已移除');
  });

  it('preserves health between questions and reaches zero enemy health at the last success', () => {
    let session = startSession(12, 'advanced');
    for (let index = 0; index < 5; index++) {
      expect(battleHealth(session).enemyHp).toBe(Math.max(0, 100 - index * 20 - (session.enemyBonusDamage ?? 0)));
      const answered = solve(session);
      expect(battleHealth(answered)).toEqual({ playerHp: 100, enemyHp: Math.max(0, 100 - (index + 1) * 20 - (answered.enemyBonusDamage ?? 0)) });
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
