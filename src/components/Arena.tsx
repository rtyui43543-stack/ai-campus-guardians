import { useEffect, useId, useRef, useState } from 'react';
import { createArenaScene } from './arena3d';
import '../styles/arena3d.css';

interface ArenaProps {
  chapter: number;
  enemyHp: number;
  playerHp: number;
  reducedMotion: boolean;
  cue: string;
  guardian: string;
}

export const abilityNames = ['個資守護光球', '查證掃描光束', '分類卡片旋風', '真相稜鏡光波', '思考魔法書', '合作星光陣'];
export const ATTACK_IMPACT_MS = 900;

export function GuardianPortrait({ chapter, className = '' }: { chapter: number; className?: string }) {
  const safeTheme = Math.max(0, Math.min(5, chapter - 1));
  const gradientId = 'guardian-' + useId().replace(/:/g, '');
  const color = ['#f6a642', '#36b8c5', '#6d91e5', '#9c70d8', '#e67970', '#637dda'][safeTheme];
  return <span aria-hidden="true" className={'guardian-portrait ' + className} style={{ backgroundImage: 'none' }}>
    <svg className="guardian-avatar" viewBox="0 0 128 128" aria-hidden="true">
      <defs><linearGradient id={gradientId} x1=".2" y1="0" x2=".9" y2="1">
        <stop stopColor="#fff6dd" /><stop offset=".34" stopColor={color} /><stop offset="1" stopColor="#344b65" />
      </linearGradient></defs>
      <ellipse cx="64" cy="116" rx="36" ry="6" fill="#234959" opacity=".13" />
      {safeTheme === 3 && <ellipse cx="64" cy="62" rx="54" ry="42" stroke="#b89ee7" strokeWidth="4" fill="none" />}
      {[...(safeTheme === 5 ? [-18, 0, 18] : [0])].map(x => <g key={x}>
        <path d={'M' + (64 + x) + ' 30 V17'} stroke="#344b65" strokeWidth="5" />
        <circle cx={64 + x} cy="15" r="7" fill="#ffd57c" />
      </g>)}
      <rect x="14" y="53" width="18" height="24" rx="9" fill="#344b65" />
      <rect x="96" y="53" width="18" height="24" rx="9" fill="#344b65" />
      <rect x="25" y="28" width="78" height="75" rx="28" fill={'url(#' + gradientId + ')'} />
      <path d="M35 43 Q47 32 69 36" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" opacity=".26" />
      <rect x="34" y="51" width="60" height="37" rx="14" fill="#233d52" />
      <ellipse cx="51" cy="65" rx="5" ry="8" fill="#ffe4a0" />
      <ellipse cx="77" cy="65" rx="5" ry="8" fill="#ffe4a0" />
      <path d="M58 78 Q64 84 70 78" fill="none" stroke="#ffe4a0" strokeWidth="3" strokeLinecap="round" />
      {safeTheme === 1 && <path d="M28 35 L99 29 L106 41 L24 46 Z" fill="#ffd57c" />}
      {safeTheme === 4 && <path d="M79 36 L89 8 L95 10 L86 40 Z" fill="#ffd57c" />}
      {safeTheme === 3 && <path d="M28 72 Q41 66 46 79 L38 93 Q26 89 28 72" fill="#f8f3df" />}
      <path d="M44 98 Q64 108 84 98 L91 115 H37 Z" fill={color} />
      <circle cx="64" cy="108" r="5" fill="#ffd57c" />
    </svg>
  </span>;
}

export function Arena({ chapter, enemyHp, playerHp, reducedMotion, cue, guardian }: ArenaProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof createArenaScene> | null>(null);
  const lastCue = useRef('');
  const [fallback, setFallback] = useState(false);
  const [phase, setPhase] = useState('待命');
  useEffect(() => {
    let alive = true;
    if (!host.current) return;
    setFallback(false);
    try {
      const arena = createArenaScene(host.current, chapter, reducedMotion, nextPhase => {
        if (alive) setPhase(nextPhase);
      });
      scene.current = arena;
      arena.health(enemyHp, playerHp);
      return () => {
        alive = false;
        arena.dispose();
        scene.current = null;
      };
    } catch (error) {
      console.warn('3D 對戰場景初始化失敗', error);
      setFallback(true);
    }
    return () => { alive = false; };
    // Health and cues update the existing scene without recreating its meshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter, reducedMotion]);
  useEffect(() => {
    scene.current?.health(enemyHp, playerHp);
  }, [enemyHp, playerHp]);
  useEffect(() => {
    if (!cue || cue === lastCue.current) return;
    lastCue.current = cue;
    scene.current?.play(cue.startsWith('success'));
  }, [cue]);
  return <div className="arena3d" data-renderer={fallback ? 'unavailable' : 'three-webgl'} data-character="campus-mage" data-animation={phase}
    aria-label={'原創 3D 校園魔法師小羽與' + guardian + '的答題對戰'}>
    <div className="arena3d-canvas" ref={host} />
    {fallback && <div className="arena3d-fallback" role="status">
      <span aria-hidden="true">🪄</span>
      <strong>這台裝置無法顯示 3D 對戰場景</strong>
      <p>題目仍可正常作答。請開啟瀏覽器的硬體加速，或改用支援 WebGL 的裝置。</p>
    </div>}
  </div>;
}
