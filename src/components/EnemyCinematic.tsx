import { useId } from 'react';
import type { Mode } from '../domain/types';
import { enemyAttackName } from './combatChoreography';
import { MainBossPursuit, mainBossPursuitForms } from './MainBossPursuit';
import '../styles/enemy-cinematic.css';

export interface EnemyCinematicProps {
  mode: Mode;
  cue: string;
  reducedMotion: boolean;
  blocked?: boolean;
  missed?: boolean;
  chapter?: number;
  /** Older callers supply only final bosses; chapter callers explicitly opt out. */
  finalBoss?: boolean;
}

/** Shares the ordinary enemy clock: no extra timer or delayed turn transition. */
export const ENEMY_CINEMATIC_TIMING = { durationMs: 2050, launchMs: 480, impactMs: 900 } as const;

const rune = 'M0-16 12-7 12 7 0 16-12 7-12-7ZM0-10V10M-7-4 7 4M7-4-7 4';
const headCenters = [[0, 12, 1], [-51, -44, .62], [-91, -6, .6], [-78, 47, .58], [-124, 79, .56], [57, -44, .62], [100, -5, .6], [78, 49, .58], [125, 80, .56]];

function Grimoire({ id }: { id: string }) {
  return <g className="enemy-colossal-grimoire" data-form="chaos-grimoire">
    <defs><linearGradient id={`${id}-paper`} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#ae73c6" /><stop offset=".5" stopColor="#efcfea" /><stop offset="1" stopColor="#fff1b9" /></linearGradient></defs>
    <g className="enemy-grimoire-cover" fill="#452652" stroke="#efd07b" strokeWidth="5" strokeLinejoin="round"><path d="M0-75C-44-101-85-105-141-82L-128 101C-83 90-41 90 0 119Z" /><path d="M0-75C44-101 85-105 141-82L128 101C83 90 41 90 0 119Z" /></g>
    <g className="enemy-grimoire-open-pages" fill={`url(#${id}-paper)`} stroke="#86628d" strokeWidth="2"><path d="M0-72C-41-101-79-107-128-89L-115 79C-75 66-38 70 0 99Z" /><path d="M0-72C41-101 79-107 128-89L115 79C75 66 38 70 0 99Z" /><path d="M0-71V102" stroke="#4e2a5c" strokeWidth="5" /></g>
    <g fill="none" stroke="#593563" strokeWidth="4" strokeLinecap="round"><path d="M-106-52Q-61-62-23-34M-104-29Q-61-38-23-9M-101-4Q-59-10-23 16M-97 22Q-56 17-23 43M106-52Q61-62 23-34M104-29Q61-38 23-9M101-4Q59-10 23 16M97 22Q56 17 23 43" /></g>
    <g transform="translate(0 11)" fill="#392247" stroke="#ffe8a5" strokeWidth="3"><path d="M0-43 31-23 26 17 0 43-26 17-31-23Z" /><path d={rune} fill="none" /></g>
  </g>;
}

function RunePage({ secondary = false }: { secondary?: boolean }) {
  return <g className={`enemy-rune-page${secondary ? ' enemy-secondary-detail' : ''}`} data-form="rune-page">
    <path d="M-26-36 25-31 30 36-24 32Z" fill="#e5bbe2" stroke="#623975" strokeWidth="3" />
    <path d="M-21-30 19-26 24 29" fill="none" stroke="#ffdfa0" strokeWidth="2" />
    <path d={rune} fill="none" stroke="#65396e" strokeWidth="3" /><path d="M-14 22H15" stroke="#8e538e" strokeWidth="3" />
  </g>;
}

/** Nine upright horned faces, all looking left. This is the final boss's own
 * spectral head array, never the learner's phoenix/ice-dragon summon. */
function NineHeadArray() {
  return <g className="enemy-nine-head-array" data-form="nine-headed-phantom">
    <g className="enemy-nine-charge-streams" fill="none" stroke="#b986df" strokeWidth="4" opacity=".7">{headCenters.map(([x, y], i) => <path key={i} d={`M${x-22} ${y+8}Q${x-40} ${y+48} -45 111`} />)}</g>
    {headCenters.map(([x, y, size], i) => <g key={i} className="enemy-spectral-head" data-head={i + 1} transform={`translate(${x} ${y}) scale(${size})`}>
      <path d="M40 33C66 4 50-29 18-34L33-63 3-41-13-43-36-66-34-33-60-15-76 5-54 18-49 34-17 39 13 54Z" fill="#654584" stroke="#edbeea" strokeWidth="3" strokeLinejoin="round" />
      <path d="M-33-32-34-55-21-40M12-35 25-51 20-32M-76 5-53 7-50 16" fill="#e0b0d9" stroke="#fff0b6" strokeWidth="2" strokeLinejoin="round" />
      <path d="M-41-13-25-18-31-5Z" fill="#fbec92" /><path d="M-56 17-36 22-17 17" fill="none" stroke="#2a1b3e" strokeWidth="3" />
      <path d="M-39 20-35 29-31 20M-23 20-19 27-16 18" fill="#fff0ce" />
    </g>)}
    <ellipse cx="-45" cy="111" rx="24" ry="18" fill="#eb9acd" stroke="#ffefb3" strokeWidth="4" />
  </g>;
}

