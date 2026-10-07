import { describe, expect, it } from 'vitest';
import { levels } from './levels';
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
});
