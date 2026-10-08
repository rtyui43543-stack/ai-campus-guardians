// Original 160 BPM final-boss instrumental: 32 bars / 48 seconds.
// Node built-ins only. No third-party recording, song, sample or external model.
// All instrument tails wrap around the PCM buffer for a continuous loop.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const rate = 22050, bpm = 160, bars = 32, beat = 60 / bpm;
const seconds = bars * 4 * beat, frames = Math.round(rate * seconds);
const channels = [new Float64Array(frames), new Float64Array(frames)];
let seed = 2026100807;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296 * 2 - 1;
};
const hz = note => 440 * 2 ** ((note - 69) / 12);
const triangle = phase => 2 / Math.PI * Math.asin(Math.sin(phase));
const envelope = (t, duration, attack, release) =>
  Math.max(0, Math.min(1, t / attack, (duration - t) / release));

function sound(start, duration, wave, volume, pan = 0) {
  const offset = Math.round(start * rate), count = Math.ceil(duration * rate);
  const left = Math.sqrt((1 - pan) / 2), right = Math.sqrt((1 + pan) / 2);
  for (let i = 0; i < count; i += 1) {
    const t = i / rate, value = wave(t, i) * volume, at = (offset + i) % frames;
    channels[0][at] += value * left; channels[1][at] += value * right;
  }
}
function kick(start, strength = 1) {
  sound(start, .34, t => {
    const phase = 2 * Math.PI * (42 * t + 100 * .021 * (1 - Math.exp(-t / .021)));
    return Math.sin(phase) * Math.exp(-t * 17)
      + random() * Math.exp(-t * 210) * .08;
  }, .33 * strength);
}
function snare(start, strength = 1) {
  let previous = 0;
  sound(start, .25, t => {
    const noise = random(), high = noise - previous * .78; previous = noise;
    return high * Math.exp(-t * 24) * .46
      + Math.sin(2 * Math.PI * 174 * t) * Math.exp(-t * 28) * .34;
  }, .12 * strength, .09);
}
function cymbal(start, duration = .08, strength = 1) {
  let previous = 0;
  sound(start, duration, t => {
    const n = random(), high = n - previous; previous = n;
    return high * Math.min(1, t / .005) * Math.exp(-t * (duration < .2 ? 65 : 5.5));
  }, (duration < .2 ? .018 : .040) * strength, .32);
}
function timpani(start, note, strength = 1) {
  const pitch = hz(note);
  sound(start, .85, t => {
    const p = 2 * Math.PI * pitch * t;
    return Math.min(1, t / .007) * Math.exp(-t * 6)
      * (Math.sin(p) + .28 * Math.sin(p * 1.49) + .13 * Math.sin(p * 2.21));
  }, .10 * strength, -.23);
}
function bass(start, note, duration = beat * .8, strength = 1) {
  const pitch = hz(note);
  sound(start, duration, t => envelope(t, duration, .009, .035)
    * (Math.sin(2 * Math.PI * pitch * t) * .75
      + triangle(2 * Math.PI * pitch * t) * .25), .16 * strength, -.07);
}
function string(start, note, duration, strength, pan) {
  const pitch = hz(note);
  const wave = t => {
    const p = 2 * Math.PI * pitch * t;
    const vibrato = .018 * Math.sin(t * 2 * Math.PI * 5);
    return envelope(t, duration, .009, .055)
      * (Math.sin(p + vibrato) * .58 + Math.sin(p * 2) * .22
        + Math.sin(p * 3) * .12 + Math.sin(p * 4) * .08);
  };
  sound(start, duration, wave, .050 * strength, pan);
  sound(start + beat * .75, duration, wave, .011 * strength, -pan);
}
function brass(start, note, duration, strength = 1) {
  const pitch = hz(note);
  const wave = t => {
    const p = 2 * Math.PI * pitch * t;
    return envelope(t, duration, .025, .075) * (.88 + Math.sin(t * 4) * .12)
      * (triangle(p) * .55 + Math.sin(p) * .32
        + Math.sin(p * 2) * .09 + Math.sin(p * 3) * .04);
  };
  sound(start, duration, wave, .10 * strength, -.13);
  sound(start + beat * .66, duration, wave, .017 * strength, .24);
}
function choirPad(start, notes, strength = 1) {
  notes.forEach((note, index) => {
    const pitch = hz(note), duration = 4 * beat + .24;
    sound(start, duration, t => envelope(t, duration, .13, .22)
      * (Math.sin(2 * Math.PI * pitch * t) * .83
        + Math.sin(2 * Math.PI * pitch * 2.005 * t) * .17),
      .023 * strength, (index - 1) * .44);
  });
}
function bell(start, note, pan, strength = 1) {
  const pitch = hz(note);
  sound(start, 1.12, t => Math.min(1, t / .006) * Math.exp(-t * 5.2)
    * (Math.sin(2 * Math.PI * pitch * t)
      + .18 * Math.sin(2 * Math.PI * pitch * 2 * t)), .028 * strength, pan);
}

