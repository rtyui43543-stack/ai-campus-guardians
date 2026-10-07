import { mkdirSync, writeFileSync } from 'node:fs';
import { expectedAudio } from './check-content';
const { index, utterances } = expectedAudio();
mkdirSync('public/audio', { recursive: true });
mkdirSync('.audio-work', { recursive: true });
writeFileSync('public/audio/index.json', JSON.stringify(index));
writeFileSync('.audio-work/utterances.json', JSON.stringify([...utterances].map(([file,text]) => ({file,text})), null, 2));
console.log('Audio manifest: ' + Object.keys(index).length + ' keys, ' + utterances.size + ' unique offline clips.');
