import { Award, CheckCircle2, Lightbulb, RotateCcw, Sparkles } from 'lucide-react';
import type { CompletedRun, Progress } from '../domain/types';
import { bestRun, getLevelRuns, scoreSession } from '../domain/scoring';

export function ScoreSummary({ run }: { run: CompletedRun }) {
  const result = scoreSession(run);
  return <section className="score-summary" aria-label="本次闖關成績">
    <div className="score-heading"><div><span>本次得分</span><h2>{result.perfect ? '首次全對，滿分過關！' : '每次思考，都看得見進步'}</h2></div><Award size={34} aria-hidden="true" /></div>
    <div className="score-total"><strong>{result.score}</strong><span>／100 答題分</span><b>{run.review ? '兩題重玩練習' : '五題關卡挑戰'}</b></div>
    <div className="score-bonus"><Sparkles size={24} /><span>必殺獎勵 <b>＋{result.bonusScore} 分</b> · 釋放 {result.ultimateUses} 次</span><strong>總分 {result.totalScore} 分</strong></div>
    <div className="score-stats">
      <div><CheckCircle2 size={21} /><span>首次獨立答對</span><strong>{result.firstTryCorrect}<small>／{result.questionCount} 題</small></strong></div>
      <div><RotateCcw size={21} /><span>{result.unknownWrongAnswers ? '已知答錯' : '答錯次數'}</span><strong>{result.wrongAnswers}<small> 次</small></strong></div>
      <div><Lightbulb size={21} /><span>使用提示</span><strong>{result.hints}<small> 題</small></strong></div>
      <div><Sparkles size={21} /><span>伙伴示範</span><strong>{result.demos}<small> 題</small></strong></div>
    </div>
    {result.unknownWrongAnswers > 0 && <p className="score-legacy-note">有 {result.unknownWrongAnswers} 題舊紀錄未記下確切錯誤次數；重新挑戰可留下完整成績。</p>}
    <details className="score-rule"><summary>分數怎麼算？</summary>
      <ul><li>{run.review ? '重玩共兩題，每題 50 分；每答錯一次扣 10 分，自己答對至少得 10 分。' : '每關五題，每題 20 分；每答錯一次扣 4 分，自己答對至少得 4 分。'}</li>
        <li>{run.review ? '用過提示，該題最高 40 分；伙伴示範完成的題目得 0 分。' : '用過提示，該題最高 16 分；伙伴示範完成的題目得 0 分。'}</li>
        {run.records.some(record => record.timed) && <li>進階每題 30 秒：10 秒內最高 20 分、20 秒內最高 16 分、倒數歸零前最高 12 分。答錯、提示與時間上限取較低分數。超時 0 分、扣 12 HP、自動進下一題；含超時題須重新挑戰才可過關。</li>}
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
