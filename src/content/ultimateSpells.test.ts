import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getQuestions } from './index';
import { advancedUltimateSpells, allUltimateSpells, getUltimateCardKey, getUltimateCardMode, getUltimateSpell, ultimateSpells } from './ultimateSpells';

describe('chapter ultimate collectible definitions', () => {
  it('gives all six themes distinct spell names and effects with separate bonus points', () => {
    expect(ultimateSpells.map(spell => spell.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(ultimateSpells.map(spell => spell.name)).size).toBe(6);
    expect(ultimateSpells.map(spell => spell.category)).toEqual(['defense', 'attack', 'support', 'attack', 'attack', 'attack']);
    ultimateSpells.forEach(spell => {
      expect(spell.bonus).toBe(10);
      expect(getUltimateSpell(spell.id)).toBe(spell);
      expect(Object.isFrozen(spell)).toBe(true);
    });
    expect(getUltimateSpell(0)).toBeUndefined();
    expect(getUltimateSpell(7)).toBeUndefined();
  });
  it('packages twelve different complete lossless portrait files, not one shared image or external URL', () => {
    const hashes = new Set<string>();
    allUltimateSpells.forEach(spell => {
      expect(spell.artPath).toBe(`/art/ultimate-${spell.mode === 'advanced' ? 'advanced-' : ''}${spell.id}${spell.id === 6 ? '-ice-v2' : '-v1'}.webp`);
      const file = readFileSync(new URL(`../../public${spell.artPath}`, import.meta.url));
      expect(file.subarray(0, 4).toString()).toBe('RIFF');
      expect(file.subarray(8, 16).toString()).toBe('WEBPVP8L');
      expect(file[20]).toBe(0x2f);
      const width = 1 + (file[21] | ((file[22] & 0x3f) << 8));
      const height = 1 + ((file[22] >> 6) | (file[23] << 2) | ((file[24] & 0x0f) << 10));
      expect([width, height]).toEqual([1024, 1536]);
      hashes.add(createHash('sha256').update(file).digest('hex'));
    });
    expect(hashes.size).toBe(12);
  });
  it('defines six genuinely named advanced upgrades with stronger defense and recovery and separate art', () => {
    expect(allUltimateSpells).toHaveLength(12);
    expect(new Set(allUltimateSpells.map(spell => spell.name)).size).toBe(12);
    expect(new Set(allUltimateSpells.map(spell => spell.artPath)).size).toBe(12);
    advancedUltimateSpells.forEach((spell, index) => {
      const base = ultimateSpells[index];
      expect(spell).toMatchObject({ id: base.id, mode: 'advanced', baseName: base.name,
        category: base.category, bonus: base.bonus });
      if (spell.category === 'attack') expect(spell.extraDamage).toBe(15);
      expect(spell.upgradeDescription).toContain(`${base.name}升級`);
      expect(spell.artPath).toBe(`/art/ultimate-advanced-${spell.id}${spell.id === 6 ? '-ice-v2' : '-v1'}.webp`);
      expect(getUltimateSpell(spell.id, 'advanced')).toBe(spell);
      expect(getUltimateSpell(spell.id)).toBe(base);
      expect(Object.isFrozen(spell)).toBe(true);
    });
  });
  it('describes tier-specific defense, healing and ice attacks consistently with combat', () => {
    expect(getUltimateSpell(1, 'advanced')?.description).toContain('下兩次');
    expect(getUltimateSpell(3, 'advanced')?.description).toContain('恢復 24 HP');
    expect(getUltimateSpell(3, 'advanced')?.description).toContain('100 HP');
    expect(getUltimateSpell(6)).toMatchObject({ name: '寒晶冰矛', category: 'attack' });
    expect(getUltimateSpell(6, 'advanced')).toMatchObject({ name: '極寒冰龍', category: 'attack', baseName: '寒晶冰矛' });
    for (const mode of ['starter', 'advanced'] as const) {
      expect(getUltimateSpell(6, mode)?.description).toContain(`魔王 ${mode === 'starter' ? 10 : 15} HP`);
      expect(getUltimateSpell(6, mode)?.description).toContain('傷害減半');
    }
  });
  it('separates attack damage from scoring rewards and describes shield before castle counterattack', () => {
    expect(ultimateSpells.map(spell => spell.extraDamage)).toEqual([5, 10, 0, 10, 10, 10]);
    expect(advancedUltimateSpells.map(spell => spell.extraDamage)).toEqual([10, 15, 0, 15, 15, 15]);
    for (const spell of allUltimateSpells) {
      expect(spell.bonus).toBe(10);
      if (spell.extraDamage) expect(spell.description).toContain(`魔王 ${spell.extraDamage} HP`);
      if (spell.id === 1) {
        expect(spell.description.indexOf('城堡護盾')).toBeLessThan(spell.description.indexOf('城門發射'));
      }
    }
  });
  it('identifies old cards by their actual source question and keeps each tier separate', () => {
    const starter = { ultimateId: 2, questionId: getQuestions(2)[3].id };
    const advanced = { ultimateId: 2, questionId: getQuestions(8)[3].id };
    expect(getUltimateCardKey(starter)).toBe('starter:2');
    expect(getUltimateCardKey(advanced)).toBe('advanced:2');
    expect(getUltimateCardMode({ ...advanced, mode: 'starter' })).toBe('advanced');
    expect(getUltimateCardMode({ mode: 'advanced' })).toBe('advanced');
    expect(getUltimateCardMode({})).toBe('starter');
  });
});
