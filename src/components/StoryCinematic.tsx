import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Compass, Flag, GraduationCap, HandHeart, Home, KeyRound, Leaf, LockKeyhole, Pause, Play, RotateCcw, Search, ShieldCheck, SkipForward, Sparkles, UserRound, Video, Volume2, X } from 'lucide-react';
import type { Level } from '../domain/types';
import type { StoryBeat } from '../content/stories';
import { getChapter } from '../content/levels';
import { Arena } from './Arena';
import '../styles/story-cinematic.css';

export interface StoryCinematicProps {
  level?: Level;
  reducedMotion: boolean;
  beats: readonly StoryBeat[];
  onClose: () => void;
  onStart: () => void;
  onNarrate: (key: string) => void;
  onStopNarration: () => void;
  onResume?: () => void;
  savedLevelTitle?: string;
}

function StoryProps({ scene }: { scene: StoryBeat['scene'] }) {
  return <div className={'story-props story-props-' + scene} aria-hidden="true">
    {scene === 'campus' && <><span className="story-signal"><Compass /><span>新的任務訊號</span></span><span className="story-signal-orbit"><Sparkles /></span></>}
    {scene === 'privacy' && <><div className="story-data-cards"><span><UserRound />姓名</span><span><Home />住址</span><span><KeyRound />密碼</span></div><div className="story-lock"><LockKeyhole /><span>個資守護</span></div></>}
    {scene === 'library' && <><div className="story-clue"><BookOpen /><span className="story-paper-line" /><span className="story-paper-line" /><span className="story-paper-line" /></div><span className="story-search"><Search /></span><span className="story-prop-label">找找消息的線索</span></>}
    {scene === 'sorting' && <><div className="story-sorting-cards"><span><Leaf />圖片</span><span><Volume2 />聲音</span><span><BookOpen />文字</span></div><span className="story-prop-label">觀察 → 比較 → 分類</span></>}
    {scene === 'media' && <><div className="story-video"><Video /><div className="story-scan" /><span className="story-wave">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ animationDelay: index * .08 + 's', height: 8 + (index * 7 % 25) + 'px' }} />)}</span></div><span className="story-prop-label">眼睛和耳朵，也要查證伙伴</span></>}
    {scene === 'study' && <><div className="story-notebook"><BookOpen /><span className="story-paper-line" /><span className="story-paper-line" /><span className="story-paper-line" /></div><span className="story-thinking"><Sparkles /></span><span className="story-prop-label">AI 幫忙，我來思考</span></>}
    {scene === 'team' && <><div className="story-team"><UserRound /><HandHeart /><UserRound /></div><div className="story-team-stars"><Sparkles /><Sparkles /><Sparkles /></div><span className="story-prop-label">一起做出好選擇</span></>}
  </div>;
}