const progression = [
  { root: 38, chord: [50, 53, 57], arp: [62, 69, 65, 69], melody: [74, 77, 81, 79] },
  { root: 34, chord: [46, 50, 53], arp: [62, 65, 70, 65], melody: [77, 74, 77, 82] },
  { root: 41, chord: [53, 57, 60], arp: [65, 72, 69, 72], melody: [81, 79, 77, 76] },
  { root: 36, chord: [48, 52, 55], arp: [64, 67, 72, 67], melody: [76, 79, 84, 79] },
  { root: 38, chord: [50, 53, 57], arp: [62, 65, 69, 65], melody: [81, 77, 74, 77] },
  { root: 31, chord: [43, 46, 50], arp: [62, 67, 70, 67], melody: [79, 82, 79, 77] },
  { root: 34, chord: [46, 50, 53], arp: [62, 65, 70, 65], melody: [77, 74, 70, 74] },
  { root: 33, chord: [45, 49, 52], arp: [61, 64, 69, 64], melody: [76, 73, 76, 73] },
];
for (let bar = 0; bar < bars; bar += 1) {
  const start = bar * 4 * beat, part = progression[bar % progression.length];
  const section = Math.floor(bar / 8), strength = [.76, .90, .81, 1.0][section];
  choirPad(start, part.chord, strength);
  for (const [index, position] of [0, 1.5, 2, 3.5].entries())
    kick(start + position * beat, strength * (index === 0 ? 1.05 : .9));
  snare(start + beat, strength); snare(start + 3 * beat, strength);
  for (let step = 0; step < 16; step += 1) {
    cymbal(start + step * beat / 4, step % 4 === 0 ? .10 : .055,
      strength * (step % 4 === 0 ? 1 : .7));
    const note = part.arp[(step + section) % 4];
    string(start + step * beat / 4, note, beat * .45, strength,
      step % 2 === 0 ? -.40 : .40);
    if (section === 3 && step % 2 === 0)
      string(start + step * beat / 4, note + 12, beat * .45, .5, .14);
  }
  for (const [index, position] of [0, .75, 1.5, 2, 2.75, 3.5].entries())
    bass(start + position * beat, part.root + (index === 3 ? 12 : index === 5 ? 7 : 0),
      beat * .75, strength);
  timpani(start, part.root, strength);
  if (section !== 2 || bar % 2 === 1) {
    const melody = section % 2 ? [...part.melody].reverse() : part.melody;
    melody.forEach((note, index) =>
      brass(start + [0, 1.25, 2.25, 3.25][index] * beat, note,
        [1.15, .9, .9, .66][index] * beat, strength));
  } else {
    bell(start + beat * .5, part.melody[0] + 12, .31, strength);
    bell(start + beat * 2.5, part.melody[2] + 12, -.31, strength);
  }
  if (bar % 8 === 0) {
    cymbal(start, 1.2, strength); timpani(start + beat * .5, part.root + 7, .55);
  }
  if (bar % 4 === 3) {
    snare(start + beat * 3.5, .42 * strength);
    snare(start + beat * 3.75, .28 * strength);
    timpani(start + beat * 3.25, part.root + 12, .43 * strength);
  }
}

let peak = 0, sumSquares = 0;
for (const channel of channels) for (const value of channel) peak = Math.max(peak, Math.abs(value));
const scale = .84 / peak, pcmBytes = frames * 4, wav = Buffer.alloc(44 + pcmBytes);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + pcmBytes, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22); wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 4, 28);
wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
wav.writeUInt32LE(pcmBytes, 40);
for (let frame = 0; frame < frames; frame += 1) for (let channel = 0; channel < 2; channel += 1) {
  const value = channels[channel][frame] * scale;
  sumSquares += value * value;
  wav.writeInt16LE(Math.round(value * 32767), 44 + frame * 4 + channel * 2);
}
const output = fileURLToPath(new URL('../public/music/final-battle.wav', import.meta.url));
await mkdir(fileURLToPath(new URL('../public/music/', import.meta.url)), { recursive: true });
await writeFile(output, wav);
const seam = channels.map(ch => Math.abs(ch[0] - ch.at(-1)) * scale);
console.log(JSON.stringify({
  output, seconds, bpm, bars, rate, channels: 2, bytes: wav.length,
  peak: .84, rms: Math.sqrt(sumSquares / (frames * 2)), seam
}, null, 2));
