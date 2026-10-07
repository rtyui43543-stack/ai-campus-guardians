import { describe, expect, it } from 'vitest';
import { resolveAppAsset } from './urls';

describe('deployment-scoped game assets', () => {
  it('keeps audio, icons and teacher downloads under GitHub project Pages', () => {
    const base = 'https://school.github.io/ai-campus-guardians/';
    expect(resolveAppAsset('/audio/lesson.mp3', base)).toBe(base + 'audio/lesson.mp3');
    expect(resolveAppAsset('icon-192.png', base)).toBe(base + 'icon-192.png');
    expect(resolveAppAsset('/teacher/question-list.csv', base)).toBe(base + 'teacher/question-list.csv');
  });
  it('also supports a root site and encoded repository name', () => {
    expect(resolveAppAsset('/audio/index.json', 'https://school.example/')).toBe('https://school.example/audio/index.json');
    expect(resolveAppAsset('/icon-192.png', 'https://school.github.io/AI%20Game/')).toBe('https://school.github.io/AI%20Game/icon-192.png');
  });
  it('rejects paths that escape the game deployment', () => {
    for (const path of ['../another-game/a.mp3', '//other.example/a.mp3', 'https://other.example/a.mp3', '/%2e%2e/a.mp3']) {
      expect(() => resolveAppAsset(path, 'https://school.github.io/game/')).toThrow();
    }
  });
});
