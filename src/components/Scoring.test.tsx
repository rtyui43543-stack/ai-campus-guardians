import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getQuestions } from '../content';
import { advanceSession, chooseAction, createProgress, currentQuestion, finishSession,
  selectUltimate, startFinalBossSession, startSession, submitAction, tickQuestion } from '../domain/engine';
import { ScoreSummary } from './Scoring';

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
