import { useRef, useState } from 'react';
import { ArrowRight, BookOpen, Download, Flag, Lightbulb, Printer, RotateCcw, Settings, ShieldCheck, Sparkles, Upload, WifiOff } from 'lucide-react';
import { chapters, levels } from '../content/levels';
import { presentQuestion, questionById } from '../content';
import type { CompletedRun, Level, Progress } from '../domain/types';
import { exportBackup, parseBackup } from '../domain/storage';
import { useOffline } from '../platform/offline';
import { appAssetUrl } from '../platform/urls';
import { OfflineDownloadCard } from './OfflineDownloadCard';
import { chapterIcons, modeNames } from '../App';
import { UltimateCollection } from './UltimateCollection';
import { GrowthDashboard } from './GrowthDashboard';
import { ThinkingFootprints } from './ThinkingFootprints';
import { latestThinkingRecords } from '../domain/thinkingFootprints';

export function downloadFile(name: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <div className="page-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{children}</p></div>;
}

export function GrowthPanel({ progress, onLevel, onRun }: { progress: Progress; onLevel: (level: Level) => void; onRun: (run: CompletedRun) => void }) {
  const latest = latestThinkingRecords(progress.attempts);
  const needsPractice = latest.filter(a => a.status === 'practice' || a.status === 'timeout');
  return <>
    <Heading eyebrow="EVERY STEP COUNTS" title="每次練習，都會慢慢變強。">看看自己的進步，再挑戰一次！</Heading>
    <div className="growth-panel-milestones"><div className="surface"><Flag size={27} /><strong>{progress.completed.length}<small> / {levels.length}</small></strong><span>已完成關卡</span></div>
      <div className="surface"><Lightbulb size={27} /><strong>{latest.length}</strong><span>已練習情境</span></div>
      <div className="surface"><RotateCcw size={27} /><strong>{needsPractice.length}</strong><span>待練習情境</span></div></div>
    <ThinkingFootprints progress={progress} onLevel={onLevel} />
    <GrowthDashboard progress={progress} onLevel={onLevel} onRun={onRun} />
    <UltimateCollection cards={progress.ultimateCards ?? []} initialMode={progress.settings.mode} />
    <div className="section-heading"><h2>六種守護能力</h2><span className="section-note">完成同主題的初階與進階，點亮徽章</span></div>
    <div className="skill-grid">{chapters.map(chapter => {
      const Icon = chapterIcons[chapter.icon];
      const completed = levels.filter(l => !l.finalBoss && l.chapterId === chapter.id && progress.completed.includes(l.id)).length;
      return <div key={chapter.id} className={'skill-card ' + (completed === 2 ? 'unlocked' : '')} style={{ '--chapter-color': chapter.color } as React.CSSProperties}>
        <Icon size={29} /><h3>{chapter.skill}</h3><p>{chapter.shortTitle}</p><span>{completed === 2 ? '已點亮' : completed + ' / 2 關'}</span>
      </div>;
    })}</div>
  </>;
}

