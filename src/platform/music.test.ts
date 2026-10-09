import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

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
  afterEach(() => { music.stopBattleMusic(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('coalesces rapid starts into one scoped looping audio player', async () => {
    const first = music.startBattleMusic(), second = music.startBattleMusic();
    expect(first).toBe(second);
    await first;
    await music.startBattleMusic();
    expect(instances).toHaveLength(1);
    expect(doc.body.appendChild).toHaveBeenCalledTimes(1);
    expect(instances[0].play).toHaveBeenCalledTimes(1);
    expect(instances[0]).toMatchObject({ src: 'https://school.test/game/music/EpicBattle_Deity.mp3', loop: true, hidden: true, volume: .27, paused: false });
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

  it('keeps the strongest cast duck until all active casts finish, then restores music smoothly', async () => {
    vi.useFakeTimers();
    await music.startBattleMusic();
    const releaseAttack = music.acquireBattleMusicDuck('attack');
    expect(instances[0].volume).toBe(.035);
    const releaseUltimate = music.acquireBattleMusicDuck('ultimate');
    expect(instances[0].volume).toBe(.014);
    releaseAttack(); vi.advanceTimersByTime(300);
    expect(instances[0].volume).toBe(.014);
    releaseUltimate();
    expect(instances[0].volume).toBe(.014);
    vi.advanceTimersByTime(150);
    expect(instances[0].volume).toBeGreaterThan(.014);
    expect(instances[0].volume).toBeLessThan(.27);
    vi.advanceTimersByTime(150);
    expect(instances[0].volume).toBeCloseTo(.27);
    releaseUltimate();
    expect(instances[0].paused).toBe(false);
    expect(instances[0].play).toHaveBeenCalledTimes(1);
  });

  it('does not release a combat duck when narration stops, or release narration when combat stops', async () => {
    vi.useFakeTimers();
    await music.startMusic('final');
    music.setBattleMusicDucked(true);
    const release = music.acquireBattleMusicDuck('ultimate');
    music.setBattleMusicDucked(false);
    expect(instances[0].volume).toBe(.014);
    music.setBattleMusicDucked(true);
    release(); vi.advanceTimersByTime(300);
    expect(instances[0].volume).toBeCloseTo(.09);
    music.setBattleMusicDucked(false);
    expect(instances[0].volume).toBe(.27);
  });

  it('cancels an old recovery on the next hit and keeps a cast duck when music is toggled back on', async () => {
    vi.useFakeTimers();
    await music.startBattleMusic();
    const first = music.acquireBattleMusicDuck('attack');
    first(); vi.advanceTimersByTime(100);
    const second = music.acquireBattleMusicDuck('ultimate');
    vi.advanceTimersByTime(500);
    expect(instances[0].volume).toBe(.014);
    music.stopMusic();
    await music.startAdventureMusic();
    expect(instances[0].paused).toBe(true);
    expect(instances[1]).toMatchObject({ volume: .012, paused: false });
    second(); vi.advanceTimersByTime(500);
    expect(instances[0].paused).toBe(true);
    expect(instances[1]).toMatchObject({ volume: .20, paused: false });
  });

  it('plays the bundled exploration track at a lower volume and reuses it across main pages', async () => {
    await music.startAdventureMusic();
    instances[0].currentTime = 5;
    await music.startAdventureMusic();
    expect(instances).toHaveLength(1);
    expect(instances[0]).toMatchObject({ src: 'https://school.test/game/music/EpicBattle_Deity.mp3', loop: true, paused: false, volume: .20, currentTime: 5 });
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

  it('starts the separately bundled final loop once and reports it as active battle music', async () => {
    const first = music.startMusic('final'), second = music.startMusic('final');
    expect(first).toBe(second); await first; await music.startMusic('final');
    expect(instances).toHaveLength(1);
    expect(instances[0]).toMatchObject({ src: 'https://school.test/game/music/Fight3.mp3',
      loop: true, hidden: true, volume: .27, paused: false });
    expect(instances[0].attributes['data-testid']).toBe('final-music');
    expect(instances[0].play).toHaveBeenCalledTimes(1);
    expect(allEvents.at(-1)).toEqual({ track: 'final', playing: true });
    expect(events.at(-1)).toEqual({ playing: true });
    music.setBattleMusicDucked(true); expect(instances[0].volume).toBe(.09);
    music.setBattleMusicDucked(false); expect(instances[0].volume).toBe(.27);
  });

  it('switches final, ordinary battle and exploration tracks without overlapping or recreating them', async () => {
    for (const track of ['adventure', 'battle', 'final', 'battle', 'adventure', 'final'] as const) {
      await music.startMusic(track);
      const playing = instances.filter(audio => !audio.paused);
      expect(playing).toHaveLength(1);
      expect(playing[0].src).toBe('https://school.test/game/music/'
        + (track === 'final' ? 'Fight3.mp3' : 'EpicBattle_Deity.mp3'));
      expect(instances.filter(audio => audio.paused).every(audio => audio.currentTime === 0)).toBe(true);
      expect(allEvents.at(-1)).toEqual({ track, playing: true });
      playing[0].currentTime = 7;
    }
    expect(instances).toHaveLength(3);
    music.stopMusic();
    expect(instances.every(audio => audio.paused && audio.currentTime === 0)).toBe(true);
  });

  it('cannot restart a delayed final-boss playback after returning to exploration', async () => {
    const held = deferred();
    playback = audio => held.promise.then(() => { audio.paused = false; });
    const final = music.startMusic('final');
    playback = async audio => { audio.paused = false; };
    await music.startAdventureMusic(); held.resolve(); await final;
    expect(instances[0]).toMatchObject({ src: 'https://school.test/game/music/Fight3.mp3', paused: true });
    expect(instances[1].paused).toBe(false);
    expect(allEvents.at(-1)).toEqual({ track: 'adventure', playing: true });
    expect(events.at(-1)).toEqual({ playing: false });
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

describe('supplied PeriTune music files', () => {
  const credits = JSON.parse(readFileSync(new URL('../content/musicCredits.json', import.meta.url), 'utf8'));
  it.each(credits.tracks as { file: string; sha256: string }[])('preserves the supplied $file without re-encoding', track => {
    const mp3 = readFileSync(new URL('../../public/music/' + track.file, import.meta.url));
    expect(createHash('sha256').update(mp3).digest('hex')).toBe(track.sha256);
    const id3 = mp3.subarray(0, 3).toString() === 'ID3';
    const frame = mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0;
    expect(id3 || frame).toBe(true);
    expect(mp3.length).toBeGreaterThan(4 * 1024 * 1024);
  });

  it('includes both exact MP3s in the verified offline pack', () => {
    const temporaryRoot = resolve(tmpdir()), folder = mkdtempSync(resolve(temporaryRoot, 'guardians-music-'));
    try {
      mkdirSync(resolve(folder, 'music'));
      writeFileSync(resolve(folder, 'index.html'), '<!doctype html><head></head>');
      for (const track of credits.tracks) {
        writeFileSync(resolve(folder, 'music', track.file), readFileSync(new URL('../../public/music/' + track.file, import.meta.url)));
      }
      const built = spawnSync(process.execPath, ['scripts/build-offline.mjs', folder], { cwd: process.cwd(), encoding: 'utf8' });
      expect(built.status, built.stderr).toBe(0);
      const manifest = JSON.parse(readFileSync(resolve(folder, 'offline-manifest.json'), 'utf8'));
      expect(manifest.files.filter((file: { core: boolean }) => !file.core)).toEqual(credits.tracks.map((track: {file: string; sha256: string}) => ({
        url: '/music/' + track.file, hash: track.sha256, core: false,
        size: readFileSync(new URL('../../public/music/' + track.file, import.meta.url)).length,
      })));
    } finally {
      const absoluteFolder = resolve(folder);
      if (!absoluteFolder.startsWith(temporaryRoot + sep) || !basename(absoluteFolder).startsWith('guardians-music-'))
        throw new Error('Refusing to remove a test directory outside the created temporary folder.');
      rmSync(absoluteFolder, { recursive: true, force: true });
    }
  });
});
