export interface BattleHapticHit {
  damage: number;
  target: 'hero' | 'enemy';
  enhanced: boolean;
  reducedMotion: boolean;
  impactMs: number;
}

/** A short contact pulse, followed by the heavier impact and its aftershock. */
export function battleHapticPattern(target: BattleHapticHit['target'], enhanced: boolean): number[] {
  if (enhanced) return target === 'hero' ? [65, 25, 85, 25, 40] : [50, 25, 75, 25, 35];
  return target === 'hero' ? [45, 25, 70] : [30, 20, 50];
}

/** Optional device feedback; unsupported browsers still receive the arena's visual recoil. */
export function scheduleBattleHaptics(hit: BattleHapticHit): () => void {
  const noop = () => {};
  if (hit.reducedMotion || !Number.isFinite(hit.damage) || hit.damage <= 0 ||
      typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function' ||
      typeof document === 'undefined' || document.hidden) return noop;
  const preference = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : undefined;
  if (preference?.matches) return noop;

  let ended = false;
  let vibrating = false;
  const vibrate = (pattern: number | number[]) => {
    try { return navigator.vibrate(pattern); } catch { return false; }
  };
  const stop = () => {
    if (ended) return;
    ended = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', stop);
    preference?.removeEventListener?.('change', onPreference);
    if (vibrating) vibrate(0);
  };
  const onVisibility = () => { if (document.hidden) stop(); };
  const onPreference = () => { if (preference?.matches) stop(); };
  const timer = setTimeout(() => {
    if (ended || document.hidden || preference?.matches) { stop(); return; }
    vibrating = vibrate(battleHapticPattern(hit.target, hit.enhanced));
  }, Math.max(0, hit.impactMs));
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', stop);
  preference?.addEventListener?.('change', onPreference);
  return stop;
}
