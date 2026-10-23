import bank from './question-bank.json';
import type { Chapter, Level, Mode } from '../domain/types';

/** Historical IDs stay stable, including the retired starter cooperation mission. */
export const chapters = bank.chapters as Chapter[];
export const levels = bank.levels as Level[];
/** Current routes: five starter missions, six advanced missions and their final bosses. */
export const playableLevels = levels.filter(level => level.id !== 6);
export const getPlayableLevels = (mode?: Mode) => playableLevels.filter(level => mode === undefined || level.mode === mode);
export const isPlayableLevel = (id: number) => playableLevels.some(level => level.id === id);
export const getLevel = (id: number) => {
  const level = levels.find(item => item.id === id);
  if (!level) throw new Error(`找不到第 ${id} 關。`);
  return level;
};
export const getChapter = (id: number) => {
  const chapter = chapters.find(item => item.id === id);
  if (!chapter) throw new Error(`找不到主題 ${id}。`);
  return chapter;
};
export const sourceLabels = { textbook: '教材改編', extension: '倫理延伸', mixed: '教材改編＋倫理延伸' };
export const phaseLabels = { notice: '看一看', evidence: '找線索', action: '選做法', reason: '想一想', transfer: '換個情境', remedy: '再練一次' };
