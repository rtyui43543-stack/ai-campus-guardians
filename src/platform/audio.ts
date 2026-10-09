import { appAssetUrl } from './urls';
import { acquireBattleMusicDuck, setBattleMusicDucked } from './music';
import { buildBattleSound, type BattleSoundOptions } from './battleSoundDesign';
import { synthesizeCreatureVoice } from './creatureVoice';

let audioIndex: Record<string, string> = {};
let loaded: Promise<void> | null = null;
let player: HTMLAudioElement | null = null;
let context: AudioContext | null = null;
let narrationRequest = 0;
let activeBattleStop: (() => void) | null = null;
let noiseBuffer: AudioBuffer | null = null;
let noiseContext: AudioContext | null = null;

function soundContext(): AudioContext {
  const Context = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) throw new Error('Audio feedback is unavailable.');
  if (!context || context.state === 'closed') context = new Context();
  return context;
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
function pauseNarration() { player?.pause(); if (player) player.currentTime = 0; setBattleMusicDucked(false); }
export function stopAudio() { narrationRequest++; pauseNarration(); }
/** A progress reset also stops scheduled synthesized battle sounds; later gestures create a fresh context. */
export function stopAllAudio(): void {
  stopAudio();
  stopBattleSound();
  const previous = context;
  context = null;
  noiseBuffer = null; noiseContext = null;
  if (previous) void previous.close().catch(() => { /* Reset does not depend on optional sound support. */ });
}
export async function playAudio(key: string): Promise<void> {
  const request = ++narrationRequest;
  await loadAudio();
  if (request !== narrationRequest) return;
  const asset = audioIndex[key];
  if (!asset) throw new Error('這段朗讀尚未準備好，請確認已完成離線下載。');
  const url = appAssetUrl(asset);
  if (player && !player.paused && player.src === url) { stopAudio(); return; }
  pauseNarration();
  if (!player) {
    player = new Audio();
    player.hidden = true; player.preload = 'auto';
    player.setAttribute('aria-hidden','true');
    player.setAttribute('data-testid','offline-narration');
    player.addEventListener('ended', () => setBattleMusicDucked(false));
    player.addEventListener('pause', () => { if (player?.paused) setBattleMusicDucked(false); });
    player.addEventListener('error', () => setBattleMusicDucked(false));
    document.body.appendChild(player);
  }
  player.src = url;
  setBattleMusicDucked(true);
  try { await player.play(); } catch (error) {
    if (request !== narrationRequest) return;
    setBattleMusicDucked(false); throw error;
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
    mix.gain.value = .85;
    limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 8;
    limiter.attack.value = .003; limiter.release.value = .14;
    mix.connect(limiter); limiter.connect(current.destination);
    plan.voices.forEach((voice, index) => {
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
      sources.add(source);
      source.onended = () => {
        sources.delete(source); source.disconnect();
        if (sources.size === 0) cleanup();
      };
      source.stop(end + .006);
    });
  } catch { stopBattleSound(); /* Optional offline synthesized effects. */ }
}
