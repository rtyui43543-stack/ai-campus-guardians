import { describe, expect, it } from 'vitest';
import { getQuestions } from '../content';
import { chooseAction, createProgress, currentQuestion, demonstrate, retryQuestion, startSession, submitAction, useHint } from './engine';
import { bestRun, describeAttempt, getLevelRuns, latestRun, reconstructRuns, scoreRecord, scoreSession } from './scoring';
import type { AttemptRecord, CompletedRun, Session } from './types';

function record(retries = 0, hintUsed = false, demoUsed = false): AttemptRecord {
  const question = getQuestions(1)[0];
  return { questionId: question.id, mode: 'starter', action: Number(Object.keys(question.valid)[0]), reason: null,
    status: demoUsed ? 'practice' : retries || hintUsed ? 'supported' : 'first', retries, hintUsed: hintUsed || demoUsed,
    at: '2026-10-07T11:00:00.000Z', ...(demoUsed ? { demoUsed: true } : {}) };
}
function run(levelId = 1, review = false, changes: AttemptRecord[] = []): CompletedRun {
  const mode = levelId <= 6 ? 'starter' : 'advanced';
  return { sessionId: `run-${levelId}-${review}`, levelId, mode, review, at: '2026-10-07T11:00:00.000Z',
    records: getQuestions(levelId, review).map((question, i) => ({ ...(changes[i] ?? record()),
      questionId: question.id, mode, action: Number(Object.keys(question.valid)[0]) })) };
}
function solve(session: Session): Session {
  return submitAction(chooseAction(session, Number(Object.keys(currentQuestion(session).valid)[0])));
}

