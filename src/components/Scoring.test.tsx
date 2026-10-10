import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getQuestions, getQuestionsForHistory } from '../content';
import { advanceSession, chooseAction, createProgress, currentQuestion, finishSession,
  selectUltimate, startFinalBossSession, startSession, submitAction, tickQuestion } from '../domain/engine';
import { ScoreSummary } from './Scoring';
import type { CompletedRun } from '../domain/types';

describe('result rules preserve each starter question edition', () => {
  it.each([[false, 4, 25, 5, 20, 100], [true, 5, 20, 4, 16, 80]] as const)('labels and explains the completed starter report (archived: %s)', (archived, questionCount, points, penalty, hintCap, score) => {
    const at = '2026-10-10T05:00:00.000Z';
    const questions = getQuestionsForHistory(1, false, archived ? 'V4L01Q01' : undefined);
    const run: CompletedRun = { sessionId: `starter-${archived ? 'v4' : 'v5'}`, levelId: 1, mode: 'starter', review: false, at,
      records: questions.map(question => ({ questionId: question.id, mode: 'starter', action: Number(Object.keys(question.valid)[0]),
        reason: null, status: archived ? 'supported' : 'first', retries: 0, hintUsed: archived, at })) };
    const html = renderToStaticMarkup(<ScoreSummary run={run} />);
    expect(questions).toHaveLength(questionCount);
    expect(html).toContain(`${questionCount} 題關卡挑戰`);
    expect(html).toContain(`<strong>${score}</strong>`);
    expect(html).toContain(`本關 ${questionCount} 題，每題 ${points} 分`);
    expect(html).toContain(`每答錯一次扣 ${penalty} 分，自己答對至少得 ${penalty} 分`);
    expect(html).toContain(`用過提示，該題最高 ${hintCap} 分`);
    if (archived) expect(html).not.toContain('首次全對，滿分過關！');
    else expect(html).toContain('首次全對，滿分過關！');
  });
});

describe('result rules match damage in a completed advanced challenge', () => {
  it.each([false, true])('explains the actual unprotected timeout damage (final boss: %s)', finalBoss => {
    const progress = createProgress();
    progress.ultimateCards = Array.from({ length: 6 }, (_, index) => ({
      ultimateId: index + 1, unlockedAt: progress.updatedAt, sessionId: `earned-${index}`,
      questionId: getQuestions(index + 7)[3].id,
    }));
    let session = finalBoss ? startFinalBossSession(progress, 'advanced') : startSession(9, 'advanced');
    while (session.index < session.questionIds.length - 1) {
      if (finalBoss && session.energy === 3) session = selectUltimate(session, 3);
      session = advanceSession(submitAction(chooseAction(session, Number(Object.keys(currentQuestion(session).valid)[0])))).session!;
    }
    const expired = tickQuestion(session, 30_000);
    const run = finishSession(progress, expired).runs!.at(-1)!;
    const html = renderToStaticMarkup(<ScoreSummary run={run} />);
    expect(expired.lastEnemyDamage).toBe(finalBoss ? 20 : 12);
    expect(html).toContain(`超時 0 分、基本扣 ${expired.lastEnemyDamage} HP`);
    if (finalBoss) {
      expect(html).toContain('超時不累計連錯');
      expect(html).toContain('基本扣 30 HP');
      expect(html).toContain('實扣以戰鬥顯示為準');
    }
  });
});
