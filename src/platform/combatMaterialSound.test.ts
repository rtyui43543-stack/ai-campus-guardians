import { describe, expect, it } from 'vitest';
import { buildBattleSound } from './battleSoundDesign';
import { buildBattleSampleCues } from './battleSamples';
import { battleVoiceEnvelope, type BattleEnvelopePoint } from './battleSoundEnvelope';

const modes = ['starter', 'advanced'] as const;
const skills = {
  hero: ['seal-ring', 'lightning-crack', 'wood-fit', 'mirror-fracture', 'fire-burst', 'ice-pierce'],
  starter: ['chain-clank', 'paper-slice', 'stamp-thud', 'mask-crack', 'paper-slice', 'gear-tooth'],
  advanced: ['silk-snap', 'sand-pelt', 'vine-crack', 'shadow-cut', 'ink-splash', 'lightning-crack'],
};
function shortPlans(reduced = false) {
  return modes.flatMap(mode => [false, true].flatMap(success => Array.from({ length: 6 }, (_, i) =>
    [false, ...(!success ? [true] : [])].map(enhanced => buildBattleSound(success, i + 1, reduced,
      { mode, enemyCritical: enhanced })))).flat())
    .concat(modes.flatMap(mode => [false, true].map(enemyCritical =>
      buildBattleSound(false, 1, reduced, { mode, enemyCritical, finalBoss: true }))));
}
function envelopeAt(points: BattleEnvelopePoint[], time: number) {
  if (time < points[0].time || time >= points.at(-1)!.time) return 0;
  for (let i = 1; i < points.length; i++) {
    const before = points[i - 1], after = points[i];
    if (time >= after.time) continue;
    const p = (time - before.time) / (after.time - before.time);
    return after.method === 'setValueAtTime' ? before.value
      : after.method === 'exponentialRampToValueAtTime' ? before.value * (after.value / before.value) ** p
      : before.value + (after.value - before.value) * p;
  }
  return 0;
}

