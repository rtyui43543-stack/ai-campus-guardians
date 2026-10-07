import { getQuestions, presentQuestion, questionById } from '../content';
import { levels } from '../content/levels';
import type { AttemptRecord, LearningStatus, Mode, Progress, Session } from './types';

const now = () => new Date().toISOString();
const uniqueId = () => globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function createProgress(): Progress {
  return {
    schemaVersion: 2, completed: [], attempts: [], active: null, proposals: [],
    settings: { mode: 'starter', sound: true, music: true, narration: false, reducedMotion: false },
    finishedSessionIds: [], updatedAt: now(),
  };
}

export function startSession(levelId: number, mode: Mode, review = false): Session {
  if (mode !== 'starter' && mode !== 'advanced') throw new Error('請選擇有效的挑戰模式。');
  const level = levels.find(item => item.id === levelId);
  if (!level) throw new Error('找不到這個挑戰關卡。');
  const curriculumMode = level.mode;
  const questionIds = getQuestions(levelId, review).map(question => question.id);
  if (!questionIds.length) throw new Error('找不到這個挑戰關卡。');
  return {
    id: uniqueId(), levelId, mode: curriculumMode, review, questionIds, index: 0, step: 'action',
    selected: null, reason: null, retries: 0, hintUsed: false, demoUsed: false,
    feedback: '', success: false, shield: 100, repaired: 0, records: [],
  };
}

export function currentQuestion(session: Session) {
  const question = questionById.get(session.questionIds[session.index]);
  if (!question || question.levelId !== session.levelId) throw new Error('目前題目不存在，請重新開啟關卡。');
  if (levels.find(level => level.id === session.levelId)?.mode !== session.mode) throw new Error('關卡與初階或進階模式不符，請重新開啟關卡。');
  return presentQuestion(question, session.mode);
}

export function requiresReason(_session: Session): boolean {
  // Each option already includes the complete action; explanation follows the attack.
  return false;
}

export function battleHealth(session: Session): { playerHp: number; enemyHp: number } {
  const currentDamage = session.step === 'feedback' && session.success ? 100 / session.questionIds.length : 0;
  return { playerHp: session.shield, enemyHp: 100 - Math.min(100, session.repaired + currentDamage) };
}

export function isDefeated(session: Session): boolean {
  return session.step === 'defeat' || session.shield <= 0;
}

/** Start the same challenge again without erasing completed campaign progress. */
export function restartBattle(progress: Progress): Progress {
  if (!progress.active) throw new Error('沒有可重新挑戰的關卡。');
  const { levelId, mode, review } = progress.active;
  return applySession(progress, startSession(levelId, mode, review));
}

function validAction(session: Session, index: number | null): boolean {
  return index !== null && (currentQuestion(session).valid[index]?.length ?? 0) > 0;
}

export function chooseAction(session: Session, index: number): Session {
  if (isDefeated(session) || session.step !== 'action') return session;
  const question = currentQuestion(session);
  if (!Number.isInteger(index) || !question.choices[index]) return session;
  return { ...session, selected: index, reason: null, feedback: '', success: false };
}

function unsuccessful(session: Session, feedback: string): Session {
  const shield = Math.max(0, session.shield - 12);
  return { ...session, step: shield === 0 ? 'defeat' : 'feedback', success: false,
    feedback, retries: session.retries + 1, shield };
}

export function submitAction(session: Session): Session {
  if (isDefeated(session) || session.step !== 'action') return session;
  const question = currentQuestion(session);
  if (session.selected === null || !question.choices[session.selected]) return { ...session, feedback: '請直接點選一個答案。' };
  if (!validAction(session, session.selected)) return unsuccessful(session, question.choices[session.selected].feedback);
  return { ...session, step: 'feedback', feedback: `${question.choices[session.selected].feedback}\n${question.explanation}`, success: true };
}

export function chooseReason(session: Session, _index: number): Session {
  return session;
}

export function submitReason(session: Session): Session {
  return session;
}

