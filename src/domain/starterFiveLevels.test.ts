import { describe, expect, it } from 'vitest';
import { getQuestions, getQuestionsForHistory, playableQuestionBank, playableQuestions, questionById, retiredQuestions } from '../content';
import { getLevel, getPlayableLevels, isPlayableLevel, playableLevels } from '../content/levels';
import { availableUltimateSpells, getAvailableUltimateSpells, getUltimateCardKey, getUltimateSpell } from '../content/ultimateSpells';
import { advanceSession, applySession, chooseAction, createProgress, currentQuestion, finalBossUnlocked, finishSession,
  retryQuestion, selectUltimate, startFinalBossSession, startSession, submitAction } from './engine';
import { buildGrowthDashboard } from './growthDashboard';
import { resetLearningProgress } from './progressReset';
import { exportBackup, getStarterBossMigrationResult, parseBackup, validateProgress } from './storage';
import { buildThinkingFootprints } from './thinkingFootprints';
import type { Mode, Progress, Session } from './types';

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
function completeMission(progress: Progress, session: Session): Progress {
  for (;;) {
    if (session.step !== 'feedback') {
      if (getLevel(session.levelId).finalBoss && session.energy === 3) session = selectUltimate(session, 2);
      session = solve(session);
    }
    const next = advanceSession(session);
    if (next.finished) return finishSession(progress, session);
    session = next.session!;
  }
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

  it.each([undefined, 'V4L06Q01'])('removes the retired checkpoint and earned card, including the %s edition', firstQuestionId => {
    let session = retiredSession(firstQuestionId);
    for (let count = 0; count < 3; count++) session = advanceSession(solve(session)).session!;
    session = solve(session);
    const before = applySession(createProgress(), session);
    const restored = validateProgress(before);
    expect(restored.active).toBeNull();
    expect(restored.archivedSessions).toBeUndefined();
    expect(before.ultimateCards!.map(getUltimateCardKey)).toContain('starter:6');
    expect(restored.ultimateCards).toEqual([]);
    expect(restored.attempts).toEqual(before.attempts);
    expect(parseBackup(exportBackup(restored))).toEqual(restored);
    expect(validateProgress(restored)).toEqual(restored);
    const next = applySession(restored, startSession(1, 'starter'));
    expect(parseBackup(exportBackup(next)).archivedSessions).toBeUndefined();
    expect(resetLearningProgress(next).archivedSessions).toBeUndefined();
  });

  it.each([undefined, 'V4L06Q01'])('removes completed scores, answer history and ice cards from the %s retired edition', firstQuestionId => {
    const old = completeMission(createProgress(), retiredSession(firstQuestionId));
    const unchanged = structuredClone(old);
    const restored = parseBackup(JSON.stringify(old));
    expect(old).toEqual(unchanged);
    expect(restored.completed).toEqual([]);
    expect(restored.attempts).toEqual([]);
    expect(restored.runs).toEqual([]);
    expect(restored.finishedSessionIds).toEqual([]);
    expect(restored.ultimateCards).toEqual([]);
    expect(buildGrowthDashboard(restored).summary).toMatchObject({ levelCount: 13, playedLevelCount: 0, runCount: 0 });
    expect(buildGrowthDashboard(restored, 'review').runs).toEqual([]);
    expect(buildThinkingFootprints(restored, 'starter')).toMatchObject({ total: 6, completed: 0, practiced: 0 });
    expect(parseBackup(exportBackup(old))).toEqual(restored);
    expect(parseBackup(exportBackup(restored))).toEqual(restored);
  });

  it('removes an existing retired archive while preserving the active advanced sixth mission', () => {
    let archived = retiredSession();
    for (let count = 0; count < 3; count++) archived = advanceSession(solve(archived)).session!;
    archived = solve(archived);
    const active = startSession(12, 'advanced');
    const old = { ...applySession(createProgress(), archived), active, archivedSessions: [archived] };
    const restored = validateProgress(old);
    expect(restored.active).toEqual(active);
    expect(restored.archivedSessions).toBeUndefined();
    expect(restored.ultimateCards).toEqual([]);
    expect(parseBackup(exportBackup(restored))).toEqual(restored);
  });

  it('keeps other scores, advanced ice and unknown completion markers exactly as earned', () => {
    let old = completeMission(createProgress(), startSession(5, 'starter'));
    old = completeMission(old, retiredSession());
    old = completeMission(old, startSession(12, 'advanced'));
    old.finishedSessionIds!.push('unattributed-legacy-marker');
    old.settings = { mode: 'advanced', sound: false, music: false, narration: false, reducedMotion: true };
    old.proposals = [{ at: old.updatedAt, mode: 'advanced', reflection: '保留進階歷史決策',
      decisions: old.runs!.at(-1)!.records.map(record => ({ questionId: record.questionId,
        action: questionById.get(record.questionId)!.choices[record.action!].text, reason: '' })) }];
    const restored = parseBackup(JSON.stringify(old));
    const retainedRuns = old.runs!.filter(run => run.levelId !== 6);
    expect(restored.completed).toEqual([5, 12]);
    expect(restored.runs).toEqual(retainedRuns);
    expect(restored.attempts).toEqual(old.attempts.filter(record => questionById.get(record.questionId)!.levelId !== 6));
    expect(restored.finishedSessionIds).toEqual([...retainedRuns.map(run => run.sessionId), 'unattributed-legacy-marker']);
    expect(restored.ultimateCards).toEqual(old.ultimateCards!.filter(card => getUltimateCardKey(card) !== 'starter:6'));
    expect(restored.ultimateCards!.map(getUltimateCardKey)).toEqual(['starter:5', 'advanced:6']);
    expect(restored.settings).toEqual(old.settings);
    expect(restored.proposals).toEqual(old.proposals);
    expect(restored.updatedAt).toBe(old.updatedAt);
    expect(parseBackup(exportBackup(restored))).toEqual(restored);
  });

  it('keeps another completed run marker when an old retired card contains its stale session ID', () => {
    const old = completeMission(completeMission(createProgress(), retiredSession()), startSession(12, 'advanced'));
    const advancedRun = old.runs!.at(-1)!;
    old.ultimateCards!.find(card => getUltimateCardKey(card) === 'starter:6')!.sessionId = advancedRun.sessionId;
    const restored = validateProgress(old);
    expect(restored.finishedSessionIds).toEqual([advancedRun.sessionId]);
    expect(restored.runs).toEqual([advancedRun]);
    expect(restored.ultimateCards!.map(getUltimateCardKey)).toEqual(['advanced:6']);
  });

  it('does not reconstruct retired scores or collectibles from attempts-only legacy backups', () => {
    const old = completeMission(createProgress(), retiredSession());
    delete old.runs;
    delete old.ultimateCards;
    const restored = validateProgress(old);
    expect(restored.attempts).toEqual([]);
    expect(restored.runs).toEqual([]);
    expect(restored.ultimateCards ?? []).toEqual([]);
    expect(validateProgress(restored)).toEqual(restored);
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
    expect(restored.ultimateCards!.map(getUltimateCardKey)).not.toContain('starter:6');
    expect(parseBackup(exportBackup(restored))).toEqual(restored);
    let next = advanceSession(restored.active!).session!;
    const question = currentQuestion(next);
    next = submitAction(chooseAction(next, question.choices.findIndex((_, index) => !question.valid[index]?.length)));
    expect(next).toMatchObject({ shield: 90, lastEnemyDamage: 10, frostGuardCharges: 0 });
    expect(validateProgress(applySession(restored, retryQuestion(next))).active?.shield).toBe(90);
  });

  it.each(['starter', 'advanced'] as const)('preserves completed %s final-boss ice casts, scores and completion markers', mode => {
    const charged = chargedFinal(mode);
    const cast = mode === 'advanced' ? solve(selectUltimate(charged, 6))
      : { ...solve(selectUltimate(charged, 2)), ultimateId: 6,
        lightningHintQueued: false, lightningHintQuestions: 0, frostGuard: true, frostGuardCharges: 1 };
    const old = completeMission(unlocked(mode), cast);
    const restored = validateProgress(old);
    expect(restored.completed).toEqual(old.completed);
    expect(restored.runs).toEqual(old.runs);
    expect(restored.attempts).toEqual(old.attempts);
    expect(restored.finishedSessionIds).toEqual(old.finishedSessionIds);
    expect(restored.runs![0].records.some(record => record.ultimateId === 6)).toBe(true);
    expect(restored.ultimateCards!.map(getUltimateCardKey)).not.toContain('starter:6');
    if (mode === 'advanced') expect(restored.ultimateCards).toEqual(old.ultimateCards);
    expect(parseBackup(exportBackup(restored))).toEqual(restored);
  });

  it('removes starter-six history without losing a simultaneous legacy final-boss completion migration', () => {
    const progress = completeMission(unlocked('starter'), retiredSession());
    let active = startFinalBossSession(progress, 'starter');
    delete active.enemyMaxHp;
    while (active.index < 11) {
      if (active.energy === 3) active = selectUltimate(active, 2);
      active = advanceSession(solve(active)).session!;
    }
    const restored = validateProgress(applySession(progress, active));
    expect(restored.active).toBeNull();
    expect(restored.completed).toEqual([13]);
    expect(restored.runs).toHaveLength(1);
    expect(restored.runs![0]).toMatchObject({ sessionId: active.id, levelId: 13, passed: true, enemyMaxHp: 200 });
    expect(restored.attempts).toEqual(restored.runs![0].records);
    expect(restored.finishedSessionIds).toEqual([active.id]);
    expect(restored.ultimateCards!.map(getUltimateCardKey)).not.toContain('starter:6');
    expect(getStarterBossMigrationResult(restored)).toBe(restored.runs![0]);
    expect(parseBackup(exportBackup(restored))).toEqual(restored);
  });

  it('rejects fabricated archives instead of silently dropping another mission or duplicating an existing checkpoint', () => {
    expect(() => validateProgress({ ...createProgress(), archivedSessions: [startSession(1, 'starter')] })).toThrow('不是已移除');
    const archived = retiredSession();
    expect(() => validateProgress({ ...createProgress(), archivedSessions: [archived, archived] })).toThrow('重複挑戰');
    expect(() => validateProgress({ ...createProgress(), active: archived, archivedSessions: [archived] })).toThrow('紀錄重複');
  });
});
