import type { Mode } from '../domain/types';

/** The twelve chapter bosses retain their own physical spell, even in a pursuit.
 * These local SVG silhouettes supplement the pooled arena forms, not a new summon. */
export const mainBossPursuitForms = {
  starter: ['chain-lock', 'flying-book', 'classification-stamp', 'mask-fragments', 'folded-paper-wings', 'interlocking-gears'],
  advanced: ['silk-web', 'hourglass-sand', 'thorn-vines', 'echo-tails', 'ink-spatter', 'storm-fists'],
} as const;

const colors = {
  starter: ['#edc46f', '#bdc9ef', '#9db9ed', '#d2afed', '#f5dea8', '#f1c56f'],
  advanced: ['#d4b6ee', '#f4cb79', '#a8ce77', '#c1a4e9', '#b19acb', '#b8e6f6'],
} as const;

function BossMaterial({ mode, chapter }: { mode: Mode; chapter: number }) {
  const color = colors[mode][chapter - 1];
  const base = { fill: color, stroke: '#fff0c3', strokeWidth: 4, strokeLinejoin: 'round' as const };
  const form = mainBossPursuitForms[mode][chapter - 1];
  let artwork;
  if (mode === 'starter') {
    if (chapter === 1) artwork = <>
      <g fill="none" stroke={color} strokeWidth="11">{[-1, 1].map(side => <g key={side} transform={`translate(${side * 72} 0) rotate(${side * 20})`}><rect x="-30" y="-17" width="60" height="34" rx="16" /><rect x="-45" y="-10" width="55" height="20" rx="10" transform={`translate(${side * 43} -15) rotate(30)`} /></g>)}</g>
      <path d="M-27-13V-41Q0-77 27-41V-13" fill="none" stroke="#fff0c3" strokeWidth="12" /><rect {...base} x="-42" y="-15" width="84" height="65" rx="9" /><path d="M0 0V30" stroke="#294b43" strokeWidth="11" strokeLinecap="round" />
    </>;
    else if (chapter === 2) artwork = <>
      <path {...base} d="M0-45Q-47-65-92-46L-78 55Q-37 40 0 61Q37 40 78 55L92-46Q47-65 0-45Z" /><path d="M0-45V61M-70-29-21-17M-66-5-21 7M-62 20-21 31M70-29 21-17M66-5 21 7M62 20 21 31" fill="none" stroke="#355374" strokeWidth="5" />
      <path d="M-109-71-76-87-65-48-99-41ZM73 67 104 46 118 77 85 91Z" {...base} />
    </>;
    else if (chapter === 3) artwork = <>
      <path {...base} d="M-18-53Q0-66 18-53L24-8H44V17H-44V-8H-24Z" /><path d="M-52 16H52L63 46H-63Z" fill="#476b9b" stroke="#fff0c3" strokeWidth="5" />
      <g fill="none" stroke={color} strokeWidth="6"><circle cx="-75" cy="55" r="18" /><path d="M55 55 75 30 95 55Z" /><path d="M-18 72H18V96H-18Z" /></g>
    </>;
    else if (chapter === 4) artwork = <>
      {[-1, 1].map(side => <g key={side} transform={`translate(${side * 41} 0) rotate(${side * 17})`}><path {...base} d="M-36-54Q0-74 36-54L28 30Q0 72-28 30Z" /><path d="M-25-12-9-18M9-18 25-12M-16 30Q0 15 16 30" fill="none" stroke="#514072" strokeWidth="7" strokeLinecap="round" /></g>)}
      <path d="M0-70-15-29 5-6-10 61" fill="none" stroke="#fff0c3" strokeWidth="6" />
    </>;
    else if (chapter === 5) artwork = <>
      <path {...base} d="M-3 5-113-63-74 11-100 41-13 31 0 64 13 31 100 41 74 11 113-63 3 5Z" /><path d="M0-24V64M-3 5-74 11M3 5 74 11M-13 31-100 41M13 31 100 41" fill="none" stroke="#997855" strokeWidth="4" />
      <path d="M-15-29 0-60 15-29 0-12Z" fill="#fff0c3" />
    </>;
    else artwork = <>
      {[-1, 1].map(side => <g key={side} transform={`translate(${side * 41} ${side * 19}) rotate(${side * 15})`}><path {...base} d="M-16-58H16L20-42 39-31 54-31 66-9 51 3 51 25 58 39 34 54 21 42-1 48-12 62-36 51-33 32-49 13-63 8-61-18-44-22-30-41Z" /><circle r="20" fill="#526e73" stroke="#fff0c3" strokeWidth="7" /></g>)}
    </>;
  } else {
    if (chapter === 1) artwork = <>
      <g fill="none" stroke={color} strokeWidth="5">{Array.from({ length: 8 }, (_, i) => <path key={i} d="M0 0V-92" transform={`rotate(${i * 45})`} />)}{[.35, .62, .90].map(size => <path key={size} d="M0-94 66-66 94 0 66 66 0 94-66 66-94 0-66-66Z" transform={`scale(${size})`} />)}</g><path d="M0-18 18 0 0 18-18 0Z" fill="#fff0c3" />
    </>;
    else if (chapter === 2) artwork = <>
      <path {...base} d="M-40-62H40Q41-26 8 0Q41 26 40 62H-40Q-41 26-8 0Q-41-26-40-62Z" /><path d="M-50-65H50M-50 65H50" stroke="#fff0c3" strokeWidth="12" /><path d="M-23-40 0-10 23-40ZM-27 45 0 17 27 45Z" fill="#946849" /><path d="M0-7V13" stroke="#fff0c3" strokeWidth="5" />
      <g fill={color}>{[-1, 1].map(side => <path key={side} d="M0-8 8 0 0 8-8 0Z" transform={`translate(${side * 72} ${side * 30})`} />)}</g>
    </>;
    else if (chapter === 3) artwork = <>
      <path d="M108-49Q57-72 30-16T-32 14T-108 57M93 47Q60 20 34 32T-18-17T-102-36" fill="none" stroke="#536844" strokeWidth="14" strokeLinecap="round" /><path d="M108-49Q57-72 30-16T-32 14T-108 57" fill="none" stroke={color} strokeWidth="6" />
      {[-1, 1].map(side => <g key={side} transform={`rotate(${side * 35})`}><path {...base} d="M-55 7Q-87-42-44-49Q-18-35-26-11Z" /><path d="M37 14 68-21 55 23ZM-10 2 4-33 8 12Z" fill="#fff0c3" /></g>)}
    </>;
    else if (chapter === 4) artwork = <>
      {[-1, 0, 1].map(i => <path key={i} {...base} d="M-93 27Q-40-79 61-59Q21-20 33 5Q-16 79-93 27Z" transform={`translate(${i * 22} ${i * 21}) scale(.79) rotate(${i * 9})`} />)}
      <path d="M25-22V30Q-2 19-13 36Q-24 60-3 57Q25 59 35 38V-9L62-22V8Q43-4 34 15Q21 40 44 40Q68 38 70 17V-42Z" fill="#fff0c3" stroke="#654575" strokeWidth="3" />
    </>;
    else if (chapter === 5) artwork = <>
      <path {...base} d="M0-76Q-47-22-48 11Q-43 66 0 67Q43 66 48 11Q47-22 0-76Z" /><path d="M-21 1Q-32 24-15 36" fill="none" stroke="#f9e2ff" strokeWidth="8" strokeLinecap="round" />
      {[-1, 1].map(side => <g key={side} transform={`translate(${side * 80} ${side * 27}) rotate(${side * 35})`}><path {...base} d="M0-26Q-22-3-20 12Q0 36 20 12Q22-3 0-26Z" /></g>)}
    </>;
    else artwork = <>
      <path {...base} d="M-99 35Q-124 1-85-17Q-93-51-53-51Q-33-83-8-52Q29-72 44-43Q84-48 85-17Q122-3 99 35Z" />
      <path d="M-21-29Q-4-46 9-32L18-12Q39-35 55-12L56 29Q24 64-10 39L-40 25Q-58 9-41-4L-21 7Z" fill="#548bad" stroke="#fff0c3" strokeWidth="5" /><path d="M-55 44-70 78-42 68-54 96" fill="none" stroke="#fff0c3" strokeWidth="8" strokeLinejoin="round" />
    </>;
  }
  return <g data-form={form}>{artwork}</g>;
}

