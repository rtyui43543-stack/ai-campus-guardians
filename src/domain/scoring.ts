import { getQuestions, getQuestionsForHistory, questionById } from '../content';
import { levels } from '../content/levels';
import { getUltimateSpell } from '../content/ultimateSpells';
import { battleEnemyMaxHp } from './battleHealth';
import type { AttemptRecord, CompletedRun, Progress, Session } from './types';

export interface ScoredRow { record: AttemptRecord; points: number; maxPoints: number; bonusPoints: number; timeLimitPoints: number }
export interface SessionScore {
  score: number; maxScore: 100; firstTryCorrect: number; wrongAnswers: number;
  hints: number; demos: number; perfect: boolean; questionCount: number;
  /** Old demo records may have an artificial minimum of two wrong answers. */
  unknownWrongAnswers: number;
  bonusScore: number; totalScore: number; timeouts: number; ultimateUses: number;
  rows: ScoredRow[];
}

const rounded = (value: number) => Math.round(value * 100) / 100;
const unknownDemoRetries = (record: AttemptRecord) => record.status === 'practice' && record.demoUsed !== true && record.retries === 2;

/** Game performance only; final missions normalize the questions actually challenged to 100. */
export function scoreRecord(record: AttemptRecord, totalQuestions: number): number {
  if (!Number.isInteger(totalQuestions) || totalQuestions < 1) throw new Error('計分需要有效的題目數。');
  if (record.status === 'practice' || record.demoUsed || record.status === 'timeout' || record.timedOut) return 0;
  const corrected = Math.max(4, 20 - 4 * Math.max(0, record.retries));
  const earned = Math.min(record.hintUsed ? Math.min(16, corrected) : corrected, timeLimitPoints(record));
  return rounded(earned / 20 * (100 / totalQuestions));
}

/** Legacy records have no timer and never gain a time penalty retroactively. */
export function timeLimitPoints(record: AttemptRecord): number {
  if (record.status === 'timeout' || record.timedOut) return 0;
  if (!record.timed) return 20;
  const elapsed = record.elapsedMs ?? 30_000;
  return elapsed <= 10_000 ? 20 : elapsed <= 20_000 ? 16 : elapsed < 30_000 ? 12 : 0;
}

export function describeAttempt(record: AttemptRecord): string {
  if (record.status === 'timeout' || record.timedOut) return record.retries > 0 ? `超時未作答（先答錯 ${record.retries} 次）` : '超時未作答';
  if (record.status === 'practice' || record.demoUsed) {
    if (unknownDemoRetries(record)) return '伙伴示範完成（舊紀錄，答錯次數不明）';
    return record.retries > 0 ? `伙伴示範完成（先答錯 ${record.retries} 次）` : '伙伴示範完成';
  }
  const action = record.retries > 0 ? `答錯 ${record.retries} 次後答對` : '第一次答對';
  return record.hintUsed ? action + '（使用提示）' : action;
}

function recordsForScore(value: Session | CompletedRun): AttemptRecord[] {
  const records = [...value.records];
  if ('questionIds' in value && value.step === 'feedback' && (value.success && value.selected !== null || value.timedOut) && records.length === value.index) {
    records.push({
      questionId: value.questionIds[value.index], mode: value.mode, action: value.selected, reason: null,
      status: value.timedOut ? 'timeout' : value.demoUsed ? 'practice' : value.hintUsed || value.retries > 0 ? 'supported' : 'first',
      retries: value.retries, hintUsed: value.hintUsed, at: new Date().toISOString(),
      ...(value.enemyMaxHp === undefined ? {} : { enemyMaxHp: value.enemyMaxHp }),
      ...(value.demoUsed && value.demoRetriesKnown ? { demoUsed: true } : {}),
      ...(value.timed ? { timed: true, elapsedMs: value.elapsedMs ?? 0, timedOut: !!value.timedOut } : {}),
      ...(value.ultimateUsed ? { ultimateUsed: true, ultimateId: value.ultimateId } : {}),
      ...(value.preventedDamage ? { preventedDamage: true } : {}),
      ...(value.combatRulesVersion === 2 ? { combatRulesVersion: 2 as const,
        turnBurnDamage: value.lastTurnBurnDamage ?? 0, turnHealing: value.lastTurnHealing ?? 0 } : {}),
    });
  }
  return records;
}

