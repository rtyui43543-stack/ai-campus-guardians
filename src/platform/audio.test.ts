import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const duck = vi.hoisted(() => vi.fn());
vi.mock('./music', () => ({ setBattleMusicDucked: duck }));

class MockAudio extends EventTarget {
  static instances: MockAudio[] = [];
  static playback: (audio: MockAudio) => Promise<void> = async audio => { audio.paused = false; };
  src = ''; paused = true; currentTime = 0; hidden = false; preload = '';
  constructor() { super(); MockAudio.instances.push(this); }
  setAttribute() {}
  play = vi.fn(() => MockAudio.playback(this));
  pause = vi.fn(() => { this.paused = true; this.dispatchEvent(new Event('pause')); });
  remove = vi.fn();
}
describe('manual offline narration', () => {
  beforeEach(() => {
    vi.resetModules(); duck.mockClear(); MockAudio.instances = [];
    MockAudio.playback = async audio => { audio.paused = false; };
    vi.stubGlobal('Audio', MockAudio);
    vi.stubGlobal('document', { baseURI: 'https://school.test/game/', body: { appendChild: vi.fn() } });
    vi.stubGlobal('location', { href: 'https://school.test/game/' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ question: '/audio/question.mp3', other: '/audio/other.mp3' }) })));
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
    MockAudio.instances.at(-1)!.dispatchEvent(new Event('ended'));
    expect(duck).toHaveBeenLastCalledWith(false);
  });

  it('cancels a pending manual read when the student leaves or answers before the index arrives', async () => {
    let finish!: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { finish = resolve; })));
    const audio = await import('./audio');
    const request = audio.playAudio('question');
    expect(audio.getNarrationState()).toMatchObject({ phase: 'loading', key: 'question' });
    audio.stopAudio();
    expect(audio.getNarrationState()).toMatchObject({ phase: 'idle', key: null });
    finish({ ok: true, json: async () => ({ question: '/audio/question.mp3' }) });
    await request;
    expect(MockAudio.instances).toHaveLength(0);
  });

  it('reports loading synchronously, playback, and completion so narration time never counts as answering time', async () => {
    const audio = await import('./audio');
    const { QuestionClock } = await import('./questionClock');
    const clock = new QuestionClock();
    let now = 0;
    const phases: string[] = [];
    const unsubscribe = audio.subscribeNarration(state => {
      phases.push(state.phase);
      if (state.phase === 'idle') clock.resume(now); else clock.pause(now);
    });
    now = 5_000;
    expect(clock.consume(now)).toBe(5_000);
    const task = audio.playAudio('question');
    expect(audio.getNarrationState().phase).toBe('loading');
    now = 15_000;
    expect(clock.consume(now)).toBe(0);
    await task;
    expect(audio.getNarrationState().phase).toBe('playing');
    now = 40_000;
    expect(clock.consume(now)).toBe(0);
    MockAudio.instances.at(-1)!.dispatchEvent(new Event('ended'));
    expect(audio.getNarrationState().phase).toBe('idle');
    now = 41_000;
    expect(clock.consume(now)).toBe(1_000);
    expect(phases).toEqual(['idle', 'loading', 'playing', 'idle']);
    unsubscribe();
  });

  it('can stop a second tap while the index is loading without starting late narration or retaining a pause', async () => {
    let finish!: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { finish = resolve; })));
    const audio = await import('./audio');
    const task = audio.playAudio('question');
    const loadingRequest = audio.getNarrationState().requestId;
    await audio.playAudio('question');
    expect(audio.getNarrationState()).toMatchObject({ phase: 'idle', requestId: loadingRequest + 1 });
    finish({ ok: true, json: async () => ({ question: '/audio/question.mp3' }) });
    await task;
    expect(MockAudio.instances).toHaveLength(0);
    expect(audio.getNarrationState().phase).toBe('idle');
  });

  it('does not let an old pending playback or queued ended/error event finish a newer question read', async () => {
    const audio = await import('./audio');
    await audio.loadAudio();
    let release!: () => void;
    MockAudio.playback = current => new Promise<void>(resolve => { release = () => { current.paused = false; resolve(); }; });
    const oldTask = audio.playAudio('question');
    await Promise.resolve();
    const old = MockAudio.instances[0];
    audio.stopAudio();
    MockAudio.playback = async current => { current.paused = false; };
    await audio.playAudio('other');
    const current = MockAudio.instances[1];
    const activeRequest = audio.getNarrationState().requestId;
    release(); await oldTask;
    old.dispatchEvent(new Event('ended')); old.dispatchEvent(new Event('error'));
    expect(old.paused).toBe(true);
    expect(current.paused).toBe(false);
    expect(audio.getNarrationState()).toMatchObject({ requestId: activeRequest, phase: 'playing', key: 'other' });
    expect(duck).toHaveBeenLastCalledWith(true);
  });

  it('ignores a stopped request rejection after a newer read has already started', async () => {
    const audio = await import('./audio');
    await audio.loadAudio();
    let rejectOld!: (reason: Error) => void;
    MockAudio.playback = () => new Promise<void>((_, reject) => { rejectOld = reject; });
    const oldTask = audio.playAudio('question');
    await Promise.resolve();
    audio.stopAudio();
    MockAudio.playback = async current => { current.paused = false; };
    await audio.playAudio('other');
    const activeRequest = audio.getNarrationState().requestId;
    rejectOld(new Error('AbortError'));
    await expect(oldTask).resolves.toBeUndefined();
    expect(audio.getNarrationState()).toEqual({ requestId: activeRequest, phase: 'playing', key: 'other' });
    expect(MockAudio.instances[1].paused).toBe(false);
    expect(duck).toHaveBeenLastCalledWith(true);
  });

  it('releases loading on an index failure, missing clip, or autoplay rejection so answering can resume', async () => {
    const audio = await import('./audio');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    await expect(audio.playAudio('question')).rejects.toThrow('這段朗讀尚未準備好');
    expect(audio.getNarrationState()).toMatchObject({ phase: 'idle', error: expect.stringContaining('尚未準備好') });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ question: '/audio/question.mp3' }) })));
    await expect(audio.playAudio('missing')).rejects.toThrow('這段朗讀尚未準備好');
    expect(audio.getNarrationState().phase).toBe('idle');
    MockAudio.playback = async () => { throw new Error('NotAllowedError'); };
    await expect(audio.playAudio('question')).rejects.toThrow('NotAllowedError');
    expect(audio.getNarrationState()).toMatchObject({ phase: 'idle', key: null });
    expect(MockAudio.instances.at(-1)!.paused).toBe(true);
    expect(duck).toHaveBeenLastCalledWith(false);
  });

  it('releases the current read on a media error or external pause and removes its listeners and element', async () => {
    const audio = await import('./audio');
    await audio.playAudio('question');
    const failed = MockAudio.instances[0];
    failed.dispatchEvent(new Event('error'));
    expect(audio.getNarrationState()).toMatchObject({ phase: 'idle', error: expect.stringContaining('播放失敗') });
    expect(failed.remove).toHaveBeenCalledOnce();
    await audio.playAudio('other');
    const paused = MockAudio.instances[1];
    paused.pause();
    expect(audio.getNarrationState()).toMatchObject({ phase: 'idle', key: null });
    expect(paused.remove).toHaveBeenCalledOnce();
    expect(duck).toHaveBeenLastCalledWith(false);
  });

  it('stops narration and closes all queued battle tones when progress is reset', async () => {
    const contexts: { close: ReturnType<typeof vi.fn> }[] = [];
    class MockContext {
      currentTime = 0; destination = {};
      close = vi.fn(async () => {}); resume = vi.fn(async () => {});
      constructor() { contexts.push(this); }
      createOscillator() { return { type: '', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }; }
      createGain() { return { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }; }
    }
    vi.stubGlobal('AudioContext', MockContext);
    const audio = await import('./audio');
    await audio.playAudio('question'); audio.tone(true);
    audio.stopAllAudio();
    expect(MockAudio.instances[0].paused).toBe(true);
    expect(MockAudio.instances[0].currentTime).toBe(0);
    expect(contexts[0].close).toHaveBeenCalledOnce();
    audio.tone(true);
    expect(contexts).toHaveLength(2);
    expect(contexts[1].close).not.toHaveBeenCalled();
  });
});
