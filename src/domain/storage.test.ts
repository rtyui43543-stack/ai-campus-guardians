import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getQuestions } from '../content';
import {
  advanceSession, applySession, battleHealth, chooseAction, createProgress, currentQuestion,
  demonstrate, finishSession, restartBattle, retryQuestion, startSession, submitAction,
} from './engine';
import type { Progress, Session } from './types';

const V1_KEY = 'ai-campus-guardians:progress:v1';
const V2_KEY = 'ai-campus-guardians:progress:v2';

function solve(session: Session): Session {
  return submitAction(chooseAction(session, Number(Object.keys(currentQuestion(session).valid)[0])));
}
function wrong(session: Session): Session {
  const q = currentQuestion(session);
  return submitAction(chooseAction(session, q.choices.findIndex((_, index) => !q.valid[index]?.length)));
}
function reachSlot(levelId: number, slot: number): Session {
  let session = startSession(levelId, 'starter');
  while (currentQuestion(session).slot < slot) session = advanceSession(solve(session)).session!;
  return session;
}
function finalProposal(): Progress {
  let session = startSession(12, 'advanced');
  for (let slot = 1; slot < 5; slot++) session = advanceSession(solve(session)).session!;
  session = solve(session);
  const progress = finishSession(createProgress(), session);
  progress.proposals.push({
    at: progress.updatedAt, mode: 'advanced', reflection: '',
    decisions: progress.attempts.map(record => {
      const q = getQuestions(12).find(item => item.id === record.questionId)!;
      return { questionId: record.questionId, action: q.choices[record.action].text, reason: '' };
    }),
  });
  return progress;
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

function delayedIndexedDb() {
  let stored: unknown;
  let writing = 0;
  let maxWriting = 0;
  let writeCount = 0;
  const openedNames: string[] = [];
  const readKeys: string[] = [];
  const writeKeys: string[] = [];
  const db = {
    objectStoreNames: { contains: () => true }, close: () => {}, onversionchange: null,
    transaction: () => {
      const tx = {
        oncomplete: null as (() => void) | null, onerror: null, onabort: null,
        objectStore: () => ({
          put: (value: unknown, key: string) => {
            writeKeys.push(key);
            const snapshot = structuredClone(value);
            writing++;
            maxWriting = Math.max(maxWriting, writing);
            writeCount++;
            setTimeout(() => { stored = snapshot; writing--; tx.oncomplete?.(); }, writeCount === 1 ? 25 : 1);
          },
          get: (key: string) => {
            readKeys.push(key);
            const request = { result: undefined as unknown };
            setTimeout(() => { request.result = structuredClone(stored); tx.oncomplete?.(); }, 1);
            return request;
          },
        }),
      };
      return tx;
    },
  };
  const factory = {
    open: (name: string) => {
      openedNames.push(name);
      const request = { result: db, onsuccess: null as (() => void) | null, onerror: null, onblocked: null, onupgradeneeded: null };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
  return { factory: factory as unknown as IDBFactory, maxWriting: () => maxWriting, openedNames, readKeys, writeKeys };
}

describe('new campaign storage and backups', () => {
  beforeEach(() => { vi.resetModules(); vi.stubGlobal('indexedDB', undefined); vi.stubGlobal('localStorage', new MemoryStorage()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('round-trips a selected action and successful feedback without a second reason stage', async () => {
    const storage = await import('./storage');
    const scene = reachSlot(8, 4);
    const selected = chooseAction(scene, Number(Object.keys(currentQuestion(scene).valid)[0]));
    for (const checkpoint of [selected, submitAction(selected)]) {
      const original = applySession(createProgress(), checkpoint);
      const restored = storage.parseBackup(storage.exportBackup(original));
      expect(restored).toEqual(original);
      expect(restored).not.toBe(original);
      expect(restored.active?.reason).toBeNull();
      await storage.saveProgress(original);
      expect(await storage.loadProgress()).toEqual(original);
      expect(battleHealth(restored.active!)).toEqual(battleHealth(checkpoint));
    }
  });

  it('round-trips wrong-answer feedback, demonstration state and completed practice records', async () => {
    const storage = await import('./storage');
    const checkpoints = [wrong(startSession(1, 'starter')), demonstrate(startSession(7, 'advanced'))];
    for (const session of checkpoints) {
      const progress = applySession(createProgress(), session);
      expect(storage.parseBackup(storage.exportBackup(progress))).toEqual(progress);
    }
    const next = advanceSession(checkpoints[1]).session!;
    const progress = applySession(createProgress(), next);
    expect(storage.parseBackup(storage.exportBackup(progress))).toEqual(progress);
    expect(progress.active?.records[0].status).toBe('practice');
    expect(retryQuestion(checkpoints[0]).step).toBe('action');
  });

  it('saves and imports zero-HP defeat with earlier answers intact, then restarts that same level', async () => {
    const storage = await import('./storage');
    const prior = { ...reachSlot(8, 4), shield: 4 };
    const defeated = wrong(prior);
    expect(defeated).toMatchObject({ step: 'defeat', shield: 0, index: 3 });
    const original = applySession(createProgress(), defeated);
    const restored = storage.parseBackup(storage.exportBackup(original));
    expect(restored).toEqual(original);
    expect(restored.active!.records).toEqual(prior.records);
    expect(restored.active!.selected).toBe(defeated.selected);
    expect(restored.active!.feedback).toBe(defeated.feedback);
    await storage.saveProgress(original);
    expect(await storage.loadProgress()).toEqual(original);
    expect(battleHealth((await storage.loadProgress()).active!)).toEqual({ playerHp: 0, enemyHp: 40 });
    const restarted = restartBattle(restored);
    expect(restarted.active).toMatchObject({ levelId: 8, mode: 'advanced', shield: 100, index: 0, step: 'action' });
    expect(storage.parseBackup(storage.exportBackup(restarted))).toEqual(restarted);
  });

  it('accepts previous 8-HP saves and new surviving HP below 8 without changing their answers', async () => {
    const storage = await import('./storage');
    for (const shield of [8, 4, 1]) {
      const session = { ...wrong(startSession(1, 'starter')), shield };
      const original = applySession(createProgress(), session);
      expect(storage.parseBackup(storage.exportBackup(original))).toEqual(original);
      expect(retryQuestion(storage.validateProgress(original).active!)).toMatchObject({ step: 'action', shield });
    }
  });

  it('rejects zero HP outside defeat and rejects defeat with surviving HP', async () => {
    const storage = await import('./storage');
    const zeroAction = applySession(createProgress(), { ...startSession(1, 'starter'), shield: 0 });
    const zeroFeedback = applySession(createProgress(), { ...wrong(startSession(1, 'starter')), shield: 0 });
    const survivingDefeat = applySession(createProgress(), { ...wrong(startSession(1, 'starter')), step: 'defeat', shield: 8 });
    for (const value of [zeroAction, zeroFeedback, survivingDefeat]) {
      expect(() => storage.validateProgress(value)).toThrow('零血量與挑戰結束');
    }
  });

  it('rejects forged defeat answers, missing choices and missing wrong-answer history', async () => {
    const storage = await import('./storage');
    const depleted = { ...startSession(1, 'starter'), shield: 4 };
    const base = applySession(createProgress(), wrong(depleted));
    const success = structuredClone(base);
    success.active!.success = true;
    expect(() => storage.validateProgress(success)).toThrow('成功狀態');
    const validChoice = structuredClone(base);
    validChoice.active!.selected = Number(Object.keys(currentQuestion(depleted).valid)[0]);
    expect(() => storage.validateProgress(validChoice)).toThrow('錯誤回饋');
    const missingChoice = structuredClone(base);
    missingChoice.active!.selected = null;
    expect(() => storage.validateProgress(missingChoice)).toThrow('缺少行動');
    const missingRetries = structuredClone(base);
    missingRetries.active!.retries = 0;
    expect(() => storage.validateProgress(missingRetries)).toThrow('缺少重試');
    const demo = structuredClone(base);
    demo.active!.demoUsed = true;
    expect(() => storage.validateProgress(demo)).toThrow('示範狀態');
  });

  it('isolates new progress from old saved data and rejects old backups explicitly', async () => {
    const storage = await import('./storage');
    const legacy = JSON.stringify({ ...createProgress(), schemaVersion: 1, completed: [1, 18] });
    localStorage.setItem(V1_KEY, legacy);
    expect((await storage.loadProgress()).completed).toEqual([]);
    expect(() => storage.parseBackup(legacy)).toThrow('舊版十八關備份');
    await storage.saveProgress(createProgress());
    expect(localStorage.getItem(V1_KEY)).toBe(legacy);
    expect(JSON.parse(localStorage.getItem(V2_KEY)!).schemaVersion).toBe(2);
  });

  it('migrates auto narration saves to manual reading without losing the active challenge', async () => {
    const storage = await import('./storage');
    const oldProgress = applySession(createProgress(), solve(startSession(2, 'starter')));
    const old = JSON.parse(JSON.stringify(oldProgress));
    delete old.settings.music;
    old.settings.narration = true;
    const migrated = storage.parseBackup(JSON.stringify(old));
    expect(migrated.active).toEqual(oldProgress.active);
    expect(migrated.settings).toMatchObject({ narration: false, music: true });
    expect(storage.parseBackup(storage.exportBackup({ ...migrated, settings: { ...migrated.settings, music: false } })).settings.music).toBe(false);
    expect(() => storage.parseBackup(JSON.stringify({ ...old, settings: { ...old.settings, music: 'on' } }))).toThrow(storage.MalformedBackupError);
  });

  it('does not read or overwrite the old IndexedDB database or record key', async () => {
    const simulated = delayedIndexedDb();
    vi.stubGlobal('indexedDB', simulated.factory);
    const storage = await import('./storage');
    await storage.loadProgress();
    await storage.saveProgress(createProgress());
    expect(simulated.openedNames).toEqual(['ai-campus-guardians-v2']);
    expect(simulated.readKeys).toEqual(['main-campaign-v2']);
    expect(simulated.writeKeys).toEqual(['main-campaign-v2']);
  });

  it('ignores corrupted old saves while retaining corrupted new saves for recovery', async () => {
    const storage = await import('./storage');
    localStorage.setItem(V1_KEY, '{broken-old');
    expect((await storage.loadProgress()).schemaVersion).toBe(2);
    expect(localStorage.getItem(V1_KEY)).toBe('{broken-old');
    localStorage.setItem(V2_KEY, '{broken-new');
    await expect(storage.loadProgress()).rejects.toThrow(storage.MalformedBackupError);
    expect(localStorage.getItem(V2_KEY)).toBe('{broken-new');
    expect(() => storage.parseBackup('null')).toThrow(storage.MalformedBackupError);
  });

  it.each([
    ['unknown schema', (p: Record<string, unknown>) => { p.schemaVersion = 3; }],
    ['unknown level', (p: Record<string, unknown>) => { p.completed = [13]; }],
    ['duplicate level', (p: Record<string, unknown>) => { p.completed = [1, 1]; }],
    ['bad settings', (p: Record<string, unknown>) => { p.settings = { mode: 'easy', sound: true, narration: true, reducedMotion: false }; }],
    ['bad date', (p: Record<string, unknown>) => { p.updatedAt = 'not a date'; }],
  ])('rejects %s instead of silently resetting progress', async (_name, mutate) => {
    const storage = await import('./storage');
    const raw = JSON.parse(JSON.stringify(createProgress())) as Record<string, unknown>;
    mutate(raw);
    expect(() => storage.parseBackup(JSON.stringify(raw))).toThrow(storage.MalformedBackupError);
  });

  it('rejects unknown questions, invalid choices, missing array entries and a wrong active index', async () => {
    const storage = await import('./storage');
    const base = applySession(createProgress(), startSession(1, 'starter'));
    const unknown = structuredClone(base);
    unknown.active!.questionIds[0] = 'V2L99Q01';
    expect(() => storage.validateProgress(unknown)).toThrow('未知題目');
    const badChoice = structuredClone(base);
    badChoice.active!.selected = 4;
    expect(() => storage.validateProgress(badChoice)).toThrow('超出有效範圍');
    const badIndex = structuredClone(base);
    badIndex.active!.index = 5;
    expect(() => storage.validateProgress(badIndex)).toThrow('超出有效範圍');
    const sparse = createProgress();
    sparse.completed = new Array<number>(1);
    expect(() => storage.validateProgress(sparse)).toThrow('缺漏項目');
  });

  it('rejects a shuffled question sequence, wrong review sequence or mismatched difficulty', async () => {
    const storage = await import('./storage');
    const base = applySession(createProgress(), startSession(7, 'advanced'));
    const shuffled = structuredClone(base);
    shuffled.active!.questionIds.reverse();
    expect(() => storage.validateProgress(shuffled)).toThrow('題目順序');
    const wrongMode = structuredClone(base);
    wrongMode.active!.mode = 'starter';
    expect(() => storage.validateProgress(wrongMode)).toThrow('模式與關卡不符');
    const wrongReview = structuredClone(base);
    wrongReview.active!.review = true;
    expect(() => storage.validateProgress(wrongReview)).toThrow('練習模式');
  });

  it('rejects forged success, obsolete reason stages and invalid battle state', async () => {
    const storage = await import('./storage');
    const base = applySession(createProgress(), wrong(startSession(1, 'starter')));
    const forged = structuredClone(base);
    forged.active!.success = true;
    expect(() => storage.validateProgress(forged)).toThrow('成功狀態');
    const reasonStep = applySession(createProgress(), startSession(7, 'advanced'));
    reasonStep.active!.step = 'reason';
    expect(() => storage.validateProgress(reasonStep)).toThrow('直接作答階段');
    const reason = applySession(createProgress(), solve(startSession(7, 'advanced')));
    reason.active!.reason = 0;
    expect(() => storage.validateProgress(reason)).toThrow('第二次理由');
    const shield = structuredClone(base);
    shield.active!.shield = -1;
    expect(() => storage.validateProgress(shield)).toThrow('超出有效範圍');
  });

  it('rejects inconsistent learning records rather than treating help as first understanding', async () => {
    const storage = await import('./storage');
    const session = advanceSession(demonstrate(startSession(7, 'advanced'))).session!;
    const progress = applySession(createProgress(), session);
    const forgedFirst = structuredClone(progress);
    forgedFirst.active!.records[0].status = 'first';
    expect(() => storage.validateProgress(forgedFirst)).toThrow('首次理解');
    const mismatch = structuredClone(progress);
    mismatch.active!.records[0].mode = 'starter';
    expect(() => storage.validateProgress(mismatch)).toThrow('模式與關卡不符');
    const wrongAnswer = structuredClone(progress);
    const q = getQuestions(7)[0];
    wrongAnswer.active!.records[0].action = q.choices.findIndex((_, index) => !q.valid[index]?.length);
    expect(() => storage.validateProgress(wrongAnswer)).toThrow('有效的作答');
    const badOrder = structuredClone(progress);
    badOrder.active!.records[0].questionId = getQuestions(7)[1].id;
    badOrder.active!.records[0].action = Number(Object.keys(getQuestions(7)[1].valid)[0]);
    expect(() => storage.validateProgress(badOrder)).toThrow('題目順序');
  });

  it('rejects an already finished active session and inconsistent completed-question count', async () => {
    const storage = await import('./storage');
    const base = applySession(createProgress(), reachSlot(8, 3));
    const finished = structuredClone(base);
    finished.finishedSessionIds = [base.active!.id];
    expect(() => storage.validateProgress(finished)).toThrow('已經完成');
    const repaired = structuredClone(base);
    repaired.active!.repaired = 20;
    expect(() => storage.validateProgress(repaired)).toThrow('修復進度');
    const missingRecord = structuredClone(base);
    missingRecord.active!.records.pop();
    expect(() => storage.validateProgress(missingRecord)).toThrow('題目順序');
  });

  it('accepts only the five valid ordered final mission decisions in proposals', async () => {
    const storage = await import('./storage');
    const progress = finalProposal();
    expect(storage.parseBackup(storage.exportBackup(progress))).toEqual(progress);
    const unknown = structuredClone(progress);
    unknown.proposals[0].decisions[0].action = 'unrecognized choice';
    expect(() => storage.validateProgress(unknown)).toThrow('未知或不合適');
    const wrongLevel = structuredClone(progress);
    wrongLevel.proposals[0].decisions[0].questionId = getQuestions(11)[0].id;
    expect(() => storage.validateProgress(wrongLevel)).toThrow('非終章');
    const shuffled = structuredClone(progress);
    shuffled.proposals[0].decisions.reverse();
    expect(() => storage.validateProgress(shuffled)).toThrow('題目順序');
    const reason = structuredClone(progress);
    reason.proposals[0].decisions[0].reason = 'an obsolete second answer';
    expect(() => storage.validateProgress(reason)).toThrow('理由欄應留空');
  });

  it('serializes asynchronous saves and snapshots values at call time', async () => {
    const simulated = delayedIndexedDb();
    vi.stubGlobal('indexedDB', simulated.factory);
    const storage = await import('./storage');
    const older = createProgress();
    const newer = createProgress();
    newer.settings.mode = 'advanced';
    const first = storage.saveProgress(older);
    const second = storage.saveProgress(newer);
    newer.settings.mode = 'starter';
    await Promise.all([first, second]);
    expect(simulated.maxWriting()).toBe(1);
    expect((await storage.loadProgress()).settings.mode).toBe('advanced');
  });

  it('reports unavailable storage, then permits the next save after a failed queued operation', async () => {
    vi.stubGlobal('localStorage', undefined);
    const storage = await import('./storage');
    await expect(storage.saveProgress(createProgress())).rejects.toThrow('無法保存進度');
    vi.stubGlobal('localStorage', new MemoryStorage());
    await storage.saveProgress(createProgress());
    expect((await storage.loadProgress()).schemaVersion).toBe(2);
  });
});