const proposalStages = ['保護參與者', '核對活動資訊', '善用 AI 分工', '分辨可疑影像', '誠實完成學習'];
export function ProposalPanel({ progress, onUpdate, onLevel, onNotice }: {
  progress: Progress; onUpdate: (p: Progress) => void; onLevel: (l: Level) => void; onNotice: (s: string) => void;
}) {
  const [index, setIndex] = useState(Math.max(0, progress.proposals.length - 1));
  const proposal = progress.proposals[index];
  const exportProposal = () => {
    if (!proposal) return;
    const text = '# 我的 AI 使用約定\n\n為班級活動訂一份安心使用 AI 的約定\n\n' + proposal.decisions.map((d, i) =>
      '## ' + (i + 1) + '. ' + proposalStages[i] + '\n\n' + d.action + (d.reason ? '\n\n理由：' + d.reason : '')).join('\n\n') +
      '\n\n## 我還想補充\n\n' + (proposal.reflection || '（尚未填寫）') +
      '\n\n《AI 校園守護隊》離線學習模擬 · ' + modeNames[proposal.mode] + '模式\n';
    downloadFile('我的 AI 使用約定.md', text, 'text/markdown;charset=utf-8'); onNotice('守護提案已匯出。也可以使用「列印提案」存成 PDF。');
  };
  return <>
    <Heading eyebrow="YOUR GUARDIAN PROPOSAL" title="我的好方法，讓 AI 幫上忙。">完成進階第六關，就能得到自己的 AI 使用約定卡。把查證、個資與學習誠信，一起帶進班級生活。</Heading>
    {!proposal ? <div className="surface empty-state"><BookOpen size={45} /><h2>你的第一份守護提案，在這裡等你。</h2><p>為班級活動選擇能保護同學、核對資訊，又能自己學會的做法。</p><button className="button primary" onClick={() => onLevel(levels[11])}>前往進階第 6 關<ArrowRight size={18} /></button></div> : <>
      <div className="proposal-toolbar"><label>選擇提案 <select value={index} onChange={e => setIndex(Number(e.target.value))}>{progress.proposals.map((p, i) => <option key={p.at} value={i}>第 {i + 1} 份 · {modeNames[p.mode]} · {new Date(p.at).toLocaleDateString('zh-TW')}</option>)}</select></label>
        <div><button className="button secondary" onClick={exportProposal}><Download size={17} />匯出文字</button><button className="button primary" onClick={() => window.print()}><Printer size={17} />列印提案</button></div></div>
      <article className="proposal-card" id="printable-proposal"><div className="proposal-card-head"><img src={appAssetUrl('/icon-192.png')} alt="" /><div><span className="eyebrow">MY CAMPUS, OUR FUTURE</span><h2>我的 AI 使用約定</h2><p>為班級活動訂一份安心使用 AI 的約定</p></div><span className="proposal-stamp"><ShieldCheck size={28} />校園守護隊</span></div>
        <div className="proposal-decisions">{proposal.decisions.map((d, i) => <section key={d.questionId}><span>{String(i + 1).padStart(2, '0')}</span><div><h3>{proposalStages[i]}</h3><p>{d.action}</p><small>{d.reason || presentQuestion(questionById.get(d.questionId)!, proposal.mode).explanation}</small></div></section>)}</div>
        <div className="proposal-reflection"><label htmlFor="reflection"><Sparkles size={18} />我還想補充的保障或新點子</label><textarea id="reflection" maxLength={4000} rows={4} placeholder="例如：我想先問同學有哪些需要，再和老師一起試用。" value={proposal.reflection} onChange={e => {
          const proposals = progress.proposals.map((p, i) => i === index ? { ...p, reflection: e.target.value } : p);
          onUpdate({ ...progress, proposals, updatedAt: new Date().toISOString() });
        }} /><p className="print-reflection">{proposal.reflection || '我會繼續觀察、詢問與修正。'}</p><small className="reflection-note">自由文字只保存在這台裝置，作為反思紀錄，不交給 AI 判分。</small></div>
        <footer>我的好主意，也會隨新資訊繼續改進。<span>{modeNames[proposal.mode]}模式 · {new Date(proposal.at).toLocaleDateString('zh-TW')}</span></footer>
      </article>
    </>}
  </>;
}

