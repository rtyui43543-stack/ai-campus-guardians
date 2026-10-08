import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getUltimateSpell, ultimateSpells } from './ultimateSpells';

describe('chapter ultimate collectible definitions', () => {
  it('gives all six themes distinct spell names and effects with separate bonus points', () => {
    expect(ultimateSpells.map(spell => spell.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(ultimateSpells.map(spell => spell.name)).size).toBe(6);
    expect(ultimateSpells.map(spell => spell.category)).toEqual(['defense', 'attack', 'support', 'attack', 'attack', 'defense']);
    ultimateSpells.forEach(spell => {
      expect(spell.bonus).toBe(10);
      expect(getUltimateSpell(spell.id)).toBe(spell);
      expect(Object.isFrozen(spell)).toBe(true);
    });
    expect(getUltimateSpell(0)).toBeUndefined();
    expect(getUltimateSpell(7)).toBeUndefined();
  });
  it('packages six different complete lossless portrait files, not one shared image or external URL', () => {
    const hashes = new Set<string>();
    ultimateSpells.forEach(spell => {
      expect(spell.artPath).toBe(`/art/ultimate-${spell.id}-v1.webp`);
      const file = readFileSync(new URL(`../../public${spell.artPath}`, import.meta.url));
      expect(file.subarray(0, 4).toString()).toBe('RIFF');
      expect(file.subarray(8, 16).toString()).toBe('WEBPVP8L');
      expect(file[20]).toBe(0x2f);
      const width = 1 + (file[21] | ((file[22] & 0x3f) << 8));
      const height = 1 + ((file[22] >> 6) | (file[23] << 2) | ((file[24] & 0x0f) << 10));
      expect([width, height]).toEqual([1024, 1536]);
      hashes.add(createHash('sha256').update(file).digest('hex'));
    });
    expect(hashes.size).toBe(6);
  });
});