function GrimoireSequence({ id, contact = true }: { id: string; contact?: boolean }) {
  return <>
    <div className="enemy-cinematic-charge enemy-grimoire-charge" data-phase="grimoire-open-charge"><svg viewBox="-175 -145 350 300" aria-hidden="true" focusable="false"><Grimoire id={id} /><g fill="none" stroke="#f3cb91" strokeWidth="2">{[-1, 0, 1].map(i => <path key={i} d={rune} transform={`translate(${i*116} ${i === 0 ? -121 : 12}) scale(.72)`} />)}</g></svg></div>
    <div className="enemy-cinematic-flight enemy-grimoire-flight" data-phase="rune-pages-fan-flight"><svg viewBox="-210 -150 420 300" aria-hidden="true" focusable="false"><g className="enemy-grimoire-flight-streaks" fill="none" stroke="#e6a3d5" strokeWidth="8" strokeLinecap="round"><path d="M35-70 190-94M65-20 195-25M35 50 193 90" /></g><g className="enemy-rune-page-fan">{[-2,-1,0,1,2].map(i => <g key={i} transform={`translate(${-87+Math.abs(i)*37} ${i*39}) rotate(${i*18}) scale(${i === 0 ? 1.5 : .94})`}><RunePage secondary={Math.abs(i) === 2} /></g>)}</g></svg></div>
    {contact && <div className="enemy-cinematic-impact enemy-grimoire-impact" data-phase="broken-rune-seal"><svg viewBox="-180 -170 360 340" aria-hidden="true" focusable="false"><g className="enemy-rune-seal-split" fill="none" stroke="#f3c18b" strokeWidth="7"><path d="M-12-111-107-65-99 46-18 95M17-110 109-65 103 46 21 97" /><path d="M-26-141-119-91M31-142 125-90M-132 71-52 134M139 70 57 137" stroke="#d78bb6" strokeWidth="4" /><path d="M-16-47-48-24-41 23-11 45M13-47 47-24 40 23 11 45" stroke="#fff1b8" strokeWidth="5" /></g><g className="enemy-impact-fragments">{[0,1,2,3,4,5].map(i => <g key={i} transform={`rotate(${i*60}) translate(0 -126) rotate(${-i*41}) scale(.62)`}><RunePage secondary={i > 3} /></g>)}</g></svg></div>}
  </>;
}

function NineDragonSequence({contact = true}: {contact?: boolean}) {
  return <>
    <div className="enemy-cinematic-charge enemy-nine-dragon-charge" data-phase="nine-head-charge"><svg viewBox="-185 -140 370 310" aria-hidden="true" focusable="false"><NineHeadArray /></svg></div>
    <div className="enemy-cinematic-flight enemy-phantom-flame-flight" data-phase="nine-flames-converge-flight"><svg viewBox="-220 -145 440 290" aria-hidden="true" focusable="false"><g className="enemy-phantom-flame-streams" fill="none" stroke="#c591e1" strokeWidth="10" strokeLinecap="round">{Array.from({length:9},(_,i)=><path key={i} d={`M188 ${(i-4)*26}Q26 ${(i-4)*10} -141 0`} />)}</g><path className="enemy-phantom-flame-core" d="M-193 0C-121-81-78-38-52-66-70-22-10-35 24-67 19-10 93-26 138-4 83 3 54 44 8 37-29 14-44 63-82 69-70 25-118 69-193 0Z" fill="#9054b6" stroke="#efb3e6" strokeWidth="4" /><path d="M-171 0C-132-39-97-19-70-34-76-8-34-17-4 0-42 14-56 5-72 29-102 19-134 39-171 0Z" fill="#ffe1b2" /></svg></div>
    {contact && <div className="enemy-cinematic-impact enemy-phantom-flame-impact" data-phase="phantom-flame-local-burst"><svg viewBox="-190 -180 380 360" aria-hidden="true" focusable="false"><g className="enemy-phantom-impact-flames" fill="#9253b3" stroke="#efb7e6" strokeWidth="3">{Array.from({length:9},(_,i)=><path key={i} d="M0-43C-34-71-50-90-26-126-22-101-4-115 5-155 25-119 20-100 35-108 44-77 16-62 0-43Z" transform={`rotate(${i*40})`} />)}</g><path d="M0-55 17-24 53-29 30 6 43 42 10 27-17 56-23 23-55 18-31-10-39-43-8-31Z" fill="#fbd1a9" stroke="#ed9acc" strokeWidth="4" /><g className="enemy-impact-fragments enemy-secondary-detail" fill="#ddb6ef">{Array.from({length:9},(_,i)=><path key={i} d="M0-13 9 3-3 19-10 2Z" transform={`rotate(${i*40}) translate(0 -158)`} />)}</g></svg></div>}
  </>;
}

