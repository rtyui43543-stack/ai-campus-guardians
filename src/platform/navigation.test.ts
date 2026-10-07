import { describe, expect, it } from 'vitest';
import { screenFromHash } from './navigation';

describe('title screen and saved game links', () => {
  it.each(['', '#', '#cover', '#manual', '#unknown'])('opens the cover for %s, even with saved progress', hash => {
    expect(screenFromHash(hash, { battle: true, results: true })).toBe('cover');
  });
  it.each(['map', 'growth', 'proposals', 'settings'] as const)('preserves an explicit %s link', destination => {
    expect(screenFromHash('#' + destination, { battle: false, results: false })).toBe(destination);
  });
  it('restores a saved battle and results, or returns to the cover when missing', () => {
    expect(screenFromHash('#battle', { battle: true, results: false })).toBe('battle');
    expect(screenFromHash('#results', { battle: false, results: true })).toBe('results');
    expect(screenFromHash('#battle', { battle: false, results: true })).toBe('cover');
    expect(screenFromHash('#results', { battle: true, results: false })).toBe('cover');
  });
});
