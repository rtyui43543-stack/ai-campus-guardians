import { ArrowRight, Clock3, Play, ShieldCheck, Sparkles, UserRound, WifiOff } from 'lucide-react';
import type { OfflineController } from '../platform/offline';
import { appAssetUrl } from '../platform/urls';
import { OfflineDownloadCard } from './OfflineDownloadCard';
import { AssociationBrand } from './AssociationBrand';
import '../styles/game-cover.css';

export interface GameCoverProps {
  offline: OfflineController;
  onStart: () => void;
  onResume?: () => void;
  completed: number;
  reducedMotion: boolean;
}

export function GameCover({ offline, onStart, onResume, completed, reducedMotion }: GameCoverProps) {
  return <main id="main-content" className={'game-cover' + (reducedMotion ? ' game-cover-reduced-motion' : '')} aria-label="AI 校園守護隊遊戲封面">
    <section className="game-cover-hero" aria-labelledby="cover-title">
      <div className="game-cover-visual">
        <img className="game-cover-art" src={appAssetUrl('/art/title-cover-v1.webp')} alt="校園魔法師小羽穿著青綠法袍，與金色機器人伙伴一起迎接冒險。" fetchPriority="high" decoding="async" />
        <div className="game-cover-art-shade" aria-hidden="true" />
        <div className="game-cover-spark game-cover-spark-one" aria-hidden="true">✦</div>
        <div className="game-cover-spark game-cover-spark-two" aria-hidden="true">✦</div>
        <div className="game-cover-spark game-cover-spark-three" aria-hidden="true">✧</div>
      </div>
      <div className="game-cover-copy">
        <AssociationBrand placement="cover" />
        <span className="game-cover-badge"><Sparkles size={20} />生活裡的 AI 挑戰</span>
        <h1 id="cover-title" tabIndex={-1} className="game-cover-title" aria-label="AI 校園守護隊"><span>AI 校園</span><span>守護隊</span></h1>
        <p className="game-cover-tagline">破解生活難題，學會正確用 AI！</p>
        <p className="game-cover-description">從聊天到寫作業，和伙伴一起保護個資、查證消息，練習讓 AI 成為學習好幫手。</p>
        <div className="game-cover-actions">
          <button type="button" className="game-cover-start" onClick={onStart}><Play size={27} fill="currentColor" />開始冒險<ArrowRight size={27} /></button>
          {onResume && <button type="button" className="game-cover-resume" onClick={onResume}><Play size={20} />繼續上次挑戰</button>}
        </div>
        {completed > 0 && <p className="game-cover-saved"><ShieldCheck size={19} />這台裝置已完成 <strong>{Math.min(14, completed)} / 14</strong> 關</p>}
      </div>
      <div className="game-cover-promise" aria-label="遊戲使用方式">
        <span><WifiOff size={21} />下載後離線玩</span><i aria-hidden="true">·</i><span><UserRound size={21} />不用登入</span><i aria-hidden="true">·</i><span><Clock3 size={21} />初階不限時</span>
      </div>
    </section>
    <section className="game-cover-download" aria-label="下載完整離線遊戲">
      <OfflineDownloadCard offline={offline} />
    </section>
    <footer className="game-cover-footer">生活裡的好判斷，從這場冒險開始。</footer>
  </main>;
}
