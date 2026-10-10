import { afterEach, describe, expect, it, vi } from 'vitest';
import { getQuestions } from '../content';
import { levels } from '../content/levels';
import {
  advanceSession, applySession, chooseAction, createProgress, currentQuestion,
  demonstrate, restartBattle, retryQuestion, startFinalBossSession, startSession, submitAction, tickQuestion,
} from '../domain/engine';
import type { Mode, Session } from '../domain/types';
import { battleExplanation, battleVisibility } from './battleVisibility';

const allVisible = { hideQuestion: false, hideAnswers: false, hideControls: false };
const questionHidden = { hideQuestion: true, hideAnswers: false, hideControls: false };
const ultimateCasting = { hideQuestion: true, hideAnswers: true, hideControls: true };
const ultimateFinished = { hideQuestion: true, hideAnswers: true, hideControls: false };

afterEach(() => vi.restoreAllMocks());

function answer(session: Session, correct = true): Session {
  const question = currentQuestion(session);
  const index = question.choices.findIndex((_, choice) => Boolean(question.valid[choice]?.length) === correct);
  expect(index).toBeGreaterThanOrEqual(0);
  return submitAction(chooseAction(session, index));
}

function charge(session: Session): Session {
  for (let index = 0; index < 3; index++) session = advanceSession(answer(session)).session!;
  expect(session).toMatchObject({ step: 'action', energy: 3, ultimateUsed: false });
  return session;
}

function unlocked(mode: Mode) {
  const progress = createProgress();
  progress.ultimateCards = Array.from({ length: 6 }, (_, index) => ({
    ultimateId: index + 1, unlockedAt: progress.updatedAt, sessionId: `earned-${mode}-${index + 1}`,
    questionId: getQuestions(index + 1 + (mode === 'advanced' ? 6 : 0))[3].id,
  }));
  return progress;
}

