import { Clock3, Gem, HelpCircle, ShieldCheck, Sparkles } from 'lucide-react';
import type { Session } from '../domain/types';
import { getLevel } from '../content/levels';
import { getUltimateSpell } from '../content/ultimateSpells';
import { remainingBarrierCharges } from '../domain/engine';

export function BattleMechanics({ session, paused, onRules, onChooseSpell }: { session: Session; paused: boolean; onRules: () => void; onChooseSpell?: () => void }) {
  const energy = session.energy ?? 0;
  const barrierCharges = remainingBarrierCharges(session);
  const level = getLevel(session.levelId);
  const spell = getUltimateSpell(level.finalBoss ? session.preparedUltimateId ?? 0 : level.chapterId, session.mode);
  return <div className={'battle-mechanics ' + (energy === 3 ? 'is-ready' : '')}>
    <div className="battle-energy" aria-label={`必殺技能量 ${energy}／3${energy === 3 ? '，下一題答對施放' : ''}`}>
      <span className="energy-label"><Sparkles size={17} />{session.review ? '重玩練習 · 不充能' : energy === 3 ? '必殺就緒' : '必殺能量'}</span>
      <span className="energy-gems" aria-hidden="true">{[1, 2, 3].map(point => <Gem key={point} className={energy >= point ? 'filled' : ''} size={20} />)}</span>
      <b>{energy}／3</b>
      {barrierCharges > 0 && <span className="battle-barrier" title={`剩餘 ${barrierCharges} 次護盾，每次魔王攻擊可擋住 12 HP`}><ShieldCheck size={17} />護盾 ×{barrierCharges}</span>}
    </div>
    <div className="battle-time-tools">
      {session.timed && <span className={'battle-clock ' + ((session.remainingMs ?? 30000) <= 10000 ? 'is-low' : '')} aria-label={`本題剩餘 ${Math.ceil((session.remainingMs ?? 30000) / 1000)} 秒${paused ? '，倒數暫停' : ''}`}>
        <Clock3 size={18} /><b>{Math.ceil((session.remainingMs ?? 30000) / 1000)}<small> 秒</small></b>{paused && <small>暫停</small>}
      </span>}
      <button type="button" className="battle-rules-button" onClick={onRules} aria-label="查看必殺技與計分規則"><HelpCircle size={21} /></button>
    </div>
    {energy === 3 && <p className="battle-ready-note final-battle-selection">{session.mode === 'advanced' ? '進階升級必殺 · ' : ''}{spell ? `下一題答對：${spell.name}！` : '選好一招，下一題答對就施放！'}{level.finalBoss && session.step === 'action' && <button type="button" onClick={onChooseSpell}>選擇必殺技</button>}</p>}
  </div>;
}

export function BattleRules({ timed, finalBoss = false }: { timed: boolean; finalBoss?: boolean }) {
  return <div className="battle-rule-content">
    <h3>集滿三點，準備必殺技！</h3>
    <ul><li>自己答對一題，能量＋1；答錯保留能量。進階超時才扣 1 點，最低為 0。</li>
      <li>集滿 3 點後，下一題答對自動施放。施放後能量歸零，另外獲得 10 分獎勵和專屬收藏卡。</li>
      <li>使用提示後答對仍可充能；伙伴示範不充能、不施放必殺技。</li>
      {finalBoss && <li>最終關能量滿三點後，自選本組六種必殺技之一，下一次答對自動施放。選招時倒數暫停；答錯保留選招，超時扣一點並清除選招。</li>}
      <li>同一場中途離開可續玩；開始新關或重新挑戰，能量與護盾都歸零。收藏卡會保留。</li>
    </ul>
    <h3>{timed ? '進階：每題 30 秒' : '初階：不限時'}</h3>
    {timed ? <ul><li>10 秒內答對最高 20 分；10 秒後至 20 秒內最高 16 分；20 秒後至倒數歸零前最高 12 分。</li>
      <li>仍依答錯次數降低分數，用過提示最高 16 分。倒數在閱讀解說與規則、回首頁或切到背景時暫停；重試保留本題剩餘時間。</li>
      <li>時間到，該題 0 分，魔王攻擊扣 12 HP，演出後自動進下一題。每次護盾抵擋 12 HP；進階城堡可擋兩次攻擊。</li>
      <li>{finalBoss ? '最終關以擊敗 300 HP 魔王為過關目標；超時題得 0 分，仍可用後續攻擊追回傷害。' : '有超時題仍保留成績，但要重新挑戰並完成五題，才算過關。'}</li>
    </ul> : <ul><li>每題原始 20 分。錯 1／2／3／4 次以上後答對，分別得 16／12／8／4 分。</li><li>用過提示，該題最高 16 分；伙伴示範 0 分。</li></ul>}
    {finalBoss && <p>最終關最多 15 題，一般命中扣 20 HP，必殺額外傷害依選招種類。魔王 HP 歸零即可提前完成；題目用盡仍未擊敗，須重新挑戰。答題分依實際挑戰題數換算為百分制。</p>}
    <p>答題分數最高 100 分，必殺獎勵另外列出。血量不影響得分；血量歸零後重新挑戰。</p>
  </div>;
}
