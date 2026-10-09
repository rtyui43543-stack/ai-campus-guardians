import { useId, type CSSProperties } from 'react';
import type { Mode } from '../domain/types';
import { getUltimateSpell } from '../content/ultimateSpells';
import { appAssetUrl } from '../platform/urls';
import { ULTIMATE_SUMMON_ART, ULTIMATE_SUMMON_TIMING, type UltimateSummonKind } from './ultimateSummons';
import '../styles/ultimate-cinematic.css';

export interface UltimateCinematicProps {
  chapter: number;
  mode: Mode;
  cue: string;
  reducedMotion: boolean;
}

const star = 'M0-18 5-5 18 0 5 5 0 18-5 5-18 0-5-5Z';
const leaf = 'M0 0C-45-30-52-90 0-123C52-90 45-30 0 0Z';
const feather = 'M0 0C-18-35-33-96 0-170C35-96 22-34 0 0Z';

function IllustratedSummon({ kind, phase }: { kind: UltimateSummonKind; phase: string }) {
  const art = ULTIMATE_SUMMON_ART[kind];
  return <div className={`ultimate-summon-flight ultimate-summon-${kind}`} data-phase={phase} data-summon-art={kind}>
    <div className="ultimate-summon-wake" aria-hidden="true" />
    <img className="ultimate-summon-creature" src={appAssetUrl(art.path)} width={art.width} height={art.height} alt="" aria-hidden="true" decoding="sync" draggable={false} />
  </div>;
}

/** Keep the bird's proportions while its HTML anchor travels between the same
 * left/right actor lanes as the arena. Contact is at 900 ms, when HP changes. */
function PhoenixProjectile({ id, fieldBurn = true, illustrated = false }: { id: string; fieldBurn?: boolean; illustrated?: boolean }) {
  const fire = `url(#${id}-phoenix-fire)`;
  return <div className="ultimate-phoenix" data-sequence={fieldBurn ? 'summon-grow-flight-impact-burn' : 'summon-grow-flight-impact-feathers'}>
    {illustrated ? <IllustratedSummon kind="phoenix" phase="summon-grow-flight" /> : <div className="ultimate-phoenix-flight" data-phase="summon-grow-flight">
      <svg viewBox="0 0 1440 900" aria-hidden="true" focusable="false">
        <defs><linearGradient id={`${id}-phoenix-fire`} x1="0" y1="1" x2="0" y2="0"><stop stopColor="#b83928" /><stop offset=".4" stopColor="#f47b37" /><stop offset=".75" stopColor="#ffd269" /><stop offset="1" stopColor="#fff9d7" /></linearGradient></defs>
        <g className="ultimate-phoenix-flight-trail" fill="none" stroke="#ffc866" strokeWidth="18" strokeLinecap="round">
          <path d="M665 595C475 525 295 626 36 617M669 639C434 646 237 735 23 695M682 684C475 752 282 798 108 763" />
        </g>
        <g className="ultimate-phoenix-wing left" fill={fire} stroke="#b3662d" strokeWidth="3" strokeLinejoin="round">
          <path d="M720 537C536 532 341 428 133 216C83 395 168 533 630 660Z" />
          {Array.from({ length: 9 }, (_, i) => <path key={i} d={feather} transform={`translate(${634 - i * 42} ${618 - i * 25}) rotate(${-52 - i * 5}) scale(${1.2 + i * .09})`} />)}
        </g>
        <g className="ultimate-phoenix-wing right" fill={fire} stroke="#b3662d" strokeWidth="3" strokeLinejoin="round">
          <path d="M720 537C904 532 1099 428 1307 216C1357 395 1272 533 810 660Z" />
          {Array.from({ length: 9 }, (_, i) => <path key={i} d={feather} transform={`translate(${806 + i * 42} ${618 - i * 25}) rotate(${52 + i * 5}) scale(${1.2 + i * .09})`} />)}
        </g>
        <g className="ultimate-phoenix-body" fill={fire} stroke="#9b5628" strokeWidth="5">
          <path d="M720 706C577 589 648 466 690 395C709 363 690 320 718 294C754 332 744 353 765 384L834 416 772 434C814 500 835 591 720 706Z" />
          {[0, 1, 2, 3, 4].map(i => <path key={i} d={feather} transform={`translate(${690 + i * 15} ${782 + (i % 2) * 28}) rotate(${(i - 2) * 13}) scale(.9 1.25)`} />)}
          <path d="M715 357 728 363 714 371" fill="#1b4845" stroke="none" />
        </g>
      </svg>
    </div>}
    <div className="ultimate-phoenix-impact" data-phase="enemy-impact">
      <svg viewBox="-240 -240 480 480" aria-hidden="true" focusable="false">
        <circle className="ultimate-fire-impact-ring" r="102" fill="#fff1a037" stroke="#ffe79b" strokeWidth="12" />
        <path d="M0-180 31-80 105-141 76-42 185-29 87 14 137 117 40 70 0 188-36 77-133 132-77 34-182-15-83-44-110-144-34-81Z" fill="#ffd887" stroke="#f88937" strokeWidth="10" />
        <path d="M0-100 20-38 80-27 38 19 47 85-9 47-66 88-46 19-104-22-35-39Z" fill="#fff8d2" />
      </svg>
    </div>
    {fieldBurn && <><div className="ultimate-phoenix-screen-blaze" data-phase="full-battlefield-burn" />
    <svg className="ultimate-phoenix-burn" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs><linearGradient id={`${id}-screen-flame`} x1="0" y1="1" x2="0" y2="0"><stop stopColor="#b73523" stopOpacity=".72" /><stop offset=".4" stopColor="#f27831" stopOpacity=".86" /><stop offset=".76" stopColor="#ffca67" stopOpacity=".68" /><stop offset="1" stopColor="#fff3b6" stopOpacity=".15" /></linearGradient></defs>
      <g className="ultimate-phoenix-fire-front" fill={`url(#${id}-screen-flame)`}>
        {Array.from({ length: 16 }, (_, i) => <path key={i} className="ultimate-screen-flame" style={{ '--flame-height': `${.78 + (i % 4) * .11}` } as CSSProperties}
          d={`M${i * 96 - 60} 900C${i * 96 - 108} 691 ${i * 96 + 10} 704 ${i * 96 - 5} ${355 + (i % 4) * 66}C${i * 96 + 112} ${542 + (i % 3) * 54} ${i * 96 + 69} 599 ${i * 96 + 100} 680C${i * 96 + 142} 576 ${i * 96 + 162} 669 ${i * 96 + 174} 900Z`} />)}
      </g>
      <g className="ultimate-phoenix-fire-embers" fill="#ffe4a2">
        {Array.from({ length: 25 }, (_, i) => <path key={i} d={feather} transform={`translate(${31 + i * 59} ${790 - (i % 5) * 99}) rotate(${(i % 3 - 1) * 34}) scale(${.07 + (i % 4) * .015})`} />)}
      </g>
    </svg></>}
  </div>;
}