describe('battle text across actual answer and combat transitions', () => {
  it.each(['starter', 'advanced'] as const)('offers %s short feedback only after an ordinary cast, while leaving the large question hidden', mode => {
    const initial = startSession(mode === 'starter' ? 1 : 7, mode);
    expect(battleExplanation(initial, false)).toBeNull();
    const wrong = answer(initial, false);
    expect(battleExplanation(wrong, true)).toBeNull();
    const explanation = battleExplanation(wrong, false)!;
    expect(explanation).toMatchObject({ title: '再想一下', text: currentQuestion(wrong).choices[wrong.selected!].feedback,
      audioKey: `${wrong.questionIds[0]}.${mode}.choice.${wrong.selected}` });
    expect(battleVisibility(wrong, false).hideQuestion).toBe(true);
    expect(battleExplanation(retryQuestion(wrong), false)).toBeNull();
    const correct = answer(retryQuestion(wrong));
    expect(battleExplanation(correct, false)).toMatchObject({ title: '答對的原因', text: currentQuestion(correct).explanation,
      audioKey: `${correct.questionIds[0]}.${mode}.explanation` });
    expect(battleExplanation(advanceSession(correct).session!, false)).toBeNull();
  });

  it('distinguishes partner demonstrations from timeout auto-advance and exposes the demonstrated action and explanation', () => {
    const demo = demonstrate(answer(startSession(1, 'starter'), false));
    const question = currentQuestion(demo);
    expect(battleExplanation(demo, true)).toBeNull();
    expect(battleExplanation(demo, false)).toMatchObject({ title: '伙伴示範解說',
      text: `正確做法：${question.choices[demo.selected!].text}\n${question.explanation}`, audioKey: `${question.id}.starter.explanation` });
    const expired = tickQuestion(startSession(7, 'advanced'), 30_000);
    expect(battleExplanation(expired, false)).toBeNull();
  });

  it('offers a post-ultimate explanation without revealing either old question or choices', () => {
    const cast = answer(charge(startSession(5, 'starter')));
    expect(battleExplanation(cast, true)).toBeNull();
    expect(battleExplanation(cast, false)?.title).toBe('答對的原因');
    expect(battleVisibility(cast, false)).toEqual(ultimateFinished);
  });

  it('does not hide navigation when there is no active battle', () => {
    expect(battleVisibility(null, false)).toEqual(allVisible);
  });

  it.each(['starter', 'advanced'] as const)('keeps %s choices through a normal hit and restores the question only on advance', mode => {
    const initial = startSession(mode === 'starter' ? 1 : 7, mode);
    expect(battleVisibility(initial, false)).toEqual(allVisible);

    const resolved = answer(initial);
    expect(resolved).toMatchObject({ step: 'feedback', success: true, ultimateUsed: false });
    expect(battleVisibility(resolved, true)).toEqual(questionHidden);
    // Either the normal or reduced-motion timer can end while this question is still resolved.
    expect(battleVisibility(resolved, false)).toEqual(questionHidden);

    const next = advanceSession(resolved).session!;
    expect(next.index).toBe(initial.index + 1);
    expect(battleVisibility(next, false)).toEqual(allVisible);
  });

  it.each(['starter', 'advanced'] as const)('keeps %s choices through a normal counterattack and restores the question on retry', mode => {
    const initial = startSession(mode === 'starter' ? 1 : 7, mode);
    const wrong = answer(initial, false);
    expect(wrong).toMatchObject({ step: 'feedback', success: false, lastEnemyCritical: false });
    expect(battleVisibility(wrong, true)).toEqual(questionHidden);
    expect(battleVisibility(wrong, false)).toEqual(questionHidden);

    const retry = retryQuestion(wrong);
    expect(retry.index).toBe(initial.index);
    expect(battleVisibility(retry, false)).toEqual(allVisible);
  });

  it.each(levels.filter(level => !level.finalBoss))('hides both panels for the $mode chapter $chapterId ultimate and returns Next after the cast', level => {
    const ready = charge(startSession(level.id, level.mode));
    // Full energy alone must not hide a question the player still needs to answer.
    expect(battleVisibility(ready, false)).toEqual(allVisible);

    const cast = answer(ready);
    expect(cast).toMatchObject({ step: 'feedback', success: true, ultimateUsed: true, ultimateId: level.chapterId });
    expect(battleVisibility(cast, true)).toEqual(ultimateCasting);
    // This is also the state after the shorter reduced-motion timer, or a saved resolved cast.
    // Next must be usable, while the old question and choices remain hidden.
    expect(battleVisibility(cast, false)).toEqual(ultimateFinished);

    const next = advanceSession(cast).session!;
    expect(next.index).toBe(cast.index + 1);
    expect(battleVisibility(next, false)).toEqual(allVisible);
  });

  it.each(['starter', 'advanced'] as const)('keeps choices visible when a %s mirror guard makes an ordinary enemy attack miss', mode => {
    const mirrorCast = answer(charge(startSession(mode === 'starter' ? 4 : 10, mode)));
    const next = advanceSession(mirrorCast).session!;
    expect(next.mirrorGuard).toBe(true);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const missed = answer(next, false);
    expect(missed).toMatchObject({ lastEnemyMissed: true, lastEnemyCritical: false, ultimateUsed: false });
    expect(battleVisibility(missed, true)).toEqual(questionHidden);
    expect(battleVisibility(missed, false)).toEqual(questionHidden);
    expect(battleVisibility(retryQuestion(missed), false)).toEqual(allVisible);
  });

  it.each(['starter', 'advanced'] as const)('clears both panels for a %s boss ultimate, then restores Retry without revealing old choices', mode => {
    const initial = startFinalBossSession(unlocked(mode), mode);
    const firstWrong = answer(initial, false);
    expect(battleVisibility(firstWrong, true)).toEqual(questionHidden);

    const critical = answer(retryQuestion(firstWrong), false);
    expect(critical).toMatchObject({ step: 'feedback', lastEnemyCritical: true, ultimateUsed: false });
    expect(battleVisibility(critical, true)).toEqual(ultimateCasting);
    expect(battleVisibility(critical, false)).toEqual(ultimateFinished);

    const retry = retryQuestion(critical);
    expect(battleVisibility(retry, false)).toEqual(allVisible);
    const corrected = answer(retry);
    expect(battleVisibility(corrected, true)).toEqual(questionHidden);
  });

  it('keeps the question hidden through the post-timeout gap and restores all text on automatic advance', () => {
    const expired = tickQuestion(startSession(7, 'advanced'), 30_000);
    expect(expired).toMatchObject({ step: 'feedback', timedOut: true, lastEnemyCritical: false });
    expect(battleVisibility(expired, true)).toEqual(questionHidden);
    expect(battleVisibility(expired, false)).toEqual(questionHidden);
    const next = advanceSession(expired).session!;
    expect(next.index).toBe(1);
    expect(battleVisibility(next, false)).toEqual(allVisible);
  });

  it.each(['starter', 'advanced'] as const)('keeps a defeated %s boss battle clear and restores the restarted challenge', mode => {
    const progress = unlocked(mode);
    let session = startFinalBossSession(progress, mode);
    for (let mistakes = 0; mistakes < 4; mistakes++) session = answer(retryQuestion(session), false);
    expect(session).toMatchObject({ step: 'defeat', shield: 0, lastEnemyCritical: true });
    expect(battleVisibility(session, true)).toEqual(ultimateCasting);
    expect(battleVisibility(session, false)).toEqual(ultimateFinished);

    const restarted = restartBattle(applySession(progress, session)).active!;
    expect(restarted).toMatchObject({ step: 'action', index: 0, shield: 100 });
    expect(battleVisibility(restarted, false)).toEqual(allVisible);
  });
});
