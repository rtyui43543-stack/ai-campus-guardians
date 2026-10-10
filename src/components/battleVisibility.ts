import type { Session } from '../domain/types';
import { presentQuestion, questionById } from '../content';

/** Keep a resolved question clear until advancing or retrying, even after the animation ends. */
export function battleVisibility(session: Session | null, animating: boolean) {
  const hideQuestion = !!session && (animating || session.step !== 'action');
  const hideAnswers = hideQuestion && !!(session?.ultimateUsed || session?.lastEnemyCritical);
  // Navigation must return after the cast so players can reveal the next question.
  return { hideQuestion, hideAnswers, hideControls: hideAnswers && animating };
}

/** Offer immediate learning feedback without reopening the large question panel. */
export function battleExplanation(session: Session | null, animating: boolean) {
  if (!session || animating || session.step !== 'feedback' || session.timedOut || session.selected === null) return null;
  const question = questionById.get(session.questionIds[session.index]);
  if (!question) return null;
  const presented = presentQuestion(question, session.mode);
  const choice = presented.choices[session.selected];
  if (!choice) return null;
  const prefix = question.id + '.' + session.mode;
  if (session.demoUsed) return { title: '伙伴示範解說', text: `正確做法：${choice.text}\n${presented.explanation}`, audioKey: prefix + '.explanation' };
  if (session.success) return { title: '答對的原因', text: presented.explanation, audioKey: prefix + '.explanation' };
  return { title: '再想一下', text: choice.feedback, audioKey: prefix + '.choice.' + session.selected };
}
