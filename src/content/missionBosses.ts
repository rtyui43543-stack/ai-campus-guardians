import type { Level, Mode } from '../domain/types';
import { chapters } from './levels';

export interface MissionBoss {
  readonly id: string;
  readonly name: string;
  readonly chapterId: number;
  readonly mode: Mode;
  readonly description: string;
  readonly artPath?: string;
}

const starterIds = ['magic-chest', 'book-spirit', 'sorting-robot', 'mask-phantom', 'paper-dragon', 'gear-lion-king'];
const advancedSpecs = [
  { id: 'privacy-spider-queen', name: '窺密蛛后', description: '把同學的照片和資料織進網裡，忘了先問每個人的意願。' },
  { id: 'time-hourglass-spirit', name: '倒時沙漏精', description: '把新舊公告混在一起，讓過期的消息看起來像今天的答案。' },
  { id: 'fairness-vine', name: '偏心藤怪', description: '只用一種規則替同學分組，忽略每個人的興趣和需要。' },
  { id: 'echo-fox', name: '偽聲狐狸', description: '模仿別人的聲音和影像，讓消息混亂，也影響被模仿的人。' },
  { id: 'shortcut-squid', name: '捷徑墨魚', description: '用觸手飛快寫完報告，卻跳過理解、練習和誠實說明。' },
  { id: 'speed-cloud-giant', name: '急速雲巨人', description: '只想最快完成全校計畫，忘了個資、安全和不同參加方式。' },
] as const;

/** Difficulty identifies a different opponent, while the learning topic stays the same. */
export const missionBosses: readonly MissionBoss[] = Object.freeze([
  ...chapters.map((chapter, index) => Object.freeze({
    id: starterIds[index], name: chapter.guardian, chapterId: chapter.id,
    mode: 'starter' as const, description: chapter.description,
  })),
  ...advancedSpecs.map((boss, index) => Object.freeze({
    ...boss, chapterId: index + 1, mode: 'advanced' as const,
    artPath: `/art/advanced-boss-${index + 1}-v1.webp`,
  })),
]);

export function getBossForTheme(chapterId: number, mode: Mode = 'starter'): MissionBoss {
  const theme = Math.max(1, Math.min(6, Math.trunc(chapterId) || 1));
  const boss = missionBosses.find(item => item.chapterId === theme && item.mode === mode);
  if (!boss) throw new Error('找不到這個難度的關卡魔王。');
  return boss;
}

export const getMissionBoss = (level: Pick<Level, 'chapterId' | 'mode'>): MissionBoss =>
  getBossForTheme(level.chapterId, level.mode);
