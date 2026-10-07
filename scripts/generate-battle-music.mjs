// Original 120 BPM, eight-bar school adventure instrumental. Node built-ins only.
// Every tail wraps into the beginning, so the 16-second PCM loop has no added silence.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const rate = 22050, seconds = 16, frames = rate * seconds, beat = .5;
const channels = [new Float64Array(frames), new Float64Array(frames)];
let seed = 821725;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const triangle = phase => 2 / Math.PI * Math.asin(Math.sin(phase));

function sound(start, duration, waveform, volume = 1, pan = 0) {
  const offset = Math.round(start * rate), count = Math.ceil(duration * rate);
  const left = Math.sqrt((1 - pan) / 2), right = Math.sqrt((1 + pan) / 2);
  for (let i = 0; i < count; i += 1) {
    const t = i / rate, value = waveform(t, i) * volume;
    const at = (offset + i) % frames;
    channels[0][at] += value * left;
    channels[1][at] += value * right;
  }
}

function kick(start, volume = 1) {
  sound(start, .30, t => {
    const phase = 2 * Math.PI * (48 * t + 90 * .018 * (1 - Math.exp(-t / .018)));
    return Math.sin(phase) * Math.exp(-t * 20) + random() * Math.exp(-t * 250) * .14;
  }, volume * .40);
}
function snare(start, volume = 1) {
  let previous = 0;
  sound(start, .20, t => {
    const noise = random(), filtered = noise - previous * .7;
    previous = noise;
    return filtered * Math.exp(-t * 27) * .62 + Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 35) * .32;
  }, volume * .20);
}
function hat(start, accent = false) {
  let previous = 0;
  sound(start, accent ? .085 : .047, t => {
    const noise = random(), filtered = noise - previous;
    previous = noise;
    return filtered * Math.min(1, t * 1800) * Math.exp(-t * (accent ? 65 : 100));
  }, accent ? .037 : .022, .24);
}
function bass(start, midi, duration = .20) {
  const pitch = hz(midi);
  sound(start, duration, t => {
    const envelope = Math.min(1, t / .008) * Math.min(1, (duration - t) / .028);
    return (Math.sin(2 * Math.PI * pitch * t) * .8 + triangle(2 * Math.PI * pitch * t) * .2) * envelope;
  }, .20, -.08);
}
function chime(start, midi, pan) {
  const pitch = hz(midi);
  const wave = t => Math.min(1, t / .006) * Math.exp(-t * 8)
    * (Math.sin(2 * Math.PI * pitch * t) * .75 + Math.sin(2 * Math.PI * pitch * 2 * t) * .18);
  sound(start, .62, wave, .064, pan);
  sound(start + .375, .62, wave, .018, -pan);
}
function chord(start, notes) {
  notes.forEach((note, index) => {
    const pitch = hz(note), duration = 1.97;
    sound(start, duration, t => {
      const envelope = Math.min(1, t / .16) * Math.min(1, (duration - t) / .25);
      return triangle(2 * Math.PI * pitch * t) * envelope * (.8 + Math.sin(t * 5) * .2);
    }, .018, (index - 1) * .5);
  });
}

const harmony = [
  { bass: 45, notes: [57, 60, 64], arp: [69, 72, 76, 72, 69, 76, 79, 76] },
  { bass: 41, notes: [53, 57, 60], arp: [65, 69, 72, 69, 65, 72, 76, 72] },
  { bass: 48, notes: [55, 60, 64], arp: [67, 72, 76, 72, 67, 76, 79, 76] },
  { bass: 43, notes: [55, 59, 62], arp: [67, 71, 74, 71, 67, 74, 79, 74] },
];
for (let bar = 0; bar < 8; bar += 1) {
  const start = bar * 4 * beat, part = harmony[bar % 4];
  chord(start, part.notes);
  [0, 1.5, 2, 3.5].forEach((step, index) => kick(start + step * beat, index === 0 ? 1 : .85));
  [1, 3].forEach(step => snare(start + step * beat));
  for (let step = 0; step < 16; step += 1) hat(start + step * beat / 4, step % 4 === 0);
  [0, .75, 1.5, 2, 2.75, 3.5].forEach((step, index) => bass(start + step * beat,
    part.bass + (index === 3 ? 12 : index === 5 ? 7 : 0), .19));
  for (let step = 0; step < 8; step += 1) {
    const note = part.arp[(step + (bar > 3 ? 2 : 0)) % 8];
    chime(start + step * beat / 2, note, step % 2 === 0 ? -.38 : .38);
  }
  if (bar === 3 || bar === 7) {
    snare(start + 3.5 * beat, .36);
    snare(start + 3.75 * beat, .26);
  }
}

let peak = 0;
for (const channel of channels) for (const value of channel) peak = Math.max(peak, Math.abs(value));
const pcmBytes = frames * 4, wav = Buffer.alloc(44 + pcmBytes);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + pcmBytes, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22); wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 4, 28);
wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcmBytes, 40);
for (let frame = 0; frame < frames; frame += 1) {
  for (let channel = 0; channel < 2; channel += 1) {
    wav.writeInt16LE(Math.round(channels[channel][frame] / peak * .88 * 32767), 44 + frame * 4 + channel * 2);
  }
}
const output = fileURLToPath(new URL('../public/music/battle-theme.wav', import.meta.url));
await mkdir(fileURLToPath(new URL('../public/music/', import.meta.url)), { recursive: true });
await writeFile(output, wav);
console.log(`Original battle loop: ${seconds}s, 120 BPM, stereo PCM, ${wav.length} bytes.`);
