import { useId, type CSSProperties } from 'react';
import type { Mode } from '../domain/types';
import { getUltimateSpell } from '../content/ultimateSpells';
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

/** Keep the bird's proportions while its HTML anchor travels between the same
 * left/right actor lanes as the arena. Contact is at 900 ms, when HP changes. */
function PhoenixProjectile({ id }: { id: string }) {
  const fire = `url(#${id}-phoenix-fire)`;
  return <div className="ultimate-phoenix" data-sequence="summon-grow-flight-impact-burn">
    <div className="ultimate-phoenix-flight" data-phase="summon-grow-flight">
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
    </div>
    <div className="ultimate-phoenix-impact" data-phase="enemy-impact">
      <svg viewBox="-240 -240 480 480" aria-hidden="true" focusable="false">
        <circle className="ultimate-fire-impact-ring" r="102" fill="#fff1a037" stroke="#ffe79b" strokeWidth="12" />
        <path d="M0-180 31-80 105-141 76-42 185-29 87 14 137 117 40 70 0 188-36 77-133 132-77 34-182-15-83-44-110-144-34-81Z" fill="#ffd887" stroke="#f88937" strokeWidth="10" />
        <path d="M0-100 20-38 80-27 38 19 47 85-9 47-66 88-46 19-104-22-35-39Z" fill="#fff8d2" />
      </svg>
    </div>
    <div className="ultimate-phoenix-screen-blaze" data-phase="full-battlefield-burn" />
    <svg className="ultimate-phoenix-burn" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs><linearGradient id={`${id}-screen-flame`} x1="0" y1="1" x2="0" y2="0"><stop stopColor="#b73523" stopOpacity=".72" /><stop offset=".4" stopColor="#f27831" stopOpacity=".86" /><stop offset=".76" stopColor="#ffca67" stopOpacity=".68" /><stop offset="1" stopColor="#fff3b6" stopOpacity=".15" /></linearGradient></defs>
      <g className="ultimate-phoenix-fire-front" fill={`url(#${id}-screen-flame)`}>
        {Array.from({ length: 16 }, (_, i) => <path key={i} className="ultimate-screen-flame" style={{ '--flame-height': `${.78 + (i % 4) * .11}` } as CSSProperties}
          d={`M${i * 96 - 60} 900C${i * 96 - 108} 691 ${i * 96 + 10} 704 ${i * 96 - 5} ${355 + (i % 4) * 66}C${i * 96 + 112} ${542 + (i % 3) * 54} ${i * 96 + 69} 599 ${i * 96 + 100} 680C${i * 96 + 142} 576 ${i * 96 + 162} 669 ${i * 96 + 174} 900Z`} />)}
      </g>
      <g className="ultimate-phoenix-fire-embers" fill="#ffe4a2">
        {Array.from({ length: 25 }, (_, i) => <path key={i} d={feather} transform={`translate(${31 + i * 59} ${790 - (i % 5) * 99}) rotate(${(i % 3 - 1) * 34}) scale(${.07 + (i % 4) * .015})`} />)}
      </g>
    </svg>
  </div>;
}

/** A horned, winged ice dragon crosses the actor lanes before the ice field
 * spreads. Independent percentage anchors preserve its silhouette on tablets. */
