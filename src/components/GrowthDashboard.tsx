import { useId, useMemo, useState } from 'react';
import { ArrowRight, BookOpenCheck, ChevronLeft, ChevronRight, Flag, History, Medal, ShieldCheck, Sparkles, Target, TrendingUp } from 'lucide-react';
import { buildGrowthDashboard, type DashboardScope, type ScoredDashboardRun } from '../domain/growthDashboard';
import type { CompletedRun, Level, Progress } from '../domain/types';
import '../styles/growth-dashboard.css';

const scopes: { value: DashboardScope; label: string }[] = [
  { value: 'all', label: '全部闖關' }, { value: 'starter', label: '初階' },
  { value: 'advanced', label: '進階' }, { value: 'review', label: '舊版練習' },
];
const modeName = (mode: Level['mode']) => mode === 'starter' ? '初階' : '進階';
const levelNumber = (level: Level) => level.finalBoss ? '最終魔王關' : `第 ${level.mode === 'starter' ? level.id : level.id - 6} 關`;
const shortDate = (date: string) => new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(date));
const performanceColors: Record<string, string> = { first: '#137b60', supported: '#bc641b', demo: '#7450b2', timeout: '#be3754' };
const themeIcons = [ShieldCheck, Target, BookOpenCheck, Sparkles, Medal, Flag];

function RunScore({ item, compact = false }: { item: ScoredDashboardRun; compact?: boolean }) {
  return <div className={'gd-run-score' + (compact ? ' compact' : '')}>
    <strong>{item.score.totalScore}<span>分</span></strong>
    <span>答題 {item.score.score}{item.score.bonusScore > 0 && <> ＋ 必殺 {item.score.bonusScore}</>}</span>
  </div>;
}

