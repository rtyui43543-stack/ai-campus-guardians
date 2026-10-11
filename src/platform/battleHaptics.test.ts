import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { battleHapticPattern, scheduleBattleHaptics, type BattleHapticHit } from './battleHaptics';

describe('contact haptics', () => {
  let doc: EventTarget & { hidden: boolean };
  let preference: EventTarget & { matches: boolean };
  let win: EventTarget & { matchMedia: ReturnType<typeof vi.fn> };
  let vibrate: ReturnType<typeof vi.fn>;
  const hit: BattleHapticHit = { damage: 25, target: 'enemy', enhanced: false, reducedMotion: false, impactMs: 900 };
  beforeEach(() => {
    vi.useFakeTimers();
    doc = Object.assign(new EventTarget(), { hidden: false });
    preference = Object.assign(new EventTarget(), { matches: false });
    win = Object.assign(new EventTarget(), { matchMedia: vi.fn(() => preference) });
    vibrate = vi.fn(() => true);
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', win);
    vi.stubGlobal('navigator', { vibrate });
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it.each(['hero', 'enemy'] as const)('synchronizes %s contact at 900ms without repeating', target => {
    const stop = scheduleBattleHaptics({ ...hit, target });
    vi.advanceTimersByTime(899); expect(vibrate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(vibrate).toHaveBeenCalledExactlyOnceWith(battleHapticPattern(target, false));
    vi.advanceTimersByTime(3000); expect(vibrate).toHaveBeenCalledTimes(1);
    stop(); expect(vibrate).toHaveBeenLastCalledWith(0);
    stop(); expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it('uses a stronger but bounded pattern for ultimates and pursuit hits', () => {
    for (const target of ['hero', 'enemy'] as const) {
      const ordinary = battleHapticPattern(target, false), enhanced = battleHapticPattern(target, true);
      expect(enhanced.reduce((a, b) => a + b, 0)).toBeGreaterThan(ordinary.reduce((a, b) => a + b, 0));
      expect(enhanced.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(250);
      expect(enhanced.every(value => value > 0 && value <= 85)).toBe(true);
    }
    const stop = scheduleBattleHaptics({ ...hit, target: 'hero', enhanced: true });
    vi.advanceTimersByTime(900);
    expect(vibrate).toHaveBeenCalledWith([65, 25, 85, 25, 40]); stop();
  });

  it.each([0, -1, NaN, Infinity])('ignores non-damaging or invalid damage %s', damage => {
    scheduleBattleHaptics({ ...hit, damage }); vi.runAllTimers(); expect(vibrate).not.toHaveBeenCalled();
  });
  it('respects both app and system reduced motion', () => {
    scheduleBattleHaptics({ ...hit, reducedMotion: true });
    preference.matches = true; scheduleBattleHaptics(hit);
    vi.runAllTimers(); expect(vibrate).not.toHaveBeenCalled();
  });
  it('cancels if reduced motion is enabled before contact', () => {
    scheduleBattleHaptics(hit); vi.advanceTimersByTime(500);
    preference.matches = true; preference.dispatchEvent(new Event('change'));
    vi.runAllTimers(); expect(vibrate).not.toHaveBeenCalled();
  });
  it('stops an active pulse if reduced motion is enabled', () => {
    scheduleBattleHaptics(hit); vi.advanceTimersByTime(900);
    preference.matches = true; preference.dispatchEvent(new Event('change'));
    expect(vibrate).toHaveBeenLastCalledWith(0);
  });
  it('never starts while hidden', () => {
    doc.hidden = true; scheduleBattleHaptics(hit); vi.runAllTimers(); expect(vibrate).not.toHaveBeenCalled();
  });
  it('cancels pending contact when the page hides and does not replay on return', () => {
    scheduleBattleHaptics(hit); vi.advanceTimersByTime(500);
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
    vi.runAllTimers(); expect(vibrate).not.toHaveBeenCalled();
  });
  it('cancels an ongoing pulse on pagehide', () => {
    scheduleBattleHaptics(hit); vi.advanceTimersByTime(900);
    win.dispatchEvent(new Event('pagehide')); expect(vibrate).toHaveBeenLastCalledWith(0);
  });
  it('cancels pending contact when navigating, unmounting or replacing the cue', () => {
    const stop = scheduleBattleHaptics(hit); vi.advanceTimersByTime(400); stop();
    vi.runAllTimers(); expect(vibrate).not.toHaveBeenCalled();
    scheduleBattleHaptics({ ...hit, target: 'hero' }); vi.advanceTimersByTime(900);
    expect(vibrate).toHaveBeenCalledExactlyOnceWith(battleHapticPattern('hero', false));
  });
  it('handles an unsupported device without throwing', () => {
    vi.stubGlobal('navigator', {});
    expect(() => { scheduleBattleHaptics(hit)(); vi.runAllTimers(); }).not.toThrow();
  });
  it('handles a browser without matchMedia', () => {
    vi.stubGlobal('window', new EventTarget()); const stop = scheduleBattleHaptics(hit);
    vi.advanceTimersByTime(900); expect(vibrate).toHaveBeenCalledTimes(1); stop();
  });
  it.each(['refused', 'throws'])('does not interrupt combat when the device %s vibration', result => {
    if (result === 'throws') vibrate.mockImplementation(() => { throw new Error('unavailable'); });
    else vibrate.mockReturnValue(false);
    const stop = scheduleBattleHaptics(hit);
    expect(() => vi.runAllTimers()).not.toThrow(); expect(() => stop()).not.toThrow();
    expect(vibrate).toHaveBeenCalledTimes(1);
  });
});
