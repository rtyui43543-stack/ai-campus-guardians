import { getQuestions, presentQuestion, questionById } from '../content';
import { levels } from '../content/levels';
import { getUltimateCardKey, getUltimateSpell } from '../content/ultimateSpells';
import { reconstructRuns } from './scoring';
import { battleEnemyMaxHp, initialEnemyHp } from './battleHealth';
import type { AttemptRecord, LearningStatus, Mode, Progress, Session } from './types';

export const QUESTION_TIME_MS = 30_000;
export const ULTIMATE_BONUS_POINTS = 10;

const now = () => new Date().toISOString();
const uniqueId = () => globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function createProgress(): Progress {
  return {
    schemaVersion: 2, completed: [], attempts: [], active: null, proposals: [],
    settings: { mode: 'starter', sound: true, music: true, narration: false, reducedMotion: false },
    finishedSessionIds: [], runs: [], ultimateCards: [], updatedAt: now(),
  };
}

export function finalBossUnlocked(progress: Pick<Progress, 'ultimateCards'>, mode: Mode): boolean {
  if (mode !== 'starter' && mode !== 'advanced') return false;
  const keys = new Set((progress.ultimateCards ?? []).map(getUltimateCardKey));
  return Array.from({ length: 6 }, (_, index) => `${mode}:${index + 1}`).every(key => keys.has(key));
}

export function startFinalBossSession(progress: Progress, mode: Mode): Session {
  return startSession(mode === 'advanced' ? 14 : 13, mode, false, progress);
}

