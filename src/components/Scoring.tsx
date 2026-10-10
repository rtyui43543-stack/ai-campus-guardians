import { Award, CheckCircle2, Lightbulb, RotateCcw, Sparkles } from 'lucide-react';
import type { CompletedRun, Progress } from '../domain/types';
import { bestRun, getLevelRuns, scoreSession } from '../domain/scoring';
import { getLevel } from '../content/levels';

export function ScoreSummary({ run }: { run: CompletedRun }) {
  const result = scoreSession(run);
  const finalBoss = getLevel(run.levelId).finalBoss;
  const questionPoints = 100 / result.questionCount;
  const errorPenalty = questionPoints / 5;
  return <section className="score-summary" aria-label="本次闖關成績">
    <div className="score-heading"><div><span>本次得分</span><h2>{result.perfect ? '首次全對，滿分過關！' : '每次思考，都看得見進步'}</h2></div><Award size={34} aria-hidden="true" /></div>
    <div className="score-total"><strong>{result.score}</strong><span>／100 答題分</span><b>{finalBoss ? `最終決戰 · 挑戰 ${run.records.length} 題` : run.review ? '過往練習紀錄' : `${result.questionCount} 題關卡挑戰`}</b></div>
    <div className="score-bonus">
      <span className="score-bonus-gain"><Sparkles size={24} aria-hidden="true" /><span>必殺獎勵</span><b className="score-bonus-number">＋{result.bonusScore}</b><span>分</span></span>
      <span className="score-bonus-uses">釋放 <b>{result.ultimateUses}</b> 次</span>
      <strong className="score-bonus-total"><span>總分</span><b className="score-bonus-number">{result.totalScore}</b><span>分</span></strong>
    </div>
    <div className="score-stats">
      <div><CheckCircle2 size={21} /><span>首次獨立答對</span><strong>{result.firstTryCorrect}<small>／{result.questionCount} 題</small></strong></div>
      <div><RotateCcw size={21} /><span>{result.unknownWrongAnswers ? '已知答錯' : '答錯次數'}</span><strong>{result.wrongAnswers}<small> 次</small></strong></div>
      <div><Lightbulb size={21} /><span>使用提示</span><strong>{result.hints}<small> 題</small></strong></div>
      <div><Sparkles size={21} /><span>伙伴示範</span><strong>{result.demos}<small> 題</small></strong></div>
    </div>
    {result.unknownWrongAnswers > 0 && <p className="score-legacy-note">有 {result.unknownWrongAnswers} 題舊紀錄未記下確切錯誤次數；重新挑戰可留下完整成績。</p>}
    <details className="score-rule"><summary>分數怎麼算？</summary>
      <ul><li>{finalBoss ? '最終關最多15題，每題原始20分；答錯一次扣4分，自己答對至少4分。依實際挑戰題數換算百分制，魔王HP歸零即可提前過關。' : run.review ? '過往練習共兩題，每題 50 分；每答錯一次扣 10 分，自己答對至少得 10 分。' : `本關 ${result.questionCount} 題，每題 ${questionPoints} 分；每答錯一次扣 ${errorPenalty} 分，自己答對至少得 ${errorPenalty} 分。`}</li>
        <li>{`用過提示，該題最高 ${finalBoss ? 16 : questionPoints * .8} 分；伙伴示範完成的題目得 0 分。`}</li>
        {run.records.some(record => record.timed) && <li>進階每題 30 秒：10 秒內原始最高 20 分、20 秒內最高 16 分、倒數歸零前最高 12 分。答錯、提示與時間上限取較低分數。超時 0 分、基本扣 {finalBoss ? 20 : 12} HP、自動進下一題；{finalBoss ? '超時不累計連錯。最終關以魔王HP歸零為過關條件。' : '含超時題須重新挑戰才可過關。'}</li>}
        {finalBoss && <li>最終魔王基本攻擊扣 20 HP；連續答錯第 2 次起施放必殺技，基本扣 30 HP。答對後連錯歸零。護盾、寒冰減傷或鏡像閃避會降低實際扣血，實扣以戰鬥顯示為準。</li>}
        <li>必殺技另外獎勵 10 分；總分是答題分加必殺獎勵，可超過 100 分。血量不影響分數。</li>
        <li>首次全對代表全部第一次答對，而且沒有用提示或示範。初階與重玩練習不計速度；舊紀錄保留原分數。</li></ul>
    </details>
  </section>;
}

export function LevelScore({ progress, levelId }: { progress: Progress; levelId: number }) {
  const runs = getLevelRuns(progress, levelId);
  const best = bestRun(progress, levelId);
  const recent = runs.at(-1);
  if (!best || !recent) return <p className="level-score-empty">{progress.completed.includes(levelId) ? '已過關，尚無完整評分紀錄' : '完成挑戰後，這裡會顯示分數'}</p>;
  return <div className="level-score-summary"><strong><Award size={18} />答題最高 {scoreSession(best).score} 分</strong><span>最近總分 {scoreSession(recent).totalScore} 分{recent.passed === false ? '（尚未過關）' : ''} · 挑戰 {runs.length} 次</span></div>;
}
