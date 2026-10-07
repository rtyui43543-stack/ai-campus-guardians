import { getQuestions, presentQuestion, questionById } from '../content';
import { levels } from '../content/levels';
import { createProgress } from './engine';
import type { AttemptRecord, Mode, Progress, Proposal, Session } from './types';

// Level numbers now describe a different curriculum. Preserve v1 without mapping it into v2.
const DB_NAME = 'ai-campus-guardians-v2';
const STORE_NAME = 'progress';
const MAIN_KEY = 'main-campaign-v2';
const LOCAL_KEY = 'ai-campus-guardians:progress:v2';

export class MalformedBackupError extends Error {
  constructor(detail: string) {
    super(`備份格式不正確：${detail}。原有進度未被更改。`);
    this.name = 'MalformedBackupError';
  }
}

function reject(detail: string): never { throw new MalformedBackupError(detail); }
function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return reject(`${path}不是物件`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return reject(`${path}不是一般資料物件`);
  return value as Record<string, unknown>;
}
function list(value: unknown, path: string, max = 50000): unknown[] {
  if (!Array.isArray(value) || value.length > max) return reject(`${path}不是有效的清單`);
  for (let i = 0; i < value.length; i++) if (!Object.prototype.hasOwnProperty.call(value, i)) reject(`${path}含有缺漏項目`);
  return value;
}
function text(value: unknown, path: string, max = 30000, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0) || value.length > max) return reject(`${path}不是有效文字`);
  return value;
}
function integer(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) return reject(`${path}超出有效範圍`);
  return value;
}
function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') return reject(`${path}不是開關值`);
  return value;
}
function mode(value: unknown, path: string): Mode {
  if (value !== 'starter' && value !== 'advanced') return reject(`${path}不是有效模式`);
  return value;
}
function timestamp(value: unknown, path: string): string {
  const result = text(value, path, 40);
  const parsed = new Date(result);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== result) return reject(`${path}不是有效時間`);
  return result;
}
function question(id: unknown, path: string, selectedMode: Mode) {
  const idText = text(id, path, 30);
  const source = questionById.get(idText);
  if (!source) return reject(`${path}包含未知題目`);
  if (levels.find(level => level.id === source.levelId)?.mode !== selectedMode) return reject(`${path}的初階或進階模式與關卡不符`);
  return presentQuestion(source, selectedMode);
}
function selectedIndex(value: unknown, path: string, count: number): number | null {
  return value === null ? null : integer(value, path, 0, count - 1);
}

function attempt(value: unknown, path: string): AttemptRecord {
  const raw = object(value, path);
  const selectedMode = mode(raw.mode, `${path}.mode`);
  const q = question(raw.questionId, `${path}.questionId`, selectedMode);
  const action = integer(raw.action, `${path}.action`, 0, q.choices.length - 1);
  if (raw.reason !== null) reject(`${path}新版題目採直接選答，不能有第二次理由作答`);
  const reason = null;
  if (!q.valid[action]?.length) reject(`${path}沒有有效的作答`);
  const retries = integer(raw.retries, `${path}.retries`, 0, 1000000);
  const hintUsed = boolean(raw.hintUsed, `${path}.hintUsed`);
  if (raw.status !== 'first' && raw.status !== 'supported' && raw.status !== 'practice') reject(`${path}.status不是有效學習紀錄`);
  if (raw.status === 'first' && (retries !== 0 || hintUsed)) reject(`${path}首次理解與提示紀錄不一致`);
  if (raw.status === 'supported' && retries === 0 && !hintUsed) reject(`${path}提示完成缺少提示紀錄`);
  if (raw.status === 'practice' && (!hintUsed || retries < 2)) reject(`${path}示範紀錄不一致`);
  return { questionId: q.id, mode: selectedMode, action, reason, status: raw.status, retries, hintUsed, at: timestamp(raw.at, `${path}.at`) };
}