export function startSession(levelId: number, mode: Mode, review = false, progress?: Progress): Session {
  if (mode !== 'starter' && mode !== 'advanced') throw new Error('請選擇有效的挑戰模式。');
  if (review) throw new Error('兩題新情境練習已移除，請選擇正式關卡。');
  const level = levels.find(item => item.id === levelId);
  if (!level) throw new Error('找不到這個挑戰關卡。');
  const curriculumMode = level.mode;
  if (level.finalBoss && (!progress || !finalBossUnlocked(progress, curriculumMode))) throw new Error('先解鎖這個等級的六張必殺技收藏卡，才能挑戰最終魔王。');
  const questionIds = getQuestions(levelId, review).map(question => question.id);
  if (!questionIds.length) throw new Error('找不到這個挑戰關卡。');
  return {
    id: uniqueId(), levelId, mode: curriculumMode, review, questionIds, index: 0, step: 'action',
    ...(level.finalBoss ? { enemyMaxHp: initialEnemyHp(levelId) } : {}),
    selected: null, reason: null, retries: 0, hintUsed: false, demoUsed: false,
    feedback: '', success: false, shield: 100, repaired: 0, records: [],
    energy: 0, ultimateUsed: false, barrier: false, barrierCharges: 0, bonusPoints: 0, enemyBonusDamage: 0,
    timed: curriculumMode === 'advanced' && !review,
    remainingMs: QUESTION_TIME_MS, elapsedMs: 0, timedOut: false, preventedDamage: false,
    combatRulesVersion: 2, wrongStreak: 0, enemyBurning: false, enemyBurnDamage: 0,
    playerRegeneration: false, frostGuard: false, mirrorGuard: false,
    lightningHintQueued: false, lightningHintChoices: [], lastEnemyDamage: 0,
    lastEnemyCritical: false, lastEnemyMissed: false, lastTurnBurnDamage: 0, lastTurnHealing: 0,
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
  const finalBoss = levels.find(level => level.id === session.levelId)?.finalBoss;
  const enemyMaxHp = battleEnemyMaxHp(session);
  const currentDamage = session.step === 'feedback' && session.success ? finalBoss ? 20 : 100 / session.questionIds.length : 0;
  return { playerHp: session.shield, enemyHp: Math.max(0, enemyMaxHp - session.repaired - currentDamage - (session.enemyBonusDamage ?? 0) - (session.enemyBurnDamage ?? 0)) };
}

export function isDefeated(session: Session): boolean {
  return session.step === 'defeat' || session.shield <= 0;
}

/** A legacy enabled shield keeps its original one-hit protection when resumed. */
export function remainingBarrierCharges(session: Pick<Session, 'barrier' | 'barrierCharges'>): number {
  return session.barrierCharges ?? (session.barrier ? 1 : 0);
}

/** Mirror consumes its one chance; ice and castle charges are spent only on a hit. */
function enemyAttack(session: Session, consecutiveWrong: boolean): Partial<Session> & Pick<Session, 'shield'> {
  const finalBoss = levels.find(level => level.id === session.levelId)?.finalBoss === true;
  const wrongStreak = consecutiveWrong ? (session.wrongStreak ?? 0) + 1 : 0;
  const lastEnemyCritical = finalBoss && consecutiveWrong && wrongStreak >= 2;
  const rawDamage = (finalBoss ? 20 : 12) + (lastEnemyCritical ? 10 : 0);
  const lastEnemyMissed = session.mirrorGuard === true && Math.random() < 0.5;
  if (lastEnemyMissed) return { combatRulesVersion: 2, wrongStreak, mirrorGuard: false,
    shield: session.shield, preventedDamage: true, lastEnemyDamage: 0, lastEnemyCritical, lastEnemyMissed: true };
  const afterIce = session.frostGuard ? Math.ceil(rawDamage / 2) : rawDamage;
  const charges = remainingBarrierCharges(session);
  const calculatedDamage = Math.max(0, afterIce - (charges > 0 ? 12 : 0));
  const damage = Math.min(session.shield, calculatedDamage);
  const barrierCharges = Math.max(0, charges - 1);
  return { combatRulesVersion: 2, wrongStreak, mirrorGuard: false, frostGuard: false,
    shield: Math.max(0, session.shield - damage), barrier: barrierCharges > 0, barrierCharges,
    preventedDamage: calculatedDamage < rawDamage, lastEnemyDamage: damage, lastEnemyCritical, lastEnemyMissed: false };
}

/** A turn ends only on a completed question; retries never duplicate status ticks. */
function settleTurn(updated: Session, before: Session): Session {
  if (updated.resolvedTurnIndex === updated.index) return updated;
  const lastTurnBurnDamage = before.enemyBurning && updated.shield > 0 ? 4 : 0;
  const lastTurnHealing = before.playerRegeneration && updated.shield > 0 ? Math.min(4, 100 - updated.shield) : 0;
  return { ...updated, combatRulesVersion: 2, resolvedTurnIndex: updated.index,
    enemyBurnDamage: (updated.enemyBurnDamage ?? 0) + lastTurnBurnDamage,
    shield: updated.shield + lastTurnHealing, lastTurnBurnDamage, lastTurnHealing };
}

function attackFeedback(attack: Partial<Session>, timedOut = false): string {
  const prefix = timedOut ? '時間到了！' : '';
  if (attack.lastEnemyMissed) return `${prefix}鏡界讓魔王這次攻擊落空，沒有損失 HP。`;
  const critical = attack.lastEnemyCritical ? '連續答錯，魔王施放必殺技！' : '魔王攻擊！';
  const defense = attack.preventedDamage ? '寒冰／城堡減輕了傷害，' : '';
  return `${prefix}${critical}${defense}扣 ${attack.lastEnemyDamage} HP。`;
}

/** Start the same challenge again without erasing completed campaign progress. */
export function restartBattle(progress: Progress): Progress {
  if (!progress.active) throw new Error('沒有可重新挑戰的關卡。');
  const { levelId, mode, review } = progress.active;
  return applySession(progress, startSession(levelId, mode, review, progress));
}

/** Choosing does not spend energy; the next independently correct answer casts it. */
export function selectUltimate(session: Session, id: number): Session {
  if (!levels.find(level => level.id === session.levelId)?.finalBoss || session.step !== 'action' || isDefeated(session)
    || session.energy !== 3 || !Number.isInteger(id) || !getUltimateSpell(id, session.mode)) return session;
  return { ...session, preparedUltimateId: id };
}

function validAction(session: Session, index: number | null): boolean {
  return index !== null && (currentQuestion(session).valid[index]?.length ?? 0) > 0;
}

export function chooseAction(session: Session, index: number): Session {
  if (isDefeated(session) || session.step !== 'action') return session;
  if (session.timed && (session.remainingMs ?? QUESTION_TIME_MS) <= 0) return expireQuestion(session);
  const question = currentQuestion(session);
  if (!Number.isInteger(index) || !question.choices[index]) return session;
  return { ...session, selected: index, reason: null, feedback: '', success: false };
}

function unsuccessful(session: Session, feedback: string): Session {
  const attack = enemyAttack(session, true);
  const { shield } = attack;
  return { ...session, step: shield === 0 ? 'defeat' : 'feedback', success: false,
    feedback: `${feedback}\n${attackFeedback(attack)}`, retries: session.retries + 1, ...attack,
    // A wrong answer damages HP but keeps earned energy, including a prepared ultimate.
    energy: session.review ? 0 : (session.energy ?? 0),
    ultimateUsed: false, ultimateId: undefined };
}

/** Pure countdown: the UI supplies elapsed foreground answering time, never a wall-clock date. */
export function tickQuestion(session: Session, elapsedMsDelta: number): Session {
  if (!session.timed || session.step !== 'action' || isDefeated(session) || session.timedOut) return session;
  if (!Number.isFinite(elapsedMsDelta) || elapsedMsDelta <= 0) return session;
  const elapsedMs = Math.min(QUESTION_TIME_MS, (session.elapsedMs ?? 0) + Math.floor(elapsedMsDelta));
  const remainingMs = Math.max(0, QUESTION_TIME_MS - elapsedMs);
  const updated = { ...session, elapsedMs, remainingMs };
  return remainingMs === 0 ? expireQuestion(updated) : updated;
}

/** Expiration is idempotent and prevents a late answer from racing a zero-second timer. */
export function expireQuestion(session: Session): Session {
  if (!session.timed || session.step !== 'action' || isDefeated(session) || session.timedOut) return session;
  const attack = enemyAttack(session, false);
  const { shield } = attack;
  return settleTurn({
    ...session, step: shield === 0 ? 'defeat' : 'feedback', selected: null, reason: null,
    success: false, timedOut: true, elapsedMs: QUESTION_TIME_MS, remainingMs: 0,
    energy: session.review ? 0 : Math.max(0, (session.energy ?? 0) - 1), ...attack,
    ultimateUsed: false, ultimateId: undefined, preparedUltimateId: undefined, shield,
    feedback: `${attackFeedback(attack, true)}這題記為超時，下一題再試。`,
  }, session);
}

function successful(session: Session, feedback: string): Session {
  const prepared = (session.energy ?? 0) === 3 && !session.review;
  if (!prepared) return settleTurn({ ...session, step: 'feedback', feedback, success: true, wrongStreak: 0,
    energy: session.review ? 0 : Math.min(3, (session.energy ?? 0) + 1), ultimateUsed: false,
    ultimateId: undefined, preventedDamage: false, lastEnemyDamage: 0, lastEnemyCritical: false, lastEnemyMissed: false }, session);
  const level = levels.find(level => level.id === session.levelId)!;
  const ultimateId = level.finalBoss ? session.preparedUltimateId! : level.chapterId;
  const spell = getUltimateSpell(ultimateId, session.mode)!;
  const defensive = ultimateId === 1;
  const recovery = ultimateId === 3;
  const barrierCharges = defensive ? session.mode === 'advanced' ? 2 : 1 : remainingBarrierCharges(session);
  return settleTurn({
    ...session, step: 'feedback', feedback, success: true, energy: 0, ultimateUsed: true, ultimateId, preparedUltimateId: undefined,
    bonusPoints: (session.bonusPoints ?? 0) + ULTIMATE_BONUS_POINTS,
    barrier: barrierCharges > 0, barrierCharges,
    shield: recovery ? Math.min(100, session.shield + (session.mode === 'advanced' ? 24 : 12)) : session.shield,
    enemyBonusDamage: (session.enemyBonusDamage ?? 0) + spell.extraDamage,
    wrongStreak: 0, enemyBurning: ultimateId === 5 || session.enemyBurning === true,
    playerRegeneration: recovery || session.playerRegeneration === true,
    frostGuard: ultimateId === 6 || session.frostGuard === true,
    mirrorGuard: ultimateId === 4 || session.mirrorGuard === true,
    lightningHintQueued: ultimateId === 2 || session.lightningHintQueued === true,
    preventedDamage: false, lastEnemyDamage: 0, lastEnemyCritical: false, lastEnemyMissed: false,
  }, session);
}

export function submitAction(session: Session): Session {
  if (isDefeated(session) || session.step !== 'action') return session;
  if (session.timed && (session.remainingMs ?? QUESTION_TIME_MS) <= 0) return expireQuestion(session);
  if (levels.find(level => level.id === session.levelId)?.finalBoss && session.energy === 3 && !getUltimateSpell(session.preparedUltimateId ?? 0, session.mode)) {
    return { ...session, feedback: '能量已滿！請先選擇一種必殺技，再回答下一題。' };
  }
  const question = currentQuestion(session);
  if (session.selected === null || !question.choices[session.selected]) return { ...session, feedback: '請直接點選一個答案。' };
  if (!validAction(session, session.selected)) return unsuccessful(session, question.choices[session.selected].feedback);
  return successful(session, `${question.choices[session.selected].feedback}\n${question.explanation}`);
}

export function chooseReason(session: Session, _index: number): Session {
  return session;
}

export function submitReason(session: Session): Session {
  return session;
}

export function useHint(session: Session): Session {
  if (isDefeated(session) || session.timedOut) return session;
  if (session.step === 'feedback' && session.success) return session;
  if (session.step === 'feedback') return { ...session, hintUsed: true };
  return { ...session, hintUsed: true, feedback: `伙伴提示：${currentQuestion(session).hint}` };
}

export function retryQuestion(session: Session): Session {
  if (isDefeated(session) || session.step !== 'feedback' || session.success || session.timedOut) return session;
  return {
    ...session, step: 'action', selected: null, reason: null,
    success: false, feedback: '', preventedDamage: false,
    lastEnemyDamage: 0, lastEnemyCritical: false, lastEnemyMissed: false,
  };
}

export function demonstrate(session: Session): Session {
  if (isDefeated(session) || session.timedOut) return session;
  if (session.timed && session.step === 'action' && (session.remainingMs ?? QUESTION_TIME_MS) <= 0) return expireQuestion(session);
  if (session.step === 'feedback' && session.success) return session;
  const question = currentQuestion(session);
  const selected = Number(Object.keys(question.valid)[0]);
  if (!question.choices[selected] || !question.valid[selected]?.length) throw new Error('題目尚未備妥可用的示範方案。');
  return settleTurn({
    ...session, selected, reason: null,
    step: 'feedback', success: true, hintUsed: true, demoUsed: true,
    ...(session.review ? { energy: 0 } : {}),
    ultimateUsed: false, ultimateId: undefined, preventedDamage: false,
    wrongStreak: 0, lastEnemyDamage: 0, lastEnemyCritical: false, lastEnemyMissed: false,
    demoRetriesKnown: true,
    feedback: `伙伴幫你想一想：\n${question.choices[selected].text}\n${question.explanation}\n這題記為「需要再練習」。等一下再試新題。`,
  }, session);
}

function makeRecord(session: Session): AttemptRecord {
  if (isDefeated(session)) throw new Error('這場挑戰已結束，請重新挑戰同一關。');
  const expired = session.timedOut === true && session.timed === true && !session.success && session.selected === null && session.remainingMs === 0;
  if (session.step !== 'feedback' || session.reason !== null || (!expired && (!session.success || session.selected === null || !validAction(session, session.selected)))) throw new Error('請完成目前題目後再繼續。');
  const status: LearningStatus = expired ? 'timeout' : session.demoUsed ? 'practice' : session.hintUsed || session.retries > 0 ? 'supported' : 'first';
  return {
    questionId: session.questionIds[session.index], mode: session.mode,
    action: session.selected, reason: session.reason, status,
    retries: session.retries, hintUsed: session.hintUsed, at: now(),
    ...(session.enemyMaxHp === undefined ? {} : { enemyMaxHp: session.enemyMaxHp }),
    ...(session.demoUsed && session.demoRetriesKnown ? { demoUsed: true } : {}),
    ...(session.timed ? { timed: true, elapsedMs: session.elapsedMs ?? 0, timedOut: expired } : {}),
    ...(session.ultimateUsed ? { ultimateUsed: true, ultimateId: session.ultimateId } : {}),
    ...(session.preventedDamage ? { preventedDamage: true } : {}),
    ...(session.combatRulesVersion === 2 ? { combatRulesVersion: 2 as const,
      turnBurnDamage: session.lastTurnBurnDamage ?? 0, turnHealing: session.lastTurnHealing ?? 0 } : {}),
  };
}

export function advanceSession(session: Session): { session: Session | null; record: AttemptRecord; finished: boolean } {
  if (isDefeated(session)) throw new Error('這場挑戰已結束，請重新挑戰同一關。');
  if (session.records.length !== session.index) throw new Error('目前紀錄與題目順序不同，請重新載入存檔。');
  const record = makeRecord(session);
  const nextIndex = session.index + 1;
  const finalBoss = levels.find(level => level.id === session.levelId)?.finalBoss;
  if (nextIndex >= session.questionIds.length || finalBoss && battleHealth(session).enemyHp === 0) return { session: null, record, finished: true };
  const nextSession: Session = {
    ...session, index: nextIndex, step: 'action', selected: null, reason: null,
    success: false, retries: 0, hintUsed: false, demoUsed: false, feedback: '',
    records: [...session.records, record],
    repaired: finalBoss ? [...session.records, record].filter(item => item.status !== 'timeout').length * 20
      : Math.round([...session.records, record].filter(item => item.status !== 'timeout').length / session.questionIds.length * 100),
    ultimateUsed: false, ultimateId: undefined, timedOut: false, preventedDamage: false,
    elapsedMs: 0, remainingMs: QUESTION_TIME_MS,
    lastEnemyDamage: 0, lastEnemyCritical: false, lastEnemyMissed: false,
    lastTurnBurnDamage: 0, lastTurnHealing: 0, lightningHintChoices: [], lightningHintQueued: false,
  };
  if (session.lightningHintQueued) {
    const nextQuestion = currentQuestion(nextSession);
    const correct = Number(Object.keys(nextQuestion.valid)[0]);
    const incorrect = nextQuestion.choices.findIndex((_, index) => !nextQuestion.valid[index]?.length);
    const other = incorrect >= 0 ? incorrect : nextQuestion.choices.findIndex((_, index) => index !== correct);
    nextSession.lightningHintChoices = [correct, other].sort((a, b) => a - b);
  }
  delete nextSession.resolvedTurnIndex;
  delete nextSession.demoRetriesKnown;
  return {
    session: nextSession, record, finished: false,
  };
}

export function applySession(progress: Progress, session: Session): Progress {
  const at = now();
  return { ...progress, active: session, ultimateCards: unlockCards(progress, session, at), updatedAt: at };
}

function unlockCards(progress: Progress, session: Session, at: string) {
  const cards = [...(progress.ultimateCards ?? [])];
  const releases = session.records.filter(record => record.ultimateUsed).map(record => ({ ultimateId: record.ultimateId!, questionId: record.questionId }));
  if (session.ultimateUsed && session.ultimateId) releases.push({ ultimateId: session.ultimateId, questionId: session.questionIds[session.index] });
  for (const release of releases) {
    if (!cards.some(card => getUltimateCardKey(card) === getUltimateCardKey(release))) cards.push({ ...release, sessionId: session.id, unlockedAt: at });
  }
  return cards.sort((a, b) => a.ultimateId - b.ultimateId || getUltimateCardKey(b).localeCompare(getUltimateCardKey(a)));
}

export function finishSession(progress: Progress, session: Session): Progress {
  if (isDefeated(session)) throw new Error('這場挑戰已結束，請重新挑戰同一關。');
  if (progress.finishedSessionIds?.includes(session.id) || progress.runs?.some(run => run.sessionId === session.id)) return progress;
  const finalBoss = levels.find(level => level.id === session.levelId)?.finalBoss;
  if ((!finalBoss || battleHealth(session).enemyHp > 0) && session.index !== session.questionIds.length - 1 || session.records.length !== session.index) throw new Error('挑戰尚未完成，進度仍可繼續保存。');
  const record = makeRecord(session);
  const records = [...session.records, record];
  const passed = finalBoss ? battleHealth(session).enemyHp === 0 : !records.some(item => item.status === 'timeout');
  const completed = session.review || !passed ? [...progress.completed] : [...new Set([...progress.completed, session.levelId])].sort((a, b) => a - b);
  const at = now();
  return {
    ...progress, active: null, completed, attempts: [...progress.attempts, ...records],
    runs: [...(progress.runs ?? reconstructRuns(progress.attempts)), {
      sessionId: session.id, levelId: session.levelId, mode: session.mode, review: session.review, records, at, passed,
      ...(session.enemyMaxHp === undefined ? {} : { enemyMaxHp: session.enemyMaxHp }),
    }],
    ultimateCards: unlockCards(progress, session, at),
    finishedSessionIds: [...(progress.finishedSessionIds ?? []), session.id], updatedAt: at,
  };
}

export function sessionSummary(value: Session | readonly AttemptRecord[]) {
  const records: readonly AttemptRecord[] = Array.isArray(value) ? value : (value as Session).records;
  const counts = { first: 0, supported: 0, practice: 0, total: records.length };
  for (const record of records) if (record.status !== 'timeout') counts[record.status] += 1;
  const timeouts = records.filter(record => record.status === 'timeout').length;
  return timeouts ? { ...counts, timeout: timeouts } : counts;
}
