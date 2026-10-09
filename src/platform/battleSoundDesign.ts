import type { Mode } from '../domain/types';

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
  kind: OscillatorType | 'noise';
  at: number;
  duration: number;
  from: number;
  to: number;
  gain: number;
  pan: number;
  filter?: BiquadFilterType;
  resonance?: number;
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
  const sourcePan = success ? -.55 : .55, targetPan = -sourcePan;
  const add = (phase: BattleSoundVoice['phase'], kind: BattleSoundVoice['kind'], at: number,
    length: number, from: number, to: number, gain: number, pan: number, filter?: BiquadFilterType, resonance = .8) => {
    const speed = reducedMotion ? 6 : 1;
    voices.push({ phase, kind, at: at / speed, duration: length / speed,
      from: Math.max(32, from * pitch), to: Math.max(32, to * pitch), gain: gain * (reducedMotion ? .8 : 1),
      pan, ...(filter ? { filter, resonance } : {}) });
  };
  const note = (phase: BattleSoundVoice['phase'], at: number, length: number, from: number,
    to: number, gain: number, pan: number, kind: OscillatorType = profile.wave) => add(phase, kind, at, length, from, to, gain, pan);
  const air = (phase: BattleSoundVoice['phase'], at: number, length: number, from: number,
    to: number, gain: number, pan: number, filter: BiquadFilterType = 'bandpass') => add(phase, 'noise', at, length, from, to, gain, pan, filter);
  const fundamental = profile.fundamental;

  note('charge', .015, .39, fundamental * .7, fundamental * 2.2, enhanced ? .09 : .055, sourcePan);
  air('charge', .06, .39, profile.air * .25, profile.air, enhanced ? .095 : .055, sourcePan);
  if (enhanced) {
    // Rising fifths announce a summon/critical strike before its larger hit.
    [1, 1.5, 2].forEach((ratio, i) => note('charge', .07 + i * .09, .36,
      fundamental * ratio, fundamental * ratio * 1.7, .05, sourcePan, 'sine'));
  }
  air('launch', .48, .40, profile.air * .5, profile.air * 2, enhanced ? .17 : .12, 0);
  note('launch', .48, .40, fundamental * 3.3, fundamental * .8, .065, 0);

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
      // Summons sustain after contact; enemy critical attacks still finish inside
      // the existing 2.05 s animation, rather than leaking into the next question.
      const tail = success ? 1.48 : .72;
      note('tail', 1.12, tail, fundamental * .75, fundamental * .5, .075, 0, 'sine');
      air('tail', 1.08, tail, profile.air * .6, 200, .08, 0, 'lowpass');
      [1, 1.5, 2].forEach((ratio, i) => note('tail', 1.14 + i * .10,
        success ? .93 : .45, profile.shimmer * ratio, profile.shimmer * ratio * (success ? 1.08 : .8),
        .03, i % 2 ? -.35 : .35, 'sine'));
    }
  }
  return { profile: profile.id, enhanced, impact: .9 / (reducedMotion ? 6 : 1),
    duration: duration / (reducedMotion ? 6 : 1), voices };
}