/** All phases finish inside the existing 2.05-second ordinary enemy turn. */
export function MainBossPursuit({ mode, chapter, contact }: { mode: Mode; chapter: number; contact: boolean }) {
  const color = colors[mode][chapter - 1];
  return <>
    <div className="enemy-cinematic-charge enemy-main-charge" data-phase="species-pursuit-charge"><svg viewBox="-150 -130 300 260" aria-hidden="true" focusable="false"><g className="enemy-main-charge-emblem"><BossMaterial mode={mode} chapter={chapter} /></g><g className="enemy-secondary-detail" fill="none" stroke={color} strokeWidth="4"><path d="M-133-42-139-78-100-104M100 104 139 78 133 42" /><path d="M-125 65-99 84M125-65 99-84" /></g></svg></div>
    <div className="enemy-cinematic-flight enemy-main-flight" data-phase="species-pursuit-flight"><svg viewBox="-190 -125 380 250" aria-hidden="true" focusable="false"><g className="enemy-main-flight-streaks" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"><path d="M48-61 177-82M55 3H181M48 65 177 84" /></g><g transform="translate(-30 0) scale(.92)"><BossMaterial mode={mode} chapter={chapter} /></g></svg></div>
    {contact && <>
      <div className="enemy-cinematic-impact enemy-main-impact" data-phase="species-material-impact"><svg viewBox="-155 -145 310 290" aria-hidden="true" focusable="false"><g className="enemy-main-contact-emblem" transform="scale(.67)"><BossMaterial mode={mode} chapter={chapter} /></g><g className="enemy-impact-fragments" fill="none" stroke={color} strokeWidth="7">{Array.from({ length: 6 }, (_, i) => <path key={i} d="M0-89 14-109 6-130" transform={`rotate(${i * 60 + 14})`} />)}</g></svg></div>
      <div className="enemy-cinematic-flight enemy-main-pursuit" data-phase="species-follow-up-flight"><svg viewBox="-190 -125 380 250" aria-hidden="true" focusable="false">{[-1, 1].map(side => <g key={side} transform={`translate(${-55} ${side * 52}) scale(.56)`}><BossMaterial mode={mode} chapter={chapter} /></g>)}<g fill="none" stroke={color} strokeWidth="6"><path d="M25-60 149-86M25 60 149 86" /></g></svg></div>
      <div className="enemy-cinematic-impact enemy-main-afterstrike" data-phase="species-follow-up-impact"><svg viewBox="-150 -130 300 260" aria-hidden="true" focusable="false"><g className="enemy-main-afterstrike-emblem" transform="scale(.8)"><BossMaterial mode={mode} chapter={chapter} /></g><g className="enemy-secondary-detail" fill="none" stroke={color} strokeWidth="5"><path d="M-113-82-140-47M113 82 140 47M-114 82-140 47M114-82 140-47" /></g></svg></div>
    </>}
  </>;
}
