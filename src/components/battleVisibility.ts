import type { Session } from '../domain/types';

/** Keep a resolved question clear until advancing or retrying, even after the animation ends. */
export function battleVisibility(session: Session | null, animating: boolean) {
  const hideQuestion = !!session && (animating || session.step !== 'action');
  const hideAnswers = hideQuestion && !!(session?.ultimateUsed || session?.lastEnemyCritical);
  // Navigation must return after the cast so players can reveal the next question.
  return { hideQuestion, hideAnswers, hideControls: hideAnswers && animating };
}
