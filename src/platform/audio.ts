import { appAssetUrl } from './urls';
import { acquireBattleMusicDuck, setBattleMusicDucked } from './music';
import { buildBattleSound, type BattleSoundOptions } from './battleSoundDesign';
import { synthesizeCreatureVoice } from './creatureVoice';
import { battleSampleAssets, buildBattleSampleCues, type BattleSampleId } from './battleSamples';

let audioIndex: Record<string, string> = {};
let loaded: Promise<void> | null = null;
let player: HTMLAudioElement | null = null;
let context: AudioContext | null = null;
let narrationRequest = 0;
export interface NarrationState {
  readonly requestId: number;
  readonly phase: 'idle' | 'loading' | 'playing';
  readonly key: string | null;
  readonly error?: string;
}
let narrationState: NarrationState = { requestId: 0, phase: 'idle', key: null };
const narrationListeners = new Set<(state: NarrationState) => void>();
let disposeNarration: (() => void) | null = null;

export const getNarrationState = () => narrationState;
export function subscribeNarration(listener: (state: NarrationState) => void): () => void {
  narrationListeners.add(listener);
  listener(narrationState);
  return () => { narrationListeners.delete(listener); };
}
function reportNarration(phase: NarrationState['phase'], key: string | null, error?: string) {
  narrationState = { requestId: narrationRequest, phase, key, ...(error ? { error } : {}) };
  for (const listener of narrationListeners) listener(narrationState);
}
let activeBattleStop: (() => void) | null = null;
let noiseBuffer: AudioBuffer | null = null;
let noiseContext: AudioContext | null = null;
let sampleContext: AudioContext | null = null;
let sampleGeneration = 0;
const sampleBuffers = new Map<BattleSampleId, AudioBuffer>();
const sampleLoads = new Map<BattleSampleId, Promise<void>>();

function soundContext(): AudioContext {
  const Context = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) throw new Error('Audio feedback is unavailable.');
  if (!context || context.state === 'closed') context = new Context();
  return context;
}

function prepareSampleContext(current: AudioContext): number {
  if (sampleContext !== current) {
    sampleContext = current;
    sampleGeneration++;
    sampleBuffers.clear(); sampleLoads.clear();
  }
  return sampleGeneration;
}

/** Decode silently before combat. A late download is never allowed to start a cast. */
export async function preloadBattleSamples(): Promise<void> {
  try {
    const current = soundContext(), generation = prepareSampleContext(current);
    const loads = (Object.keys(battleSampleAssets) as BattleSampleId[]).map(id => {
      if (sampleBuffers.has(id)) return Promise.resolve();
      const existing = sampleLoads.get(id);
      if (existing) return existing;
      const load = (async () => {
        const response = await fetch(appAssetUrl(battleSampleAssets[id]));
        if (!response.ok) throw new Error('Battle sample is not cached yet.');
        const buffer = await current.decodeAudioData(await response.arrayBuffer());
        if (generation === sampleGeneration && current === sampleContext && current.state !== 'closed')
          sampleBuffers.set(id, buffer);
      })().catch(() => { /* The existing generated material remains available offline. */ })
        .finally(() => { if (generation === sampleGeneration) sampleLoads.delete(id); });
      sampleLoads.set(id, load);
      return load;
    });
    await Promise.all(loads);
  } catch { /* Audio support is optional, including silent preloading. */ }
}

