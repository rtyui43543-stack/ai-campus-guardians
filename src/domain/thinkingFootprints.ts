import { questionById } from '../content';
import { levels } from '../content/levels';
import type { AttemptRecord, LearningStatus, Mode, Progress } from './types';

export const footprintStatuses: LearningStatus[] = ['first', 'supported', 'practice', 'timeout'];
export const footprintStatusNames: Record<LearningStatus, string> = {
  first: '首次答對', supported: '提示／重試後答對', practice: '看示範後完成', timeout: '超時未作答',
};

/** One most-recent record per situation and mode; replays never inflate the chart. */
export function latestThinkingRecords(attempts: readonly AttemptRecord[]) {
  const latest = new Map<string, AttemptRecord>();
  for (const record of attempts) {
    if (!questionById.has(record.questionId)) continue;
    const key = `${record.questionId}:${record.mode}`;
    const previous = latest.get(key);
    if (!previous || !(Date.parse(previous.at) > Date.parse(record.at))) latest.set(key, record);
  }
  return [...latest.values()];
}

export function buildThinkingFootprints(progress: Progress, mode: Mode, practiceOnly = false) {
  const latest = latestThinkingRecords(progress.attempts).filter(record => record.mode === mode);
  const items = levels.filter(level => level.mode === mode).map(level => {
    const records = latest.filter(record => questionById.get(record.questionId)?.levelId === level.id);
    const counts = Object.fromEntries(footprintStatuses.map(status => [status, records.filter(record => record.status === status).length])) as Record<LearningStatus, number>;
    return { level, records, counts, completed: progress.completed.includes(level.id), practice: counts.practice + counts.timeout };
  });
  return {
    items: practiceOnly ? items.filter(item => item.practice > 0) : items,
    total: items.length,
    completed: items.filter(item => item.completed).length,
    practiced: items.reduce((sum, item) => sum + item.records.length, 0),
    practice: items.reduce((sum, item) => sum + item.practice, 0),
  };
}
