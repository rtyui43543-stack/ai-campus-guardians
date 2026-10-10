import { useId, useState, type CSSProperties } from 'react';
import type { Mode } from '../domain/types';
import { getUltimateSpell } from '../content/ultimateSpells';
import { ULTIMATE_SUMMON_ART, ULTIMATE_SUMMON_TIMING, summonImageSource, recoverSummonImageSource, type UltimateSummonKind } from './ultimateSummons';
import '../styles/ultimate-cinematic.css';
import { CardBook, CardCastle, CardCrystalLance, CardFireFeather, CardIndexPage, CardLeaf, CardLeafPuzzle, CardMirror, CardMirrorFragment, CardPuzzleHeart } from './ultimateCardForms';

export interface UltimateCinematicProps {
  chapter: number;
  mode: Mode;
  cue: string;
  reducedMotion: boolean;
}

const star = 'M0-18 5-5 18 0 5 5 0 18-5 5-18 0-5-5Z';
const feather = 'M0 0C-18-35-33-96 0-170C35-96 22-34 0 0Z';

function IllustratedSummon({ kind, phase }: { kind: UltimateSummonKind; phase: string }) {
  const art = ULTIMATE_SUMMON_ART[kind];
  // The cue remounts this component. Pick once so a late full-size download
  // never makes the creature appear or change resolution halfway through flight.
  const [source, setSource] = useState(() => summonImageSource(kind));
  return <div className={`ultimate-summon-flight ultimate-summon-${kind}`} data-phase={phase} data-summon-art={kind}>
    <div className="ultimate-summon-wake" aria-hidden="true" />
    <img className="ultimate-summon-creature" src={source} width={art.width} height={art.height} alt="" aria-hidden="true" loading="eager" fetchPriority="high" decoding="sync" draggable={false}
      onError={() => setSource(recoverSummonImageSource(kind))} />
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
  return <div className={`ultimate-castle-projection card-matched-castle${upgraded ? ' is-upgraded' : ''}`} data-sequence="castle-shield-crest-flight-seal-impact">
    <div className="ultimate-castle-charge" data-phase="castle-shield-charge"><svg viewBox="-300 -280 600 560" aria-hidden="true"><g className="ultimate-castle-summon"><CardCastle id={`${id}-charge`} advanced={upgraded} /></g></svg></div>
    <div className="ultimate-castle-crest-flight" data-phase="castle-crest-flight"><svg viewBox="-300 -280 600 560" aria-hidden="true"><g className="ultimate-castle-crest"><CardCastle id={`${id}-crest`} advanced={upgraded} /></g></svg></div>
    <div className="ultimate-castle-seal-impact" data-phase="castle-seal-impact"><svg viewBox="-300 -280 600 560" aria-hidden="true"><CardCastle id={`${id}-seal`} advanced={upgraded} /><g className="ultimate-castle-brick-burst" fill="#fff1b8" stroke="#ebc66d" strokeWidth="2">{Array.from({ length: 12 }, (_, i) => <path key={i} d={star} transform={`rotate(${i*30}) translate(0 -245) scale(.6)`} />)}</g></svg></div>
  </div>;
}

function IndexProjection({ id }: { id: string }) {
  return <div className="ultimate-index-projection" data-sequence="great-book-charge-pages-flight-lightning-impact">
    <div className="ultimate-index-book-charge" data-phase="great-book-charge"><svg viewBox="-260 -250 520 500" aria-hidden="true"><g className="ultimate-index-open-pages"><CardBook id={`${id}-charge`} /></g><path d="M-180-130-212-71-180-45-221 42M174-148 213-99 185-68 228 19" fill="none" stroke="#c9f6ff" strokeWidth="8" /></svg></div>
    <div className="ultimate-index-scroll-flight" data-phase="thunder-book-flight"><svg viewBox="-260 -250 520 500" aria-hidden="true"><g className="ultimate-thunder-book"><CardBook id={`${id}-flight`} /></g><g className="ultimate-index-orbit-pages">{Array.from({ length: 8 }, (_, i) => <g key={i} transform={`rotate(${i*45}) translate(0 -200) rotate(${-i*45})`}><CardIndexPage /></g>)}</g></svg></div>
    <div className="ultimate-index-lightning-impact" data-phase="branching-lightning-impact"><svg viewBox="-320 -310 640 620" aria-hidden="true"><g className="ultimate-index-hit-bolts" fill="none" stroke="#cef5ff" strokeWidth="8">{Array.from({ length: 7 }, (_,i)=><path key={i} d="M0-278 31-198 2-171 31-87-6 0" transform={`rotate(${i*360/7})`} />)}</g><g className="ultimate-index-hit-pages">{Array.from({ length: 12 },(_,i)=><g key={i} transform={`rotate(${i*30}) translate(0 -187) rotate(${i*9})`}><CardIndexPage /></g>)}</g><g transform="scale(.65)"><CardBook id={`${id}-impact`} check /></g></svg></div><div className="ultimate-index-storm-wash" />
  </div>;
}

