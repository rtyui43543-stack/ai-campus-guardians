import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBattleSound } from './battleSoundDesign';

vi.mock('./music', () => ({ setBattleMusicDucked: vi.fn() }));

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
    vi.stubGlobal('AudioContext', MockContext);
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
    battleSound(false, 6);
    expect(context.createBuffer).toHaveBeenCalledOnce();
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
  });

  it('does not interrupt gameplay when Web Audio is unavailable', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { battleSound } = await import('./audio');
    expect(() => battleSound(true, 1)).not.toThrow();
    expect(MockContext.instances).toHaveLength(0);
  });
});
