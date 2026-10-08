export type UltimateSpellCategory = 'attack' | 'defense' | 'support';

export interface UltimateSpell {
  readonly id: number;
  readonly name: string;
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
  { id: 6, name: '伙伴守護樹', category: 'defense', bonus: 10, description: '召喚伙伴守護樹，擋住下一次魔王攻擊的 12 HP 傷害。', artPath: '/art/ultimate-6-v1.webp' },
].map((spell) => Object.freeze(spell as UltimateSpell)));

export function getUltimateSpell(id: number): UltimateSpell | undefined {
  return ultimateSpells.find((spell) => spell.id === id);
}