/** Stop the current cast as soon as the player leaves the arena or disables sound. */
export function stopBattleSound(): void {
  activeBattleStop?.();
  activeBattleStop = null;
}
export function loadAudio() {
  loaded ??= fetch(appAssetUrl('/audio/index.json')).then(async r => {
    if (!r.ok) throw new Error('朗讀索引尚未下載。');
    audioIndex = await r.json();
  }).catch(() => { loaded = null; });
  return loaded;
}
function pauseNarration() {
  const dispose = disposeNarration;
  disposeNarration = null; player = null;
  dispose?.();
  setBattleMusicDucked(false);
}
/** Loading counts as narration so an answer timer pauses before the first await. */
export function stopAudio() {
  narrationRequest++; pauseNarration(); reportNarration('idle', null);
}
/** A progress reset also stops scheduled synthesized battle sounds; later gestures create a fresh context. */
export function stopAllAudio(): void {
  stopAudio();
  stopBattleSound();
  const previous = context;
  context = null;
  noiseBuffer = null; noiseContext = null;
  sampleContext = null; sampleGeneration++;
  sampleBuffers.clear(); sampleLoads.clear();
  if (previous) void previous.close().catch(() => { /* Reset does not depend on optional sound support. */ });
}
export async function playAudio(key: string): Promise<void> {
  if (narrationState.phase !== 'idle' && narrationState.key === key) { stopAudio(); return; }
  const request = ++narrationRequest;
  pauseNarration();
  reportNarration('loading', key);
  let local: HTMLAudioElement | null = null;
  let disposeLocal: (() => void) | null = null;
  try {
    await loadAudio();
    if (request !== narrationRequest) return;
    const asset = audioIndex[key];
    if (!asset) throw new Error('這段朗讀尚未準備好，請確認已完成離線下載。');
    // A fresh element isolates pending play() promises and queued media events.
    // A stopped old request can never pause or finish a newer narration.
    local = new Audio();
    const current = local;
    const isCurrent = () => request === narrationRequest && current === player;
    const finish = (error?: string) => {
      if (!isCurrent()) return;
      pauseNarration(); reportNarration('idle', null, error);
    };
    const ended = () => finish();
    const paused = () => { if (current.paused) finish(); };
    const failed = () => finish('這段朗讀播放失敗，請確認離線內容已下載，再按朗讀重試。');
    const playing = () => { if (isCurrent()) reportNarration('playing', key); };
    disposeLocal = () => {
      current.removeEventListener('ended', ended); current.removeEventListener('pause', paused);
      current.removeEventListener('error', failed); current.removeEventListener('playing', playing);
      current.pause();
      try { current.currentTime = 0; } catch { /* A clip that failed to load may not be seekable. */ }
      current.remove?.();
    };
    player = current; disposeNarration = disposeLocal;
    current.hidden = true; current.preload = 'auto';
    current.setAttribute('aria-hidden','true');
    current.setAttribute('data-testid','offline-narration');
    current.addEventListener('ended', ended); current.addEventListener('pause', paused);
    current.addEventListener('error', failed); current.addEventListener('playing', playing);
    current.src = appAssetUrl(asset);
    document.body.appendChild(current);
    setBattleMusicDucked(true);
    await current.play();
    if (!isCurrent()) { disposeLocal(); return; }
    if (current.paused) finish(); else reportNarration('playing', key);
  } catch (error) {
    if (request !== narrationRequest) return;
    // An earlier media error can already have released the pause reason.
    if (local && local !== player && narrationState.phase === 'idle') return;
    pauseNarration();
    reportNarration('idle', null, error instanceof Error ? error.message : '朗讀播放失敗，請重試。');
    throw error;
  }
}
export function tone(success: boolean) {
  try {
    const current = soundContext();
    void current.resume().catch(() => { /* Audio feedback is optional. */ });
    const start = current.currentTime;
    (success ? [523.25, 659.25, 783.99] : [392, 349.23]).forEach((hz, i) => {
      const oscillator = current.createOscillator(), gain = current.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = hz;
      gain.gain.setValueAtTime(0, start + i * .1);
      gain.gain.linearRampToValueAtTime(.08, start + i * .1 + .025);
      gain.gain.exponentialRampToValueAtTime(.001, start + i * .1 + .25);
      oscillator.connect(gain); gain.connect(current.destination);
      oscillator.start(start + i * .1); oscillator.stop(start + i * .1 + .3);
    });
  } catch { /* Audio feedback is optional. */ }
}

