import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const duck = vi.hoisted(() => vi.fn());
vi.mock('./music', () => ({ setBattleMusicDucked: duck }));

class MockAudio extends EventTarget {
  static instances: MockAudio[] = [];
  src = ''; paused = true; currentTime = 0; hidden = false; preload = '';
  constructor() { super(); MockAudio.instances.push(this); }
  setAttribute() {}
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => { this.paused = true; this.dispatchEvent(new Event('pause')); });
}
describe('manual offline narration', () => {
  beforeEach(() => {
    vi.resetModules(); duck.mockClear(); MockAudio.instances = [];
    vi.stubGlobal('Audio', MockAudio);
    vi.stubGlobal('document', { baseURI: 'https://school.test/game/', body: { appendChild: vi.fn() } });
    vi.stubGlobal('location', { href: 'https://school.test/game/' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ question: '/audio/question.mp3' }) })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads the narration index silently and plays only on request, with tap-to-stop and music ducking', async () => {
    const audio = await import('./audio');
    await audio.loadAudio();
    expect(MockAudio.instances).toHaveLength(0);
    await audio.playAudio('question');
    const player = MockAudio.instances[0];
    expect(player.paused).toBe(false);
    expect(duck).toHaveBeenLastCalledWith(true);
    await audio.playAudio('question');
    expect(player.paused).toBe(true);
    expect(duck).toHaveBeenLastCalledWith(false);
    await audio.playAudio('question');
    player.dispatchEvent(new Event('ended'));
    expect(duck).toHaveBeenLastCalledWith(false);
  });

  it('cancels a pending manual read when the student leaves or answers before the index arrives', async () => {
    let finish!: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { finish = resolve; })));
    const audio = await import('./audio');
    const request = audio.playAudio('question');
    audio.stopAudio();
    finish({ ok: true, json: async () => ({ question: '/audio/question.mp3' }) });
    await request;
    expect(MockAudio.instances).toHaveLength(0);
  });
});
