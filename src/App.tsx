import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronRight, Compass, Download, Flag, HandHeart, Home, Lightbulb, Map, Medal, Menu, Music2, Pause, Play, RotateCcw, ScanLine, Search, Settings, ShieldCheck, Sparkles, Star, Volume2, VolumeX, Wifi, WifiOff, X } from 'lucide-react';
import type { Chapter, CompletedRun, Level, Mode, Progress } from './domain/types';
import { chapters, levels, getChapter, getLevel } from './content/levels';
import { questionById, presentQuestion } from './content';
import { advanceSession, applySession, battleHealth, chooseAction, demonstrate, finishSession, isDefeated, restartBattle, retryQuestion, sessionSummary, startSession, submitAction, useHint } from './domain/engine';
import { loadProgress, saveProgress } from './domain/storage';
import { describeAttempt, latestRun, scoreSession } from './domain/scoring';
import { battleSound, loadAudio, playAudio, stopAudio } from './platform/audio';
import { startBattleMusic, stopBattleMusic } from './platform/music';
import { useOffline } from './platform/offline';
import { appAssetUrl } from './platform/urls';
import { screenFromHash, type Screen } from './platform/navigation';
import { OfflineDownloadCard } from './components/OfflineDownloadCard';
import { Arena, GuardianPortrait, abilityNames } from './components/Arena';
import { GrowthPanel, OfflinePanel, ProposalPanel } from './components/Panels';
import { LevelScore, ScoreSummary } from './components/Scoring';
import { StoryCinematic } from './components/StoryCinematic';
import { getOpeningStory, getLevelStory } from './content/stories';
import { GameCover } from './components/GameCover';

const navItems = [
  { id: 'map', label: '冒險地圖', icon: Map }, { id: 'growth', label: '我的成長', icon: Medal },
  { id: 'proposals', label: '守護提案', icon: BookOpen },
  { id: 'settings', label: '離線與設定', icon: Settings }
] as const;
const OPENING_SEEN_KEY = 'ai-campus-guardians:opening:v1';
function hasSeenOpening() { try { return localStorage.getItem(OPENING_SEEN_KEY) === 'seen'; } catch { return false; } }
function rememberOpening() { try { localStorage.setItem(OPENING_SEEN_KEY, 'seen'); } catch { /* The game remains playable without browser storage. */ } }
export const modeNames: Record<Mode, string> = { starter: '初階', advanced: '進階' };
export const statusNames = { first: '首次獨立答對', supported: '重試／提示後答對', practice: '看示範後完成' };
export const chapterIcons = { scan: ScanLine, compass: Compass, search: Search, shield: ShieldCheck, hand: HandHeart, spark: Sparkles };

