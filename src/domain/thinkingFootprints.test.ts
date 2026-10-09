import { describe, expect, it } from 'vitest';
import { getQuestions } from '../content';
import { levels } from '../content/levels';
import { createProgress } from './engine';
import { buildThinkingFootprints, latestThinkingRecords } from './thinkingFootprints';
import type { AttemptRecord, LearningStatus, Mode } from './types';

function record(levelId: number, status: LearningStatus, at = '2026-10-09T12:00:00.000Z', mode: Mode = levelId <= 6 ? 'starter' : 'advanced'): AttemptRecord {
  return { questionId: getQuestions(levelId)[0].id, mode, action: 0, reason: null, status, retries: 0, hintUsed: false, at };
}

describe('thinking footprints', () => {
  it('counts only the most recent answer to a situation, even when the backup array is out of order', () => {
    const newest = record(1, 'first', '2026-10-09T12:00:00.000Z');
    const older = record(1, 'practice', '2026-10-08T12:00:00.000Z');
    const progress = { ...createProgress(), attempts: [newest, older, newest] };
    const data = buildThinkingFootprints(progress, 'starter');
    expect(data.practiced).toBe(1);
    expect(data.practice).toBe(0);
    expect(data.items[0].counts).toEqual({ first: 1, supported: 0, practice: 0, timeout: 0 });
    expect(buildThinkingFootprints(progress, 'starter', true).items).toEqual([]);
  });

  it('keeps same-time corrections and different modes distinct', () => {
    const records = [record(1, 'practice'), record(1, 'first'), record(1, 'timeout', undefined, 'advanced')];
    expect(latestThinkingRecords(records).map(item => item.status)).toEqual(['first', 'timeout']);
  });

  it('separates both seven-level routes, and the practice filter does not change totals', () => {
    const progress = { ...createProgress(), completed: [1, 7], attempts: [record(1, 'practice'), record(2, 'supported'), record(7, 'timeout')] };
    const starter = buildThinkingFootprints(progress, 'starter', true);
    expect(starter.total).toBe(7);
    expect(starter.completed).toBe(1);
    expect(starter.practiced).toBe(2);
    expect(starter.practice).toBe(1);
    expect(starter.items.map(item => item.level.id)).toEqual([1]);
    const advanced = buildThinkingFootprints(progress, 'advanced');
    expect(advanced.items).toHaveLength(7);
    expect(advanced.practice).toBe(1);
    expect(advanced.items.every(item => item.level.mode === 'advanced')).toBe(true);
  });

  it('preserves final-boss records and saved completion without making up answer data', () => {
    const level = levels.find(item => item.finalBoss && item.mode === 'starter')!;
    const progress = { ...createProgress(), completed: [1, level.id], attempts: [record(level.id, 'practice', undefined, 'starter')] };
    const data = buildThinkingFootprints(progress, 'starter');
    expect(data.completed).toBe(2);
    expect(data.items.find(item => item.level.id === 1)?.records).toHaveLength(0);
    expect(data.items.find(item => item.level.finalBoss)?.practice).toBe(1);
  });

  it('shows empty routes and ignores unknown question records safely', () => {
    const progress = { ...createProgress(), attempts: [{ ...record(1, 'practice'), questionId: 'no-longer-present' }] };
    const data = buildThinkingFootprints(progress, 'starter');
    expect(data.items).toHaveLength(7);
    expect(data.completed).toBe(0);
    expect(data.practiced).toBe(0);
    expect(data.items.every(item => Object.values(item.counts).every(count => count === 0))).toBe(true);
  });
});