function activeSession(value: unknown): Session | null {
  if (value === null) return null;
  const raw = object(value, 'active');
  const levelId = integer(raw.levelId, 'active.levelId', 1, 12);
  const selectedMode = mode(raw.mode, 'active.mode');
  if (levels.find(level => level.id === levelId)?.mode !== selectedMode) reject('active模式與關卡不符');
  const review = boolean(raw.review, 'active.review');
  const expected = getQuestions(levelId, review).map(q => q.id);
  const questionIds = list(raw.questionIds, 'active.questionIds', 7).map((id, index) => question(id, `active.questionIds[${index}]`, selectedMode).id);
  if (questionIds.length !== expected.length || questionIds.some((id, i) => id !== expected[i])) reject('active題目不屬於這個關卡、練習模式或題目順序');
  const index = integer(raw.index, 'active.index', 0, questionIds.length - 1);
  const q = question(questionIds[index], 'active目前題目', selectedMode);
  const selected = selectedIndex(raw.selected, 'active.selected', q.choices.length);
  if (raw.reason !== null) reject('active新版題目採直接選答，不能有第二次理由作答');
  const reason = null;
  const step = raw.step;
  if (step !== 'action' && step !== 'feedback' && step !== 'defeat') reject('active.step不是有效的直接作答階段');
  const success = boolean(raw.success, 'active.success');
  const validAction = selected !== null && !!q.valid[selected]?.length;
  if (success && (step !== 'feedback' || !validAction)) reject('active成功狀態與作答不一致');
  if ((step === 'feedback' || step === 'defeat') && selected === null) reject('active回饋階段缺少行動');
  if ((step === 'feedback' || step === 'defeat') && !success && validAction) reject('active錯誤回饋與有效答案不一致');
  const shield = integer(raw.shield, 'active.shield', 0, 100);
  if ((shield === 0) !== (step === 'defeat')) reject('active零血量與挑戰結束狀態不一致');
  const retries = integer(raw.retries, 'active.retries', 0, 1000000);
  const hintUsed = boolean(raw.hintUsed, 'active.hintUsed');
  const demoUsed = raw.demoUsed === undefined ? false : boolean(raw.demoUsed, 'active.demoUsed');
  if (demoUsed && (!success || !hintUsed || retries < 2)) reject('active示範狀態不一致');
  if ((step === 'feedback' || step === 'defeat') && !success && retries === 0) reject('active錯誤回饋缺少重試紀錄');
  const records = list(raw.records, 'active.records', 7).map((record, i) => attempt(record, `active.records[${i}]`));
  if (records.length !== index || records.some((record, i) => record.questionId !== questionIds[i] || record.mode !== selectedMode)) reject('active已完成紀錄與題目順序不一致');
  const repaired = integer(raw.repaired, 'active.repaired', 0, 100);
  if (repaired !== Math.round(index / questionIds.length * 100)) reject('active修復進度與作答進度不一致');
  const feedback = text(raw.feedback, 'active.feedback', 30000, true);
  return {
    id: text(raw.id, 'active.id', 256), levelId, mode: selectedMode, review, questionIds, index,
    step, selected, reason, success, retries, hintUsed, demoUsed, feedback,
    shield, repaired, records,
  };
}

function proposal(value: unknown, path: string): Proposal {
  const raw = object(value, path);
  const selectedMode = mode(raw.mode, `${path}.mode`);
  const decisions = list(raw.decisions, `${path}.decisions`, 5).map((value, i) => {
    const decision = object(value, `${path}.decisions[${i}]`);
    const q = question(decision.questionId, `${path}.decisions[${i}].questionId`, selectedMode);
    if (q.levelId !== 12 || q.slot !== i + 1) reject(`${path}包含非終章提案題目或題目順序不符`);
    const action = text(decision.action, `${path}.decisions[${i}].action`);
    const reason = text(decision.reason, `${path}.decisions[${i}].reason`, 30000, true);
    const actionIndex = q.choices.findIndex(option => option.text === action);
    if (!q.valid[actionIndex]?.length) reject(`${path}包含未知或不合適的提案行動`);
    if (reason !== '') reject(`${path}新版提案採直接選答，理由欄應留空`);
    return { questionId: q.id, action: q.choices[actionIndex].text, reason: '' };
  });
  if (decisions.length !== 5 || new Set(decisions.map(d => d.questionId)).size !== 5) reject(`${path}需要五個不同的終章決策`);
  return { at: timestamp(raw.at, `${path}.at`), mode: selectedMode, decisions, reflection: text(raw.reflection, `${path}.reflection`, 10000, true) };
}