export function EnemyCinematic({ mode, cue, reducedMotion, blocked = false, missed = false, chapter = 1, finalBoss = true }: EnemyCinematicProps) {
  const id = `enemy-cinematic-${useId().replaceAll(':', '')}`;
  if (!cue.startsWith('enemy-ultimate-') && !(missed && cue.startsWith('miss-'))) return null;
  const theme = Math.max(1, Math.min(6, Math.trunc(Number.isFinite(chapter) ? chapter : 1)));
  const description = finalBoss ? mode === 'starter' ? '魔典王必殺：巨書張開，符文書頁扇形飛向主角' : '九頭龍必殺：九首幻影聚能，多束幻焰朝左匯聚'
    : `${enemyAttackName(mode, theme, false, true)}：魔王聚能，專屬法術朝左衝刺後追加追擊`;
  const outcome = missed ? '主角閃避，法術在身旁消散' : blocked ? '守護盾攔截，主角免傷' : finalBoss ? mode === 'starter' ? '命中後封陣局部破裂' : '命中主角後局部爆裂' : '命中後同種法術追加追擊';
  return <div className={`enemy-cinematic enemy-cinematic-${mode}${!finalBoss ? ' enemy-main-critical' : ''}${reducedMotion ? ' is-reduced' : ''}${missed ? ' is-missed' : blocked ? ' is-blocked' : ''}`}
    role="img" aria-label={`${description}，${outcome}`}
    data-boss={finalBoss ? mode === 'starter' ? 'chaos-grimoire-king' : 'illusion-nine-dragon' : `${mode}-chapter-${theme}`} data-cue={cue}
    data-pursuit-form={!finalBoss ? mainBossPursuitForms[mode][theme - 1] : undefined}
    data-duration-ms={ENEMY_CINEMATIC_TIMING.durationMs} data-launch-ms={ENEMY_CINEMATIC_TIMING.launchMs} data-impact-ms={ENEMY_CINEMATIC_TIMING.impactMs}
    data-facing="left" data-scope="combat-window" data-outcome={missed ? 'missed' : blocked ? 'blocked' : 'hit'}>
    {!finalBoss ? <MainBossPursuit mode={mode} chapter={theme} contact={!blocked && !missed} /> : mode === 'starter' ? <GrimoireSequence id={id} contact={!blocked && !missed} /> : <NineDragonSequence contact={!blocked && !missed} />}
    {!missed && blocked && <div className="enemy-cinematic-impact enemy-guard-intercept" data-phase="guard-intercept"><svg viewBox="-130 -140 260 280" aria-hidden="true" focusable="false"><path d="M0-119 93-76 75 41 0 120-75 41-93-76Z" fill="#174c4e57" stroke="#fce6a3" strokeWidth="9" /><path d="M0-88 67-56 53 26 0 84-53 26-67-56Z" fill="none" stroke="#9af0e8" strokeWidth="4" /><path d="M-39-9-7 25 46-42" fill="none" stroke="#fff0b6" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" /></svg></div>}
    {missed && <div className="enemy-cinematic-impact enemy-missed-dissipation" data-phase="missed-cast-dissipates"><svg viewBox="-130 -90 260 180" aria-hidden="true" focusable="false"><g fill="none" stroke="#b69bc9" strokeWidth="4" strokeLinecap="round"><path d="M-94 0Q-63-31-32-9T37-11T99 0M-68 17Q-34-7 4 15T78 15M-40-32 8-44 57-28" /></g></svg></div>}
  </div>;
}
