import { afterEach, describe, expect, it, vi } from 'vitest';
import { installLegacyViewportHeight } from './legacyViewport';

function browser(supportsDvh = false, height = 1024) {
  const values = new Map<string, string>();
  const style = {
    getPropertyValue: (name: string) => values.get(name) ?? '',
    setProperty: vi.fn((name: string, value: string) => { values.set(name, value); }),
    removeProperty: vi.fn((name: string) => { values.delete(name); }),
  };
  let nextId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const win = Object.assign(new EventTarget(), {
    innerHeight: height,
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextId, callback); return nextId;
    }),
    cancelAnimationFrame: vi.fn((id: number) => { frames.delete(id); }),
  });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', { documentElement: { style } });
  vi.stubGlobal('CSS', { supports: () => supportsDvh });
  return { win, style, values, frames, flush: () => {
    const pending = [...frames.values()]; frames.clear();
    pending.forEach(callback => callback(0));
  } };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('legacy viewport height', () => {
  it('leaves modern browsers on native dvh without listeners or inline heights', () => {
    const env = browser(true); const add = vi.spyOn(env.win, 'addEventListener');
    installLegacyViewportHeight()();
    expect(env.style.setProperty).not.toHaveBeenCalled(); expect(add).not.toHaveBeenCalled();
  });

  it('fills the actual browser content height when dvh is unsupported', () => {
    const env = browser(false, 963); const stop = installLegacyViewportHeight();
    expect(env.values.get('--legacy-viewport-height')).toBe('963px'); stop();
  });

  it('coalesces rotation/resize and reads the final height after the browser relayout', () => {
    const env = browser(); const stop = installLegacyViewportHeight();
    env.win.dispatchEvent(new Event('orientationchange'));
    env.win.innerHeight = 687; env.win.dispatchEvent(new Event('resize'));
    expect(env.frames.size).toBe(1); env.flush();
    expect(env.values.get('--legacy-viewport-height')).toBe('687px');
    env.win.innerHeight = 963; env.win.dispatchEvent(new Event('resize')); env.flush();
    expect(env.values.get('--legacy-viewport-height')).toBe('963px'); stop();
  });

  it('refreshes on pageshow and ignores transient zero/invalid browser sizes', () => {
    const env = browser(); const stop = installLegacyViewportHeight();
    for (const height of [0, -1, NaN, Infinity]) {
      env.win.innerHeight = height; env.win.dispatchEvent(new Event('resize')); env.flush();
      expect(env.values.get('--legacy-viewport-height')).toBe('1024px');
    }
    env.win.innerHeight = 998; env.win.dispatchEvent(new Event('pageshow')); env.flush();
    expect(env.values.get('--legacy-viewport-height')).toBe('998px'); stop();
  });

  it('cancels queued work and removes every listener on disposal', () => {
    const env = browser(); const remove = vi.spyOn(env.win, 'removeEventListener');
    const stop = installLegacyViewportHeight(); env.win.dispatchEvent(new Event('resize'));
    stop(); env.flush();
    expect(env.frames.size).toBe(0); expect(env.values.has('--legacy-viewport-height')).toBe(false);
    expect(remove.mock.calls.map(call => call[0])).toEqual(['resize', 'orientationchange', 'pageshow']);
    env.win.dispatchEvent(new Event('resize')); expect(env.frames.size).toBe(0);
  });

  it('restores a pre-existing custom property when disposed', () => {
    const env = browser(); env.values.set('--legacy-viewport-height', '777px');
    installLegacyViewportHeight()(); expect(env.values.get('--legacy-viewport-height')).toBe('777px');
  });
});
