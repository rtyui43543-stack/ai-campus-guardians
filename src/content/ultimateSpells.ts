import { questionById } from './index';
import { levels } from './levels';
import type { Mode } from '../domain/types';

export type UltimateSpellCategory = 'attack' | 'defense' | 'support';

export interface UltimateSpell {
  readonly id: number;
  readonly mode: Mode;
  readonly name: string;
  readonly baseName: string;
  readonly upgradeDescription?: string;
  readonly category: UltimateSpellCategory;
  readonly bonus: number;
  readonly description: string;
  readonly artPath: string;
}

/** Chapter-specific ultimate rewards; titles stay editable HTML rather than baked into art. */
export const ultimateSpells: readonly UltimateSpell[] = Object.freeze([
  { id: 1, name: '守護城堡', category: 'defense', bonus: 10, description: '召喚城堡護盾，擋住下一次魔王攻擊的 12 HP 傷害。', artPath: '/art/ultimate-1-v1.webp' },
  { id: 2, name: '雷霆索引', category: 'attack', bonus: 10, description: '查證書頁化成雷霆，額外扣除魔王 10 HP。', artPath: '/art/ultimate-2-v1.webp' },
  { id: 3, name: '萬葉歸位', category: 'support', bonus: 10, description: '葉片拼圖找回自己的位置，恢復 12 HP，最多回到 100 HP。', artPath: '/art/ultimate-3-v1.webp' },
  { id: 4, name: '鏡界破偽', category: 'attack', bonus: 10, description: '召喚查證鏡陣，擊破假象，額外扣除魔王 10 HP。', artPath: '/art/ultimate-4-v1.webp' },
  { id: 5, name: '智慧火鳳', category: 'attack', bonus: 10, description: '自己的思考化成火鳳，額外扣除魔王 10 HP。', artPath: '/art/ultimate-5-v1.webp' },
  { id: 6, name: '寒晶冰矛', category: 'attack', bonus: 10, description: '凝結寒冰長矛，飛向魔王造成碎冰衝擊，額外扣除魔王 10 HP。', artPath: '/art/ultimate-6-ice-v2.webp' },
].map((spell) => Object.freeze({ ...spell, category: spell.category as UltimateSpellCategory, mode: 'starter' as const, baseName: spell.name })));

const upgrades = [
  { name: '天穹守護城', upgradeDescription: '守護城堡升級！高塔與天空結界一起展開，提供兩次城堡護盾。', description: '召喚城堡護盾，擋住下兩次魔王攻擊，每次抵擋 12 HP 傷害。' },
  { name: '萬卷雷霆陣', upgradeDescription: '雷霆索引升級！查證書頁鋪成巨大的雷霆書陣，從多個方向一同出擊。' },
  { name: '森羅歸位界', upgradeDescription: '萬葉歸位升級！葉片化成整座森林的拼圖，恢復更多力量。', description: '葉片拼圖展開森林領域，恢復 24 HP，最多回到 100 HP。' },
  { name: '千鏡破偽陣', upgradeDescription: '鏡界破偽升級！多面查證鏡展開成大型鏡陣，一起擊碎魔王製造的假象。' },
  { name: '智慧烈焰鳳', upgradeDescription: '智慧火鳳升級！烈焰鳳變大展翼，飛向魔王撞擊；命中後火焰從對手周圍擴散，燃燒整個戰場。' },
  { name: '極寒冰龍', upgradeDescription: '寒晶冰矛升級！冰晶凝成巨龍飛向魔王，命中後冰刺與寒霜蔓延整個戰場。', description: '召喚極寒冰龍衝擊魔王，冰刺碎裂並展開寒霜，額外扣除魔王 10 HP。' },
] as const;

/** Advanced forms can upgrade combat effects; the separate ten-point reward stays the same. */
export const advancedUltimateSpells: readonly UltimateSpell[] = Object.freeze(ultimateSpells.map((spell, index) => Object.freeze({
  ...spell, ...upgrades[index], mode: 'advanced' as const,
  artPath: spell.id === 6 ? '/art/ultimate-advanced-6-ice-v2.webp' : `/art/ultimate-advanced-${spell.id}-v1.webp`,
})));

export const allUltimateSpells: readonly UltimateSpell[] = Object.freeze([...ultimateSpells, ...advancedUltimateSpells]);

export function getUltimateSpell(id: number, mode: Mode = 'starter'): UltimateSpell | undefined {
  return (mode === 'advanced' ? advancedUltimateSpells : ultimateSpells).find((spell) => spell.id === id);
}

export interface UltimateCardIdentity {
  readonly ultimateId: number;
  readonly questionId?: string;
  readonly mode?: Mode;
}

/** Existing cards already store the source question, so their earned tier is recoverable without a save-format change. */
export function getUltimateCardMode(card: Pick<UltimateCardIdentity, 'questionId' | 'mode'>): Mode {
  const question = card.questionId ? questionById.get(card.questionId) : undefined;
  return (question && levels.find(level => level.id === question.levelId)?.mode) || card.mode || 'starter';
}

export function getUltimateCardKey(card: UltimateCardIdentity): string {
  return `${getUltimateCardMode(card)}:${card.ultimateId}`;
}
