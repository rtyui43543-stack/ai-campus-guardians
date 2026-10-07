import { useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, Download, FileCheck, Flag, HandHeart, Info, Lightbulb, Medal, Printer, RotateCcw, Settings, ShieldCheck, Sparkles, Upload, Volume2, WifiOff } from 'lucide-react';
import { chapters, levels, sourceLabels } from '../content/levels';
import { presentQuestion, questionById, questions } from '../content';
import type { CompletedRun, Level, Progress } from '../domain/types';
import { scoreSession } from '../domain/scoring';
import { exportBackup, parseBackup } from '../domain/storage';
import { useOffline } from '../platform/offline';
import { appAssetUrl } from '../platform/urls';
import { OfflineDownloadCard } from './OfflineDownloadCard';
import { chapterIcons, modeNames, statusNames } from '../App';

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
  const [filter, setFilter] = useState<'all' | 'practice'>('all');
  const latest = new Map<string, (typeof progress.attempts)[number]>();
  progress.attempts.forEach(attempt => latest.set(attempt.questionId + ':' + attempt.mode, attempt));
  const needsPractice = [...latest.values()].filter(a => a.status === 'practice');
  const runs = [...(progress.runs ?? [])].reverse();
  return <>
    <Heading eyebrow="EVERY STEP COUNTS" title="每次練習，都會慢慢變強。">看看哪些題目自己答對，哪些用過提示。下次再試一次，學會的好方法就更多了。</Heading>
    <div className="growth-overview"><div className="surface"><Flag size={27} /><strong>{progress.completed.length}<small> / 12</small></strong><span>已完成的修復任務</span></div>
      <div className="surface"><Lightbulb size={27} /><strong>{latest.size}</strong><span>留下思考紀錄的情境</span></div>
      <div className="surface"><RotateCcw size={27} /><strong>{needsPractice.length}</strong><span>值得再練習的情境</span></div></div>
    <section className="surface run-history" aria-label="我的闖關成績"><h2>我的闖關成績</h2><p>每次挑戰的分數與回答方式都會保留。點一筆成績，就能查看逐題得分。</p>
      {runs.length ? <div className="run-history-list">{runs.map(run => { const level = levels.find(item => item.id === run.levelId)!; const score = scoreSession(run); return <button key={run.sessionId} onClick={() => onRun(run)}>
        <span><b>{modeNames[run.mode]} · 第 {run.mode === 'starter' ? run.levelId : run.levelId - 6} 關 · {level.title}{run.review ? '（重玩練習）' : ''}</b><small>{new Date(run.at).toLocaleString('zh-TW')} · {score.perfect ? '首次全對' : '點開查看回答紀錄'}</small></span><strong>{score.score} 分</strong><ChevronRight size={19} /></button>; })}</div> : <p className="empty-score-history">完成一次關卡挑戰後，這裡會顯示分數。舊版的完整回答紀錄也會換算；沒有完整紀錄的關卡可重新挑戰。</p>}
    </section>
    <div className="section-heading"><h2>六種守護能力</h2><span className="section-note">完成同主題的初階與進階，點亮徽章</span></div>
    <div className="skill-grid">{chapters.map(chapter => {
      const Icon = chapterIcons[chapter.icon];
      const completed = levels.filter(l => l.chapterId === chapter.id && progress.completed.includes(l.id)).length;
      return <div key={chapter.id} className={'skill-card ' + (completed === 2 ? 'unlocked' : '')} style={{ '--chapter-color': chapter.color } as React.CSSProperties}>
        <Icon size={29} /><h3>{chapter.skill}</h3><p>{chapter.shortTitle}</p><span>{completed === 2 ? '已點亮' : completed + ' / 2 關'}</span>
      </div>;
    })}</div>
    <div className="section-heading"><h2>我的思考足跡</h2><div className="segmented"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>全部關卡</button><button className={filter === 'practice' ? 'selected' : ''} onClick={() => setFilter('practice')}>再練習</button></div></div>
    <div className="surface growth-levels">{levels.filter(level => filter === 'all' || needsPractice.some(a => questionById.get(a.questionId)!.levelId === level.id)).map(level => {
      const records = [...latest.values()].filter(a => questionById.get(a.questionId)!.levelId === level.id);
      return <details key={level.id}><summary><span className="level-number">{String(level.id).padStart(2, '0')}</span><b>{level.title}</b><span className="status-badge">{progress.completed.includes(level.id) ? '已完成' : records.length ? '練習中' : '尚未探索'}</span><ChevronRight size={17} /></summary>
        <div className="growth-level-content"><p>{level.objective}</p>{records.length ? <div className="growth-records">{records.map(record => <span key={record.questionId + record.mode}><em className={'status-badge ' + record.status}>{statusNames[record.status]}</em>{modeNames[record.mode]} · {questionById.get(record.questionId)!.objective}</span>)}</div> : <p className="muted">第一步，是開始觀察。</p>}
          <button className="text-button" onClick={() => onLevel(level)}>探索這一關<ArrowRight size={17} /></button></div>
      </details>;
    })}{filter === 'practice' && !needsPractice.length && <div className="empty-state small"><Medal size={32} /><p>目前沒有待練習的示範題。也可以重玩關卡，挑戰不同情境。</p></div>}</div>
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
      <div className="preference-row"><div><b>戰鬥背景音樂</b><p>對戰時播放緊湊的冒險配樂；也能在題目旁隨時關閉。</p></div><Toggle label="戰鬥背景音樂" checked={progress.settings.music} onChange={music => onUpdate({ ...progress, settings: { ...progress.settings, music } })} /></div>
      <div className="preference-row"><div><b>點擊朗讀</b><p>需要時按題目、提示或解說旁的喇叭，再按一次可停止。新題目不會自動朗讀。</p></div><span className="tag">手動播放</span></div>
      <div className="preference-row"><div><b>減少動態效果</b><p>保留角色與血量，減少漂浮和攻擊動畫。</p></div><Toggle label="減少動態效果" checked={progress.settings.reducedMotion} onChange={reducedMotion => onUpdate({ ...progress, settings: { ...progress.settings, reducedMotion } })} /></div>
      <div className="preference-row"><div><b>挑戰模式</b><p>初階從生活小事開始；進階多一個需要思考的狀況。兩種路線各六關，都能直接選答案。</p></div><select aria-label="挑戰模式" value={progress.settings.mode} onChange={e => onUpdate({ ...progress, settings: { ...progress.settings, mode: e.target.value as Progress['settings']['mode'] } })}><option value="starter">初階 · 3–4 年級</option><option value="advanced">進階 · 5–6 年級</option></select></div>
    </section>
  </>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className={'toggle ' + (checked ? 'on' : '')} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>;
}