export function App() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loadError, setLoadError] = useState('');
  const [screen, setScreen] = useState<Screen>('cover');
  const [intro, setIntro] = useState<Level | null>(null);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<CompletedRun | null>(null);
  const [notice, setNotice] = useState('');
  const [cue, setCue] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const attackLock = useRef(false);
  const attackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => { if (attackTimer.current) clearTimeout(attackTimer.current); }, []);
  const offline = useOffline();
  const read = () => {
    setLoadError('');
    const requested = location.hash;
    void loadProgress().then(p => {
      setProgress(p);
      const previous = latestRun(p);
      setScreen(screenFromHash(requested, { battle: Boolean(p.active), results: Boolean(previous) }));
      if (requested === '#results' && previous) setResult(previous);
      void loadAudio();
    }).catch(error => setLoadError(error instanceof Error ? error.message : '存檔無法讀取'));
  };
  useEffect(read, []);
  useEffect(() => {
    if (!progress) return;
    stopAudio(); setHintOpen(false);
    location.hash = screen;
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (screen === 'battle') topRef.current?.focus({ preventScroll: true });
    if (screen === 'cover') document.getElementById('cover-title')?.focus({ preventScroll: true });
  }, [screen, progress !== null]);
  useEffect(() => {
    if (!progress) return;
    const followHistory = () => {
      const previous = latestRun(progress);
      const next = screenFromHash(location.hash, { battle: Boolean(progress.active), results: Boolean(previous) });
      if (next === screen) return;
      stopAudio(); stopBattleMusic();
      if (attackTimer.current) clearTimeout(attackTimer.current);
      attackTimer.current = null; attackLock.current = false;
      setAnimating(false); setCue(''); setIntro(null); setOpening(false); setMobileMenu(false);
      if (next === 'results') setResult(previous);
      setScreen(next);
    };
    window.addEventListener('hashchange', followHistory);
    return () => window.removeEventListener('hashchange', followHistory);
  }, [screen, progress]);
  useEffect(() => {
    const active = progress?.active;
    if (screen === 'battle' && active && !isDefeated(active)) {
      document.getElementById('question-title')?.focus();
    }
  }, [screen, progress?.active?.id, progress?.active?.index, progress?.active?.step]);
  useEffect(() => {
    const updateMusic = (event: Event) => setMusicPlaying((event as CustomEvent<{ playing: boolean }>).detail.playing);
    window.addEventListener('battle-music-status', updateMusic);
    return () => { window.removeEventListener('battle-music-status', updateMusic); stopBattleMusic(); stopAudio(); };
  }, []);
  useEffect(() => {
    if (screen === 'battle' && progress?.active && (!isDefeated(progress.active) || animating) && progress.settings.music) {
      // A restored page can require a user gesture. The music button remains available.
      void startBattleMusic().catch(() => setMusicPlaying(false));
    } else { stopBattleMusic(); setMusicPlaying(false); }
  }, [screen, progress?.settings.music, progress?.active?.step, Boolean(progress?.active), animating]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 6500);
    return () => clearTimeout(timeout);
  }, [notice]);
  const commit = (next: Progress) => {
    setProgress(next);
    void saveProgress(next).catch(error => setNotice('存檔尚未成功，請先匯出備份。' + (error instanceof Error ? error.message : '')));
  };
  const playMusicFromGesture = () => { void startBattleMusic().catch(() => { setMusicPlaying(false); setNotice('音樂尚未播放，請再按一次音樂按鈕；離線時請確認已下載完整內容。'); }); };
  const navigate = (next: Screen) => {
    stopAudio();
    setIntro(null); setOpening(false);
    if (next === 'battle') { setCue(''); if (progress?.settings.music && progress.active && !isDefeated(progress.active)) playMusicFromGesture(); }
    else {
      stopBattleMusic();
      if (attackTimer.current) clearTimeout(attackTimer.current);
      attackTimer.current = null; attackLock.current = false;
      setAnimating(false); setCue('');
    }
    setMobileMenu(false); setScreen(next);
  };
  const toggleMusic = () => {
    if (!progress) return;
    if (musicPlaying) { stopBattleMusic(); commit({ ...progress, settings: { ...progress.settings, music: false } }); }
    else { playMusicFromGesture(); commit({ ...progress, settings: { ...progress.settings, music: true } }); }
  };
  const narrate = (key: string) => { void playAudio(key).catch(error => setNotice(error.message)); };
  const openLevelStory = (level: Level) => { stopAudio(); stopBattleMusic(); setOpening(false); setIntro(level); };
  const openOpening = () => { stopAudio(); stopBattleMusic(); setIntro(null); setOpening(true); };
  const enterAdventure = () => { navigate('map'); if (!hasSeenOpening()) setOpening(true); };
  const closeStory = () => { stopAudio(); if (opening) rememberOpening(); setOpening(false); setIntro(null); };
  const changeSession = (next: NonNullable<Progress['active']>) => {
    if (!progress) return;
    const prior = progress.active;
    commit(applySession(progress, next));
    if ((next.step === 'feedback' || next.step === 'defeat') && ((next.success && !prior?.success) || (!next.success && prior?.step !== 'feedback'))) {
      const before = prior ? battleHealth(prior) : {playerHp:100,enemyHp:100};
      const after = battleHealth(next);
      const damage = next.success ? before.enemyHp - after.enemyHp : before.playerHp - after.playerHp;
      setCue((next.success ? 'success' : 'retry') + '-' + Date.now() + '-' + Math.round(damage));
      attackLock.current = true; setAnimating(true);
      if (attackTimer.current) clearTimeout(attackTimer.current);
      attackTimer.current = setTimeout(() => { attackLock.current = false; setAnimating(false); }, progress.settings.reducedMotion ? 450 : 1800);
      if (progress.settings.sound) battleSound(next.success, getLevel(next.levelId).chapterId, progress.settings.reducedMotion);
    }
  };
  const start = (level: Level, review = false) => {
    if (!progress) return;
    const session = startSession(level.id, level.mode, review);
    stopAudio();
    attackLock.current = false; setAnimating(false);
    if (attackTimer.current) clearTimeout(attackTimer.current);
    setCue('');
    if (progress.settings.music) playMusicFromGesture();
    commit(applySession({ ...progress, settings: { ...progress.settings, mode: level.mode } }, session)); setResult(null); setIntro(null);
    setHintOpen(false); setScreen('battle');
  };
  const restart = () => {
    if (!progress?.active || !isDefeated(progress.active)) return;
    stopAudio();
    if (attackTimer.current) clearTimeout(attackTimer.current);
    attackLock.current = false; setAnimating(false); setCue('');
    setHintOpen(false); setResult(null);
    commit(restartBattle(progress));
    if (progress.settings.music) playMusicFromGesture();
    setScreen('battle');
  };
  const nextQuestion = () => {
    if (!progress?.active || attackLock.current) return;
    const active = progress.active;
    const next = advanceSession(active);
    stopAudio(); setHintOpen(false);
    if (next.finished) {
      let finished = finishSession(progress, active);
      if (active.levelId === 12 && !active.review) {
        const records = [...active.records, next.record];
        const proposal = {
          at: new Date().toISOString(), mode: active.mode, reflection: '',
          decisions: records.map(record => {
            const q = presentQuestion(questionById.get(record.questionId)!, record.mode);
            return { questionId: record.questionId, action: q.choices[record.action].text,
              reason: record.reason === null ? '' : q.reasons[record.reason].text };
          }),
        };
        finished = { ...finished, proposals: [...finished.proposals, proposal] };
      }
      setResult(latestRun(finished));
      commit(finished); setScreen('results');
    } else if (next.session) {
      changeSession(next.session);
    }
  };
  if (!progress) return <main className="loading-shell">
    <img src={appAssetUrl('/icon-192.png')} alt="" width="80" height="80" />
    <h1>AI 校園守護隊</h1>
    {loadError ? <><p role="alert">存檔讀取失敗：{loadError}</p><p>已保留原存檔，請重新讀取。</p><button className="button primary" onClick={read}><RotateCcw size={18} />重新讀取</button></> : <p>正在整理冒險裝備…</p>}
  </main>;
  const selectedLevels = levels.filter(l => l.mode === progress.settings.mode);
  const nextLevel = selectedLevels.find(l => !progress.completed.includes(l.id)) ?? selectedLevels[0];
  const active = progress.active;
  const health = active ? battleHealth(active) : {playerHp:100,enemyHp:100};
  const battleLevel = active ? getLevel(active.levelId)! : null;
  const battleChapter = battleLevel ? getChapter(battleLevel.chapterId)! : null;
  const question = active ? questionById.get(active.questionIds[active.index])! : null;
  const presented = question && active ? presentQuestion(question, active.mode) : null;
  const audioKey = question && active ? question.id + '.' + active.mode : '';
  const mastery = new Set(progress.completed.map(id => getLevel(id)!.chapterId).filter(id => levels.filter(l => l.chapterId === id).every(l => progress.completed.includes(l.id))));
  const title = screen === 'map' ? '冒險地圖' : navItems.find(n => n.id === screen)?.label ?? '守護挑戰';
  if (screen === 'cover') return <>
    <GameCover offline={offline} completed={progress.completed.length} reducedMotion={progress.settings.reducedMotion}
      onStart={enterAdventure} onResume={active ? () => isDefeated(active) ? restart() : navigate('battle') : undefined} />
    {notice && <div className="toast" role="status"><span>{notice}</span><button aria-label="關閉通知" onClick={() => setNotice('')}><X size={18} /></button></div>}
  </>;
  return <div className={'app-shell ' + (screen === 'battle' ? 'battle-shell' : 'magic-campus')}>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); topRef.current?.focus(); topRef.current?.scrollIntoView({ block: 'start' }); }}>跳到主要內容</a>
    <aside className={'sidebar ' + (mobileMenu ? 'open' : '')}>
      <button className="brand" onClick={() => navigate('cover')} aria-label="回到首頁">
        <img src={appAssetUrl('/icon-192.png')} alt="" /><span>AI 校園守護隊<small>CAMPUS GUARDIANS</small></span>
      </button>
      <p className="sidebar-label">你的守護旅程</p>
      <nav aria-label="主要導覽">{navItems.map(n => <button key={n.id} className={'nav-item ' + (screen === n.id ? 'active' : '')} onClick={() => navigate(n.id)}>
        <n.icon size={20} /><span>{n.label}</span>{screen === n.id && <span className="nav-dot" />}
      </button>)}</nav>
      <div className="sidebar-progress"><div><span>冒險過關進度</span><b>{progress.completed.length}<small> / 12</small></b></div>
        <progress value={progress.completed.length} max={12} aria-label="已完成關卡" />
        <p>每一個好問題，<br />都讓校園更好一點。</p>
      </div>
      <div className="sidebar-bottom"><button className={'offline-chip ' + (offline.state.ready ? 'ready' : '')} onClick={() => navigate('settings')}>
        {offline.state.ready ? <ShieldCheck size={17} /> : offline.state.online ? <Download size={17} /> : <WifiOff size={17} />}
        {offline.state.ready ? '完整離線包已準備好' : '準備離線冒險'}<ChevronRight size={15} />
      </button><small>不用帳號 · 不限時間 · 原創校園英雄</small></div>
    </aside>
    {mobileMenu && <button className="sidebar-scrim" aria-label="關閉選單" onClick={() => setMobileMenu(false)} />}
    <div className="content-shell">
      <header className="topbar">
        <div className="topbar-title"><button className="icon-button mobile-toggle" aria-label="開啟導覽選單" onClick={() => setMobileMenu(true)}><Menu /></button>
          <span className="breadcrumb">守護基地</span><ChevronRight size={14} /><strong>{title}</strong>
        </div>
        <div className="topbar-tools"><div className="mode-toggle" aria-label="選擇難度">{(['starter', 'advanced'] as Mode[]).map(mode =>
          <button key={mode} className={progress.settings.mode === mode ? 'selected' : ''} aria-pressed={progress.settings.mode === mode}
            disabled={screen === 'battle'} onClick={() => commit({ ...progress, settings: { ...progress.settings, mode }, updatedAt: new Date().toISOString() })}>{modeNames[mode]}<span>{mode === 'starter' ? '3–4 年級' : '5–6 年級'}</span></button>)}</div>
          <button className="icon-button" title="回到首頁" aria-label="回到首頁" onClick={() => navigate('cover')}><Home size={21} /></button>
          <button className="icon-button" title="停止朗讀" aria-label="停止朗讀" onClick={stopAudio}><Volume2 size={21} /></button>
          <span className={'connection-dot ' + (offline.state.online ? '' : 'offline')} title={offline.state.online ? '目前連線中' : '目前沒有網路'}>{offline.state.online ? <Wifi size={16} /> : <WifiOff size={16} />}</span>
        </div>
      </header>
      <main id="main-content" className={'main-content ' + (screen === 'battle' ? 'battle-main' : '')} ref={topRef} tabIndex={-1}>
        {screen === 'map' && <MapScreen progress={progress} nextLevel={nextLevel} mastery={mastery}
          onLevel={openLevelStory} onResume={() => active && isDefeated(active) ? restart() : navigate('battle')} onStory={openOpening} offline={offline} />}
        {screen === 'battle' && active && battleLevel && battleChapter && question && presented && <section className={'duel-stage ' + (progress.settings.reducedMotion ? 'duel-static' : '')} aria-label="3D 答題對戰" data-testid="duel-stage">
          <Arena chapter={battleLevel.chapterId} guardian={battleChapter.guardian} enemyHp={health.enemyHp} playerHp={health.playerHp} cue={cue} reducedMotion={progress.settings.reducedMotion} />
          <div className="duel-hud">
            <button className="duel-back" onClick={() => navigate('cover')} aria-label="回到首頁" title="回到首頁，保留本次挑戰"><Home size={20} /><span>首頁</span></button>
            <DuelMeter label="你 · 小羽" hp={health.playerHp} side="hero" cue={cue} reducedMotion={progress.settings.reducedMotion} />
            <div className="duel-round"><span>{modeNames[active.mode]} · 第 {active.mode === 'starter' ? battleLevel.id : battleLevel.id - 6} 關</span><b>第 {active.index + 1} 題 / {active.questionIds.length}</b></div>
            <DuelMeter label={battleChapter.guardian} hp={health.enemyHp} side="enemy" cue={cue} reducedMotion={progress.settings.reducedMotion} />
          </div>
          <section className={'duel-bubble ' + (active.step === 'feedback' || isDefeated(active) ? 'has-feedback ' : '') + (animating ? 'is-casting' : '')} aria-labelledby="question-title">
            <div className="duel-question-meta"><span>{battleLevel.title}</span><div><button className="duel-tool duel-music" aria-label={musicPlaying ? '關閉戰鬥音樂' : '播放戰鬥音樂'} aria-pressed={musicPlaying} onClick={toggleMusic}>{musicPlaying ? <Music2 size={18} /> : <VolumeX size={18} />}<span>{musicPlaying ? '音樂開' : '音樂關'}</span></button><button className="duel-tool" aria-label="朗讀題目與選項" onClick={() => narrate(audioKey + '.prompt')}><Volume2 size={21} /></button></div></div>
            <h1 id="question-title" tabIndex={-1}>{presented.prompt}</h1>
            {active.step === 'action' && !hintOpen && presented.evidence.length > 0 && <div className="duel-evidence">{presented.evidence.map((e,i) => <p key={i}><b>{e.title}：</b>{e.body}</p>)}</div>}
            {hintOpen && active.step === 'action' && <div className="duel-hint"><Lightbulb size={17} /><p>{question.hint}</p><button className="duel-tool" aria-label="聽提示" onClick={() => narrate(audioKey + '.hint')}><Volume2 size={18} /></button></div>}
            {(active.step === 'feedback' || isDefeated(active)) && <div className={'duel-feedback ' + (active.success ? 'success' : 'retry')} role="status"><strong>{isDefeated(active) ? '血量歸零了' : active.demoUsed ? '伙伴示範，跟著學！' : active.success ? '答對了！' : '再想想，還能再試！'}</strong><p>{active.feedback}</p><button className="duel-tool" aria-label="聽解說" onClick={() => narrate(audioKey + (active.success ? '.explanation' : '.choice.' + active.selected))}><Volume2 size={18} /></button></div>}
          </section>
          <div className="duel-character-label hero-label"><span>校園魔法師</span><b>小羽</b></div><div className="duel-character-label enemy-label"><span>{battleChapter.shortTitle}</span><b>{battleChapter.guardian}</b></div>
          {animating && active.success && <div className="duel-attack-name" key={cue}><Sparkles size={18} />{abilityNames[battleLevel.chapterId - 1]}</div>}
          {animating && <div className={'duel-damage ' + (active.success ? 'to-enemy' : 'to-hero')} key={'damage-' + cue}><span>{active.success ? '命中！' : isDefeated(active) ? '血量歸零' : '再試一次'}</span><b>−{Number(cue.split('-').at(-1))}<small> HP</small></b></div>}
          <div className="duel-answer-area">
            <div className="duel-choices" aria-label="直接選擇答案">{presented.choices.map((choice,i) => <button key={i} className={'duel-choice ' + (active.selected === i ? active.success ? 'correct' : 'incorrect' : '')} disabled={active.step !== 'action' || animating} aria-pressed={active.selected === i} onClick={() => {
              if (attackLock.current || active.step !== 'action') return;
              attackLock.current = true; stopAudio(); setHintOpen(false);
              changeSession(submitAction(chooseAction(active,i)));
            }}><span className="duel-letter">{String.fromCharCode(65 + i)}</span><span>{choice.text}</span>{active.selected === i && active.success && <Check size={19} />}</button>)}</div>
            <div className="duel-controls"><button className="duel-hint-button" disabled={animating || active.step !== 'action'} onClick={() => { setHintOpen(!hintOpen); if (!hintOpen) changeSession(useHint(active)); }}><Lightbulb size={17} />{hintOpen ? '收起提示' : '給我提示'}</button>
              <span className="duel-score" aria-label="目前闖關得分">得分 {scoreSession(active).score}／100</span>
              {isDefeated(active) ? <span className="duel-select-note">{animating ? '血量歸零…' : '重新挑戰，再試一次'}</span> : active.step === 'feedback' ? active.success ? <button className="duel-next" disabled={animating} onClick={nextQuestion}>{animating ? '出招中…' : active.index === active.questionIds.length - 1 ? '完成挑戰' : '下一題'}<ArrowRight size={18} /></button> : <div className="duel-retry-actions"><button className="duel-next" disabled={animating} onClick={() => { attackLock.current = false; changeSession(retryQuestion(active)); }}>再試一次<RotateCcw size={17} /></button>{active.retries >= 2 && <button className="duel-hint-button" disabled={animating} onClick={() => changeSession(demonstrate(active))}>伙伴示範</button>}</div> : <span className="duel-select-note">點答案，立即出招</span>}
            </div>
          </div>
          {isDefeated(active) && !animating && <DefeatDialog level={battleLevel} hint={question.hint} onRestart={restart} onHome={() => navigate('cover')} />}
        </section>}
        {screen === 'battle' && !active && <div className="empty-state"><ShieldCheck size={40} /><h1>你的冒險，從這裡開始</h1><button className="button primary" onClick={() => navigate('map')}>前往冒險地圖<ArrowRight size={18} /></button></div>}
        {screen === 'results' && result && <Results session={result} onLevel={openLevelStory} onMap={() => navigate('map')} onReview={() => start(getLevel(result.levelId)!, true)} onProposal={() => navigate('proposals')} />}
        {screen === 'results' && !result && <GrowthPanel progress={progress} onLevel={openLevelStory} onRun={run => { setResult(run); navigate('results'); }} />}
        {screen === 'growth' && <GrowthPanel progress={progress} onLevel={openLevelStory} onRun={run => { setResult(run); navigate('results'); }} />}
        {screen === 'proposals' && <ProposalPanel progress={progress} onUpdate={commit} onLevel={openLevelStory} onNotice={setNotice} />}
        {screen === 'settings' && <OfflinePanel progress={progress} offline={offline} onUpdate={commit} onNotice={setNotice} onMap={() => navigate('map')} />}
      </main>
      <footer className="app-footer"><span>AI 校園守護隊</span><span>讓科技成為照顧每個人的力量。</span></footer>
    </div>
    {notice && <div className="toast" role="status"><span>{notice}</span><button aria-label="關閉通知" onClick={() => setNotice('')}><X size={18} /></button></div>}
    {(opening || intro) && <StoryCinematic key={intro?.id ?? 'opening'} level={intro ?? undefined} beats={intro ? getLevelStory(intro.id) : getOpeningStory()} reducedMotion={progress.settings.reducedMotion}
      onClose={closeStory} onStart={() => { if (intro) start(intro); else { closeStory(); navigate('map'); } }} onNarrate={narrate} onStopNarration={stopAudio}
      savedLevelTitle={intro && active ? getLevel(active.levelId).title : undefined} onResume={intro && active ? () => { closeStory(); if (isDefeated(active)) restart(); else navigate('battle'); } : undefined} />}
  </div>;
}

