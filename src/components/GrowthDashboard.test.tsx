import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { getQuestions } from '../content';
import { advanceSession, chooseAction, createProgress, currentQuestion, finishSession, startSession, submitAction } from '../domain/engine';
import { validateProgress } from '../domain/storage';
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

it('removes a retired starter-only score from the dashboard after loading old progress', () => {
  let session = { ...startSession(5, 'starter'), levelId: 6, questionIds: getQuestions(6).map(question => question.id) };
  const solve = () => submitAction(chooseAction(session, Number(Object.keys(currentQuestion(session).valid)[0])));
  while (session.index < session.questionIds.length - 1) session = advanceSession(solve()).session!;
  const progress = validateProgress(finishSession(createProgress(), solve()));
  const html = renderToStaticMarkup(<GrowthDashboard progress={progress} onRun={() => {}} onLevel={() => {}} />);
  expect(html).not.toContain('過往練習紀錄');
  expect(html).not.toContain('初階第 6 關');
  expect(html).toContain('完成挑戰，留下第一筆成績');
});