function battleNoise(current: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseContext === current) return noiseBuffer;
  noiseContext = current;
  noiseBuffer = current.createBuffer(1, Math.ceil(current.sampleRate * 2), current.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  let seed = 0x465853;
  for (let i = 0; i < data.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    data[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
  }
  return noiseBuffer;
}

export function battleSound(success: boolean, theme: number, reducedMotion = false, options: BattleSoundOptions = {}) {
  stopBattleSound();
  try {
    const current = soundContext();
    // Resume in the actual answer gesture (also on iOS); schedule against the
    // frozen AudioContext clock without awaiting a promise outside that gesture.
    const resumed = current.resume();
    const start = current.currentTime;
    const plan = buildBattleSound(success, theme, reducedMotion, options);
    prepareSampleContext(current);
    // Snapshot only ready buffers. Fetch/decode completion can benefit a future
    // gesture, but must not insert sound into this cast or the next question.
    const sampleCues = buildBattleSampleCues(plan, reducedMotion).flatMap(cue => {
      const buffer = sampleBuffers.get(cue.id);
      const duration = buffer ? Math.min(cue.duration, buffer.duration - cue.offset) : 0;
      return buffer && duration > .01 ? [{ ...cue, duration, buffer }] : [];
    });
    void preloadBattleSamples();
    const releaseMusic = acquireBattleMusicDuck(plan.enhanced ? 'ultimate' : 'attack');
    const nodes: AudioNode[] = [];
    const sources = new Set<AudioScheduledSourceNode>();
    let stopped = false;
    const cleanup = () => {
      if (stopped) return;
      stopped = true;
      releaseMusic();
      for (const source of sources) { source.onended = null; try { source.stop(); } catch { /* Already ended. */ } }
      sources.clear();
      for (const node of nodes) node.disconnect();
      if (activeBattleStop === cleanup) activeBattleStop = null;
    };
    activeBattleStop = cleanup;
    void resumed.catch(cleanup);

    const mix = current.createGain(), limiter = current.createDynamicsCompressor();
    nodes.push(mix, limiter);
    // Normal casts need a clear strike above the quarter-volume music bed.
    // Summons/criticals already have dense layers and keep their existing mix.
    mix.gain.value = plan.enhanced ? .85 : 1.20;
    limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 8;
    limiter.attack.value = .003; limiter.release.value = .14;
    mix.connect(limiter); limiter.connect(current.destination);
    const trackSource = (source: AudioScheduledSourceNode, end: number) => {
      sources.add(source);
      source.onended = () => {
        sources.delete(source); source.disconnect();
        if (sources.size === 0) cleanup();
      };
      source.stop(end);
    };
    plan.voices.filter(voice => !sampleCues.some(cue => cue.replaces(voice))).forEach((voice, index) => {
      const at = start + voice.at, end = at + voice.duration;
      const gain = current.createGain(); nodes.push(gain);
      gain.gain.setValueAtTime(0, at);
      const attack = voice.envelope === 'swell' ? voice.duration * .32 : Math.min(.012, voice.duration * .15);
      gain.gain.linearRampToValueAtTime(voice.gain, at + attack);
      if (voice.envelope === 'gust') {
        // Broad swells give fire a rushing burn and frost a moving wind instead
        // of an exponentially fading click. Values share the audio clock.
        [.58, .92, .63, .85, .43].forEach((level, i) =>
          gain.gain.linearRampToValueAtTime(voice.gain * level, at + voice.duration * (.17 + i * .14)));
      } else if (voice.envelope) {
        gain.gain.linearRampToValueAtTime(voice.gain * .78, at + voice.duration * .7);
      }
      gain.gain.exponentialRampToValueAtTime(.0001, end);
      if (current.createStereoPanner) {
        const pan = current.createStereoPanner(); nodes.push(pan);
        pan.pan.setValueAtTime(voice.pan, at);
        if (voice.panTo !== undefined) pan.pan.linearRampToValueAtTime(voice.panTo, end);
        gain.connect(pan); pan.connect(mix);
      } else gain.connect(mix);
      let source: AudioScheduledSourceNode;
      if (voice.kind === 'creature') {
        const call = current.createBufferSource(); nodes.push(call); source = call;
        const samples = synthesizeCreatureVoice(voice, current.sampleRate);
        const buffer = current.createBuffer(1, samples.length, current.sampleRate);
        buffer.getChannelData(0).set(samples);
        call.buffer = buffer; call.connect(gain); call.start(at);
      } else if (voice.kind === 'noise') {
        const noise = current.createBufferSource(), filter = current.createBiquadFilter();
        nodes.push(noise, filter); source = noise;
        noise.buffer = battleNoise(current); noise.loop = true;
        filter.type = voice.filter ?? 'bandpass'; filter.Q.value = voice.resonance ?? .8;
        filter.frequency.setValueAtTime(voice.from, at);
        filter.frequency.exponentialRampToValueAtTime(voice.to, end);
        noise.connect(filter); filter.connect(gain);
        noise.start(at, (index * .131) % 1);
      } else {
        const oscillator = current.createOscillator(); nodes.push(oscillator); source = oscillator;
        oscillator.type = voice.kind;
        oscillator.frequency.setValueAtTime(voice.from, at);
        oscillator.frequency.exponentialRampToValueAtTime(voice.to, end);
        oscillator.connect(gain); oscillator.start(at);
      }
      trackSource(source, Math.min(end + .006, start + plan.duration));
    });
    sampleCues.forEach(cue => {
      const at = start + cue.at, end = at + cue.duration;
      const source = current.createBufferSource(), gain = current.createGain();
      nodes.push(source, gain); source.buffer = cue.buffer;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(cue.gain, at + Math.min(.006, cue.duration * .1));
      gain.gain.setValueAtTime(cue.gain, end - Math.min(.045, cue.duration * .22));
      gain.gain.linearRampToValueAtTime(0, end);
      if (current.createStereoPanner) {
        const pan = current.createStereoPanner(); nodes.push(pan);
        pan.pan.setValueAtTime(cue.pan, at);
        if (cue.panTo !== undefined) pan.pan.linearRampToValueAtTime(cue.panTo, end);
        gain.connect(pan); pan.connect(mix);
      } else gain.connect(mix);
      source.connect(gain); source.start(at, cue.offset);
      trackSource(source, end);
    });
  } catch { stopBattleSound(); /* Optional offline synthesized effects. */ }
}
