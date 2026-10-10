import { useEffect, useRef, useState } from 'react';
import { createArenaScene, type CinemaShot } from './arena3d';
import '../styles/arena3d.css';
import { appAssetUrl } from '../platform/urls';
import type { Mode } from '../domain/types';
import { getBossForTheme } from '../content/missionBosses';
import { getAdvancedBossArt } from './advancedBossSprite';
import { normalSpellNames } from './themedSpellEffects';
import { finalBosses } from '../content/missionBosses';

interface ArenaProps {
  chapter: number;
  spellChapter?: number;
  finalBoss?: boolean;
  mode: Mode;
  enemyHp: number;
  playerHp: number;
  reducedMotion: boolean;
  cue: string;
  guardian: string;
  cinemaShot?: CinemaShot;
  cinemaPaused?: boolean;
  companion?: boolean;
  combatStatus?: ArenaCombatStatus;
  attackOutcome?: ArenaAttackOutcome;
}

export interface ArenaCombatStatus {
  enemyBurning?: boolean;
  playerRegeneration?: boolean;
  frostGuard?: boolean;
  mirrorGuard?: boolean;
  lightningHintQueued?: boolean;
  lightningHintChoices?: number[];
}

export interface ArenaAttackOutcome {
  damage?: number;
  critical?: boolean;
  blocked?: boolean;
  missed?: boolean;
  burnDamage?: number;
  healing?: number;
}

export const abilityNames = normalSpellNames;
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

export function Arena({ chapter, spellChapter = chapter, finalBoss = false, mode, enemyHp, playerHp, reducedMotion, cue, guardian, cinemaShot, cinemaPaused = false, companion = false, combatStatus, attackOutcome }: ArenaProps) {
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
      }, cinemaShot, companion, mode, finalBoss);
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
  }, [chapter, mode, reducedMotion, companion, finalBoss]);
  useEffect(() => {
    scene.current?.health(enemyHp, playerHp);
  }, [enemyHp, playerHp]);
  useEffect(() => { scene.current?.pauseCinema(cinemaPaused); scene.current?.shot(cinemaShot); }, [cinemaShot, cinemaPaused]);
  useEffect(() => {
    if (!cue || cue === lastCue.current) return;
    lastCue.current = cue;
    const ultimate = cue.startsWith('ultimate');
    scene.current?.play(cue.startsWith('success') || ultimate, ultimate, attackOutcome?.blocked ?? cue.startsWith('blocked-'), spellChapter, {
      critical: attackOutcome?.critical ?? cue.startsWith('enemy-ultimate-'),
      missed: attackOutcome?.missed ?? cue.startsWith('miss-'),
    });
    // The outcome belongs to this cue; changing a timer or clearing feedback must
    // not restart a cast or its one-time HP feedback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue, spellChapter]);
  return <div className={'arena3d' + (reducedMotion ? ' reduced-motion' : '')} data-renderer={fallback ? 'unavailable' : 'three-webgl'} data-character="campus-mage" data-animation={phase} data-cinema-shot={cinemaShot}
    data-boss={companion ? 'mimi-companion' : finalBoss ? finalBosses[mode].id : getBossForTheme(chapter, mode).id} data-boss-mode={companion ? 'companion' : mode}
    aria-label={'原創 3D 風格校園魔法師小羽與' + guardian + '的答題對戰'}>
    <div className="arena3d-canvas" ref={host} />
    {!cinemaShot && <div className="arena-status-auras" aria-hidden="true">
      {combatStatus?.enemyBurning && <span className="arena-status-aura enemy-burning"><i /><i /><i /></span>}
      {combatStatus?.playerRegeneration && <span className="arena-status-aura hero-regenerating"><i>＋</i><i>＋</i><i>＋</i></span>}
      {combatStatus?.frostGuard && <span className="arena-status-aura hero-frost"><i>❄</i><i>❄</i></span>}
      {combatStatus?.mirrorGuard && <span className="arena-status-aura hero-mirror" />}
    </div>}
    {!cinemaShot && cue && <div className="arena-turn-feedback" key={'turn-status-' + cue}>
      {!!attackOutcome?.burnDamage && <span className="arena-turn-pop burn-pop">燃燒 −{attackOutcome.burnDamage} HP</span>}
      {!!attackOutcome?.healing && <span className="arena-turn-pop healing-pop">回復 ＋{attackOutcome.healing} HP</span>}
      {attackOutcome?.critical && <span className="arena-turn-pop critical-pop">魔王追擊必殺！</span>}
    </div>}
    {fallback && <div className="arena3d-fallback" role="status">
      <span aria-hidden="true">🪄</span>
      <strong>這台裝置無法顯示 3D 對戰場景</strong>
      <p>題目仍可正常作答。請開啟瀏覽器的硬體加速，或改用支援 WebGL 的裝置。</p>
    </div>}
  </div>;
}
