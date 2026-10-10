import type { Mode } from '../domain/types';
import { buildMaterialAttack } from './combatMaterialSound';

export interface BattleSoundOptions {
  mode?: Mode;
  ultimate?: boolean;
  enemyCritical?: boolean;
  missed?: boolean;
  blocked?: boolean;
  finalBoss?: boolean;
}

export interface BattleSoundVoice {
  phase: 'charge' | 'launch' | 'impact' | 'tail';
  kind: OscillatorType | 'noise' | 'creature';
  at: number;
  duration: number;
  from: number;
  to: number;
  gain: number;
  pan: number;
  filter?: BiquadFilterType;
  resonance?: number;
  /** A voice is synthesized from a glottal source and moving formants, not a tone. */
  creature?: 'phoenix' | 'dragon';
  envelope?: 'sustain' | 'swell' | 'gust' | 'punch';
  panTo?: number;
  layer?: string;
}

interface Timbre {
  id: string;
  fundamental: number;
  shimmer: number;
  air: number;
  wave: OscillatorType;
  texture: 'metal' | 'electric' | 'rustle' | 'glass' | 'flame' | 'ice';
}

// These are generated waveforms, not licensed samples. Each shape accompanies its
// on-screen material: castle/metal, lightning, leaves, mirror, flame and ice.
const hero: Timbre[] = [
  { id: 'castle-seal', fundamental: 164, shimmer: 784, air: 1250, wave: 'triangle', texture: 'metal' },
  { id: 'book-lightning', fundamental: 147, shimmer: 1175, air: 2700, wave: 'sawtooth', texture: 'electric' },
  { id: 'forest-puzzle', fundamental: 220, shimmer: 659, air: 1700, wave: 'sine', texture: 'rustle' },
  { id: 'mirror', fundamental: 262, shimmer: 1320, air: 3300, wave: 'sine', texture: 'glass' },
  { id: 'fire', fundamental: 110, shimmer: 440, air: 760, wave: 'triangle', texture: 'flame' },
  { id: 'ice', fundamental: 294, shimmer: 1760, air: 3900, wave: 'sine', texture: 'ice' },
];
const enemies: Record<Mode, Timbre[]> = {
  starter: [
    { id: 'box-chain', fundamental: 98, shimmer: 620, air: 920, wave: 'triangle', texture: 'metal' },
    { id: 'deceptive-pages', fundamental: 174, shimmer: 440, air: 2100, wave: 'triangle', texture: 'rustle' },
    { id: 'confusing-stamp', fundamental: 82, shimmer: 330, air: 640, wave: 'triangle', texture: 'metal' },
    { id: 'mask-shards', fundamental: 196, shimmer: 990, air: 2400, wave: 'sine', texture: 'glass' },
    { id: 'paper-wing', fundamental: 155, shimmer: 523, air: 1550, wave: 'triangle', texture: 'rustle' },
    { id: 'disorder-gears', fundamental: 123, shimmer: 740, air: 2850, wave: 'sawtooth', texture: 'metal' },
  ],
  advanced: [
    { id: 'spider-web', fundamental: 116, shimmer: 830, air: 1900, wave: 'sawtooth', texture: 'glass' },
    { id: 'hourglass-sand', fundamental: 146, shimmer: 1110, air: 3200, wave: 'sine', texture: 'ice' },
    { id: 'vine-whip', fundamental: 130, shimmer: 587, air: 1300, wave: 'triangle', texture: 'rustle' },
    { id: 'mimic-shadow', fundamental: 185, shimmer: 880, air: 1800, wave: 'sawtooth', texture: 'glass' },
    { id: 'ink-burst', fundamental: 87, shimmer: 392, air: 560, wave: 'triangle', texture: 'flame' },
    { id: 'storm-fist', fundamental: 73, shimmer: 1047, air: 2300, wave: 'sawtooth', texture: 'electric' },
  ],
};
const finalBosses: Record<Mode, Timbre> = {
  starter: { id: 'chaos-grimoire', fundamental: 65, shimmer: 392, air: 1800, wave: 'triangle', texture: 'rustle' },
  advanced: { id: 'spectral-dragon', fundamental: 55, shimmer: 880, air: 2400, wave: 'sawtooth', texture: 'ice' },
};

