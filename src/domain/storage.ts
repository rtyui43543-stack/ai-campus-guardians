import { getQuestionsForHistory, presentQuestion, questionById } from '../content';
import { levels } from '../content/levels';
import { getUltimateCardKey, getUltimateSpell } from '../content/ultimateSpells';
import { createProgress, finalBossUnlocked } from './engine';
import { finalBossDamage, reconstructRuns } from './scoring';
import type { AttemptRecord, CompletedRun, Mode, Progress, Proposal, Session, UltimateCardUnlock } from './types';

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

function combatRecordFields(raw: Record<string, unknown>, path: string, levelId: number, slot: number): Partial<AttemptRecord> {
  const level = levels.find(item => item.id === levelId)!;
  const finalBoss = level.finalBoss === true;
  const fields: Partial<AttemptRecord> = {};
  for (const key of ['timed', 'timedOut', 'ultimateUsed', 'preventedDamage'] as const) {
    if (raw[key] !== undefined) fields[key] = boolean(raw[key], `${path}.${key}`);
  }
  if (raw.elapsedMs !== undefined) fields.elapsedMs = integer(raw.elapsedMs, `${path}.elapsedMs`, 0, 30_000);
  if (fields.timed && (level.mode !== 'advanced' || !finalBoss && slot > 5 || fields.elapsedMs === undefined)) reject(`${path}限時紀錄與關卡不一致`);
  if (fields.timedOut && (!fields.timed || fields.elapsedMs !== 30_000)) reject(`${path}超時紀錄缺少限時結束時間`);
  if (raw.ultimateId !== undefined) fields.ultimateId = integer(raw.ultimateId, `${path}.ultimateId`, 1, 6);
  if (raw.combatRulesVersion !== undefined) fields.combatRulesVersion = integer(raw.combatRulesVersion, `${path}.combatRulesVersion`, 2, 2) as 2;
  if (raw.turnBurnDamage !== undefined) fields.turnBurnDamage = integer(raw.turnBurnDamage, `${path}.turnBurnDamage`, 0, 4);
  if (raw.turnHealing !== undefined) fields.turnHealing = integer(raw.turnHealing, `${path}.turnHealing`, 0, 4);
  if ((fields.turnBurnDamage !== undefined || fields.turnHealing !== undefined) && fields.combatRulesVersion !== 2) reject(`${path}持續效果缺少戰鬥版本`);
  if (fields.turnBurnDamage !== undefined && fields.turnBurnDamage !== 0 && fields.turnBurnDamage !== 4) reject(`${path}燃燒傷害不是每題四點`);
  if (fields.ultimateUsed && (fields.ultimateId === undefined || !finalBoss && fields.ultimateId !== level.chapterId || slot < 4 || !finalBoss && slot > 5)) reject(`${path}必殺技與本關主題或充能順序不符`);
  if (fields.ultimateId !== undefined && !fields.ultimateUsed) reject(`${path}未施放卻帶有必殺技編號`);
  return fields;
}

/** Final missions always use the new energy rules; ordinary legacy records keep their saved interpretation. */
function finalEnergy(records: readonly AttemptRecord[], path: string): number {
  let energy = 0;
  for (const record of records) {
    if (record.status === 'timeout') energy = Math.max(0, energy - 1);
    else if (record.status !== 'practice') {
      if ((energy === 3) !== !!record.ultimateUsed) reject(`${path}必殺技與充能順序不符`);
      energy = record.ultimateUsed ? 0 : Math.min(3, energy + 1);
    }
  }
  return energy;
}

/** Old casts stay old; a new fire/healing cast enables one tick on each later completed question. */
function validateStatusTicks(records: readonly AttemptRecord[], path: string): void {
  let burning = false;
  let regeneration = false;
  for (const [index, record] of records.entries()) {
    if (record.combatRulesVersion === 2) {
      if ((record.turnBurnDamage ?? 0) !== (burning ? 4 : 0)) reject(`${path}[${index}]燃燒傷害與先前施放紀錄不一致`);
      if (!regeneration && (record.turnHealing ?? 0) !== 0) reject(`${path}[${index}]回血效果尚未啟動`);
      if (record.ultimateUsed && record.ultimateId === 5) burning = true;
      if (record.ultimateUsed && record.ultimateId === 3) regeneration = true;
    }
  }
}