export function ManualPanel({ onLevel }: { onLevel: (l: Level) => void }) {
  const [sourceFilter, setSourceFilter] = useState(0);
  const exportSources = () => {
    const rows = questions.map(q => ({ id: q.id, level: q.levelId, slot: q.slot, objective: q.objective, units: q.source.units, printedPages: q.source.pages, label: sourceLabels[q.source.label], variantOf: q.variantOf ?? null }));
    downloadFile('AI校園守護隊-教材對照.json', JSON.stringify(rows, null, 2), 'application/json');
  };
  return <>
    <Heading eyebrow="A GUIDE FOR HUMAN GUIDES" title="陪孩子，把答案想清楚。">以《生活中的人工智慧》為知識主線，將生活應用重新編成校園任務。遊戲倫理延伸另作標示。</Heading>
    <div className="manual-principles"><div className="surface"><BookOpen size={27} /><h3>教材是起點</h3><p>教材的辨識、分類與人機協作，結合 AI 倫理與正確使用方式，重組為六個生活主題。</p></div>
      <div className="surface"><HandHeart size={27} /><h3>討論才有深度</h3><p>取捨題接受不同完整方案。先問「照顧到誰？」「還少哪個保障？」</p></div>
      <div className="surface"><Lightbulb size={27} /><h3>修正也是能力</h3><p>答對攻擊並扣敵方 HP，學習紀錄另列是否獨立完成。示範後安排新題，再看看孩子是否學會。</p></div></div>
    <section className="surface manual-section"><h2>一堂課，可以這樣進行</h2><div className="lesson-flow"><div><span>01</span><b>一起看情境</b><p>辨認任務、可用線索與受影響的人。</p></div><div><span>02</span><b>各自選擇</b><p>約 6–10 分鐘一關為試玩目標，不設倒數。</p></div><div><span>03</span><b>比較理由</b><p>討論兩種合理方案的效益、代價與保障。</p></div><div><span>04</span><b>試新情境</b><p>重玩變式，看看方法是否能用到不同案例。</p></div></div><p className="muted">時間為設計目標，尚需實際學生試玩確認。教師可從地圖自由選關，不必等全部解鎖。</p></section>
    <section className="surface manual-section"><h2>分數與學習紀錄</h2><p>每關滿分 100 分，五題各 20 分；每答錯一次扣 4 分，自己答對至少得 4 分。使用提示的題目最高 16 分，伙伴示範的題目得 0 分。兩題重玩練習各 50 分、答錯扣 10 分、最低 10 分、提示最高 40 分。全部首次獨立答對且未使用提示或示範，才是首次全對。</p><p>結算會列出逐題分數與答錯次數。「我的成長」保存每次完整挑戰與重玩成績；地圖顯示主要挑戰的最高分及最近得分。分數反映這次回答的獨立程度，不計速度或血量；教師仍可透過討論及新情境觀察理解。舊紀錄若沒有完整題序，不推算分數；舊示範題的錯誤次數不明時會明確標示。</p></section>
    <section className="surface manual-section"><h2>內容修訂與學習模擬</h2><ul className="plain-list"><li>性別刻板推薦作為需要反思的案例，不當成興趣判斷規則。</li><li>職業與年份預測是推想；辨識、自駕及健康裝置的能力採有條件敘述。</li><li>健康裝置是輔助資訊；身體不適時，尋求可信任成人與醫護協助。</li><li>外部網站、實際 App、影像資料與無人機活動，改為內建的學習模擬，不蒐集兒童私人資料。</li><li>深偽查證為倫理延伸。影像自然或奇怪都不能單獨證明真假；先找原始公告、可信來源，或用熟悉的方式聯絡當事人。</li><li>作業案例以幫助理解、查核、自己表達及遵守老師規則為目標，不把 AI 完成的內容假裝成自己的成果。</li><li>自由文字作為本機反思紀錄；初版以已審閱題目規則判題，不使用生成式 AI 判分。</li></ul></section>
    <section className="surface manual-section"><h2>題庫與正確答案</h2><p>完整列出每關五道主題與兩道重玩練習，包含四個選項、正確答案、解說及教材對照。JSON 是唯一題庫來源，CSV 可用 Excel 編輯核對。</p><div className="backup-buttons"><a className="button primary" href={appAssetUrl('/teacher/question-list.csv')} download><Download size={17} />下載題目與答案 CSV</a><a className="button secondary" href={appAssetUrl('/teacher/question-list.html')} target="_blank" rel="noreferrer"><Printer size={17} />閱讀／列印完整題庫</a><a className="button secondary" href={appAssetUrl('/teacher/question-bank.json')} download><Download size={17} />下載原始題庫 JSON</a></div></section><div className="section-heading"><h2>初階六關與進階六關對照</h2><button className="text-button" onClick={exportSources}><Download size={17} />匯出全部題目來源</button></div>
    <div className="surface curriculum-table-wrap"><table className="curriculum-table"><thead><tr><th>關卡</th><th>能力目標</th><th>教材依據（印刷頁碼）</th><th>內容標示</th></tr></thead><tbody>{levels.map(l => <tr key={l.id}><td><button onClick={() => onLevel(l)}>{String(l.id).padStart(2, '0')} · {l.title}<ChevronRight size={14} /></button></td><td>{l.objective}</td><td>單元 {l.source.units.join('、')}<br />p{l.source.pages}</td><td><span className="tag">{sourceLabels[l.source.label]}</span></td></tr>)}</tbody></table></div>
    <section className="surface manual-section"><div className="panel-title"><FileCheck size={21} /><h2>每題來源與能力目標</h2><select aria-label="篩選來源關卡" value={sourceFilter} onChange={e => setSourceFilter(Number(e.target.value))}><option value={0}>全部 84 題（含重玩練習）</option>{levels.map(l => <option key={l.id} value={l.id}>第 {l.id} 關 · {l.title}</option>)}</select></div>
      <div className="source-question-list">{questions.filter(q => !sourceFilter || q.levelId === sourceFilter).map(q => <details key={q.id}><summary><code>{q.id}</code><b>{q.objective}</b><ChevronRight size={15} /></summary><p>{q.prompt}</p><small>{sourceLabels[q.source.label]} · 單元 {q.source.units.join('、')} · p{q.source.pages}{q.variantOf ? ' · 對應變式 ' + q.variantOf : ''}</small></details>)}</div></section>
    <section className="source-footer"><h3>來源與使用範圍</h3><p>《生活中的人工智慧》，臺北市國小人工智慧教材，2020 年出版。頁碼為印刷頁碼，PDF 閱讀器頁碼加一。本遊戲使用原創角色、場景、情境文字與中文合成朗讀，不內嵌教材 PDF 或參考影片。</p>
      <p>隱私、公平與人類監督的倫理延伸參考 <a href="https://www.unesco.org/en/artificial-intelligence/recommendation-ethics" target="_blank" rel="noreferrer">UNESCO 人工智慧倫理建議書</a>。外部參考連結需網路；遊戲題目與回饋均可離線使用。</p></section>
  </>;
}