describe('short spell material identity and headroom', () => {
  it('gives all six hero hits and twelve boss abilities their own audible material and travelling release', () => {
    for (const mode of modes) for (const success of [false, true]) for (let theme = 1; theme <= 6; theme++) {
      const plan = buildBattleSound(success, theme, false, { mode });
      expect(plan.voices.some(voice => voice.layer === skills[success ? 'hero' : mode][theme - 1])).toBe(true);
      for (const phase of ['charge', 'launch', 'impact', 'tail']) expect(plan.voices.some(voice => voice.phase === phase)).toBe(true);
      const flight = plan.voices.find(voice => voice.phase === 'launch' && voice.panTo !== undefined)!;
      expect(flight).toBeDefined();
      expect(flight.panTo! * flight.pan).toBeLessThan(0);
      expect(Math.sign(flight.panTo! - flight.pan)).toBe(success ? 1 : -1);
      expect(plan.voices.some(voice => voice.creature)).toBe(false);
    }
    for (const mode of modes) {
      const signatures = Array.from({ length: 6 }, (_, i) => buildBattleSound(false, i + 1, false, { mode })
        .voices.map(voice => voice.layer).join(','));
      expect(new Set(signatures).size).toBe(6);
    }
  });

  it('retains each enemy material during pursuit rather than turning ink into fire or silk into glass', () => {
    for (const mode of modes) for (let theme = 1; theme <= 6; theme++) {
      const plan = buildBattleSound(false, theme, false, { mode, enemyCritical: true });
      expect(plan.voices.some(voice => voice.layer === skills[mode][theme - 1])).toBe(true);
      expect(plan.voices.some(voice => voice.layer === `${plan.profile}-threat`)).toBe(true);
      expect(plan.voices.some(voice => voice.layer === `${plan.profile}-critical-trail`)).toBe(true);
      expect(plan.voices.some(voice => voice.creature)).toBe(false);
    }
    for (const mode of modes) {
      const plan = buildBattleSound(false, 4, false, { mode, finalBoss: true, enemyCritical: true });
      expect(plan.voices.some(voice => voice.layer === (mode === 'starter' ? 'grimoire-barrage' : 'dragon-frost-wave'))).toBe(true);
      expect(plan.voices.some(voice => voice.creature === 'dragon')).toBe(mode === 'advanced');
    }
  });

  it('keeps real hit contact at .9s and clears finite, ordered envelopes inside both animation clocks', () => {
    for (const reduced of [false, true]) for (const plan of shortPlans(reduced)) {
      const speed = reduced ? 6 : 1;
      expect(plan.duration).toBe(2.05 / speed);
      expect(Math.min(...plan.voices.filter(v => v.phase === 'launch').map(v => v.at))).toBe(.48 / speed);
      expect(plan.voices.find(v => v.layer === 'impact-body')?.at).toBe(.9 / speed);
      for (const voice of plan.voices) {
        expect([voice.at, voice.duration, voice.from, voice.to, voice.gain, voice.pan].every(Number.isFinite)).toBe(true);
        expect(voice.at + voice.duration + .006).toBeLessThan(plan.duration);
        expect(voice.from).toBeGreaterThan(0); expect(voice.to).toBeGreaterThan(0);
        const points = battleVoiceEnvelope(voice, voice.at);
        expect(points.every(point => Number.isFinite(point.time) && Number.isFinite(point.value) && point.value >= 0)).toBe(true);
        expect(points.every((point, i) => i === 0 || point.time > points[i - 1].time)).toBe(true);
        expect(points.at(-1)?.value).toBe(.0001);
      }
    }
  });

  it('holds a short body behind the leading transient instead of raising the whole mix', () => {
    const voice = buildBattleSound(true, 3).voices.find(v => v.layer === 'impact-body')!;
    const points = battleVoiceEnvelope(voice);
    expect(points[1]).toMatchObject({ value: voice.gain, time: .004 });
    expect(points[2]).toMatchObject({ method: 'setValueAtTime', value: voice.gain, time: .065 });
    expect(envelopeAt(points, .05)).toBe(voice.gain);
    expect(envelopeAt(points, .20)).toBeLessThan(voice.gain * .1);
  });

  it('preserves material accents when a filtered impact sample replaces its body, and keeps fallbacks complete', () => {
    for (const plan of shortPlans()) {
      const cues = buildBattleSampleCues(plan);
      expect(cues.some(cue => ['heavy-impact', 'explosion'].includes(cue.id))).toBe(true);
      const impact = cues.find(cue => cue.at === plan.impact)!;
      expect(impact.replaces(plan.voices.find(v => v.layer === 'impact-body')!)).toBe(true);
      expect(impact.replaces(plan.voices.find(v => v.layer === 'contact-snap')!)).toBe(false);
      expect(plan.voices.filter(v => v.phase === 'tail').some(v => !cues.some(cue => cue.replaces(v)))).toBe(true);
      expect(impact.duration).toBeLessThan(.8);
      if (impact.filter) {
        expect(impact.filter.from).toBeGreaterThan(0);
        expect(impact.filter.to).toBeGreaterThan(0);
        expect(impact.filter.resonance).toBeLessThanOrEqual(.71);
      }
    }
  });

  it('never adds a damaging transient or impact sample to a shield interception or a missed spell', () => {
    for (const mode of modes) for (const finalBoss of [false, true]) for (const enemyCritical of [false, true]) {
      for (let theme = 1; theme <= 6; theme++) for (const outcome of [{ blocked: true }, { missed: true }]) {
        const plan = buildBattleSound(false, theme, false, { mode, finalBoss, enemyCritical, ...outcome });
        expect(plan.voices.some(v => ['impact-body', 'impact-air', 'contact-snap'].includes(v.layer ?? ''))).toBe(false);
        expect(plan.voices.some(v => v.phase === 'impact' && v.kind === 'triangle')).toBe(false);
        expect(buildBattleSampleCues(plan).some(cue => ['heavy-impact', 'explosion'].includes(cue.id))).toBe(false);
      }
    }
  });

  it('keeps a conservative unity-source envelope budget below clipping before the unchanged compressor', () => {
    // This checks gain staging, not the decoded asset waveform or perceived
    // loudness. Browser OfflineAudioContext rendering also checks the real PCM.
    for (const plan of shortPlans()) for (const ready of [false, true]) {
      const cues = ready ? buildBattleSampleCues(plan) : [];
      const voices = plan.voices.filter(v => !cues.some(cue => cue.replaces(v)));
      const envelopes = voices.map(v => battleVoiceEnvelope(v, v.at));
      let peak = 0;
      for (let tick = 0; tick < 2050; tick++) {
        const time = tick / 1000;
        const gain = envelopes.reduce((sum, points) => sum + envelopeAt(points, time), 0)
          + cues.reduce((sum, cue) => sum + (time >= cue.at && time < cue.at + cue.duration ? cue.gain : 0), 0);
        peak = Math.max(peak, gain * (plan.enhanced ? .85 : 1.20));
      }
      expect(peak, `${plan.profile} ${plan.enhanced ? 'critical' : 'normal'} ${ready ? 'samples' : 'fallback'}`).toBeLessThan(.95);
    }
  });
});
