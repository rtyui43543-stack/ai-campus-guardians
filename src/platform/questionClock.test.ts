import { describe, expect, it } from 'vitest';
import { QuestionClock } from './questionClock';

describe('question active-play clock', () => {
  it('preserves fractional remainders without double charging repeated polls', () => {
    const clock = new QuestionClock(); clock.resume(100);
    expect(clock.consume(100.4)).toBe(0);
    expect(clock.consume(101.2)).toBe(1);
    expect(clock.consume(101.2)).toBe(0);
    expect(clock.consume(1000)).toBe(899);
  });
  it('does not charge background, explanation, or unopened screen time', () => {
    const clock = new QuestionClock();
    expect(clock.consume(30000)).toBe(0);
    clock.resume(30000); expect(clock.pause(35000)).toBe(5000);
    expect(clock.consume(95000)).toBe(0);
    clock.resume(95000); expect(clock.consume(105000)).toBe(10000);
  });
  it('a backwards timestamp cannot add time or lower the checkpoint', () => {
    const clock = new QuestionClock(); clock.resume(1000);
    expect(clock.consume(500)).toBe(0);
    expect(clock.consume(30000)).toBe(29000);
    expect(clock.pause(31000)).toBe(1000);
  });
});
