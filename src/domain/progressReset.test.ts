import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advanceSession, applySession, chooseAction, createProgress, currentQuestion, finalBossUnlocked, finishSession, selectUltimate, startFinalBossSession, startSession, submitAction } from './engine';
import type { Progress } from './types';
import { forgetOpening, hasSeenOpening, rememberOpening } from '../platform/openingStory';
import { screenFromHash } from '../platform/navigation';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear = vi.fn(() => this.values.clear());
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

function memoryDatabase(initial?: Progress, failWrites: boolean | ((value: unknown) => boolean) = false) {
  let stored: unknown = initial;
  const db = {
    objectStoreNames: { contains: () => true }, close: vi.fn(), onversionchange: null,
    transaction: () => {
      const transaction = { oncomplete: null as (() => void) | null, onabort: null as (() => void) | null, onerror: null, error: null,
        objectStore: () => ({
          put: (value: unknown) => {
            const snapshot = structuredClone(value);
            setTimeout(() => { if (typeof failWrites === 'function' ? failWrites(snapshot) : failWrites) transaction.onabort?.(); else { stored = snapshot; transaction.oncomplete?.(); } }, 5);
          },
          delete: () => { queueMicrotask(() => { stored = undefined; transaction.oncomplete?.(); }); },
          get: () => {
            const request = { result: undefined as unknown };
            queueMicrotask(() => { request.result = structuredClone(stored); transaction.oncomplete?.(); });
            return request;
          },
        }),
      };
      return transaction;
    },
  };
  return { factory: { open: () => {
    const request = { result: db, onsuccess: null as (() => void) | null, onerror: null, onblocked: null, onupgradeneeded: null };
    queueMicrotask(() => request.onsuccess?.()); return request;
  } } as unknown as IDBFactory, value: () => stored };
}

function populated(): Progress {
  let progress = createProgress();
  for (let level = 1; level <= 14; level++) {
    const mode = level >= 7 && level <= 12 || level === 14 ? 'advanced' : 'starter';
    let session = level > 12 ? startFinalBossSession(progress, mode) : startSession(level, mode);
    while (true) {
      if (level > 12 && session.energy === 3) session = selectUltimate(session, 1);
      session = submitAction(chooseAction(session, Number(Object.keys(currentQuestion(session).valid)[0])));
      const next = advanceSession(session);
      if (next.finished) { progress = finishSession(progress, session); break; }
      session = next.session!;
    }
  }
  progress.settings = { mode: 'advanced', sound: false, music: false, narration: false, reducedMotion: true };
  const proposalRun = progress.runs!.find(run => run.levelId === 12)!;
  progress.proposals.push({ at: proposalRun.at, mode: 'advanced', reflection: '我的學習反思', decisions: proposalRun.records.map(record => {
    const question = currentQuestion({ ...startSession(12, 'advanced'), questionIds: [record.questionId], index: 0 });
    return { questionId: question.id, action: question.choices[record.action!].text, reason: '' };
  }) });
  return applySession(progress, startFinalBossSession(progress, 'advanced'));
}