function CastleProjection({ id, upgraded = false }: { id: string; upgraded?: boolean }) {
  const jade = `url(#${id}-castle-jade)`, gold = `url(#${id}-castle-gold)`;
  return <div className={`ultimate-castle-projection${upgraded ? ' is-upgraded' : ''}`} data-sequence="castle-shield-crest-flight-seal-impact">
    <div className="ultimate-castle-charge" data-phase="castle-shield-charge">
      <svg viewBox="-260 -260 520 520" aria-hidden="true" focusable="false">
        <defs><linearGradient id={`${id}-castle-jade`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a1ffe1" /><stop offset=".42" stopColor="#42b8a0" /><stop offset="1" stopColor="#155668" /></linearGradient>
          <linearGradient id={`${id}-castle-gold`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff1ac" /><stop offset=".5" stopColor="#ebbf62" /><stop offset="1" stopColor="#956022" /></linearGradient></defs>
        <path d="M-184-133 0-212 184-133 150 98 0 206-150 98Z" fill={jade} fillOpacity=".67" stroke={gold} strokeWidth="13" />
        <g className="ultimate-castle-summon" fill={jade} stroke="#13444f" strokeWidth="5" strokeLinejoin="round">
          <path d="M-125 105V-100H-88V-125H-58V-100H-24V-157H9V-180H42V-157H72V-100H100V-125H130V-100H158V105Z" />
          <path d="M-52 105V-25Q15-103 82-25V105Z" fill={gold} />
          <path className="ultimate-castle-gate" d="M-35 104V-21Q15-71 65-21V104Z" fill="#1b6463" />
        </g>
        <path d="M-79-58-12 9 108-93" fill="none" stroke="#eaffdd" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
        {upgraded && <g className="ultimate-castle-extra-guards" fill={jade} stroke={gold} strokeWidth="6">{[-1, 1].map(side => <g key={side} transform={`translate(${side * 212} 24) scale(.6)`}><path d="M-50-70 0-93 50-70 42 32 0 79-42 32Z" /><path d="M-23-5-5 15 26-28" fill="none" stroke="#e6ffde" strokeWidth="10" /></g>)}</g>}
      </svg>
    </div>
    <div className="ultimate-castle-crest-flight" data-phase="castle-crest-flight">
      <svg viewBox="-240 -240 480 480" aria-hidden="true" focusable="false">
        <g className="ultimate-castle-crest" fill={jade} stroke={gold} strokeWidth="11" strokeLinejoin="round">
          <path d="M-135-101 0-166 135-101 105 84 0 168-105 84Z" />
          <path d="M-88 62V-72H-66V-91H-42V-72H-19V-112H3V-133H26V-112H50V-72H71V-91H94V-72H111V62Z" fill={gold} stroke="#164e56" strokeWidth="4" />
          <path d="M-9 62V-10Q17-42 43-10V62Z" fill="#1c6866" stroke="none" />
          <path d="M-52 92-9 128 68 66" fill="none" stroke="#e9ffe3" strokeWidth="12" strokeLinecap="round" />
        </g>
      </svg>
    </div>
    <div className="ultimate-castle-seal-impact" data-phase="castle-seal-impact">
      <svg viewBox="-300 -260 600 520" aria-hidden="true" focusable="false">
        <g fill={jade} stroke={gold} strokeWidth="7" strokeLinejoin="round"><path d="M-237 152V-68H-190V-104H-142V-68H-87V-156H-45V-190H1V-156H53V-68H110V-104H158V-68H203V152Z" /><path d="M-67 152V22Q-15-56 37 22V152Z" fill="#c9f8df" /></g>
        <path d="M-88 72-24 126 94-2" fill="none" stroke="#206a6a" strokeWidth="17" strokeLinecap="round" />
        <g className="ultimate-castle-brick-burst" fill={gold} stroke="#1c665e" strokeWidth="3">{Array.from({ length: 16 }, (_, i) => <path key={i} d="M-18-11H18V11H-18Z" transform={`rotate(${i * 22.5}) translate(0 -226) rotate(${i * 13})`} />)}</g>
      </svg>
    </div>
  </div>;
}

function IndexProjection({ id }: { id: string }) {
  const paper = `url(#${id}-index-paper)`;
  return <div className="ultimate-index-projection" data-sequence="great-book-charge-scroll-flight-lightning-impact">
    <div className="ultimate-index-book-charge" data-phase="great-book-charge">
      <svg viewBox="-300 -260 600 520" aria-hidden="true" focusable="false">
        <defs><linearGradient id={`${id}-index-paper`} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="#fffce5" /><stop offset="1" stopColor="#e6c878" /></linearGradient></defs>
        <path d="M-240-84Q-98-162 0-81Q98-162 240-84L205 143Q89 96 0 165Q-92 95-205 143Z" fill="#1d4d6d" stroke="#aa7735" strokeWidth="13" strokeLinejoin="round" />
        <g className="ultimate-index-open-pages" fill={paper} stroke="#ad8c47" strokeWidth="4"><path d="M-216-102Q-96-151 0-65V137Q-93 68-185 111Z" /><path d="M216-102Q96-151 0-65V137Q93 68 185 111Z" /></g>
        <g fill="none" stroke="#b7984b" strokeWidth="6">{[0, 1, 2].map(i => <path key={i} d={`M-164 ${-46 + i * 44}Q-89 ${-70 + i * 44}-28 ${-18 + i * 44}M28 ${-18 + i * 44}Q89 ${-70 + i * 44} 164 ${-46 + i * 44}`} />)}</g>
        <path d="M-28-191 49-191 1-118 53-118-42-5-6-82-60-82Z" fill="#ffe294" stroke="#bf883c" strokeWidth="4" />
      </svg>
    </div>
    <div className="ultimate-index-scroll-flight" data-phase="thunder-scroll-flight">
      <svg viewBox="-260 -250 520 500" aria-hidden="true" focusable="false">
        <g className="ultimate-thunder-scroll" stroke="#8f662d" strokeWidth="6" strokeLinejoin="round"><path d="M-145-172Q0-200 145-172V172Q0 137-145 172Z" fill={paper} /><path d="M-145-172Q-194-207-194-148V151Q-194 199-145 172Z" fill="#dfb458" /><path d="M145-172Q194-206 194-149V152Q194 198 145 172Z" fill="#b98535" /><path d="M-26-107H70L12-26H83L-57 128-16 30H-78Z" fill="#f1c454" stroke="#547891" strokeWidth="4" /><path d="M-106-136H106M-106 136H106" fill="none" strokeWidth="4" /></g>
        <g className="ultimate-index-orbit-pages" fill={paper} stroke="#b59047" strokeWidth="3">{Array.from({ length: 6 }, (_, i) => <path key={i} d="M-18-27H18V27H-18Z" transform={`rotate(${i * 60}) translate(0 -222) rotate(${-i * 60})`} />)}</g>
      </svg>
    </div>
    <div className="ultimate-index-lightning-impact" data-phase="branching-lightning-impact">
      <svg viewBox="-320 -310 640 620" aria-hidden="true" focusable="false">
        <g className="ultimate-index-hit-bolts" fill="#ffe599" stroke="#a57227" strokeWidth="4" strokeLinejoin="round">{Array.from({ length: 6 }, (_, i) => <path key={i} d="M-10-285 39-285 11-147 56-153-21 32-1-89-43-82Z" transform={`rotate(${i * 60})`} />)}</g>
        <g className="ultimate-index-hit-pages" fill={paper} stroke="#a38237" strokeWidth="3">{Array.from({ length: 12 }, (_, i) => <g key={i} transform={`rotate(${i * 30}) translate(0 -173) rotate(${i * 9})`}><path d="M-25-34H25V34H-25Z" /><path d="M-15-12H15M-15 3H10" fill="none" /></g>)}</g>
        <path d="M-81-63H81V63H-81Z" fill="#3d698e" stroke="#dfb44f" strokeWidth="6" /><path d="M-36-2-7 25 43-32" fill="none" stroke="#e1f8f1" strokeWidth="10" strokeLinecap="round" />
      </svg>
    </div>
    <div className="ultimate-index-storm-wash" />
  </div>;
}

function MirrorProjection({ id }: { id: string }) {
  const silver = `url(#${id}-mirror-projectile)`;
  return <div className="ultimate-mirror-projection" data-sequence="mirror-array-charge-blade-flight-mask-shatter">
    <div className="ultimate-mirror-array-charge" data-phase="mirror-array-charge">
      <svg viewBox="-250 -250 500 500" aria-hidden="true" focusable="false">
        <defs><linearGradient id={`${id}-mirror-projectile`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#eefcff" /><stop offset=".34" stopColor="#92cde7" /><stop offset=".55" stopColor="#ded0ff" /><stop offset="1" stopColor="#765bba" /></linearGradient></defs>
        <g fill={silver} stroke="#c2a363" strokeWidth="5">{Array.from({ length: 8 }, (_, i) => <g key={i} transform={`rotate(${i * 45}) translate(0 -157)`}><path d="M0-62 30-24 23 35 0 64-23 35-30-24Z" /><path d="M-16 13 15-33" fill="none" stroke="#f8f9ff" strokeWidth="4" /></g>)}</g>
        <path d="M-100-100 100 100M100-100-100 100" fill="none" stroke="#d9e8ff" strokeWidth="3" />
      </svg>
    </div>
    <div className="ultimate-mirror-blade-flight" data-phase="colossal-mirror-blade-flight">
      <svg viewBox="-250 -270 500 540" aria-hidden="true" focusable="false">
        <g className="ultimate-colossal-mirror-blade" fill={silver} stroke="#aa8747" strokeWidth="9" strokeLinejoin="round"><path d="M0-229 151-73 100 102 0 229-100 102-151-73Z" /><path d="M0-201 124-67 77 93 0 201Z" fill="#b9b8eb" stroke="#e3efff" strokeWidth="4" /><path d="M0-201-125-68-77 93 0 201Z" fill="#d0f5ff" stroke="#e3efff" strokeWidth="4" /><path d="M-83 58 85-124M-56 121 107-60" fill="none" stroke="#ffffff" strokeWidth="8" opacity=".7" /><path d="M-42 4-9 33 51-40" fill="none" stroke="#426678" strokeWidth="13" strokeLinecap="round" /></g>
      </svg>
    </div>
    <div className="ultimate-mirror-mask-impact" data-phase="false-mask-shatter">
      <svg viewBox="-300 -280 600 560" aria-hidden="true" focusable="false">
        <g fill="#9672c4" stroke="#3d3868" strokeWidth="7" strokeLinejoin="round"><g className="ultimate-mask-half left"><path d="M0-142-62-186-149-127-115 106 0 168-16 38 14-10Z" /><path d="M-103-47-33-26M-52 91-9 62" fill="none" stroke="#d8c3f5" /></g><g className="ultimate-mask-half right"><path d="M0-142 62-186 149-127 115 106 0 168-16 38 14-10Z" /><path d="M33-26 103-47M9 62 52 91" fill="none" stroke="#d8c3f5" /></g></g>
        <g className="ultimate-mirror-hit-fragments" fill={silver} stroke="#647899" strokeWidth="3">{Array.from({ length: 18 }, (_, i) => <path key={i} d="M0-48 25-3 9 44-21 19-23-20Z" transform={`rotate(${i * 20}) translate(0 -222) rotate(${i * 11})`} />)}</g>
      </svg>
    </div>
    <div className="ultimate-mirror-prism-wash" />
  </div>;
}

function StarterPhoenixProjection({ id }: { id: string }) {
  return <div className="ultimate-starter-phoenix" data-sequence="fire-feather-array-phoenix-flight-flame-impact">
    <div className="ultimate-starter-fire-array" data-phase="fire-feather-array">
      <svg viewBox="-250 -250 500 500" aria-hidden="true" focusable="false">
        <path d="M0-167 145-83 145 83 0 167-145 83-145-83Z" fill="none" stroke="#efb55d" strokeWidth="6" />
        <g fill="#ffa345" stroke="#b3662d" strokeWidth="3">{Array.from({ length: 12 }, (_, i) => <path key={i} d={feather} transform={`rotate(${i * 30}) translate(0 -205) rotate(180) scale(.42)`} />)}</g>
        <path d={feather} transform="translate(0 80) scale(1.05)" fill="#ffcf67" stroke="#c87932" strokeWidth="4" />
      </svg>
    </div>
    <PhoenixProjectile id={id} fieldBurn={false} />
    <div className="ultimate-starter-fire-impact" data-phase="fire-feather-burst">
      <svg viewBox="-320 -300 640 600" aria-hidden="true" focusable="false">
        <g className="ultimate-starter-fire-plumes" fill="#f68b3c" stroke="#b7652e" strokeWidth="3">{Array.from({ length: 13 }, (_, i) => <path key={i} d={feather} transform={`rotate(${i * 360 / 13}) translate(0 -72) scale(.85 1.2)`} />)}</g>
        <g className="ultimate-starter-fire-fragments" fill="#ffd679">{Array.from({ length: 18 }, (_, i) => <path key={i} d={feather} transform={`rotate(${i * 20}) translate(0 -251) rotate(180) scale(.21)`} />)}</g>
      </svg>
    </div>
    <div className="ultimate-starter-fire-wash" />
  </div>;
}

function StarterCombatCinematic({ id, chapter, name, cue, reducedMotion }: { id: string; chapter: number; name: string; cue: string; reducedMotion: boolean }) {
  const descriptions: Record<number, string> = {
    1: '先形成城堡護盾，再從城門發射城堡徽印，命中對手形成封印堡壘',
    2: '大書蓄力打開，雷霆書卷飛向對手，命中後書頁與分岔雷電擴散',
    4: '鏡片結陣召喚巨大鏡刃，飛向對手擊破假面，碎鏡爆散',
    5: '火羽召喚陣組成大鳳凰，飛向對手，命中後火焰與火羽爆裂',
  };
  return <div className={`ultimate-cinematic ultimate-theme-${chapter} ultimate-starter-combat scope-full${reducedMotion ? ' is-reduced' : ''}`}
    role="img" aria-label={`初階必殺技：${name}，${descriptions[chapter]}`}
    data-ultimate-tier="starter" data-spell={chapter} data-cue={cue} data-scope="full">
    {chapter === 1 && <CastleProjection id={id} />}
    {chapter === 2 && <IndexProjection id={id} />}
    {chapter === 4 && <MirrorProjection id={id} />}
    {chapter === 5 && <StarterPhoenixProjection id={id} />}
  </div>;
}

/** A horned, winged ice dragon crosses the actor lanes before the ice field
 * spreads. Independent percentage anchors preserve its silhouette on tablets. */
function IceDragonProjectile({ id }: { id: string }) {
  return <div className="ultimate-ice-dragon" data-sequence="ice-gather-dragon-flight-impact-frost">
    <IllustratedSummon kind="iceDragon" phase="ice-dragon-flight" />
    <div className="ultimate-ice-dragon-impact" data-phase="ice-shatter-impact">
      <svg viewBox="-240 -240 480 480" aria-hidden="true" focusable="false">
        <g fill="#c1f4ff" stroke="#479cc3" strokeWidth="5" strokeLinejoin="round">
          {Array.from({ length: 11 }, (_, i) => <path key={i} d="M-18 8-32-65 0-185 32-65 18 8Z" transform={`rotate(${i * 360 / 11})`} />)}
        </g>
        <path d="M0-82 19-23 76-29 34 19 44 72-11 44-65 81-39 15-83-29-21-32Z" fill="#f4fdff" stroke="#71ccec" strokeWidth="5" />
      </svg>
    </div>
    <div className="ultimate-ice-frost-wash" data-phase="full-battlefield-frost" />
    <svg className="ultimate-ice-field" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs><linearGradient id={`${id}-ice-spike`} x1="0" y1="1" x2=".6" y2="0"><stop stopColor="#216f9c" stopOpacity=".75" /><stop offset=".45" stopColor="#75d7ed" stopOpacity=".85" /><stop offset="1" stopColor="#e8fcff" stopOpacity=".93" /></linearGradient></defs>
      <g className="ultimate-ice-ground-cracks" fill="none" stroke="#d6faff" strokeWidth="7" strokeLinejoin="round">
        <path d="M1023 646 932 735 779 722 669 844 513 810 351 884M932 735 849 885M1023 646 1131 706 1118 800 1310 847M1131 706 1322 680 1410 727M779 722 691 681 500 717 388 674 201 728 63 701" />
      </g>
      <g className="ultimate-ice-spike-front" fill={`url(#${id}-ice-spike)`} stroke="#a9eeff" strokeWidth="3">
        {Array.from({ length: 15 }, (_, i) => <g key={i} style={{ '--ice-spike-height': `${.65 + i % 4 * .14}` } as CSSProperties} className="ultimate-field-ice-spike">
          <path d={`M${i * 101 - 28} 900 ${i * 101 + 25} ${463 + (i % 4) * 62} ${i * 101 + 81} 900Z`} /><path d={`M${i * 101 + 25} ${463 + (i % 4) * 62} ${i * 101 + 25} 900 ${i * 101 + 81} 900Z`} fill="#e4fcff" opacity=".4" />
        </g>)}
      </g>
      <g className="ultimate-ice-shatter-fragments" fill="#d7f8ff" stroke="#66b6d4" strokeWidth="2">
        {Array.from({ length: 24 }, (_, i) => <path key={i} d="M0-28 12-6 7 25-8 16-12-8Z" transform={`translate(${34 + i * 60} ${658 - i % 5 * 85}) rotate(${i * 31}) scale(${.45 + i % 3 * .13})`} />)}
      </g>
    </svg>
  </div>;
}

function StarterFrostLance({ id, name, cue, reducedMotion }: { id: string; name: string; cue: string; reducedMotion: boolean }) {
  const ice = `url(#${id}-lance-ice)`;
  return <div className={`ultimate-cinematic ultimate-theme-6 ultimate-starter-frost scope-full${reducedMotion ? ' is-reduced' : ''}`}
    role="img" aria-label={`初階必殺技：${name}，召喚冰晶陣，投出巨型冰矛，命中後大片碎冰與霜浪展開`}
    data-ultimate-tier="starter" data-spell="6" data-cue={cue} data-scope="full" data-sequence="crystal-array-colossal-lance-shatter-frost-wave">
    <div className="ultimate-frost-lance-array" data-phase="crystal-array">
      <svg viewBox="-250 -250 500 500" aria-hidden="true" focusable="false">
        <defs><linearGradient id={`${id}-array-ice`} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#3292bd" /><stop offset=".48" stopColor="#9ce8f7" /><stop offset="1" stopColor="#f1fdff" /></linearGradient></defs>
        <g fill="none" stroke="#bcefff" strokeWidth="6" strokeLinejoin="round"><path d="M0-155 134-77 134 77 0 155-134 77-134-77Z" /><path d="M0-124 107 62-107 62ZM0 124-107-62H107Z" strokeWidth="3" /></g>
        <g className="ultimate-lance-orbit-crystals" fill={`url(#${id}-array-ice)`} stroke="#377fab" strokeWidth="3">
          {Array.from({ length: 12 }, (_, i) => <g key={i} transform={`rotate(${i * 30}) translate(0 -195)`}><path d="M0-42 15-8 9 30-8 19-15-8Z" /><path d="M0-42 0 24 9 30 15-8Z" fill="#e4faff" stroke="none" /></g>)}
        </g>
      </svg>
    </div>
    <div className="ultimate-frost-lance-flight" data-phase="colossal-ice-lance-flight">
      <svg viewBox="0 0 1200 340" aria-hidden="true" focusable="false">
        <defs><linearGradient id={`${id}-lance-ice`} x1="0" y1="1" x2=".7" y2="0"><stop stopColor="#26729e" /><stop offset=".34" stopColor="#6fcfea" /><stop offset=".62" stopColor="#b6f5ff" /><stop offset="1" stopColor="#f4fdff" /></linearGradient></defs>
        <g className="ultimate-colossal-ice-lance" fill={ice} stroke="#327b9f" strokeWidth="5" strokeLinejoin="round">
          <path d="M52 147 625 139 771 79 1150 170 771 261 625 201 52 194 8 170Z" />
          <path d="M8 170H1150L771 79 625 139 52 147Z" fill="#dbfaff" stroke="none" />
          <path d="M625 139 690 47 823 97 737 150 798 171 737 194 823 244 690 291 625 201Z" />
          <path d="M625 139 690 47 690 158 798 171H52M690 291V184L798 171" fill="none" stroke="#eafbff" strokeWidth="7" />
          <path d="M823 97 920 146 771 170 921 194 823 244M771 170 1150 170" fill="none" stroke="#69b9d9" strokeWidth="4" />
          {[0, 1, 2, 3].map(i => <path key={i} d={`M${182 + i * 85} 140 ${221 + i * 85} 169 ${182 + i * 85} 202 ${162 + i * 85} 170Z`} fill="#8ed9ee" />)}
        </g>
        <g className="ultimate-lance-flight-crystals" fill="#d7f7ff" stroke="#4e9ec2" strokeWidth="2">
          {Array.from({ length: 8 }, (_, i) => <path key={i} d="M0-26 11-6 7 22-7 16-12-5Z" transform={`translate(${90 + i * 111} ${i % 2 ? 270 : 77}) rotate(${i * 31}) scale(${.7 + i % 3 * .12})`} />)}
        </g>
      </svg>
    </div>
    <div className="ultimate-frost-lance-impact" data-phase="colossal-lance-shatter">
      <svg viewBox="-240 -240 480 480" aria-hidden="true" focusable="false">
        <g fill="#b3edff" stroke="#4b9fc3" strokeWidth="4">
          {Array.from({ length: 15 }, (_, i) => <g key={i} transform={`rotate(${i * 24})`}><path d="M-10 7-22-74 0-209 22-74 10 7Z" /><path d="M0-209V7L22-74Z" fill="#edfcff" stroke="none" /></g>)}
        </g>
        <path d="M0-86 28-24 94-36 44 23 53 94-11 49-72 94-43 18-95-26-29-30Z" fill="#f4fdff" stroke="#78d5ee" strokeWidth="5" />
      </svg>
    </div>
    <div className="ultimate-frost-lance-wave" data-phase="frost-wave">
      <svg viewBox="-500 -125 1000 250" aria-hidden="true" focusable="false">
        <g fill="none" stroke="#bcefff" strokeWidth="9"><ellipse rx="425" ry="81" /><ellipse rx="330" ry="56" strokeWidth="5" /><path d="M-425 0-346-17-308 6-244-20-160 4-111-15M111-15 160 4 244-20 308 6 346-17 425 0" stroke="#e9fcff" strokeWidth="5" /></g>
      </svg>
    </div>
    <svg className="ultimate-frost-lance-fragments" viewBox="0 0 1440 900" preserveAspectRatio="none" data-phase="large-frost-fragments" aria-hidden="true" focusable="false">
      <g fill="#caefff" stroke="#478fb4" strokeWidth="3">
        {Array.from({ length: 30 }, (_, i) => <g key={i} transform={`translate(${80 + i * 45} ${746 - i % 6 * 83}) rotate(${i * 29})`}><path d="M0-44 17-12 11 35-13 19-19-14Z" /><path d="M0-44V27L11 35 17-12Z" fill="#effdff" stroke="none" /></g>)}
      </g>
    </svg>
    <div className="ultimate-frost-lance-mist" />
  </div>;
}

/** Advanced forms and starter attack ultimates fill the battlefield. The two
 * card-derived summons rise above the temporarily subdued question UI.
 * The existing staff and impact still play beneath it. No game
 * state, animation timer or damage is owned by this presentation component. */
export function UltimateCinematic({ chapter, mode, cue, reducedMotion }: UltimateCinematicProps) {
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cue.startsWith('ultimate') || chapter < 1 || chapter > 6 || (mode === 'starter' && chapter === 3)) return null;
  const spell = getUltimateSpell(chapter, mode);
  const id = 'ultimate-field-' + instanceId;
  if (mode === 'starter') return chapter === 6
    ? <StarterFrostLance id={id} name={spell?.name ?? '寒晶冰矛'} cue={cue} reducedMotion={reducedMotion} />
    : <StarterCombatCinematic id={id} chapter={chapter} name={spell?.name ?? '主題魔法'} cue={cue} reducedMotion={reducedMotion} />;
  const colors = ['#54e9c0', '#8edcff', '#a1e27c', '#dab2ff', '#ffbb5a', '#a7eaff'];
  const accent = colors[chapter - 1];
  const fill = (name: string) => `url(#${id}-${name})`;
  const ornament = fill(chapter === 6 ? 'ice' : 'gold');
  const scope = chapter === 1 ? 'half' : 'full';
  const presentation = chapter === 5
    ? '烈焰鳳變大展翼，飛向右方對手，命中後火焰燃燒全場'
    : chapter === 6 ? '有角與冰晶翼的巨大冰龍飛向對手，命中碎冰炸裂，寒霜蔓延全場'
    : chapter === 1 ? '天穹城堡護盾先形成，城門發射巨大城堡徽印飛向對手，命中展開封印堡壘'
    : `${scope === 'half' ? '半屏' : '全場'}魔法展開`;
  const maskFaces = [[315, 405], [720, 435], [1115, 405]];
  const illustratedSummon = chapter === 5 || chapter === 6;
  return <div className={`ultimate-cinematic ultimate-theme-${chapter} scope-${scope}${illustratedSummon ? ' ultimate-illustrated-summon' : ''}${reducedMotion ? ' is-reduced' : ''}`}
    role="img" aria-label={`進階升級必殺技：${spell?.name ?? '主題魔法'}，${presentation}`}
    data-ultimate-tier="advanced" data-spell={chapter} data-cue={cue} data-scope={scope}
    style={illustratedSummon ? { '--ultimate-summon-duration': `${ULTIMATE_SUMMON_TIMING.durationMs}ms` } as CSSProperties : undefined}
    data-duration-ms={illustratedSummon ? ULTIMATE_SUMMON_TIMING.durationMs : undefined}
    data-impact-ms={illustratedSummon ? ULTIMATE_SUMMON_TIMING.impactMs : undefined}>
    <div className="ultimate-field-wash" style={{ '--ultimate-accent': accent } as CSSProperties} />
    <svg className="ultimate-field" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff7c4" /><stop offset=".45" stopColor="#ffda77" /><stop offset="1" stopColor="#b87822" /></linearGradient>
        <linearGradient id={`${id}-teal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b6fff1" /><stop offset=".35" stopColor="#4dccaf" /><stop offset="1" stopColor="#115369" /></linearGradient>
        <linearGradient id={`${id}-page`} x1="0" y1="0" x2=".6" y2="1"><stop stopColor="#fffbea" /><stop offset="1" stopColor="#ddc68e" /></linearGradient>
        <linearGradient id={`${id}-mirror`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f4f1ff" /><stop offset=".3" stopColor="#aecfff" /><stop offset=".5" stopColor="#e8bbff" /><stop offset="1" stopColor="#705ab2" /></linearGradient>
        <linearGradient id={`${id}-flame`} x1="0" y1="1" x2="0" y2="0"><stop stopColor="#b83928" /><stop offset=".4" stopColor="#ef7943" /><stop offset=".75" stopColor="#ffc65d" /><stop offset="1" stopColor="#fff7c4" /></linearGradient>
        <linearGradient id={`${id}-ice`} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#75c6e4" /><stop offset=".6" stopColor="#c1f6ff" /><stop offset="1" stopColor="#f3fdff" /></linearGradient>
        <radialGradient id={`${id}-canopy`}><stop stopColor="#e8ffc1" /><stop offset=".4" stopColor="#8ed9a6" /><stop offset="1" stopColor="#1e6c5d" /></radialGradient>
      </defs>
      <g className="ultimate-ground" fill="none" stroke={ornament} strokeWidth="5">
        <ellipse cx="720" cy="742" rx="640" ry="86" /><ellipse cx="720" cy="742" rx="560" ry="58" strokeWidth="2" />
        {Array.from({ length: 12 }, (_, i) => <path key={i} d={star} transform={`translate(${175 + i * 99} ${730 + (i % 2) * 22}) scale(.6)`} fill={ornament} stroke="none" />)}
      </g>
      {chapter === 1 && <g className="ultimate-main-shape ultimate-castle">
        <path className="ultimate-canopy" d="M125 730C165 70 1275 70 1315 730" fill="none" stroke="#a2ffe2" strokeWidth="14" />
        <path d="M169 725C200 130 1240 130 1271 725" fill="none" stroke={fill('gold')} strokeWidth="4" />
        <g fill={fill('teal')} stroke="#123f4a" strokeWidth="8" strokeLinejoin="round">
          <path d="M290 734V565H1150V734Z" /><path d="M287 734V341H470V734ZM623 734V219H817V734ZM970 734V341H1153V734Z" />
          <path d="M275 341V292H322V322H358V282H400V322H435V292H480V341ZM610 219V164H654V198H693V150H746V198H788V164H830V219ZM958 341V292H1003V322H1038V282H1080V322H1118V292H1166V341Z" />
        </g>
        <g fill={fill('gold')} stroke="#775727" strokeWidth="4"><path d="M655 733V553Q720 450 785 553V733Z" />
          {[378, 720, 1062].map((x, i) => <g key={x}><path d={`M${x - 22} ${i === 1 ? 327 : 450}v-45q22-35 44 0v45Z`} /><path d={star} transform={`translate(${x} ${i === 1 ? 263 : 382}) scale(.8)`} /></g>)}</g>
        <path d="M691 582V546Q720 510 749 546V582" fill="none" stroke="#1a6864" strokeWidth="12" /><rect x="681" y="578" width="78" height="76" rx="13" fill="#1a6864" />
        <path d="M707 616 718 627 739 601" stroke="#e1ffe9" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <g className="ultimate-orbit-seals" fill={fill('teal')} stroke={fill('gold')} strokeWidth="6">
          {[[-5, 480], [188, 390], [1260, 390], [1445, 480]].map(([x, y], i) => <g key={i} transform={`translate(${x} ${y})`}><path d="M-52-58 0-81 52-58 40 21 0 58-40 21Z" /><path d="M-22-8-4 10 25-22" fill="none" stroke="#fff7bd" strokeWidth="9" /></g>)}
        </g>
      </g>}
      {chapter === 2 && <g className="ultimate-main-shape ultimate-book-storm">
        <g className="ultimate-lightning" fill="none" stroke="#fff4b1" strokeWidth="11" strokeLinejoin="round">
          <path d="M90 140 282 323 204 362 365 590 261 625 385 760" /><path d="M1350 125 1185 313 1261 353 1114 568 1210 622 1087 769" />
          <path d="M626 95 698 205 645 230 750 365" /><path d="M941 110 871 241 935 282 854 395" />
        </g>
        <g className="ultimate-flying-pages" stroke="#ac7b35" strokeWidth="4" strokeLinejoin="round">
          {Array.from({ length: 12 }, (_, i) => {
            const side = i < 6 ? -1 : 1, n = i % 6;
            return <g key={i} className="ultimate-paper" style={{ '--piece-delay': `${n * .035}s` } as CSSProperties} transform={`translate(${720 + side * (265 + n * 67)} ${272 + (n % 3) * 135}) rotate(${side * (n * 8 - 15)})`}>
              <path d="M-35-51H35V51H-35Z" fill={fill('page')} /><path d="M-21-25H21M-21-9H12M-21 7H21" stroke="#98784b" strokeWidth="3" /><path d="M-12 29-2 38 15 20" stroke="#238b82" strokeWidth="5" fill="none" /></g>;
          })}
        </g>
        <g className="ultimate-great-book" stroke="#503f41" strokeWidth="9" strokeLinejoin="round">
          <path d="M405 388Q565 344 720 427Q875 344 1035 388L991 654Q870 622 720 691Q568 622 449 654Z" fill="#154659" />
          <path d="M438 362Q582 342 720 415Q858 342 1002 362L970 613Q836 599 720 661Q603 599 470 613Z" fill={fill('page')} />
          <path d="M720 415V661" fill="none" stroke="#c3a262" strokeWidth="5" />
          {[0, 1, 2, 3].map(i => <g key={i} stroke="#b69b65" strokeWidth="5"><path d={`M493 ${422 + i * 43}Q588 ${405 + i * 43} 675 ${456 + i * 43}`} /><path d={`M765 ${456 + i * 43}Q852 ${405 + i * 43} 947 ${422 + i * 43}`} /></g>)}
          <path d="M801 533 834 563 896 501" fill="none" stroke="#25878a" strokeWidth="13" />
        </g>
      </g>}
      {chapter === 3 && <g className="ultimate-main-shape ultimate-sorting-forest">
        <g stroke="#426a49" strokeWidth="24" strokeLinecap="round" fill="none">
          <path d="M306 744Q355 516 252 321M325 571 146 420M325 556 450 360M1134 744Q1085 516 1188 321M1115 571 1294 420M1115 556 990 360" />
        </g>
        <g fill={fill('canopy')} stroke="#285d42" strokeWidth="5">{[165, 360, 1078, 1275].map((x, i) => <path key={x} d={leaf} transform={`translate(${x} ${415 + (i % 2) * 55}) rotate(${i < 2 ? -30 : 30}) scale(2)`} />)}</g>
        <path className="ultimate-vine-path" d="M100 705C282 588 370 710 529 591S768 483 952 597S1219 585 1340 700" fill="none" stroke={fill('gold')} strokeWidth="9" />
        <g className="ultimate-sorted-cards" stroke="#315f50" strokeWidth="4">
          {Array.from({ length: 12 }, (_, i) => {
            const column = i % 3, row = Math.floor(i / 3), x = 555 + column * 165, y = 322 + row * 106;
            return <g key={i} className="ultimate-sort-piece" transform={`translate(${x} ${y})`} style={{ '--piece-delay': `${row * .06}s` } as CSSProperties}>
              <path d="M-56-40H56V40H-56Z" fill={['#c8f4c4', '#fff0b1', '#c5eafa'][column]} />
              {column === 0 ? <circle r="17" fill="#33856b" /> : column === 1 ? <rect x="-17" y="-17" width="34" height="34" rx="3" fill="#bd7d26" /> : <path d="M0-19 21 17H-21Z" fill="#527fb0" />}
            </g>;
          })}
        </g>
        <g className="ultimate-leaves" fill="#daf6ae" stroke="#437e57" strokeWidth="3">{Array.from({ length: 14 }, (_, i) => <path key={i} d={leaf} transform={`translate(${82 + i * 99} ${750 - (i % 3) * 60}) rotate(${i % 2 ? 42 : -42}) scale(.7)`} />)}</g>
      </g>}
      {chapter === 4 && <g className="ultimate-main-shape ultimate-mirror-hall">
        <g className="ultimate-false-faces" fill="#866ab2" stroke="#2a345e" strokeWidth="5">
          {maskFaces.map(([x, y]) => <g key={x} transform={`translate(${x} ${y})`}><path d="M-75-55-34-78 0-57 34-78 75-55 57 49 0 77-57 49Z" /><path d="M-45-19-14-11M14-11 45-19M-25 40Q0 19 25 40" fill="none" /><path d="M0-57-12-4 11 14-5 77" stroke="#fff2b3" fill="none" /></g>)}
        </g>
        <g className="ultimate-mirrors" stroke={fill('gold')} strokeWidth="9" strokeLinejoin="round">
          {Array.from({ length: 7 }, (_, i) => {
            const x = 112 + i * 203, y = 486 + Math.abs(i - 3) * 23;
            return <g key={i} className="ultimate-mirror" style={{ '--piece-delay': `${Math.abs(i - 3) * .05}s` } as CSSProperties} transform={`translate(${x} ${y}) rotate(${(i - 3) * 7})`}>
              <path d="M0-228 84-155 84 145 0 228-84 145-84-155Z" fill="#382c69" /><path d="M0-202 63-144 63 135 0 197-63 135-63-144Z" fill={fill('mirror')} strokeWidth="4" />
              <path d="M-42 98 42-117M-44 35 18-121" stroke="#fff8f8" strokeWidth="6" opacity=".65" />
              <path d={star} transform="translate(0 -170) scale(.65)" fill="#fff6b2" stroke="none" />
              <path d="M-27 10-6 32 35-18" fill="none" stroke="#295d73" strokeWidth="11" strokeLinecap="round" /></g>;
          })}
        </g>
      </g>}
      <g className="ultimate-edge-stars" fill={ornament}>
        {Array.from({ length: 18 }, (_, i) => <path key={i} d={star} className="ultimate-star" style={{ '--piece-delay': `${(i % 5) * .035}s` } as CSSProperties} transform={`translate(${45 + i * 80} ${220 + (i % 4) * 130}) scale(${.35 + i % 3 * .14})`} />)}
      </g>
    </svg>
    {chapter === 1 && <CastleProjection id={id} upgraded />}
    {chapter === 5 && <PhoenixProjectile id={id} illustrated />}
    {chapter === 6 && <IceDragonProjectile id={id} />}
    <div className="ultimate-tier-banner"><span>技能升級 · 進階必殺</span><strong>{spell?.name}</strong></div>
  </div>;
}
