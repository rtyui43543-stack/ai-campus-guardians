import bank from './question-bank.json';
import legacyBank from './legacy-review-bank.json';
import { getLevel } from './levels';
import type { Mode, Question } from '../domain/types';

export type EditableQuestion = Omit<Question, 'advancedPrompt' | 'reasons' | 'valid' | 'animation'> & { correct: number[] };
/** Canonical editable source; game answers and teacher exports are derived from it. */
export const questionBank = bank;
const adaptQuestion = (q: EditableQuestion): Question => ({
  ...q,
  advancedPrompt: q.prompt,
  reasons: [{ text: q.explanation, feedback: q.explanation }],
  valid: Object.fromEntries(q.correct.map(answer => [answer, [0]])),
  animation: `theme-${q.themeId ?? getLevel(q.levelId).chapterId}`,
});
export const questions: Question[] = (bank.questions as EditableQuestion[]).map(adaptQuestion)
  .sort((a, b) => a.levelId - b.levelId || a.slot - b.slot);
/** Historical lookups only: these questions have no new-play or teacher-export entry. */
export const legacyReviewQuestions: Question[] = (legacyBank.questions as EditableQuestion[]).map(adaptQuestion)
  .sort((a, b) => a.levelId - b.levelId || a.slot - b.slot);
export const questionById = new Map([...questions, ...legacyReviewQuestions].map(q => [q.id, q]));
export const getQuestions = (levelId: number, review = false) =>
  (review ? legacyReviewQuestions : questions).filter(q => q.levelId === levelId);

/** Difficulty belongs to the mission; both modes answer directly in one step. */
export function presentQuestion(q: Question, _mode: Mode) {
  return { ...q, evidence: q.evidence ?? [] };
}
