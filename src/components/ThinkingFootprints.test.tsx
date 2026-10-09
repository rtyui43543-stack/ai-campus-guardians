import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { getQuestions } from '../content';
import { createProgress } from '../domain/engine';
import { ThinkingFootprints } from './ThinkingFootprints';

it('renders seven compact levels for the selected route, with details initially closed', () => {
  const progress = createProgress();
  progress.settings.mode = 'advanced';
  const html = renderToStaticMarkup(<ThinkingFootprints progress={progress} onLevel={() => {}} />);
  expect(html).toContain('進階已完成 0 / 7 關');
  expect(html.match(/class="tf-level"/g)).toHaveLength(7);
  expect(html.match(/aria-expanded="false"/g)).toHaveLength(7);
  expect(html).not.toContain('class="tf-records"');
  expect(html).not.toContain('NaN');
});

it('gives the visual answer bar a textual alternative without changing completion status', () => {
  const progress = createProgress();
  progress.completed = [1];
  progress.attempts = [{ questionId: getQuestions(1)[0].id, mode: 'starter', action: null, reason: null,
    status: 'timeout', retries: 0, hintUsed: false, at: '2026-10-09T12:00:00.000Z' }];
  const html = renderToStaticMarkup(<ThinkingFootprints progress={progress} onLevel={() => {}} />);
  expect(html).toContain('初階已完成 1 / 7 關');
  expect(html).toContain('已完成，待練習 1 題，查看紀錄');
  expect(html).toContain('首次答對 0 題，提示／重試後答對 0 題，看示範後完成 0 題，超時未作答 1 題');
});
