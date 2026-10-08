import { describe, expect, it } from 'vitest';
import { chapters, levels } from './levels';
import { getBossForTheme, getMissionBoss, missionBosses } from './missionBosses';

describe('mission opponents', () => {
  it('gives all twelve missions different identities and separates the two difficulties', () => {
    const bosses = levels.map(getMissionBoss);
    expect(bosses).toHaveLength(12);
    expect(new Set(bosses.map(boss => boss.id)).size).toBe(12);
    expect(new Set(bosses.map(boss => boss.name)).size).toBe(12);
    for (let theme = 1; theme <= 6; theme++) {
      expect(getBossForTheme(theme, 'advanced').id).not.toBe(getBossForTheme(theme, 'starter').id);
      expect(getBossForTheme(theme, 'advanced').name).not.toBe(getBossForTheme(theme, 'starter').name);
    }
  });
  it('keeps existing beginner names and packages a distinct local advanced asset for each theme', () => {
    expect(chapters.map(chapter => getBossForTheme(chapter.id).name)).toEqual(chapters.map(chapter => chapter.guardian));
    const advanced = missionBosses.filter(boss => boss.mode === 'advanced');
    expect(new Set(advanced.map(boss => boss.artPath)).size).toBe(6);
    advanced.forEach((boss, index) => expect(boss.artPath).toBe(`/art/advanced-boss-${index + 1}-v1.webp`));
  });
  it('resolves by the mission difficulty rather than the most recently selected map tab', () => {
    expect(getMissionBoss(levels[0]).name).toBe('搜集魔盒');
    expect(getMissionBoss(levels[6]).name).toBe('窺密蛛后');
    expect(getMissionBoss(levels[11]).name).toBe('急速雲巨人');
  });
});
