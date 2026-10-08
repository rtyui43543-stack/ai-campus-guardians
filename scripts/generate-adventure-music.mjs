// Original 96 BPM major-key exploration music: harp, woodwind, bells and gentle percussion.
// Instrument tails wrap into the beginning, making a seamless offline 20-second loop.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const rate = 22050, seconds = 20, frames = rate * seconds, beat = .625;
const channels = [new Float64Array(frames), new Float64Array(frames)];
let seed = 104708;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
function sound(start, duration, waveform, volume, pan = 0) {
  const offset = Math.round(start * rate), count = Math.ceil(duration * rate);
  const left = Math.sqrt((1 - pan) / 2), right = Math.sqrt((1 + pan) / 2);
  for (let i = 0; i < count; i += 1) {
    const t = i / rate, value = waveform(t, i) * volume, at = (offset + i) % frames;
    channels[0][at] += value * left; channels[1][at] += value * right;
  }
}
function harp(start, note, pan) {
  const pitch = hz(note), waveform = t => Math.min(1, t / .012) * Math.exp(-t * 5.2)
    * (Math.sin(2 * Math.PI * pitch * t) + .22 * Math.sin(2 * Math.PI * pitch * 2 * t));
  sound(start, 1.35, waveform, .055, pan);
  sound(start + beat * .75, 1.35, waveform, .012, -pan);
}
function flute(start, note, duration) {
  const pitch = hz(note);
  sound(start, duration + .12, t => {
    const envelope = Math.min(1, t / .10) * Math.min(1, Math.max(0, duration + .12 - t) / .15);
    const phase = 2 * Math.PI * pitch * t + .02 * Math.sin(t * 2 * Math.PI * 4);
    return envelope * (Math.sin(phase) + .12 * Math.sin(phase * 2));
  }, .062, .10);
}
function bell(start, note) {
  const pitch = hz(note);
  sound(start, 1.5, t => Math.min(1, t / .014) * Math.exp(-t * 4.2)
    * (Math.sin(2 * Math.PI * pitch * t) + .16 * Math.sin(2 * Math.PI * pitch * 3 * t)), .025, .28);
}
function pad(start, notes) {
  notes.forEach((note, index) => {
    const pitch = hz(note), duration = beat * 4 + .12;
    sound(start, duration, t => Math.min(1, t / .30) * Math.min(1, (duration - t) / .35)
      * (Math.sin(2 * Math.PI * pitch * t) + .10 * Math.sin(2 * Math.PI * pitch * 2 * t)), .024, (index - 1) * .45);
  });
}
function bass(start, note) {
  const pitch = hz(note), duration = beat * 1.6;
  sound(start, duration, t => Math.sin(2 * Math.PI * pitch * t) * Math.min(1, t / .03)
    * Math.min(1, (duration - t) / .16), .08, -.08);
}
function brush(start, pan) {
  let previous = 0;
  sound(start, .11, t => {
    const noise = random(), value = noise - previous * .65;
    previous = noise;
    return value * Math.min(1, t / .008) * Math.exp(-t * 42);
  }, .014, pan);
}
const harmony = [
  { bass: 48, notes: [60, 64, 67], melody: [[0, 76, 1], [1.5, 79, .75], [2.5, 81, .75], [3.5, 79, .5]] },
  { bass: 43, notes: [59, 62, 67], melody: [[0, 74, 1.5], [2, 76, .75], [3, 79, .75]] },
  { bass: 45, notes: [57, 60, 64], melody: [[0, 81, 1], [1.5, 79, .75], [2.5, 76, 1.25]] },
  { bass: 41, notes: [57, 60, 65], melody: [[0, 77, 1.5], [2, 76, .75], [3, 74, .75]] },
  { bass: 48, notes: [55, 60, 64], melody: [[0, 76, .75], [1, 79, .75], [2, 84, 1.5]] },
  { bass: 40, notes: [55, 59, 64], melody: [[0, 83, 1], [1.5, 79, .75], [2.5, 76, 1.25]] },
  { bass: 41, notes: [57, 60, 65], melody: [[0, 77, 1], [1.5, 81, .75], [2.5, 79, .75], [3.5, 77, .5]] },
  { bass: 43, notes: [55, 59, 62], melody: [[0, 74, 1], [1.5, 71, .75], [2.5, 72, 1.25]] },
];
for (let bar = 0; bar < harmony.length; bar += 1) {
  const start = bar * beat * 4, part = harmony[bar];
  pad(start, part.notes);
  bass(start, part.bass); bass(start + beat * 2, part.bass + 7);
  for (let step = 0; step < 8; step += 1) {
    harp(start + step * beat / 2, part.notes[[0, 1, 2, 1, 0, 2, 1, 2][step]] + 12, step % 2 ? .35 : -.35);
    if (step % 2 === 0) brush(start + step * beat / 2, step % 4 ? -.25 : .25);
  }
  part.melody.forEach(([position, note, length]) => flute(start + position * beat, note, length * beat));
  bell(start + beat * 3, part.notes[2] + 24);
}
let peak = 0;
for (const channel of channels) for (const value of channel) peak = Math.max(peak, Math.abs(value));
const pcmBytes = frames * 4, wav = Buffer.alloc(44 + pcmBytes);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + pcmBytes, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22); wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 4, 28);
wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcmBytes, 40);
for (let frame = 0; frame < frames; frame += 1) for (let channel = 0; channel < 2; channel += 1) {
  wav.writeInt16LE(Math.round(channels[channel][frame] / peak * .68 * 32767), 44 + frame * 4 + channel * 2);
}
await mkdir(fileURLToPath(new URL('../public/music/', import.meta.url)), { recursive: true });
await writeFile(fileURLToPath(new URL('../public/music/adventure-theme.wav', import.meta.url)), wav);
console.log(`Original adventure loop: ${seconds}s, 96 BPM, stereo PCM, ${wav.length} bytes.`);
