import { describe, expect, it } from 'vitest';
import { getQuestions, getQuestionsForHistory } from '../content';
import { chooseAction, createProgress, currentQuestion, demonstrate, retryQuestion, startSession, submitAction, useHint } from './engine';
import { bestRun, describeAttempt, getLevelRuns, latestRun, reconstructRuns, scoreRecord, scoreSession } from './scoring';
import type { AttemptRecord, CompletedRun, Session } from './types';

function record(retries = 0, hintUsed = false, demoUsed = false): AttemptRecord {
  const question = getQuestions(1)[0];
  return { questionId: question.id, mode: 'starter', action: Number(Object.keys(question.valid)[0]), reason: null,
    status: demoUsed ? 'practice' : retries || hintUsed ? 'supported' : 'first', retries, hintUsed: hintUsed || demoUsed,
    at: '2026-10-07T11:00:00.000Z', ...(demoUsed ? { demoUsed: true } : {}) };
}
function run(levelId = 1, review = false, changes: AttemptRecord[] = [], firstQuestionId?: string): CompletedRun {
  const mode = levelId <= 6 ? 'starter' : 'advanced';
  return { sessionId: `run-${levelId}-${review}`, levelId, mode, review, at: '2026-10-07T11:00:00.000Z',
    records: getQuestionsForHistory(levelId, review, firstQuestionId).map((question, i) => ({ ...(changes[i] ?? record()),
      questionId: question.id, mode, action: Number(Object.keys(question.valid)[0]) })) };
}
function solve(session: Session): Session {
  return submitAction(chooseAction(session, Number(Object.keys(currentQuestion(session).valid)[0])));
}

