import { useEffect, useRef, useState } from 'react';
import { createArenaScene, type CinemaShot } from './arena3d';
import '../styles/arena3d.css';
import { appAssetUrl } from '../platform/urls';
import type { Mode } from '../domain/types';
import { getBossForTheme } from '../content/missionBosses';
import { getAdvancedBossArt } from './advancedBossSprite';

interface ArenaProps {
  chapter: number;
  mode: Mode;
  enemyHp: number;
  playerHp: number;
  reducedMotion: boolean;
  cue: string;
  guardian: string;
  cinemaShot?: CinemaShot;
  cinemaPaused?: boolean;
  companion?: boolean;
}

export const abilityNames = ['個資守護光球', '查證掃描光束', '分類卡片旋風', '真相稜鏡光波', '思考魔法書', '合作星光陣'];
export const ATTACK_IMPACT_MS = 900;

export function GuardianPortrait({ chapter, mode, className = '' }: { chapter: number; mode: Mode; className?: string }) {
  const theme = Math.max(0, Math.min(5, chapter - 1));
  const boss = getBossForTheme(chapter, mode);
  if (mode === 'advanced') {
    const art = getAdvancedBossArt(chapter), rect = art.frames.idle.rect;
    const alphaFilter = 'boss-alpha-' + boss.id;
    return <span aria-hidden="true" className={'guardian-portrait advanced-guardian-portrait ' + className}
      data-boss={boss.id} data-boss-mode={mode} style={{ backgroundImage: 'none', overflow: 'hidden' }}>
      <svg viewBox={`${rect.x} ${rect.y} ${rect.width} ${rect.height}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" focusable="false">
        <defs><filter id={alphaFilter} colorInterpolationFilters="sRGB"><feComponentTransfer>
          {/* Match the scene's alpha rejection so transparent generation fringes stay invisible. */}
          <feFuncA type="linear" slope={1 / .92} intercept={-.08 / .92} />
        </feComponentTransfer></filter></defs>
        <image href={appAssetUrl(boss.artPath!)} width={art.width} height={art.height} filter={`url(#${alphaFilter})`} />
      </svg>
    </span>;
  }
  return <span aria-hidden="true" className={'guardian-portrait ' + className} data-boss={boss.id} data-boss-mode={mode} style={{
    backgroundImage: `url(${appAssetUrl('/art/boss-portraits-v2.webp')})`,
    backgroundPosition: `${theme % 3 * 50}% ${theme < 3 ? 0 : 100}%`,
    backgroundSize: '300% 200%',
  }} />;
}

export function Arena({ chapter, mode, enemyHp, playerHp, reducedMotion, cue, guardian, cinemaShot, cinemaPaused = false, companion = false }: ArenaProps) {
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
      }, cinemaShot, companion, mode);
      scene.current = arena;
      arena.health(enemyHp, playerHp);
      arena.pauseCinema(cinemaPaused);
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
  }, [chapter, mode, reducedMotion, companion]);
  useEffect(() => {
    scene.current?.health(enemyHp, playerHp);
  }, [enemyHp, playerHp]);
  useEffect(() => { scene.current?.pauseCinema(cinemaPaused); scene.current?.shot(cinemaShot); }, [cinemaShot, cinemaPaused]);
  useEffect(() => {
    if (!cue || cue === lastCue.current) return;
    lastCue.current = cue;
    scene.current?.play(cue.startsWith('success'));
  }, [cue]);
  return <div className="arena3d" data-renderer={fallback ? 'unavailable' : 'three-webgl'} data-character="campus-mage" data-animation={phase} data-cinema-shot={cinemaShot}
    data-boss={companion ? 'mimi-companion' : getBossForTheme(chapter, mode).id} data-boss-mode={companion ? 'companion' : mode}
    aria-label={'原創 3D 風格校園魔法師小羽與' + guardian + '的答題對戰'}>
    <div className="arena3d-canvas" ref={host} />
    {fallback && <div className="arena3d-fallback" role="status">
      <span aria-hidden="true">🪄</span>
      <strong>這台裝置無法顯示 3D 對戰場景</strong>
      <p>題目仍可正常作答。請開啟瀏覽器的硬體加速，或改用支援 WebGL 的裝置。</p>
    </div>}
  </div>;
}
