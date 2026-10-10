import { useId } from 'react';

/** Card-derived silhouettes and materials shared by summon, flight and contact. */
const gem = 'M0-18 11-3 0 18-11-3Z';
const star = 'M0-18 5-5 18 0 5 5 0 18-5 5-18 0-5-5Z';
const puzzle = 'M-48-45H-14C-26-72 24-72 12-45H48V-13C75-25 75 24 48 12V45H12C25 18-25 18-12 45H-48V12C-21 24-21-24-48-12Z';
const heart = 'M0 144C-42 103-151 44-161-44C-171-130-60-168 0-84C60-168 171-130 161-44C151 44 42 103 0 144Z';
function useMaterialId(prefix: string) { return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`; }
function GoldMaterial({ id }: { id: string }) {
  return <linearGradient id={id} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#fff5c5" /><stop offset=".22" stopColor="#e7b649" /><stop offset=".45" stopColor="#fff1a1" /><stop offset=".67" stopColor="#b78028" /><stop offset=".87" stopColor="#f5d26c" /><stop offset="1" stopColor="#fff4b4" /></linearGradient>;
}

export function CardLeaf({ kind = 0 }: { kind?: number }) {
  const id = useMaterialId('card-leaf');
  const paths = ['M0 45C-60 6-43-37 0-54C45-25 49 10 0 45Z', 'M0 45-8 15-37 23-26-1-47-16-22-23-21-48-1-31 17-53 24-24 47-18 28 2 40 20 11 14Z', 'M0 45-4 12C-62 23-60-19-41-42C-28-58-9-47 0-40C14-54 32-54 44-35C62-7 45 23 4 12Z'];
  return <g className="card-veined-leaf" data-card-material="leaf-gold" stroke="#ddeb8b" strokeWidth="2.5" strokeLinejoin="round">
    <defs><linearGradient id={id} x2=".8" y2="1"><stop stopColor={kind === 2 ? '#fff19a' : '#b6dc58'} /><stop offset=".35" stopColor={kind === 2 ? '#d8b93b' : '#4f9b39'} /><stop offset=".72" stopColor={kind === 2 ? '#7f902d' : '#205c35'} /><stop offset="1" stopColor="#97c452" /></linearGradient></defs>
    <path d={paths[kind % 3]} fill={`url(#${id})`} /><path d={paths[kind % 3]} transform="translate(1 -1) scale(.91)" fill="none" stroke="#f4e6a4" strokeWidth="1" opacity=".65" />
    <path d="M0 40V-34M0 4-23-13M0-10 22-28M0 17 24-2M0-22-16-35M0 29-15 15" fill="none" stroke="#eada85" strokeWidth="1.8" />
    <path d="M-5 28Q-22 6-24-14" fill="none" stroke="#e9ffc1" strokeWidth="3" opacity=".55" />
  </g>;
}

export function CardLock() {
  const id = useMaterialId('card-lock');
  return <g className="card-lock" fill={`url(#${id})`} stroke="#fff1a8" strokeWidth="3"><defs><GoldMaterial id={id} /></defs><path d="M-15 0V-15A15 15 0 0 1 15-15V0" fill="none" strokeWidth="6" /><rect x="-25" y="-2" width="50" height="43" rx="7" /><path d="M-20 3H19M-20 3V34" fill="none" stroke="#fffadd" strokeWidth="2" /><circle cy="13" r="6" fill="#675729" stroke="none" /><path d="M-3 15H3L5 29H-5Z" fill="#675729" stroke="none" /></g>;
}

export function CardCastle({ id, advanced = false }: { id: string; advanced?: boolean }) {
  const wall = `url(#${id}-wall)`, gold = `url(#${id}-gold)`;
  return <g className={advanced ? 'card-sky-castle' : 'card-crystal-castle'} data-card-material={advanced ? 'ivory-gold-sky-dome' : 'transparent-crystal-gold'} strokeLinejoin="round">
    <defs><GoldMaterial id={`${id}-gold`} /><linearGradient id={`${id}-wall`} x1="0" y1="0" x2="1" y2=".6"><stop stopColor={advanced ? '#fff9e0' : '#dbfffa'} /><stop offset=".22" stopColor={advanced ? '#e6d4a2' : '#52cbd9'} /><stop offset=".48" stopColor={advanced ? '#fff4cf' : '#d1fff5'} /><stop offset=".74" stopColor={advanced ? '#c9b984' : '#2cabbd'} /><stop offset="1" stopColor={advanced ? '#fff8de' : '#97eee9'} /></linearGradient><linearGradient id={`${id}-roof`} x2="1" y2=".3"><stop stopColor={advanced ? '#1e79ac' : '#85edf0'} /><stop offset=".45" stopColor={advanced ? '#145879' : '#2cb0c9'} /><stop offset="1" stopColor={advanced ? '#092f54' : '#087f9b'} /></linearGradient></defs>
    {advanced && <g className="card-sky-dome" fill="#b2f5ff16" stroke="#bdfaff" strokeWidth="3"><path d="M-252 170V20A252 252 0 0 1 252 20V170Z" /><path d="M-248 20Q0-185 248 20M-220-94Q0-17 220-94M-240 94Q0 22 240 94M-166-182Q-91 0-176 167M0-231V170M166-182Q91 0 176 167" fill="none" /><g strokeWidth="1.5" opacity=".8">{[-1,1].map(side => [0,1,2].map(i => <path key={`${side}-${i}`} d="M0-20 18-10V10L0 20-18 10V-10Z" transform={`translate(${side*(170+i%2*32)} ${-100+i*90}) scale(1.5)`} />))}</g></g>}
    {advanced && <g className="card-floating-foundation"><path d="M-207 141 206 141 159 188 115 190 65 220 21 199-32 220-93 190-150 182Z" fill="#729b8c" stroke="#dbc58b" strokeWidth="4" /><path d="M-180 157-99 179-60 173-31 198 21 175 65 201 120 174 181 157" fill="none" stroke="#d4ebbd" strokeWidth="6" opacity=".65" /></g>}
    <path d="M-206 151V37H206V151Z" fill={wall} fillOpacity={advanced ? 1 : .52} stroke={gold} strokeWidth="5" />
    {[-2,-1,0,1,2].map((column) => {
      const x = column * 84, top = -110 + Math.abs(column) * 44, width = column === 0 ? 70 : 54;
      return <g key={column} className="card-pointed-tower" transform={`translate(${x} 0)`}>
        <path d={`M${-width/2} 150V${top}H${width/2}V150Z`} fill={wall} fillOpacity={advanced ? 1 : .65} stroke={gold} strokeWidth="4" />
        <path d={`M${-width/2-10} ${top} 0 ${top-92} ${width/2+10} ${top}Z`} fill={`url(#${id}-roof)`} stroke={gold} strokeWidth="4" />
        <path d={`M0 ${top-91} 3 ${top}M${-width/2+5} ${top+6}V140`} fill="none" stroke="#effffc" strokeWidth="3" opacity={advanced ? .5 : .8} />
        <path d={`M0 ${top-100}V${top-123}`} stroke="#ffde73" strokeWidth="4" /><path d={star} fill="#fff2b1" stroke="#dca844" strokeWidth="1" transform={`translate(0 ${top-120}) scale(.35)`} />
        <path d={`M-10 ${top+57}V${top+30}Q0 ${top+15} 10 ${top+30}V${top+57}Z`} fill={advanced ? '#285b74' : '#cefff5'} stroke={gold} strokeWidth="2" />
        {[0,1,2].map(row => <path key={row} d={`M${-width/2} ${top+75+row*30}H${width/2}`} fill="none" stroke={advanced ? '#d4b967' : '#e4fff8'} strokeWidth="2" opacity=".75" />)}
        <path d={`M0 ${top}V150`} fill="none" stroke="#fff6b8" strokeWidth="1.5" opacity=".65" />
        {advanced && <path d={`M-14 ${top+80}H14V${top+145}L0 ${top+130}-14 ${top+145}Z`} fill="#15557f" stroke={gold} strokeWidth="2" />}
      </g>;
    })}
    <path d="M-37 151V112A37 37 0 0 1 37 112V151Z" fill={advanced ? '#276579' : '#83ebdf52'} stroke={gold} strokeWidth="5" />
    <g className="card-keyhole-shield" transform="translate(0 83)"><path d="M-55-49Q0-56 0-76Q0-56 55-49L48 14Q31 48 0 65Q-31 48-48 14Z" fill={gold} stroke="#fff7c4" strokeWidth="5" /><path d="M-41-38Q0-45 0-58Q0-45 41-38L35 8Q22 34 0 47Q-22 34-35 8Z" fill="#c8903355" stroke="#ffe698" strokeWidth="2" />{advanced ? <><circle cy="-5" r="30" fill="#1e66815c" stroke="#ffe698" strokeWidth="2" /><path d={star} transform="translate(0 -5) scale(1.6)" fill="#fff1a9" /></> : <><circle cy="-12" r="13" fill="#567665" /><path d="M-7-7H7L11 21H-11Z" fill="#567665" /></>}</g>
    <g fill="none" stroke="#fff0a9" strokeWidth="3" opacity=".8"><ellipse cy="141" rx="238" ry="34" /><ellipse cy="-8" rx="220" ry="29" transform="rotate(-14)" /></g>
    {!advanced && <g className="card-crystal-reflections" fill="#f5ffdb" opacity=".85">{[-2,-1,0,1,2].map((column)=><path key={column} d={star} transform={`translate(${column*75} ${column%2 ? 68 : -22}) scale(.32)`} />)}</g>}
    {advanced && [-1,1].map(side => <g key={side} transform={`translate(${side*235} -20) scale(.72)`}><circle r="46" fill="#70ddff22" stroke={gold} strokeWidth="4" /><g transform="translate(0 -12)"><CardLock /></g></g>)}
  </g>;
}

export function CardBook({ id, check = false }: { id: string; check?: boolean }) {
  const gold = `url(#${id}-gold)`;
  return <g className="card-navy-index-book" data-card-material="navy-leather-gold-ivory-pages" strokeLinejoin="round">
    <defs><GoldMaterial id={`${id}-gold`} /><linearGradient id={`${id}-paper`} x2=".3" y2="1"><stop stopColor="#fffdeb" /><stop offset=".35" stopColor="#f5e8c2" /><stop offset=".75" stopColor="#d4b785" /><stop offset="1" stopColor="#ffefca" /></linearGradient><linearGradient id={`${id}-cover`} x2="1" y2=".5"><stop stopColor="#2f527a" /><stop offset=".5" stopColor="#142a48" /><stop offset="1" stopColor="#29405d" /></linearGradient><radialGradient id={`${id}-lens`} cx=".32" cy=".25"><stop stopColor="#c4e9ff" /><stop offset=".3" stopColor="#5a819c" /><stop offset="1" stopColor="#24394d" /></radialGradient></defs>
    <path d="M-153-70Q-70-108 0-61Q70-108 153-70L141 108Q57 87 0 123Q-61 87-141 108Z" fill="#061a2c" stroke="#a17835" strokeWidth="5" />
    <path d="M-153-79Q-70-117 0-70Q70-117 153-79L141 99Q57 78 0 114Q-61 78-141 99Z" fill={`url(#${id}-cover)`} stroke={gold} strokeWidth="8" />
    <path d="M-140-87Q-68-119 0-73Q69-119 140-87L126 3Q65-24 0 15Q-61-24-126 3Z" fill={`url(#${id}-paper)`} stroke="#c89941" strokeWidth="2" />
    {[-1,1].map(side => <g key={side}><g fill="none" stroke="#baa076" strokeWidth="1.2" opacity=".8">{Array.from({length:7},(_,i)=><path key={i} d={`M${side*(130-i)} ${-78+i*9}Q${side*64} ${-100+i*10} ${side*7} ${-63+i*10}`} />)}</g><path d={`M${side*16} 26Q${side*73}-7 ${side*132} 20L${side*126} 80Q${side*72} 61 ${side*16} 91Z`} fill="none" stroke={gold} strokeWidth="2" /><path d={`M${side*23} 30Q${side*75} 4 ${side*124} 24M${side*25} 83Q${side*75} 58 ${side*120} 74`} fill="none" stroke="#e1bd67" strokeWidth="1" /><path d={star} transform={`translate(${side*121} 22) scale(.3)`} fill="#f4da8f" /><path d={`M${side*124} 24Q${side*96} 24 ${side*118} 44M${side*124} 24Q${side*112} 49 ${side*98} 30`} fill="none" stroke="#e1bd67" strokeWidth="1.5" /></g>)}
    <path d="M-5-70H5V113H-5Z" fill={gold} /><path d="M-3-60V95" stroke="#f8dc85" strokeWidth="3" />
    <g transform="translate(71 48)" fill="none" stroke={gold} strokeWidth="5">{check ? <><circle r="29" fill="#1d456766" /><path d="M-17 1-4 14 19-14" stroke="#fff1b4" strokeWidth="7" /></> : <><circle r="25" fill={`url(#${id}-lens)`} /><path d="M-18 18-35 39" strokeWidth="9" /><path d="M-10-13Q2-21 14-9" stroke="#e1f4ff" strokeWidth="3" /></>}</g>
    <path d={star} transform="translate(-73 46) scale(1.3)" fill={gold} />
    {['#de9a46','#77b397','#a3c4dd'].map((color,i)=><path key={color} d="M-6-19H6V10L0 5-6 10Z" transform={`translate(${62+i*25} ${-103-i%2*7})`} fill={color} stroke="#f3d47c" strokeWidth="1" />)}
  </g>;
}

export function CardMirror({ id, falseFace = false }: { id: string; falseFace?: boolean }) {
  const gold = `url(#${id}-gold)`;
  return <g className="card-gemmed-oval-mirror" data-card-material="beveled-gold-prism-mirror" strokeLinejoin="round">
    <defs><GoldMaterial id={`${id}-gold`} /><linearGradient id={`${id}-glass`} x2=".7" y2="1"><stop stopColor="#edfaffaa" /><stop offset=".24" stopColor="#94dceab3" /><stop offset=".5" stopColor="#c8f0ffa1" /><stop offset=".7" stopColor="#78b6dbb3" /><stop offset="1" stopColor="#e8d8fbc9" /></linearGradient><linearGradient id={`${id}-jewel`} x2="1" y2="1"><stop stopColor="#f1ceff" /><stop offset=".4" stopColor="#b477dd" /><stop offset=".7" stopColor="#644299" /><stop offset="1" stopColor="#dfb0fa" /></linearGradient></defs>
    <path d="M0-174C29-141 80-151 98-91C126-14 104 104 65 139L0 175-65 139C-104 104-126-14-98-91C-80-151-29-141 0-174Z" transform="translate(3 4)" fill="#72502c" stroke="#453929" strokeWidth="3" />
    <path d="M0-174C29-141 80-151 98-91C126-14 104 104 65 139L0 175-65 139C-104 104-126-14-98-91C-80-151-29-141 0-174Z" fill={gold} stroke="#fff2bf" strokeWidth="3" />
    <path d="M0-154C28-124 64-133 81-80C104-15 87 86 53 119L0 153-53 119C-87 86-104-15-81-80C-64-133-28-124 0-154Z" fill={`url(#${id}-glass)`} stroke="#8e6839" strokeWidth="4" />
    <path d="M0-164C27-136 71-143 90-87M-89-86C-111-10-92 99-60 131" fill="none" stroke="#fff4bf" strokeWidth="2" />
    <g className="card-mirror-reflection" opacity=".4" fill="#f8ffe4"><path d="M-69 106V11L-48-7-27 11V106M22 104V-11L43-31 64-11V104M-33 104V44H33V104Z" /><path d="M-71 19H-24M20-3H67M-71 75H67" fill="none" stroke="#567f89" strokeWidth="5" /></g>
    <path d="M-73 31 51-107M-56 78 70-69" fill="none" stroke="#f5ffff" strokeWidth="7" opacity=".65" />
    {falseFace ? <g className="card-mirror-false-mask" fill="#41305e" stroke="#bc91ee" strokeWidth="3"><path d="M0-67-48-86-62-30-41 48 0 77 41 48 62-30 48-86Z" /><path d="M-43-20-12-10M12-10 43-20M-22 40Q0 20 22 40" fill="none" strokeWidth="6" /><path d="M0-65-15-12 16 10-8 73M-15-12-49 7M16 10 45-22" fill="none" stroke="#f7ddff" strokeWidth="4" /></g> : <g className="card-mirror-truth-check" fill="none" stroke="#edfff3" strokeWidth="9"><circle r="42" fill="#6bf9dd55" strokeWidth="4" /><path d="M-24 0-6 19 28-20" strokeLinecap="round" /></g>}
    {[[0,-162],[0,163],[-99,-28],[99,-28]].map(([x,y],i) => <g key={i} transform={`translate(${x} ${y})`}><path d={gem} fill={i<2?`url(#${id}-jewel)`:'#64d8e8'} stroke="#fff0bf" strokeWidth="3" /><path d="M0-18V18L11-3Z" fill="#5d4292" opacity=".55" /><path d="M-11-3H11L0-18Z" fill="#f0e2ff" opacity=".55" /><path d="M-7-3 0-12 6-3" fill="none" stroke="#fff9e8" strokeWidth="1.3" /></g>)}
    <path d={star} transform="translate(0 -130) scale(.4)" fill="#fff5bd" />
  </g>;
}

export function CardPuzzleHeart() {
  const id = useMaterialId('card-heart');
  return <g className="card-leaf-puzzle-heart" data-card-material="assembled-green-gold-puzzle"><defs><GoldMaterial id={`${id}-gold`} /><linearGradient id={`${id}-green`} x2="1" y2="1"><stop stopColor="#a4cf50" /><stop offset=".4" stopColor="#38833e" /><stop offset=".8" stopColor="#1d683d" /><stop offset="1" stopColor="#8cb956" /></linearGradient><clipPath id={`${id}-shape`}><path d={heart} /></clipPath></defs>
    <path d={heart} transform="translate(3 5)" fill="#416331" stroke="#6f642e" strokeWidth="7" /><path d={heart} fill={`url(#${id}-green)`} stroke="#f9df82" strokeWidth="6" />
    <g clipPath={`url(#${id}-shape)`} fill={`url(#${id}-gold)`} stroke="#fff0a4" strokeWidth="3"><path d="M-154-23H-95C-110-54-60-54-73-23H0V-84H-168Z" /><path d="M0-10H55C40 19 91 19 77-10H168V55H83C99 22 47 22 60 55H0Z" /><path d="M-108 55H-61C-74 24-25 24-37 55H0V72C-32 85-34 36 0 50V155H-108Z" /></g>
    <path d="M0-84V-34C-32-47-32 3 0-10V50C-34 36-32 85 0 72V144M-154-23H-95C-110-54-60-54-73-23H0M0-10H55C40 19 91 19 77-10H158M-108 55H-61C-74 24-25 24-37 55H0M0 72H83" fill="none" stroke="#f8de7c" strokeWidth="4" />
    {[[-93,-59,.65,0],[70,-65,.68,1],[-48,55,.54,2],[54,36,.58,0]].map(([x,y,s,k],i)=><g key={i} transform={`translate(${x} ${y}) scale(${s})`}><CardLeaf kind={k} /></g>)}
    <path d="M-132-54Q-128-116-64-118M61-120Q125-128 144-64" fill="none" stroke="#eaffb4" strokeWidth="5" opacity=".65" />
  </g>;
}

export function CardLeafPuzzle({ kind = 0 }: { kind?: number }) {
  const id = useMaterialId('card-puzzle');
  return <g className="card-botanical-puzzle" data-card-material="gold-edged-leaf-crystal"><defs><GoldMaterial id={`${id}-gold`} /><linearGradient id={`${id}-crystal`} x2="1" y2="1"><stop stopColor="#e5ffeec9" /><stop offset=".35" stopColor="#6aceaaa3" /><stop offset=".6" stopColor="#d8ffe799" /><stop offset="1" stopColor="#3bac998c" /></linearGradient></defs><path d={puzzle} transform="translate(2 3)" fill="#418f6955" stroke="#a28538" strokeWidth="3" /><path d={puzzle} fill={`url(#${id}-crystal)`} stroke={`url(#${id}-gold)`} strokeWidth="3" /><path d="M-42-37H-17M-42-37V30M-17 39H8M35-32V-16" fill="none" stroke="#effff2" strokeWidth="2" opacity=".8" /><g transform="scale(.65)"><CardLeaf kind={kind} /></g></g>;
}

export function CardSnowflake() {
  return <g className="card-snowflake" fill="none" stroke="#f2fdff" strokeWidth="4" strokeLinecap="round">{[0,60,120].map(angle => <g key={angle} transform={`rotate(${angle})`}><path d="M0-38V38M-10-28 0-19 10-28M-10 28 0 19 10 28" /></g>)}</g>;
}

export function CardCrystalLance() {
  const id = useMaterialId('card-lance');
  return <g className="card-snowflake-lance" data-card-material="transparent-ice-snowflake-facets" strokeLinejoin="round"><defs><linearGradient id={`${id}-ice`} x2=".5" y2="1"><stop stopColor="#e5ffffe6" /><stop offset=".3" stopColor="#87cff2a6" /><stop offset=".5" stopColor="#d9faffe0" /><stop offset=".72" stopColor="#3d93d8a8" /><stop offset="1" stopColor="#b8ecffc9" /></linearGradient></defs><path d="M-210 0-56-24 27-48 179 0 27 48-56 24Z" fill={`url(#${id}-ice)`} stroke="#e8fcff" strokeWidth="4" /><path d="M-210 0H179L27-48-56-24Z" fill="#eefcff73" /><path d="M-56-24 27 48 68-3 27-48-56 24M27-48V48M-210 0 27 48M27-48 179 0" fill="none" stroke="#edffff" strokeWidth="2" /><path d="M-187-1-56-17 25-39 144-2M-50 18 25 38 137 3" fill="none" stroke="#ffffff" strokeWidth="2.2" opacity=".8" /><path d="M-56-24-7-6 27-48M-7-6 27 48 68-3" fill="#3788bd26" stroke="#caefff" strokeWidth="1" /><g transform="translate(24 0) scale(.62)"><CardSnowflake /></g></g>;
}

/** Detached pieces use the same material as their parent cast, so the impact
 * remains recognizable after the large object leaves the frame. */
export function CardIndexPage() {
  const id = useMaterialId('card-page');
  return <g className="card-ivory-index-page" data-card-material="navy-leather-gold-ivory-pages" strokeLinejoin="round"><defs><linearGradient id={`${id}-paper`} x2=".2" y2="1"><stop stopColor="#fffdeb" /><stop offset=".6" stopColor="#f3dfb2" /><stop offset="1" stopColor="#cbb181" /></linearGradient></defs><path d="M-25-34Q0-43 25-34V34Q0 23-25 34Z" fill={`url(#${id}-paper)`} stroke="#dab765" strokeWidth="2" /><path d="M-15-14H15M-15-3H12M-15 8H15M-15 19H5" fill="none" stroke="#a48f6e" strokeWidth="1.5" /><path d="M12-37H18V-16L15-20 12-16Z" fill="#d8ad4b" stroke="#fff2b0" strokeWidth=".7" /><path d="M-24-29Q0-37 24-29" fill="none" stroke="#fffdf1" strokeWidth="1.5" /></g>;
}

export function CardMirrorFragment() {
  const id = useMaterialId('card-mirror-shard');
  return <g className="card-faceted-mirror-fragment" data-card-material="beveled-gold-prism-mirror"><defs><linearGradient id={`${id}-glass`} x2="1" y2="1"><stop stopColor="#e3faffbf" /><stop offset=".4" stopColor="#83c4e8b3" /><stop offset=".7" stopColor="#d6b8efa6" /><stop offset="1" stopColor="#f2e6ffd6" /></linearGradient></defs><path d="M0-38 21-3 8 33-18 16-19-17Z" fill={`url(#${id}-glass)`} stroke="#efd282" strokeWidth="2" /><path d="M0-38-5 2 8 33M-19-17-5 2 21-3" fill="none" stroke="#f5fcff" strokeWidth="1.5" /><path d="M-5 2 21-3 8 33Z" fill="#6576b42b" /></g>;
}

export function CardFireFeather() {
  const id = useMaterialId('card-fire-feather');
  return <g className="card-golden-fire-feather" data-card-material="red-gold-flame-feather" strokeLinejoin="round"><defs><linearGradient id={`${id}-fire`} x1="0" y1="1" x2=".7" y2="0"><stop stopColor="#b83928" /><stop offset=".35" stopColor="#ec7132" /><stop offset=".7" stopColor="#ffc65a" /><stop offset="1" stopColor="#fff4b5" /></linearGradient></defs><path d="M0 0C-18-35-33-96 0-170C35-96 22-34 0 0Z" fill={`url(#${id}-fire)`} stroke="#ffc773" strokeWidth="2.5" /><path d="M0-5Q-4-86 0-165M0-43-15-61M0-72-19-94M0-105-12-126M0-52 15-75M0-84 17-106M0-118 10-135" fill="none" stroke="#fff1ad" strokeWidth="1.8" /><path d="M-3-149Q-15-119-15-97" fill="none" stroke="#fff9d4" strokeWidth="2" opacity=".75" /></g>;
}