function attempt(value: unknown, path: string): AttemptRecord {
  const raw = object(value, path);
  const selectedMode = mode(raw.mode, `${path}.mode`);
  const q = question(raw.questionId, `${path}.questionId`, selectedMode);
  const action = selectedIndex(raw.action, `${path}.action`, q.choices.length);
  if (raw.reason !== null) reject(`${path}新版題目採直接選答，不能有第二次理由作答`);
  const reason = null;
  const extra = combatRecordFields(raw, path, q.levelId, q.slot);
  const expired = raw.status === 'timeout';
  if (expired ? action !== null || !extra.timedOut : action === null || !q.valid[action]?.length || extra.timedOut) reject(`${path}沒有有效的作答或超時紀錄`);
  const retries = integer(raw.retries, `${path}.retries`, 0, 1000000);
  const hintUsed = boolean(raw.hintUsed, `${path}.hintUsed`);
  if (raw.status !== 'first' && raw.status !== 'supported' && raw.status !== 'practice' && raw.status !== 'timeout') reject(`${path}.status不是有效學習紀錄`);
  if (raw.status === 'first' && (retries !== 0 || hintUsed)) reject(`${path}首次理解與提示紀錄不一致`);
  if (raw.status === 'supported' && retries === 0 && !hintUsed) reject(`${path}提示完成缺少提示紀錄`);
  const demoUsed = raw.demoUsed === undefined ? undefined : boolean(raw.demoUsed, `${path}.demoUsed`);
  if ((demoUsed === true && raw.status !== 'practice') || (raw.status === 'practice' && (!hintUsed || demoUsed === false || (demoUsed !== true && retries < 2)))) reject(`${path}示範紀錄不一致`);
  if (extra.ultimateUsed && (expired || raw.status === 'practice' || demoUsed)) reject(`${path}超時或示範不能施放必殺技`);
  if (extra.timed && !expired && raw.status !== 'practice' && extra.elapsedMs === 30_000) reject(`${path}時間到後不能記為答對`);
  return { questionId: q.id, mode: selectedMode, action, reason, status: raw.status, retries, hintUsed, at: timestamp(raw.at, `${path}.at`),
    ...(demoUsed === undefined ? {} : { demoUsed }), ...extra };
}

