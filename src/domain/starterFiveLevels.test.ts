import { describe, expect, it } from 'vitest';
import { getQuestions, getQuestionsForHistory, playableQuestionBank, playableQuestions, questionById, retiredQuestions } from '../content';
import { getLevel, getPlayableLevels, isPlayableLevel, playableLevels } from '../content/levels';
import { availableUltimateSpells, getAvailableUltimateSpells, getUltimateCardKey, getUltimateSpell } from '../content/ultimateSpells';
import { advanceSession, applySession, chooseAction, createProgress, currentQuestion, finalBossUnlocked, finishSession,
  retryQuestion, selectUltimate, startFinalBossSession, startSession, submitAction } from './engine';
import { buildGrowthDashboard } from './growthDashboard';
import { resetLearningProgress } from './progressReset';
import { exportBackup, parseBackup, validateProgress } from './storage';
import { buildThinkingFootprints } from './thinkingFootprints';
import type { Mode, Session } from './types';

const solve = (session: Session) => submitAction(chooseAction(session, Number(Object.keys(currentQuestion(session).valid)[0])));
function unlocked(mode: Mode) {
  const progress = createProgress();
  progress.ultimateCards = getAvailableUltimateSpells(mode).map(spell => ({ ultimateId: spell.id,
    unlockedAt: progress.updatedAt, sessionId: `earned-${mode}-${spell.id}`,
    questionId: getQuestions(spell.id + (mode === 'advanced' ? 6 : 0))[3].id }));
  return progress;
}
function chargedFinal(mode: Mode) {
  let session = startFinalBossSession(unlocked(mode), mode);
  for (let count = 0; count < 3; count++) session = advanceSession(solve(session)).session!;
  return session;
}
/** Recreate an old checkpoint without reopening the removed mission through its current entry point. */
function retiredSession(firstQuestionId?: string): Session {
  return { ...startSession(5, 'starter'), levelId: 6,
    questionIds: getQuestionsForHistory(6, false, firstQuestionId).map(question => question.id) };
}