describe('global learning reset', () => {
  let local: MemoryStorage;
  beforeEach(() => {
    vi.resetModules(); local = new MemoryStorage();
    vi.stubGlobal('localStorage', local); vi.stubGlobal('indexedDB', undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('clears all 14 levels, both spell collections, every run and proposal while copying all preferences', async () => {
    const { resetLearningProgress } = await import('./progressReset');
    const previous = populated();
    const original = structuredClone(previous);
    expect(previous.completed).toHaveLength(14);
    expect(previous.ultimateCards).toHaveLength(12);
    const fresh = resetLearningProgress(previous);
    expect(fresh.completed).toEqual([]); expect(fresh.attempts).toEqual([]);
    expect(fresh.active).toBeNull(); expect(fresh.proposals).toEqual([]);
    expect(fresh.runs).toEqual([]); expect(fresh.finishedSessionIds).toEqual([]);
    expect(fresh.ultimateCards).toEqual([]); expect(fresh.settings).toEqual(previous.settings);
    expect(fresh.settings).not.toBe(previous.settings);
    expect(finalBossUnlocked(fresh, 'starter')).toBe(false);
    expect(finalBossUnlocked(fresh, 'advanced')).toBe(false);
    expect(previous).toEqual(original);
  });

  it('saves after queued old checkpoints and cannot resume an old battle or result on reload', async () => {
    const storage = await import('./storage');
    const { resetLearningProgress, persistLearningReset } = await import('./progressReset');
    const old = populated();
    const earlierWrite = storage.saveProgress(old);
    const fresh = resetLearningProgress(old);
    await persistLearningReset(fresh); await earlierWrite;
    const restored = await storage.loadProgress();
    expect(restored).toEqual(fresh);
    expect(screenFromHash('#battle', { battle: !!restored.active, results: !!restored.runs?.length })).toBe('cover');
    expect(screenFromHash('#results', { battle: !!restored.active, results: !!restored.runs?.length })).toBe('cover');
    expect(local.clear).not.toHaveBeenCalled();
  });

  it('replaces both IndexedDB and the local fallback, so either reload path has no old session', async () => {
    const database = memoryDatabase(); vi.stubGlobal('indexedDB', database.factory);
    const storage = await import('./storage');
    const { resetLearningProgress, persistLearningReset } = await import('./progressReset');
    const previous = populated();
    const oldSave = storage.saveProgress(previous);
    const fresh = resetLearningProgress(previous);
    await persistLearningReset(fresh); await oldSave;
    expect(database.value()).toEqual(fresh);
    expect(storage.parseBackup(local.getItem('ai-campus-guardians:progress:v2')!)).toEqual(fresh);
    expect((await storage.loadProgress()).active).toBeNull();
  });

  it('rolls back a successful fallback reset when the existing IndexedDB checkpoint cannot be replaced', async () => {
    const previous = populated(); const database = memoryDatabase(previous, true);
    vi.stubGlobal('indexedDB', database.factory);
    const { resetLearningProgress, persistLearningReset } = await import('./progressReset');
    const { exportBackup, loadProgress, parseBackup } = await import('./storage');
    const backup = exportBackup(previous); local.setItem('ai-campus-guardians:progress:v2', backup);
    await expect(persistLearningReset(resetLearningProgress(previous))).rejects.toMatchObject({ rollbackComplete: true });
    expect(database.value()).toEqual(previous);
    expect(local.getItem('ai-campus-guardians:progress:v2')).toBe(backup);
    expect(parseBackup(local.getItem('ai-campus-guardians:progress:v2')!)).toEqual(previous);
    expect((await loadProgress()).active?.id).toBe(previous.active?.id);
  });

  it('rolls back a successful IndexedDB reset when the existing local checkpoint cannot be replaced', async () => {
    const previous = populated(); const database = memoryDatabase(previous);
    vi.stubGlobal('indexedDB', database.factory);
    const { resetLearningProgress, persistLearningReset } = await import('./progressReset');
    const { exportBackup, loadProgress } = await import('./storage');
    const backup = exportBackup(previous); local.setItem('ai-campus-guardians:progress:v2', backup);
    const set = local.setItem.bind(local);
    vi.spyOn(local, 'setItem').mockImplementation((key, value) => {
      if (key === 'ai-campus-guardians:progress:v2' && JSON.parse(value).completed.length === 0) throw new Error('local write denied');
      set(key, value);
    });
    await expect(persistLearningReset(resetLearningProgress(previous))).rejects.toMatchObject({ rollbackComplete: true });
    expect(database.value()).toEqual(previous);
    expect(local.getItem('ai-campus-guardians:progress:v2')).toBe(backup);
    expect((await loadProgress()).active?.id).toBe(previous.active?.id);
    vi.stubGlobal('indexedDB', undefined); vi.resetModules();
    await expect((await import('./storage')).loadProgress()).resolves.toEqual(previous);
  });

  it('reports incomplete rollback honestly if the changed primary store also rejects restoration', async () => {
    const previous = populated();
    const database = memoryDatabase(previous, value => (value as Progress).completed.length > 0);
    vi.stubGlobal('indexedDB', database.factory);
    const { resetLearningProgress, persistLearningReset } = await import('./progressReset');
    const { exportBackup } = await import('./storage');
    const backup = exportBackup(previous); local.setItem('ai-campus-guardians:progress:v2', backup);
    vi.spyOn(local, 'setItem').mockImplementation(() => { throw new Error('local write denied'); });
    let failure: Error & { rollbackComplete?: boolean } | undefined;
    try { await persistLearningReset(resetLearningProgress(previous)); } catch (cause) { failure = cause as typeof failure; }
    expect(failure?.rollbackComplete).toBe(false);
    expect(failure?.message).toContain('部分存檔無法確認還原');
    expect(failure?.message).not.toContain('原有存檔已確認保留');
    expect((database.value() as Progress).active).toBeNull();
    expect(local.getItem('ai-campus-guardians:progress:v2')).toBe(backup);
  });

  it('performs no reset writes when an existing checkpoint cannot be read safely', async () => {
    const previous = populated(); const database = memoryDatabase(previous);
    vi.stubGlobal('indexedDB', database.factory);
    const { resetLearningProgress, persistLearningReset } = await import('./progressReset');
    vi.spyOn(local, 'getItem').mockImplementation(() => { throw new Error('local read denied'); });
    await expect(persistLearningReset(resetLearningProgress(previous))).rejects.toMatchObject({ rollbackComplete: true });
    expect(database.value()).toEqual(previous);
  });

  it('preserves downloaded content keys and unrelated preferences while restarting the opening story', async () => {
    const storage = await import('./storage');
    const { resetLearningProgress, persistLearningReset } = await import('./progressReset');
    local.setItem('offline-pack-ready', 'keep-downloaded-pack');
    local.setItem('school-font-preference', 'large');
    const deleteCache = vi.fn(); vi.stubGlobal('caches', { delete: deleteCache });
    rememberOpening(); expect(hasSeenOpening()).toBe(true);
    await persistLearningReset(resetLearningProgress(populated())); forgetOpening();
    expect(hasSeenOpening()).toBe(false);
    expect(local.getItem('offline-pack-ready')).toBe('keep-downloaded-pack');
    expect(local.getItem('school-font-preference')).toBe('large');
    expect((await storage.loadProgress()).settings.reducedMotion).toBe(true);
    expect(local.clear).not.toHaveBeenCalled();
    expect(deleteCache).not.toHaveBeenCalled();
  });

  it('keeps the pre-reset exported backup valid and able to restore the whole previous campaign', async () => {
    const storage = await import('./storage');
    const { resetLearningProgress, persistLearningReset } = await import('./progressReset');
    const previous = populated(); const backup = storage.exportBackup(previous);
    await persistLearningReset(resetLearningProgress(previous));
    const restoredBackup = storage.parseBackup(backup);
    expect(restoredBackup).toEqual(previous);
    await storage.saveProgress(restoredBackup);
    expect(await storage.loadProgress()).toEqual(previous);
  });
});
