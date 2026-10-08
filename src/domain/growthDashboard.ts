import { chapters, levels } from '../content/levels';
import { reconstructRuns, scoreSession, type SessionScore } from './scoring';
import type { AttemptRecord, Chapter, CompletedRun, Level, Progress } from './types';

export type DashboardScope = 'all' | 'starter' | 'advanced' | 'review';
export type PerformanceKey = 'first' | 'supported' | 'demo' | 'timeout';

export interface ScoredDashboardRun {
  run: CompletedRun;
  level: Level;
  chapter: Chapter;
  score: SessionScore;
  passed: boolean;
  at: string;
}

export interface DashboardLevel {
  level: Level;
  chapter: Chapter;
  attempts: number;
  latest: ScoredDashboardRun | null;
  best: ScoredDashboardRun | null;
  passed: boolean;
}

export interface DashboardPerformance {
  key: PerformanceKey;
  label: string;
  count: number;
  percent: number;
}

export interface GrowthDashboardData {
  scope: DashboardScope;
  /** Only the answer score belongs on the chart axis. Bonus points stay separate. */
  axisMax: 100;
  hasRuns: boolean;
  /** Chronological order; equal timestamps preserve the original stored order. */
  runs: ScoredDashboardRun[];
  latest: ScoredDashboardRun | null;
  best: ScoredDashboardRun | null;
  levels: DashboardLevel[];
  trend: ScoredDashboardRun[];
  /** Each level contributes only its latest run, so replaying cannot inflate this view. */
  performance: DashboardPerformance[];
  performanceTotal: number;
  summary: {
    runCount: number;
    levelCount: number;
    playedLevelCount: number;
    passedLevelCount: number;
    averageScore: number | null;
    totalBonus: number;
    perfectRuns: number;
  };
}

const performanceLabels: Record<PerformanceKey, string> = {
  first: '首次自己答對',
  supported: '提示或重試後答對',
  demo: '伙伴示範',
  timeout: '超時未作答',
};
const performanceKeys: PerformanceKey[] = ['first', 'supported', 'demo', 'timeout'];
const rounded = (value: number) => Math.round(value * 10) / 10;

/** Zero is a real score; an empty denominator is an empty chart, not NaN. */
export function dashboardPercent(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return rounded(Math.min(100, Math.max(0, value / total * 100)));
}

/** Priority keeps all four slices exclusive, including old hinted demonstration records. */
export function classifyDashboardAttempt(record: AttemptRecord): PerformanceKey {
  if (record.status === 'timeout' || record.timedOut) return 'timeout';
  if (record.status === 'practice' || record.demoUsed) return 'demo';
  if (record.status === 'supported' || record.hintUsed || record.retries > 0) return 'supported';
  return 'first';
}

function bestOf(runs: readonly ScoredDashboardRun[]): ScoredDashboardRun | null {
  // Runs are chronological, so a tie selects the newest (then last stored) run.
  return runs.reduce<ScoredDashboardRun | null>((best, item) =>
    !best || item.score.score >= best.score.score ? item : best, null);
}

/** Read-only dashboard projection; scoring and saved progress are never changed. */
export function buildGrowthDashboard(progress: Progress, scope: DashboardScope = 'all'): GrowthDashboardData {
  const scopedLevels = levels.filter(level => scope === 'review' ? !level.finalBoss : scope === 'starter' || scope === 'advanced' ? level.mode === scope : true);
  const availableLevels = new Map(scopedLevels.map(level => [level.id, level]));
  const availableChapters = new Map(chapters.map(chapter => [chapter.id, chapter]));
  const source = progress.runs ?? reconstructRuns(progress.attempts);
  const runs = source
    .map((run, index) => ({ run, index, timestamp: Date.parse(run.at) }))
    .filter(({ run, timestamp }) => {
      const level = availableLevels.get(run.levelId);
      return !!level && level.mode === run.mode && Number.isFinite(timestamp)
        && run.review === (scope === 'review');
    })
    .sort((a, b) => a.timestamp - b.timestamp || a.index - b.index)
    .map(({ run }): ScoredDashboardRun => {
      const level = availableLevels.get(run.levelId)!;
      const score = scoreSession(run);
      return {
        run, level, chapter: availableChapters.get(level.chapterId)!, score, at: run.at,
        passed: run.passed !== false && (level.finalBoss || score.timeouts === 0),
      };
    });
  const levelData = scopedLevels.map((level): DashboardLevel => {
    const levelRuns = runs.filter(item => item.level.id === level.id);
    return {
      level, chapter: availableChapters.get(level.chapterId)!, attempts: levelRuns.length,
      latest: levelRuns.at(-1) ?? null, best: bestOf(levelRuns),
      passed: levelRuns.some(item => item.passed),
    };
  });
  const counts: Record<PerformanceKey, number> = { first: 0, supported: 0, demo: 0, timeout: 0 };
  for (const item of levelData) {
    for (const record of item.latest?.run.records ?? []) counts[classifyDashboardAttempt(record)]++;
  }
  const performanceTotal = performanceKeys.reduce((total, key) => total + counts[key], 0);
  return {
    scope, axisMax: 100, hasRuns: runs.length > 0, runs,
    latest: runs.at(-1) ?? null, best: bestOf(runs), levels: levelData, trend: runs.slice(-8),
    performance: performanceKeys.map(key => ({ key, label: performanceLabels[key], count: counts[key],
      percent: dashboardPercent(counts[key], performanceTotal) })),
    performanceTotal,
    summary: {
      runCount: runs.length, levelCount: scopedLevels.length,
      playedLevelCount: levelData.filter(item => item.attempts > 0).length,
      passedLevelCount: levelData.filter(item => item.passed).length,
      averageScore: runs.length ? rounded(runs.reduce((total, item) => total + item.score.score, 0) / runs.length) : null,
      totalBonus: runs.reduce((total, item) => total + item.score.bonusScore, 0),
      perfectRuns: runs.filter(item => item.score.perfect).length,
    },
  };
}