describe('descriptive battle scores', () => {
  it.each([[0, 20], [1, 16], [2, 12], [3, 8], [4, 4], [50, 4]])('awards %i-error independent answers %i main-question points', (retries, expected) => {
    expect(scoreRecord(record(retries), 5)).toBe(expected);
  });

  it.each([[0, 25], [1, 20], [2, 15], [3, 10], [4, 5], [50, 5]])('awards a four-question starter answer with %i errors %i points', (retries, expected) => {
    expect(scoreRecord(record(retries), 4)).toBe(expected);
  });

  it.each([[0, 16], [1, 16], [2, 12], [4, 4]])('caps a hinted %i-error answer at %i points without a double penalty', (retries, expected) => {
    expect(scoreRecord(record(retries, true), 5)).toBe(expected);
  });

  it.each([[0, 20], [1, 20], [2, 15], [4, 5]])('caps a hinted four-question starter answer with %i errors at %i points', (retries, expected) => {
    expect(scoreRecord(record(retries, true), 4)).toBe(expected);
  });

  it.each([0, 1, 2, 8])('gives demonstrations zero points with %i actual wrong answers', retries => {
    expect(scoreRecord(record(retries, false, true), 5)).toBe(0);
    expect(scoreRecord(record(retries, false, true), 4)).toBe(0);
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

  it('requires four independent first tries for a new starter perfect score', () => {
    const perfect = scoreSession(run());
    expect(perfect).toMatchObject({ score: 100, questionCount: 4, firstTryCorrect: 4, wrongAnswers: 0, hints: 0, demos: 0, perfect: true });
    expect(perfect.rows.every(row => row.points === 25 && row.maxPoints === 25)).toBe(true);
    const mixed = scoreSession(run(1, false, [record(), record(1), record(2, true), record(0, false, true)]));
    expect(mixed).toMatchObject({ score: 60, firstTryCorrect: 1, wrongAnswers: 3, hints: 1, demos: 1, perfect: false, unknownWrongAnswers: 0 });
    expect(mixed.rows.map(row => row.points)).toEqual([25, 20, 15, 0]);
    expect(scoreSession(run(1, false, Array.from({ length: 4 }, () => record(0, false, true)))).score).toBe(0);
  });

  it.each(Array.from({ length: 12 }, (_, index) => index + 1))('keeps main level %i on its own current question count', levelId => {
    const questionCount = levelId <= 6 ? 4 : 5;
    const score = scoreSession(run(levelId));
    expect(score).toMatchObject({ score: 100, questionCount, firstTryCorrect: questionCount, perfect: true });
    expect(score.rows).toHaveLength(questionCount);
    expect(score.rows.every(row => row.points === 100 / questionCount && row.maxPoints === 100 / questionCount)).toBe(true);
  });

  it.each(Array.from({ length: 6 }, (_, index) => index + 1))('preserves five-question V4 scores for starter level %i after the four-question update', levelId => {
    const firstQuestionId = `V4L${String(levelId).padStart(2, '0')}Q01`;
    const perfect = scoreSession(run(levelId, false, [], firstQuestionId));
    expect(perfect).toMatchObject({ score: 100, questionCount: 5, firstTryCorrect: 5, perfect: true });
    expect(perfect.rows.every(row => row.points === 20 && row.maxPoints === 20)).toBe(true);
    const supported = scoreSession(run(levelId, false, Array.from({ length: 5 }, () => record(0, true)), firstQuestionId));
    expect(supported).toMatchObject({ score: 80, questionCount: 5, hints: 5, perfect: false });
    expect(supported.rows.map(row => row.points)).toEqual([16, 16, 16, 16, 16]);
  });

  it('counts current successful feedback exactly once and does not call an unfinished run perfect', () => {
    const answered = solve(startSession(1, 'starter'));
    expect(scoreSession(answered)).toMatchObject({ score: 25, firstTryCorrect: 1, perfect: false, questionCount: 4 });
    const row = scoreSession(answered).rows[0].record;
    expect(scoreSession({ ...answered, records: [row] })).toMatchObject({ score: 25, firstTryCorrect: 1 });
    expect(scoreSession({ ...answered, records: [row] }).rows).toHaveLength(1);
  });

  it('tracks an unresolved wrong answer and hint without awarding points', () => {
    const initial = startSession(1, 'starter');
    const wrongIndex = currentQuestion(initial).choices.findIndex((_, i) => !currentQuestion(initial).valid[i]?.length);
    const wrong = useHint(submitAction(chooseAction(initial, wrongIndex)));
    expect(scoreSession(wrong)).toMatchObject({ score: 0, wrongAnswers: 1, hints: 1, demos: 0 });
    expect(scoreSession(wrong).rows).toHaveLength(0);
    expect(scoreSession(solve(retryQuestion(wrong)))).toMatchObject({ score: 20, wrongAnswers: 1, hints: 1 });
  });

  it('does not manufacture two wrong answers when a new demonstration is used', () => {
    expect(scoreSession(demonstrate(startSession(1, 'starter')))).toMatchObject({ score: 0, wrongAnswers: 0, demos: 1, hints: 0, unknownWrongAnswers: 0 });
    expect(scoreSession(demonstrate({ ...startSession(1, 'starter'), retries: 1 }))).toMatchObject({ wrongAnswers: 1, demos: 1 });
  });

  it('labels ambiguous old demo counters instead of treating their proxy as actual errors', () => {
    const legacy = { ...record(2, true), status: 'practice' as const };
    expect(describeAttempt(legacy)).toContain('舊紀錄，答錯次數不明');
    expect(scoreSession(run(1, false, [legacy], 'V4L01Q01'))).toMatchObject({ score: 80, wrongAnswers: 0, demos: 1, unknownWrongAnswers: 1 });
    expect(scoreSession(run(1, false, [{ ...legacy, retries: 4 }], 'V4L01Q01'))).toMatchObject({ wrongAnswers: 4, unknownWrongAnswers: 0 });
    const activeLegacy = { ...demonstrate(startSession(1, 'starter')), retries: 2 };
    delete activeLegacy.demoRetriesKnown;
    expect(scoreSession(activeLegacy)).toMatchObject({ wrongAnswers: 0, unknownWrongAnswers: 1 });
  });

  it('reconstructs only complete contiguous four-question or two-question historical runs', () => {
    const incomplete = run(1).records.slice(0, -1);
    const main = run(2), review = run(1, true), replay = run(1);
    const reconstructed = reconstructRuns([...incomplete, ...main.records, ...review.records, ...replay.records]);
    expect(reconstructed.map(report => [report.levelId, report.review, report.records.length])).toEqual([[2, false, 4], [1, true, 2], [1, false, 4]]);
    expect(reconstructed.map(report => report.sessionId)).toEqual(reconstructRuns([...incomplete, ...main.records, ...review.records, ...replay.records]).map(report => report.sessionId));
    expect(reconstructRuns(incomplete)).toEqual([]);
    expect(reconstructRuns([...main.records].reverse())).toEqual([]);
    expect(reconstructRuns(main.records.map(item => ({ ...item, mode: 'advanced' })))).toEqual([]);
    const historical = { ...createProgress(), completed: [1], attempts: incomplete };
    delete historical.runs;
    expect(latestRun(historical)).toBeNull();
    expect(bestRun(historical, 1)).toBeNull();
  });

  it('reconstructs mixed V2, V4 and V5 starter editions with their original scores and complete sequences', () => {
    const hints = Array.from({ length: 5 }, () => record(0, true));
    const oldV2 = run(1, false, hints, 'V2L01Q01');
    const oldV4 = run(1, false, hints, 'V4L01Q01');
    const current = run(1);
    const recovered = reconstructRuns([...oldV2.records, ...oldV4.records, ...current.records]);
    expect(recovered.map(report => report.records.map(item => item.questionId))).toEqual([oldV2, oldV4, current].map(report => report.records.map(item => item.questionId)));
    expect(recovered.map(report => [scoreSession(report).questionCount, scoreSession(report).score, scoreSession(report).perfect])).toEqual([[5, 80, false], [5, 80, false], [4, 100, true]]);
    expect(reconstructRuns(oldV4.records.slice(0, 4))).toEqual([]);
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