/** Timings match the arena's .48 s release / .9 s contact; its reduced clock is 6×. */
export function buildBattleSound(success: boolean, theme: number, reducedMotion = false, options: BattleSoundOptions = {}) {
  const index = Math.max(0, Math.min(5, Math.trunc(Number.isFinite(theme) ? theme : 1) - 1));
  const mode = options.mode ?? 'starter';
  const profile = success ? hero[index] : options.finalBoss ? finalBosses[mode] : enemies[mode][index];
  const enhanced = success ? !!options.ultimate : !!options.enemyCritical;
  const duration = success && options.ultimate ? 3 : 2.05;
  const voices: BattleSoundVoice[] = [];
  const pitch = (success ? mode === 'advanced' ? 1.06 : 1 : .91) * (!success && options.finalBoss ? .76 : 1);
  // Hero summons retain their existing music/samples. Ordinary hero attacks and
  // every enemy spell get their own physical material, rather than borrowing a
  // fire/ice/leaf summon merely because their old palette used that texture.
  if (!success || !enhanced) return {
    profile: profile.id, enhanced, impact: .9 / (reducedMotion ? 6 : 1),
    duration: duration / (reducedMotion ? 6 : 1),
    voices: buildMaterialAttack({ ...profile, success, enhanced, pitch, reducedMotion,
      missed: !success && !!options.missed, blocked: !success && !!options.blocked }),
  };
  const sourcePan = success ? -.55 : .55, targetPan = -sourcePan;
  const add = (phase: BattleSoundVoice['phase'], kind: BattleSoundVoice['kind'], at: number,
    length: number, from: number, to: number, gain: number, pan: number, filter?: BiquadFilterType, resonance = .8,
    detail: Pick<BattleSoundVoice, 'creature' | 'envelope' | 'panTo' | 'layer'> = {}) => {
    const speed = reducedMotion ? 6 : 1;
    voices.push({ phase, kind, at: at / speed, duration: length / speed,
      from: Math.max(32, from * pitch), to: Math.max(32, to * pitch), gain: gain * (reducedMotion ? .8 : 1),
      pan, ...(filter ? { filter, resonance } : {}), ...detail });
  };
  const note = (phase: BattleSoundVoice['phase'], at: number, length: number, from: number,
    to: number, gain: number, pan: number, kind: OscillatorType = profile.wave) => add(phase, kind, at, length, from, to, gain, pan);
  const air = (phase: BattleSoundVoice['phase'], at: number, length: number, from: number,
    to: number, gain: number, pan: number, filter: BiquadFilterType = 'bandpass') => add(phase, 'noise', at, length, from, to, gain, pan, filter);
  const texture = (phase: BattleSoundVoice['phase'], layer: string, at: number, length: number,
    from: number, to: number, gain: number, pan: number, filter: BiquadFilterType = 'bandpass',
    envelope?: BattleSoundVoice['envelope'], panTo?: number, resonance = .8) =>
    add(phase, 'noise', at, length, from, to, gain, pan, filter, resonance, { layer, envelope, panTo });
  const creature = (name: 'phoenix' | 'dragon', at: number, length: number, from: number, to: number, gain: number) =>
    add('charge', 'creature', at, length, from, to, gain, sourcePan, undefined, .8,
      { creature: name, layer: 'creature-call', envelope: 'sustain', panTo: targetPan * .35 });
  const fundamental = profile.fundamental;

  note('charge', .015, .39, fundamental * .7, fundamental * 2.2, enhanced ? .09 : .055, sourcePan);
  air('charge', .06, .39, profile.air * .25, profile.air, enhanced ? .095 : .055, sourcePan);
  if (enhanced) {
    // Rising fifths announce a summon/critical strike before its larger hit.
    [1, 1.5, 2].forEach((ratio, i) => note('charge', .07 + i * .09, .36,
      fundamental * ratio, fundamental * ratio * 1.7, .05, sourcePan, 'sine'));
    // Calls belong to the creature shown in the summon, rather than every fire
    // or ice enemy. Keeping them before contact leaves the explosion readable.
    if (success && index === 4) creature('phoenix', .08, .77, mode === 'advanced' ? 680 : 820, 470, .24);
    if ((success && index === 5 && mode === 'advanced') || (!success && options.finalBoss && mode === 'advanced'))
      creature('dragon', .055, .8, success ? 74 : 60, 42, .25);
    if (profile.id === 'book-lightning' || profile.id === 'chaos-grimoire') {
      [.055, .18, .32].forEach((at, i) => texture('charge', 'book-pages', at, .17,
        1200 + i * 300, 2700, .055, sourcePan, 'highpass'));
    }
    if (profile.texture === 'metal') texture('charge', 'resonant-seal', .12, .4, 180, 1050, .1, sourcePan, 'bandpass', 'swell', 0, 2.2);
    if (profile.texture === 'glass' || profile.texture === 'ice') texture('charge', 'crystal-charge', .14, .34, 1100, 4200, .09, sourcePan, 'bandpass', 'swell', 0, 1.7);
    if (profile.texture === 'rustle') texture('charge', 'leaf-wind', .12, .36, 800, 2000, .08, sourcePan, 'bandpass', 'swell');
  }
  air('launch', .48, .40, profile.air * .5, profile.air * 2, enhanced ? .17 : .12, 0);
  note('launch', .48, .40, fundamental * 3.3, fundamental * .8, .065, 0);
  if (enhanced) {
    texture('launch', 'flight', .48, .4, profile.air * .65, profile.air * 1.65,
      .16, sourcePan, 'bandpass', 'swell', targetPan);
    if (success && index === 4) {
      // A wing beat and hot wake under the cry, moving toward the enemy lane.
      [.48, .61, .74].forEach((at, i) => texture('launch', 'wingbeat', at, .14, 680 + i * 160,
        190, .11 - i * .018, sourcePan + (targetPan - sourcePan) * (i / 2), 'lowpass'));
    }
    if (profile.texture === 'ice') texture('launch', 'frost-breath', .48, .46,
      720, 2900, .11, sourcePan, 'bandpass', 'gust', targetPan);
  }

  if (!success && options.missed) {
    // A dodge must never report a bass impact. Let the projectile whistle past.
    air('impact', .9, .29, 3300, 450, .075, -.8, 'highpass');
    note('tail', 1.04, .22, 1175, 1568, .042, targetPan, 'sine');
  } else if (!success && options.blocked) {
    // A stopped attack rings against the shield instead of sounding like damage.
    [1, 1.5, 2.02].forEach((ratio, i) => note('impact', .9 + i * .015, .52,
      510 * ratio, 490 * ratio, .07 / (1 + i * .5), targetPan, 'sine'));
    air('impact', .9, .1, 1600, 650, .1, targetPan);
  } else {
    const force = enhanced ? 1.22 : 1;
    note('impact', .9, enhanced ? .42 : .27, fundamental * 1.6, 45, .23 * force, targetPan, 'triangle');
    air('impact', .9, profile.texture === 'flame' ? .47 : .19, profile.air, profile.air * .28,
      .17 * force, targetPan, profile.texture === 'flame' ? 'lowpass' : 'bandpass');
    if (!enhanced) {
      // A crisp contact transient and a short low follow-through give an
      // ordinary strike weight without borrowing a summon's long explosion.
      texture('impact', 'contact-snap', .9, .07, Math.max(2100, profile.air), 750,
        .10, targetPan, 'highpass');
      note('tail', 1.015, .22, 92, 42, .11, targetPan, 'sine');
    }
    switch (profile.texture) {
      case 'metal':
        [1, 1.48, 2.09].forEach((ratio, i) => note('impact', .905 + i * .013, .57 - i * .08,
          profile.shimmer * ratio, profile.shimmer * ratio * .98, .065 / (1 + i * .6), targetPan, 'sine'));
        break;
      case 'electric':
        [0, .06, .14, .23].forEach((offset, i) => {
          air('impact', .9 + offset, .085, 3400 - i * 400, 750, .085, targetPan);
          note('impact', .9 + offset, .09, profile.shimmer, 140, .035, targetPan, 'sawtooth');
        });
        break;
      case 'rustle':
        [0, .07, .17].forEach((offset, i) => {
          air('impact', .9 + offset, .11, 1900 + i * 300, 900, .065, targetPan);
          note('impact', .9 + offset, .13, fundamental * (3 - i * .4), fundamental, .065, targetPan, 'sine');
        });
        break;
      case 'glass':
      case 'ice':
        [1, 1.25, 1.5, 2].forEach((ratio, i) => note('impact', .9 + i * .04,
          profile.texture === 'ice' ? .43 : .3, profile.shimmer * ratio, profile.shimmer * ratio * .94,
          .055 / (1 + i * .35), targetPan * (i % 2 ? .6 : 1), 'sine'));
        break;
      case 'flame':
        air('tail', 1.05, .62, 1250, 260, .09, targetPan, 'lowpass');
        [0, .1, .24, .35].forEach((offset, i) => air('tail', 1 + offset, .07,
          2200 + i * 240, 650, .055, targetPan));
        break;
    }
    if (enhanced) {
      // Material-specific aftermath replaces the identical chord/hiss previously
      // used for all summons. Enemy critical tails fit the existing 2.05 s clock.
      const tail = success ? 1.58 : .74;
      switch (profile.texture) {
        case 'flame':
          texture('impact', 'explosion', .9, .65, 2000, 90, .24, targetPan, 'lowpass');
          texture('tail', 'combustion', 1.04, tail, 1550, 340, .17, targetPan, 'lowpass', 'gust', 0);
          [.97, 1.14, 1.32, 1.52, 1.71].forEach((at, i) => texture('tail', 'fire-crackle', at,
            .07 + i * .008, 3100 + i * 270, 750, .075 - i * .008, i % 2 ? -.32 : .32, 'highpass'));
          note('impact', 1.04, .45, 94, 33, .14, targetPan, 'sine');
          break;
        case 'ice':
          texture('impact', 'ice-explosion', .9, .61, 4400, 600, .19, targetPan, 'highpass');
          [.92, 1.02, 1.15, 1.3, 1.48].forEach((at, i) => {
            texture('impact', 'ice-fracture', at, .085, 1800 + i * 630, 4900 - i * 280,
              .105 - i * .012, i % 2 ? -.42 : .42, 'bandpass', undefined, undefined, 1.8);
            note('tail', at + .015, .39, 2400 + i * 431, 1900 + i * 381, .04, i % 2 ? -.4 : .4, 'sine');
          });
          texture('tail', 'blizzard', 1.02, tail, 1950, 700, .18, targetPan, 'bandpass', 'gust', sourcePan);
          texture('tail', 'frost-rumble', 1.03, success ? 1.2 : .73, 380, 75, .095, 0, 'lowpass', 'sustain');
          break;
        case 'electric':
          texture('impact', 'thunder', .9, .78, 1450, 100, .22, targetPan, 'lowpass');
          texture('tail', 'rolling-thunder', 1.09, tail, 420, 70, .13, targetPan, 'lowpass', 'gust', 0);
          [.96, 1.13, 1.33, 1.56].forEach((at, i) => texture('impact', 'lightning-arc', at, .095,
            4300, 1300 + i * 240, .095, i % 2 ? -.4 : .4, 'bandpass'));
          break;
        case 'glass':
          texture('impact', 'mirror-shatter', .9, .26, 4900, 1700, .16, targetPan, 'highpass');
          [.93, 1.06, 1.21, 1.4, 1.62].forEach((at, i) => {
            texture('tail', 'glass-shards', at, .095, 3300 + i * 370, 1500, .05, i % 2 ? -.4 : .4, 'highpass');
            note('tail', at, success ? .68 : .26, profile.shimmer * (1.4 + i * .27),
              profile.shimmer * (1.39 + i * .27), .035, i % 2 ? -.4 : .4, 'sine');
          });
          break;
        case 'metal':
          texture('impact', 'seal-slam', .9, .22, 670, 110, .16, targetPan, 'lowpass');
          [1, 1.414, 1.932, 2.76].forEach((ratio, i) => note('tail', .94 + i * .025,
            success ? 1.2 - i * .13 : .72 - i * .1, profile.shimmer * ratio,
            profile.shimmer * ratio * .995, .047 / (1 + i * .45), i % 2 ? -.3 : .3, 'sine'));
          texture('tail', 'shield-resonance', 1.01, tail, 450, 210, .09, 0, 'bandpass', 'sustain', undefined, 2.3);
          break;
        case 'rustle':
          texture('tail', 'leaf-swirl', .97, tail, 2200, 700, .12, targetPan, 'bandpass', 'gust', sourcePan);
          [0, .14, .29, .47].forEach((offset, i) => {
            texture('impact', 'puzzle-click', .9 + offset, .065, 1200 + i * 270, 380, .075,
              i % 2 ? -.25 : .25, 'bandpass');
            note('tail', 1.06 + offset, success ? .82 : .38, fundamental * (2 + i * .5),
              fundamental * (2.05 + i * .5), .045, i % 2 ? -.25 : .25, 'sine');
          });
          break;
      }
    }
  }
  return { profile: profile.id, enhanced, impact: .9 / (reducedMotion ? 6 : 1),
    duration: duration / (reducedMotion ? 6 : 1), voices };
}
