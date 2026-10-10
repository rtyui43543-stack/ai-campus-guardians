import type { BattleSoundVoice } from './battleSoundDesign';

interface MaterialAttack {
  id: string;
  fundamental: number;
  shimmer: number;
  air: number;
  success: boolean;
  enhanced: boolean;
  pitch: number;
  reducedMotion: boolean;
  missed: boolean;
  blocked: boolean;
}

/** Material choreography for short casts. Hero summons remain in battleSoundDesign.
 * A short held impact, audible midrange and a material decay provide weight without
 * raising the shared output gain or extending the existing 2.05 second turn. */
export function buildMaterialAttack(settings: MaterialAttack): BattleSoundVoice[] {
  const { id, fundamental, shimmer, air, success, enhanced, reducedMotion, pitch, missed, blocked } = settings;
  const voices: BattleSoundVoice[] = [];
  const speed = reducedMotion ? 6 : 1;
  const origin = success ? -.55 : .55, target = -origin;
  const add = (phase: BattleSoundVoice['phase'], kind: BattleSoundVoice['kind'], layer: string,
    at: number, duration: number, from: number, to: number, gain: number, pan: number,
    detail: Partial<Pick<BattleSoundVoice, 'envelope' | 'filter' | 'resonance' | 'panTo' | 'creature'>> = {}) => {
    voices.push({ phase, kind, layer, at: at / speed, duration: duration / speed,
      from: Math.max(38, from * pitch), to: Math.max(38, to * pitch),
      gain: gain * (reducedMotion ? .8 : 1), pan, ...detail });
  };
  const tone = (phase: BattleSoundVoice['phase'], layer: string, at: number, duration: number,
    from: number, to: number, gain: number, pan: number, kind: OscillatorType = 'sine',
    envelope: BattleSoundVoice['envelope'] = 'punch') =>
    add(phase, kind, layer, at, duration, from, to, gain, pan, { envelope });
  const noise = (phase: BattleSoundVoice['phase'], layer: string, at: number, duration: number,
    from: number, to: number, gain: number, pan: number, filter: BiquadFilterType = 'bandpass',
    envelope: BattleSoundVoice['envelope'] = 'punch', panTo?: number, resonance = .85) =>
    add(phase, 'noise', layer, at, duration, from, to, gain, pan, { filter, envelope, panTo, resonance });
  const metal = ['castle-seal', 'box-chain', 'confusing-stamp', 'disorder-gears'].includes(id);
  const paper = ['book-lightning', 'deceptive-pages', 'paper-wing', 'chaos-grimoire'].includes(id);
  const glass = ['mirror', 'mask-shards'].includes(id);
  const ice = ['ice', 'spectral-dragon'].includes(id);
  const hitLevel = enhanced ? 1.12 : 1;

  // Brief anticipation leaves the strongest transient for contact. Each actor's
  // release moves toward the target even when the output is folded down to mono.
  tone('charge', `${id}-gather`, .015, .31, fundamental, fundamental * 1.7, .035, origin, 'triangle', 'swell');
  if (metal) {
    [0, .12].forEach((delay, i) => tone('charge', `${id}-latch`, .06 + delay, .17,
      shimmer * (1 + i * .43), shimmer * (1 + i * .43) * .97, .035, origin));
    noise('launch', `${id}-weight-swing`, .48, .39, 620, 1750, .105, origin, 'bandpass', 'swell', target);
  } else if (paper) {
    [0, .1, .22].forEach((delay, i) => noise('charge', `${id}-page-turn`, .055 + delay, .105,
      1800 + i * 230, 2900, .046, origin, 'highpass'));
    noise('launch', `${id}-paper-cut`, .48, .4, 1300, 3400, .105, origin, 'bandpass', 'swell', target);
  } else if (glass || ice) {
    [1, 1.48].forEach((ratio, i) => tone('charge', `${id}-tension`, .07 + i * .12, .2,
      shimmer * ratio, shimmer * ratio * 1.04, .026, origin, 'sine', 'swell'));
    noise('launch', `${id}-edge-flight`, .48, .4, 950, 3600, .10, origin, 'bandpass', 'swell', target);
  } else {
    const layers: Record<string, string> = {
      'forest-puzzle': 'leaves-gather', fire: 'ember-ignite', 'spider-web': 'silk-draw',
      'hourglass-sand': 'sand-rattle', 'vine-whip': 'vine-pull', 'mimic-shadow': 'voice-inhale',
      'ink-burst': 'ink-bubble', 'storm-fist': 'pressure-rise',
    };
    noise('charge', layers[id] ?? `${id}-gather`, .06, .31, air * .6, air, .06, origin, 'bandpass', 'swell');
    noise('launch', `${id}-flight`, .48, .4, air * .65, air * 1.8, .105, origin, 'bandpass', 'swell', target);
  }
  if (enhanced) {
    // A distinct short warning and a heavier first contact, not a longer turn.
    tone('charge', `${id}-threat`, .075, .31, Math.max(125, fundamental * 1.5), fundamental, .07, origin, 'sawtooth', 'swell');
    noise('launch', `${id}-pursuit`, .61, .26, 1500, 500, .07, origin, 'bandpass', 'swell', target);
    if (id === 'spectral-dragon') add('charge', 'creature', 'creature-call', .055, .8,
      60, 42, .25, origin, { creature: 'dragon', envelope: 'sustain', panTo: target * .35 });
  }
  // Ability accents give similarly coloured spells different release rhythms.
  if (id === 'spider-web') [0, .12, .24].forEach((delay, i) => tone('launch', 'silk-pluck', .48 + delay, .16,
    640 + i * 137, 250 + i * 41, .045, origin + (target - origin) * i / 2));
  if (id === 'vine-whip') noise('launch', 'whip-whistle', .64, .23, 720, 3800, .10, origin, 'bandpass', 'swell', target, 1.4);
  if (id === 'mimic-shadow') [1, 1.42].forEach((ratio, i) => tone('launch', 'false-voice', .48 + i * .10, .32,
    310 * ratio, 540 / ratio, .038, i ? 0 : origin, 'sawtooth', 'swell'));
  if (id === 'ink-burst') [0, .12].forEach((delay, i) => noise('launch', 'ink-droplet', .48 + delay, .16,
    900 + i * 550, 280, .065, i ? 0 : origin, 'bandpass', 'punch', target, 2.1));
  if (id === 'paper-wing') [.5, .64, .78].forEach((at, i) => noise('launch', 'paper-wingbeat', at, .09,
    1550, 430, .055, origin + (target - origin) * i / 2));

  if (missed) {
    noise('impact', 'miss-pass', .9, .29, 3300, 450, .075, -.8, 'highpass');
    tone('tail', 'mirror-dodge', 1.04, .22, 1175, 1568, .042, target);
    return voices;
  }
  if (blocked) {
    [1, 1.5, 2.02].forEach((ratio, i) => tone('impact', 'shield-block', .9 + i * .015, .52,
      560 * ratio / pitch, 520 * ratio / pitch, .06 / (1 + i * .5), target));
    noise('impact', 'shield-scrape', .9, .10, 1600, 650, .08, target);
    return voices;
  }

  // The body has useful midrange before its bass decay, so a small speaker does
  // not have to reproduce a 40 Hz thump to communicate the weight of the hit.
  tone('impact', 'impact-body', .9, enhanced ? .34 : .26,
    Math.max(190, fundamental * 1.65) / pitch, 78 / pitch, .18 * hitLevel, target, 'triangle');
  noise('impact', 'impact-air', .9, .15, Math.max(1400, air), 650, .115 * hitLevel, target);
  noise('impact', 'contact-snap', .9, .07, Math.max(2300, air), 1050, .075, target, 'highpass');
  const tail = (layer: string, at: number, duration: number, from: number, to: number, gain: number,
    filter: BiquadFilterType = 'bandpass', envelope: BattleSoundVoice['envelope'] = 'punch') =>
    noise('tail', layer, at, duration, from, to, gain, target, filter, envelope, 0);
  switch (id) {
    case 'castle-seal':
      [1, 1.41, 1.91].forEach((ratio, i) => tone('tail', 'seal-ring', .93 + i * .014, .46 - i * .06,
        480 * ratio, 475 * ratio, .043 / (1 + i * .5), target));
      tail('seal-settle', 1.05, .35, 600, 170, .06, 'lowpass');
      break;
    case 'book-lightning':
    case 'storm-fist':
      noise('impact', 'lightning-crack', .9, .10, 4300, 1800, .115, target, 'highpass');
      [.99, 1.13, 1.28].forEach((at, i) => noise('tail', 'electric-arc', at, .085,
        3500 - i * 400, 900, .07 - i * .017, target));
      tail(id === 'storm-fist' ? 'cloud-punch-rumble' : 'page-thunder', 1.02, .43, 720, 150, .095, 'lowpass');
      if (id === 'storm-fist') tone('tail', 'pressure-recoil', 1.10, .25, 180, 95, .065, target, 'triangle');
      break;
    case 'forest-puzzle':
      [.9, 1.035, 1.18].forEach((at, i) => tone('impact', 'wood-fit', at, .15,
        410 + i * 117, 190 + i * 70, .095 - i * .024, target));
      tail('leaves-scatter', 1.01, .46, 2300, 1100, .09, 'bandpass', 'gust');
      break;
    case 'mirror':
    case 'mask-shards':
      noise('impact', id === 'mirror' ? 'mirror-fracture' : 'mask-crack', .9, .16, 4700, 1800, .095, target, 'highpass');
      [1, 1.31, 1.79].forEach((ratio, i) => tone('tail', 'glass-fall', .97 + i * .11, .28,
        (id === 'mirror' ? 1700 : 1030) * ratio, (id === 'mirror' ? 1640 : 950) * ratio,
        .035 - i * .007, target * (i % 2 ? .55 : 1)));
      if (id === 'mask-shards') tail('mask-hollow', 1.03, .32, 700, 340, .065);
      break;
    case 'fire':
      noise('impact', 'fire-burst', .9, .30, 1800, 180, .13, target, 'lowpass');
      tail('ember-wake', 1.03, .57, 1200, 420, .08, 'lowpass', 'gust');
      [1.06, 1.22, 1.42].forEach((at, i) => tail('ember-crackle', at, .06, 2900 + i * 350, 1300, .045 - i * .01, 'highpass'));
      break;
    case 'ice':
    case 'spectral-dragon':
      noise('impact', 'ice-pierce', .9, .13, 3200, 1250, .11, target, 'highpass');
      [.98, 1.10, 1.27].forEach((at, i) => {
        tail('ice-split', at, .09, 1900 + i * 870, 4000 - i * 330, .065 - i * .012);
        tone('tail', 'ice-grain', at + .015, .28, 1700 + i * 743, 1550 + i * 641, .035, target);
      });
      tail(id === 'ice' ? 'frost-settle' : 'spectral-breath', 1.08, .52, 1700, 700, .065, 'bandpass', 'gust');
      break;
    case 'box-chain':
      [0, .085, .19].forEach((delay, i) => tone('impact', 'chain-clank', .9 + delay, .23,
        420 * (1 + i * .47), 400 * (1 + i * .47), .07 - i * .016, target, 'triangle'));
      tail('chain-drag', 1.12, .37, 1350, 600, .065);
      break;
    case 'confusing-stamp':
      tone('impact', 'stamp-thud', .9, .21, 320, 135, .11, target);
      noise('impact', 'stamp-slap', .9, .085, 1700, 630, .09, target);
      tone('tail', 'stamp-rebound', 1.06, .15, 390, 180, .065, target);
      tail('stamp-dust', 1.18, .23, 1450, 630, .045);
      break;
    case 'disorder-gears':
      [.9, .96, 1.04, 1.14].forEach((at, i) => tone('impact', 'gear-tooth', at, .14,
        650 + i * 169, 620 + i * 151, .048 - i * .007, target, 'triangle'));
      tail('gear-grind', 1.09, .43, 2300, 550, .085);
      break;
    case 'deceptive-pages':
    case 'paper-wing':
    case 'chaos-grimoire':
      noise('impact', 'paper-slice', .9, .125, 3900, 1800, .12, target, 'highpass');
      tone('impact', 'book-slap', .9, .19, id === 'chaos-grimoire' ? 260 : 440, 170, .09, target, 'triangle');
      [.99, 1.13, 1.3].forEach((at, i) => tail(id === 'paper-wing' ? 'wing-fold' : 'page-scatter', at,
        .1, 2600 - i * 370, 1100, .055 - i * .012, 'highpass'));
      if (id === 'chaos-grimoire') {
        tone('tail', 'grimoire-seal', 1.10, .39, 230, 120, .065, target, 'triangle');
        tail('grimoire-pages', 1.18, .39, 1500, 650, .07, 'bandpass', 'gust');
      }
      break;
    case 'spider-web':
      noise('impact', 'silk-snap', .9, .085, 3200, 1050, .10, target, 'highpass');
      [0, .09, .22].forEach((delay, i) => tone('tail', 'web-twang', .92 + delay, .23,
        940 - i * 150, 360 - i * 30, .062 - i * .016, target, 'triangle'));
      tail('web-tighten', 1.15, .32, 1850, 650, .065);
      break;
    case 'hourglass-sand':
      noise('impact', 'sand-pelt', .9, .19, 2700, 1200, .105, target);
      [.99, 1.1, 1.24].forEach((at, i) => tone('tail', 'hourglass-tick', at, .095,
        1250 - i * 170, 660, .037, target));
      tail('sand-cascade', 1.03, .58, 3900, 1900, .095, 'highpass', 'gust');
      break;
    case 'vine-whip':
      noise('impact', 'vine-crack', .9, .075, 4400, 1900, .13, target, 'highpass');
      tone('impact', 'vine-strike', .9, .22, 420, 135, .095, target, 'triangle');
      tail('bark-tear', 1.03, .19, 1850, 700, .07);
      tail('vine-retract', 1.16, .31, 900, 1700, .065, 'bandpass', 'swell');
      break;
    case 'mimic-shadow':
      noise('impact', 'shadow-cut', .9, .12, 2500, 900, .105, target);
      [0, .16].forEach((delay, i) => tone('tail', 'voice-break', .94 + delay, .31,
        470 / (1 + i * .23), 190 + i * 75, .045 - i * .014, target, 'sawtooth'));
      tail('shadow-echo', 1.20, .30, 1150, 450, .06);
      break;
    case 'ink-burst':
      noise('impact', 'ink-splash', .9, .17, 1400, 360, .11, target, 'bandpass', 'punch', undefined, 1.8);
      [.97, 1.10, 1.27].forEach((at, i) => {
        tone('tail', 'ink-plop', at, .12, 570 + i * 173, 190, .065 - i * .015, target);
        tail('ink-spatter', at, .09, 1700 + i * 330, 500, .045 - i * .009);
      });
      break;
  }
  if (enhanced) {
    // Compress the extra threat into the existing turn. Texture follows the
    // enemy identity; ink never turns into fire and silk never sounds like ice.
    tone('tail', `${id}-aftershock`, 1.14, .38, 180 / pitch, 92 / pitch, .08, target, 'triangle');
    noise('tail', `${id}-critical-trail`, 1.23, .61, Math.max(850, air), Math.max(390, air * .42),
      .09, target, 'bandpass', 'gust', origin * .25);
    if (id === 'chaos-grimoire') [1.21, 1.38, 1.57].forEach((at, i) =>
      tail('grimoire-barrage', at, .13, 3100 - i * 350, 1200, .07 - i * .014, 'highpass'));
    if (id === 'spectral-dragon') tail('dragon-frost-wave', 1.15, .67, 2700, 550, .10, 'bandpass', 'gust');
  }
  return voices;
}
