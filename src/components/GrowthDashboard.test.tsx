import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { getQuestions } from '../content';
import { createProgress } from '../domain/engine';
import type { CompletedRun } from '../domain/types';
import { GrowthDashboard } from './GrowthDashboard';

it('retains a level pass when the highest-scoring attempt timed out', () => {
  const records = getQuestions(7).map(q => ({
    questionId: q.id, mode: 'advanced' as const, action: Number(Object.keys(q.valid)[0]),
    reason: null, status: 'first' as const, retries: 0, hintUsed: false,
    at: '2026-10-08T02:00:00.000Z', timed: true, elapsedMs: 6_000,
  }));
  const failed: CompletedRun = { sessionId: 'higher-but-timeout', levelId: 7, mode: 'advanced',
    review: false, passed: false, at: '2026-10-08T02:00:00.000Z',
    records: records.map((r,i) => i === 4 ? { ...r, action: null, status: 'timeout', timedOut: true, elapsedMs: 30_000 } : r) };
  const passed: CompletedRun = { ...failed, sessionId: 'slower-but-passed', passed: true,
    at: '2026-10-08T03:00:00.000Z', records: records.map(r => ({ ...r, elapsedMs: 25_000 })) };
  const progress = { ...createProgress(), completed: [7], runs: [failed, passed] };
  const html = renderToStaticMarkup(<GrowthDashboard progress={progress} onRun={() => {}} onLevel={() => {}} />);
  expect(html).toContain('最高答題 80 分，本關已過關，查看最佳成績');
  expect(html).toContain('答題 60');
  expect(html).not.toContain('最高答題 80 分，尚未過關');
});
