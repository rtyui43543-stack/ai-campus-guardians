import { appAssetUrl } from './urls';

export const BATTLE_MUSIC_EVENT = 'battle-music-status';
export const MUSIC_EVENT = 'game-music-status';
export type MusicTrack = 'adventure' | 'battle';
export interface BattleMusicStatus { playing: boolean; error?: string }
export interface MusicStatus extends BattleMusicStatus { track: MusicTrack | null }

const TRACKS = {
  adventure: { file: 'adventure-theme.wav', volume: .20, ducked: .06 },
  battle: { file: 'battle-theme.wav', volume: .27, ducked: .09 },
} as const;
const players: Partial<Record<MusicTrack, HTMLAudioElement>> = {};
let wantedTrack: MusicTrack | null = null;
let ducked = false;
let generation = 0;
let pending: Promise<void> | null = null;
let listening = false;

function report(status: MusicStatus) {
  window.dispatchEvent(new CustomEvent<MusicStatus>(MUSIC_EVENT, { detail: status }));
  const legacy: BattleMusicStatus = { playing: status.playing && status.track === 'battle' };
  if (status.error && status.track === 'battle') legacy.error = status.error;
  window.dispatchEvent(new CustomEvent<BattleMusicStatus>(BATTLE_MUSIC_EVENT, { detail: legacy }));
}

function getPlayer(track: MusicTrack) {
  let player = players[track];
  if (!player) {
    player = new Audio();
    player.src = appAssetUrl('/music/' + TRACKS[track].file);
    player.hidden = true;
    player.loop = true;
    player.preload = 'auto';
    player.setAttribute('aria-hidden', 'true');
    player.setAttribute('data-testid', track + '-music');
    player.addEventListener('error', () => {
      if (wantedTrack === track && document.visibilityState !== 'hidden') {
        report({ track, playing: false, error: '背景音樂尚未準備好，請確認離線內容已下載，再按音樂按鈕重試。' });
      }
    });
    players[track] = player;
    document.body.appendChild(player);
  }
  player.volume = ducked ? TRACKS[track].ducked : TRACKS[track].volume;
  return player;
}

function pausePlayers(reset: boolean, except?: MusicTrack) {
  for (const [track, player] of Object.entries(players)) {
    if (track === except) continue;
    player.pause();
    if (reset) {
      try { player.currentTime = 0; } catch { /* A still-loading clip may not be seekable. */ }
    }
  }
}

function visibilityChanged() {
  if (document.visibilityState === 'hidden') {
    generation += 1;
    pending = null;
    pausePlayers(false);
    report({ track: wantedTrack, playing: false });
  } else if (wantedTrack) {
    // A blocked automatic resume is reported; the music button can retry on a gesture.
    void startMusic(wantedTrack).catch(() => {});
  }
}

function listen() {
  if (listening) return;
  listening = true;
  document.addEventListener('visibilitychange', visibilityChanged);
  window.addEventListener('pagehide', stopMusic);
}

/** Start one bundled track, pausing the other before playing so they never overlap. */
export function startMusic(track: MusicTrack): Promise<void> {
  if (wantedTrack !== track) {
    generation += 1;
    pending = null;
    pausePlayers(true, track);
  }
  wantedTrack = track;
  listen();
  if (document.visibilityState === 'hidden') {
    report({ track, playing: false });
    return Promise.resolve();
  }
  if (pending) return pending;
  const audio = getPlayer(track);
  if (!audio.paused) { report({ track, playing: true }); return Promise.resolve(); }
  const attempt = ++generation;
  // Keep play() in the initiating click stack for mobile browser audio policies.
  let playback: Promise<void>;
  try { playback = audio.play(); }
  catch (cause) { playback = Promise.reject(cause); }
  const task = playback.then(() => {
    if (wantedTrack !== track || document.visibilityState === 'hidden') { audio.pause(); return; }
    if (attempt === generation) report({ track, playing: !audio.paused });
  }).catch((cause: unknown) => {
    if (wantedTrack !== track || attempt !== generation || document.visibilityState === 'hidden') return;
    const message = '音樂未能播放，請按音樂按鈕重試。';
    report({ track, playing: false, error: message });
    throw new Error(message, { cause });
  }).finally(() => {
    if (pending === task) pending = null;
  });
  pending = task;
  return task;
}

export const startBattleMusic = () => startMusic('battle');
export const startAdventureMusic = () => startMusic('adventure');

/** Stop on the cover, during stories, or when muted. Pending playback cannot restart it. */
export function stopMusic(): void {
  wantedTrack = null;
  generation += 1;
  pending = null;
  pausePlayers(true);
  if (listening) {
    document.removeEventListener('visibilitychange', visibilityChanged);
    window.removeEventListener('pagehide', stopMusic);
    listening = false;
  }
  report({ track: null, playing: false });
}

// Kept for narration and existing battle integrations; both share the same music preference.
export const stopBattleMusic = stopMusic;
export function setBattleMusicDucked(value: boolean): void {
  ducked = value;
  for (const [track, player] of Object.entries(players)) {
    const setting = TRACKS[track as MusicTrack];
    player.volume = ducked ? setting.ducked : setting.volume;
  }
}