function activeSession(value: unknown): Session | null {
  if (value === null) return null;
  const raw = object(value, 'active');
  const levelId = integer(raw.levelId, 'active.levelId', 1, 14);
  const selectedMode = mode(raw.mode, 'active.mode');
  const level = levels.find(level => level.id === levelId);
  if (level?.mode !== selectedMode) reject('active模式與關卡不符');
  const finalBoss = level.finalBoss === true;
  const review = boolean(raw.review, 'active.review');
  // The removed practice route cannot be resumed; its completed history remains available below.
  if (review) {
    if (finalBoss) reject('最終關不能使用已移除的練習模式');
    return null;
  }
  const questionIds = list(raw.questionIds, 'active.questionIds', 15).map((id, index) => question(id, `active.questionIds[${index}]`, selectedMode).id);
  const expected = getQuestionsForHistory(levelId, review, questionIds[0]).map(q => q.id);
  if (questionIds.length !== expected.length || questionIds.some((id, i) => id !== expected[i])) reject('active題目不屬於這個關卡、練習模式或題目順序');
  const index = integer(raw.index, 'active.index', 0, questionIds.length - 1);
  const q = question(questionIds[index], 'active目前題目', selectedMode);
  const selected = selectedIndex(raw.selected, 'active.selected', q.choices.length);
  if (raw.reason !== null) reject('active新版題目採直接選答，不能有第二次理由作答');
  const reason = null;
  const step = raw.step;
  if (step !== 'action' && step !== 'feedback' && step !== 'defeat') reject('active.step不是有效的直接作答階段');
  const success = boolean(raw.success, 'active.success');
  const extra: Partial<Session> = {};
  for (const key of ['timed', 'timedOut', 'ultimateUsed', 'barrier', 'preventedDamage'] as const) {
    if (raw[key] !== undefined) extra[key] = boolean(raw[key], `active.${key}`);
  }
  for (const key of ['enemyBurning', 'playerRegeneration', 'frostGuard', 'mirrorGuard', 'lightningHintQueued', 'lastEnemyCritical', 'lastEnemyMissed'] as const) {
    if (raw[key] !== undefined) extra[key] = boolean(raw[key], `active.${key}`);
  }
  if (raw.combatRulesVersion !== undefined) extra.combatRulesVersion = integer(raw.combatRulesVersion, 'active.combatRulesVersion', 2, 2) as 2;
  if (raw.wrongStreak !== undefined) extra.wrongStreak = integer(raw.wrongStreak, 'active.wrongStreak', 0, 1000000);
  if (raw.enemyBurnDamage !== undefined) extra.enemyBurnDamage = integer(raw.enemyBurnDamage, 'active.enemyBurnDamage', 0, 60);
  if (raw.lastEnemyDamage !== undefined) extra.lastEnemyDamage = integer(raw.lastEnemyDamage, 'active.lastEnemyDamage', 0, finalBoss ? 30 : 12);
  if (raw.lastTurnBurnDamage !== undefined) extra.lastTurnBurnDamage = integer(raw.lastTurnBurnDamage, 'active.lastTurnBurnDamage', 0, 4);
  if (raw.lastTurnHealing !== undefined) extra.lastTurnHealing = integer(raw.lastTurnHealing, 'active.lastTurnHealing', 0, 4);
  if (raw.resolvedTurnIndex !== undefined) extra.resolvedTurnIndex = integer(raw.resolvedTurnIndex, 'active.resolvedTurnIndex', index, index);
  if (raw.lightningHintChoices !== undefined) {
    extra.lightningHintChoices = list(raw.lightningHintChoices, 'active.lightningHintChoices', 2).map((choice, i) => integer(choice, `active.lightningHintChoices[${i}]`, 0, q.choices.length - 1));
    if (extra.lightningHintChoices.length !== 0 && (extra.lightningHintChoices.length !== 2 || new Set(extra.lightningHintChoices).size !== 2
      || !extra.lightningHintChoices.some(choice => q.valid[choice]?.length))) reject('active雷光提示必須包含兩個不同選項且至少一個正確答案');
  }
  if (raw.barrierCharges !== undefined) {
    extra.barrierCharges = integer(raw.barrierCharges, 'active.barrierCharges', 0, 2);
    if (extra.barrier !== undefined && extra.barrier !== (extra.barrierCharges > 0)) reject('active護盾開關與剩餘次數不一致');
    extra.barrier = extra.barrierCharges > 0;
  } else if (extra.barrier !== undefined) {
    // Keep old saves at their original strength, including the former tree shield.
    extra.barrierCharges = extra.barrier ? 1 : 0;
  }
  if (raw.energy !== undefined) extra.energy = integer(raw.energy, 'active.energy', 0, 3);
  if (raw.elapsedMs !== undefined) extra.elapsedMs = integer(raw.elapsedMs, 'active.elapsedMs', 0, 30_000);
  if (raw.remainingMs !== undefined) extra.remainingMs = integer(raw.remainingMs, 'active.remainingMs', 0, 30_000);
  if (raw.bonusPoints !== undefined) extra.bonusPoints = integer(raw.bonusPoints, 'active.bonusPoints', 0, finalBoss ? 150 : 50);
  if (raw.enemyBonusDamage !== undefined) extra.enemyBonusDamage = integer(raw.enemyBonusDamage, 'active.enemyBonusDamage', 0, finalBoss ? 225 : 50);
  if (raw.ultimateId !== undefined) extra.ultimateId = integer(raw.ultimateId, 'active.ultimateId', 1, 6);
  if (raw.preparedUltimateId !== undefined) {
    extra.preparedUltimateId = integer(raw.preparedUltimateId, 'active.preparedUltimateId', 1, 6);
    if (!finalBoss || extra.energy !== 3 || extra.ultimateUsed || extra.timedOut) reject('active必殺技選擇與本關或能量不一致');
  }
  if (extra.timed && (selectedMode !== 'advanced' || review || extra.remainingMs === undefined || extra.elapsedMs === undefined || extra.remainingMs + extra.elapsedMs !== 30_000)) reject('active限時設定與本關模式或時間不一致');
  if (extra.timedOut && (!extra.timed || success || selected !== null || extra.remainingMs !== 0 || extra.elapsedMs !== 30_000 || step === 'action')) reject('active超時狀態不一致');
  if (extra.timed && extra.remainingMs === 0 && !extra.timedOut) reject('active時間已到卻沒有超時處理');
  if (extra.ultimateUsed && (!success || extra.energy !== 0 || extra.ultimateId === undefined || !finalBoss && extra.ultimateId !== level.chapterId || index < 3 || review)) reject('active必殺技與本關或充能狀態不一致');
  if (extra.ultimateId !== undefined && !extra.ultimateUsed) reject('active未施放卻帶有必殺技編號');
  const validAction = selected !== null && !!q.valid[selected]?.length;
  if (success && (step !== 'feedback' || !validAction)) reject('active成功狀態與作答不一致');
  if ((step === 'feedback' || step === 'defeat') && selected === null && !extra.timedOut) reject('active回饋階段缺少行動');
  if ((step === 'feedback' || step === 'defeat') && !success && validAction) reject('active錯誤回饋與有效答案不一致');
  const shield = integer(raw.shield, 'active.shield', 0, 100);
  if ((shield === 0) !== (step === 'defeat')) reject('active零血量與挑戰結束狀態不一致');
  const retries = integer(raw.retries, 'active.retries', 0, 1000000);
  const hintUsed = boolean(raw.hintUsed, 'active.hintUsed');
  const demoUsed = raw.demoUsed === undefined ? false : boolean(raw.demoUsed, 'active.demoUsed');
  const demoRetriesKnown = raw.demoRetriesKnown === undefined ? undefined : boolean(raw.demoRetriesKnown, 'active.demoRetriesKnown');
  if (demoRetriesKnown && !demoUsed) reject('active示範次數標記不一致');
  if (demoUsed && (!success || !hintUsed || (!demoRetriesKnown && retries < 2))) reject('active示範狀態不一致');
  if (demoUsed && extra.ultimateUsed) reject('active示範不能施放必殺技');
  if ((step === 'feedback' || step === 'defeat') && !success && retries === 0 && !extra.timedOut) reject('active錯誤回饋缺少重試紀錄');
  const records = list(raw.records, 'active.records', 15).map((record, i) => attempt(record, `active.records[${i}]`));
  if (records.length !== index || records.some((record, i) => record.questionId !== questionIds[i] || record.mode !== selectedMode)) reject('active已完成紀錄與題目順序不一致');
  const repaired = integer(raw.repaired, 'active.repaired', 0, finalBoss ? 300 : 100);
  const expectedRepaired = finalBoss ? records.filter(record => record.status !== 'timeout').length * 20
    : Math.round(records.filter(record => record.status !== 'timeout').length / questionIds.length * 100);
  if (repaired !== expectedRepaired) reject('active修復進度與作答進度不一致');
  if (finalBoss) {
    const priorEnergy = finalEnergy(records, 'active.records');
    const expectedEnergy = extra.timedOut ? Math.max(0, priorEnergy - 1) : success && !demoUsed ? priorEnergy === 3 ? 0 : priorEnergy + 1 : priorEnergy;
    if (extra.energy !== expectedEnergy || success && !demoUsed && (priorEnergy === 3) !== !!extra.ultimateUsed) reject('active必殺技與充能狀態不一致');
    if (finalBossDamage(records) >= 300) reject('active最終魔王已經被擊敗');
    if (extra.timed !== (selectedMode === 'advanced')) reject('active最終關限時設定與模式不符');
  }
  validateStatusTicks(records, 'active.records');
  if (extra.combatRulesVersion === 2) {
    const settled = step === 'feedback' && (success || extra.timedOut) || step === 'defeat' && extra.timedOut;
    if (settled !== (extra.resolvedTurnIndex === index)) reject('active持續效果與本題結算狀態不一致');
    if ((extra.enemyBurnDamage ?? 0) !== records.reduce((sum, record) => sum + (record.turnBurnDamage ?? 0), 0) + (extra.lastTurnBurnDamage ?? 0)) reject('active累積燃燒傷害與逐題紀錄不一致');
    if (!settled && ((extra.lastTurnBurnDamage ?? 0) !== 0 || (extra.lastTurnHealing ?? 0) !== 0)) reject('active未完成題目不能結算持續效果');
    if (extra.lastEnemyMissed && (extra.lastEnemyDamage !== 0 || extra.mirrorGuard)) reject('active鏡界落空結果不一致');
    if (extra.lastEnemyCritical && (!finalBoss || (extra.wrongStreak ?? 0) < 2 || success || extra.timedOut)) reject('active魔王連錯必殺與狀態不一致');
    const priorBurning = records.some(record => record.combatRulesVersion === 2 && record.ultimateUsed && record.ultimateId === 5);
    const priorRegeneration = records.some(record => record.combatRulesVersion === 2 && record.ultimateUsed && record.ultimateId === 3);
    if (extra.enemyBurning !== undefined && extra.enemyBurning !== (priorBurning || !!extra.ultimateUsed && extra.ultimateId === 5)) reject('active燃燒狀態與施放紀錄不一致');
    if (extra.playerRegeneration !== undefined && extra.playerRegeneration !== (priorRegeneration || !!extra.ultimateUsed && extra.ultimateId === 3)) reject('active恢復狀態與施放紀錄不一致');
    if ((extra.lastTurnBurnDamage ?? 0) !== (settled && step !== 'defeat' && priorBurning ? 4 : 0)) reject('active本題燃燒與先前施放紀錄不一致');
    if (!priorRegeneration && (extra.lastTurnHealing ?? 0) !== 0) reject('active本題持續回血尚未啟動');
  }
  const releaseCount = records.filter(record => record.ultimateUsed).length + (extra.ultimateUsed ? 1 : 0);
  if (extra.bonusPoints !== undefined && extra.bonusPoints !== releaseCount * 10) reject('active必殺技獎勵與施放紀錄不一致');
  const releases = records.filter(record => record.ultimateUsed).map(record => record.ultimateId!);
  if (extra.ultimateUsed) releases.push(extra.ultimateId!);
  // Preserve saved effects exactly: castles formerly dealt zero damage, ice
  // formerly shielded (zero) then attacked for ten, and advanced attacks used ten.
  // Validate only a total composed of real historical or current cast values;
  // reading an old checkpoint must never apply a new attack retroactively.
  const allowedDamageTotals = releases.reduce((totals, ultimateId) => {
    const currentDamage = getUltimateSpell(ultimateId, selectedMode)!.extraDamage;
    const legacyDamage = finalBoss ? [] : ultimateId === 1 || ultimateId === 3 ? [0] : ultimateId === 6 ? [0, 10] : [10];
    return new Set([...totals].flatMap(total => [...new Set([...legacyDamage, currentDamage])].map(damage => total + damage)));
  }, new Set([0]));
  if ((finalBoss && extra.enemyBonusDamage === undefined) || extra.enemyBonusDamage !== undefined && !allowedDamageTotals.has(extra.enemyBonusDamage)) reject('active額外傷害與施放紀錄不一致');
  if (finalBoss && extra.bonusPoints !== releaseCount * 10) reject('active必殺技獎勵與施放紀錄不一致');
  const feedback = text(raw.feedback, 'active.feedback', 30000, true);
  return {
    id: text(raw.id, 'active.id', 256), levelId, mode: selectedMode, review, questionIds, index,
    step, selected, reason, success, retries, hintUsed, demoUsed, feedback,
    shield, repaired, records, ...extra,
    ...(demoRetriesKnown === undefined ? {} : { demoRetriesKnown }),
  };
}

