import { useId, useMemo, useState } from 'react';
import { ArrowRight, BookOpenCheck, Check, ChevronLeft, ChevronRight, Crown, Footprints, Leaf, RotateCcw, ShieldCheck, Sparkles, Target, X } from 'lucide-react';
import { presentQuestion, questionById } from '../content';
import { buildThinkingFootprints, footprintStatuses, footprintStatusNames } from '../domain/thinkingFootprints';
import type { Level, Mode, Progress } from '../domain/types';
import '../styles/thinking-footprints.css';

const icons = [ShieldCheck, Target, BookOpenCheck, Sparkles, Leaf, Footprints];
const modeName = (mode: Mode) => mode === 'starter' ? '初階' : '進階';
const levelLabel = (level: Level) => level.finalBoss ? '最終決戰' : `第 ${level.mode === 'starter' ? level.id : level.id - 6} 關`;

export function ThinkingFootprints({ progress, onLevel }: { progress: Progress; onLevel: (level: Level) => void }) {
  const [mode, setMode] = useState(progress.settings.mode);
  const [practiceOnly, setPracticeOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const id = useId();
  const data = useMemo(() => buildThinkingFootprints(progress, mode, practiceOnly), [progress, mode, practiceOnly]);
  const selected = data.items.find(item => item.level.id === selectedId);
  const pageCount = Math.max(1, Math.ceil((selected?.records.length ?? 0) / 6));
  const currentPage = Math.min(page, pageCount - 1);
  const changeMode = (next: Mode) => { setMode(next); setSelectedId(null); setPage(0); };
  const circumference = Math.PI * 34 * 2;

  return <section className="thinking-footprints" aria-labelledby={id + '-title'}>
    <header className="tf-heading"><div><span className="tf-eyebrow"><Footprints size={20} />一眼看見我的旅程</span><h2 id={id + '-title'} tabIndex={-1}>我的思考足跡</h2></div>
      <div className="tf-mode" role="group" aria-label="選擇足跡路線">{(['starter', 'advanced'] as const).map(value => <button key={value} type="button" aria-pressed={value === mode} onClick={() => changeMode(value)}>{modeName(value)}</button>)}</div>
    </header>
    <div className="tf-overview">
      <div className="tf-completion"><div className="tf-ring" role="img" aria-label={`${modeName(mode)}已完成 ${data.completed} / ${data.total} 關`}>
        <svg viewBox="0 0 84 84" aria-hidden="true"><circle className="tf-ring-track" cx="42" cy="42" r="34" /><circle className="tf-ring-value" cx="42" cy="42" r="34" strokeDasharray={`${circumference * data.completed / data.total} ${circumference}`} transform="rotate(-90 42 42)" /></svg><strong>{data.completed}<small>/{data.total}</small></strong>
      </div><div><b>{modeName(mode)}完成關卡</b><span>已練習 {data.practiced} 個情境</span></div></div>
      <div className="tf-filter" role="group" aria-label="篩選思考足跡"><button type="button" aria-pressed={!practiceOnly} onClick={() => { setPracticeOnly(false); setPage(0); }}>全部關卡</button><button type="button" aria-pressed={practiceOnly} onClick={() => { setPracticeOnly(true); setPage(0); }}><RotateCcw size={17} />再練習 <strong>{data.practice}</strong><span>題</span></button></div>
    </div>
    <p className="tf-guide">點選關卡看重點，再挑戰一次。色帶呈現每個情境最近一次的回答。</p>
    <div className="tf-grid">{data.items.map(item => {
      const Icon = item.level.finalBoss ? Crown : icons[item.level.chapterId - 1] ?? Sparkles;
      return <button type="button" key={item.level.id} className={'tf-level' + (item.completed ? ' completed' : '') + (item.practice ? ' needs-practice' : '')} aria-expanded={selected?.level.id === item.level.id} aria-controls={id + '-detail'} onClick={() => { setSelectedId(selected?.level.id === item.level.id ? null : item.level.id); setPage(0); }} aria-label={`${modeName(mode)}${levelLabel(item.level)}，${item.level.title}，${item.completed ? '已完成' : item.records.length ? '練習中' : '尚未探索'}，${item.practice ? `待練習 ${item.practice} 題` : `已練習 ${item.records.length} 題`}，查看紀錄`}>
        <span className="tf-level-top"><span className="tf-level-icon"><Icon size={24} /></span><span>{levelLabel(item.level)}</span>{item.completed && <Check size={18} aria-hidden="true" />}</span>
        <strong className="tf-level-title">{item.level.title}</strong>
        <span className="tf-status-bar" role="img" aria-label={item.records.length ? footprintStatuses.map(status => `${footprintStatusNames[status]} ${item.counts[status]} 題`).join('，') : '尚無作答紀錄'}>{footprintStatuses.filter(status => item.counts[status] > 0).map(status => <span key={status} className={'tf-' + status} style={{ flex: item.counts[status] }} />)}</span>
        <span className="tf-level-bottom"><span>{item.practice ? `待練 ${item.practice} 題` : item.completed ? '已完成' : item.records.length ? '練習中' : '尚未探索'}</span><ChevronRight size={17} /></span>
      </button>;
    })}</div>
    {data.items.length === 0 && <div className="tf-empty"><Check size={28} /><div><strong>這條路線目前沒有待練習情境</strong><p>切回全部關卡，探索新關卡或重玩喜歡的主題。</p></div><button type="button" onClick={() => setPracticeOnly(false)}>查看全部</button></div>}
    <div className="tf-legend" aria-label="回答色帶圖例">{footprintStatuses.map(status => <span key={status}><i className={'tf-' + status} />{footprintStatusNames[status]}</span>)}</div>
    <div id={id + '-detail'} hidden={!selected}>{selected && <section className="tf-detail" aria-labelledby={id + '-detail-title'}>
      <header><div><span>{modeName(mode)} · {levelLabel(selected.level)}</span><h3 id={id + '-detail-title'}>{selected.level.title}</h3></div><button type="button" className="tf-close" aria-label="收合關卡紀錄" onClick={() => { setSelectedId(null); document.getElementById(id + '-title')?.focus(); }}><X size={22} /></button></header>
      <p>{selected.level.objective}</p>
      {selected.records.length ? <><ul className="tf-records">{selected.records.slice(currentPage * 6, currentPage * 6 + 6).map(record => <li key={record.questionId}><span className={'tf-record-status tf-' + record.status}>{footprintStatusNames[record.status]}</span><span>{presentQuestion(questionById.get(record.questionId)!, record.mode).prompt}</span></li>)}</ul>
        {pageCount > 1 && <nav className="tf-pagination" aria-label="情境紀錄分頁"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={18} />上一頁</button><span aria-live="polite">{currentPage + 1} / {pageCount}</span><button type="button" disabled={currentPage + 1 === pageCount} onClick={() => setPage(currentPage + 1)}>下一頁<ChevronRight size={18} /></button></nav>}</> : <p className="tf-no-records">第一步，是開始觀察。完成情境後，就會留下足跡。</p>}
      <button type="button" className="tf-challenge" onClick={() => onLevel(selected.level)}>{selected.records.length ? '再挑戰這一關' : '探索這一關'}<ArrowRight size={19} /></button>
    </section>}</div>
  </section>;
}
