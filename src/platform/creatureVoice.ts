import type { BattleSoundVoice } from './battleSoundDesign';

interface Resonator { first: number; second: number; pole: number; decay: number; feed: number; }

function resonator(frequency: number, width: number, sampleRate: number): Resonator {
  const decay = Math.exp(-Math.PI * width / sampleRate);
  const angle = 2 * Math.PI * Math.min(frequency, sampleRate * .42) / sampleRate;
  return { first: 0, second: 0, pole: 2 * decay * Math.cos(angle), decay, feed: (1 - decay) * 2 * Math.sin(angle) };
}
function resonate(filter: Resonator, input: number): number {
  const value = filter.pole * filter.first - filter.decay ** 2 * filter.second + input * filter.feed;
  filter.second = filter.first; filter.first = value;
  return value;
}

/** Original creature sound: rough vocal folds, pitch breaks and two formants.
 * A bright, split bird cry and a low, throaty dragon roar remain recognizable
 * on a tablet's small speaker without depending on inaudible sub-bass. */
export function synthesizeCreatureVoice(voice: Pick<BattleSoundVoice, 'creature' | 'from' | 'to' | 'duration'>,
  sampleRate: number): Float32Array {
  const frames = Math.max(1, Math.ceil(sampleRate * voice.duration));
  const samples = new Float32Array(frames);
  const bird = voice.creature === 'phoenix';
  const throat = resonator(bird ? 2450 : 510, bird ? 430 : 155, sampleRate);
  const mouth = resonator(bird ? 4100 : 1330, bird ? 650 : 290, sampleRate);
  let phase = 0, seed = bird ? 0x70686f65 : 0x64726167, peak = 0;
  for (let i = 0; i < frames; i++) {
    const time = i / sampleRate, t = i / Math.max(1, frames - 1);
    // The call climbs and breaks; the roar opens its throat, then drops in pitch.
    const inflection = bird
      ? .73 + .56 * Math.sin(Math.PI * Math.min(1, t * 1.7)) + .2 * Math.sin(3 * Math.PI * t)
      : .76 + .65 * Math.sin(Math.PI * Math.min(1, t * 1.32));
    const vibrato = 1 + (bird ? .045 : .085) * Math.sin(2 * Math.PI * (bird ? 27 : 21) * time)
      + .025 * Math.sin(2 * Math.PI * 47 * time);
    const hz = voice.from * (voice.to / voice.from) ** t * inflection * vibrato;
    phase += 2 * Math.PI * Math.min(hz, sampleRate * .15) / sampleRate;
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const rasp = ((seed >>> 0) / 0xffffffff) * 2 - 1;
    let throatSource = 0;
    for (let harmonic = 1; harmonic <= (bird ? 6 : 12); harmonic++)
      throatSource += Math.sin(phase * harmonic + .16 * Math.sin(phase * .49)) / harmonic;
    const pulse = bird ? .82 + .18 * Math.sin(2 * Math.PI * 13 * time)
      : .69 + .31 * Math.sin(2 * Math.PI * 32 * time) ** 2;
    const rough = throatSource * pulse;
    const breath = rough + rasp * (bird ? .19 : .4);
    const formants = resonate(throat, breath) * (bird ? 1.65 : 1.2)
      + resonate(mouth, breath) * (bird ? 1.4 : .7);
    const window = Math.sin(Math.PI * Math.min(1, t / .06) / 2)
      * Math.sin(Math.PI * Math.min(1, (1 - t) / .18) / 2);
    const splitCry = bird ? .76 + .24 * Math.sin(3.1 * Math.PI * t) ** 2 : 1;
    const value = Math.tanh((rough * (bird ? .42 : .6) + formants) * 1.25) * window * splitCry;
    samples[i] = value; peak = Math.max(peak, Math.abs(value));
  }
  // Level matching belongs here; the shared cast compressor controls the mix.
  const scale = peak > 0 ? .84 / peak : 0;
  for (let i = 0; i < frames; i++) samples[i] *= scale;
  return samples;
}