export function GrowthDashboard({ progress, onRun, onLevel }: {
  progress: Progress; onRun: (run: CompletedRun) => void; onLevel: (level: Level) => void;
}) {
  const [scope, setScope] = useState<DashboardScope>('all');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [page, setPage] = useState(0);
  const titleId = useId();
  const dashboard = useMemo(() => buildGrowthDashboard(progress, scope), [progress, scope]);
  const themes = useMemo(() => {
    const grouped = new Map<number, typeof dashboard.levels>();
    dashboard.levels.forEach(item => { const key = item.level.finalBoss ? 7 : item.chapter.id; grouped.set(key, [...(grouped.get(key) ?? []), item]); });
    return [...grouped.values()];
  }, [dashboard.levels]);
  const history = [...dashboard.runs].reverse();
  const pageCount = Math.ceil(history.length / 6);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const latest = dashboard.latest;
  const selectScope = (value: DashboardScope) => { setScope(value); setPage(0); };

  return <section className="growth-dashboard" aria-labelledby={titleId}>
    <header className="gd-heading">
      <div><span className="gd-kicker"><TrendingUp size={22} />看見我的進步</span><h2 id={titleId}>我的闖關成績</h2></div>
      <div className="gd-scope" role="group" aria-label="選擇成績範圍">{scopes.filter(option => option.value !== 'review' || progress.runs?.some(run => run.review)).map(option => <button key={option.value} type="button" aria-pressed={scope === option.value} onClick={() => selectScope(option.value)}>{option.label}</button>)}</div>
    </header>

    <div className="gd-summary">
      <article className="gd-stat gd-stat-latest">
        <span className="gd-stat-label"><Flag size={23} />最近一次總分</span>
        {latest ? <><RunScore item={latest} /><span className="gd-stat-foot">{modeName(latest.level.mode)}{levelNumber(latest.level)}{latest.run.review ? ' · 重玩' : ''}{!latest.passed ? ' · 尚未過關' : ''}</span></> : <><strong className="gd-no-score">—</strong><span className="gd-stat-foot">完成挑戰，留下第一筆成績</span></>}
      </article>
      <article className="gd-stat gd-stat-best">
        <span className="gd-stat-label"><Medal size={23} />最高答題分</span>
        <strong className="gd-stat-number">{dashboard.best ? dashboard.best.score.score : '—'}<span>／100</span></strong>
        <span className="gd-stat-foot">必殺獎勵另外加分</span>
      </article>
      <article className="gd-stat gd-stat-perfect">
        <span className="gd-stat-label"><Sparkles size={23} />首次全對</span>
        <strong className="gd-stat-number">{dashboard.summary.perfectRuns}<span>次</span></strong>
        <span className="gd-stat-foot">每題首次答對，答題滿分</span>
      </article>
    </div>

    <section className="gd-themes" aria-labelledby={titleId + '-themes'}>
      <div className="gd-section-heading"><h3 id={titleId + '-themes'}>六大主題 · 我的最佳成績</h3><span>答題滿分 100，必殺獎勵另計</span></div>
      <div className="gd-theme-grid">{themes.map(items => {
        const chapter = items[0].chapter;
        const Icon = themeIcons[chapter.id - 1] ?? Sparkles;
        return <article className={'gd-theme-card gd-theme-' + chapter.id} key={items[0].level.finalBoss ? 7 : chapter.id}>
          <h4><span className="gd-theme-icon"><Icon size={25} /></span>{items[0].level.finalBoss ? '最終魔王決戰' : chapter.shortTitle}</h4>
          <div className="gd-level-bars">{items.map(item => {
            const best = item.best;
            return <button className={'gd-level-bar' + (!best ? ' unplayed' : '')} key={item.level.id} type="button" onClick={() => best ? onRun(best.run) : onLevel(item.level)} aria-label={best ? `${modeName(item.level.mode)}${levelNumber(item.level)}，${item.level.title}，最高答題 ${best.score.score} 分${best.score.bonusScore ? `，必殺加 ${best.score.bonusScore} 分` : ''}，${item.passed ? '本關已過關' : '尚未過關'}，查看最佳成績` : `${modeName(item.level.mode)}${levelNumber(item.level)}，${item.level.title}，尚無${scope === 'review' ? '重玩' : '闖關'}紀錄，前往闖關`}>
              <span className="gd-bar-top"><b>{modeName(item.level.mode)}{scope === 'review' ? '重玩' : ''}</b><strong>{best ? best.score.score : '—'}<small>{best ? '分' : '未挑戰'}</small></strong></span>
              <span className="gd-bar-track" aria-hidden="true"><span style={{ width: `${best?.score.score ?? 0}%` }} /></span>
              <span className="gd-bar-bottom"><span>{best ? <>{best.score.bonusScore > 0 ? <em className="gd-bonus">必殺 ＋{best.score.bonusScore}</em> : null}{item.passed ? <span className="gd-pass">本關已過關</span> : <span className="gd-not-passed">尚未過關</span>}</> : scope === 'review' ? '還沒有重玩成績' : '開始你的挑戰'}</span><span className="gd-bar-cta">{best ? '看成績' : scope === 'review' ? '先去闖關' : '去闖關'}<ArrowRight size={18} /></span></span>
            </button>;
          })}</div>
        </article>;
      })}</div>
    </section>

    <div className="gd-chart-grid">
      <TrendChart items={dashboard.trend} review={scope === 'review'} onRun={onRun} />
      <section className="gd-performance" aria-labelledby={titleId + '-performance'}>
        <h3 id={titleId + '-performance'}>我的答題方式</h3><p>各關最近一次的回答</p>
        <div className="gd-performance-body"><PerformanceRing items={dashboard.performance} total={dashboard.performanceTotal} />
          <ul className="gd-performance-key">{dashboard.performance.map(item => <li key={item.key}><span className="gd-key-dot" style={{ backgroundColor: performanceColors[item.key] }} /><span>{item.label}</span><strong>{item.count}<small>題</small></strong></li>)}</ul></div>
        {dashboard.performanceTotal === 0 && <p className="gd-chart-empty">完成挑戰後，會顯示回答方式。</p>}
      </section>
    </div>

    <section className="gd-history" aria-labelledby={titleId + '-history'}>
      <button className="gd-history-toggle" type="button" aria-expanded={historyOpen} aria-controls={titleId + '-history-body'} onClick={() => setHistoryOpen(!historyOpen)}>
        <span><History size={25} /><b id={titleId + '-history'}>全部挑戰紀錄</b><span className="gd-history-count">{history.length} 次</span></span><span className="gd-history-action">{historyOpen ? '收合' : '展開'}<ChevronRight size={22} className={historyOpen ? 'open' : ''} /></span>
      </button>
      {historyOpen && <div className="gd-history-body" id={titleId + '-history-body'}>
        {history.length > 0 ? <><div className="gd-history-cards">{history.slice(currentPage * 6, currentPage * 6 + 6).map(item => <article key={item.run.sessionId} className="gd-history-card">
          <div className="gd-history-title"><span>{modeName(item.level.mode)}{levelNumber(item.level)}{item.run.review ? ' · 重玩' : ''}</span><h4>{item.level.title}</h4><time dateTime={item.at}>{shortDate(item.at)}</time></div>
          <RunScore item={item} compact /><div className="gd-history-bottom"><span className={item.passed ? 'gd-pass' : 'gd-not-passed'}>{!item.passed ? '尚未過關' : item.score.perfect ? '首次全對' : '挑戰完成'}</span><button type="button" onClick={() => onRun(item.run)} aria-label={`查看 ${modeName(item.level.mode)}${levelNumber(item.level)}，${shortDate(item.at)}的成績`}>看成績<ArrowRight size={18} /></button></div>
        </article>)}</div>
          {pageCount > 1 && <nav className="gd-pagination" aria-label="挑戰紀錄分頁"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={20} />上一頁</button><span aria-live="polite">第 {currentPage + 1}／{pageCount} 頁</span><button type="button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>下一頁<ChevronRight size={20} /></button></nav>}</> : <p className="gd-chart-empty">這個範圍還沒有成績，先從一關開始吧！</p>}
      </div>}
    </section>
  </section>;
}

function TrendChart({ items, onRun, review }: { items: ScoredDashboardRun[]; onRun: (run: CompletedRun) => void; review: boolean }) {
  const titleId = useId();
  const width = 700, height = 240, left = 46, right = 30, top = 24, bottom = 30;
  const x = (index: number) => items.length <= 1 ? width / 2 : left + index / (items.length - 1) * (width - left - right);
  const y = (score: number) => top + (1 - score / 100) * (height - top - bottom);
  const points = items.map((item, index) => `${x(index)},${y(item.score.score)}`).join(' ');
  return <section className="gd-trend" aria-labelledby={titleId}>
    <div className="gd-chart-heading"><h3 id={titleId}>最近 {review ? '練習' : '闖關'} · 答題分</h3><span>最近 {items.length} 次</span></div>
    {items.length > 0 ? <><svg className="gd-trend-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={titleId + '-desc'}>
      <title id={titleId + '-desc'}>{`最近 ${items.length} 次${review ? '練習' : '闖關'}，由舊到新答題得分：${items.map(item => item.score.score).join('、')}。答題滿分 100 分，不含必殺獎勵。下方按鈕可查看每次成績。`}</title>
      {[0, 50, 100].map(tick => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="gd-grid-line" /><text x={left - 12} y={y(tick) + 6} textAnchor="end">{tick}</text></g>)}
      {items.length > 1 && <><polygon points={`${x(0)},${y(0)} ${points} ${x(items.length - 1)},${y(0)}`} className="gd-trend-area" /><polyline points={points} className="gd-trend-line" /></>}
      {items.map((item, index) => <g key={item.run.sessionId} className="gd-trend-point"><circle cx={x(index)} cy={y(item.score.score)} r="10" /><circle cx={x(index)} cy={y(item.score.score)} r="4" /></g>)}
    </svg><div className="gd-trend-buttons" style={{ '--trend-columns': items.length, '--trend-mobile-columns': Math.min(4, items.length) } as React.CSSProperties} aria-label="由舊到新的每次成績">{items.map((item, index) => <button type="button" key={item.run.sessionId} onClick={() => onRun(item.run)} aria-label={`第 ${index + 1} 次，${modeName(item.level.mode)}${levelNumber(item.level)}，答題 ${item.score.score} 分，查看成績`}><span>{index + 1}</span><strong>{item.score.score}<small>分</small></strong></button>)}</div><p className="gd-chart-note">從左到右：由舊到新。點分數看成績。</p></> : <div className="gd-trend-empty"><TrendingUp size={48} /><strong>進步，從第一次開始！</strong><p>完成挑戰後，就會畫出你的成績。</p></div>}
  </section>;
}

function PerformanceRing({ items, total }: { items: { key: string; label: string; count: number; percent: number }[]; total: number }) {
  const radius = 62, circumference = Math.PI * radius * 2;
  let offset = 0;
  const parts = items.map(item => {
    const length = total ? item.count / total * circumference : 0;
    const segment = { ...item, length, offset };
    offset += length;
    return segment;
  });
  return <div className="gd-ring" role="img" aria-label={`${total} 題回答，${items.map(item => item.label + ' ' + item.count + ' 題').join('，')}`}>
    <svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r={radius} className="gd-ring-track" />{parts.filter(item => item.length > 0).map(item => <circle key={item.key} cx="80" cy="80" r={radius} fill="none" stroke={performanceColors[item.key]} strokeWidth="18" strokeDasharray={`${item.length} ${circumference - item.length}`} strokeDashoffset={-item.offset} transform="rotate(-90 80 80)" />)}</svg>
    <span><strong>{total}</strong><small>題回答</small></span>
  </div>;
}
