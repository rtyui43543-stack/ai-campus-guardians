import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBattleSound } from './battleSoundDesign';
import { synthesizeCreatureVoice } from './creatureVoice';
import { battleSampleAssets, buildBattleSampleCues } from './battleSamples';

const musicDuck = vi.hoisted(() => ({ acquire: vi.fn(), releases: [] as ReturnType<typeof vi.fn>[] }));
vi.mock('./music', () => ({ setBattleMusicDucked: vi.fn(), acquireBattleMusicDuck: musicDuck.acquire }));
vi.mock('./urls', () => ({
  appAssetUrl: (path: string) => new URL(path.replace(/^\//, ''), 'https://school.test/game/').href,
}));

describe('battle sound choreography', () => {
  it('gives each visible hero element and both sets of enemies a distinct material voice', () => {
    const sounds = [true, false].flatMap(success => (['starter', 'advanced'] as const).flatMap(mode =>
      Array.from({ length: 6 }, (_, i) => buildBattleSound(success, i + 1, false, { mode }))));
    expect(new Set(sounds.map(sound => sound.profile)).size).toBe(18);
    expect(new Set(sounds.map(sound => JSON.stringify(sound.voices))).size).toBe(24);
    expect(buildBattleSound(true, 2).voices.filter(v => v.kind === 'noise').length)
      .toBeGreaterThan(buildBattleSound(true, 1).voices.filter(v => v.kind === 'noise').length);
    expect(buildBattleSound(true, 5).voices.some(v => v.filter === 'lowpass')).toBe(true);
    expect(buildBattleSound(true, 6).voices.some(v => v.phase === 'impact' && v.from > 3000)).toBe(true);
  });

  it('synchronizes release and impact with every normal, ultimate and reduced-motion animation', () => {
    for (const success of [true, false]) for (const reduced of [true, false]) {
      for (const mode of ['starter', 'advanced'] as const) for (const enhanced of [true, false]) {
        for (let theme = 1; theme <= 6; theme++) {
          const sound = buildBattleSound(success, theme, reduced, { mode, ultimate: enhanced, enemyCritical: enhanced });
          const speed = reduced ? 6 : 1;
          expect(Math.min(...sound.voices.filter(v => v.phase === 'launch').map(v => v.at))).toBeCloseTo(.48 / speed);
          expect(Math.min(...sound.voices.filter(v => v.phase === 'impact').map(v => v.at))).toBeCloseTo(.9 / speed);
          expect(sound.voices.every(v => v.at + v.duration + .006 < sound.duration)).toBe(true);
          expect(sound.voices.every(v => v.gain > 0 && v.gain < .3 && v.from > 0 && v.to > 0)).toBe(true);
        }
      }
    }
  });

  it('makes summons and enemy criticals larger, and sends hero/enemy sound in opposite directions', () => {
    const hero = buildBattleSound(true, 5), ultimate = buildBattleSound(true, 5, false, { ultimate: true });
    const enemy = buildBattleSound(false, 5), critical = buildBattleSound(false, 5, false, { enemyCritical: true });
    expect(ultimate.voices.length).toBeGreaterThan(hero.voices.length);
    expect(critical.voices.length).toBeGreaterThan(enemy.voices.length);
    expect(Math.max(...ultimate.voices.map(v => v.at + v.duration))).toBeGreaterThan(2);
    expect(Math.max(...critical.voices.map(v => v.at + v.duration))).toBeLessThan(2.05);
    expect(hero.voices.find(v => v.phase === 'charge')!.pan).toBeLessThan(0);
    expect(hero.voices.find(v => v.phase === 'impact')!.pan).toBeGreaterThan(0);
    expect(enemy.voices.find(v => v.phase === 'charge')!.pan).toBeGreaterThan(0);
    expect(enemy.voices.find(v => v.phase === 'impact')!.pan).toBeLessThan(0);
    const boss = buildBattleSound(false, 5, false, { finalBoss: true });
    expect(boss.voices[0].from).toBeLessThan(enemy.voices[0].from);
  });

  it('keeps each final boss material independent of question theme for normal and critical attacks', () => {
    for (const mode of ['starter', 'advanced'] as const) for (const enemyCritical of [false, true]) {
      const sounds = Array.from({ length: 6 }, (_, i) => buildBattleSound(false, i + 1, false,
        { mode, enemyCritical, finalBoss: true }));
      expect(new Set(sounds.map(sound => JSON.stringify(sound.voices))).size).toBe(1);
      expect(sounds[0].profile).toBe(mode === 'starter' ? 'chaos-grimoire' : 'spectral-dragon');
      expect(sounds[0].enhanced).toBe(enemyCritical);
      expect(buildBattleSound(true, 5, false, { mode, finalBoss: true }).profile).toBe('fire');
    }
  });

  it('plays a passing whistle for dodges and resonant shield tones for blocked hits, without false damage thumps', () => {
    const missed = buildBattleSound(false, 2, false, { enemyCritical: true, missed: true });
    const blocked = buildBattleSound(false, 2, false, { blocked: true });
    expect(missed.voices.filter(v => v.phase === 'impact').map(v => v.filter)).toEqual(['highpass']);
    expect(blocked.voices.filter(v => v.phase === 'impact' && v.kind !== 'noise').every(v => v.kind === 'sine' && v.to > 400)).toBe(true);
    expect(missed.voices.some(v => v.phase === 'impact' && v.kind === 'triangle')).toBe(false);
    expect(blocked.voices.some(v => v.phase === 'impact' && v.kind === 'triangle')).toBe(false);
    expect([missed, blocked].every(sound => !sound.voices.some(v => v.layer === 'contact-snap'))).toBe(true);
  });

  it('adds a precise contact transient for ordinary hits from either side without changing summon layers', () => {
    for (const success of [true, false]) for (const mode of ['starter', 'advanced'] as const) {
      for (let theme = 1; theme <= 6; theme++) {
        const normal = buildBattleSound(success, theme, false, { mode });
        const enhanced = buildBattleSound(success, theme, false, { mode, ultimate: true, enemyCritical: true });
        expect(normal.voices.find(v => v.layer === 'contact-snap')).toMatchObject({
          phase: 'impact', kind: 'noise', at: normal.impact, duration: .07,
        });
        expect(enhanced.voices.some(v => v.layer === 'contact-snap')).toBe(false);
      }
    }
  });

  it('gives firebird casts a creature call, moving wings, timed explosion and sustained crackling burn', () => {
    for (const mode of ['starter', 'advanced'] as const) {
      const cast = buildBattleSound(true, 5, false, { mode, ultimate: true });
      const call = cast.voices.find(voice => voice.kind === 'creature')!;
      expect(call.creature).toBe('phoenix');
      expect(call.at + call.duration).toBeLessThan(cast.impact);
      for (const layer of ['flight', 'wingbeat', 'explosion', 'combustion', 'fire-crackle'])
        expect(cast.voices.some(voice => voice.layer === layer)).toBe(true);
      expect(cast.voices.find(voice => voice.layer === 'explosion')!.at).toBe(cast.impact);
      const fire = cast.voices.find(voice => voice.layer === 'combustion')!;
      expect(fire.envelope).toBe('gust');
      expect(fire.at + fire.duration).toBeGreaterThan(2.5);
      const flight = cast.voices.find(voice => voice.layer === 'flight')!;
      expect(flight.panTo).toBeGreaterThan(flight.pan);
    }
    expect(buildBattleSound(false, 5, false, { mode: 'advanced', enemyCritical: true })
      .voices.some(voice => voice.creature === 'phoenix')).toBe(false);
  });

  it('matches the ice spear and dragon forms, with fractures and blizzard following contact', () => {
    for (const mode of ['starter', 'advanced'] as const) {
      const cast = buildBattleSound(true, 6, false, { mode, ultimate: true });
      expect(cast.voices.some(voice => voice.creature === 'dragon')).toBe(mode === 'advanced');
      for (const layer of ['frost-breath', 'ice-explosion', 'ice-fracture', 'blizzard'])
        expect(cast.voices.some(voice => voice.layer === layer)).toBe(true);
      expect(cast.voices.filter(voice => ['ice-explosion', 'ice-fracture', 'blizzard'].includes(voice.layer ?? ''))
        .every(voice => voice.at >= cast.impact)).toBe(true);
    }
    expect(buildBattleSound(false, 1, false, { mode: 'advanced', finalBoss: true, enemyCritical: true })
      .voices.some(voice => voice.creature === 'dragon')).toBe(true);
  });

  it('uses each other summon material for the aftermath instead of a shared sound', () => {
    const expected = ['seal-slam', 'thunder', 'puzzle-click', 'mirror-shatter'];
    expected.forEach((layer, index) => {
      const cast = buildBattleSound(true, index + 1, false, { ultimate: true });
      expect(cast.voices.some(voice => voice.layer === layer)).toBe(true);
      expect(cast.voices.some(voice => voice.kind === 'creature')).toBe(false);
    });
  });
});

describe('original creature synthesis', () => {
  it('produces bounded, repeatable vocal waveforms with quiet endpoints at tablet and desktop sample rates', () => {
    for (const sampleRate of [8000, 44100]) for (const creature of ['phoenix', 'dragon'] as const) {
      const voice = { creature, from: creature === 'phoenix' ? 680 : 74, to: creature === 'phoenix' ? 470 : 42, duration: .8 };
      const samples = synthesizeCreatureVoice(voice, sampleRate);
      expect(samples).toHaveLength(Math.ceil(sampleRate * voice.duration));
      expect(samples).toEqual(synthesizeCreatureVoice(voice, sampleRate));
      expect(samples.every(value => Number.isFinite(value) && Math.abs(value) <= .841)).toBe(true);
      expect(Math.abs(samples[0])).toBe(0); expect(Math.abs(samples.at(-1)!)).toBeLessThan(.001);
      const power = samples.reduce((sum, value) => sum + value * value, 0) / samples.length;
      expect(power).toBeGreaterThan(.03); expect(power).toBeLessThan(.45);
    }
  });

  it('separates a piercing phoenix call from the low dragon roar', () => {
    const zeroCrossings = (samples: Float32Array) => samples.reduce((total, value, i) =>
      total + (i > 0 && value * samples[i - 1] < 0 ? 1 : 0), 0);
    const bird = synthesizeCreatureVoice({ creature: 'phoenix', from: 680, to: 470, duration: .8 }, 44100);
    const dragon = synthesizeCreatureVoice({ creature: 'dragon', from: 74, to: 42, duration: .8 }, 44100);
    expect(zeroCrossings(bird)).toBeGreaterThan(zeroCrossings(dragon) * 2);
  });
});

describe('supplied sample choreography', () => {
  it('assigns each reference to its visible material while keeping nonmatching skills synthesized', () => {
    expect(buildBattleSampleCues(buildBattleSound(true, 5, false, { ultimate: true })).map(cue => cue.id))
      .toEqual(['phoenix-call', 'fire-feather', 'explosion']);
    expect(buildBattleSampleCues(buildBattleSound(true, 6, false, { ultimate: true, mode: 'advanced' })).map(cue => cue.id))
      .toEqual(['ice-dragon-roar', 'frost-arrow', 'explosion']);
    expect(buildBattleSampleCues(buildBattleSound(true, 6, false, { ultimate: true })).some(cue => cue.id === 'ice-dragon-roar'))
      .toBe(false);
    expect(buildBattleSampleCues(buildBattleSound(false, 1, false, { finalBoss: true, enemyCritical: true, mode: 'advanced' })).map(cue => cue.id))
      .toEqual(['ice-dragon-roar', 'frost-arrow', 'explosion']);
    for (const theme of [2, 3, 4]) expect(buildBattleSampleCues(buildBattleSound(true, theme, false, { ultimate: true })))
      .toEqual([]);
    expect(buildBattleSampleCues(buildBattleSound(false, 5, false, { enemyCritical: true, mode: 'advanced' }))).toEqual([]);
    expect(buildBattleSampleCues(buildBattleSound(true, 1)).map(cue => cue.id)).toEqual(['heavy-impact']);
  });

  it('keeps ready sample replacements synchronized and strictly inside normal, ultimate and reduced cast clocks', () => {
    for (const success of [true, false]) for (const reduced of [true, false]) {
      for (const mode of ['starter', 'advanced'] as const) for (const enhanced of [true, false]) {
        for (let theme = 1; theme <= 6; theme++) {
          const plan = buildBattleSound(success, theme, reduced, { mode, ultimate: enhanced, enemyCritical: enhanced });
          for (const cue of buildBattleSampleCues(plan, reduced)) {
            expect(cue.duration).toBeGreaterThan(0);
            expect(cue.at + cue.duration).toBeLessThan(plan.duration);
            expect(cue.offset).toBeGreaterThanOrEqual(0);
            expect(plan.voices.some(cue.replaces)).toBe(true);
            if (['fire-feather', 'frost-arrow'].includes(cue.id)) expect(cue.at).toBe(.48 / (reduced ? 6 : 1));
            if (['heavy-impact', 'explosion'].includes(cue.id)) expect(cue.at).toBe(plan.impact);
          }
        }
      }
    }
  });

  it('keeps a dodge or shield block free from damage impact samples', () => {
    for (const flag of [{ missed: true }, { blocked: true }]) {
      for (const theme of [1, 6]) {
        const cues = buildBattleSampleCues(buildBattleSound(false, theme, false,
          { mode: 'advanced', finalBoss: true, enemyCritical: true, ...flag }));
        expect(cues.some(cue => ['heavy-impact', 'explosion'].includes(cue.id))).toBe(false);
      }
    }
  });
});

class MockParam {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}
class MockNode {
  connect = vi.fn(); disconnect = vi.fn();
  gain = new MockParam(); frequency = new MockParam(); Q = new MockParam(); pan = new MockParam();
  threshold = new MockParam(); knee = new MockParam(); ratio = new MockParam(); attack = new MockParam(); release = new MockParam();
  type = ''; buffer: unknown; loop = false;
  onended: (() => void) | null = null;
  start = vi.fn(); stop = vi.fn();
}
class MockContext {
  static instances: MockContext[] = [];
  static resumeResult: Promise<void> | null = null;
  currentTime = 10; sampleRate = 8000; state = 'suspended'; destination = new MockNode();
  sources: MockNode[] = []; nodes: MockNode[] = [];
  resume = vi.fn(() => MockContext.resumeResult ?? Promise.resolve());
  close = vi.fn(async () => { this.state = 'closed'; });
  createBuffer = vi.fn((_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }));
  decodeAudioData = vi.fn(async (data: ArrayBuffer) => ({ duration: 1.4, sample: new Uint8Array(data)[0] }));
  constructor() { MockContext.instances.push(this); }
  node() { const node = new MockNode(); this.nodes.push(node); return node; }
  createGain() { return this.node(); }
  createDynamicsCompressor() { return this.node(); }
  createStereoPanner() { return this.node(); }
  createBiquadFilter() { return this.node(); }
  createOscillator() { const node = this.node(); this.sources.push(node); return node; }
  createBufferSource() { const node = this.node(); this.sources.push(node); return node; }
}

describe('battle Web Audio scheduling and cancellation', () => {
  beforeEach(() => {
    vi.resetModules(); MockContext.instances = []; MockContext.resumeResult = null;
    musicDuck.releases = []; musicDuck.acquire.mockReset();
    musicDuck.acquire.mockImplementation(() => { const release = vi.fn(); musicDuck.releases.push(release); return release; });
    vi.stubGlobal('AudioContext', MockContext);
    vi.stubGlobal('document', { baseURI: 'https://school.test/game/' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('unlocks within the tap and schedules oscillator/noise hits on the audio clock, with a compressor and reusable noise', async () => {
    const { battleSound } = await import('./audio');
    battleSound(true, 2, false, { mode: 'advanced', ultimate: true });
    const context = MockContext.instances[0];
    const plan = buildBattleSound(true, 2, false, { mode: 'advanced', ultimate: true });
    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.sources).toHaveLength(plan.voices.length);
    expect(context.createBuffer).toHaveBeenCalledOnce();
    plan.voices.forEach((voice, index) => {
      const source = context.sources[index];
      expect(source.start.mock.calls[0][0]).toBeCloseTo(10 + voice.at);
      expect(source.stop.mock.calls[0][0]).toBeCloseTo(10 + voice.at + voice.duration + .006);
    });
    expect(context.nodes[1].threshold.value).toBe(-10);
    expect(context.nodes[1].ratio.value).toBe(8);
    expect(context.nodes[0].gain.value).toBe(.85);
    battleSound(false, 6);
    expect(context.createBuffer).toHaveBeenCalledOnce();
  });

  it('raises only ordinary hero and enemy mixes while keeping the same compressor headroom', async () => {
    const { battleSound } = await import('./audio');
    for (const success of [true, false]) {
      const before = MockContext.instances[0]?.nodes.length ?? 0;
      battleSound(success, 4);
      const context = MockContext.instances[0];
      expect(context.nodes[before].gain.value).toBe(1.20);
      const limiter = context.nodes[before + 1];
      expect(limiter.threshold.value).toBe(-10);
      expect(limiter.ratio.value).toBe(8);
      const start = context.nodes.length;
      battleSound(success, 4, false, { ultimate: true, enemyCritical: true });
      expect(context.nodes[start].gain.value).toBe(.85);
    }
  });

  it('disconnects finished cast nodes and cancels old queued strikes on a new cast, leaving no delayed hit', async () => {
    const { battleSound, stopBattleSound } = await import('./audio');
    battleSound(true, 6);
    const context = MockContext.instances[0], first = [...context.sources];
    battleSound(false, 6);
    expect(first.every(source => source.stop.mock.calls.length === 2 && source.onended === null)).toBe(true);
    const current = context.sources.slice(first.length);
    for (const source of current) source.onended?.();
    expect(context.nodes.every(node => node.disconnect.mock.calls.length > 0)).toBe(true);
    stopBattleSound();
    expect(current.every(source => source.stop.mock.calls.length === 1)).toBe(true);
  });

  it('ducks music for real casts, restores it once on completion or cancellation, and schedules creature buffers', async () => {
    const { battleSound, stopBattleSound } = await import('./audio');
    battleSound(true, 5, false, { ultimate: true });
    const context = MockContext.instances[0];
    expect(musicDuck.acquire).toHaveBeenLastCalledWith('ultimate');
    expect(context.createBuffer).toHaveBeenCalledTimes(2); // shared noise and original bird voice
    const voiceSources = [...context.sources];
    voiceSources.forEach(source => source.onended?.());
    expect(musicDuck.releases[0]).toHaveBeenCalledOnce();
    stopBattleSound();
    expect(musicDuck.releases[0]).toHaveBeenCalledOnce();
    battleSound(false, 1);
    expect(musicDuck.acquire).toHaveBeenLastCalledWith('attack');
    stopBattleSound();
    expect(musicDuck.releases[1]).toHaveBeenCalledOnce();
  });

  it('closes pending sound on reset and creates a fresh context and noise buffer for the next gesture', async () => {
    const { battleSound, stopAllAudio } = await import('./audio');
    battleSound(false, 3, true, { enemyCritical: true });
    const first = MockContext.instances[0];
    stopAllAudio();
    expect(first.close).toHaveBeenCalledOnce();
    expect(first.sources.every(source => source.stop.mock.calls.length === 2)).toBe(true);
    battleSound(true, 3);
    expect(MockContext.instances).toHaveLength(2);
    expect(MockContext.instances[1].createBuffer).toHaveBeenCalledOnce();
  });

  it('cancels queued sounds if resume is rejected, without cancelling a newer successful cast', async () => {
    let reject!: (reason: Error) => void;
    MockContext.resumeResult = new Promise((_resolve, fail) => { reject = fail; });
    const { battleSound } = await import('./audio');
    battleSound(true, 1);
    const context = MockContext.instances[0], first = [...context.sources];
    MockContext.resumeResult = null;
    battleSound(true, 5);
    const current = context.sources.slice(first.length);
    reject(new Error('gesture expired')); await Promise.resolve();
    expect(first.every(source => source.stop.mock.calls.length === 2)).toBe(true);
    expect(current.every(source => source.stop.mock.calls.length === 1)).toBe(true);
    expect(musicDuck.releases[0]).toHaveBeenCalledOnce();
    expect(musicDuck.releases[1]).not.toHaveBeenCalled();
  });

  it('does not interrupt gameplay when Web Audio is unavailable', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { battleSound } = await import('./audio');
    expect(() => battleSound(true, 1)).not.toThrow();
    expect(MockContext.instances).toHaveLength(0);
  });

  const suppliedFetch = () => vi.fn(async (url: string) => ({ ok: true,
    arrayBuffer: async () => new Uint8Array([Object.values(battleSampleAssets).findIndex(path => url.endsWith(path)) + 1]).buffer }));
  const isSample = (source: MockNode) => !!source.buffer && 'sample' in (source.buffer as object);

  it('preloads and decodes each local excerpt once without unlocking, playing or creating narration elements', async () => {
    const fetch = suppliedFetch(); vi.stubGlobal('fetch', fetch);
    const { preloadBattleSamples } = await import('./audio');
    await Promise.all([preloadBattleSamples(), preloadBattleSamples()]);
    await preloadBattleSamples();
    expect(fetch).toHaveBeenCalledTimes(6);
    const context = MockContext.instances[0];
    expect(context.decodeAudioData).toHaveBeenCalledTimes(6);
    expect(context.resume).not.toHaveBeenCalled();
    expect(context.sources).toHaveLength(0);
    expect(fetch.mock.calls.every(([url]) => url.startsWith('https://school.test/game/sfx/'))).toBe(true);
  });

  it('replaces only the matching synthesized layers and fades every sample before the next-question deadline', async () => {
    vi.stubGlobal('fetch', suppliedFetch());
    const { preloadBattleSamples, battleSound } = await import('./audio');
    await preloadBattleSamples();
    for (const reduced of [true, false]) {
      const context = MockContext.instances[0], before = context.sources.length;
      battleSound(true, 5, reduced, { ultimate: true, mode: 'advanced' });
      const plan = buildBattleSound(true, 5, reduced, { ultimate: true, mode: 'advanced' });
      const cues = buildBattleSampleCues(plan, reduced);
      const sources = context.sources.slice(before), samples = sources.filter(isSample);
      expect(samples).toHaveLength(3);
      expect(sources).toHaveLength(plan.voices.filter(voice => !cues.some(cue => cue.replaces(voice))).length + cues.length);
      samples.forEach((source, i) => {
        expect(source.start).toHaveBeenCalledWith(10 + cues[i].at, cues[i].offset);
        expect(source.stop.mock.calls[0][0]).toBeCloseTo(10 + cues[i].at + cues[i].duration);
        expect(source.stop.mock.calls[0][0]).toBeLessThan(10 + plan.duration);
      });
    }
  });

  it('uses the immediate fallback when decoding is pending, never supplements an old cast, and uses samples on the next tap', async () => {
    let finish!: (response: { ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }) => void;
    const response = new Promise<{ ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }>(resolve => { finish = resolve; });
    vi.stubGlobal('fetch', vi.fn(() => response));
    const { preloadBattleSamples, battleSound, stopBattleSound } = await import('./audio');
    const preloading = preloadBattleSamples();
    battleSound(true, 6, false, { ultimate: true, mode: 'advanced' });
    const context = MockContext.instances[0], count = context.sources.length;
    expect(count).toBe(buildBattleSound(true, 6, false, { ultimate: true, mode: 'advanced' }).voices.length);
    stopBattleSound();
    finish({ ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer });
    await preloading;
    expect(context.sources).toHaveLength(count);
    expect(context.sources.some(isSample)).toBe(false);
    battleSound(true, 6, false, { ultimate: true, mode: 'advanced' });
    expect(context.sources.slice(count).filter(isSample)).toHaveLength(3);
  });

  it('cancels every scheduled excerpt on exit, sound disable, a new cast or reset and restores its own music lease once', async () => {
    vi.stubGlobal('fetch', suppliedFetch());
    const { preloadBattleSamples, battleSound, stopBattleSound, stopAllAudio } = await import('./audio');
    await preloadBattleSamples();
    const context = MockContext.instances[0];
    for (const cancel of [stopBattleSound, () => battleSound(false, 3), stopAllAudio]) {
      const before = context.sources.length;
      battleSound(true, 5, false, { ultimate: true });
      const samples = context.sources.slice(before).filter(isSample), lease = musicDuck.releases.at(-1)!;
      expect(samples).toHaveLength(3);
      cancel(); cancel();
      expect(samples.every(source => source.stop.mock.calls.length === 2 && source.onended === null)).toBe(true);
      expect(lease).toHaveBeenCalledOnce();
      expect(samples.every(source => source.disconnect.mock.calls.length > 0)).toBe(true);
    }
  });

  it('does not install old decoded buffers into a fresh context after a reset', async () => {
    let finish!: (response: { ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }) => void;
    const response = new Promise<{ ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }>(resolve => { finish = resolve; });
    vi.stubGlobal('fetch', vi.fn(() => response));
    const { preloadBattleSamples, battleSound, stopAllAudio } = await import('./audio');
    const preloading = preloadBattleSamples();
    stopAllAudio();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    await preloadBattleSamples();
    finish({ ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer });
    await preloading;
    battleSound(true, 5, false, { ultimate: true });
    expect(MockContext.instances).toHaveLength(2);
    expect(MockContext.instances[1].sources.some(isSample)).toBe(false);
  });

  it('falls back only for unavailable materials and retries a failed offline sample without refetching decoded ones', async () => {
    let arrowAvailable = false;
    const ready = suppliedFetch();
    const fetch = vi.fn(async (url: string) => url.endsWith('/frost-arrow.mp3') && !arrowAvailable
      ? { ok: false, arrayBuffer: async () => new ArrayBuffer(0) } : ready(url));
    vi.stubGlobal('fetch', fetch);
    const { preloadBattleSamples, battleSound, stopBattleSound } = await import('./audio');
    await preloadBattleSamples();
    const context = MockContext.instances[0];
    battleSound(true, 6, false, { ultimate: true, mode: 'advanced' });
    const first = [...context.sources];
    expect(first.filter(isSample)).toHaveLength(2);
    const plan = buildBattleSound(true, 6, false, { ultimate: true, mode: 'advanced' });
    const readyCues = buildBattleSampleCues(plan).filter(cue => cue.id !== 'frost-arrow');
    expect(first).toHaveLength(plan.voices.filter(voice => !readyCues.some(cue => cue.replaces(voice))).length + 2);
    stopBattleSound();
    // Finish the cast's silent retry, then permit the next explicit preload.
    await preloadBattleSamples();
    arrowAvailable = true;
    await preloadBattleSamples();
    const calls = fetch.mock.calls.map(([url]) => url);
    expect(calls.filter(url => url.endsWith('/frost-arrow.mp3')).length).toBeGreaterThan(1);
    for (const path of Object.values(battleSampleAssets).filter(path => !path.endsWith('/frost-arrow.mp3')))
      expect(calls.filter(url => url.endsWith(path))).toHaveLength(1);
    battleSound(true, 6, false, { ultimate: true, mode: 'advanced' });
    expect(context.sources.slice(first.length).filter(isSample)).toHaveLength(3);
  });

  it('ends a shorter decoded asset at its real end and never schedules its fade or stop past the cast deadline', async () => {
    vi.stubGlobal('fetch', suppliedFetch());
    const { preloadBattleSamples, battleSound } = await import('./audio');
    // An excerpt can be shorter after the device decoder trims MP3 padding.
    const preloading = preloadBattleSamples(), context = MockContext.instances[0];
    context.decodeAudioData.mockImplementation(async data => ({ duration: .11, sample: new Uint8Array(data)[0] }));
    await preloading;
    battleSound(true, 5, false, { ultimate: true });
    const samples = context.sources.filter(isSample);
    expect(samples).toHaveLength(3);
    for (const source of samples) {
      expect(source.stop.mock.calls[0][0] - source.start.mock.calls[0][0]).toBeCloseTo(.11);
      expect(source.stop.mock.calls[0][0]).toBeLessThan(13);
    }
    expect(context.nodes.some(node => node.gain.linearRampToValueAtTime.mock.calls.some(([value, at]) => value === 0 && at > 10)))
      .toBe(true);
  });
});
