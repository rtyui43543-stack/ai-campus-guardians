import { readFile, readdir, realpath, stat, unlink } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';

// Only generated hash-named MP3s in this project's public/audio may be removed.
const root = await realpath(resolve('public/audio'));
const index = JSON.parse(await readFile(resolve(root, 'index.json'), 'utf8'));
const wanted = new Set(Object.values(index).map(url => {
  if (typeof url !== 'string' || !/^\/audio\/[a-f0-9]{20}\.mp3$/.test(url)) throw new Error('Invalid narration index.');
  return url.slice(7);
}));
for (const file of wanted) if ((await stat(resolve(root, file))).size <= 500) throw new Error('Missing generated clip: ' + file);
let removed = 0;
for (const file of await readdir(root)) {
  if (!/^[a-f0-9]{20}\.mp3$/.test(file) || wanted.has(file)) continue;
  const path = resolve(root, file), final = await realpath(path), part = relative(root, final);
  if (part === '..' || part.startsWith('..' + sep) || isAbsolute(part)) throw new Error('Audio path leaves the generated folder.');
  await unlink(path); removed++;
}
console.log('Kept ' + wanted.size + ' current narration clips; removed ' + removed + ' obsolete generated clips.');
