import { appAssetUrl } from './urls';
import { setBattleMusicDucked } from './music';

let audioIndex: Record<string, string> = {};
let loaded: Promise<void> | null = null;
let player: HTMLAudioElement | null = null;
let context: AudioContext | null = null;
let narrationRequest = 0;
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
  const previous = context;
  context = null;
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
    context ??= new AudioContext();
    void context.resume();
    const start = context.currentTime;
    (success ? [523.25, 659.25, 783.99] : [392, 349.23]).forEach((hz, i) => {
      const oscillator = context!.createOscillator(), gain = context!.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = hz;
      gain.gain.setValueAtTime(0, start + i * .1);
      gain.gain.linearRampToValueAtTime(.08, start + i * .1 + .025);
      gain.gain.exponentialRampToValueAtTime(.001, start + i * .1 + .25);
      oscillator.connect(gain); gain.connect(context!.destination);
      oscillator.start(start + i * .1); oscillator.stop(start + i * .1 + .3);
    });
  } catch { /* Audio feedback is optional. */ }
}

export function battleSound(success: boolean, theme: number, reducedMotion = false) {
  try {
    context ??= new AudioContext();
    void context.resume();
    const start = context.currentTime;
    const note = (offset: number, from: number, to: number, duration: number, type: OscillatorType, volume: number) => {
      const oscillator = context!.createOscillator(), gain = context!.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, start + offset);
      oscillator.frequency.exponentialRampToValueAtTime(to, start + offset + duration);
      gain.gain.setValueAtTime(0, start + offset);
      gain.gain.linearRampToValueAtTime(volume, start + offset + .02);
      gain.gain.exponentialRampToValueAtTime(.001, start + offset + duration);
      oscillator.connect(gain); gain.connect(context!.destination);
      oscillator.start(start + offset); oscillator.stop(start + offset + duration + .03);
    };
    if (reducedMotion) { note(0, success ? 660 : 280, success ? 880 : 190, .22, 'sine', .06); return; }
    const pitch = 280 + theme * 65;
    note(.04, pitch, pitch * 2.3, .38, 'sine', .035);
    note(.4, success ? 680 : 420, success ? 180 : 140, .4, 'triangle', .045);
    note(.88, success ? 160 : 115, 48, .25, 'triangle', .07);
    if (success) [1, 1.25, 1.5].forEach((ratio,i) => note(.99 + i * .055, 440 * ratio, 660 * ratio, .3, 'sine', .035));
  } catch { /* Optional offline synthesized effects. */ }
}