function DefeatDialog({ level, hint, onRestart, onHome }: { level: Level; hint: string; onRestart: () => void; onHome: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog className="defeat-dialog" ref={ref} aria-labelledby="defeat-title" aria-describedby="defeat-description" onCancel={event => event.preventDefault()}>
    <span className="defeat-icon" aria-hidden="true"><RotateCcw size={32} /></span>
    <p className="defeat-level">{modeNames[level.mode]} · 第 {level.mode === 'starter' ? level.id : level.id - 6} 關 · 0 HP</p>
    <h2 id="defeat-title">這次挑戰結束了</h2>
    <p id="defeat-description">血量歸零了，整理一下想法，再出發！重新挑戰會從本關第一題開始，恢復 100 HP。已完成的關卡會保留。</p>
    <div className="defeat-tip"><Lightbulb size={20} /><div><strong>這題的小提醒</strong><p>{hint}</p></div></div>
    <div className="defeat-actions"><button className="button primary" onClick={onRestart} autoFocus><RotateCcw size={18} />重新挑戰本關</button><button className="button secondary" onClick={onHome}><Home size={18} />回到首頁</button></div>
  </dialog>;
}

function DuelMeter({ label, hp, side, cue, reducedMotion }: { label: string; hp: number; side: 'hero' | 'enemy'; cue: string; reducedMotion: boolean }) {
  const [displayHp, setDisplayHp] = useState(hp);
  useEffect(() => {
    if (hp < displayHp && cue && !reducedMotion) {
      const timer = setTimeout(() => setDisplayHp(hp), 900);
      return () => clearTimeout(timer);
    }
    setDisplayHp(hp);
  }, [hp, cue, reducedMotion]);
  return <div className={'duel-meter ' + side}><div><span>{label}</span><b>{Math.round(displayHp)}<small> HP</small></b></div><progress value={displayHp} max={100} aria-label={side === 'hero' ? '我方血量' : '敵方血量'} /></div>;
}

function MapScreen({ progress, nextLevel, mastery, onLevel, onResume, onStory, offline }: {
  progress: Progress; nextLevel: Level; mastery: Set<number>; onLevel: (level: Level) => void; onResume: () => void; onStory: () => void; offline: ReturnType<typeof useOffline>;
}) {
  const mainRuns = (progress.runs ?? []).filter(run => !run.review);
  const highestScore = mainRuns.length ? Math.max(...mainRuns.map(run => scoreSession(run).score)) : null;
  return <>
    <section className="welcome-banner">
      <div className="welcome-art" /><div className="welcome-shade" />
      <div className="welcome-copy"><span className="eyebrow"><span className="tiny-star">✦</span> 生活裡的 AI 挑戰</span>
        <h1>破解生活難題，<br /><em>學會正確用 AI！</em></h1><p>從聊天到寫作業，和伙伴一起保護個資、查證消息，練習讓 AI 成為學習好幫手。</p>
        <button className="button primary" onClick={() => progress.active ? onResume() : onLevel(nextLevel)}><Play size={17} fill="currentColor" />{progress.active ? (isDefeated(progress.active) ? '重新挑戰第 ' : '繼續第 ') + (progress.active.mode === 'starter' ? progress.active.levelId : progress.active.levelId - 6) + ' 關' : progress.completed.length ? '繼續我的冒險' : '開始我的冒險'}<ArrowRight size={18} /></button>
        <button className="welcome-story-button" onClick={onStory}><Play size={17} />觀看開場故事</button>
        <span className="welcome-note"><ShieldCheck size={15} />你的進度會存在這台裝置</span>
      </div>
      <div className="floating-label"><Sparkles size={18} /><span>思考，就是你的魔法力量。</span></div>
    </section>
    <section className="adventure-metrics" aria-label="我的冒險總覽">
      <div><span className="metric-icon"><Flag size={25} /></span><span><small>已完成任務</small><strong>{progress.completed.length}<b>／12 關</b></strong></span></div>
      <div><span className="metric-icon"><Sparkles size={25} /></span><span><small>六種守護魔法</small><strong>{mastery.size}<b>／6 已掌握</b></strong></span></div>
      <div><span className="metric-icon"><Medal size={25} /></span><span><small>最高闖關紀錄</small><strong>{highestScore === null ? '待挑戰' : highestScore}<b>{highestScore === null ? '' : '／100 分'}</b></strong></span></div>
    </section>
    <div className="journey-strip"><div><span className="journey-icon"><Compass size={21} /></span><span><b>初階六關，進階六關</b><small>從生活小事，練習怎麼安心使用 AI</small></span></div>
      <span className="journey-offline-note"><WifiOff size={16} />下載後，斷網也能玩</span></div>
    <OfflineDownloadCard offline={offline} />
    <div className="section-heading map-trail-heading"><div><span className="eyebrow">✦ {modeNames[progress.settings.mode]}魔法路線</span><h2>選一個任務，準備出招！</h2></div><span className="section-note">六個生活主題，自由選關挑戰</span></div>
    <div className="chapter-grid">{chapters.map(chapter => <ChapterCard key={chapter.id} chapter={chapter} progress={progress} mastered={mastery.has(chapter.id)} onLevel={onLevel} nextLevel={nextLevel.id} />)}</div>
    <section className="learning-promise"><span className="promise-icon"><HandHeart size={29} /></span><div><h3>答對就攻擊，答錯再試一次。</h3><p>每關五題，點選答案就能出招。初階從生活小事出發，進階多一個要照顧的狀況。沒有倒數，也能請伙伴提示。</p></div><span className="tag">3–6 年級 · 單人對戰</span></section>
  </>;
}

function ChapterCard({ chapter, progress, mastered, onLevel, nextLevel }: {
  chapter: Chapter; progress: Progress; mastered: boolean; onLevel: (level: Level) => void; nextLevel: number;
}) {
  const Icon = chapterIcons[chapter.icon];
  const missions = levels.filter(l => l.chapterId === chapter.id && l.mode === progress.settings.mode);
  return <article className="chapter-card" style={{ '--chapter-color': chapter.color } as React.CSSProperties}>
    <div className="chapter-card-header"><div className="chapter-icon"><Icon size={23} /></div><span className="chapter-number">{modeNames[progress.settings.mode]} 0{chapter.id}</span>
      <span className={'chapter-status ' + (missions.every(l => progress.completed.includes(l.id)) ? 'complete' : '')}>{missions.every(l => progress.completed.includes(l.id)) ? <><Check size={13} />已完成</> : '尚未挑戰'}</span></div>
    <div className="chapter-card-body"><div><h3>{chapter.title}</h3><p>{chapter.subtitle}</p><span className="skill-label"><Sparkles size={13} />解鎖能力：{chapter.skill}</span></div><GuardianPortrait chapter={chapter.id} /></div>
    <div className="level-list">{missions.map(level => <div className="level-entry" key={level.id}><button className={'level-row ' + (progress.completed.includes(level.id) ? 'completed' : '') + (nextLevel === level.id ? ' recommended' : '')} aria-label={(progress.completed.includes(level.id) ? '再次挑戰：' : '開始闖關：') + level.title} onClick={() => onLevel(level)}>
      <span className="level-play" aria-hidden="true"><Play size={23} fill="currentColor" /></span>
      <span className="level-action"><strong>{progress.completed.includes(level.id) ? '再次挑戰' : '開始闖關'}</strong><span className="level-title">{level.title}</span></span>
      {nextLevel === level.id ? <span className="next-tag">下一站</span> : null}<ArrowRight className="level-arrow" size={23} aria-hidden="true" />
    </button><LevelScore progress={progress} levelId={level.id} /></div>)}</div>
  </article>;
}

function Results({ session, onLevel, onMap, onReview, onProposal }: {
  session: CompletedRun; onLevel: (level: Level) => void; onMap: () => void; onReview: () => void; onProposal: () => void;
}) {
  const level = getLevel(session.levelId)!;
  const chapter = getChapter(level.chapterId)!;
  const summary = sessionSummary(session.records);
  const score = scoreSession(session);
  return <div className="results-page"><section className="results-hero"><span className="results-medal"><ShieldCheck size={42} /></span>
    <span className="eyebrow">BATTLE COMPLETE</span><h1>{session.review ? '練習成功！又學會一個好方法。' : '挑戰成功！敵人被擊敗了！'}</h1><p>{modeNames[level.mode]} · 第 {level.mode === 'starter' ? level.id : level.id - 6} 關 · {level.title}</p>
    <div className="result-skill"><Sparkles size={18} />{chapter.skill}<span>學會的事，比勝率更重要</span></div></section>
    <ScoreSummary run={session} />
    <div className="summary-grid">{(['first', 'supported', 'practice'] as const).map(status => <div className={'summary-card ' + status} key={status}><span>{statusNames[status]}</span><strong>{summary[status]}<small> 題</small></strong><p>{status === 'first' ? '獨立完成的思考' : status === 'supported' ? '再次思考或使用提示後答對' : '看過示範，安排再練習'}</p></div>)}</div>
    <section className="surface result-reflection"><h2>逐題得分與回答紀錄</h2><p>{level.objective}</p><div className="record-list">{session.records.map((r, i) => {
      const q = questionById.get(r.questionId)!;
      const text = presentQuestion(q, r.mode);
      return <details key={q.id}><summary><div className="result-question"><strong>第 {i + 1} 題</strong><b>{text.prompt}</b><small>{describeAttempt(r)}</small></div><span className="result-question-score">{score.rows[i].points}／{score.rows[i].maxPoints} 分</span><ChevronRight size={18} /></summary><p><b>你的答案：</b>{text.choices[r.action].text}<br />{text.explanation}</p></details>;
    })}</div></section>
    <div className="results-actions"><button className="button secondary" onClick={onMap}><Home size={18} />回冒險地圖</button><button className="button secondary" onClick={onReview}><RotateCcw size={18} />試試兩題新情境</button>
      {level.id === 12 && !session.review ? <button className="button primary" onClick={onProposal}>我的 AI 使用約定<ArrowRight size={18} /></button>
        : level.id < 12 && <button className="button primary" onClick={() => onLevel(getLevel(level.id + 1)!)}>前往第 {level.id + 1} 關<ArrowRight size={18} /></button>}</div>
  </div>;
}

export function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); }; }, []);
  return <dialog className="dialog" ref={ref} aria-label={title} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="dialog-topline"><strong>{title}</strong><button className="icon-button" onClick={onClose} aria-label="關閉"><X size={22} /></button></div>
    <div className="dialog-content">{children}</div>
  </dialog>;
}