function MirrorProjection({ id }: { id: string }) {
  return <div className="ultimate-mirror-projection" data-sequence="gemmed-mirror-array-flight-mask-shatter">
    <div className="ultimate-mirror-array-charge" data-phase="mirror-array-charge"><svg viewBox="-280 -280 560 560" aria-hidden="true">{[-2,-1,0,1,2].map((i)=><g key={i} transform={`translate(${i*88} ${Math.abs(i)*24-20}) scale(${i===0?.86:.5})`}><CardMirror id={`${id}-orbit-${i}`} falseFace={i===-2} /></g>)}</svg></div>
    <div className="ultimate-mirror-blade-flight" data-phase="gemmed-mirror-flight"><svg viewBox="-250 -270 500 540" aria-hidden="true"><g className="ultimate-colossal-mirror-blade" transform="scale(1.15)"><CardMirror id={`${id}-flight`} /></g></svg></div>
    <div className="ultimate-mirror-mask-impact" data-phase="false-mask-shatter"><svg viewBox="-300 -280 600 560" aria-hidden="true"><g className="ultimate-card-mask-break"><CardMirror id={`${id}-impact`} falseFace /></g><g className="ultimate-mirror-hit-fragments">{Array.from({length:18},(_,i)=><g key={i} transform={`rotate(${i*20}) translate(0 -222) rotate(${i*11})`}><CardMirrorFragment /></g>)}</g></svg></div><div className="ultimate-mirror-prism-wash" />
  </div>;
}

function LeafHeartProjection() {
  return <div className="ultimate-leaf-heart-projection" data-sequence="leaf-puzzle-heart-recovery" data-phase="leaf-heart-recovery">
    <svg viewBox="-330 -280 660 560" aria-hidden="true"><g className="ultimate-leaf-heart"><CardPuzzleHeart /></g><g className="ultimate-heart-puzzle-orbit">{Array.from({length:8},(_,i)=><g key={i} transform={`rotate(${i*45}) translate(0 -214) rotate(${-i*45}) scale(.45)`}><CardLeafPuzzle kind={i%3} /></g>)}</g><g fill="none" stroke="#eddf90" strokeWidth="4"><ellipse cy="195" rx="255" ry="34"/><ellipse cy="195" rx="219" ry="22"/></g></svg>
  </div>;
}

function StarterPhoenixProjection({ id }: { id: string }) {
  return <div className="ultimate-starter-phoenix" data-sequence="fire-feather-array-phoenix-flight-flame-impact">
    <div className="ultimate-starter-fire-array" data-phase="fire-feather-array">
      <svg viewBox="-250 -250 500 500" aria-hidden="true" focusable="false">
        <path d="M0-167 145-83 145 83 0 167-145 83-145-83Z" fill="none" stroke="#efb55d" strokeWidth="6" />
        <g>{Array.from({ length: 12 }, (_, i) => <g key={i} transform={`rotate(${i * 30}) translate(0 -205) rotate(180) scale(.42)`}><CardFireFeather /></g>)}</g>
        <g transform="translate(0 80) scale(1.05)"><CardFireFeather /></g>
      </svg>
    </div>
    <PhoenixProjectile id={id} fieldBurn={false} illustrated />
    <div className="ultimate-starter-fire-impact" data-phase="fire-feather-burst">
      <svg viewBox="-320 -300 640 600" aria-hidden="true" focusable="false">
        <g className="ultimate-starter-fire-plumes">{Array.from({ length: 13 }, (_, i) => <g key={i} transform={`rotate(${i * 360 / 13}) translate(0 -72) scale(.85 1.2)`}><CardFireFeather /></g>)}</g>
        <g className="ultimate-starter-fire-fragments">{Array.from({ length: 18 }, (_, i) => <g key={i} transform={`rotate(${i * 20}) translate(0 -251) rotate(180) scale(.21)`}><CardFireFeather /></g>)}</g>
      </svg>
    </div>
    <div className="ultimate-starter-fire-wash" />
  </div>;
}