function IceDragonProjectile({ id }: { id: string }) {
  const ice = `url(#${id}-dragon-ice)`, edge = '#317da9';
  return <div className="ultimate-ice-dragon" data-sequence="ice-gather-dragon-flight-impact-frost">
    <div className="ultimate-ice-dragon-flight" data-phase="ice-dragon-flight">
      <svg viewBox="0 0 1440 900" aria-hidden="true" focusable="false">
        <defs><linearGradient id={`${id}-dragon-ice`} x1="0" y1="1" x2=".6" y2="0"><stop stopColor="#287aaf" /><stop offset=".36" stopColor="#79d6ee" /><stop offset=".68" stopColor="#c8f8ff" /><stop offset="1" stopColor="#f7feff" /></linearGradient></defs>
        <g className="ultimate-ice-dragon-wake" fill="none" stroke="#c4f4ff" strokeWidth="14" strokeLinecap="round">
          <path d="M560 576C391 524 247 613 61 594M546 627C337 652 186 746 40 702" />
        </g>
        <g className="ultimate-ice-dragon-wing rear" fill={ice} stroke={edge} strokeWidth="5" strokeLinejoin="round">
          <path d="M676 545 962 164 899 306 1124 245 1000 397 1134 428 853 521 792 653Z" />
          <path d="M676 545 962 164M676 545 1124 245M676 545 1134 428" fill="none" stroke="#e3fbff" strokeWidth="9" />
        </g>
        <g className="ultimate-ice-dragon-body" fill={ice} stroke={edge} strokeWidth="7" strokeLinejoin="round">
          <path d="M782 479C714 454 643 488 580 553C491 621 387 583 291 607C216 626 137 648 67 587L195 723 326 679C435 653 492 766 642 710C712 685 772 621 816 565Z" />
          <path d="M322 624 267 562 368 599 394 538 447 617 499 568 545 628 615 568 632 642" fill="#d6faff" />
          <path d="M610 660 584 756 701 788 711 763 640 735 655 682M756 605 791 716 884 725 892 698 834 682 815 597" />
          <path d="M688 764 740 778 697 790M874 699 919 715 884 728" fill="#f0fdff" />
          <path d="M741 486 756 389 813 344 892 383 914 438 1021 454 973 516 874 558 796 541Z" />
          <path className="ultimate-ice-dragon-horns" d="M784 376 737 242 833 349M858 373 903 257 902 403" fill="#e1fbff" />
          <path d="M859 432 899 427 875 450Z" fill="#173754" stroke="none" />
          <path d="M881 499 958 476M922 490 920 507 935 491 941 504" fill="none" stroke="#275d80" strokeWidth="5" />
          <path d="M769 452 813 399 861 406M464 649 543 673 614 652 693 596" fill="none" stroke="#f1fdff" strokeWidth="8" opacity=".8" />
        </g>
        <g className="ultimate-ice-dragon-wing front" fill={ice} stroke={edge} strokeWidth="5" strokeLinejoin="round">
          <path d="M640 584 458 132 452 292 272 199 343 382 187 392 494 539 559 670Z" />
          <path d="M640 584 458 132M640 584 272 199M640 584 187 392" fill="none" stroke="#e8fcff" strokeWidth="10" />
          <path d="M458 132 452 292 525 359M272 199 343 382 457 442" fill="none" stroke="#a6edfa" strokeWidth="4" />
        </g>
      </svg>
    </div>
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

/** The advanced form fills the battlefield, under the question and answer UI.
 * The existing 3D staff, projectile and impact still play beneath it. No game
 * state, animation timer or damage is owned by this presentation component. */
export function UltimateCinematic({ chapter, mode, cue, reducedMotion }: UltimateCinematicProps) {
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  if (mode !== 'advanced' || !cue.startsWith('ultimate') || chapter < 1 || chapter > 6) return null;
  const spell = getUltimateSpell(chapter, mode);
  const id = 'ultimate-field-' + instanceId;
  const colors = ['#54e9c0', '#8edcff', '#a1e27c', '#dab2ff', '#ffbb5a', '#a7eaff'];
  const accent = colors[chapter - 1];
  const fill = (name: string) => `url(#${id}-${name})`;
  const ornament = fill(chapter === 6 ? 'ice' : 'gold');
  const scope = chapter === 1 ? 'half' : 'full';
  const presentation = chapter === 5
    ? '烈焰鳳變大展翼，飛向右方對手，命中後火焰燃燒全場'
    : chapter === 6 ? '有角與冰晶翼的巨大冰龍飛向對手，命中碎冰炸裂，寒霜蔓延全場'
    : `${scope === 'half' ? '半屏' : '全場'}魔法展開`;
  const maskFaces = [[315, 405], [720, 435], [1115, 405]];
  return <div className={`ultimate-cinematic ultimate-theme-${chapter} scope-${scope}${reducedMotion ? ' is-reduced' : ''}`}
    role="img" aria-label={`進階升級必殺技：${spell?.name ?? '主題魔法'}，${presentation}`}
    data-ultimate-tier="advanced" data-spell={chapter} data-cue={cue} data-scope={scope}>
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
    {chapter === 5 && <PhoenixProjectile id={id} />}
    {chapter === 6 && <IceDragonProjectile id={id} />}
    <div className="ultimate-tier-banner"><span>技能升級 · 進階必殺</span><strong>{spell?.name}</strong></div>
  </div>;
}