describe('five starter missions with stable historical identities', () => {
  it('exposes only five starter missions, six advanced missions and two final bosses', () => {
    expect(getPlayableLevels('starter').map(level => level.id)).toEqual([1, 2, 3, 4, 5, 13]);
    expect(getPlayableLevels('advanced').map(level => level.id)).toEqual([7, 8, 9, 10, 11, 12, 14]);
    expect(playableLevels).toHaveLength(13);
    expect(isPlayableLevel(6)).toBe(false);
    expect(getLevel(6).title).toBe('生活合作隊');
    expect(() => startSession(6, 'starter')).toThrow('過往練習紀錄');
    expect(() => startSession(6, 'advanced')).toThrow('過往練習紀錄');
    expect(playableQuestions).toHaveLength(80);
    expect(playableQuestionBank.levels).toHaveLength(13);
    expect(playableQuestionBank.questions).toHaveLength(80);
    expect(retiredQuestions).toHaveLength(4);
    for (const question of retiredQuestions) expect(questionById.get(question.id)).toBe(question);
  });

  it('unlocks the starter final with exactly five cards and permits only those five spells', () => {
    const starter = unlocked('starter');
    expect(finalBossUnlocked(starter, 'starter')).toBe(true);
    expect(finalBossUnlocked(starter, 'advanced')).toBe(false);
    expect(getAvailableUltimateSpells('starter').map(spell => spell.id)).toEqual([1, 2, 3, 4, 5]);
    expect(getAvailableUltimateSpells('advanced').map(spell => spell.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(availableUltimateSpells).toHaveLength(11);
    const ready = chargedFinal('starter');
    for (let id = 1; id <= 5; id++) expect(solve(selectUltimate(ready, id))).toMatchObject({ ultimateUsed: true, ultimateId: id, energy: 0 });
    expect(selectUltimate(ready, 6)).toBe(ready);
    expect(solve({ ...ready, preparedUltimateId: 6 })).toMatchObject({ step: 'action', energy: 3, ultimateUsed: false });
    expect(solve(selectUltimate(chargedFinal('advanced'), 6))).toMatchObject({ ultimateUsed: true, ultimateId: 6, frostGuardCharges: 2 });
    expect(getUltimateSpell(6, 'advanced')?.upgradeDescription).toContain('進階專屬');
    expect(getUltimateSpell(6, 'advanced')?.upgradeDescription).not.toContain('寒晶冰矛升級');
  });

  it.each([undefined, 'V4L06Q01'])('archives the exact retired checkpoint once, including the %s edition', firstQuestionId => {
    let session = retiredSession(firstQuestionId);
    for (let count = 0; count < 3; count++) session = advanceSession(solve(session)).session!;
    session = solve(session);
    const before = applySession(createProgress(), session);
    const restored = validateProgress(before);
    expect(restored.active).toBeNull();
    expect(restored.archivedSessions).toEqual([session]);
    expect(restored.ultimateCards).toEqual(before.ultimateCards);
    expect(getUltimateCardKey(restored.ultimateCards![0])).toBe('starter:6');
    expect(restored.attempts).toEqual(before.attempts);
    expect(parseBackup(exportBackup(restored))).toEqual(restored);
    expect(validateProgress(restored).archivedSessions).toHaveLength(1);
    const next = applySession(restored, startSession(1, 'starter'));
    expect(parseBackup(exportBackup(next)).archivedSessions).toEqual([session]);
    expect(resetLearningProgress(next).archivedSessions).toBeUndefined();
  });

  it('preserves retired completed scores and ice cards under history without inflating current progress', () => {
    let session = retiredSession();
    while (session.index < 3) session = advanceSession(solve(session)).session!;
    const old = finishSession(createProgress(), solve(session));
    const restored = parseBackup(exportBackup(old));
    expect(restored).toEqual(old);
    expect(restored.completed).toEqual([6]);
    expect(restored.ultimateCards).toHaveLength(1);
    expect(buildGrowthDashboard(restored).summary).toMatchObject({ levelCount: 13, playedLevelCount: 0, runCount: 0 });
    expect(buildGrowthDashboard(restored, 'review').runs[0].run).toEqual(old.runs![0]);
    expect(buildThinkingFootprints(restored, 'starter')).toMatchObject({ total: 6, completed: 0, practiced: 0 });
  });

  it('clears a retired prepared choice while preserving all three energy points and the same question', () => {
    const ready = { ...chargedFinal('starter'), preparedUltimateId: 6 };
    const restored = validateProgress(applySession(unlocked('starter'), ready));
    const expected: Session = { ...ready };
    delete expected.preparedUltimateId;
    expect(restored.active).toEqual(expected);
    expect(solve(selectUltimate(restored.active!, 5))).toMatchObject({ ultimateUsed: true, ultimateId: 5 });
    expect(parseBackup(exportBackup(restored))).toEqual(restored);
  });

  it('retains already-cast historical starter ice and its remaining defense without granting another selection', () => {
    const oldCast = { ...solve(selectUltimate(chargedFinal('starter'), 2)), ultimateId: 6,
      lightningHintQueued: false, lightningHintQuestions: 0, frostGuard: true, frostGuardCharges: 1 };
    const restored = validateProgress(applySession(unlocked('starter'), oldCast));
    expect(restored.active).toEqual(oldCast);
    let next = advanceSession(restored.active!).session!;
    const question = currentQuestion(next);
    next = submitAction(chooseAction(next, question.choices.findIndex((_, index) => !question.valid[index]?.length)));
    expect(next).toMatchObject({ shield: 90, lastEnemyDamage: 10, frostGuardCharges: 0 });
    expect(validateProgress(applySession(restored, retryQuestion(next))).active?.shield).toBe(90);
  });

  it('rejects fabricated archives instead of silently dropping another mission or duplicating an existing checkpoint', () => {
    expect(() => validateProgress({ ...createProgress(), archivedSessions: [startSession(1, 'starter')] })).toThrow('不是已移除');
    const archived = retiredSession();
    expect(() => validateProgress({ ...createProgress(), archivedSessions: [archived, archived] })).toThrow('重複挑戰');
    expect(() => validateProgress({ ...createProgress(), active: archived, archivedSessions: [archived] })).toThrow('紀錄重複');
  });
});