/** Includes successful current feedback once; unanswered questions earn zero. */
export function scoreSession(value: Session | CompletedRun): SessionScore {
  const records = recordsForScore(value);
  const finalBoss = levels.find(level => level.id === value.levelId)?.finalBoss === true;
  const questionCount = finalBoss ? Math.max(1, records.length) : 'questionIds' in value ? value.questionIds.length : getQuestions(value.levelId, value.review).length;
  const rows = records.map(record => ({ record, points: scoreRecord(record, questionCount), maxPoints: 100 / questionCount,
    bonusPoints: record.ultimateUsed ? 10 : 0, timeLimitPoints: timeLimitPoints(record) / 20 * (100 / questionCount) }));
  const unresolved = 'questionIds' in value && records.length === value.index ? value : null;
  const unknownCurrent = unresolved?.demoUsed && !unresolved.demoRetriesKnown && unresolved.retries === 2 ? 1 : 0;
  const unknownWrongAnswers = records.filter(unknownDemoRetries).length + unknownCurrent;
  const wrongAnswers = records.reduce((sum, record) => sum + (unknownDemoRetries(record) ? 0 : record.retries), 0)
    + (unresolved && !unknownCurrent ? unresolved.retries : 0);
  const hints = records.filter(record => record.hintUsed && record.status !== 'practice').length
    + (unresolved?.hintUsed && !unresolved.demoUsed ? 1 : 0);
  const demos = records.filter(record => record.status === 'practice').length + (unresolved?.demoUsed ? 1 : 0);
  const firstTryCorrect = records.filter(record => record.retries === 0 && !record.hintUsed && record.status !== 'practice' && record.status !== 'timeout').length;
  // Normalize the total before rounding so fifteen-question averages do not accumulate 0.01-point row errors.
  const score = Math.min(100, rounded(records.reduce((sum, record) => sum + scoreRecord(record, 5) / 20 * (100 / questionCount), 0)));
  const bonusScore = rows.reduce((sum, row) => sum + row.bonusPoints, 0);
  const timeouts = records.filter(record => record.status === 'timeout' || record.timedOut).length;
  return {
    score, maxScore: 100, firstTryCorrect, wrongAnswers, hints, demos, questionCount,
    bonusScore, totalScore: score + bonusScore, timeouts, ultimateUses: rows.filter(row => row.bonusPoints > 0).length,
    perfect: records.length === questionCount && firstTryCorrect === questionCount && score === 100
      && (!finalBoss || finalBossDamage(records) >= battleEnemyMaxHp(value)),
    unknownWrongAnswers, rows,
  };
}

/** Saved burn ticks make early completion reproducible without reapplying newer effects to old casts. */
export function finalBossDamage(records: readonly AttemptRecord[]): number {
  return records.reduce((damage, record) => damage + (record.status === 'timeout' ? 0 : 20)
    + (record.ultimateUsed ? getUltimateSpell(record.ultimateId!, record.mode)?.extraDamage ?? 0 : 0)
    + (record.turnBurnDamage ?? 0), 0);
}

/** Recover only exact, contiguous complete sequences; partial history has no score. */
export function reconstructRuns(attempts: readonly AttemptRecord[]): CompletedRun[] {
  const runs: CompletedRun[] = [];
  for (let index = 0; index < attempts.length;) {
    const first = attempts[index], question = questionById.get(first.questionId);
    if (!question || (question.slot !== 1 && question.slot !== 6) || levels.find(level => level.id === question.levelId)?.mode !== first.mode) { index++; continue; }
    const finalBoss = levels.find(level => level.id === question.levelId)?.finalBoss;
    const review = !finalBoss && question.slot === 6;
    const expected = getQuestionsForHistory(question.levelId, review, first.questionId).map(item => item.id);
    let count = expected.length;
    if (finalBoss) {
      count = 0;
      while (count < expected.length && attempts[index + count]?.questionId === expected[count] && attempts[index + count]?.mode === first.mode) {
        count++;
        if (finalBossDamage(attempts.slice(index, index + count)) >= (attempts[index + count - 1].enemyMaxHp ?? 300)) break;
      }
    }
    const records = attempts.slice(index, index + count);
    const enemyMaxHp = records.at(-1)?.enemyMaxHp ?? 300;
    if (!records.length || (!finalBoss && records.length !== expected.length) || (finalBoss && count < expected.length && finalBossDamage(records) < enemyMaxHp)
      || records.some((record, i) => record.questionId !== expected[i] || record.mode !== first.mode)) {
      index++; continue;
    }
    const at = records[records.length - 1].at;
    runs.push({ sessionId: `legacy-v2-${index}-${question.levelId}-${review ? 'review' : 'main'}-${at}`,
      levelId: question.levelId, mode: first.mode, review, records: [...records], at,
      ...(finalBoss ? { passed: finalBossDamage(records) >= enemyMaxHp,
        ...(records.at(-1)?.enemyMaxHp === undefined ? {} : { enemyMaxHp }) } : records.some(record => record.status === 'timeout') ? { passed: false } : {}),
    });
    index += records.length;
  }
  return runs;
}

export function getLevelRuns(progress: Progress, levelId: number, review = false): CompletedRun[] {
  return (progress.runs ?? reconstructRuns(progress.attempts)).filter(run => run.levelId === levelId && run.review === review);
}

export function latestRun(progress: Progress): CompletedRun | null {
  const runs = progress.runs ?? reconstructRuns(progress.attempts);
  return runs.at(-1) ?? null;
}

export function bestRun(progress: Progress, levelId: number, review = false): CompletedRun | null {
  return getLevelRuns(progress, levelId, review).reduce<CompletedRun | null>((best, run) =>
    !best || scoreSession(run).score >= scoreSession(best).score ? run : best, null);
}
