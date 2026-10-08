import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('./urls', () => ({
  appAssetUrl: (path: string) => new URL(path.replace(/^\//, ''), 'https://school.test/game/').href,
}));

type Playback = (audio: FakeAudio) => Promise<void>;
let playback: Playback;
class FakeAudio extends EventTarget {
  src = ''; hidden = false; loop = false; preload = ''; volume = 1; paused = true; currentTime = 0;
  attributes: Record<string, string> = {};
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  play = vi.fn(() => playback(this));
  pause = vi.fn(() => { this.paused = true; });
}
class FakeDocument extends EventTarget {
  visibilityState = 'visible';
  body = { appendChild: vi.fn() };
}
class FakeCustomEvent extends Event {
  detail: unknown;
  constructor(type: string, options: { detail?: unknown }) { super(type); this.detail = options.detail; }
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe('offline battle music lifecycle', () => {
  let doc: FakeDocument, win: EventTarget, music: typeof import('./music');
  const instances: FakeAudio[] = [];
  const events: { playing: boolean; error?: string }[] = [];
  const allEvents: { track: string | null; playing: boolean; error?: string }[] = [];
  beforeEach(async () => {
    vi.resetModules();
    instances.length = 0; events.length = 0; allEvents.length = 0;
    doc = new FakeDocument(); win = new EventTarget();
    playback = async audio => { audio.paused = false; };
    vi.stubGlobal('document', doc); vi.stubGlobal('window', win); vi.stubGlobal('CustomEvent', FakeCustomEvent);
    vi.stubGlobal('Audio', class extends FakeAudio { constructor() { super(); instances.push(this); } });
    win.addEventListener('battle-music-status', event => events.push((event as CustomEvent).detail));
    win.addEventListener('game-music-status', event => allEvents.push((event as CustomEvent).detail));
    music = await import('./music');
  });
  afterEach(() => { music.stopBattleMusic(); vi.unstubAllGlobals(); });

  it('coalesces rapid starts into one scoped looping audio player', async () => {
    const first = music.startBattleMusic(), second = music.startBattleMusic();
    expect(first).toBe(second);
    await first;
    await music.startBattleMusic();
    expect(instances).toHaveLength(1);
    expect(doc.body.appendChild).toHaveBeenCalledTimes(1);
    expect(instances[0].play).toHaveBeenCalledTimes(1);
    expect(instances[0]).toMatchObject({ src: 'https://school.test/game/music/battle-theme.wav', loop: true, hidden: true, volume: .27, paused: false });
    expect(instances[0].attributes['data-testid']).toBe('battle-music');
    expect(events.at(-1)).toEqual({ playing: true });
  });

  it('stops a pending playback even if the browser resolves it after leaving battle', async () => {
    const held = deferred();
    playback = audio => held.promise.then(() => { audio.paused = false; });
    const started = music.startBattleMusic();
    await Promise.resolve();
    instances[0].currentTime = 4;
    music.stopBattleMusic();
    held.resolve(); await started;
    expect(instances[0].paused).toBe(true);
    expect(instances[0].currentTime).toBe(0);
    expect(events.at(-1)).toEqual({ playing: false });
  });

  it('does not let an old settled start interrupt a newly entered battle', async () => {
    const held = deferred();
    playback = audio => held.promise.then(() => { audio.paused = false; });
    const first = music.startBattleMusic(); await Promise.resolve();
    music.stopBattleMusic();
    playback = async audio => { audio.paused = false; };
    await music.startBattleMusic();
    held.resolve(); await first;
    expect(instances).toHaveLength(1);
    expect(instances[0].paused).toBe(false);
  });

  it('reports autoplay rejection and permits a manual retry on the same player', async () => {
    playback = async () => { throw new Error('NotAllowedError'); };
    await expect(music.startBattleMusic()).rejects.toThrow('音樂未能播放');
    expect(events.at(-1)).toMatchObject({ playing: false, error: expect.stringContaining('重試') });
    playback = async audio => { audio.paused = false; };
    await music.startBattleMusic();
    expect(instances).toHaveLength(1);
    expect(instances[0].play).toHaveBeenCalledTimes(2);
    expect(events.at(-1)).toEqual({ playing: true });
  });

  it('pauses while hidden, resumes when visible, and removes resume hooks after stopping', async () => {
    await music.startBattleMusic(); instances[0].currentTime = 3;
    doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange'));
    expect(instances[0].paused).toBe(true);
    expect(instances[0].currentTime).toBe(3);
    doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange'));
    await music.startBattleMusic();
    expect(instances[0].paused).toBe(false);
    expect(instances[0].play).toHaveBeenCalledTimes(2);
    music.stopBattleMusic();
    doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange'));
    doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(instances[0].paused).toBe(true);
    expect(instances[0].play).toHaveBeenCalledTimes(2);
  });

  it('waits for visibility before trying playback and stops on pagehide', async () => {
    doc.visibilityState = 'hidden'; await music.startBattleMusic();
    expect(instances).toHaveLength(0);
    doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange'));
    await music.startBattleMusic();
    expect(instances[0].paused).toBe(false);
    win.dispatchEvent(new Event('pagehide'));
    expect(instances[0].paused).toBe(true);
    expect(instances[0].currentTime).toBe(0);
  });

  it('ducks music for narration without pausing or changing music preference', async () => {
    music.setBattleMusicDucked(true);
    await music.startBattleMusic();
    expect(instances[0].volume).toBe(.09);
    music.setBattleMusicDucked(false);
    expect(instances[0].volume).toBe(.27);
    expect(instances[0].paused).toBe(false);
    expect(instances[0].play).toHaveBeenCalledTimes(1);
  });

  it('plays the bundled exploration track at a lower volume and reuses it across main pages', async () => {
    await music.startAdventureMusic();
    instances[0].currentTime = 5;
    await music.startAdventureMusic();
    expect(instances).toHaveLength(1);
    expect(instances[0]).toMatchObject({ src: 'https://school.test/game/music/adventure-theme.wav', loop: true, paused: false, volume: .20, currentTime: 5 });
    expect(instances[0].play).toHaveBeenCalledTimes(1);
    expect(allEvents.at(-1)).toEqual({ track: 'adventure', playing: true });
    expect(events.at(-1)).toEqual({ playing: false });
  });

  it('switches exploration and battle loops without overlapping and reuses both players', async () => {
    await music.startAdventureMusic();
    instances[0].currentTime = 7;
    await music.startBattleMusic();
    expect(instances).toHaveLength(2);
    expect(instances[0]).toMatchObject({ paused: true, currentTime: 0 });
    expect(instances[1]).toMatchObject({ paused: false, volume: .27 });
    await music.startAdventureMusic();
    expect(instances).toHaveLength(2);
    expect(instances[1]).toMatchObject({ paused: true, currentTime: 0 });
    expect(instances[0].paused).toBe(false);
    music.setBattleMusicDucked(true);
    expect(instances[0].volume).toBe(.06);
    music.setBattleMusicDucked(false);
    expect(instances[0].volume).toBe(.20);
  });

  it('cannot restart a stale exploration request after a battle has begun', async () => {
    const held = deferred();
    playback = audio => held.promise.then(() => { audio.paused = false; });
    const exploration = music.startAdventureMusic();
    playback = async audio => { audio.paused = false; };
    await music.startBattleMusic();
    held.resolve(); await exploration;
    expect(instances[0].paused).toBe(true);
    expect(instances[1].paused).toBe(false);
    expect(allEvents.at(-1)).toEqual({ track: 'battle', playing: true });
  });

  it('resumes the active exploration track after visibility changes, but stays muted after stop', async () => {
    await music.startAdventureMusic();
    doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange'));
    expect(instances[0].paused).toBe(true);
    doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange'));
    await music.startAdventureMusic();
    expect(instances[0].play).toHaveBeenCalledTimes(2);
    music.stopMusic();
    doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange'));
    doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(instances[0].paused).toBe(true);
    expect(instances[0].play).toHaveBeenCalledTimes(2);
    expect(allEvents.at(-1)).toEqual({ track: null, playing: false });
  });
});

describe('bundled original instrumental', () => {
  it('bundles a distinct, seamless and gentler 20-second exploration melody for offline use', () => {
    const wav = readFileSync(new URL('../../public/music/adventure-theme.wav', import.meta.url));
    const battle = readFileSync(new URL('../../public/music/battle-theme.wav', import.meta.url));
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav.subarray(8, 12).toString()).toBe('WAVE');
    expect(wav.readUInt16LE(20)).toBe(1);
    expect(wav.readUInt16LE(22)).toBe(2);
    expect(wav.readUInt16LE(34)).toBe(16);
    const rate = wav.readUInt32LE(24), frames = wav.readUInt32LE(40) / 4;
    expect(frames / rate).toBe(20);
    expect(wav.length).toBeLessThan(2 * 1024 * 1024);
    expect(wav.equals(battle)).toBe(false);
    let peak = 0;
    for (let start = 0; start < frames; start += rate / 2) {
      let energy = 0, count = 0;
      for (let frame = start; frame < Math.min(frames, start + rate / 2); frame += 1) {
        const value = wav.readInt16LE(44 + frame * 4) / 32768;
        energy += value * value; count += 1; peak = Math.max(peak, Math.abs(value));
      }
      expect(Math.sqrt(energy / count)).toBeGreaterThan(.02);
    }
    expect(peak).toBeLessThan(.69);
    const seam = Math.abs(wav.readInt16LE(44) - wav.readInt16LE(wav.length - 4)) / 32768;
    expect(seam).toBeLessThan(.035);
  });
  it('is a small 16-second stereo PCM loop with audible energy throughout', () => {
    const wav = readFileSync(new URL('../../public/music/battle-theme.wav', import.meta.url));
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav.subarray(8, 12).toString()).toBe('WAVE');
    expect(wav.readUInt16LE(20)).toBe(1);
    expect(wav.readUInt16LE(22)).toBe(2);
    expect(wav.readUInt16LE(34)).toBe(16);
    const rate = wav.readUInt32LE(24), frames = wav.readUInt32LE(40) / 4;
    expect(frames / rate).toBe(16);
    expect(wav.length).toBeLessThan(2 * 1024 * 1024);
    let peak = 0;
    for (let start = 0; start < frames; start += rate / 2) {
      let energy = 0, count = 0;
      for (let frame = start; frame < Math.min(frames, start + rate / 2); frame += 1) {
        const value = wav.readInt16LE(44 + frame * 4) / 32768;
        energy += value * value; count += 1; peak = Math.max(peak, Math.abs(value));
      }
      expect(Math.sqrt(energy / count)).toBeGreaterThan(.025);
    }
    expect(peak).toBeLessThan(.89);
    const seam = Math.abs(wav.readInt16LE(44) - wav.readInt16LE(wav.length - 4)) / 32768;
    expect(seam).toBeLessThan(.045);
  });
});