export function OfflinePanel({ progress, offline, onUpdate, onNotice, onMap }: {
  progress: Progress; offline: ReturnType<typeof useOffline>; onUpdate: (p: Progress) => void; onNotice: (s: string) => void; onMap: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Progress | null>(null);
  const [importError, setImportError] = useState('');
  const { state } = offline;
  const transfer = async (file: File | undefined) => {
    setImportError(''); if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('備份檔超過 10 MB，請確認選的是遊戲匯出的 JSON 檔。');
      setPending(parseBackup(await file.text()));
    } catch (error) { setImportError(error instanceof Error ? error.message : '備份讀取失敗，原進度保留。'); }
    if (input.current) input.current.value = '';
  };
  return <>
    <Heading eyebrow="READY, EVEN WITHOUT WI-FI" title="把冒險，帶到沒有網路的地方。">先在有網路時下載完整內容，再到離線環境挑戰。角色、題庫、字型、線索與朗讀都會保存在這台裝置。</Heading>
    <OfflineDownloadCard offline={offline} />
    <div className="settings-grid"><section className="surface settings-section"><div className="panel-title"><Download size={21} /><h2>加入裝置主畫面</h2></div><p>從主畫面直接打開，比重新尋找網址方便。</p>
      {offline.installable ? <button className="button secondary" onClick={() => { void offline.install().catch(e => onNotice(e.message)); }}><Download size={17} />安裝到這台裝置</button> : <div className="install-steps"><p><b>iPhone / iPad</b><br />用 Safari 開啟 → 分享 → 加入主畫面。</p><p><b>Android / 電腦</b><br />使用瀏覽器的「安裝應用程式」或「加入主畫面」。</p></div>}
      <div className="hint-box"><WifiOff size={18} /><p>完成下載後，用飛航模式重新開啟並試播朗讀。清除網站資料會刪除離線包與進度，請先備份。</p></div></section>
      <section className="surface settings-section"><div className="panel-title"><ShieldCheck size={21} /><h2>我的進度備份</h2></div><p>不需要登入。進度只存在本機，匯出後能帶到另一台裝置。</p>
        <div className="backup-buttons"><button className="button primary" onClick={() => {
          downloadFile('AI校園守護隊-進度-' + new Date().toISOString().slice(0, 10) + '.json', exportBackup(progress), 'application/json');
          onNotice('進度備份已匯出，請妥善保存 JSON 檔。');
        }}><Download size={17} />匯出進度</button><button className="button secondary" onClick={() => input.current?.click()}><Upload size={17} />匯入備份</button></div>
        <input ref={input} type="file" accept=".json,application/json" className="visually-hidden" aria-label="選擇進度備份" onChange={e => { void transfer(e.target.files?.[0]); }} />
        {importError && <p className="error-text" role="alert">{importError}</p>}
        {pending && <div className="import-confirm"><b>備份已檢查：完成 {pending.completed.length} 關、{pending.attempts.length} 筆思考紀錄。</b><p>還原會取代這台裝置目前的進度。建議先匯出目前紀錄。</p><div><button className="button primary" onClick={() => { onUpdate(pending); setPending(null); onNotice('備份已還原。途中任務可以從地圖繼續。'); onMap(); }}>還原這份備份</button><button className="text-button" onClick={() => setPending(null)}>取消</button></div></div>}
        <small>目前完成 {progress.completed.length} 關 · 最後更新 {new Date(progress.updatedAt).toLocaleString('zh-TW')}</small>
      </section></div>
    <section className="surface settings-section preferences"><div className="panel-title"><Settings size={21} /><h2>我的冒險偏好</h2></div>
      <div className="preference-row"><div><b>音效回饋</b><p>確認答案時，播放出招與提示音效。</p></div><Toggle label="音效回饋" checked={progress.settings.sound} onChange={sound => onUpdate({ ...progress, settings: { ...progress.settings, sound } })} /></div>
      <div className="preference-row"><div><b>冒險與戰鬥背景音樂</b><p>主頁播放輕快的探索配樂，對戰時換成緊湊配樂。可用頁面上的音樂按鈕隨時關閉；關閉設定會保留。</p></div><Toggle label="冒險與戰鬥背景音樂" checked={progress.settings.music} onChange={music => onUpdate({ ...progress, settings: { ...progress.settings, music } })} /></div>
      <div className="preference-row"><div><b>點擊朗讀</b><p>需要時按題目、提示或解說旁的喇叭，再按一次可停止。新題目不會自動朗讀。</p></div><span className="tag">手動播放</span></div>
      <div className="preference-row"><div><b>減少動態效果</b><p>保留角色與血量，減少漂浮和攻擊動畫。</p></div><Toggle label="減少動態效果" checked={progress.settings.reducedMotion} onChange={reducedMotion => onUpdate({ ...progress, settings: { ...progress.settings, reducedMotion } })} /></div>
      <div className="preference-row"><div><b>挑戰模式</b><p>初階不限時；進階每題 30 秒，答得越快，該題得分上限越高。兩種路線各六個主題關；集齊本組六張必殺收藏卡，還能開啟最終魔王關（初階200HP、進階300HP）。</p></div><select aria-label="挑戰模式" value={progress.settings.mode} onChange={e => onUpdate({ ...progress, settings: { ...progress.settings, mode: e.target.value as Progress['settings']['mode'] } })}><option value="starter">初階</option><option value="advanced">進階</option></select></div>
    </section>
  </>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className={'toggle ' + (checked ? 'on' : '')} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>;
}