function completedRun(value: unknown, path: string): CompletedRun {
  const raw = object(value, path);
  const levelId = integer(raw.levelId, `${path}.levelId`, 1, 14);
  const selectedMode = mode(raw.mode, `${path}.mode`);
  const level = levels.find(item => item.id === levelId);
  if (level?.mode !== selectedMode) reject(`${path}模式與關卡不符`);
  const finalBoss = level.finalBoss === true;
  const review = boolean(raw.review, `${path}.review`);
  if (finalBoss && review) reject(`${path}最終關不能有練習模式`);
  const records = list(raw.records, `${path}.records`, 15).map((record, i) => attempt(record, `${path}.records[${i}]`));
  const expected = getQuestionsForHistory(levelId, review, records[0]?.questionId).map(question => question.id);
  if ((!finalBoss && records.length !== expected.length) || !records.length || records.length > expected.length || records.some((record, i) => record.questionId !== expected[i] || record.mode !== selectedMode)) reject(`${path}需要完整且依序的本關作答紀錄`);
  // Never accept a caller's numeric score; scoring is derived from these records.
  const passed = raw.passed === undefined ? undefined : boolean(raw.passed, `${path}.passed`);
  if (finalBoss) {
    finalEnergy(records, path);
    const defeated = finalBossDamage(records) >= 300;
    if (passed !== defeated || !defeated && records.length !== expected.length || finalBossDamage(records.slice(0, -1)) >= 300) reject(`${path}最終魔王通關狀態與傷害或題目順序不一致`);
  } else if (passed !== undefined && passed !== !records.some(record => record.status === 'timeout')) reject(`${path}通關狀態與超時紀錄不一致`);
  validateStatusTicks(records, path);
  return { sessionId: text(raw.sessionId, `${path}.sessionId`, 256), levelId, mode: selectedMode,
    review, records, at: timestamp(raw.at, `${path}.at`), ...(passed === undefined ? {} : { passed }) };
}