export function StoryCinematic({ level, reducedMotion, beats, onClose, onStart, onNarrate, onStopNarration, onResume, savedLevelTitle }: StoryCinematicProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [playing, setPlaying] = useState(!reducedMotion);
  const [ready, setReady] = useState(beats.length === 0);
  const stopNarration = useRef(onStopNarration);
  stopNarration.current = onStopNarration;
  const beat = beats[Math.min(index, beats.length - 1)];
  const chapter = getChapter(level?.chapterId ?? 1);
  const durationMs = beat?.durationMs ?? 6000;
  const progress = Math.min(1, elapsedMs / durationMs);
  const shot = ready ? 'resolve' : level ? (index === 0 ? 'wide' : index === 1 ? 'enemy' : 'hero') : (index === 0 ? 'wide' : index === 1 ? 'enemy' : index === 2 ? 'hero' : 'resolve');
  const heading = level ? `${level.mode === 'starter' ? '初階' : '進階'} 第 ${level.mode === 'starter' ? level.id : level.id - 6} 關 · ${level.title}` : '生活裡的 AI 挑戰';

  useEffect(() => {
    const current = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    current?.showModal();
    current?.querySelector<HTMLButtonElement>('[data-story-main-control]')?.focus();
    return () => { stopNarration.current(); current?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  useEffect(() => {
    if (ready) dialog.current?.querySelector<HTMLElement>('#story-ready-title')?.focus();
  }, [ready]);
  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) { setPlaying(false); stopNarration.current(); } };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, []);
  useEffect(() => { if (reducedMotion) setPlaying(false); }, [reducedMotion]);
  useEffect(() => {
    if (!playing || ready || !beat) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = now - previous;
      previous = now;
      setElapsedMs(value => Math.min(durationMs, value + delta));
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, ready, index, durationMs, beat]);
  useEffect(() => {
    if (!playing || ready || elapsedMs < durationMs) return;
    stopNarration.current();
    if (index >= beats.length - 1) { setReady(true); setPlaying(false); }
    else { setIndex(value => value + 1); setElapsedMs(0); }
  }, [elapsedMs, durationMs, playing, ready, index, beats.length]);

  const move = (nextIndex: number) => {
    stopNarration.current(); setElapsedMs(0);
    if (nextIndex >= beats.length) { setPlaying(false); setReady(true); }
    else { setReady(false); setIndex(Math.max(0, nextIndex)); }
  };
  const skip = () => { stopNarration.current(); setPlaying(false); setReady(true); };
  const replay = () => { stopNarration.current(); setIndex(0); setElapsedMs(0); setReady(beats.length === 0); setPlaying(!reducedMotion); };
  const leave = (action: () => void) => { stopNarration.current(); action(); };
  const narrate = () => { if (!beat) return; setPlaying(false); onNarrate('story.' + beat.id); };
  const togglePlaying = () => { stopNarration.current(); setPlaying(value => !value); };

  return <dialog ref={dialog} className={'story-cinematic' + (reducedMotion ? ' story-reduced-motion' : '') + (ready ? ' story-ready' : '') + (!playing ? ' story-paused' : '')}
    aria-labelledby="story-cinematic-title" onCancel={event => { event.preventDefault(); skip(); }}>
    <div className="story-frame">
      <header className="story-header"><div className="story-heading"><span className="story-kicker"><Sparkles size={18} />{level ? '關卡故事' : '冒險序章'}</span><h2 id="story-cinematic-title">{heading}</h2></div>
        <button type="button" className="story-close" onClick={() => leave(onClose)} aria-label="關閉故事"><X size={24} /></button>
      </header>
      <div className={'story-stage story-stage-' + (beat?.scene ?? 'campus')} data-story-shot={shot}>
        <Arena chapter={chapter.id} guardian={chapter.guardian} playerHp={100} enemyHp={100} reducedMotion={reducedMotion} cue="" cinemaShot={shot} cinemaPaused={!playing || ready} />
        <div className="story-stage-vignette" />
        {!ready && beat && <div className="story-stage-moment" key={beat.id}><StoryProps scene={beat.scene} /></div>}
        {!ready && <div className="story-scene-number">第 {index + 1} 幕 / {beats.length} 幕</div>}
        {ready && <section className="story-ready-card" aria-labelledby="story-ready-title">
          <span className="story-ready-symbol"><ShieldCheck size={34} /></span>
          <h3 id="story-ready-title" tabIndex={-1}>{level ? '任務準備完成！' : '準備好開始冒險了嗎？'}</h3>
          <p className="story-ready-objective">{level ? level.objective : '從聊天到寫作業，用你的觀察與判斷，練習正確使用 AI。'}</p>
          {level && <div className="story-ready-rules"><span><BookOpen size={20} />5 道生活題</span><span><Sparkles size={20} />答對施展魔法</span><span><Flag size={20} />答錯扣血，可重試</span></div>}
          {level && savedLevelTitle && <p className="story-save-note">目前還有「{savedLevelTitle}」的中途存檔。開始新挑戰會取代這份中途存檔，已完成的關卡與得分仍會保留。</p>}
          <div className="story-ready-actions">
            {onResume && <button type="button" className="story-button story-button-secondary" onClick={() => leave(onResume)}><Play size={20} />繼續原本的挑戰</button>}
            <button type="button" className="story-button story-button-primary" onClick={() => leave(onStart)}>{level ? '開始對戰' : '進入冒險地圖'}<ArrowRight size={22} /></button>
          </div>
          <span className="story-ready-note"><Check size={18} />不限時作答 · 進度自動儲存</span>
        </section>}
      </div>
      {!ready && beat && <section className="story-caption" aria-live="polite" aria-atomic="true">
        <div className="story-caption-top"><span className={'story-speaker story-speaker-' + beat.speaker}>{beat.speaker === '旁白' ? <GraduationCap size={20} /> : <UserRound size={20} />}{beat.speaker}</span><button type="button" className="story-read" onClick={narrate}><Volume2 size={20} />朗讀這一幕</button></div>
        <p>{beat.text}</p>
      </section>}
      <footer className="story-footer">
        {!ready && <><div className="story-progress" role="progressbar" aria-label="本幕播放進度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><span style={{ transform: `scaleX(${progress})` }} /></div>
          <div className="story-controls"><button type="button" data-story-main-control className="story-button story-button-secondary story-play" onClick={togglePlaying} aria-pressed={playing}>{playing ? <Pause size={21} /> : <Play size={21} />}{playing ? '暫停' : '播放'}</button>
            <button type="button" className="story-button story-button-quiet" onClick={() => move(index - 1)} disabled={index === 0}><ChevronLeft size={22} /><span>上一幕</span></button>
            <button type="button" className="story-button story-button-quiet" onClick={() => move(index + 1)}><span>下一幕</span><ChevronRight size={22} /></button>
            <button type="button" className="story-button story-button-quiet story-skip" onClick={skip}><SkipForward size={21} />略過故事</button>
          </div>
          <p className="story-playback-note">{reducedMotion ? '減少動態模式：按「下一幕」閱讀故事。' : playing ? '字幕會自動換幕，可以隨時暫停慢慢看。' : '故事已暫停，可以慢慢讀；按「播放」繼續。'}</p></>}
        {ready && <button type="button" className="story-button story-button-secondary" onClick={replay}><RotateCcw size={21} />重看故事</button>}
      </footer>
    </div>
  </dialog>;
}
