import { useEffect, useRef } from 'react';
import { ArrowRight, Crown, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import type { Level, Progress, Session } from '../domain/types';
import { getUltimateCardKey, getUltimateSpell } from '../content/ultimateSpells';
import { finalBossUnlocked } from '../domain/engine';
import { getLevel } from '../content/levels';
import { getMissionBoss } from '../content/missionBosses';
import { appAssetUrl } from '../platform/urls';
import { LevelScore } from './Scoring';
import { getFinalBossArt } from './finalBossSprite';
import '../styles/final-boss.css';

export function FinalBossChallenge({ progress, onLevel }: { progress: Progress; onLevel: (level: Level) => void }) {
  const mode = progress.settings.mode;
  const level = getLevel(mode === 'starter' ? 13 : 14);
  const boss = getMissionBoss(level);
  const art = getFinalBossArt(mode), rect = art.frames.idle.rect;
  const owned = new Set((progress.ultimateCards ?? []).map(getUltimateCardKey));
  const count = [1, 2, 3, 4, 5, 6].filter(id => owned.has(`${mode}:${id}`)).length;
  const unlocked = finalBossUnlocked(progress, mode);
  return <section className={'final-boss-challenge ' + (unlocked ? 'unlocked' : 'locked')} aria-labelledby="final-boss-title">
    <div className="final-boss-copy"><span className="final-boss-kicker"><Crown size={22} />{mode === 'starter' ? '初階' : '進階'}最終決戰 · 300 HP</span>
      <h2 id="final-boss-title">{boss.name}</h2><p>{unlocked ? '六種魔法已集齊！帶著你的好判斷，迎接最後的綜合挑戰。' : '在這組六個主題關施放必殺技，集齊六張收藏卡，就能打開決戰之門。'}</p>
      <div className="final-unlock-meter"><b>{count}／6 張必殺收藏卡</b><progress max={6} value={count} aria-label="本組最終關解鎖進度" /></div>
      <div className="final-boss-tags"><span>最多 15 題</span><span>{mode === 'starter' ? '不限時' : '每題 30 秒'}</span><span>能量滿三點 · 自選必殺</span></div>
      <button className="button primary final-boss-start" disabled={!unlocked} onClick={() => onLevel(level)}>{unlocked ? <Crown size={23} /> : <LockKeyhole size={23} />}{unlocked ? progress.completed.includes(level.id) ? '再次挑戰最終魔王' : '挑戰最終魔王' : '集齊六張卡，開啟決戰'}{unlocked && <ArrowRight size={22} />}</button>
      <LevelScore progress={progress} levelId={level.id} />
    </div>
    <div className="final-boss-treasury"><svg className="final-boss-art" viewBox={`${rect.x} ${rect.y} ${rect.width} ${rect.height}`} role="img" aria-label={boss.name}><image href={appAssetUrl(art.assetPath)} width={art.width} height={art.height} /></svg>
      <div className="final-card-seals" aria-label="六種必殺技收藏進度">{[1, 2, 3, 4, 5, 6].map(id => { const spell = getUltimateSpell(id, mode)!; const earned = owned.has(`${mode}:${id}`); return <span key={id} className={earned ? 'earned' : ''} title={spell.name + (earned ? '：已解鎖' : '：尚未解鎖')}><img src={appAssetUrl(spell.artPath)} alt="" /><span>{earned ? <ShieldCheck size={18} /> : <LockKeyhole size={18} />}{spell.name}</span></span>; })}</div>
    </div>
  </section>;
}

export function UltimatePicker({ session, onSelect, onHome }: { session: Session; onSelect: (id: number) => void; onHome: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); dialog?.querySelector<HTMLButtonElement>('[data-spell-choice]')?.focus(); return () => dialog?.close(); }, []);
  return <dialog className="final-ultimate-picker" ref={ref} aria-labelledby="final-picker-title" onCancel={event => event.preventDefault()}>
    <header><span><Sparkles size={24} />三點能量集滿！</span><h2 id="final-picker-title">下一次答對，要施放哪一招？</h2><p>選好一種必殺技，下次答對就會自動施放。選招時倒數暫停。</p></header>
    <div className="final-spell-grid">{[1, 2, 3, 4, 5, 6].map(id => { const spell = getUltimateSpell(id, session.mode)!; return <button key={id} data-spell-choice type="button" onClick={() => onSelect(id)} aria-label={`選擇必殺技：${spell.name}`}>
      <img src={appAssetUrl(spell.artPath)} alt="" /><span><strong>{spell.name}</strong><small>{spell.category === 'defense' ? `護盾 ×${session.mode === 'advanced' ? 2 : 1} · 額外 ${spell.extraDamage} HP` : spell.category === 'support' ? `恢復 ${session.mode === 'advanced' ? 24 : 12} HP` : `法術攻擊 · 額外 ${spell.extraDamage} HP`}</small></span>
    </button>; })}</div>
    <button className="final-picker-home" type="button" onClick={onHome}>先回冒險地圖，保留能量</button>
  </dialog>;
}

export function levelLabel(level: Pick<Level, 'id' | 'mode' | 'finalBoss'>): string {
  return level.finalBoss ? '最終魔王關' : `第 ${level.mode === 'starter' ? level.id : level.id - 6} 關`;
}

export const finalBattleTrack = (level?: Level | null): 'battle' | 'final' => level?.finalBoss ? 'final' : 'battle';