function ultimateCard(value: unknown, path: string): UltimateCardUnlock {
  const raw = object(value, path);
  const ultimateId = integer(raw.ultimateId, `${path}.ultimateId`, 1, 6);
  const questionId = text(raw.questionId, `${path}.questionId`, 30);
  const q = questionById.get(questionId);
  const level = q && levels.find(level => level.id === q.levelId);
  if (!q || q.slot < 4 || !level?.finalBoss && (q.slot > 5 || level?.chapterId !== ultimateId)) reject(`${path}收藏與施放關卡不一致`);
  return { ultimateId, questionId, sessionId: text(raw.sessionId, `${path}.sessionId`, 256), unlockedAt: timestamp(raw.unlockedAt, `${path}.unlockedAt`) };
}

function validateRunHistory(runs: CompletedRun[], attempts: AttemptRecord[]): void {
  const history = attempts.map(record => JSON.stringify(record));
  let cursor = 0;
  for (const run of runs) {
    const expected = run.records.map(record => JSON.stringify(record));
    while (cursor < history.length && !expected.every((record, index) => history[cursor + index] === record)) cursor++;
    if (cursor >= history.length) reject('runs與歷次作答紀錄不一致');
    cursor += expected.length;
  }
}

/** Split the former six shared cards into earned tiers using actual cast records, never completion or scores. */
function recoverEarnedUltimateCards(existing: UltimateCardUnlock[] | undefined, runs: CompletedRun[], attempts: AttemptRecord[], active: Session | null, updatedAt: string): UltimateCardUnlock[] | undefined {
  const cards = [...(existing ?? [])];
  const known = new Set(cards.map(getUltimateCardKey));
  const add = (record: Pick<AttemptRecord, 'ultimateUsed' | 'ultimateId' | 'questionId' | 'at'>, sessionId: string) => {
    if (!record.ultimateUsed || !record.ultimateId) return;
    const key = getUltimateCardKey({ ultimateId: record.ultimateId, questionId: record.questionId });
    if (known.has(key)) return;
    cards.push({ ultimateId: record.ultimateId, questionId: record.questionId, sessionId, unlockedAt: record.at });
    known.add(key);
  };
  // Validated reports supply the genuine session ID. Process them in their saved order so the first earned date stays stable.
  for (const run of runs) for (const record of run.records) add(record, run.sessionId);
  // Incomplete legacy histories can still contain a genuine cast. Their original session ID is unknown; retain a stable recovery ID.
  for (const record of attempts) add(record, `legacy-ultimate-${record.questionId}-${record.at}`);
  if (active) {
    for (const record of active.records) add(record, active.id);
    if (active.ultimateUsed && active.ultimateId) add({ ultimateUsed: true, ultimateId: active.ultimateId,
      questionId: active.questionIds[active.index], at: updatedAt }, active.id);
  }
  return existing === undefined && cards.length === 0 ? undefined : cards;
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
  if (raw.schemaVersion === 1) reject('這是舊版十八關備份，無法套用新版十四關；舊進度仍保留在原儲存區');
  if (raw.schemaVersion !== 2) reject('不支援這個備份版本');
  const completed = list(raw.completed, 'completed', 14).map((id, i) => integer(id, `completed[${i}]`, 1, 14));
  if (new Set(completed).size !== completed.length) reject('completed包含重複關卡');
  const settings = object(raw.settings, 'settings');
  // Existing saves keep their progress, but narration now always requires a tap.
  boolean(settings.narration, 'settings.narration');
  const finishedSessionIds = raw.finishedSessionIds === undefined ? [] : list(raw.finishedSessionIds, 'finishedSessionIds').map((id, i) => text(id, `finishedSessionIds[${i}]`, 256));
  if (new Set(finishedSessionIds).size !== finishedSessionIds.length) reject('finishedSessionIds包含重複挑戰');
  const attempts = list(raw.attempts, 'attempts').map((value, i) => attempt(value, `attempts[${i}]`));
  const runs = raw.runs === undefined ? reconstructRuns(attempts) : list(raw.runs, 'runs', 25000).map((value, i) => completedRun(value, `runs[${i}]`));
  if (new Set(runs.map(run => run.sessionId)).size !== runs.length) reject('runs包含重複挑戰');
  validateRunHistory(runs, attempts);
  const active = activeSession(raw.active);
  const savedUltimateCards = raw.ultimateCards === undefined ? undefined : list(raw.ultimateCards, 'ultimateCards', 12).map((value, i) => ultimateCard(value, `ultimateCards[${i}]`));
  if (savedUltimateCards && new Set(savedUltimateCards.map(getUltimateCardKey)).size !== savedUltimateCards.length) reject('ultimateCards包含重複收藏');
  if (active && (finishedSessionIds.includes(active.id) || runs.some(run => run.sessionId === active.id))) reject('active挑戰已經完成');
  const updatedAt = timestamp(raw.updatedAt, 'updatedAt');
  const ultimateCards = recoverEarnedUltimateCards(savedUltimateCards, runs, attempts, active, updatedAt);
  if (active && levels.find(level => level.id === active.levelId)?.finalBoss && !finalBossUnlocked({ ultimateCards }, active.mode)) reject('active最終關尚未解鎖本等級的六張收藏卡');
  return {
    schemaVersion: 2, completed,
    attempts, runs, ...(ultimateCards === undefined ? {} : { ultimateCards }),
    active,
    proposals: list(raw.proposals, 'proposals', 10000).map((value, i) => proposal(value, `proposals[${i}]`)),
    settings: {
      mode: mode(settings.mode, 'settings.mode'), sound: boolean(settings.sound, 'settings.sound'),
      music: settings.music === undefined ? true : boolean(settings.music, 'settings.music'),
      narration: false, reducedMotion: boolean(settings.reducedMotion, 'settings.reducedMotion'),
    }, finishedSessionIds, updatedAt,
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