function StarterCombatCinematic({ id, chapter, name, cue, reducedMotion }: { id: string; chapter: number; name: string; cue: string; reducedMotion: boolean }) {
  const descriptions: Record<number, string> = {
    1: '先形成城堡護盾，再從城門發射城堡徽印，命中對手形成封印堡壘',
    2: '深藍查證書蓄力打開，書頁帶著藍白雷電飛向對手',
    3: '綠葉與金色拼圖聚成愛心，在主角身邊展開恢復光環',
    4: '鏡片結陣召喚巨大鏡刃，飛向對手擊破假面，碎鏡爆散',
    5: '火羽召喚陣組成大鳳凰，飛向對手，命中後火焰與火羽爆裂',
  };
  return <div className={`ultimate-cinematic ultimate-theme-${chapter} ultimate-starter-combat scope-full${reducedMotion ? ' is-reduced' : ''}`}
    role="img" aria-label={`初階必殺技：${name}，${descriptions[chapter]}`}
    data-ultimate-tier="starter" data-spell={chapter} data-cue={cue} data-scope="full">
    {chapter === 1 && <CastleProjection id={id} />}
    {chapter === 2 && <IndexProjection id={id} />}
    {chapter === 3 && <LeafHeartProjection />}
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
  return <div className={`ultimate-cinematic ultimate-theme-6 ultimate-starter-frost scope-full${reducedMotion ? ' is-reduced' : ''}`}
    role="img" aria-label={`初階必殺技：${name}，召喚雪花冰晶陣，四道菱晶冰矛飛向對手，命中後碎冰與霜浪展開`}
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
        <g className="ultimate-colossal-ice-lance" transform="translate(675 165) scale(1.65)"><CardCrystalLance /></g>
        <g className="ultimate-companion-ice-lances">{[[-190,-68,.83],[-220,63,.72],[-60,102,.62]].map(([x,y,size],i)=><g key={i} transform={`translate(${620+x} ${150+y}) scale(${size})`}><CardCrystalLance /></g>)}</g>
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
  if (!cue.startsWith('ultimate') || chapter < 1 || chapter > 6) return null;
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
      {chapter === 1 && <g className="ultimate-main-shape ultimate-castle"><g transform="translate(720 448) scale(1.37)"><CardCastle id={`${id}-sky`} advanced /></g></g>}
      {chapter === 2 && <g className="ultimate-main-shape ultimate-book-storm">
        <g className="ultimate-lightning" fill="none" stroke="#d5f7ff" strokeWidth="9"><path d="M90 140 282 323 204 362 365 590 261 625 385 760M1350 125 1185 313 1261 353 1114 568 1210 622 1087 769M626 95 698 205 645 230 750 365M941 110 871 241 935 282 854 395" /></g>
        <g className="ultimate-flying-pages">{Array.from({length:10},(_,i)=>{const angle=i*Math.PI*2/10; return <g key={i} className="ultimate-paper" style={{'--piece-delay':`${i*.012}s`} as CSSProperties} transform={`translate(${720+Math.cos(angle)*505} ${470+Math.sin(angle)*253}) rotate(${Math.sin(angle)*17}) scale(.55)`}><CardBook id={`${id}-orbit-book-${i}`} check={i%2===0}/></g>;})}</g>
        <g className="ultimate-great-book"><g transform="translate(720 461) scale(1.72)"><CardBook id={`${id}-great-book`} /></g></g>
      </g>}
      {chapter === 3 && <g className="ultimate-main-shape ultimate-sorting-forest">
        <path className="card-forest-trunk" d="M699 763Q676 570 618 448Q505 327 350 228M710 661Q812 481 1088 307M688 492Q747 303 695 124M719 717Q481 567 232 555M738 626Q1010 570 1195 586" fill="none" stroke="#826b40" strokeWidth="48" strokeLinecap="round" />
        <path d="M701 758Q695 417 695 160M349 242Q605 436 699 620M701 657Q950 531 1090 320" fill="none" stroke="#b9f6c480" strokeWidth="26" />
        <g className="ultimate-vine-path" fill="none" stroke="#f1d684" strokeWidth="12"><path d="M198 313C575 176 487 512 1082 339M210 557C610 439 696 754 1231 569M229 710Q659 554 1120 666" /></g>
        <g className="ultimate-sorted-cards">{[-1,0,1].map((column)=><g key={column} className="ultimate-sort-piece" transform={`translate(${720+column*164} ${239+Math.abs(column)*33}) scale(1.85)`}><CardLeafPuzzle kind={column+1} /></g>)}</g>
        <g className="card-botanical-branches">{[[295,370,0],[1154,390,2],[340,622,1],[1100,641,0]].map(([x,y,k],i)=><g key={i} transform={`translate(${x} ${y})`}><circle r="49" fill="#937746" stroke="#f5df95" strokeWidth="6" /><g transform="scale(.66)"><CardLeaf kind={k} /></g></g>)}</g>
        <g className="ultimate-leaves">{Array.from({length:20},(_,i)=><g key={i} transform={`translate(${210+i%7*170} ${233+Math.floor(i/7)*187}) rotate(${i*41}) scale(.68)`}><CardLeaf kind={i%3} /></g>)}</g>
      </g>}
      {chapter === 4 && <g className="ultimate-main-shape ultimate-mirror-hall">
        <g className="ultimate-mirrors">{Array.from({length:7},(_,i)=>{const x=145+i*192,y=452+Math.abs(i-3)*39;return <g key={i} className="ultimate-mirror" style={{'--piece-delay':`${Math.abs(i-3)*.035}s`} as CSSProperties} transform={`translate(${x} ${y}) rotate(${(i-3)*6}) scale(${i===3?1.27:.91})`}><CardMirror id={`${id}-hall-${i}`} falseFace={i===0||i===6}/></g>;})}</g>
        <g className="ultimate-false-faces card-false-mirror-fragments" fill="#8960b9" stroke="#e7c3ff" strokeWidth="2">{Array.from({length:28},(_,i)=><path key={i} d="M0-28 16-5 5 24-15 9Z" transform={`translate(${i<14?108+(i%4)*28:1248+(i%4)*28} ${285+(i%7)*66}) rotate(${i*28})`} />)}</g>
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