export function useHint(session: Session): Session {
  if (isDefeated(session)) return session;
  if (session.step === 'feedback' && session.success) return session;
  if (session.step === 'feedback') return { ...session, hintUsed: true };
  return { ...session, hintUsed: true, feedback: `伙伴提示：${currentQuestion(session).hint}` };
}

export function retryQuestion(session: Session): Session {
  if (isDefeated(session) || session.step !== 'feedback' || session.success) return session;
  return {
    ...session, step: 'action', selected: null, reason: null,
    success: false, feedback: '',
  };
}

export function demonstrate(session: Session): Session {
  if (isDefeated(session)) return session;
  if (session.step === 'feedback' && session.success) return session;
  const question = currentQuestion(session);
  const selected = Number(Object.keys(question.valid)[0]);
  if (!question.choices[selected] || !question.valid[selected]?.length) throw new Error('題目尚未備妥可用的示範方案。');
  return {
    ...session, selected, reason: null,
    step: 'feedback', success: true, hintUsed: true, demoUsed: true,
    retries: Math.max(2, session.retries),
    feedback: `伙伴幫你想一想：\n${question.choices[selected].text}\n${question.explanation}\n這題記為「需要再練習」。等一下再試新題。`,
  };
}

function makeRecord(session: Session): AttemptRecord {
  if (isDefeated(session)) throw new Error('這場挑戰已結束，請重新挑戰同一關。');
  if (session.step !== 'feedback' || !session.success || session.selected === null || !validAction(session, session.selected) || session.reason !== null) throw new Error('請完成目前題目後再繼續。');
  const status: LearningStatus = session.demoUsed ? 'practice' : session.hintUsed || session.retries > 0 ? 'supported' : 'first';
  return {
    questionId: session.questionIds[session.index], mode: session.mode,
    action: session.selected, reason: session.reason, status,
    retries: session.retries, hintUsed: session.hintUsed, at: now(),
  };
}

export function advanceSession(session: Session): { session: Session | null; record: AttemptRecord; finished: boolean } {
  if (isDefeated(session)) throw new Error('這場挑戰已結束，請重新挑戰同一關。');
  if (session.records.length !== session.index) throw new Error('目前紀錄與題目順序不同，請重新載入存檔。');
  const record = makeRecord(session);
  const nextIndex = session.index + 1;
  if (nextIndex >= session.questionIds.length) return { session: null, record, finished: true };
  return {
    session: {
      ...session, index: nextIndex, step: 'action', selected: null, reason: null,
      success: false, retries: 0, hintUsed: false, demoUsed: false, feedback: '',
      records: [...session.records, record], repaired: Math.round(nextIndex / session.questionIds.length * 100),
    }, record, finished: false,
  };
}

export function applySession(progress: Progress, session: Session): Progress {
  return { ...progress, active: session, updatedAt: now() };
}

export function finishSession(progress: Progress, session: Session): Progress {
  if (isDefeated(session)) throw new Error('這場挑戰已結束，請重新挑戰同一關。');
  if (progress.finishedSessionIds?.includes(session.id)) return progress;
  if (session.index !== session.questionIds.length - 1 || session.records.length !== session.index) throw new Error('挑戰尚未完成，進度仍可繼續保存。');
  const record = makeRecord(session);
  const records = [...session.records, record];
  const completed = session.review ? [...progress.completed] : [...new Set([...progress.completed, session.levelId])].sort((a, b) => a - b);
  return {
    ...progress, active: null, completed, attempts: [...progress.attempts, ...records],
    finishedSessionIds: [...(progress.finishedSessionIds ?? []), session.id], updatedAt: now(),
  };
}

export function sessionSummary(value: Session | readonly AttemptRecord[]) {
  const records: readonly AttemptRecord[] = Array.isArray(value) ? value : (value as Session).records;
  const counts = { first: 0, supported: 0, practice: 0, total: records.length };
  for (const record of records) counts[record.status] += 1;
  return counts;
}