export function validateProgress(value: unknown): Progress {
  const raw = object(value, '進度');
  if (raw.schemaVersion === 1) reject('這是舊版十八關備份，無法套用新版十二關；舊進度仍保留在原儲存區');
  if (raw.schemaVersion !== 2) reject('不支援這個備份版本');
  const completed = list(raw.completed, 'completed', 12).map((id, i) => integer(id, `completed[${i}]`, 1, 12));
  if (new Set(completed).size !== completed.length) reject('completed包含重複關卡');
  const settings = object(raw.settings, 'settings');
  // Existing saves keep their progress, but narration now always requires a tap.
  boolean(settings.narration, 'settings.narration');
  const finishedSessionIds = raw.finishedSessionIds === undefined ? [] : list(raw.finishedSessionIds, 'finishedSessionIds').map((id, i) => text(id, `finishedSessionIds[${i}]`, 256));
  if (new Set(finishedSessionIds).size !== finishedSessionIds.length) reject('finishedSessionIds包含重複挑戰');
  const active = activeSession(raw.active);
  if (active && finishedSessionIds.includes(active.id)) reject('active挑戰已經完成');
  return {
    schemaVersion: 2, completed,
    attempts: list(raw.attempts, 'attempts').map((value, i) => attempt(value, `attempts[${i}]`)),
    active,
    proposals: list(raw.proposals, 'proposals', 10000).map((value, i) => proposal(value, `proposals[${i}]`)),
    settings: {
      mode: mode(settings.mode, 'settings.mode'), sound: boolean(settings.sound, 'settings.sound'),
      music: settings.music === undefined ? true : boolean(settings.music, 'settings.music'),
      narration: false, reducedMotion: boolean(settings.reducedMotion, 'settings.reducedMotion'),
    }, finishedSessionIds, updatedAt: timestamp(raw.updatedAt, 'updatedAt'),
  };
}

export function parseBackup(input: string): Progress {
  if (typeof input !== 'string' || input.length > 15000000) reject('備份文字太大或格式錯誤');
  let value: unknown;
  try { value = JSON.parse(input); } catch { return reject('無法讀取JSON文字'); }
  return validateProgress(value);
}

export function exportBackup(progress: Progress): string {
  return JSON.stringify(validateProgress(progress), null, 2);
}

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, rejectOpen) => {
    const request = globalThis.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    request.onerror = () => rejectOpen(request.error ?? new Error('IndexedDB open failed'));
    request.onblocked = () => rejectOpen(new Error('IndexedDB open blocked'));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

async function readDb(): Promise<unknown> {
  const db = await openDb();
  return new Promise((resolve, rejectRead) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(MAIN_KEY);
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => rejectRead(transaction.error ?? new Error('IndexedDB read failed'));
    transaction.onabort = () => rejectRead(transaction.error ?? new Error('IndexedDB read aborted'));
  });
}

async function writeDb(progress: Progress): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, rejectWrite) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(progress, MAIN_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => rejectWrite(transaction.error ?? new Error('IndexedDB write failed'));
    transaction.onabort = () => rejectWrite(transaction.error ?? new Error('IndexedDB write aborted'));
  });
}

let writes: Promise<void> = Promise.resolve();
export async function saveProgress(progress: Progress): Promise<void> {
  // Validate and copy at call time: later UI mutations cannot alter a queued save.
  const snapshot = validateProgress(progress);
  const operation = writes.catch(() => undefined).then(async () => {
    let savedToDb = false;
    let savedLocally = false;
    try { await writeDb(snapshot); savedToDb = true; } catch { /* Use the local fallback. */ }
    try { globalThis.localStorage.setItem(LOCAL_KEY, JSON.stringify(snapshot)); savedLocally = true; } catch { /* IndexedDB may still have saved successfully. */ }
    if (!savedToDb && !savedLocally) throw new Error('目前裝置無法保存進度。請保留遊戲畫面，並先匯出備份。');
  });
  writes = operation;
  return operation;
}

export async function loadProgress(): Promise<Progress> {
  await writes.catch(() => undefined);
  let stored: unknown;
  try { stored = await readDb(); } catch { /* Read the fallback below. */ }
  if (stored !== undefined) return validateProgress(stored);
  let fallback: string | null = null;
  try { fallback = globalThis.localStorage.getItem(LOCAL_KEY); } catch { /* A new session can still play and export its progress. */ }
  return fallback === null ? createProgress() : parseBackup(fallback);
}
