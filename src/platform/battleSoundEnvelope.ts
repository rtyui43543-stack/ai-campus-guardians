import type { BattleSoundVoice } from './battleSoundDesign';

export interface BattleEnvelopePoint {
  method: 'setValueAtTime' | 'linearRampToValueAtTime' | 'exponentialRampToValueAtTime';
  value: number;
  time: number;
}

/** Shared with acoustic acceptance renders so their envelopes match gameplay. */
export function battleVoiceEnvelope(voice: Pick<BattleSoundVoice, 'gain' | 'duration' | 'envelope'>,
  at = 0): BattleEnvelopePoint[] {
  const attack = voice.envelope === 'swell' ? voice.duration * .32
    : voice.envelope === 'punch' ? Math.min(.004, voice.duration * .1) : Math.min(.012, voice.duration * .15);
  const points: BattleEnvelopePoint[] = [
    { method: 'setValueAtTime', value: 0, time: at },
    { method: 'linearRampToValueAtTime', value: voice.gain, time: at + attack },
  ];
  if (voice.envelope === 'punch') {
    points.push({ method: 'setValueAtTime', value: voice.gain, time: at + Math.min(.065, voice.duration * .3) });
  } else if (voice.envelope === 'gust') {
    [.58, .92, .63, .85, .43].forEach((level, i) => points.push({ method: 'linearRampToValueAtTime',
      value: voice.gain * level, time: at + voice.duration * (.17 + i * .14) }));
  } else if (voice.envelope) {
    points.push({ method: 'linearRampToValueAtTime', value: voice.gain * .78, time: at + voice.duration * .7 });
  }
  points.push({ method: 'exponentialRampToValueAtTime', value: .0001, time: at + voice.duration });
  return points;
}
