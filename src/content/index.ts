import bank from './question-bank.json';
import { getLevel } from './levels';
import type { Mode, Question } from '../domain/types';

export type EditableQuestion = Omit<Question, 'advancedPrompt' | 'reasons' | 'valid' | 'animation'> & { correct: number[] };
/** Canonical editable source; game answers and teacher exports are derived from it. */
export const questionBank = bank;
export const questions: Question[] = (bank.questions as EditableQuestion[]).map(q => ({
  ...q,
  advancedPrompt: q.prompt,
  reasons: [{ text: q.explanation, feedback: q.explanation }],
  valid: Object.fromEntries(q.correct.map(answer => [answer, [0]])),
  animation: `theme-${getLevel(q.levelId).chapterId}`,
})).sort((a, b) => a.levelId - b.levelId || a.slot - b.slot);
export const questionById = new Map(questions.map(q => [q.id, q]));
export const getQuestions = (levelId: number, review = false) => questions.filter(q => q.levelId === levelId && (review ? q.slot > 5 : q.slot <= 5));

/** Difficulty belongs to the mission; both modes answer directly in one step. */
export function presentQuestion(q: Question, _mode: Mode) {
  return { ...q, evidence: q.evidence ?? [] };
}