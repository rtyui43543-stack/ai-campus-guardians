import { describe, expect, it } from 'vitest';
import { levels } from './levels';
import { getMissionBoss } from './missionBosses';
import { getLevelStory, getOpeningStory, levelStories } from './stories';

describe('original offline mission stories', () => {
  it('covers the opening and every available mission with a short playable story', () => {
    expect(getOpeningStory()).toHaveLength(4);
    expect(Object.keys(levelStories).map(Number).sort((a, b) => a - b)).toEqual(levels.map(level => level.id).sort((a, b) => a - b));
    for (const level of levels) expect(getLevelStory(level.id)).toHaveLength(3);
    expect(() => getLevelStory(99)).toThrow('找不到第 99 關的劇情');
  });

  it('keeps captions short, individually identifiable and readable before advancing', () => {
    const beats = [...getOpeningStory(), ...levels.flatMap(level => getLevelStory(level.id))];
    expect(new Set(beats.map(beat => beat.id)).size).toBe(beats.length);
    for (const beat of beats) {
      expect(beat.text.length, beat.id).toBeGreaterThanOrEqual(25);
      expect(beat.text.length, beat.id).toBeLessThanOrEqual(40);
      expect(beat.durationMs, beat.id).toBeGreaterThanOrEqual(8000);
      expect(beat.durationMs, beat.id).toBeLessThanOrEqual(9000);
    }
  });

  it('introduces the same fourteen distinct opponents that the map and battle display', () => {
    const starterNames = levels.filter(level => level.mode === 'starter').map(level => getMissionBoss(level).name);
    const opponents = levels.map(level => getMissionBoss(level).name);
    expect(new Set(opponents).size).toBe(14);
    for (const level of levels) {
      const story = getLevelStory(level.id);
      expect(story[0].text, `第 ${level.id} 關開場魔王`).toContain(getMissionBoss(level).name);
      if (level.mode === 'advanced') {
        const captions = story.map(beat => beat.text).join('');
        for (const starterName of starterNames) {
          expect(captions, `第 ${level.id} 關不應復用初階魔王`).not.toContain(starterName);
          expect(level.intro, `第 ${level.id} 關準備畫面與朗讀簡介`).not.toContain(starterName);
        }
      }
    }
  });

  it('does not assume earlier missions have been completed when students freely choose a level', () => {
    for (const level of levels.filter(level => !level.finalBoss)) {
      const captions = getLevelStory(level.id).map(beat => beat.text).join('');
      expect(captions, `第 ${level.id} 關自由選關`).not.toMatch(/前面學過|走過這些任務|最後挑戰到了|再次擊敗|復活/);
    }
  });
});