describe('descriptive battle scores', () => {
  it.each([[0, 20], [1, 16], [2, 12], [3, 8], [4, 4], [50, 4]])('awards %i-error independent answers %i main-question points', (retries, expected) => {
    expect(scoreRecord(record(retries), 5)).toBe(expected);
  });

  it.each([[0, 16], [1, 16], [2, 12], [4, 4]])('caps a hinted %i-error answer at %i points without a double penalty', (retries, expected) => {
    expect(scoreRecord(record(retries, true), 5)).toBe(expected);
  });

  it.each([0, 1, 2, 8])('gives demonstrations zero points with %i actual wrong answers', retries => {
    expect(scoreRecord(record(retries, false, true), 5)).toBe(0);
    expect(scoreRecord(record(retries, false, true), 2)).toBe(0);
  });

  it('normalizes review points to the same 100-point total', () => {
    expect(scoreRecord(record(), 2)).toBe(50);
    expect(scoreRecord(record(1), 2)).toBe(40);
    expect(scoreRecord(record(2), 2)).toBe(30);
    expect(scoreRecord(record(4), 2)).toBe(10);
    expect(scoreRecord(record(0, true), 2)).toBe(40);
    expect(scoreSession(run(1, true))).toMatchObject({ score: 100, maxScore: 100, questionCount: 2, perfect: true });
    expect(() => scoreRecord(record(), 0)).toThrow('有效的題目數');
  });

  it('describes first tries, corrections, hints and demonstrations accurately', () => {
    expect(describeAttempt(record())).toBe('第一次答對');
    expect(describeAttempt(record(2))).toBe('答錯 2 次後答對');
    expect(describeAttempt(record(0, true))).toBe('第一次答對（使用提示）');
    expect(describeAttempt(record(1, true))).toBe('答錯 1 次後答對（使用提示）');
    expect(describeAttempt(record(0, false, true))).toBe('伙伴示範完成');
    expect(describeAttempt(record(1, false, true))).toBe('伙伴示範完成（先答錯 1 次）');
  });

  it('requires five independent first tries for a main-level perfect score', () => {
    const perfect = scoreSession(run());
    expect(perfect).toMatchObject({ score: 100, firstTryCorrect: 5, wrongAnswers: 0, hints: 0, demos: 0, perfect: true });
    expect(perfect.rows.every(row => row.points === 20 && row.maxPoints === 20)).toBe(true);
    const mixed = scoreSession(run(1, false, [record(), record(1), record(2), record(0, true), record(0, false, true)]));
    expect(mixed).toMatchObject({ score: 64, firstTryCorrect: 1, wrongAnswers: 3, hints: 1, demos: 1, perfect: false, unknownWrongAnswers: 0 });
    expect(mixed.rows.map(row => row.points)).toEqual([20, 16, 12, 16, 0]);
    expect(scoreSession(run(1, false, Array.from({ length: 5 }, () => record(0, false, true)))).score).toBe(0);
  });

  it('counts current successful feedback exactly once and does not call an unfinished run perfect', () => {
    const answered = solve(startSession(1, 'starter'));
    expect(scoreSession(answered)).toMatchObject({ score: 20, firstTryCorrect: 1, perfect: false, questionCount: 5 });
    const row = scoreSession(answered).rows[0].record;
    expect(scoreSession({ ...answered, records: [row] })).toMatchObject({ score: 20, firstTryCorrect: 1 });
    expect(scoreSession({ ...answered, records: [row] }).rows).toHaveLength(1);
  });

  it('tracks an unresolved wrong answer and hint without awarding points', () => {
    const initial = startSession(1, 'starter');
    const wrongIndex = currentQuestion(initial).choices.findIndex((_, i) => !currentQuestion(initial).valid[i]?.length);
    const wrong = useHint(submitAction(chooseAction(initial, wrongIndex)));
    expect(scoreSession(wrong)).toMatchObject({ score: 0, wrongAnswers: 1, hints: 1, demos: 0 });
    expect(scoreSession(wrong).rows).toHaveLength(0);
    expect(scoreSession(solve(retryQuestion(wrong)))).toMatchObject({ score: 16, wrongAnswers: 1, hints: 1 });
  });

  it('does not manufacture two wrong answers when a new demonstration is used', () => {
    expect(scoreSession(demonstrate(startSession(1, 'starter')))).toMatchObject({ score: 0, wrongAnswers: 0, demos: 1, hints: 0, unknownWrongAnswers: 0 });
    expect(scoreSession(demonstrate({ ...startSession(1, 'starter'), retries: 1 }))).toMatchObject({ wrongAnswers: 1, demos: 1 });
  });

  it('labels ambiguous old demo counters instead of treating their proxy as actual errors', () => {
    const legacy = { ...record(2, true), status: 'practice' as const };
    expect(describeAttempt(legacy)).toContain('舊紀錄，答錯次數不明');
    expect(scoreSession(run(1, false, [legacy]))).toMatchObject({ score: 80, wrongAnswers: 0, demos: 1, unknownWrongAnswers: 1 });
    expect(scoreSession(run(1, false, [{ ...legacy, retries: 4 }]))).toMatchObject({ wrongAnswers: 4, unknownWrongAnswers: 0 });
    const activeLegacy = { ...demonstrate(startSession(1, 'starter')), retries: 2 };
    delete activeLegacy.demoRetriesKnown;
    expect(scoreSession(activeLegacy)).toMatchObject({ wrongAnswers: 0, unknownWrongAnswers: 1 });
  });

  it('reconstructs only complete contiguous five-question or two-question historical runs', () => {
    const incomplete = run(1).records.slice(0, 4);
    const main = run(2), review = run(1, true), replay = run(1);
    const reconstructed = reconstructRuns([...incomplete, ...main.records, ...review.records, ...replay.records]);
    expect(reconstructed.map(report => [report.levelId, report.review, report.records.length])).toEqual([[2, false, 5], [1, true, 2], [1, false, 5]]);
    expect(reconstructed.map(report => report.sessionId)).toEqual(reconstructRuns([...incomplete, ...main.records, ...review.records, ...replay.records]).map(report => report.sessionId));
    expect(reconstructRuns(incomplete)).toEqual([]);
    expect(reconstructRuns([...main.records].reverse())).toEqual([]);
    expect(reconstructRuns(main.records.map(item => ({ ...item, mode: 'advanced' })))).toEqual([]);
    const historical = { ...createProgress(), completed: [1], attempts: incomplete };
    delete historical.runs;
    expect(latestRun(historical)).toBeNull();
    expect(bestRun(historical, 1)).toBeNull();
  });

  it('returns separate main/review histories, the latest report and best main replay', () => {
    const high = run(1), low = { ...run(1, false, [record(2)]), sessionId: 'replay-low' }, review = run(1, true);
    const progress = { ...createProgress(), runs: [high, low, review], attempts: [...high.records, ...low.records, ...review.records] };
    expect(getLevelRuns(progress, 1)).toEqual([high, low]);
    expect(getLevelRuns(progress, 1, true)).toEqual([review]);
    expect(bestRun(progress, 1)).toBe(high);
    expect(latestRun(progress)).toBe(review);
    expect(bestRun(progress, 2)).toBeNull();
  });
});
