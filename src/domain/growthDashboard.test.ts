import { describe, expect, it } from 'vitest';
import { getQuestions } from '../content';
import { createProgress } from './engine';
import { buildGrowthDashboard, classifyDashboardAttempt, dashboardPercent } from './growthDashboard';
import type { AttemptRecord, CompletedRun, Progress } from './types';

function run(id: string, levelId = 1, at = '2026-10-08T03:00:00.000Z', review = false,
  changes: Partial<AttemptRecord>[] = []): CompletedRun {
  const mode = levelId <= 6 ? 'starter' : 'advanced';
  return {
    sessionId: id, levelId, mode, review, at,
    records: getQuestions(levelId, review).map((question, i) => ({
      questionId: question.id, mode, at, action: Number(Object.keys(question.valid)[0]), reason: null,
      status: 'first', retries: 0, hintUsed: false, ...changes[i],
    })),
  };
}
const progress = (runs: CompletedRun[]): Progress => ({ ...createProgress(), runs });
const supported = { status: 'supported' as const, retries: 1 };
const demo = { status: 'practice' as const, demoUsed: true };
const timeout = { status: 'timeout' as const, timedOut: true, action: null };

describe('growth dashboard projection', () => {
  it('keeps main beginner and advanced runs separate from replay practice', () => {
    const value = progress([run('beginner'), run('advanced', 7), run('replay', 1, undefined, true)]);
    expect(buildGrowthDashboard(value).runs.map(item => item.run.sessionId)).toEqual(['beginner', 'advanced']);
    expect(buildGrowthDashboard(value, 'starter').runs.map(item => item.run.sessionId)).toEqual(['beginner']);
    expect(buildGrowthDashboard(value, 'advanced').runs.map(item => item.run.sessionId)).toEqual(['advanced']);
    expect(buildGrowthDashboard(value, 'review').runs.map(item => item.run.sessionId)).toEqual(['replay']);
    expect(buildGrowthDashboard(value).levels).toHaveLength(12);
    expect(buildGrowthDashboard(value, 'starter').levels).toHaveLength(6);
    expect(buildGrowthDashboard(value, 'advanced').levels).toHaveLength(6);
    expect(buildGrowthDashboard(value, 'review').levels).toHaveLength(12);
  });

  it('keeps a 100 + 10 perfect score on the 100-point answer axis', () => {
    const dashboard = buildGrowthDashboard(progress([run('ultimate', 1, undefined, false,
      [{ ultimateUsed: true, ultimateId: 1 }]) ]));
    expect(dashboard.axisMax).toBe(100);
    expect(dashboard.best?.score).toMatchObject({ score: 100, bonusScore: 10, totalScore: 110 });
    expect(dashboard.summary).toMatchObject({ averageScore: 100, totalBonus: 10, perfectRuns: 1 });
    expect(dashboard.levels[0].best?.score.score).toBe(100);
  });

  it('finds the latest by actual date and preserves source order for date ties', () => {
    const newest = run('newest', 1, '2026-10-08T05:00:00.000Z');
    const oldest = run('oldest', 2, '2026-10-08T01:00:00.000Z');
    const tie = run('same-time-later-stored', 3, newest.at);
    const dashboard = buildGrowthDashboard(progress([newest, oldest, tie]));
    expect(dashboard.runs.map(item => item.run.sessionId)).toEqual(['oldest', 'newest', 'same-time-later-stored']);
    expect(dashboard.latest?.run.sessionId).toBe(tie.sessionId);
  });

  it('selects the newest equal base score without ranking bonus points', () => {
    const recent = run('recent-no-bonus', 1, '2026-10-08T06:00:00.000Z');
    const older = run('older-with-bonus', 1, '2026-10-08T02:00:00.000Z', false,
      [{ ultimateUsed: true, ultimateId: 1 }]);
    const dashboard = buildGrowthDashboard(progress([recent, older]));
    expect(dashboard.best?.run.sessionId).toBe(recent.sessionId);
    expect(dashboard.levels[0].best?.run.sessionId).toBe(recent.sessionId);
    expect(dashboard.levels[0].attempts).toBe(2);
  });

  it('uses only each level’s latest run for mutually exclusive answer slices', () => {
    const mixed = run('latest', 1, '2026-10-08T05:00:00.000Z', false, [
      {}, { status: 'first', hintUsed: true }, supported,
      { ...demo, hintUsed: true, retries: 2 }, { ...timeout, demoUsed: true, hintUsed: true },
    ]);
    const dashboard = buildGrowthDashboard(progress([mixed, run('older', 1, '2026-10-08T01:00:00.000Z')]));
    expect(dashboard.performance.map(item => [item.key, item.count, item.percent])).toEqual([
      ['first', 1, 20], ['supported', 2, 40], ['demo', 1, 20], ['timeout', 1, 20],
    ]);
    expect(dashboard.performanceTotal).toBe(5);
    expect(dashboard.summary.runCount).toBe(2);
  });

  it('counts review question types separately and respects their existing 100-point score', () => {
    const dashboard = buildGrowthDashboard(progress([
      run('main'), run('review', 1, undefined, true, [{ hintUsed: true }, demo]),
    ]), 'review');
    expect(dashboard.latest?.score.score).toBe(40);
    expect(dashboard.performanceTotal).toBe(2);
    expect(dashboard.performance.map(item => item.count)).toEqual([0, 1, 1, 0]);
    expect(dashboard.summary.runCount).toBe(1);
  });

  it('shows the latest eight attempts in chronological order', () => {
    const runs = Array.from({ length: 10 }, (_, i) => run(`run-${i}`, 1, `2026-10-08T${String(i).padStart(2, '0')}:00:00.000Z`));
    const dashboard = buildGrowthDashboard(progress(runs.reverse()));
    expect(dashboard.trend.map(item => item.run.sessionId)).toEqual(['run-2', 'run-3', 'run-4', 'run-5', 'run-6', 'run-7', 'run-8', 'run-9']);
    expect(dashboard.runs).toHaveLength(10);
  });

  it('recovers legacy complete attempts only when explicit runs are absent', () => {
    const oldMain = run('main'), oldReview = run('review', 1, undefined, true);
    const value: Progress = { ...createProgress(), attempts: [...oldMain.records, ...oldReview.records] };
    delete value.runs;
    expect(buildGrowthDashboard(value).runs).toHaveLength(1);
    expect(buildGrowthDashboard(value, 'review').runs).toHaveLength(1);
    expect(buildGrowthDashboard(value).latest?.run.sessionId).toMatch(/^legacy-v2-/);
    expect(buildGrowthDashboard({ ...value, runs: [] }).hasRuns).toBe(false);
    expect(buildGrowthDashboard({ ...value, attempts: oldMain.records.slice(0, 4) }).hasRuns).toBe(false);
  });

  it('retains an earlier pass even after a recent unfinished timed mission', () => {
    const passed = run('passed', 7, '2026-10-08T01:00:00.000Z');
    const failed = { ...run('failed', 7, '2026-10-08T02:00:00.000Z', false, [timeout]), passed: false };
    const dashboard = buildGrowthDashboard(progress([passed, failed]), 'advanced');
    expect(dashboard.latest?.passed).toBe(false);
    expect(dashboard.levels[0].passed).toBe(true);
    expect(dashboard.summary.passedLevelCount).toBe(1);
    expect(dashboard.trend[0].passed).toBe(true);
  });

  it('distinguishes a recorded zero score from no records without producing NaN', () => {
    const zero = buildGrowthDashboard(progress([run('zero', 1, undefined, false, Array.from({ length: 5 }, () => demo))]));
    expect(zero.hasRuns).toBe(true);
    expect(zero.summary.averageScore).toBe(0);
    expect(zero.best?.score.score).toBe(0);
    const empty = buildGrowthDashboard(progress([]));
    expect(empty.hasRuns).toBe(false);
    expect(empty.latest).toBeNull();
    expect(empty.best).toBeNull();
    expect(empty.summary.averageScore).toBeNull();
    expect(empty.performanceTotal).toBe(0);
    expect(empty.performance.every(item => item.count === 0 && item.percent === 0)).toBe(true);
  });

  it('ignores invalid dates and mismatched level modes rather than inventing a visible record', () => {
    const invalidDate = run('invalid-date', 1, 'not-a-date');
    const mismatched = { ...run('mismatched'), mode: 'advanced' as const };
    const unknown = { ...run('unknown'), levelId: 999 };
    expect(buildGrowthDashboard(progress([invalidDate, mismatched, unknown])).hasRuns).toBe(false);
  });

  it('does not mutate run order, records or saved progress', () => {
    const value = progress([run('recent', 1, '2026-10-08T04:00:00.000Z'), run('older', 1)]);
    const before = JSON.stringify(value);
    buildGrowthDashboard(value);
    expect(JSON.stringify(value)).toBe(before);
  });
});

describe('dashboard helpers', () => {
  it('guards percentages and preserves explicit zero', () => {
    expect(dashboardPercent(0, 5)).toBe(0);
    expect(dashboardPercent(1, 3)).toBe(33.3);
    expect(dashboardPercent(1, 0)).toBe(0);
    expect(dashboardPercent(-1, 2)).toBe(0);
    expect(dashboardPercent(6, 5)).toBe(100);
    expect(dashboardPercent(Number.NaN, 5)).toBe(0);
  });

  it('classifies legacy practice and first-labelled retries correctly', () => {
    const record = run('classification').records[0];
    expect(classifyDashboardAttempt({ ...record, status: 'practice', hintUsed: true, retries: 2 })).toBe('demo');
    expect(classifyDashboardAttempt({ ...record, status: 'first', retries: 1 })).toBe('supported');
    expect(classifyDashboardAttempt({ ...record, status: 'first', timedOut: true })).toBe('timeout');
  });
});
