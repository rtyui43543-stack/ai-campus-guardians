import { appAssetUrl } from './urls';

export const BATTLE_MUSIC_EVENT = 'battle-music-status';
export interface BattleMusicStatus { playing: boolean; error?: string }

const NORMAL_VOLUME = .27;
const DUCKED_VOLUME = .09;
let player: HTMLAudioElement | null = null;
let wanted = false;
let ducked = false;
let generation = 0;
let pending: Promise<void> | null = null;
let listening = false;

function report(status: BattleMusicStatus) {
  window.dispatchEvent(new CustomEvent<BattleMusicStatus>(BATTLE_MUSIC_EVENT, { detail: status }));
}

function getPlayer() {
  if (!player) {
    player = new Audio();
    player.src = appAssetUrl('/music/battle-theme.wav');
    player.hidden = true;
    player.loop = true;
    player.preload = 'auto';
    player.setAttribute('aria-hidden', 'true');
    player.setAttribute('data-testid', 'battle-music');
    player.addEventListener('error', () => {
      if (wanted && document.visibilityState !== 'hidden') {
        report({ playing: false, error: '戰鬥音樂尚未準備好，請確認離線內容已下載，再按音樂按鈕重試。' });
      }
    });
    document.body.appendChild(player);
  }
  player.volume = ducked ? DUCKED_VOLUME : NORMAL_VOLUME;
  return player;
}

function visibilityChanged() {
  if (document.visibilityState === 'hidden') {
    generation += 1;
    pending = null;
    player?.pause();
    report({ playing: false });
  } else if (wanted) {
    // A blocked automatic resume is reported; the music button can retry on a gesture.
    void startBattleMusic().catch(() => {});
  }
}

function listen() {
  if (listening) return;
  listening = true;
  document.addEventListener('visibilitychange', visibilityChanged);
  window.addEventListener('pagehide', stopBattleMusic);
}

/** Start the single bundled loop. Rejections let the UI offer a manual playback retry. */
export function startBattleMusic(): Promise<void> {
  wanted = true;
  listen();
  if (document.visibilityState === 'hidden') {
    report({ playing: false });
    return Promise.resolve();
  }
  if (pending) return pending;
  const audio = getPlayer();
  if (!audio.paused) { report({ playing: true }); return Promise.resolve(); }
  const attempt = ++generation;
  // Keep play() in the initiating click stack for mobile browser audio policies.
  let playback: Promise<void>;
  try { playback = audio.play(); }
  catch (cause) { playback = Promise.reject(cause); }
  const task = playback.then(() => {
    if (!wanted || document.visibilityState === 'hidden') { audio.pause(); return; }
    if (attempt === generation) report({ playing: !audio.paused });
  }).catch((cause: unknown) => {
    if (!wanted || attempt !== generation || document.visibilityState === 'hidden') return;
    const message = '音樂未能播放，請按音樂按鈕重試。';
    report({ playing: false, error: message });
    throw new Error(message, { cause });
  }).finally(() => {
    if (pending === task) pending = null;
  });
  pending = task;
  return task;
}

/** Stop when leaving a battle or muting music. A pending play cannot restart it. */
export function stopBattleMusic(): void {
  wanted = false;
  generation += 1;
  pending = null;
  player?.pause();
  if (player) {
    try { player.currentTime = 0; } catch { /* A still-loading clip may not be seekable. */ }
  }
  if (listening) {
    document.removeEventListener('visibilitychange', visibilityChanged);
    window.removeEventListener('pagehide', stopBattleMusic);
    listening = false;
  }
  report({ playing: false });
}

/** Lower the instrumental while narration is playing without changing its setting. */
export function setBattleMusicDucked(value: boolean): void {
  ducked = value;
  if (player) player.volume = ducked ? DUCKED_VOLUME : NORMAL_VOLUME;
}
